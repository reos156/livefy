import { cleanup, render, screen, fireEvent, act } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useEffect } from 'react'
const mocks = vi.hoisted(() => ({ client: vi.fn(), clerk: vi.fn(), convex: vi.fn(), resource: vi.fn(), unmount: vi.fn() }))
vi.mock('@clerk/electron/react', () => ({
  ClerkProvider: (props: { children: React.ReactNode }) => {
    useEffect(() => () => mocks.unmount(), [])
    mocks.clerk(props); return props.children
  },
  useClerk: () => mocks.resource(),
  useAuth: () => ({}),
  useSignIn: () => ({ signIn: {}, fetchStatus: 'idle' }),
  useSignUp: () => ({ signUp: { status: 'missing_requirements' }, fetchStatus: 'idle' }),
}))
vi.mock('convex/react', () => ({
  ConvexReactClient: class { constructor(url: string) { mocks.client(url) } },
  useConvexAuth: () => ({ isLoading: false, isAuthenticated: false }),
}))
vi.mock('convex/react-clerk', () => ({ ConvexProviderWithClerk: (props: { children: React.ReactNode }) => { mocks.convex(props); return props.children } }))
import { AuthBoundary, validEndpoint } from './auth'
import { useAuthConfigured } from '../../lib/auth'
import { useRegistrationAdapter } from '../../lib/registration'
import { useSignInAdapter } from '../../lib/sign-in'
import { LogoutButton } from '../../lib/session'
afterEach(() => { cleanup(); delete window.livefySession })
beforeEach(() => { mocks.resource.mockReturnValue({ client: null }); mocks.unmount.mockClear() })
const endpoint = 'https://polite-parrot-887.convex.cloud'
const publishableKey = `pk_test_${btoa('organic-snake-7233.clerk.accounts.dev$')}`
function Configuration() { return <p>{String(useAuthConfigured())}</p> }
describe('safe native auth configuration', () => {
  it.each([undefined, '', 'not a URL', 'http://polite-parrot-887.convex.cloud', 'https://evil.test'])('rejects endpoint %s', endpoint => {
    expect(validEndpoint(endpoint)).toBe(false)
    render(<AuthBoundary endpoint={endpoint}><Configuration /></AuthBoundary>)
    expect(screen.getByRole('status').textContent).toContain('unavailable')
    expect(screen.getByText('false')).toBeTruthy()
  })
  it('does not construct providers without a verified-host publishable key', () => {
    render(<AuthBoundary endpoint={endpoint} publishableKey="pk_test_invalid">Preview</AuthBoundary>)
    expect(screen.getByRole('status').textContent).toContain('unavailable')
    expect(mocks.client).not.toHaveBeenCalled()
    expect(mocks.clerk).not.toHaveBeenCalled()
    expect(mocks.convex).not.toHaveBeenCalled()
  })
  it('composes Clerk outside Convex and reuses a singleton client', () => {
    const props = { endpoint, publishableKey }
    const view = render(<AuthBoundary {...props}><Configuration /></AuthBoundary>)
    expect(screen.getByText('true')).toBeTruthy()
    view.rerender(<AuthBoundary {...props}>Preview again</AuthBoundary>)
    expect(mocks.client).toHaveBeenCalledTimes(1)
    expect(mocks.clerk).toHaveBeenCalled()
    expect(mocks.clerk.mock.invocationCallOrder[0]).toBeLessThan(mocks.convex.mock.invocationCallOrder[0])
    expect(mocks.convex.mock.calls[0][0].useAuth).toBeTypeOf('function')
    expect(mocks.convex.mock.calls[0][0].client).toBe(mocks.convex.mock.calls[1][0].client)
    view.rerender(<AuthBoundary><Configuration /></AuthBoundary>)
    expect(screen.getByText('false')).toBeTruthy()
  })
  it('supplies both shared adapters only in the configured native composition', () => {
    function Adapters() {
      const registration = useRegistrationAdapter()
      const login = useSignInAdapter()
      return <p>{String(registration.isAuthenticated)}:{String(login.fetching)}</p>
    }
    render(<AuthBoundary endpoint={endpoint} publishableKey={publishableKey}><Adapters /></AuthBoundary>)
    expect(screen.getByText('false:false')).toBeTruthy()
  })
  it('calls fixed native deletion and removes private consumers when preservation is unavailable', async () => {
    const logout = vi.fn().mockResolvedValue(undefined)
    window.livefySession = { logout, persistence: async () => 'encrypted' }
    render(<AuthBoundary endpoint={endpoint} publishableKey={publishableKey}><Configuration /><LogoutButton /></AuthBoundary>)
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Sign out' })))
    expect(logout).toHaveBeenCalledExactlyOnceWith()
    expect(screen.queryByText('true')).toBeNull()
    expect(screen.getByText('Signed out on this device.')).toBeTruthy()
  })
  it('keeps Clerk mounted while deferred verification excludes private consumers, then preserves', async () => {
    let finish!: () => void
    const client = { id: 'client', sessions: [] as object[], signedInSessions: [] as object[], removeSessions: vi.fn(async () => {}), reload: vi.fn(() => new Promise(resolve => { finish = () => resolve(client) })) }
    const clerk = { client, session: {} as object | null }
    client.sessions = [{ status: 'active' }]
    client.signedInSessions = client.sessions
    mocks.resource.mockReturnValue(clerk)
    const logout = vi.fn(), preserveAndQuit = vi.fn().mockResolvedValue(undefined)
    window.livefySession = { logout, preserveAndQuit, persistence: async () => 'encrypted' }
    render(<AuthBoundary endpoint={endpoint} publishableKey={publishableKey}><Configuration /><LogoutButton /></AuthBoundary>)
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Sign out' })))
    expect(screen.queryByText('true')).toBeNull()
    expect(mocks.unmount).not.toHaveBeenCalled()
    expect(preserveAndQuit).not.toHaveBeenCalled()
    expect(logout).not.toHaveBeenCalled()
    client.sessions = []
    client.signedInSessions = []
    clerk.session = null
    await act(async () => finish())
    expect(client.removeSessions).toHaveBeenCalledExactlyOnceWith()
    expect(client.reload).toHaveBeenCalledExactlyOnceWith()
    expect(preserveAndQuit).toHaveBeenCalledExactlyOnceWith()
    expect(logout).not.toHaveBeenCalled()
    expect(mocks.unmount).not.toHaveBeenCalled()
    expect(mocks.clerk.mock.lastCall?.[0].experimental.rethrowOfflineNetworkErrors).toBe(true)
  })
  it.each(['offline', 'reload-error', 'null-reload', 'active', 'pending', 'selected', 'different-id', 'empty-id', 'stale', 'missing-client', 'missing-capability'])('deletes rather than preserving unconfirmed state: %s', async scenario => {
    const client = { id: 'client', sessions: [] as object[], signedInSessions: [] as object[], removeSessions: vi.fn(async () => {}), reload: vi.fn(async () => client as typeof client | null) }
    const clerk = { client, session: null as object | null }
    if (scenario === 'offline') client.removeSessions.mockRejectedValue(new Error('offline'))
    client.reload.mockImplementation(async () => {
      if (scenario === 'reload-error') throw new Error('offline')
      if (scenario === 'null-reload') return null
      if (scenario === 'active') client.signedInSessions = [{}]
      if (scenario === 'pending') client.sessions = [{ status: 'pending' }]
      if (scenario === 'selected') clerk.session = {}
      if (scenario === 'different-id') client.id = 'other'
      if (scenario === 'stale') {
        client.sessions = [{ status: 'active' }]
        return { ...client, sessions: [] }
      }
      return client
    })
    if (scenario === 'empty-id') client.id = ''
    mocks.resource.mockReturnValue(scenario === 'missing-client' ? { client: null } : clerk)
    const logout = vi.fn().mockResolvedValue(undefined), preserveAndQuit = vi.fn()
    window.livefySession = { logout, persistence: async () => 'encrypted', ...(scenario === 'missing-capability' ? {} : { preserveAndQuit }) }
    render(<AuthBoundary endpoint={endpoint} publishableKey={publishableKey}><LogoutButton /></AuthBoundary>)
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Sign out' })))
    expect(logout).toHaveBeenCalledExactlyOnceWith()
    expect(preserveAndQuit).not.toHaveBeenCalled()
  })
  it('propagates preservation failure without deletion, then retries with deletion after the fence', async () => {
    const client = { id: 'client', sessions: [], signedInSessions: [], removeSessions: vi.fn(async () => {}), reload: vi.fn(async () => client) }
    mocks.resource.mockReturnValue({ client, session: null })
    const logout = vi.fn().mockResolvedValue(undefined), preserveAndQuit = vi.fn().mockRejectedValue(new Error('storage'))
    window.livefySession = { logout, preserveAndQuit, persistence: async () => 'encrypted' }
    render(<AuthBoundary endpoint={endpoint} publishableKey={publishableKey}><LogoutButton /></AuthBoundary>)
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Sign out' })))
    expect(screen.getByRole('alert')).toBeTruthy()
    expect(logout).not.toHaveBeenCalled()
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Retry local sign-out' })))
    expect(logout).toHaveBeenCalledExactlyOnceWith()
    expect(preserveAndQuit).toHaveBeenCalledTimes(1)
    expect(client.removeSessions).toHaveBeenCalledTimes(1)
  })
  it('does not report success if the native bridge is unavailable', async () => {
    render(<AuthBoundary endpoint={endpoint} publishableKey={publishableKey}><Configuration /><LogoutButton /></AuthBoundary>)
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Sign out' })))
    expect(screen.queryByText('true')).toBeNull()
    expect(screen.queryByText('Signed out on this device.')).toBeNull()
    expect(screen.getByRole('alert')).toBeTruthy()
  })
})
