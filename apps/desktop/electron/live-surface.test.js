// @vitest-environment node
import { EventEmitter } from 'node:events'
import { describe, expect, it, vi } from 'vitest'
import live from './live-surface.cjs'

// The surface loads third-party content, so every assertion here is about a boundary:
// what it may load, what it may ask for, and who decides where it sits.

// Electron hands out real emitters, so the stubs are emitters too: `emit` runs exactly the
// listeners the production code registered, and `listenerCount` can count them.
function sessionStub() {
  const session = new EventEmitter()
  session.setPermissionRequestHandler = vi.fn()
  session.setPermissionCheckHandler = vi.fn()
  return session
}

function contentsStub(session = sessionStub()) {
  const contents = new EventEmitter()
  contents.session = session
  contents.setWindowOpenHandler = vi.fn()
  return contents
}

class Guest extends EventEmitter {
  constructor() {
    super()
    this.session = sessionStub()
    this.setWindowOpenHandler = vi.fn()
    this.loadURL = vi.fn(() => Promise.resolve())
    this.close = vi.fn()
  }
}

function viewClass(views) {
  return class FakeView {
    constructor(options) {
      this.options = options
      this.webContents = new Guest()
      this.bounds = null
      views.push(this)
    }
    setBounds(next) { this.bounds = next }
  }
}

