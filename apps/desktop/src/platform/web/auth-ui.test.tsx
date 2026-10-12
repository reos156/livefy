import { cleanup, render, waitFor } from '@testing-library/react'
import { ClerkInstanceContext } from '@clerk/shared/react'
import { afterEach, expect, it, vi } from 'vitest'
const mount = vi.hoisted(() => vi.fn())
const clerk = { loaded: true, mountSignIn: mount, unmountSignIn: vi.fn(), __internal_updateProps: vi.fn() }
import { BrowserAuthUi, browserCompletionUrl, createBrowserNavigation } from './auth-ui'
afterEach(() => { cleanup(); mount.mockClear(); window.history.replaceState(null, '', '/') })
it('mounts installed browser SignIn with embedded sign-up, hash steps, redirect OAuth and Livefy tokens', async () => {
  window.history.replaceState(null, '', '/?redirect_url=https://evil.test/#/verify')
  const view = render(<ClerkInstanceContext.Provider value={{ value: clerk as unknown as ReturnType<typeof import('@clerk/react').useClerk> }}><BrowserAuthUi /></ClerkInstanceContext.Provider>)
  await waitFor(() => expect(mount).toHaveBeenCalledOnce())
  expect(mount.mock.lastCall?.[0]).toBeInstanceOf(HTMLElement)
  expect(mount.mock.lastCall?.[1]).toMatchObject({ routing: 'hash', withSignUp: true, oauthFlow: 'redirect', signInUrl: `${window.location.origin}/#/`, forceRedirectUrl: `${window.location.origin}/#/`, signUpForceRedirectUrl: `${window.location.origin}/#/`, appearance: { variables: { colorPrimary: 'var(--primary)', colorBackground: 'var(--card)' } } })
  view.unmount()
  expect(clerk.unmountSignIn).toHaveBeenCalledWith(mount.mock.lastCall?.[0])
})
it('returns to the public memory route only for the fixed completion, without bridge calls', () => {
  const native = vi.fn(), navigate = vi.fn()
  window.livefySession = { logout: native, persistence: native }
  const completion = browserCompletionUrl(window.location.href)
  const navigation = createBrowserNavigation(completion, navigate)
  window.history.replaceState(null, '', '/#/verify')
  navigation.routerReplace(completion)
  expect(window.location.hash).toBe('#/')
  expect(navigate).toHaveBeenCalledWith(true)
  navigation.routerPush('/#/')
  expect(navigate).toHaveBeenLastCalledWith(false)
  expect(native).not.toHaveBeenCalled()
  delete window.livefySession
})
it.each(['https://evil.test/#/', '//evil.test/#/', 'livefy://renderer/', 'javascript:alert(1)', '/app', '/#/verify', '/?redirect_url=https://evil.test/#/', '/a/../#/'])('rejects non-completion target %s without changing auth steps', target => {
  window.history.replaceState(null, '', '/#/verify')
  const navigate = vi.fn()
  const navigation = createBrowserNavigation(browserCompletionUrl(window.location.href), navigate)
  expect(() => navigation.routerReplace(target)).toThrow('Unsupported browser completion target')
  expect(navigate).not.toHaveBeenCalled()
  expect(window.location.hash).toBe('#/verify')
})
it.each(['livefy://renderer/', 'file:///index.html', 'https://user:pass@example.test/'])('rejects non-browser document %s', url => {
  expect(() => browserCompletionUrl(url)).toThrow()
})
it('accepts SDK origin-relative completion at a served subpath and preserves intermediate steps until completion', () => {
  window.history.replaceState(null, '', '/preview/#/verify')
  const navigate = vi.fn()
  const completion = browserCompletionUrl(window.location.href)
  const navigation = createBrowserNavigation(completion, navigate)
  // clerk-js navigate resolves against the document then passes pathname + search + hash.
  const sdkTarget = new URL(completion, window.location.href)
  navigation.routerPush(sdkTarget.pathname + sdkTarget.search + sdkTarget.hash)
  expect(window.location.pathname).toBe('/preview/')
  expect(window.location.hash).toBe('#/')
  expect(navigate).toHaveBeenCalledWith(false)
  expect(() => navigation.routerReplace('/#/')).toThrow()
})
it('preserves a served document path and strips query and auth steps', () => {
  expect(browserCompletionUrl('https://example.test/preview/?redirect_url=bad#/verify')).toBe('https://example.test/preview/#/')
})
