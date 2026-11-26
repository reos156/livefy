const { app, BrowserWindow, WebContentsView, protocol, net, safeStorage, ipcMain } = require('electron')
const { createClerkBridge } = require('@clerk/electron')
const Store = require('electron-store')
const { createTokenStorage } = require('./clerk-storage.cjs')
const { rendererHandler } = require('./protocol.cjs')
const path = require('node:path')
const { DEV_URL, webPreferences, secureContents } = require('./security.cjs')
const { createLiveSurface, toViewBounds } = require('./live-surface.cjs')

const development = !app.isPackaged && process.argv.includes('--livefy-dev')
// This file is bundled to dist/main.cjs (electron/build-main.mjs); the unbundled
// source at electron/main.cjs stays the entry the tests execute. Both live
// exactly one directory below the build output, so `../dist` is the renderer and
// preload directory in either location, and its parent is the app directory.
const distDir = path.resolve(__dirname, '../dist')
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
// `__dirname` is this file's directory (electron/ in source, dist/ bundled), so
// its parent is the application directory in both layouts.
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
// One surface per process: the live and its partition outlive a window recreation, and a
// second surface would mean a second guest loading third-party content.
const liveSurface = createLiveSurface(WebContentsView)
liveSurface.subscribe(status => {
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) window.webContents.send('livefy:live-surface-status', status)
  }
})

// The single sender rule every privileged channel shares: the trusted renderer, its main
// frame, on the entry document. Anything else is refused before it reaches a handler.
function requireRenderer(event) {
  const frame = event.senderFrame
  if (!trustedContents.has(event.sender) || !frame ||
      frame !== event.sender.mainFrame || frame.url?.split('#')[0] !== entry) throw new Error('Denied')
}

function createWindow() {
  // A 15" laptop at its usual scaling gives the panel roughly 1536x864 CSS pixels, and the
  // three-column workspace needs the width. The window opens maximized, and these bounds
  // are the fallback for a compositor that refuses to maximize.
  const window = new BrowserWindow({
    width: 1536,
    height: 864,
    minWidth: 1180,
    minHeight: 700,
    title: 'Livefy',
    webPreferences: { ...webPreferences, preload: path.join(distDir, 'preload.cjs') },
  })
  window.maximize()
  trustedContents.add(window.webContents)
  window.webContents.on('destroyed', () => trustedContents.delete(window.webContents))
  secureContents(window.webContents, entry)
  // Closing the window takes the guest with it; a recreated window mounts a fresh one.
  window.on('closed', () => liveSurface.unmount(window))
  const loaded = window.loadURL(entry)
  loaded.catch(() => {
    console.error('Unable to load the local Livefy renderer. Build it or start the development server.')
    app.quit()
  })
}

if (bridge.isPrimaryInstance) app.whenReady().then(() => {
  protocol.handle('livefy', rendererHandler(distDir, net))
  storage = createTokenStorage({ store: new Store({ name: 'clerk-tokens', accessPropertiesByDotNotation: false }), safeStorage })
  ipcMain.handle('livefy:session-persistence', event => {
    if (event.senderFrame !== event.sender.mainFrame) throw new Error('Denied')
    return storage.persistence
  })
  function terminal(operation, event, args) {
    requireRenderer(event)
    if (args.length) throw new Error('Denied')
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
  // The surface channels carry the rectangle and nothing else: the renderer never names a
  // URL, so it cannot point third-party content anywhere the policy has not allowed.
  ipcMain.handle('livefy:live-surface-mount', (event, ...args) => {
    requireRenderer(event)
    if (args.length) throw new Error('Denied')
    const owner = BrowserWindow.fromWebContents(event.sender)
    if (!owner) throw new Error('Denied')
    liveSurface.mount(owner)
    return liveSurface.status()
  })
  ipcMain.handle('livefy:live-surface-bounds', (event, ...args) => {
    requireRenderer(event)
    if (args.length !== 1) throw new Error('Denied')
    // The renderer measures in CSS pixels; the compositor positions in DIPs. At any zoom
    // other than 1 the rectangle would drift, so the zoom factor is applied here.
    return liveSurface.setBounds(toViewBounds(args[0], event.sender.zoomFactor))
  })
  ipcMain.handle('livefy:live-surface-unmount', (event, ...args) => {
    requireRenderer(event)
    if (args.length) throw new Error('Denied')
    const owner = BrowserWindow.fromWebContents(event.sender)
    if (!owner) throw new Error('Denied')
    liveSurface.unmount(owner)
    return liveSurface.status()
  })
  ipcMain.handle('livefy:live-surface-status', (event, ...args) => {
    requireRenderer(event)
    if (args.length) throw new Error('Denied')
    return liveSurface.status()
  })
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
  ipcMain.removeHandler('livefy:live-surface-mount')
  ipcMain.removeHandler('livefy:live-surface-bounds')
  ipcMain.removeHandler('livefy:live-surface-unmount')
  ipcMain.removeHandler('livefy:live-surface-status')
  protocol.unhandle('livefy')
})
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
