import { cleanup, render, waitFor } from '@testing-library/react'
import { ClerkInstanceContext } from '@clerk/shared/react'
import { createMemoryHistory } from '@tanstack/react-router'
import { afterEach, expect, it, vi } from 'vitest'
const mount = vi.hoisted(() => vi.fn())
const clerk = { loaded: true, mountSignIn: mount, unmountSignIn: vi.fn(), __internal_updateProps: vi.fn() }
import { BrowserAuthUi, browserCompletionUrl, createBrowserNavigation } from './auth-ui'
import { createAppRouter } from '../../routes'
afterEach(() => { cleanup(); mount.mockClear(); window.history.replaceState(null, '', '/') })
it('mounts installed combined hash SignIn with local redirects and Livefy tokens', async () => {
  window.history.replaceState(null, '', '/?redirect_url=https://evil.test/#/verify')
  const view = render(<ClerkInstanceContext.Provider value={{ value: clerk as unknown as ReturnType<typeof import('@clerk/react').useClerk> }}><BrowserAuthUi /></ClerkInstanceContext.Provider>)
  await waitFor(() => expect(mount).toHaveBeenCalledOnce())
  expect(mount.mock.lastCall?.[0]).toBeInstanceOf(HTMLElement)
  expect(mount.mock.lastCall?.[1]).toMatchObject({ routing: 'hash', withSignUp: true, oauthFlow: 'redirect', signInUrl: `${window.location.origin}/#/`, forceRedirectUrl: `${window.location.origin}/#/`, signUpForceRedirectUrl: `${window.location.origin}/#/`, appearance: { variables: { colorPrimary: 'var(--primary)', colorBackground: 'var(--card)' } } })
  view.unmount()
  expect(clerk.unmountSignIn).toHaveBeenCalledWith(mount.mock.lastCall?.[0])
})
it.each(['/', '/preview/'])('delegates unsigned completion at %s without adapter history or events', path => {
  window.history.replaceState({ app: 'livefy' }, '', `${path}?query=1#/create`)
  const before = window.location.href, state = window.history.state, length = window.history.length
  const completion = browserCompletionUrl(before)
  const navigate = vi.fn(), windowNavigate = vi.fn(), event = vi.fn()
  window.addEventListener('popstate', event)
  window.addEventListener('hashchange', event)
  try {
    const navigation = createBrowserNavigation(completion, navigate)
    navigation.routerPush(`${path}#/`, { windowNavigate })
    expect(windowNavigate).toHaveBeenCalledExactlyOnceWith(completion)
    expect(navigate).not.toHaveBeenCalled()
    expect(window.location.href).toBe(before)
    expect(window.history.state).toEqual(state)
    expect(window.history.length).toBe(length)
    expect(event).not.toHaveBeenCalled()
  } finally {
    window.removeEventListener('popstate', event)
    window.removeEventListener('hashchange', event)
  }
})
it.each(['/', '/preview/'])('normalizes authenticated completion at %s without synthetic notifications', path => {
  window.history.replaceState({ app: 'livefy' }, '', `${path}#/verify`)
  const navigate = vi.fn(), windowNavigate = vi.fn(), event = vi.fn()
  const completion = browserCompletionUrl(window.location.href)
  const navigation = createBrowserNavigation(completion, navigate).withSession(() => true)
  window.addEventListener('popstate', event)
  window.addEventListener('hashchange', event)
  try {
    navigation.routerReplace(completion, { windowNavigate })
    expect(window.location.href).toBe(completion)
    expect(window.history.state).toEqual({ app: 'livefy' })
    expect(navigate).toHaveBeenCalledExactlyOnceWith(true)
    expect(windowNavigate).not.toHaveBeenCalled()
    expect(event).not.toHaveBeenCalled()
    navigation.routerPush(`${path}#/`, { windowNavigate })
    expect(navigate).toHaveBeenLastCalledWith(false)
  } finally {
    window.removeEventListener('popstate', event)
    window.removeEventListener('hashchange', event)
  }
})
it('reads mutable session at invocation and fails closed without unsigned metadata', () => {
  window.history.replaceState(null, '', '/#/create')
  const completion = browserCompletionUrl(window.location.href), navigate = vi.fn(), windowNavigate = vi.fn()
  let signedIn = true
  const navigation = createBrowserNavigation(completion, navigate).withSession(() => signedIn)
  signedIn = false
  expect(() => navigation.routerReplace(completion)).toThrow('Browser navigation metadata unavailable')
  expect(window.location.hash).toBe('#/create')
  navigation.routerReplace(completion, { windowNavigate })
  expect(windowNavigate).toHaveBeenCalledExactlyOnceWith(completion)
  expect(navigate).not.toHaveBeenCalled()
})
it.each(['https://evil.test/#/', '//evil.test/#/', 'livefy://renderer/', 'javascript:alert(1)', 'https://user:pass@localhost/#/'])('rejects target %s before delegation', target => {
  window.history.replaceState(null, '', '/#/verify')
  const navigate = vi.fn(), windowNavigate = vi.fn()
  const navigation = createBrowserNavigation(browserCompletionUrl(window.location.href), navigate)
  expect(() => navigation.routerReplace(target, { windowNavigate })).toThrow('Unsupported browser completion target')
  expect(navigate).not.toHaveBeenCalled()
  expect(windowNavigate).not.toHaveBeenCalled()
  expect(window.location.hash).toBe('#/verify')
})
// Measured in Chromium while booting straight on a private deep link: mounting
// Clerk's hash SignIn hands this signed-out handshake back to the adapter. It is a
// same-origin in-app destination, so the app keeps owning the view: no throw, no
// delegation, no document change.
const clerkHandshake = '/#/?sign_up_force_redirect_url=http%3A%2F%2F127.0.0.1%3A5173%2F%23%2F&sign_in_force_redirect_url=http%3A%2F%2F127.0.0.1%3A5173%2F%23%2F&redirect_url=http%3A%2F%2F127.0.0.1%3A5173%2F%23%2Fapp'
it.each([clerkHandshake, '/#/verify', '/app', '/?redirect_url=https://evil.test/#/', '/a/../#/'])('leaves in-app target %s to the app without delegation', target => {
  window.history.replaceState({ app: 'livefy' }, '', '/#/app')
  const before = window.location.href, state = window.history.state, length = window.history.length
  const navigate = vi.fn(), windowNavigate = vi.fn()
  const navigation = createBrowserNavigation(browserCompletionUrl(before), navigate)
  expect(() => navigation.routerReplace(target, { windowNavigate })).not.toThrow()
  expect(() => navigation.routerPush(target, { windowNavigate })).not.toThrow()
  expect(navigate).not.toHaveBeenCalled()
  expect(windowNavigate).not.toHaveBeenCalled()
  expect(window.location.href).toBe(before)
  expect(window.history.state).toEqual(state)
  expect(window.history.length).toBe(length)
})
// The browser document keeps Clerk's hash routing while in-app routes live in a
// memory router seeded at "/", so a private deep link only reaches the app as `#/app`.
it('boots a private deep link at the private in-app route and frees the hash', () => {
  window.history.replaceState(null, '', '/#/app')
  const router = createAppRouter(createMemoryHistory({ initialEntries: ['/'] }))
  expect(router.state.location.pathname).toBe('/app')
  // The hash stays Clerk's: it returns to the completion step so the access
  // surface can mount again once the app leaves the private route.
  expect(window.location.href).toBe(`${window.location.origin}/#/`)
})
it.each(['', '#/', '#/sign-in/reset-password'])('boots the public route for non-private hash %s', hash => {
  window.history.replaceState(null, '', `/${hash}`)
  const router = createAppRouter(createMemoryHistory({ initialEntries: ['/'] }))
  expect(router.state.location.pathname).toBe('/')
  expect(window.location.hash).toBe(hash)
})
it('rejects a changed document before delegation', () => {
  const navigate = vi.fn(), windowNavigate = vi.fn()
  const navigation = createBrowserNavigation(browserCompletionUrl(window.location.href), navigate)
  window.history.replaceState(null, '', '/other/#/create')
  expect(() => navigation.routerPush('/#/', { windowNavigate })).toThrow('Unsupported browser completion document')
  expect(windowNavigate).not.toHaveBeenCalled()
  expect(navigate).not.toHaveBeenCalled()
})
it.each(['livefy://renderer/', 'file:///index.html', 'https://user:pass@example.test/'])('rejects non-browser document %s', url => {
  expect(() => browserCompletionUrl(url)).toThrow()
})
it('preserves served document path and strips query and auth steps', () => {
  expect(browserCompletionUrl('https://example.test/preview/?redirect_url=bad#/verify')).toBe('https://example.test/preview/#/')
})
