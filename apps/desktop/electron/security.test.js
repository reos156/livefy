// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import policy from './security.cjs'

const local = 'file:///desktop/dist/index.html'

describe('shell boundary', () => {
  it('isolates the renderer without Node or webviews', () => {
    expect(policy.webPreferences).toEqual({
      sandbox: true, contextIsolation: true, nodeIntegration: false, webviewTag: false,
    })
  })

  it('allows only the exact entry document and hash routes', () => {
    for (const entry of [local, policy.DEV_URL]) {
      expect(policy.canNavigate(`${entry}#/`, entry)).toBe(true)
      for (const url of ['https://example.com', `${entry}?redirect=1`, `${entry}/other`, 'javascript:alert(1)', 'not a URL']) {
        expect(policy.canNavigate(url, entry)).toBe(false)
      }
    }
    expect(policy.canNavigate('http://127.0.0.1:5173.evil.test/', policy.DEV_URL)).toBe(false)
  })

  it('wires permission, popup, navigation, redirect and webview denial', () => {
    const handlers = {}
    const session = { setPermissionRequestHandler: vi.fn(), setPermissionCheckHandler: vi.fn() }
    const contents = { session, on: (name, fn) => { handlers[name] = fn }, setWindowOpenHandler: vi.fn() }
    policy.secureContents(contents, local)
    const callback = vi.fn()
    session.setPermissionRequestHandler.mock.calls[0][0]({}, 'media', callback)
    expect(callback).toHaveBeenCalledWith(false)
    expect(session.setPermissionCheckHandler.mock.calls[0][0]()).toBe(false)
    expect(contents.setWindowOpenHandler.mock.calls[0][0]()).toEqual({ action: 'deny' })
    for (const name of ['will-navigate', 'will-redirect', 'will-attach-webview']) {
      const event = { preventDefault: vi.fn() }
      handlers[name](event, 'https://example.com')
      expect(event.preventDefault).toHaveBeenCalledOnce()
    }
    const event = { preventDefault: vi.fn() }
    handlers['will-navigate'](event, `${local}#/`)
    expect(event.preventDefault).not.toHaveBeenCalled()
  })
})
