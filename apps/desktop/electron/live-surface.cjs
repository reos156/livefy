// The TikTok surface the operator watches. It is created here, in the main process, and
// never by the renderer: the product UI decides where the rectangle goes, not what loads
// inside it. Third-party content stays a sibling of the renderer instead of a child of it,
// which is what keeps `sandbox`, `contextIsolation` and the app's CSP untouched.
const LIVE_PARTITION = 'persist:tiktok'
// The renderer names a channel, never a URL: the host is fixed here and the handle only
// ever reaches the path, so no channel can move the guest to another origin.
const LIVE_ORIGIN = 'https://www.tiktok.com'
// TikTok handles: letters, digits, dot and underscore, 2–24 characters, and at least one
// letter or digit so `..` or `__` cannot pass as a channel.
const LIVE_HANDLE = /^(?=.*[A-Za-z0-9])[A-Za-z0-9._]{2,24}$/
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

function hardenLiveContents(contents, { onBlockedDocument } = {}) {
  const { session } = contents
  session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false))
  session.setPermissionCheckHandler(() => false)
  if (!hardenedSessions.has(session)) {
    hardenedSessions.add(session)
    session.on('will-download', event => event.preventDefault())
  }
  contents.setWindowOpenHandler(() => ({ action: 'deny' }))
  // A blocked navigation is not only a denied request: the frame stays on the document it
  // had, so a load that was blocked never becomes the document the surface was waiting for.
  // `onBlockedDocument` lets the surface count that as the failure it is. Electron 41 passes
  // one details object (`WebContentsWillNavigateEventParams` /
  // `WebContentsWillRedirectEventParams`: url, isMainFrame, frame) plus `preventDefault` —
  // never the deprecated `(event, url)` pair, which cannot tell a subframe from the document.
  for (const name of ['will-navigate', 'will-redirect']) {
    contents.on(name, details => {
      if (isAllowedLiveUrl(details?.url)) return
      details?.preventDefault()
      // Only the document the operator is watching makes the surface fail: a subframe leaving
      // TikTok is as ordinary as a failed subresource, and an ad must not take the live down.
      if (details?.isMainFrame !== false) onBlockedDocument?.(details.url)
    })
  }
  // `will-navigate` is main-frame only, so an embedded document could still navigate
  // itself off TikTok. Electron 41 passes this event one details object
  // (`WebContentsWillFrameNavigateEventParams`: url, isMainFrame, frame) plus
  // `preventDefault` — never the `(event, url)` pair. A shape without `url` fails closed.
  contents.on('will-frame-navigate', details => {
    if (!isAllowedLiveUrl(details?.url)) details?.preventDefault()
  })
  contents.on('will-attach-webview', event => event.preventDefault())
}

// A handle is the only thing the renderer may name. Anything that is not exactly the
// pattern is null, so the caller has to refuse it instead of loading something plausible.
function parseLiveHandle(value) {
  return typeof value === 'string' && LIVE_HANDLE.test(value) ? value : null
}

// The URL is built after the handle is validated and then checked against the same
// allowlist the navigation guards use. If the two ever disagreed, the allowlist wins.
function liveUrlForHandle(value) {
  const handle = parseLiveHandle(value)
  if (!handle) return null
  const url = `${LIVE_ORIGIN}/@${handle}/live`
  return isAllowedLiveUrl(url) ? url : null
}

