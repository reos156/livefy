const { app, BrowserWindow } = require('electron')
const path = require('node:path')
const { pathToFileURL } = require('node:url')
const { DEV_URL, webPreferences, secureContents } = require('./security.cjs')

const development = !app.isPackaged && process.argv.includes('--livefy-dev')
const indexPath = path.join(__dirname, '../dist/index.html')
const entry = development ? DEV_URL : pathToFileURL(indexPath).href

function createWindow() {
  const window = new BrowserWindow({
    width: 1000,
    height: 720,
    title: 'Livefy',
    webPreferences,
  })
  secureContents(window.webContents, entry)
  const loaded = development ? window.loadURL(entry) : window.loadFile(indexPath)
  loaded.catch(() => {
    console.error('Unable to load the local Livefy renderer. Build it or start the development server.')
    app.quit()
  })
}

app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
