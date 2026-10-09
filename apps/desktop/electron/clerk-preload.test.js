// @vitest-environment node
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { expect, it, vi } from 'vitest'

it('exposes only the supported bridge and fixed persistence status call', () => {
  const exposeClerkBridge = vi.fn()
  const exposeInMainWorld = vi.fn()
  const invoke = vi.fn(() => Promise.resolve('encrypted'))
  vm.runInNewContext(readFileSync(new URL('./preload.cjs', import.meta.url), 'utf8'), {
    require: name => name === 'electron' ? {
      contextBridge: { exposeInMainWorld }, ipcRenderer: { invoke },
    } : { exposeClerkBridge },
  })
  expect(exposeClerkBridge).toHaveBeenCalledWith()
  const [name, api] = exposeInMainWorld.mock.calls[0]
  expect(name).toBe('livefySession')
  expect(Object.keys(api)).toEqual(['persistence', 'logout', 'preserveAndQuit'])
  api.logout('untrusted-key')
  expect(invoke).toHaveBeenCalledWith('livefy:session-logout')
  api.preserveAndQuit('untrusted-token', true)
  expect(invoke).toHaveBeenLastCalledWith('livefy:session-preserve-and-quit')
  api.persistence('untrusted-channel')
  expect(invoke).toHaveBeenCalledWith('livefy:session-persistence')
})
it('defines an isolated CJS preload build with only Electron external', () => {
  const source = readFileSync(new URL('./build-preload.mjs', import.meta.url), 'utf8')
  expect(source).toContain("formats: ['cjs']")
  expect(source).toContain("external: ['electron']")
  expect(source).toContain('configFile: false')
})
