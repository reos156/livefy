const path = require('node:path')
const fs = require('node:fs/promises')
const { pathToFileURL } = require('node:url')

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

function rendererHandler(root, net) {
  return async request => {
    const target = rendererPath(request.url, root)
    if (!target) return new Response(null, { status: 403 })
    try {
      // Real paths also prevent a symlink in dist from escaping the build root.
      const [base, file] = await Promise.all([fs.realpath(root), fs.realpath(target)])
      const relative = path.relative(base, file)
      if (relative.startsWith('..') || path.isAbsolute(relative)) return new Response(null, { status: 403 })
      return net.fetch(pathToFileURL(file).href)
    } catch {
      return new Response(null, { status: 404 })
    }
  }
}
module.exports = { rendererPath, rendererHandler }