describe('live surface boundary', () => {
  it('isolates the guest in its own persistent partition without Node or preload', () => {
    expect(live.liveWebPreferences).toEqual({
      partition: 'persist:tiktok',
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: false,
    })
    expect(Object.isFrozen(live.liveWebPreferences)).toBe(true)
    // A preload would hand a privileged bridge to third-party content.
    expect(live.liveWebPreferences).not.toHaveProperty('preload')
  })

  it('allows only https TikTok hosts', () => {
    for (const url of ['https://www.tiktok.com/', 'https://tiktok.com/live', 'https://m.tiktok.com/@someone/live']) {
      expect(live.isAllowedLiveUrl(url)).toBe(true)
    }
    for (const url of [
      'https://eviltiktok.com/',
      'https://tiktok.com.evil.test/',
      'http://www.tiktok.com/',
      'javascript:alert(1)',
      'https://www.tiktok.com:8443/',
      'not a URL',
    ]) {
      expect(live.isAllowedLiveUrl(url)).toBe(false)
    }
  })

  it('denies permissions, popups, downloads, webviews and off-domain navigation', () => {
    const session = sessionStub()
    const contents = contentsStub(session)
    live.hardenLiveContents(contents)

    const callback = vi.fn()
    session.setPermissionRequestHandler.mock.calls[0][0]({}, 'media', callback)
    expect(callback).toHaveBeenCalledWith(false)
    expect(session.setPermissionCheckHandler.mock.calls[0][0]({}, 'media')).toBe(false)
    expect(contents.setWindowOpenHandler.mock.calls[0][0]({ url: 'https://www.tiktok.com' })).toEqual({ action: 'deny' })

    const blocked = { preventDefault: vi.fn() }
    contents.emit('will-navigate', blocked, 'https://accounts.google.com/')
    expect(blocked.preventDefault).toHaveBeenCalledOnce()

    const allowed = { preventDefault: vi.fn() }
    contents.emit('will-navigate', allowed, 'https://www.tiktok.com/@someone/live')
    expect(allowed.preventDefault).not.toHaveBeenCalled()

    const redirected = { preventDefault: vi.fn() }
    contents.emit('will-redirect', redirected, 'https://evil.test/')
    expect(redirected.preventDefault).toHaveBeenCalledOnce()

    const webview = { preventDefault: vi.fn() }
    contents.emit('will-attach-webview', webview)
    expect(webview.preventDefault).toHaveBeenCalledOnce()

    const download = { preventDefault: vi.fn() }
    session.emit('will-download', download)
    expect(download.preventDefault).toHaveBeenCalledOnce()
  })

  // Electron 41 fires `will-navigate` for the main frame only, so an embedded document
  // could otherwise navigate itself off TikTok inside the guest.
  it('guards subframe navigations too', () => {
    const contents = contentsStub()
    live.hardenLiveContents(contents)

    const blocked = { url: 'https://accounts.google.com/o/oauth2', preventDefault: vi.fn() }
    contents.emit('will-frame-navigate', blocked)
    expect(blocked.preventDefault).toHaveBeenCalledOnce()

    const allowed = { url: 'https://www.tiktok.com/embed/123', preventDefault: vi.fn() }
    contents.emit('will-frame-navigate', allowed)
    expect(allowed.preventDefault).not.toHaveBeenCalled()

    // Electron 41 declares this single details object; a sender that changes shape must
    // not be read as "no URL", which would let an unknown navigation through.
    const shapeless = { preventDefault: vi.fn() }
    contents.emit('will-frame-navigate', shapeless)
    expect(shapeless.preventDefault).toHaveBeenCalledOnce()
  })

  it('hardens the shared partition session only once', () => {
    const session = sessionStub()
    live.hardenLiveContents(contentsStub(session))
    live.hardenLiveContents(contentsStub(session))
    // A second `will-download` listener would be dead weight, not a second denial.
    expect(session.listenerCount('will-download')).toBe(1)
    const download = { preventDefault: vi.fn() }
    session.emit('will-download', download)
    expect(download.preventDefault).toHaveBeenCalledOnce()
  })

  it('accepts whole bounds, including a rectangle clipped above the viewport', () => {
    expect(live.parseBounds({ x: 10, y: 20, width: 300, height: 200 })).toEqual({ x: 10, y: 20, width: 300, height: 200 })
    // An anchor scrolled past the top or left edge reports a negative offset; the view is
    // clipped by its parent, so the negative origin is legitimate and must not be refused.
    expect(live.parseBounds({ x: -5, y: -120, width: 300, height: 200 })).toEqual({ x: -5, y: -120, width: 300, height: 200 })
    expect(live.parseBounds({ x: 0, y: 0, width: 0, height: 200 })).toBeNull()
    expect(live.parseBounds({ x: 0, y: 0, width: 300, height: 0 })).toBeNull()
    expect(live.parseBounds({ x: 0.5, y: 0, width: 300, height: 200 })).toBeNull()
    expect(live.parseBounds({ x: 0, y: 0, width: 300.5, height: 200 })).toBeNull()
    expect(live.parseBounds({ x: '0', y: 0, width: 300, height: 200 })).toBeNull()
    expect(live.parseBounds({ x: 0, y: 0, width: '300', height: 200 })).toBeNull()
    expect(live.parseBounds(null)).toBeNull()
  })

  // `getBoundingClientRect` speaks CSS pixels, `setBounds` speaks DIPs: at any zoom other
  // than 1 the rectangle drifts unless the factor is applied.
  it('converts the renderer rectangle from CSS pixels to DIPs', () => {
    const css = { x: 8, y: 12, width: 640, height: 360 }
    expect(live.toViewBounds(css, 1)).toEqual({ x: 8, y: 12, width: 640, height: 360 })
    expect(live.toViewBounds(css, 1.25)).toEqual({ x: 10, y: 15, width: 800, height: 450 })
    expect(live.toViewBounds({ x: 10, y: 20, width: 300, height: 200 }, 0.9)).toEqual({ x: 9, y: 18, width: 270, height: 180 })
    expect(live.toViewBounds(css, undefined)).toEqual(css)
    expect(live.toViewBounds(css, 0)).toEqual(css)
    expect(live.toViewBounds(css, Number.NaN)).toEqual(css)
    // Untrusted shapes are refused here rather than rounded into something plausible.
    expect(live.toViewBounds({ x: '8', y: 12, width: 640, height: 360 }, 1)).toBeNull()
    expect(live.toViewBounds(null, 1)).toBeNull()
  })

  it('mounts into the window, positions the view and unmounts it', () => {
    const views = []
    const FakeView = viewClass(views)
    const window = { contentView: { addChildView: vi.fn(), removeChildView: vi.fn() } }
    const surface = live.createLiveSurface(FakeView)

    expect(surface.status()).toEqual({ mounted: false, state: 'idle' })

    surface.mount(window)
    const view = views[0]
    expect(window.contentView.addChildView).toHaveBeenCalledWith(view)
    expect(view.options.webPreferences).toEqual(live.liveWebPreferences)
    expect(view.webContents.loadURL).toHaveBeenCalledWith(live.LIVE_HOME)
    expect(surface.status()).toEqual({ mounted: true, state: 'loading' })

    // Mounting twice must reuse the single surface instead of stacking views.
    surface.mount(window)
    expect(views).toHaveLength(1)

    surface.setBounds({ x: 8, y: 9, width: 640, height: 360 })
    expect(view.bounds).toEqual({ x: 8, y: 9, width: 640, height: 360 })
    surface.setBounds({ x: -12, y: -34, width: 640, height: 360 })
    expect(view.bounds).toEqual({ x: -12, y: -34, width: 640, height: 360 })
    // An unusable rectangle leaves the last good one in place instead of half-applying.
    surface.setBounds({ x: 0, y: 0, width: 640, height: 0 })
    expect(view.bounds).toEqual({ x: -12, y: -34, width: 640, height: 360 })

    surface.unmount(window)
    expect(window.contentView.removeChildView).toHaveBeenCalledWith(view)
    expect(view.webContents.close).toHaveBeenCalledOnce()
    expect(surface.status()).toEqual({ mounted: false, state: 'idle' })
  })

  it('reports a failed load honestly instead of an empty column', () => {
    const seen = []
    const surface = live.createLiveSurface(viewClass([]))
    surface.subscribe(status => seen.push(status))
    surface.mount({ contentView: { addChildView: vi.fn(), removeChildView: vi.fn() } })
    const guest = surface.view().webContents
    guest.emit('did-finish-load')
    expect(surface.status().state).toBe('ready')
    guest.emit('did-fail-load', {}, -105, 'NAME_NOT_RESOLVED', 'https://www.tiktok.com/', true)
    expect(surface.status()).toEqual({ mounted: true, state: 'failed', reason: 'NAME_NOT_RESOLVED' })
    expect(seen.at(-1)).toEqual({ mounted: true, state: 'failed', reason: 'NAME_NOT_RESOLVED' })
  })
})
