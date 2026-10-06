import { expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import vm from 'node:vm'

const require = createRequire(import.meta.url)
const filename = require.resolve('./main.cjs')

function bootstrap({ development = false, platform = 'win32' } = {}) {
  const steps = []
  const events = {}
  const handlers = new Map()
  const windows = []
  let ready
  const storage = { persistence: 'encrypted' }
  const cleanup = vi.fn()
  const bridge = vi.fn(() => { steps.push('bridge'); return { cleanup } })
  const app = {
    isPackaged: !development,
    whenReady: () => new Promise(resolve => { ready = resolve }),
    on: (name, callback) => { events[name] = callback },
    quit: vi.fn(),
  }
  const protocol = {
    registerSchemesAsPrivileged: vi.fn(() => steps.push('privileges')),
    handle: vi.fn(() => steps.push('protocol')),
    unhandle: vi.fn(),
  }
  const ipcMain = {
    handle: vi.fn((name, callback) => handlers.set(name, callback)),
    removeHandler: vi.fn(name => handlers.delete(name)),
  }
  class BrowserWindow {
    static getAllWindows() { return windows }
    constructor(options) {
      steps.push('window')
      this.options = options
      this.listeners = {}
      this.webContents = {
        session: {
          setPermissionRequestHandler: callback => { this.permissionRequest = callback },
          setPermissionCheckHandler: callback => { this.permissionCheck = callback },
        },
        setWindowOpenHandler: callback => { this.open = callback },
        on: (name, callback) => { this.listeners[name] = callback },
      }
      this.loadURL = vi.fn(() => Promise.resolve())
      windows.push(this)
    }
  }
  const storeOptions = vi.fn()
  class Store { constructor(options) { storeOptions(options); steps.push('store') } }
  const safeStorage = {}
  const createTokenStorage = vi.fn(() => { steps.push('storage'); return storage })
  const net = { fetch: vi.fn() }
  const boundaries = {
    electron: { app, BrowserWindow, protocol, ipcMain, safeStorage, net },
    '@clerk/electron': { createClerkBridge: bridge },
    'electron-store': Store,
    './clerk-storage.cjs': { createTokenStorage },
  }
  // Execute current bootstrap bytes; real local protocol/security modules remain linked.
  vm.runInNewContext(readFileSync(filename, 'utf8'), {
    require: name => Object.hasOwn(boundaries, name) ? boundaries[name] : require(name),
    __dirname: path.dirname(filename),
    process: { argv: development ? ['electron', '--livefy-dev'] : ['electron'], platform },
    console,
  }, { filename })
  return { steps, events, handlers, windows, storage, cleanup, bridge, app, protocol,
    ipcMain, storeOptions, createTokenStorage, safeStorage, net,
    ready: async () => { ready(); await Promise.resolve() }, }
}

it.each([false, true])('boots after readiness with guarded window (development=%s)', async development => {
  const harness = bootstrap({ development })
  expect(harness.steps).toEqual(['privileges'])
  expect(harness.protocol.registerSchemesAsPrivileged).toHaveBeenCalledWith([
    { scheme: 'livefy', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } },
  ])
  await harness.ready()
  expect(harness.steps).toEqual(['privileges', 'protocol', 'store', 'storage', 'bridge', 'window'])
  expect(harness.protocol.handle).toHaveBeenCalledWith('livefy', expect.any(Function))
  expect(harness.storeOptions).toHaveBeenCalledWith({ name: 'clerk-tokens', accessPropertiesByDotNotation: false })
  expect(harness.createTokenStorage).toHaveBeenCalledWith({ store: expect.any(Object), safeStorage: harness.safeStorage })
  expect(harness.bridge).toHaveBeenCalledExactlyOnceWith({ storage: harness.storage })
  const window = harness.windows[0]
  expect(window.options.webPreferences).toEqual({
    sandbox: true, contextIsolation: true, nodeIntegration: false, webviewTag: false,
    preload: path.resolve(path.dirname(filename), '../dist/preload.cjs'),
  })
  const entry = development ? 'http://127.0.0.1:5173/' : 'livefy://renderer/'
  expect(window.loadURL).toHaveBeenCalledExactlyOnceWith(entry)
  for (const name of ['will-navigate', 'will-redirect']) {
    const event = { preventDefault: vi.fn() }
    window.listeners[name](event, `${entry}#access`)
    expect(event.preventDefault).not.toHaveBeenCalled()
    window.listeners[name](event, 'https://untrusted.invalid/')
    expect(event.preventDefault).toHaveBeenCalledOnce()
  }
  expect(window.open()).toEqual({ action: 'deny' })
  expect(window.permissionCheck()).toBe(false)
  const permission = vi.fn()
  window.permissionRequest(null, 'camera', permission)
  expect(permission).toHaveBeenCalledWith(false)
  const webview = { preventDefault: vi.fn() }
  window.listeners['will-attach-webview'](webview)
  expect(webview.preventDefault).toHaveBeenCalledOnce()
  const persistence = harness.handlers.get('livefy:session-persistence')
  const mainFrame = {}
  expect(persistence({ senderFrame: mainFrame, sender: { mainFrame } })).toBe('encrypted')
  expect(() => persistence({ senderFrame: {}, sender: { mainFrame } })).toThrow('Denied')
  harness.events.activate()
  expect(harness.windows).toHaveLength(1)
  harness.windows.length = 0
  harness.events.activate()
  expect(harness.windows).toHaveLength(1)
  harness.events['will-quit']()
  expect(harness.cleanup).toHaveBeenCalledOnce()
  expect(harness.ipcMain.removeHandler).toHaveBeenCalledWith('livefy:session-persistence')
  expect(harness.handlers.size).toBe(0)
  expect(harness.protocol.unhandle).toHaveBeenCalledWith('livefy')
})

it.each(['win32', 'darwin'])('handles early quit and window lifecycle on %s', platform => {
  const harness = bootstrap({ platform })
  expect(() => harness.events['will-quit']()).not.toThrow()
  expect(harness.cleanup).not.toHaveBeenCalled()
  harness.events['window-all-closed']()
  expect(harness.app.quit).toHaveBeenCalledTimes(platform === 'darwin' ? 0 : 1)
})
