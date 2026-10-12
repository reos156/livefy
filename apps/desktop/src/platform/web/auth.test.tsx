import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ provider: vi.fn(), convex: vi.fn(), signOut: vi.fn(), signedIn: true }))
vi.mock('@clerk/react', () => ({
  ClerkProvider: (props: { children: React.ReactNode }) => { mocks.provider(props); return props.children },
  useAuth: () => ({ isLoaded: true, isSignedIn: mocks.signedIn }),
  useClerk: () => ({ signOut: mocks.signOut }),
}))
vi.mock('convex/react', () => ({ ConvexReactClient: class {} }))
vi.mock('convex/react-clerk', () => ({ ConvexProviderWithClerk: (props: { children: React.ReactNode }) => { mocks.convex(props); return props.children } }))
import { useAuth } from '@clerk/react'
import { AuthBoundary } from './auth'
import { createBrowserNavigation, browserCompletionUrl } from './auth-ui'
import { LogoutButton } from '../../lib/session'
const props = { endpoint: 'https://polite-parrot-887.convex.cloud', publishableKey: `pk_test_${btoa('organic-snake-7233.clerk.accounts.dev$')}` }
afterEach(() => { cleanup(); vi.clearAllMocks(); mocks.signedIn = true; delete window.livefySession; window.history.replaceState(null, '', '/') })
it('completes SDK sign-out navigation after deleting the session and permits re-login', async () => {
  window.history.replaceState(null, '', '/preview/#/verify')
  const returned = vi.fn()
  const navigation = createBrowserNavigation(browserCompletionUrl(window.location.href), vi.fn())
  mocks.signOut.mockImplementationOnce(async (options?: { redirectUrl?: string }) => {
    // clerk-js removes sessions before navigate; default after-sign-out target is /.
    mocks.signedIn = false
    const target = new URL(options?.redirectUrl || '/', window.location.href)
    await navigation.routerPush(target.pathname + target.search + target.hash)
  })
  const view = render(<AuthBoundary {...props} modalNavigation={navigation} onSignedOut={returned}><p>Route content</p><LogoutButton /></AuthBoundary>)
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Sign out' })))
  view.rerender(<AuthBoundary {...props} modalNavigation={navigation}><p>Public route</p></AuthBoundary>)
  expect(screen.queryByRole('alert')).toBeNull()
  expect(returned).toHaveBeenCalledOnce()
  expect(screen.getByText('Public route')).toBeTruthy()
  expect(window.location.href).toBe(`${window.location.origin}/preview/#/`)
  mocks.signedIn = true
  view.rerender(<AuthBoundary {...props} modalNavigation={navigation}><p>Re-login route</p></AuthBoundary>)
  expect(screen.getByText('Re-login route')).toBeTruthy()
})
it('pairs browser provider and Convex browser hook', () => {
  render(<AuthBoundary {...props}>Content</AuthBoundary>)
  expect(mocks.provider).toHaveBeenCalledOnce()
  expect(mocks.provider.mock.lastCall?.[0]).toMatchObject({
    signInForceRedirectUrl: `${window.location.origin}/#/`,
    signUpForceRedirectUrl: `${window.location.origin}/#/`,
    allowedRedirectOrigins: [window.location.origin], allowedRedirectProtocols: ['http:', 'https:'],
  })
  expect(mocks.convex.mock.lastCall?.[0].useAuth).toBe(useAuth)
})
it('rejects missing configuration without constructing providers', () => {
  render(<AuthBoundary>Public</AuthBoundary>)
  expect(screen.getByRole('status').textContent).toContain('unavailable')
  expect(mocks.provider).not.toHaveBeenCalled()
  expect(mocks.convex).not.toHaveBeenCalled()
})
it('excludes private consumers immediately, retries safely and waits for signed-out state before public return', async () => {
  let finish!: () => void
  const publicReturn = vi.fn()
  mocks.signOut.mockRejectedValueOnce(new Error('secret')).mockImplementationOnce(() => new Promise<void>(resolve => { finish = resolve }))
  const nativeLogout = vi.fn(), persistence = vi.fn()
  window.livefySession = { logout: nativeLogout, persistence }
  const view = render(<AuthBoundary {...props} onSignedOut={publicReturn}><p>Route content</p><LogoutButton /></AuthBoundary>)
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Sign out' })))
  expect(screen.queryByText('Route content')).toBeNull()
  expect(screen.getByRole('alert').textContent).toContain('Private access remains blocked')
  expect(screen.queryByText(/Relaunch|restart exclusion|secret/)).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Retry sign-out' }))
  expect(screen.queryByText('Route content')).toBeNull()
  await act(async () => finish())
  expect(publicReturn).toHaveBeenCalledOnce()
  expect(screen.queryByText('Route content')).toBeNull()
  mocks.signedIn = false
  view.rerender(<AuthBoundary {...props} onSignedOut={publicReturn}><p>Public route</p><LogoutButton /></AuthBoundary>)
  expect(screen.getByText('Public route')).toBeTruthy()
  mocks.signedIn = true
  view.rerender(<AuthBoundary {...props} onSignedOut={publicReturn}><p>New session route</p><LogoutButton /></AuthBoundary>)
  expect(screen.getByText('New session route')).toBeTruthy()
  expect(nativeLogout).not.toHaveBeenCalled()
  expect(persistence).not.toHaveBeenCalled()
})
