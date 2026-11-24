// @vitest-environment node
import { expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { mkdtemp, mkdir, writeFile, symlink, rm, realpath } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { rendererPath, rendererHandler } = require('./protocol.cjs')

// The packaged renderer response header is pinned against the shipped meta:
// every directive and origin of the index.html policy, with only the dev-only
// websocket origin removed. Any added directive, widened origin or dropped
// exception fails here.
const metaPolicy = readFileSync(new URL('../index.html', import.meta.url), 'utf8')
  .match(/http-equiv="Content-Security-Policy" content="([^"]+)"/)[1]
const productionPolicy = metaPolicy.replace(' ws://127.0.0.1:5173', '')
const CSP_HEADER = 'content-security-policy'
const directives = policy => policy.split(';').map(part => part.trim().split(' ')[0])
const origins = policy => policy.match(/https?:\/\/[^ ;"*]+|https:\/\/\*[^ ;"]+|wss?:\/\/[^ ;"]+/g)

async function withFixture(run) {
  // Only this runner-owned directory is removed, including on assertion failure.
  const owned = await mkdtemp(path.join(tmpdir(), 'livefy-protocol-test-'))
  try {
    const root = path.join(owned, 'dist')
    await mkdir(path.join(root, 'assets'), { recursive: true })
    await writeFile(path.join(root, 'index.html'), '<html>fixture</html>')
    await writeFile(path.join(root, 'assets', 'app.js'), 'fixture')
    const outside = path.join(owned, 'outside.js')
    await writeFile(outside, 'not a renderer asset')
    await symlink(outside, path.join(root, 'escape.js'))
    const net = { fetch: vi.fn(async () => new Response('fake file response', { headers: { 'x-fixture': 'unchanged' } })) }
    const handle = rendererHandler(root, net)
    await run({ root, net, handle })
  } finally {
    await rm(owned, { recursive: true, force: true })
  }
}

it('serves only the controlled scheme and host within dist', () => {
  expect(rendererPath('livefy://renderer/', '/app/dist')).toBe('/app/dist/index.html')
  expect(rendererPath('livefy://renderer/assets/app.js', '/app/dist')).toBe('/app/dist/assets/app.js')
})
it.each([
  'https://renderer/', 'livefy://other/', 'livefy://renderer:99/',
  'livefy://user@renderer/', 'livefy://renderer/../secret',
  'livefy://renderer/%2e%2e/secret', 'livefy://renderer/a%2fb',
  'livefy://renderer/a%5cb', 'livefy://renderer/%00',
])('rejects unsafe URL %s before URL normalization', url => {
  expect(rendererPath(url, '/app/dist')).toBeNull()
})

it('serves real contained files unchanged and refuses missing, invalid and escaping paths', async () => {
  await withFixture(async ({ root, net, handle }) => {
    for (const [url, file] of [
      ['livefy://renderer/', 'index.html'],
      ['livefy://renderer/assets/app.js', 'assets/app.js'],
    ]) {
      net.fetch.mockClear()
      const response = await handle({ url })
      expect(await response.text()).toBe('fake file response')
      expect(response.status).toBe(200)
      expect(response.headers.get('x-fixture')).toBe('unchanged')
      expect(net.fetch).toHaveBeenCalledExactlyOnceWith(pathToFileURL(await realpath(path.join(root, file))).href)
    }
    for (const [url, status] of [
      ['livefy://renderer/missing.js', 404],
      ['https://renderer/', 403],
      ['livefy://renderer/../outside.js', 403],
      ['livefy://renderer/%2e%2e/outside.js', 403],
      ['livefy://renderer/a%2fb', 403],
      ['livefy://renderer/%', 403],
      ['livefy://renderer/escape.js', 403],
    ]) {
      net.fetch.mockClear()
      expect((await handle({ url })).status).toBe(status)
      expect(net.fetch).not.toHaveBeenCalled()
    }
  })
})

it('delivers the production policy as a response header on the renderer document', async () => {
  await withFixture(async ({ handle }) => {
    const response = await handle({ url: 'livefy://renderer/' })
    expect(response.headers.get(CSP_HEADER)).toBe(productionPolicy)
  })
})

it('delivers the production policy header on the responses it produces itself', async () => {
  await withFixture(async ({ handle }) => {
    for (const [url, status] of [
      ['livefy://renderer/missing.js', 404],
      ['https://renderer/', 403],
      ['livefy://renderer/../outside.js', 403],
      ['livefy://renderer/%', 403],
      ['livefy://renderer/escape.js', 403],
    ]) {
      const response = await handle({ url })
      expect(response.status).toBe(status)
      expect(response.headers.get(CSP_HEADER)).toBe(productionPolicy)
    }
  })
})

it('forbids eval, inline scripts and the dev-only websocket in the delivered header', async () => {
  await withFixture(async ({ handle }) => {
    const header = (await handle({ url: 'livefy://renderer/' })).headers.get(CSP_HEADER)
    expect(header).not.toContain('unsafe-eval')
    expect(header.match(/(?:^|;\s*)script-src ([^;]+)/)[1]).not.toContain('unsafe-inline')
    // Pin the exact script-src sources, matching the hosts csp.test.ts already
    // fixes: a new or widened origin must fail this assertion, not slip through.
    expect(header.match(/(?:^|;\s*)script-src ([^;]+)/)[1].trim().split(/\s+/)).toEqual([
      "'self'",
      'https://organic-snake-7233.clerk.accounts.dev',
      'https://challenges.cloudflare.com',
      'https://*.protect.clerk.com',
    ])
    expect(header).not.toContain('ws://127.0.0.1:5173')
  })
})

it('preserves every directive and origin of the shipped policy in the header', async () => {
  await withFixture(async ({ handle }) => {
    const header = (await handle({ url: 'livefy://renderer/' })).headers.get(CSP_HEADER)
    expect(directives(header)).toEqual([
      'default-src', 'script-src', 'style-src', 'connect-src', 'img-src',
      'worker-src', 'object-src', 'frame-src', 'base-uri', 'form-action',
    ])
    expect(origins(header).filter(origin => origin.includes('*')))
      .toEqual(['https://*.protect.clerk.com', 'https://*.protect.clerk.com:*', 'https://*.protect.clerk.com'])
    expect(header).toContain('https://*.protect.clerk.com:*')
    expect(header).toContain('https://polite-parrot-887.convex.cloud')
    expect(header).toContain('wss://polite-parrot-887.convex.cloud')
    expect(header).toContain('https://organic-snake-7233.clerk.accounts.dev')
    expect(header).toContain('worker-src \'self\' blob:')
    expect(header).toContain('object-src \'none\'')
  })
})

it('takes the delivered policy from the one module the build transform also uses', () => {
  const policy = require('./csp-policy.cjs')
  expect(policy.PRODUCTION_CSP).toBe(productionPolicy)
  expect(policy.META_CSP).toBe(metaPolicy)
  expect(policy.productionCsp(`<meta content="${metaPolicy}" />`)).toBe(`<meta content="${productionPolicy}" />`)
})
