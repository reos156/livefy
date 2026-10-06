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
protocol.registerSchemesAsPrivileged([{ scheme: 'livefy', privileges: {
  standard: true, secure: true, supportFetchAPI: true, corsEnabled: true,
} }])
let bridge

function createWindow() {
  const window = new BrowserWindow({
    width: 1000,
    height: 720,
    title: 'Livefy',
    webPreferences: { ...webPreferences, preload: path.join(__dirname, '../dist/preload.cjs') },
  })
  secureContents(window.webContents, entry)
  const loaded = window.loadURL(entry)
  loaded.catch(() => {
    console.error('Unable to load the local Livefy renderer. Build it or start the development server.')
    app.quit()
  })
}

app.whenReady().then(() => {
  protocol.handle('livefy', rendererHandler(path.dirname(indexPath), net))
  const storage = createTokenStorage({ store: new Store({ name: 'clerk-tokens', accessPropertiesByDotNotation: false }), safeStorage })
  bridge = createClerkBridge({ storage })
  ipcMain.handle('livefy:session-persistence', event => {
    if (event.senderFrame !== event.sender.mainFrame) throw new Error('Denied')
    return storage.persistence
  })
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})
app.on('will-quit', () => {
  bridge?.cleanup()
  ipcMain.removeHandler('livefy:session-persistence')
  protocol.unhandle('livefy')
})
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
