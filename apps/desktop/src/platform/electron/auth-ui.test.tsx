import { cleanup, render, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ loaded: true, mountSignIn: vi.fn(), unmountSignIn: vi.fn(), __internal_updateProps: vi.fn() }))
import { ClerkInstanceContext } from '@clerk/shared/react'
import { StrictMode } from 'react'
// Exercise the installed mount wrapper, not the remote CDN UI or discovery flow.
vi.mock('@clerk/electron/react', async () => {
  const { SignIn } = await vi.importActual<typeof import('@clerk/react')>('@clerk/react')
  return { SignIn }
})
import { ElectronAuthUi, createModalNavigation, publicCompletionUrl } from './auth-ui'
afterEach(() => { cleanup(); vi.clearAllMocks(); vi.restoreAllMocks() })
describe('official embedded authentication', () => {
  it.each([
    ['routerPush', 'canonical'], ['routerPush', 'alias'],
    ['routerReplace', 'canonical'], ['routerReplace', 'alias'],
  ] as const)('returns signup hash to login with %s %s only after validation', async (method, targetKind) => {
    const original = window.location.href
    window.history.replaceState(null, '', '#/sign-up')
    const replaceState = vi.spyOn(window.history, 'replaceState')
    const hashchange = vi.fn()
    window.addEventListener('hashchange', hashchange)
    const navigate = vi.fn(), windowNavigate = vi.fn()
    const completion = publicCompletionUrl(window.location.href)
    const delegates = createModalNavigation(completion, navigate)
    try {
      for (const target of ['/sign-in', '#/', '/#/private', 'https://evil.test/#/']) {
        expect(() => delegates[method](target, { windowNavigate })).toThrow('Unsupported Clerk completion target')
      }
      expect(window.location.hash).toBe('#/sign-up')
      expect(replaceState).not.toHaveBeenCalled()
      expect(navigate).not.toHaveBeenCalled()
      delegates[method](targetKind === 'alias' ? '/#/' : completion, { windowNavigate })
      expect(window.location.hash).toBe('#/')
      expect(navigate).toHaveBeenCalledExactlyOnceWith(method === 'routerReplace')
      await waitFor(() => expect(hashchange).toHaveBeenCalledOnce())
      expect(replaceState).toHaveBeenCalledTimes(method === 'routerReplace' ? 1 : 0)
      delegates[method](completion)
      expect(hashchange).toHaveBeenCalledOnce()
      expect(windowNavigate).not.toHaveBeenCalled()
    } finally {
      window.removeEventListener('hashchange', hashchange)
      replaceState.mockRestore()
      window.history.replaceState(null, '', original)
    }
  })
  it('does not synchronize an unrelated browser document for helper-only navigation', () => {
    const original = window.location.href
    window.history.replaceState(null, '', '#/sign-up')
    try {
      const delegates = createModalNavigation('file:///C:/Livefy/index.html#/', vi.fn())
      delegates.routerPush('file:///C:/Livefy/index.html#/')
      delegates.routerReplace('file:///C:/Livefy/index.html#/')
      expect(window.location.hash).toBe('#/sign-up')
    } finally { window.history.replaceState(null, '', original) }
  })
  it.each(['routerPush', 'routerReplace'] as const)('keeps accepted and rejected %s completions silent', method => {
    const sinks = ['warn', 'log', 'error'].map(name => vi.spyOn(console, name as 'warn' | 'log' | 'error').mockImplementation(() => {}))
    const navigate = vi.fn(), windowNavigate = vi.fn()
    const delegates = createModalNavigation('livefy://renderer/#/', navigate)
    delegates[method]('livefy://renderer/#/', { windowNavigate })
    delegates[method]('/#/', { windowNavigate })
    for (const target of ['#/', 'livefy://renderer/?secret=token#/private', 'https://evil.test/#/']) {
      expect(() => delegates[method](target, { windowNavigate })).toThrow('Unsupported Clerk completion target')
    }
    expect(navigate.mock.calls).toEqual([[method === 'routerReplace'], [method === 'routerReplace']])
    expect(windowNavigate).not.toHaveBeenCalled()
    for (const sink of sinks) expect(sink).not.toHaveBeenCalled()
  })
  it('accepts the raw root-relative public alias through memory push and replace only', () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const navigate = vi.fn(), windowNavigate = vi.fn()
    const delegates = createModalNavigation(publicCompletionUrl('livefy://renderer/'), navigate)
    delegates.routerPush('/#/', { windowNavigate })
    delegates.routerReplace('/#/', { windowNavigate })
    expect(navigate.mock.calls).toEqual([[false], [true]])
    expect(windowNavigate).not.toHaveBeenCalled()
    expect(warning).not.toHaveBeenCalled()
  })
  it.each(['http://localhost:5173/', 'https://example.test/', 'file:///'])('accepts the root alias only for the same document: %s', renderer => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const navigate = vi.fn(), windowNavigate = vi.fn()
    const delegates = createModalNavigation(publicCompletionUrl(renderer), navigate)
    delegates.routerPush('/#/', { windowNavigate })
    delegates.routerReplace('/#/', { windowNavigate })
    expect(navigate.mock.calls).toEqual([[false], [true]])
    expect(windowNavigate).not.toHaveBeenCalled()
    expect(warning).not.toHaveBeenCalled()
  })
  it.each(['http://localhost:5173/index.html', 'https://example.test/app/', 'file:///C:/Livefy/index.html'])('rejects root alias document changes: %s', renderer => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const navigate = vi.fn(), windowNavigate = vi.fn()
    const delegates = createModalNavigation(publicCompletionUrl(renderer), navigate)
    expect(() => delegates.routerPush('/#/', { windowNavigate })).toThrow('Unsupported Clerk completion target')
    expect(() => delegates.routerReplace('/#/', { windowNavigate })).toThrow('Unsupported Clerk completion target')
    expect(navigate).not.toHaveBeenCalled()
    expect(windowNavigate).not.toHaveBeenCalled()
  })
  it.each([
    './#/', '../#/', '/./#/', '/app/../#/', '/%2e/#/', '/%2e%2e/#/', '/%2f#/', '/#/%2f',
    '\\/#/', '/\\#/', '//renderer/#/', '//user:pass@renderer/#/', '//renderer:80/#/',
    '/?x=1#/', '/?#/', '/#/?x=1', '/#//', '/#/private', '/#/#/', '/#', '/', '#/',
    ' /#/', '/#/ ', '/#/\n', '/\t#/', '/#/\u0000', '/#/\u007f',
    'LIVEFY://renderer/#/', 'livefy://renderer:80/#/', 'livefy://user:pass@renderer/#/',
    null, undefined, 1, { toString() { throw new Error('coercion_secret') } },
  ])('rejects nonliteral aliases despite URL normalization (%#)', target => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const navigate = vi.fn(), windowNavigate = vi.fn()
    const delegates = createModalNavigation('livefy://renderer/#/', navigate)
    expect(() => delegates.routerPush(target as string, { windowNavigate })).toThrow('Unsupported Clerk completion target')
    expect(() => delegates.routerReplace(target as string, { windowNavigate })).toThrow('Unsupported Clerk completion target')
    expect(navigate).not.toHaveBeenCalled()
    expect(windowNavigate).not.toHaveBeenCalled()
  })
  it('admits the built renderer startup URL before React bootstrap', () => {
    // Exercise the bootstrap helper without importing main.tsx and mounting the app.
    expect(publicCompletionUrl('livefy://renderer/')).toBe('livefy://renderer/#/')
  })
  it('mounts installed unified SignIn with supported local appearance and cleans up its host', async () => {
    const view = render(<ClerkInstanceContext.Provider value={{ value: mocks as unknown as ReturnType<typeof import('@clerk/react').useClerk> }}><ElectronAuthUi /></ClerkInstanceContext.Provider>)
    const url = publicCompletionUrl(window.location.href)
    await waitFor(() => expect(mocks.mountSignIn).toHaveBeenCalledOnce())
    const [host, props] = mocks.mountSignIn.mock.calls[0]
    expect(host).toBeInstanceOf(HTMLElement)
    expect(props).toMatchObject({ routing: 'hash', withSignUp: true, signInUrl: url, forceRedirectUrl: url, signUpForceRedirectUrl: url,
      appearance: { variables: { colorPrimary: 'var(--primary)', colorPrimaryForeground: 'var(--primary-foreground)', fontFamily: "'Geist Variable', ui-sans-serif, sans-serif" } } })
    expect(props).not.toHaveProperty('virtual')
    view.unmount()
    expect(mocks.unmountSignIn).toHaveBeenCalledExactlyOnceWith(host)
  })
  it('balances installed host mount and cleanup in StrictMode', () => {
    const view = render(<StrictMode><ClerkInstanceContext.Provider value={{ value: mocks as unknown as ReturnType<typeof import('@clerk/react').useClerk> }}><ElectronAuthUi /></ClerkInstanceContext.Provider></StrictMode>)
    expect(mocks.mountSignIn).toHaveBeenCalledTimes(2)
    expect(mocks.unmountSignIn).toHaveBeenCalledTimes(1)
    view.unmount()
    expect(mocks.unmountSignIn).toHaveBeenCalledTimes(2)
    expect(mocks.mountSignIn.mock.calls.map(([host]) => host)).toEqual(mocks.unmountSignIn.mock.calls.map(([host]) => host))
  })
  it.each(['livefy://renderer/?old=1#/app', 'livefy://renderer/#/app', 'livefy://renderer/?old=1', 'livefy://renderer/#/'])('canonicalizes trusted renderer search and hash: %s', renderer => {
    expect(publicCompletionUrl(renderer)).toBe('livefy://renderer/#/')
  })
  it.each([
    'other://renderer/', 'javascript:alert(1)', 'livefy://evil/',
    'livefy://renderer.evil/', 'livefy://renderer@evil/',
    'livefy://user:pass@renderer/', 'livefy://@renderer/',
    'livefy://renderer:80/', 'livefy://renderer:/',
    'livefy://renderer/app', 'livefy://renderer//', 'livefy://renderer',
    'livefy://renderer/./', 'livefy://renderer/app/../',
    'livefy://renderer/%2e/', 'livefy://renderer/%2e%2e/',
    'livefy://renderer/%2f', 'livefy://%72enderer/',
    'livefy:/renderer/', 'livefy:///renderer/', 'livefy://renderer\\\\',
    ' livefy://renderer/', 'livefy://renderer/\n',
    'livefy://ren\tderer/', 'livefy://renderer/?x=\r1',
    'livefy://renderer/#\u0000', 'livefy://renderer/\u007f',
    'LIVEFY://renderer/', 'livefy://Renderer/', 'not a URL',
    'https://user:pass@example.test/', 'file://user:pass@host/path',
  ])('rejects untrusted or normalized renderer addresses: %s', renderer => {
    expect(() => publicCompletionUrl(renderer)).toThrow()
  })
  it.each(['livefy://renderer/#/app', 'livefy://renderer/?x=1#/', 'livefy://renderer/#/%2f', 'livefy://renderer/./#/'])('refuses non-exact custom completion: %s', target => {
    const navigate = vi.fn(), windowNavigate = vi.fn()
    const delegates = createModalNavigation(publicCompletionUrl('livefy://renderer/'), navigate)
    expect(() => delegates.routerPush(target, { windowNavigate })).toThrow('Unsupported Clerk completion target')
    expect(() => delegates.routerReplace(target, { windowNavigate })).toThrow('Unsupported Clerk completion target')
    expect(navigate).not.toHaveBeenCalled()
    expect(windowNavigate).not.toHaveBeenCalled()
  })
  it.each(['http://localhost:5173/index.html?old=1#/app', 'https://example.test/index.html?old=1#/app', 'file:///C:/Livefy/index.html#/app', 'livefy://renderer/?old=1#/app'])('uses exact canonical renderer public URL: %s', renderer => {
    const completion = publicCompletionUrl(renderer)
    expect(completion).toBe(renderer.split(/[?#]/)[0] + '#/')
    const navigate = vi.fn()
    const delegates = createModalNavigation(completion, navigate)
    delegates.routerPush(completion)
    delegates.routerReplace(completion)
    expect(navigate.mock.calls).toEqual([[false], [true]])
  })
  it.each(['/app', '/', '#/', '//localhost:5173/#/', 'https://evil.test/#/', 'http://user:pass@localhost:5173/#/', 'http://localhost:5173/#/app', 'http://localhost:5173/?x=1#/', 'http://localhost:5173/#/other', 'http://localhost:5173/#/%2f', ' http://localhost:5173/#/'])('rejects unexpected destination without browser fallback: %s', target => {
    const navigate = vi.fn(), windowNavigate = vi.fn()
    const delegates = createModalNavigation('http://localhost:5173/#/', navigate)
    expect(() => delegates.routerPush(target, { windowNavigate })).toThrow('Unsupported Clerk completion target')
    expect(() => delegates.routerReplace(target, { windowNavigate })).toThrow('Unsupported Clerk completion target')
    expect(navigate).not.toHaveBeenCalled()
    expect(windowNavigate).not.toHaveBeenCalled()
  })
})
