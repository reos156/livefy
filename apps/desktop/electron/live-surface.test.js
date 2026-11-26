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
    this.setZoomFactor = vi.fn()
    this.loadURL = vi.fn(() => Promise.resolve())
    this.close = vi.fn()
  }
}

function viewClass(views, load = () => Promise.resolve()) {
  return class FakeView {
    constructor(options) {
      this.options = options
      this.webContents = new Guest()
      this.webContents.loadURL = vi.fn(load)
      this.bounds = null
      views.push(this)
    }
    setBounds(next) { this.bounds = next }
  }
}

// A promise the test settles by hand, so a load can still be in flight while the surface is
// closed and the operator (or Chromium) moves on.
function deferredLoads() {
  const loads = []
  return {
    loads,
    load: () => new Promise((resolve, reject) => { loads.push({ resolve, reject }) }),
  }
}

async function flushed() {
  await new Promise(resolve => { setImmediate(resolve) })
}

function mountedSurface(url) {
  const views = []
  const surface = live.createLiveSurface(viewClass(views))
  surface.mount({ contentView: { addChildView: vi.fn(), removeChildView: vi.fn() } }, url)
  return { surface, views, guest: surface.view().webContents }
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

    const blocked = { url: 'https://accounts.google.com/', isMainFrame: true, preventDefault: vi.fn() }
    contents.emit('will-navigate', blocked)
    expect(blocked.preventDefault).toHaveBeenCalledOnce()

    const allowed = { url: 'https://www.tiktok.com/@someone/live', isMainFrame: true, preventDefault: vi.fn() }
    contents.emit('will-navigate', allowed)
    expect(allowed.preventDefault).not.toHaveBeenCalled()

    const redirected = { url: 'https://evil.test/', isMainFrame: true, preventDefault: vi.fn() }
    contents.emit('will-redirect', redirected)
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
    const url = live.requireLiveChannel('mundokawaii')

    expect(surface.status()).toEqual({ mounted: false, state: 'idle' })

    surface.mount(window, url)
    const view = views[0]
    expect(window.contentView.addChildView).toHaveBeenCalledWith(view)
    expect(view.options.webPreferences).toEqual(live.liveWebPreferences)
    expect(view.webContents.loadURL).toHaveBeenCalledWith('https://www.tiktok.com/@mundokawaii/live')
    // The operator reverted half scale for being unreadable and kept this value, knowing the
    // rail clips until the column is wide enough.
    expect(live.LIVE_ZOOM).toBe(0.8)
    expect(view.webContents.setZoomFactor).toHaveBeenCalledWith(0.8)
    expect(surface.status()).toEqual({ mounted: true, state: 'loading' })

    // Mounting twice must reuse the single surface instead of stacking views.
    surface.mount(window, url)
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
    surface.mount({ contentView: { addChildView: vi.fn(), removeChildView: vi.fn() } }, live.requireLiveChannel('mundokawaii'))
    const guest = surface.view().webContents
    guest.emit('did-finish-load')
    expect(surface.status().state).toBe('ready')
    guest.emit('did-fail-load', {}, -105, 'NAME_NOT_RESOLVED', 'https://www.tiktok.com/', true)
    expect(surface.status()).toEqual({ mounted: true, state: 'failed', reason: 'NAME_NOT_RESOLVED' })
    expect(seen.at(-1)).toEqual({ mounted: true, state: 'failed', reason: 'NAME_NOT_RESOLVED' })
  })
})

