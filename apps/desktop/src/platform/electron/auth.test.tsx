import { cleanup, render, screen, fireEvent, act } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useEffect } from 'react'
import { createRequire } from 'node:module'
const nodeRequire = createRequire(import.meta.url)
const mocks = vi.hoisted(() => ({ client: vi.fn(), clerk: vi.fn(), convex: vi.fn(), resource: vi.fn(), unmount: vi.fn(), auth: vi.fn(), convexAuth: vi.fn() }))
vi.mock('@clerk/electron/react', () => ({
  ClerkProvider: (props: { children: React.ReactNode }) => {
    useEffect(() => () => mocks.unmount(), [])
    mocks.clerk(props); return props.children
  },
  SignIn: () => null,
  useClerk: () => mocks.resource(),
  useAuth: () => mocks.auth(),
}))
vi.mock('convex/react', () => ({
  ConvexReactClient: class { constructor(url: string) { mocks.client(url) } },
  useConvexAuth: () => mocks.convexAuth(),
}))
vi.mock('convex/react-clerk', () => ({ ConvexProviderWithClerk: (props: { children: React.ReactNode }) => { mocks.convex(props); return props.children } }))
import { AuthBoundary, validEndpoint } from './auth'
import { publicCompletionUrl } from './auth-ui'
import { useAuthConfigured } from '../../lib/auth'
import { LogoutButton } from '../../lib/session'
import { AccessLanding } from '../../access'
afterEach(() => { cleanup(); delete window.livefySession })
beforeEach(() => {
  mocks.resource.mockReturnValue({ client: null })
  mocks.unmount.mockClear()
  mocks.auth.mockReturnValue({})
  mocks.convexAuth.mockReturnValue({ isLoading: false, isAuthenticated: false, isRefreshing: false })
})

