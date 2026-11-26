// The TikTok surface the operator watches. It is created here, in the main process, and
// never by the renderer: the product UI decides where the rectangle goes, not what loads
// inside it. Third-party content stays a sibling of the renderer instead of a child of it,
// which is what keeps `sandbox`, `contextIsolation` and the app's CSP untouched.
const LIVE_PARTITION = 'persist:tiktok'
const LIVE_HOME = 'https://www.tiktok.com/'
// No preload: a bridge into third-party content is a privileged channel the app does not
// need. `webviewTag` stays false for the same reason it is false everywhere else.
const liveWebPreferences = Object.freeze({
  partition: LIVE_PARTITION,
  sandbox: true,
  contextIsolation: true,
  nodeIntegration: false,
  webviewTag: false,
})

// Only TikTok over TLS. `endsWith('.tiktok.com')` cannot match `eviltiktok.com`, and the
// URL parser rejects a smuggled port or scheme before the host check runs.
function isAllowedLiveUrl(raw) {
  try {
    const url = new URL(raw)
    return url.protocol === 'https:' && url.port === '' &&
      (url.hostname === 'tiktok.com' || url.hostname.endsWith('.tiktok.com'))
  } catch {
    return false
  }
}

// `persist:` partitions share one session for the app's lifetime, so the session-level
// download denial is installed once. Permission and popup handlers are single setters and
// replace themselves.
const hardenedSessions = new WeakSet()

function hardenLiveContents(contents) {
  const { session } = contents
  session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false))
  session.setPermissionCheckHandler(() => false)
  if (!hardenedSessions.has(session)) {
    hardenedSessions.add(session)
    session.on('will-download', event => event.preventDefault())
  }
  contents.setWindowOpenHandler(() => ({ action: 'deny' }))
  for (const name of ['will-navigate', 'will-redirect']) {
    contents.on(name, (event, url) => {
      if (!isAllowedLiveUrl(url)) event.preventDefault()
    })
  }
  // `will-navigate` is main-frame only, so an embedded document could still navigate
  // itself off TikTok. This handler receives a single details object, not `(event, url)`.
  contents.on('will-frame-navigate', details => {
    if (!isAllowedLiveUrl(details.url)) details.preventDefault()
  })
  contents.on('will-attach-webview', event => event.preventDefault())
}

function whole(value) {
  return typeof value === 'number' && Number.isInteger(value)
}

function length(value) {
  return whole(value) && value > 0
}

// Bounds arrive from the renderer, so they are numbers the main process must not trust:
// halves a compositor could reject, coordinates of another type, or strings from a broken
// sender. Anything that is not four whole numbers with a visible area is refused instead
// of clamped, because a silently moved surface hides the bug. A negative origin is kept:
// an anchor scrolled past the top or left edge reports one, and the parent clips the view.
function parseBounds(value) {
  if (!value || typeof value !== 'object') return null
  const { x, y, width, height } = value
  if (!whole(x) || !whole(y)) return null
  if (!length(width) || !length(height)) return null
  return { x, y, width, height }
}

// `getBoundingClientRect` speaks CSS pixels and `setBounds` speaks DIPs, so the renderer's
// rectangle has to be scaled by the window zoom before it is applied. A missing or
// unusable factor means the default zoom; a shape that is not four numbers is refused
// rather than rounded into something plausible (rounding would coerce `'300'` to 300).
function toViewBounds(bounds, zoomFactor) {
  if (!bounds || typeof bounds !== 'object') return null
  const { x, y, width, height } = bounds
  if (![x, y, width, height].every(value => typeof value === 'number' && Number.isFinite(value))) return null
  const factor = typeof zoomFactor === 'number' && Number.isFinite(zoomFactor) && zoomFactor > 0 ? zoomFactor : 1
  return {
    x: Math.round(x * factor),
    y: Math.round(y * factor),
    width: Math.round(width * factor),
    height: Math.round(height * factor),
  }
}

function createLiveSurface(WebContentsView) {
  let view = null
  let bounds = null
  let state = { mounted: false, state: 'idle' }
  const listeners = new Set()

  function publish(next) {
    state = next
    for (const listener of listeners) listener(state)
  }

  function attachListeners(guest) {
    guest.on('did-start-loading', () => publish({ mounted: true, state: 'loading' }))
    guest.on('did-finish-load', () => publish({ mounted: true, state: 'ready' }))
    guest.on('did-fail-load', (_event, _code, description, _url, isMainFrame) => {
      // Subresource failures are normal on a live stream; only the document counts.
      if (isMainFrame === false) return
      publish({ mounted: true, state: 'failed', reason: description || 'unknown' })
    })
  }

  return {
    view: () => view,

    mount(window) {
      if (view) return view
      view = new WebContentsView({ webPreferences: { ...liveWebPreferences } })
      hardenLiveContents(view.webContents)
      attachListeners(view.webContents)
      window.contentView.addChildView(view)
      // Position before loading, so the first paint never lands at the window origin.
      if (bounds) view.setBounds(bounds)
      publish({ mounted: true, state: 'loading' })
      view.webContents.loadURL(LIVE_HOME).catch(() => {
        publish({ mounted: true, state: 'failed', reason: 'load-rejected' })
      })
      return view
    },

    setBounds(next) {
      const parsed = parseBounds(next)
      if (!parsed) return false
      bounds = parsed
      if (view) view.setBounds(parsed)
      return true
    },

    unmount(window) {
      if (!view) return
      const closing = view
      view = null
      // A closed window has already destroyed its content view; detaching then throws, and
      // that is not a failure of the surface.
      try { window.contentView.removeChildView(closing) } catch { /* window already gone */ }
      try { closing.webContents.close() } catch { /* guest already destroyed */ }
      publish({ mounted: false, state: 'idle' })
    },

    status: () => ({ ...state }),

    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}

module.exports = {
  LIVE_PARTITION,
  LIVE_HOME,
  liveWebPreferences,
  isAllowedLiveUrl,
  hardenLiveContents,
  parseBounds,
  toViewBounds,
  createLiveSurface,
}