// S11: the renderer names a channel, never a URL. The handle is validated here, the URL is
// built here, and the allowlist check happens before anything loads.
describe('live channel', () => {
  it('accepts only a strict handle', () => {
    for (const handle of ['mundokawaii', 'Mundo.Kawaii_01', 'a1', 'x'.repeat(24)]) {
      expect(live.parseLiveHandle(handle)).toBe(handle)
    }
    for (const handle of [
      'a',
      'x'.repeat(25),
      '@mundokawaii',
      'mundo kawaii',
      'mundo-kawaii',
      'mundo/kawaii',
      'mundo?kawaii',
      '..',
      '__',
      '',
      ' mundo',
      null,
      undefined,
      42,
      ['mundokawaii'],
      { handle: 'mundokawaii' },
    ]) {
      expect(live.parseLiveHandle(handle)).toBeNull()
    }
  })

  it('builds the live URL from the handle and keeps it inside the allowlist', () => {
    expect(live.liveUrlForHandle('mundokawaii')).toBe('https://www.tiktok.com/@mundokawaii/live')
    expect(live.liveUrlForHandle('Mundo.Kawaii_01')).toBe('https://www.tiktok.com/@Mundo.Kawaii_01/live')
    expect(live.isAllowedLiveUrl(live.liveUrlForHandle('mundokawaii'))).toBe(true)
    expect(live.liveUrlForHandle('@mundokawaii')).toBeNull()
    expect(live.liveUrlForHandle('mundo kawaii')).toBeNull()
    expect(live.liveUrlForHandle(null)).toBeNull()
  })

  it('refuses an invalid channel with a thrown error instead of loading something', () => {
    expect(live.requireLiveChannel('mundokawaii')).toBe('https://www.tiktok.com/@mundokawaii/live')
    for (const handle of ['@mundokawaii', 'mundo kawaii', 'a', '', null, 42]) {
      expect(() => live.requireLiveChannel(handle)).toThrow('Invalid live channel')
    }
  })

  it('loads the channel it was given and nothing else', () => {
    const { guest } = mountedSurface(live.requireLiveChannel('mundokawaii'))
    expect(guest.loadURL).toHaveBeenCalledWith('https://www.tiktok.com/@mundokawaii/live')
  })

  it('refuses to mount a URL outside the allowlist, or no URL at all', () => {
    const views = []
    const surface = live.createLiveSurface(viewClass(views))
    const window = { contentView: { addChildView: vi.fn(), removeChildView: vi.fn() } }

    expect(() => surface.mount(window, 'https://evil.test/@mundokawaii/live')).toThrow('Refused live URL')
    expect(() => surface.mount(window, 'http://www.tiktok.com/@mundokawaii/live')).toThrow('Refused live URL')
    expect(() => surface.mount(window)).toThrow('Refused live URL')
    // A refused mount must not leave a half-created guest attached to the window.
    expect(views).toHaveLength(0)
    expect(window.contentView.addChildView).not.toHaveBeenCalled()
    expect(surface.status()).toEqual({ mounted: false, state: 'idle' })
  })

  // S16: the caption used to wait for `did-finish-load`, which can arrive after the page is
  // already usable. The document being ready is the end of the load.
  it('reports ready as soon as the document is ready', () => {
    const { surface, guest } = mountedSurface(live.requireLiveChannel('mundokawaii'))
    expect(surface.status().state).toBe('loading')

    guest.emit('dom-ready')
    expect(surface.status()).toEqual({ mounted: true, state: 'ready' })

    // `did-finish-load` stays the same end state instead of a second one.
    guest.emit('did-finish-load')
    expect(surface.status()).toEqual({ mounted: true, state: 'ready' })
  })

  it('lets a failure win over the error page it paints', () => {
    const { surface, guest } = mountedSurface(live.requireLiveChannel('mundokawaii'))

    guest.emit('did-fail-load', {}, -105, 'NAME_NOT_RESOLVED', 'https://www.tiktok.com/@mundokawaii/live', true)
    expect(surface.status()).toEqual({ mounted: true, state: 'failed', reason: 'NAME_NOT_RESOLVED' })

    // Chromium loads its own error document, which fires start and ready events of its own.
    // Neither may take the state back: a start event that reset the failure left the caption
    // on "Cargando" forever, and a ready event would have hidden the reason.
    guest.emit('did-start-loading')
    guest.emit('dom-ready')
    guest.emit('did-finish-load')
    expect(surface.status()).toEqual({ mounted: true, state: 'failed', reason: 'NAME_NOT_RESOLVED' })
  })

  // A retry is a new mount, not a new document in the same one, so the failure above is
  // final for its generation and the operator gets a clean one.
  it('lets a fresh mount start clean after a failure', () => {
    const { surface, guest } = mountedSurface(live.requireLiveChannel('mundokawaii'))
    const window = { contentView: { addChildView: vi.fn(), removeChildView: vi.fn() } }

    guest.emit('did-fail-load', {}, -105, 'NAME_NOT_RESOLVED', 'https://www.tiktok.com/@mundokawaii/live', true)
    expect(surface.status().state).toBe('failed')

    surface.unmount(window)
    surface.mount(window, live.requireLiveChannel('mundokawaii'))
    expect(surface.status()).toEqual({ mounted: true, state: 'loading' })

    surface.view().webContents.emit('dom-ready')
    expect(surface.status()).toEqual({ mounted: true, state: 'ready' })
  })
})

// A refused URL is refused even when a surface is already open: with the reuse check first,
// the second gate never ran and a caller could believe it had mounted something.
describe('a second mount', () => {
  it('is refused when its URL is not on the allowlist, instead of returning the open view', () => {
    const views = []
    const surface = live.createLiveSurface(viewClass(views))
    const window = { contentView: { addChildView: vi.fn(), removeChildView: vi.fn() } }

    const first = surface.mount(window, live.requireLiveChannel('mundokawaii'))
    expect(() => surface.mount(window, 'https://evil.test/@mundokawaii/live')).toThrow('Refused live URL')
    expect(() => surface.mount(window)).toThrow('Refused live URL')
    // The refused call changed nothing: one guest, still the one that was mounted.
    expect(views).toHaveLength(1)
    expect(surface.view()).toBe(first)
    expect(surface.status()).toEqual({ mounted: true, state: 'loading' })

    // A valid second mount still reuses the single surface.
    expect(surface.mount(window, live.requireLiveChannel('mundokawaii'))).toBe(first)
    expect(views).toHaveLength(1)
  })
})