// The real token storage stands in for the preload/IPC/main chain: only the IPC hop is simulated.
type NativeStorage = {
  persistence: 'encrypted' | 'memory-only'
  setItem(key: string, value: string): Promise<void>
  getItem(key: string): Promise<string | null>
  logout(): Promise<void>
}
function nativeTokenStorage() {
  type Record = { owner: string; version: 1; ciphertext: string }
  const records = new Map<string, Record>()
  const store = {
    get: (key: string) => records.get(key),
    set: (key: string, value: Record) => { records.set(key, value) },
    delete: (key: string) => { records.delete(key) },
  }
  const safeStorage = {
    isEncryptionAvailable: () => true,
    getSelectedStorageBackend: () => 'dpapi',
    encryptString: (value: string) => Buffer.from(`encrypted:${value}`),
    decryptString: (value: { toString(): string }) => {
      const text = value.toString()
      if (!text.startsWith('encrypted:')) throw new Error('corrupt')
      return text.slice('encrypted:'.length)
    },
  }
  const createTokenStorage = nodeRequire('../../../electron/clerk-storage.cjs').createTokenStorage as (options: {
    store: typeof store; safeStorage: typeof safeStorage
  }) => NativeStorage
  return { records, store, safeStorage, createTokenStorage, storage: createTokenStorage({ store, safeStorage }) }
}
const endpoint = 'https://polite-parrot-887.convex.cloud'
const publishableKey = `pk_test_${btoa('organic-snake-7233.clerk.accounts.dev$')}`
function Configuration() { return <p>{String(useAuthConfigured())}</p> }
describe('safe native auth configuration', () => {
  it('passes paired delegates through one existing provider and cleans modals on logout', async () => {
    const closeSignIn = vi.fn(), closeSignUp = vi.fn()
    mocks.resource.mockReturnValue({ client: null, closeSignIn, closeSignUp })
    const modalNavigation = { routerPush: vi.fn(), routerReplace: vi.fn() }
    window.livefySession = { logout: vi.fn().mockResolvedValue(undefined), persistence: async () => 'encrypted' }
    const previousCalls = mocks.clerk.mock.calls.length
    render(<AuthBoundary endpoint={endpoint} publishableKey={publishableKey} modalNavigation={modalNavigation}><LogoutButton /></AuthBoundary>)
    expect(mocks.clerk.mock.calls.length - previousCalls).toBe(1)
    expect(mocks.clerk.mock.lastCall?.[0].signInUrl).toBe(publicCompletionUrl(window.location.href))
    expect(mocks.clerk.mock.lastCall?.[0].routerPush).toBe(modalNavigation.routerPush)
    expect(mocks.clerk.mock.lastCall?.[0].routerReplace).toBe(modalNavigation.routerReplace)
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Sign out' })))
    expect(closeSignIn).toHaveBeenCalledOnce()
    expect(closeSignUp).toHaveBeenCalledOnce()
  })
  it('does not invent navigation delegates when none are supplied', () => {
    render(<AuthBoundary endpoint={endpoint} publishableKey={publishableKey}>Access</AuthBoundary>)
    expect(mocks.clerk.mock.lastCall?.[0]).not.toHaveProperty('routerPush')
    expect(mocks.clerk.mock.lastCall?.[0]).not.toHaveProperty('routerReplace')
  })
  it.each([undefined, '', 'not a URL', 'http://polite-parrot-887.convex.cloud', 'https://evil.test'])('rejects endpoint %s', endpoint => {
    expect(validEndpoint(endpoint)).toBe(false)
    render(<AuthBoundary endpoint={endpoint}><Configuration /></AuthBoundary>)
    expect(screen.getByRole('status').textContent).toContain('unavailable')
    expect(screen.getByText('false')).toBeTruthy()
  })
  it('does not construct providers without a verified-host publishable key', () => {
    const counts = [mocks.client.mock.calls.length, mocks.clerk.mock.calls.length, mocks.convex.mock.calls.length]
    render(<AuthBoundary endpoint={endpoint} publishableKey="pk_test_invalid">Preview</AuthBoundary>)
    expect(screen.getByRole('status').textContent).toContain('unavailable')
    expect([mocks.client.mock.calls.length, mocks.clerk.mock.calls.length, mocks.convex.mock.calls.length]).toEqual(counts)
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
  it('deletes the local credential offline, removes private access and stays signed out after restart', async () => {
    const { records, store, safeStorage, createTokenStorage, storage } = nativeTokenStorage()
    await storage.setItem('__clerk_client_jwt', 'signed-in-credential')
    // Offline: provider removal rejects, so nothing can confirm remote revocation.
    const client = { id: 'client', sessions: [{ status: 'active' }], signedInSessions: [{ status: 'active' }],
      removeSessions: vi.fn(async () => { throw new Error('offline') }), reload: vi.fn(async () => client) }
    mocks.resource.mockReturnValue({ client, session: {} as object | null })
    mocks.auth.mockReturnValue({ isLoaded: true, isSignedIn: true })
    mocks.convexAuth.mockReturnValue({ isLoading: false, isAuthenticated: true, isRefreshing: false })
    const logout = vi.fn(() => storage.logout()), preserveAndQuit = vi.fn()
    window.livefySession = { logout, preserveAndQuit, persistence: async () => storage.persistence }
    const enter = vi.fn()
    const view = render(<AuthBoundary endpoint={endpoint} publishableKey={publishableKey}><AccessLanding onEnterApp={enter} /><LogoutButton /></AuthBoundary>)
    await act(async () => {})
    // Confirmed access enters the app by itself and paints no landing to click.
    expect(enter).toHaveBeenCalledOnce()
    expect(screen.queryByText('Backend access confirmed')).toBeNull()
    expect(records.size).toBe(1)
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Sign out' })))
    expect(client.removeSessions).toHaveBeenCalledExactlyOnceWith()
    expect(client.reload).not.toHaveBeenCalled()
    expect(preserveAndQuit).not.toHaveBeenCalled()
    // The local credential is gone from disk, not merely fenced in memory.
    expect(logout).toHaveBeenCalledExactlyOnceWith()
    expect(records.size).toBe(0)
    expect(await storage.getItem('__clerk_client_jwt')).toBeNull()
    expect(screen.queryByText('Backend access confirmed')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Open app' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Sign out' })).toBeNull()
    expect(screen.getByText('Signed out on this device.')).toBeTruthy()
    expect(screen.getByText('Remote session revocation is unconfirmed, including when offline.')).toBeTruthy()
    // Restart: a fresh process over the same disk restores no credential and grants nothing.
    expect(await createTokenStorage({ store, safeStorage }).getItem('__clerk_client_jwt')).toBeNull()
    view.unmount()
    mocks.resource.mockReturnValue({ client: { ...client, sessions: [], signedInSessions: [] }, session: null })
    mocks.auth.mockReturnValue({ isLoaded: true, isSignedIn: false })
    mocks.convexAuth.mockReturnValue({ isLoading: false, isAuthenticated: false, isRefreshing: false })
    // Its own spy: the first phase legitimately entered the app once, and what this
    // phase proves is that a fresh process grants nothing.
    const enterAfterRestart = vi.fn()
    render(<AuthBoundary endpoint={endpoint} publishableKey={publishableKey}><AccessLanding onEnterApp={enterAfterRestart} /></AuthBoundary>)
    await act(async () => {})
    expect(screen.queryByText('Backend access confirmed')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Open app' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Sign out' })).toBeNull()
    expect(enterAfterRestart).not.toHaveBeenCalled()
  })
  it('denies private access to a provider-revoked session and grants it only once the provider authenticates', async () => {
    mocks.resource.mockReturnValue({ client: { id: 'client', sessions: [], signedInSessions: [] }, session: {} })
    mocks.auth.mockReturnValue({ isLoaded: true, isSignedIn: true })
    mocks.convexAuth.mockReturnValue({ isLoading: false, isAuthenticated: false, isRefreshing: false })
    const persistence = vi.fn(async () => 'memory-only' as const)
    window.livefySession = { logout: vi.fn(), persistence }
    const enter = vi.fn()
    const view = render(<AuthBoundary endpoint={endpoint} publishableKey={publishableKey}><AccessLanding onEnterApp={enter} /></AuthBoundary>)
    await act(async () => {})
    // A Clerk session alone is never private access: it stays on the announced wait.
    expect(screen.getByRole('status').textContent).toBe('Loading')
    expect(screen.queryByText('Backend access confirmed')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Open app' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Sign out' })).toBeNull()
    // A resolved persistence mode is never disclosed without confirmed access.
    expect(screen.queryByText(/persistence|encryption|restart|memory-only/i)).toBeNull()
    expect(enter).not.toHaveBeenCalled()
    // Differential: the identical composition grants access once the provider authenticates.
    mocks.convexAuth.mockReturnValue({ isLoading: false, isAuthenticated: true, isRefreshing: false })
    view.rerender(<AuthBoundary endpoint={endpoint} publishableKey={publishableKey}><AccessLanding onEnterApp={enter} /></AuthBoundary>)
    await act(async () => {})
    // Entered without a click: the confirmed surface is the ring, not a button.
    expect(enter).toHaveBeenCalledOnce()
    expect(screen.queryByText('Backend access confirmed')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Open app' })).toBeNull()
  })
})
