import { expect, it, vi } from 'vitest'
import { mkdtemp, mkdir, writeFile, symlink, rm, realpath } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { rendererPath, rendererHandler } = require('./protocol.cjs')

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
    const response = new Response('fake file response', { headers: { 'x-fixture': 'unchanged' } })
    const net = { fetch: vi.fn(async () => response) }
    const handle = rendererHandler(root, net)
    for (const [url, file] of [
      ['livefy://renderer/', 'index.html'],
      ['livefy://renderer/assets/app.js', 'assets/app.js'],
    ]) {
      net.fetch.mockClear()
      expect(await handle({ url })).toBe(response)
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
  } finally {
    await rm(owned, { recursive: true, force: true })
  }
})
