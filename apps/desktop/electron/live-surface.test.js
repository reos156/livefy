// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import live from './live-surface.cjs'

// The surface loads third-party content, so every assertion here is about a boundary:
// what it may load, what it may ask for, and who decides where it sits.
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
    const handlers = {}
    const session = {
      handlers: {},
      setPermissionRequestHandler: vi.fn(),
      setPermissionCheckHandler: vi.fn(),
      on(name, fn) { this.handlers[name] = fn },
    }
    const contents = { session, on: (name, fn) => { handlers[name] = fn }, setWindowOpenHandler: vi.fn() }
    live.hardenLiveContents(contents)

    const callback = vi.fn()
    session.setPermissionRequestHandler.mock.calls[0][0]({}, 'media', callback)
    expect(callback).toHaveBeenCalledWith(false)
    expect(session.setPermissionCheckHandler.mock.calls[0][0]({}, 'media')).toBe(false)
    expect(contents.setWindowOpenHandler.mock.calls[0][0]({ url: 'https://www.tiktok.com' })).toEqual({ action: 'deny' })

    const blocked = { preventDefault: vi.fn() }
    handlers['will-navigate'](blocked, 'https://accounts.google.com/')
    expect(blocked.preventDefault).toHaveBeenCalledOnce()

    const allowed = { preventDefault: vi.fn() }
    handlers['will-navigate'](allowed, 'https://www.tiktok.com/@someone/live')
    expect(allowed.preventDefault).not.toHaveBeenCalled()

    const webview = { preventDefault: vi.fn() }
    handlers['will-attach-webview'](webview)
    expect(webview.preventDefault).toHaveBeenCalledOnce()

    const download = { preventDefault: vi.fn() }
    session.handlers['will-download'](download)
    expect(download.preventDefault).toHaveBeenCalledOnce()
  })

  it('hardens the shared partition session only once', () => {
    const session = {
      handlers: {},
      setPermissionRequestHandler: vi.fn(),
      setPermissionCheckHandler: vi.fn(),
      on(name, fn) { this.handlers[name] = fn },
    }
    const make = () => ({ session, on: vi.fn(), setWindowOpenHandler: vi.fn() })
    live.hardenLiveContents(make())
    live.hardenLiveContents(make())
    // A second `will-download` listener would be dead weight, not a second denial.
    expect(Object.keys(session.handlers)).toEqual(['will-download'])
  })

  it('accepts only whole, non-negative bounds', () => {
    expect(live.parseBounds({ x: 10, y: 20, width: 300, height: 200 })).toEqual({ x: 10, y: 20, width: 300, height: 200 })
    expect(live.parseBounds({ x: -5, y: 0, width: 300, height: 200 })).toBeNull()
    expect(live.parseBounds({ x: 0, y: 0, width: 0, height: 200 })).toBeNull()
    expect(live.parseBounds({ x: 0, y: 0, width: 300.5, height: 200 })).toBeNull()
    expect(live.parseBounds({ x: '0', y: 0, width: 300, height: 200 })).toBeNull()
    expect(live.parseBounds(null)).toBeNull()
  })

  it('mounts into the window, positions the view and unmounts it', () => {
    const views = []
    class FakeView {
      constructor(options) { this.options = options; this.bounds = null; this.closed = false; views.push(this)
        this.webContents = { on: vi.fn(), setWindowOpenHandler: vi.fn(), loadURL: vi.fn(() => Promise.resolve()), close: vi.fn(() => { this.closed = true }), session: sessionStub() } }
      setBounds(next) { this.bounds = next }
    }
    function sessionStub() {
      return { setPermissionRequestHandler: vi.fn(), setPermissionCheckHandler: vi.fn(), on: vi.fn() }
    }
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
    surface.setBounds({ x: -1, y: 0, width: 640, height: 360 })
    expect(view.bounds).toEqual({ x: 8, y: 9, width: 640, height: 360 })

    surface.unmount(window)
    expect(window.contentView.removeChildView).toHaveBeenCalledWith(view)
    expect(view.closed).toBe(true)
    expect(surface.status()).toEqual({ mounted: false, state: 'idle' })
  })

  it('reports a failed load honestly instead of an empty column', () => {
    const seen = []
    class FakeView {
      constructor() {
        this.webContents = { handlers: {}, setWindowOpenHandler: vi.fn(), loadURL: vi.fn(() => Promise.resolve()),
          session: { setPermissionRequestHandler: vi.fn(), setPermissionCheckHandler: vi.fn(), on: vi.fn() },
          on(name, fn) { this.handlers[name] = fn }, close: vi.fn() }
      }
      setBounds() {}
    }
    const surface = live.createLiveSurface(FakeView)
    surface.subscribe(status => seen.push(status))
    surface.mount({ contentView: { addChildView: vi.fn(), removeChildView: vi.fn() } })
    const guest = surface.view().webContents
    guest.handlers['did-finish-load']()
    expect(surface.status().state).toBe('ready')
    guest.handlers['did-fail-load']({}, -105, 'NAME_NOT_RESOLVED', 'https://www.tiktok.com/', true)
    expect(surface.status()).toEqual({ mounted: true, state: 'failed', reason: 'NAME_NOT_RESOLVED' })
    expect(seen.at(-1)).toEqual({ mounted: true, state: 'failed', reason: 'NAME_NOT_RESOLVED' })
  })
})