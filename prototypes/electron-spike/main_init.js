const { app, BrowserWindow } = require("electron");

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      // Opcional: A veces es útil configurar un User-Agent real si TikTok detecta Electron
    },
  });

  // Carga la página principal de TikTok o un live directo de prueba
  // Ejemplo: mainWindow.loadURL('https://www.tiktok.com/@tu_usuario/live')
  mainWindow.loadURL("https://www.tiktok.com");
}

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.stop();
  }
});
