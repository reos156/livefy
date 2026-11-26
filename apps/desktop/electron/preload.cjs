const { exposeClerkBridge } = require('@clerk/electron/preload')
const { contextBridge, ipcRenderer } = require('electron')
exposeClerkBridge()
contextBridge.exposeInMainWorld('livefySession', {
  persistence: () => ipcRenderer.invoke('livefy:session-persistence'),
  logout: () => ipcRenderer.invoke('livefy:session-logout'),
  preserveAndQuit: () => ipcRenderer.invoke('livefy:session-preserve-and-quit'),
})
// The live surface lives in main; this bridge only carries a rectangle, a channel handle
// and a read-only status. No channel here names a URL, so the renderer cannot choose what
// loads: main validates the handle and builds the address.
contextBridge.exposeInMainWorld('livefyLive', {
  mount: channel => ipcRenderer.invoke('livefy:live-surface-mount', channel),
  setBounds: bounds => ipcRenderer.invoke('livefy:live-surface-bounds', bounds),
  unmount: () => ipcRenderer.invoke('livefy:live-surface-unmount'),
  status: () => ipcRenderer.invoke('livefy:live-surface-status'),
  onStatus: listener => {
    const forward = (_event, status) => listener(status)
    ipcRenderer.on('livefy:live-surface-status', forward)
    return () => ipcRenderer.off('livefy:live-surface-status', forward)
  },
})
