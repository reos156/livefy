const path = require('node:path')
const fs = require('node:fs/promises')
const { pathToFileURL } = require('node:url')
const { PRODUCTION_CSP } = require('./csp-policy.cjs')

function rendererPath(raw, root) {
  if (!raw.startsWith('livefy://renderer/') || /[%](?:2f|5c|00)/i.test(raw) || raw.includes('\\')) return null
  try {
    const pathname = decodeURIComponent(raw.slice('livefy://renderer'.length).split(/[?#]/)[0])
    if (pathname.includes('\0') || pathname.split('/').some(part => part === '..' || part === '.')) return null
    const target = path.resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`)
    const relative = path.relative(path.resolve(root), target)
    return relative.startsWith('..') || path.isAbsolute(relative) ? null : target
  } catch {
    return null
  }
}

// Every renderer response, including the refusals below, carries the production
// policy as a real response header. The index.html meta tag stays as the
// documented fallback, but the header is the delivery the packaged renderer
// must not depend on having.
function withProductionCsp(response) {
  const headers = new Headers(response.headers)
  headers.set('Content-Security-Policy', PRODUCTION_CSP)
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers })
}

function refusal(status) {
  return withProductionCsp(new Response(null, { status }))
}

function rendererHandler(root, net) {
  return async request => {
    const target = rendererPath(request.url, root)
    if (!target) return refusal(403)
    try {
      // Real paths also prevent a symlink in dist from escaping the build root.
      const [base, file] = await Promise.all([fs.realpath(root), fs.realpath(target)])
      const relative = path.relative(base, file)
      if (relative.startsWith('..') || path.isAbsolute(relative)) return refusal(403)
      return withProductionCsp(await net.fetch(pathToFileURL(file).href))
    } catch {
      return refusal(404)
    }
  }
}
module.exports = { rendererPath, rendererHandler }
