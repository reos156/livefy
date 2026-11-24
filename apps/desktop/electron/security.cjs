const DEV_URL = 'http://127.0.0.1:5173/'
const webPreferences = Object.freeze({
  sandbox: true,
  contextIsolation: true,
  nodeIntegration: false,
  webviewTag: false,
})

function canNavigate(url, entry) {
  try {
    const target = new URL(url)
    target.hash = ''
    return target.href === entry
  } catch {
    return false
  }
}

function secureContents(contents, entry) {
  contents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false))
  contents.session.setPermissionCheckHandler(() => false)
  contents.setWindowOpenHandler(() => ({ action: 'deny' }))
  for (const name of ['will-navigate', 'will-redirect']) {
    contents.on(name, (event, url) => {
      if (!canNavigate(url, entry)) event.preventDefault()
    })
  }
  contents.on('will-attach-webview', (event) => event.preventDefault())
}

module.exports = { DEV_URL, webPreferences, canNavigate, secureContents }