// The mount channel's only argument is the handle. Refusing here, with a thrown error, is
// what keeps an invalid channel from being mounted as an empty or unexpected page.
function requireLiveChannel(value) {
  const url = liveUrlForHandle(value)
  if (!url) throw new Error('Invalid live channel')
  return url
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
  // Every mount is a generation of its own, and the record is the token for it. A listener,
  // a failure or a rejected `loadURL` that arrives after its mount was replaced — or closed
  // — holds a record that is no longer `live`, so it can publish nothing. Without that,
  // `unmount` published `idle` and the rejection of the load it had just abandoned published
  // `failed` over it, which disabled "Abrir el live", left a false error in the column and
  // turned "Cerrar visor" into a no-op until the operator found "Reintentar".
  let live = null
  let state = { mounted: false, state: 'idle' }
  const listeners = new Set()

  function publish(next) {
    state = next
    for (const listener of listeners) listener(state)
  }

  function current(token) {
    return token !== null && token === live
  }

  // The only state machine this surface has, and the reason it cannot get stuck on
  // "Cargando": `loading` has exactly two exits, and the phase never moves backwards.
  //
  //   loading --`dom-ready` / `did-finish-load`---------------------> ready
  //   loading --`did-fail-load` / rejected loadURL / blocked document-> failed
  //   ready   --`did-fail-load` of a later document-------------------> failed
  //
  // There is deliberately no transition on `did-start-loading`. It used to reset the failure
  // flag, so a failure followed by a start event (which Chromium's own error document fires)
  // left the caption on "Cargando" for ever; and it used to publish `loading` again, putting
  // the caption back over a live document. A retry is a new mount, so a finished generation
  // never has to reopen.
  //
  // A failure is final for its generation and keeps its first reason, which is why the
  // error page Chromium paints after `did-fail-load` cannot turn it back into `ready`.
  function ready(token) {
    if (!current(token) || token.phase !== 'loading') return
    token.phase = 'ready'
    publish({ mounted: true, state: 'ready' })
  }

  function fail(token, reason) {
    if (!current(token) || token.phase === 'failed') return
    token.phase = 'failed'
    publish({ mounted: true, state: 'failed', reason })
  }

  function attachListeners(guest, token) {
    // `dom-ready` is the end of the load the operator waits for. `did-finish-load` can
    // arrive after the page is already usable, so waiting for it left the caption stuck on
    // "Cargando" over a live document. Both mean the same state.
    guest.on('dom-ready', () => ready(token))
    guest.on('did-finish-load', () => ready(token))
    guest.on('did-fail-load', (_event, _code, description, _url, isMainFrame) => {
      // Subresource failures are normal on a live stream; only the document counts.
      if (isMainFrame === false) return
      fail(token, description || 'unknown')
    })
  }

  return {
    view: () => view,

    mount(window, url) {
      // The allowlist runs before the reuse: with the early return first, a second mount with
      // a refused URL was a silent no-op and the gate looked decorative. Refusing instead
      // costs nothing and tells the caller its URL was never accepted.
      if (!isAllowedLiveUrl(url)) throw new Error('Refused live URL')
      if (view) return view
      const token = { phase: 'loading' }
      live = token
      view = new WebContentsView({ webPreferences: { ...liveWebPreferences } })
      hardenLiveContents(view.webContents, {
        // A document navigation the allowlist blocked while the surface is still loading
        // leaves the frame on whatever it had, so nothing will ever become usable: that is a
        // failure, not a caption to wait on. Once the live is up, a blocked link is just a
        // blocked link and the live stays on screen.
        onBlockedDocument: () => {
          if (token.phase === 'loading') fail(token, 'navegación bloqueada')
        },
      })
      attachListeners(view.webContents, token)
      window.contentView.addChildView(view)
      // Position before loading, so the first paint never lands at the window origin.
      if (bounds) view.setBounds(bounds)
      publish({ mounted: true, state: 'loading' })
      // The rejection belongs to this generation: if the operator closed the surface first,
      // `fail` finds a retired token and publishes nothing over the `idle` it already sent.
      view.webContents.loadURL(url).catch(() => fail(token, 'load-rejected'))
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
      // Retiring the generation is what makes the abandoned load, its guest and its failure
      // stale from here on.
      live = null
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
  LIVE_ORIGIN,
  liveWebPreferences,
  parseLiveHandle,
  liveUrlForHandle,
  requireLiveChannel,
  isAllowedLiveUrl,
  hardenLiveContents,
  parseBounds,
  toViewBounds,
  createLiveSurface,
}
