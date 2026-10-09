const { exposeClerkBridge } = require('@clerk/electron/preload')
const { contextBridge, ipcRenderer } = require('electron')
exposeClerkBridge()
contextBridge.exposeInMainWorld('livefySession', {
  persistence: () => ipcRenderer.invoke('livefy:session-persistence'),
  logout: () => ipcRenderer.invoke('livefy:session-logout'),
  preserveAndQuit: () => ipcRenderer.invoke('livefy:session-preserve-and-quit'),
})
