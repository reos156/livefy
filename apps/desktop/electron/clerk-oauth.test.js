import { expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { EventEmitter } from 'node:events'
import path from 'node:path'
import vm from 'node:vm'

const require = createRequire(import.meta.url)
const mainFile = require.resolve('./main.cjs')
const sdkFile = require.resolve('@clerk/electron')

function bootstrap({ development = false, primary = true, defaultApp = false,
  packaged = !development, registration = true, directory = path.dirname(mainFile) } = {}) {
  const steps = []
  const handlers = new Map()
  const windows = []
  const app = new EventEmitter()
  let ready
  let isReady = false
  Object.assign(app, {
    isPackaged: packaged,
    whenReady: () => new Promise(resolve => { ready = resolve }),
    hasSingleInstanceLock: () => false,
    requestSingleInstanceLock: vi.fn(() => primary),
    releaseSingleInstanceLock: vi.fn(),
    setAsDefaultProtocolClient: vi.fn(() => registration),
    quit: vi.fn(),
  })
  const protocol = {
    registerSchemesAsPrivileged: vi.fn(() => {
      expect(isReady).toBe(false)
      steps.push('scheme')
    }),
    handle: vi.fn(), unhandle: vi.fn(),
  }
  const ipcMain = {
    handle: (name, handler) => { handlers.set(name, handler); steps.push(name) },
    removeHandler: name => handlers.delete(name),
  }
  class BrowserWindow {
    maximize() {}
    // See clerk-main.test.js: the bootstrap registers a `closed` handler on every window.
    on(name, callback) { (this.listeners ??= {})[name] = callback }
    static getAllWindows() { return windows }
    static fromWebContents(sender) { return windows.find(window => window.webContents === sender) }
    constructor() {
      steps.push('window')
      this.webContents = new EventEmitter()
      Object.assign(this.webContents, {
        getType: () => 'window', mainFrame: {},
        session: { setPermissionRequestHandler() {}, setPermissionCheckHandler() {} },
        setWindowOpenHandler() {},
      })
      this.focus = vi.fn()
      this.restore = vi.fn()
      this.isDestroyed = () => false
      this.isMinimized = () => true
      this.loadURL = vi.fn(async () => {})
      windows.push(this)
    }
  }
  const shell = { openExternal: vi.fn(async () => {}) }
  const safeStorage = {
    isEncryptionAvailable: vi.fn(() => { expect(isReady).toBe(true); steps.push('encryption'); return false }),
  }
  class Store { get() {} }
  const electron = { app, protocol, ipcMain, BrowserWindow, shell, safeStorage, net: {} }
  // Execute the installed CJS SDK, replacing Electron only; sibling SDK modules are real.
  const sdk = { exports: {} }
  const sdkRequire = createRequire(sdkFile)
  vm.runInNewContext(readFileSync(sdkFile, 'utf8'), {
    exports: sdk.exports, module: sdk,
    require: name => name === 'electron' ? electron : sdkRequire(name),
    process: { platform: 'win32' }, URL, setTimeout, clearTimeout, console,
  }, { filename: sdkFile })
  const diagnostic = vi.fn()
  const execPath = 'C:\\Program Files\\Electron\\electron.exe'
  // A callback-contaminated argv[1] must never become the application entry.
  // All callback values in this harness are synthetic, not captured credentials.
  const argv = [execPath, 'livefy://renderer/?code=synthetic-test-value', ...(development ? ['--livefy-dev'] : [])]
  const boundaries = { electron, '@clerk/electron': sdk.exports, 'electron-store': Store }
  vm.runInNewContext(readFileSync(mainFile, 'utf8'), {
    require: name => Object.hasOwn(boundaries, name) ? boundaries[name] : require(name),
    __dirname: directory,
    process: { argv, execPath, defaultApp, platform: 'win32' },
    console: { error: diagnostic },
  }, { filename: mainFile })
  return { app, protocol, handlers, windows, shell, safeStorage, steps, diagnostic, execPath,
    ready: async () => { isReady = true; ready?.(); await Promise.resolve() },
  }
}

it.each([
  { development: true, packaged: false, flags: ['--livefy-dev'] },
  { development: false, packaged: false, flags: [] },
  { development: true, packaged: true, flags: [] },
])('overrides installed SDK registration after bootstrap for default Electron: %j', options => {
  const directory = path.resolve('fixture with spaces', 'desktop', 'electron')
  const h = bootstrap({ ...options, defaultApp: true, directory })
  expect(h.app.setAsDefaultProtocolClient.mock.calls).toEqual([
    ['livefy'],
    ['livefy', h.execPath, [path.resolve(directory, '..'), ...options.flags]],
  ])
  expect(h.windows).toHaveLength(0)
  expect(h.safeStorage.isEncryptionAvailable).not.toHaveBeenCalled()
  expect(h.diagnostic).not.toHaveBeenCalled()
})

it.each([false, true])('keeps non-default registration owned by the SDK (packaged=%s)', packaged => {
  const h = bootstrap({ packaged, development: !packaged, defaultApp: false })
  expect(h.app.setAsDefaultProtocolClient.mock.calls).toEqual([['livefy']])
})

it('reports registration failure without callback, executable or argument data', () => {
  const h = bootstrap({ defaultApp: true, registration: false })
  expect(h.app.setAsDefaultProtocolClient).toHaveBeenCalledTimes(2)
  expect(h.diagnostic).toHaveBeenCalledExactlyOnceWith('Unable to register the Livefy OAuth callback protocol.')
})

it('does not override protocol registration in a default Electron secondary instance', () => {
  const h = bootstrap({ defaultApp: true, primary: false })
  expect(h.app.setAsDefaultProtocolClient).not.toHaveBeenCalled()
  expect(h.diagnostic).not.toHaveBeenCalled()
})

const redirectChannel = 'clerk:oauth-transport:get-redirect-url'
const openChannel = 'clerk:oauth-transport:open'

it.each([false, true])('installed SDK transports OAuth before windows (development=%s)', async development => {
  const h = bootstrap({ development })
  expect(h.handlers.has(redirectChannel)).toBe(true)
  expect(h.handlers.has(openChannel)).toBe(true)
  expect(h.windows).toHaveLength(0)
  expect(h.safeStorage.isEncryptionAvailable).not.toHaveBeenCalled()
  expect(h.protocol.registerSchemesAsPrivileged).toHaveBeenCalledOnce()
  expect(h.app.setAsDefaultProtocolClient).toHaveBeenCalledWith('livefy')
  await h.ready()
  expect(h.steps.indexOf(openChannel)).toBeLessThan(h.steps.indexOf('window'))
  expect(h.steps.indexOf('encryption')).toBeLessThan(h.steps.indexOf('window'))
  const window = h.windows[0]
  expect(window.loadURL).toHaveBeenCalledWith(development ? 'http://127.0.0.1:5173/' : 'livefy://renderer/')
  const event = { sender: window.webContents, senderFrame: window.webContents.mainFrame }
  expect(h.handlers.get(redirectChannel)(event)).toBe('livefy://renderer/')
  const subframe = { ...event, senderFrame: {} }
  expect(() => h.handlers.get(redirectChannel)(subframe)).toThrow('main frame')
  await expect(h.handlers.get(openChannel)(subframe, 'https://example.invalid/oauth')).rejects.toThrow('main frame')
  await expect(h.handlers.get(openChannel)(event, 'file:///untrusted')).rejects.toThrow('unsupported')
  expect(h.shell.openExternal).not.toHaveBeenCalled()
  const pending = h.handlers.get(openChannel)(event, 'https://example.invalid/oauth')
  expect(h.shell.openExternal).toHaveBeenCalledExactlyOnceWith('https://example.invalid/oauth')
  await expect(h.handlers.get(openChannel)(event, 'https://example.invalid/other')).rejects.toThrow('already pending')
  h.app.emit('second-instance', {}, ['electron', 'livefy://wrong/?code=ignored'])
  expect(window.focus).not.toHaveBeenCalled()
  const callbackUrl = 'livefy://renderer/?code=simulated'
  h.app.emit('second-instance', {}, ['electron', callbackUrl])
  await expect(pending).resolves.toEqual({ callbackUrl })
  expect(window.restore).toHaveBeenCalledOnce()
  expect(window.focus).toHaveBeenCalledOnce()
  const cancelled = h.handlers.get(openChannel)(event, 'https://example.invalid/oauth')
  const cancellation = expect(cancelled).rejects.toThrow('cancelled')
  h.app.emit('will-quit')
  await cancellation
  expect(h.handlers.size).toBe(0)
  expect(h.app.listenerCount('second-instance')).toBe(0)
  expect(h.app.listenerCount('open-url')).toBe(0)
  expect(h.app.releaseSingleInstanceLock).toHaveBeenCalledOnce()
  expect(h.protocol.unhandle).toHaveBeenCalledWith('livefy')
})

it('installed SDK quits secondary instances without initializing storage or windows', async () => {
  const h = bootstrap({ primary: false })
  await h.ready()
  expect(h.app.quit).toHaveBeenCalledOnce()
  expect(h.windows).toHaveLength(0)
  expect(h.handlers.size).toBe(0)
  expect(h.safeStorage.isEncryptionAvailable).not.toHaveBeenCalled()
  expect(h.protocol.handle).not.toHaveBeenCalled()
  h.app.emit('will-quit')
  expect(h.app.releaseSingleInstanceLock).not.toHaveBeenCalled()
})