// Every mount is a generation of its own. An event, a failure or a rejected `loadURL` that
// belongs to a surface the operator already closed must publish nothing: overwriting the
// `idle` an unmount published is what left the column offering a retry for a viewer that no
// longer existed, disabled "Abrir el live" and turned "Cerrar visor" into a no-op.
describe('live surface generations', () => {
  function deferredSurface() {
    const views = []
    const deferred = deferredLoads()
    const surface = live.createLiveSurface(viewClass(views, deferred.load))
    const window = { contentView: { addChildView: vi.fn(), removeChildView: vi.fn() } }
    return { surface, views, window, loads: deferred.loads }
  }

  it('stays idle when the load the operator abandoned rejects afterwards', async () => {
    const { surface, window, loads } = deferredSurface()
    const seen = []
    surface.subscribe(status => seen.push(status))

    surface.mount(window, live.requireLiveChannel('mundokawaii'))
    expect(surface.status()).toEqual({ mounted: true, state: 'loading' })

    surface.unmount(window)
    expect(surface.status()).toEqual({ mounted: false, state: 'idle' })

    // Closing the surface aborts the load, and the rejection arrives afterwards.
    loads[0].reject(new Error('ERR_ABORTED'))
    await flushed()

    expect(surface.status()).toEqual({ mounted: false, state: 'idle' })
    expect(seen.at(-1)).toEqual({ mounted: false, state: 'idle' })
    expect(seen.filter(status => status.state === 'failed')).toHaveLength(0)
  })

  it('ignores the closed guest events and the stale rejection after a new mount', async () => {
    const { surface, window, loads } = deferredSurface()

    surface.mount(window, live.requireLiveChannel('mundokawaii'))
    const retired = surface.view().webContents
    surface.unmount(window)
    surface.mount(window, live.requireLiveChannel('otrocanal'))
    expect(surface.status()).toEqual({ mounted: true, state: 'loading' })

    // Everything the retired generation says from here on belongs to nothing.
    retired.emit('dom-ready')
    retired.emit('did-start-loading')
    retired.emit('did-fail-load', {}, -105, 'NAME_NOT_RESOLVED', 'https://www.tiktok.com/@mundokawaii/live', true)
    loads[0].reject(new Error('ERR_ABORTED'))
    await flushed()
    expect(surface.status()).toEqual({ mounted: true, state: 'loading' })

    // The current mount still owns the state, in both directions.
    surface.view().webContents.emit('dom-ready')
    expect(surface.status()).toEqual({ mounted: true, state: 'ready' })

    retired.emit('did-fail-load', {}, -105, 'NAME_NOT_RESOLVED', 'https://www.tiktok.com/@mundokawaii/live', true)
    expect(surface.status()).toEqual({ mounted: true, state: 'ready' })
  })

  // A document navigation the allowlist blocked leaves the frame where it was, so nothing
  // will ever become ready. Waiting for an event that cannot arrive is the third way the
  // caption stayed on "Cargando"; the block is the failure.
  it('reports a blocked document navigation as the failure it is', () => {
    const { surface, guest } = mountedSurface(live.requireLiveChannel('mundokawaii'))

    const blocked = { url: 'https://accounts.google.com/o/oauth2/auth', isMainFrame: true, preventDefault: vi.fn() }
    guest.emit('will-navigate', blocked)

    expect(blocked.preventDefault).toHaveBeenCalledOnce()
    expect(surface.status()).toEqual({ mounted: true, state: 'failed', reason: 'navegación bloqueada' })
  })

  // A subframe leaving TikTok is as ordinary as a failed subresource: an ad or an embed must
  // not take a live that is still loading down with it. Only the watched document counts.
  it('keeps loading when the blocked redirect belongs to a subframe', () => {
    const { surface, guest } = mountedSurface(live.requireLiveChannel('mundokawaii'))

    const blocked = { url: 'https://evil.test/', isMainFrame: false, preventDefault: vi.fn() }
    guest.emit('will-redirect', blocked)

    expect(blocked.preventDefault).toHaveBeenCalledOnce()
    expect(surface.status()).toEqual({ mounted: true, state: 'loading' })
  })

  // The surface already loaded, so the same block is just a blocked link: the live stays.
  it('keeps a live that was already loaded when a later link is blocked', () => {
    const { surface, guest } = mountedSurface(live.requireLiveChannel('mundokawaii'))
    guest.emit('dom-ready')

    const blocked = { preventDefault: vi.fn() }
    guest.emit('will-navigate', blocked, 'https://accounts.google.com/')

    expect(blocked.preventDefault).toHaveBeenCalledOnce()
    expect(surface.status()).toEqual({ mounted: true, state: 'ready' })
  })

  it('never lets a start event reopen a mount that already finished loading', () => {
    const { surface, guest } = mountedSurface(live.requireLiveChannel('mundokawaii'))
    guest.emit('dom-ready')

    guest.emit('did-start-loading')

    expect(surface.status()).toEqual({ mounted: true, state: 'ready' })
  })
})
