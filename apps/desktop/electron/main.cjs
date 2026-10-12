const { app, BrowserWindow, protocol, net, safeStorage, ipcMain } = require('electron')
const { createClerkBridge } = require('@clerk/electron')
const Store = require('electron-store')
const { createTokenStorage } = require('./clerk-storage.cjs')
const { rendererHandler } = require('./protocol.cjs')
const path = require('node:path')
const { DEV_URL, webPreferences, secureContents } = require('./security.cjs')

const development = !app.isPackaged && process.argv.includes('--livefy-dev')
const indexPath = path.join(__dirname, '../dist/index.html')
const entry = development ? DEV_URL : 'livefy://renderer/'
// Clerk owns scheme registration and OAuth IPC before Electron becomes ready.
// safeStorage must only be inspected after readiness, before opening any window.
let storage
const deferredStorage = Object.fromEntries(['getItem', 'setItem', 'removeItem'].map(operation => [
  operation, async (...args) => {
    if (!storage) throw new Error('Token storage is not ready')
    return storage[operation](...args)
  },
]))
const bridge = createClerkBridge({
  storage: deferredStorage,
  renderer: { scheme: 'livefy', host: 'renderer' },
})
// The SDK registers only the executable. Default Electron also needs our app
// directory; override after the bridge so its registration cannot replace this.
if (bridge.isPrimaryInstance && process.defaultApp) {
  const args = [path.resolve(__dirname, '..')]
  if (development) args.push('--livefy-dev')
  if (!app.setAsDefaultProtocolClient('livefy', process.execPath, args)) {
    console.error('Unable to register the Livefy OAuth callback protocol.')
  }
}
let logoutPending
let logoutComplete = false
const trustedContents = new Set()

function createWindow() {
  const window = new BrowserWindow({
    width: 1000,
    height: 720,
    title: 'Livefy',
    webPreferences: { ...webPreferences, preload: path.join(__dirname, '../dist/preload.cjs') },
  })
  trustedContents.add(window.webContents)
  window.webContents.on('destroyed', () => trustedContents.delete(window.webContents))
  secureContents(window.webContents, entry)
  const loaded = window.loadURL(entry)
  loaded.catch(() => {
    console.error('Unable to load the local Livefy renderer. Build it or start the development server.')
    app.quit()
  })
}

if (bridge.isPrimaryInstance) app.whenReady().then(() => {
  protocol.handle('livefy', rendererHandler(path.dirname(indexPath), net))
  storage = createTokenStorage({ store: new Store({ name: 'clerk-tokens', accessPropertiesByDotNotation: false }), safeStorage })
  ipcMain.handle('livefy:session-persistence', event => {
    if (event.senderFrame !== event.sender.mainFrame) throw new Error('Denied')
    return storage.persistence
  })
  function terminal(operation, event, args) {
    const frame = event.senderFrame
    if (args.length || !trustedContents.has(event.sender) || !frame ||
        frame !== event.sender.mainFrame || frame.url?.split('#')[0] !== entry) throw new Error('Denied')
    if (logoutPending) return logoutPending
    if (logoutComplete) return Promise.resolve()
    logoutPending = storage[operation]().then(() => {
      logoutPending = undefined
      logoutComplete = true
      // Local durability is verified by storage; this is not remote revocation proof.
      app.quit()
    }, () => {
      logoutPending = undefined
      throw new Error('Local logout incomplete')
    })
    return logoutPending
  }
  ipcMain.handle('livefy:session-logout', (event, ...args) => terminal('logout', event, args))
  ipcMain.handle('livefy:session-preserve-and-quit', (event, ...args) => terminal('preserve', event, args))
  createWindow()
  app.on('activate', () => {
    if (!logoutPending && !logoutComplete && BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})
// Ordinary quit (including window-all-closed/load failure) must not interrupt deletion.
// Windows shutdown can bypass this event; do not claim forced-shutdown protection.
app.on('before-quit', event => {
  if (logoutPending) event.preventDefault()
})
app.on('will-quit', () => {
  bridge?.cleanup()
  ipcMain.removeHandler('livefy:session-persistence')
  ipcMain.removeHandler('livefy:session-logout')
  ipcMain.removeHandler('livefy:session-preserve-and-quit')
  protocol.unhandle('livefy')
})
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
