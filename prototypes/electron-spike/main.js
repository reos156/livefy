const { app, BrowserWindow } = require('electron')

function createWindow () {
  const mainWindow = new BrowserWindow({
    width: 1440,
    height: 850,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webviewTag: true // ¡Importante habilitar esto para usar <webview>!
    }
  })

  // Carga la interfaz local en lugar de una URL externa directa
  mainWindow.loadFile('index.html')
}

app.whenReady().then(() => {
  createWindow()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
