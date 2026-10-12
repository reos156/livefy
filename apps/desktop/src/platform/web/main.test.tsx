import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { createContext, useContext, type ComponentProps } from 'react'
import type { ClerkProvider } from '@clerk/react'
type ProviderProps = ComponentProps<typeof ClerkProvider>
let providerProps: ProviderProps
const clerk = { loaded: true, session: {} as object | null, signOut: (...args: unknown[]) => state.signOut(...args) }
import { createMemoryHistory, Outlet, RouterProvider } from '@tanstack/react-router'
const state = vi.hoisted(() => ({ signedIn: true, confirmed: true, navigated: false, refreshed: false, signOut: vi.fn() }))
vi.mock('@clerk/react', () => ({
  ClerkProvider: (props: ProviderProps) => { providerProps = props; return props.children },
  useAuth: () => useContext(AuthState),
  useClerk: () => clerk,
}))
vi.mock('../../platform/auth', () => ({
  isNativePlatform: () => false,
  useAuth: () => useContext(AuthState),
  AuthUi: () => <p>Public sign-in</p>,
}))
vi.mock('convex/react', () => ({ ConvexReactClient: class {}, useConvexAuth: () => useContext(AuthState) }))
vi.mock('convex/react-clerk', () => ({ ConvexProviderWithClerk: ({ children }: { children: React.ReactNode }) => children }))
import { AuthBoundary } from './auth'
import { SessionContent, SessionInfrastructure } from '../../lib/session'
import { createAppRouter } from '../../routes'
import { createBrowserNavigation, browserCompletionUrl } from './auth-ui'
const AuthState = createContext({ isLoaded: true, isSignedIn: true, isLoading: false, isRefreshing: false, isAuthenticated: true })
const props = { endpoint: 'https://polite-parrot-887.convex.cloud', publishableKey: `pk_test_${btoa('organic-snake-7233.clerk.accounts.dev$')}` }
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.clearAllMocks()
  Object.assign(state, { signedIn: true, confirmed: true, navigated: false, refreshed: false })
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
  const tree = () => <AuthState.Provider value={{
    isLoaded: true, isSignedIn: state.signedIn,
    isLoading: false, isRefreshing: false, isAuthenticated: state.confirmed,
  }}>
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
