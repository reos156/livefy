import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ client: vi.fn(), clerk: vi.fn(), convex: vi.fn() }))
vi.mock('@clerk/electron/react', () => ({
  ClerkProvider: (props: { children: React.ReactNode }) => { mocks.clerk(props); return props.children },
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
afterEach(cleanup)
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
})
