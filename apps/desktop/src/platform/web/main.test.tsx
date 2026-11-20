import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { createContext, useContext, useRef, type ComponentProps } from 'react'
import type { ClerkProvider } from '@clerk/react'
type ProviderProps = ComponentProps<typeof ClerkProvider>
let providerProps: ProviderProps
const clerk = { loaded: true, session: {} as object | null, signOut: (...args: unknown[]) => state.signOut(...args) }
import { createMemoryHistory, Outlet, RouterProvider } from '@tanstack/react-router'
const state = vi.hoisted(() => ({ signedIn: true, confirmed: true, navigated: false, refreshed: false, staleBinding: false, signOut: vi.fn() }))
type TestBinding = { isLoaded: boolean; isSignedIn: boolean; isAuthenticated: boolean; isLoading: boolean; isRefreshing: boolean }
let providerBinding: TestBinding = { isLoaded: true, isSignedIn: true, isAuthenticated: true, isLoading: false, isRefreshing: false }
vi.mock('@clerk/react', () => ({
  // Measured in Chromium: the stale value lives in the provider context, so the
  // snapshot is taken when the PROVIDER mounts. Remounting a consumer re-reads
  // that same snapshot, no matter how often it is remounted.
  ClerkProvider: (props: ProviderProps) => {
    providerProps = props
    const bound = useRef<TestBinding | null>(null)
    if (!bound.current) bound.current = { ...authState(), isSignedIn: !!clerk.session, isAuthenticated: !!clerk.session }
    providerBinding = bound.current
    return props.children
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
