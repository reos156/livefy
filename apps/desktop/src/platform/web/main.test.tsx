import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { createContext, Fragment, useContext, useMemo, useSyncExternalStore, type ComponentProps } from 'react'
import type { ClerkProvider } from '@clerk/react'
type ProviderProps = ComponentProps<typeof ClerkProvider>
let providerProps: ProviderProps
const clerk = { loaded: true, session: {} as object | null, signOut: (...args: unknown[]) => state.signOut(...args) }
import { createMemoryHistory, Outlet, RouterProvider } from '@tanstack/react-router'
const state = vi.hoisted(() => ({ signedIn: true, confirmed: true, navigated: false, refreshed: false, staleBinding: false, signOut: vi.fn() }))
type TestBinding = { isLoaded: boolean; isSignedIn: boolean; isAuthenticated: boolean; isLoading: boolean; isRefreshing: boolean }
let providerBinding: TestBinding = { isLoaded: true, isSignedIn: true, isAuthenticated: true, isLoading: false, isRefreshing: false }
// The installed binding is re-initialized only when the document is replaced. The
// harness models the browser's part of a reload here, so no case has to re-render
// the app tree by hand to make a fresh snapshot appear.
const documentModel = vi.hoisted(() => ({ generation: 0, listeners: new Set<() => void>() }))
function subscribeDocument(listener: () => void) {
  documentModel.listeners.add(listener)
  return () => { documentModel.listeners.delete(listener) }
}
function documentGeneration() { return documentModel.generation }
function reloadDocument() {
  documentModel.generation += 1
  for (const listener of [...documentModel.listeners]) listener()
}
vi.mock('@clerk/react', () => ({
  // Measured in Chromium: the stale value lives in the provider context, so the
  // snapshot is taken when the PROVIDER mounts. Remounting a consumer re-reads
  // that same snapshot, no matter how often it is remounted; only a browser reload
  // mounts the provider again with fresh values.
  ClerkProvider: (props: ProviderProps) => {
    providerProps = props
    const generation = useSyncExternalStore(subscribeDocument, documentGeneration)
    providerBinding = useMemo(
      () => ({ ...authState(), isSignedIn: !!clerk.session, isAuthenticated: !!clerk.session }),
      [generation],
    )
    return <Fragment key={generation}>{props.children}</Fragment>
  },
  useAuth: () => state.staleBinding ? providerBinding : useLiveAuth(),
  useClerk: () => clerk,
}))
vi.mock('../../platform/auth', () => ({
  isNativePlatform: () => false,
  useAuth: useLiveAuth,
  AuthUi: () => <p>Public sign-in</p>,
}))
vi.mock('convex/react', () => ({ ConvexReactClient: class {}, useConvexAuth: useLiveAuth }))
vi.mock('convex/react-clerk', () => ({ ConvexProviderWithClerk: ({ children }: { children: React.ReactNode }) => children }))
import { AuthBoundary } from './auth'
import { LogoutButton, SessionContent, SessionInfrastructure } from '../../lib/session'
import { createAppRouter } from '../../routes'
import { createBrowserNavigation, browserCompletionUrl } from './auth-ui'
const authState = () => ({ isLoaded: true, isSignedIn: state.signedIn, isLoading: false, isRefreshing: false, isAuthenticated: state.confirmed })
// Stands in for the auth stores: consumers re-render when the tree re-renders and
// read the live store values, like a working subscription.
const AuthState = createContext(authState())
function useLiveAuth() {
  useContext(AuthState)
  return authState()
}
const props = { endpoint: 'https://polite-parrot-887.convex.cloud', publishableKey: `pk_test_${btoa('organic-snake-7233.clerk.accounts.dev$')}` }
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.clearAllMocks()
  Object.assign(state, { signedIn: true, confirmed: true, navigated: false, refreshed: false, staleBinding: false })
  Object.assign(clerk, { loaded: true, session: {} })
  documentModel.generation = 0
  documentModel.listeners.clear()
  window.history.replaceState(null, '', '/')
})
it.each([
  { path: '/', failFirst: false }, { path: '/app', failFirst: false },
  { path: '/', failFirst: true }, { path: '/app', failFirst: true },
])('finishes SDK navigation with a real router: $path, retry=$failFirst', async ({ path, failFirst }) => {
  const router = createAppRouter(createMemoryHistory({ initialEntries: [path] }))
  router.routeTree.update({ component: () => <SessionContent><Outlet /></SessionContent> })
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  const navigation = createBrowserNavigation(browserCompletionUrl(window.location.href), replace => router.navigate({ to: '/', replace }))
  let remove!: () => void
  const removed = new Promise<void>(resolve => { remove = resolve })
  let attempts = 0
  const windowNavigate = vi.fn()
  state.signOut.mockImplementation(async (options: { redirectUrl: string }) => {
    await removed
    // Installed clerk-js 6.38: removeSessions, await provider navigation, then refresh session.
    clerk.session = null
    await providerProps.routerReplace!(options.redirectUrl, { windowNavigate })
    expect(windowNavigate).toHaveBeenLastCalledWith(browserCompletionUrl(window.location.href))
    state.navigated = true
    if (failFirst && ++attempts === 1) throw new Error('secret sign-out failure')
    state.signedIn = false
    state.confirmed = false
    state.refreshed = true
  })
  const tree = () => <AuthState.Provider value={authState()}>
    <SessionInfrastructure>
      <AuthBoundary {...props} modalNavigation={navigation}
        onSignedOut={() => router.navigate({ to: '/', replace: true })}>
        <RouterProvider router={router} />
      </AuthBoundary>
    </SessionInfrastructure>
  </AuthState.Provider>
  const view = render(tree())
  await screen.findByRole('button', { name: 'Sign out' })
  fireEvent.click(screen.getByRole('button', { name: 'Sign out' }))
  expect(screen.queryByRole('button', { name: 'Open app' })).toBeNull()
  // Nothing is painted between the click and the document reset.
  expect(screen.queryByText('Signing out locally…')).toBeNull()
  expect(screen.queryByRole('heading', { level: 1, name: 'Signing out' })).toBeNull()
  expect(screen.queryByText('Backend access confirmed.')).toBeNull()
  expect(screen.queryByText('Backend access confirmed')).toBeNull()
  await act(async () => remove())
  if (failFirst) {
    await screen.findByRole('button', { name: 'Retry sign-out' })
    expect(screen.queryByText('Backend access confirmed')).toBeNull()
    expect(screen.queryByText('Backend access confirmed.')).toBeNull()
    expect(screen.queryByText(/secret sign-out failure/)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Retry sign-out' }))
  }
  await waitFor(() => expect(state.refreshed).toBe(true))
  expect(state.navigated).toBe(true)
  expect(windowNavigate).toHaveBeenCalledTimes(failFirst ? 2 : 1)
  view.rerender(tree())
  await screen.findByText('Public sign-in')
  expect(router.state.location.pathname).toBe('/')
  state.signedIn = true
  view.rerender(tree())
  expect(screen.queryByRole('button', { name: 'Open app' })).toBeNull()
  state.confirmed = true
  view.rerender(tree())
  await screen.findByRole('button', { name: 'Open app' })
})
it('wires browser completion to public memory navigation, not native navigation', async () => {
  const capturedRender = vi.fn(), navigate = vi.fn(), native = vi.fn(), update = vi.fn()
  vi.doMock('react-dom/client', () => ({ createRoot: () => ({ render: capturedRender }) }))
  vi.doMock('../../routes', () => ({ createAppRouter: () => ({ navigate, routeTree: { update } }) }))
  vi.doMock('../../platform/auth', () => ({ isNativePlatform: () => false, AuthBoundary }))
  vi.doMock('../electron/auth-ui', () => ({ createModalNavigation: native, publicCompletionUrl: native }))
  document.body.innerHTML = '<div id="root"></div>'
  await import('../../main')
  const boundaryProps = capturedRender.mock.lastCall?.[0].props.children.props.children.props
  render(<SessionInfrastructure><AuthBoundary {...boundaryProps} {...props}><p>Boundary mounted</p></AuthBoundary></SessionInfrastructure>)
  const windowNavigate = vi.fn()
  clerk.session = null
  await act(async () => providerProps.routerReplace!(`${window.location.origin}/#/`, { windowNavigate }))
  expect(windowNavigate).toHaveBeenCalledExactlyOnceWith(`${window.location.origin}/#/`)
  expect(navigate).not.toHaveBeenCalled()
  clerk.session = {}
  window.history.replaceState(null, '', '/#/sso-callback')
  await act(async () => providerProps.routerReplace!(`${window.location.origin}/#/`, { windowNavigate }))
  expect(windowNavigate).toHaveBeenCalledTimes(1)
  expect(navigate).toHaveBeenCalledExactlyOnceWith({ to: '/', replace: true })
  expect(window.location.hash).toBe('#/')
  expect(native).not.toHaveBeenCalled()
  expect(update).toHaveBeenCalledOnce()
  await boundaryProps.onSignedOut()
  expect(navigate).toHaveBeenCalledTimes(2)
  vi.doUnmock('react-dom/client')
  vi.doUnmock('../../routes')
  vi.doUnmock('../../platform/auth')
  vi.doUnmock('../electron/auth-ui')
})
// Measured in Chromium against the real dev instance: Clerk.loaded stays true and
// Clerk.session becomes null within 300ms, yet the 6.17.6 React binding keeps the
// value its provider subscribed with, and the Convex client inherits the same stale
// session. The stale snapshot belongs to the provider mount, so nothing inside the
// tree can re-read it: completion therefore normalizes the URL and resets the
// document. This case never re-renders the tree from the outside.
it('resets the document instead of rendering a transient surface when the binding is stale', async () => {
  state.staleBinding = true
  window.history.replaceState(null, '', '/app')
  const router = createAppRouter(createMemoryHistory({ initialEntries: ['/app'] }))
  router.routeTree.update({ component: () => <SessionContent><Outlet /></SessionContent> })
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  const documentUrl = window.location.href
  let remove!: () => void
  const removed = new Promise<void>(resolve => { remove = resolve })
  const windowNavigate = vi.fn()
  state.signOut.mockImplementation(async (options: { redirectUrl: string }) => {
    await removed
    clerk.session = null
    await providerProps.routerReplace!(options.redirectUrl, { windowNavigate })
    state.signedIn = false
    state.confirmed = false
  })
  const tree = () => <AuthState.Provider value={authState()}>
    <SessionInfrastructure>
      <AuthBoundary {...props} modalNavigation={createBrowserNavigation(browserCompletionUrl(window.location.href), replace => router.navigate({ to: '/', replace }))}
        onSignedOut={() => router.navigate({ to: '/', replace: true })}>
        <RouterProvider router={router} />
      </AuthBoundary>
    </SessionInfrastructure>
  </AuthState.Provider>
  render(tree())
  await screen.findByRole('button', { name: 'Sign out' })
  fireEvent.click(screen.getByRole('button', { name: 'Sign out' }))
  await act(async () => remove())
  // The session is gone from the SDK while the binding observed at mount is stale.
  expect(clerk.session).toBeNull()
  expect(windowNavigate).toHaveBeenCalledExactlyOnceWith(browserCompletionUrl(documentUrl))
  expect(window.location.href).toBe(browserCompletionUrl(documentUrl))
  expect(screen.queryByText('Waiting for signed-out session confirmation')).toBeNull()
  expect(screen.queryByRole('heading', { level: 1, name: 'Signed out' })).toBeNull()
  expect(screen.queryByText('Confirming signed-out session.')).toBeNull()
  expect(router.state.location.pathname).toBe('/')
})
// A password reset creates and activates a session, so this is an entry transition.
// Measured in Chromium (same mechanism as the sign-out case above, opposite
// direction): clerk.session becomes a session while the binding keeps serving the
// signed-out value its provider captured at mount. The transition is therefore read
// from the instance, and the document reset it needs is bounded to one per entry.
function entryHarness(path: string) {
  window.history.replaceState(null, '', path)
  const completionUrl = browserCompletionUrl(window.location.href)
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  const replaceState = window.history.replaceState.bind(window.history)
  // The URL write is the observable part of a document reset: an inert or blocked reload
  // has no other effect, and the app has to perform the reset itself.
  return { completionUrl, documentReset: vi.spyOn(window.history, 'replaceState'), replaceState }
}
it('reaches the authenticated surface from the instance after a completed reset, with no external re-render', async () => {
  state.staleBinding = true
  state.signedIn = false
  state.confirmed = false
  clerk.session = null
  const { completionUrl, documentReset, replaceState } = entryHarness('/#/')
  // The browser's part of the reset: the document is replaced, which is the only way
  // the binding and the Convex client are re-initialized. Nothing here re-renders the
  // app tree, and the app itself has to ask for the reset.
  documentReset.mockImplementation((data, title, url) => {
    replaceState(data, title, url)
    if (url !== completionUrl) return
    state.staleBinding = false
    state.signedIn = true
    state.confirmed = true
    reloadDocument()
  })
  const router = createAppRouter(createMemoryHistory({ initialEntries: ['/'] }))
  router.routeTree.update({ component: () => <SessionContent><Outlet /></SessionContent> })
  const windowNavigate = vi.fn()
  render(<AuthState.Provider value={authState()}>
    <SessionInfrastructure>
      <AuthBoundary {...props}
        modalNavigation={createBrowserNavigation(completionUrl, replace => router.navigate({ to: '/', replace }))}>
        <RouterProvider router={router} />
      </AuthBoundary>
    </SessionInfrastructure>
  </AuthState.Provider>)
  // Signed out at mount: the public sign-in surface owns the document.
  await screen.findByText('Public sign-in')
  // The reset completes: the instance gains a session, the bound snapshot does not.
  expect(providerBinding.isSignedIn).toBe(false)
  clerk.session = { id: 'sess_reset' }
  await act(async () => { await providerProps.routerReplace!(completionUrl, { windowNavigate }) })
  // The reset is deferred by one tick so the binding can be re-read before it fires.
  await waitFor(() => expect(documentReset).toHaveBeenCalledTimes(1))
  expect(documentReset).toHaveBeenCalledWith(null, '', completionUrl)
  await screen.findByRole('button', { name: 'Open app' })
  expect(screen.getByText('Backend access confirmed')).toBeTruthy()
  expect(screen.queryByText('Loading')).toBeNull()
  expect(windowNavigate).not.toHaveBeenCalled()
})
// Reproduced by the operator in a real browser: the reset had succeeded, but the session
// was only observable moments after the half-second window the first cut allowed, so the
// flow declared failure and a manual reload then showed the app authenticated. The window
// has to stay open long enough to catch that late-but-real session.
it('resets the document when the activated session only becomes observable after the old half-second window', async () => {
  state.staleBinding = true
  state.signedIn = false
  state.confirmed = false
  clerk.session = null
  const { completionUrl, documentReset, replaceState } = entryHarness('/#/')
  documentReset.mockImplementation((data, title, url) => {
    replaceState(data, title, url)
    if (url !== completionUrl) return
    state.staleBinding = false
    state.signedIn = true
    state.confirmed = true
    reloadDocument()
  })
  const router = createAppRouter(createMemoryHistory({ initialEntries: ['/'] }))
  router.routeTree.update({ component: () => <SessionContent><Outlet /></SessionContent> })
  const windowNavigate = vi.fn()
  render(<AuthState.Provider value={authState()}>
    <SessionInfrastructure>
      <AuthBoundary {...props}
        modalNavigation={createBrowserNavigation(completionUrl, replace => router.navigate({ to: '/', replace }))}>
        <RouterProvider router={router} />
      </AuthBoundary>
    </SessionInfrastructure>
  </AuthState.Provider>)
  await screen.findByText('Public sign-in')
  await act(async () => { await providerProps.routerReplace!(completionUrl, { windowNavigate }) })
  // Past the old window with neither source reporting the session yet: the observation is
  // still open, so nothing may be declared a failure and nothing may be reset twice.
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 700)) })
  expect(documentReset).not.toHaveBeenCalled()
  expect(screen.queryByRole('alert')).toBeNull()
  // The activation lands inside the window: the single reset happens as soon as it is visible.
  clerk.session = { id: 'sess_late' }
  await waitFor(() => expect(documentReset).toHaveBeenCalledTimes(1), { timeout: 2000 })
  expect(documentReset).toHaveBeenCalledWith(null, '', completionUrl)
  await screen.findByRole('button', { name: 'Open app' })
  expect(screen.getByText('Backend access confirmed')).toBeTruthy()
  expect(screen.queryByText(/Password reset incomplete/)).toBeNull()
  // The navigation adapter's no-session fallback is unchanged and unrelated: the caller handed
  // control back before the session existed, so it asks the window to complete the document.
  expect(windowNavigate).toHaveBeenCalledExactlyOnceWith(completionUrl)
})
// A sign-in or OAuth return hands control back through the same callback as a reset, and
// clerk-js awaits that callback before it emits the new session, so the binding necessarily
// still reports signed-out at that moment. Unlike the reset case it converges on its own a
// tick later, so neither a document reset nor a failure surface belongs there.
it('lets a binding that converges on the next tick finish the transition without a document reset', async () => {
  state.staleBinding = true
  state.signedIn = false
  state.confirmed = false
  clerk.session = null
  const { completionUrl, documentReset } = entryHarness('/#/')
  const router = createAppRouter(createMemoryHistory({ initialEntries: ['/'] }))
  router.routeTree.update({ component: () => <SessionContent><Outlet /></SessionContent> })
  const windowNavigate = vi.fn()
  const tree = () => <AuthState.Provider value={authState()}>
    <SessionInfrastructure>
      <AuthBoundary {...props}
        modalNavigation={createBrowserNavigation(completionUrl, replace => router.navigate({ to: '/', replace }))}>
        <RouterProvider router={router} />
      </AuthBoundary>
    </SessionInfrastructure>
  </AuthState.Provider>
  const view = render(tree())
  await screen.findByText('Public sign-in')
  // The instance already holds the new session while the bound snapshot still says signed-out.
  clerk.session = { id: 'sess_signin' }
  await act(async () => { await providerProps.routerReplace!(completionUrl, { windowNavigate }) })
  // One tick later the provider publishes that session to its consumers: the normal
  // transition, which needs no repair from this component.
  state.staleBinding = false
  state.signedIn = true
  state.confirmed = true
  view.rerender(tree())
  // The whole settle window passes with no document reset and no failure surface.
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 300)) })
  expect(documentReset).not.toHaveBeenCalled()
  expect(screen.queryByText(/Password reset incomplete/)).toBeNull()
  expect(screen.queryByText('Public sign-in')).toBeNull()
  await screen.findByRole('button', { name: 'Open app' })
  expect(screen.getByText('Backend access confirmed')).toBeTruthy()
  expect(windowNavigate).not.toHaveBeenCalled()
})
it('resets the document once per entry transition while the instance keeps reporting the session', async () => {
  state.staleBinding = true
  state.signedIn = false
  state.confirmed = false
  clerk.session = null
  const { completionUrl, documentReset } = entryHarness('/#/')
  const navigate = vi.fn(), windowNavigate = vi.fn()
  render(<AuthState.Provider value={authState()}>
    <SessionInfrastructure>
      <AuthBoundary {...props} modalNavigation={createBrowserNavigation(completionUrl, navigate)}>
        <p>Access landing</p>
      </AuthBoundary>
    </SessionInfrastructure>
  </AuthState.Provider>)
  await screen.findByText('Access landing')
  clerk.session = { id: 'sess_reset' }
  for (let attempt = 0; attempt < 3; attempt++) {
    await act(async () => { await providerProps.routerReplace!(completionUrl, { windowNavigate }) })
  }
  // The instance kept reporting the same session and the bound snapshot stayed stale:
  // the transition still owns exactly one document reset, so it cannot become a loop.
  expect(providerBinding.isSignedIn).toBe(false)
  await waitFor(() => expect(documentReset).toHaveBeenCalledTimes(1))
  expect(documentReset).toHaveBeenCalledWith(null, '', completionUrl)
  expect(navigate).toHaveBeenCalledTimes(3)
  expect(windowNavigate).not.toHaveBeenCalled()
})
// Measured by the operator twice (L6): after a completed reset the session exists and
// persists -- their own "Return to sign in" reload came up authenticated -- while the
// in-document providers never observe it, which fits clerk-js `setActive` awaiting the
// completion navigation this adapter intercepts. So an expired window is not a failure and
// not a timing problem: the recovery is the single bounded document reset itself, exactly the
// action the removed failure card's button performed. No card, no copy, no resume button.
it('performs the single bounded document reset when the window expires with no session observable', async () => {
  state.staleBinding = true
  state.signedIn = false
  state.confirmed = false
  clerk.session = null
  const { completionUrl, documentReset } = entryHarness('/#/')
  const router = createAppRouter(createMemoryHistory({ initialEntries: ['/'] }))
  router.routeTree.update({ component: () => <SessionContent><Outlet /></SessionContent> })
  const windowNavigate = vi.fn()
  render(<AuthState.Provider value={authState()}>
    <SessionInfrastructure>
      <AuthBoundary {...props}
        modalNavigation={createBrowserNavigation(completionUrl, replace => router.navigate({ to: '/', replace }))}>
        <RouterProvider router={router} />
      </AuthBoundary>
    </SessionInfrastructure>
  </AuthState.Provider>)
  await screen.findByText('Public sign-in')
  // The completed attempt hands control back with no session on either source, and none
  // ever becomes observable in this document.
  await act(async () => { await providerProps.routerReplace!(completionUrl, { windowNavigate }) })
  expect(windowNavigate).toHaveBeenCalledExactlyOnceWith(completionUrl)
  // The window expires: the app resets its own document instead of declaring failure.
  await waitFor(() => expect(documentReset).toHaveBeenCalledTimes(1), { timeout: 4000 })
  expect(documentReset).toHaveBeenCalledWith(null, '', completionUrl)
  // The failure surface is gone with its copy and its resume button.
  expect(screen.queryByRole('alert')).toBeNull()
  expect(screen.queryByText(/Password reset incomplete/)).toBeNull()
  expect(screen.queryByRole('button', { name: 'Return to sign in' })).toBeNull()
  // S3 holds on this path too: the expired window is one transition, so it owns one reset
  // and the settle loop stops instead of re-arming another window.
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 300)) })
  expect(documentReset).toHaveBeenCalledTimes(1)
  await act(async () => { await providerProps.routerReplace!(completionUrl, { windowNavigate }) })
  expect(documentReset).toHaveBeenCalledTimes(1)
  expect(screen.queryByRole('alert')).toBeNull()
})
it('keeps private content hidden and renders no placeholder while Clerk still reports a session', async () => {
  state.staleBinding = true
  window.history.replaceState(null, '', '/app')
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  let remove!: () => void
  const removed = new Promise<void>(resolve => { remove = resolve })
  state.signOut.mockImplementation(async (options: { redirectUrl: string }) => {
    await removed
    await providerProps.routerReplace!(options.redirectUrl)
  })
  render(<AuthState.Provider value={authState()}>
    <SessionInfrastructure>
      <AuthBoundary {...props} modalNavigation={createBrowserNavigation(browserCompletionUrl(window.location.href), vi.fn())} onSignedOut={vi.fn()}>
        <SessionContent><p>Private route content</p><LogoutButton /></SessionContent>
      </AuthBoundary>
    </SessionInfrastructure>
  </AuthState.Provider>)
  await screen.findByRole('button', { name: 'Sign out' })
  fireEvent.click(screen.getByRole('button', { name: 'Sign out' }))
  await act(async () => remove())
  // Nothing to show while the session is unconfirmed: no private content, no jargon.
  expect(screen.queryByText('Private route content')).toBeNull()
  expect(screen.queryByText('Waiting for signed-out session confirmation')).toBeNull()
  expect(screen.queryByText('Confirming signed-out session.')).toBeNull()
  expect(screen.queryByRole('heading', { level: 1, name: 'Signed out' })).toBeNull()
})
