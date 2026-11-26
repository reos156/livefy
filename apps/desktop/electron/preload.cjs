const { exposeClerkBridge } = require('@clerk/electron/preload')
const { contextBridge, ipcRenderer } = require('electron')
exposeClerkBridge()
contextBridge.exposeInMainWorld('livefySession', {
  persistence: () => ipcRenderer.invoke('livefy:session-persistence'),
  logout: () => ipcRenderer.invoke('livefy:session-logout'),
  preserveAndQuit: () => ipcRenderer.invoke('livefy:session-preserve-and-quit'),
})
// The live surface lives in main; this bridge only carries a rectangle and a read-only
// status. No channel here names a URL, so the renderer cannot choose what loads.
contextBridge.exposeInMainWorld('livefyLive', {
  mount: () => ipcRenderer.invoke('livefy:live-surface-mount'),
  setBounds: bounds => ipcRenderer.invoke('livefy:live-surface-bounds', bounds),
  unmount: () => ipcRenderer.invoke('livefy:live-surface-unmount'),
  status: () => ipcRenderer.invoke('livefy:live-surface-status'),
  onStatus: listener => {
    const forward = (_event, status) => listener(status)
    ipcRenderer.on('livefy:live-surface-status', forward)
    return () => ipcRenderer.off('livefy:live-surface-status', forward)
  },
})
