import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ client: vi.fn(), clerk: vi.fn(), convex: vi.fn() }))
vi.mock('@clerk/electron/react', () => ({
  ClerkProvider: (props: { children: React.ReactNode }) => { mocks.clerk(props); return props.children },
  useAuth: () => ({}),
  useSignIn: () => ({ signIn: {}, fetchStatus: 'idle' }),
}))
vi.mock('convex/react', () => ({ ConvexReactClient: class { constructor(url: string) { mocks.client(url) } } }))
vi.mock('convex/react-clerk', () => ({ ConvexProviderWithClerk: (props: { children: React.ReactNode }) => { mocks.convex(props); return props.children } }))
import { AuthBoundary, validEndpoint } from './auth'
afterEach(cleanup)
const endpoint = 'https://polite-parrot-887.convex.cloud'
const publishableKey = `pk_test_${btoa('organic-snake-7233.clerk.accounts.dev$')}`
describe('safe native auth configuration', () => {
  it.each([undefined, '', 'not a URL', 'http://polite-parrot-887.convex.cloud', 'https://evil.test'])('rejects endpoint %s', endpoint => {
    expect(validEndpoint(endpoint)).toBe(false)
    render(<AuthBoundary endpoint={endpoint}><div>Preview</div></AuthBoundary>)
    expect(screen.getByRole('status').textContent).toContain('unavailable')
  })
  it('does not construct providers without a verified-host publishable key', () => {
    render(<AuthBoundary endpoint={endpoint} publishableKey="pk_test_invalid">Preview</AuthBoundary>)
    expect(screen.getByRole('status').textContent).toContain('unavailable')
    expect(mocks.client).not.toHaveBeenCalled()
  })
  it('composes Clerk outside Convex and reuses a singleton client', () => {
    const props = { endpoint, publishableKey }
    const view = render(<AuthBoundary {...props}>Preview</AuthBoundary>)
    view.rerender(<AuthBoundary {...props}>Preview again</AuthBoundary>)
    expect(mocks.client).toHaveBeenCalledTimes(1)
    expect(mocks.clerk).toHaveBeenCalled()
    expect(mocks.convex.mock.calls[0][0].useAuth).toBeTypeOf('function')
    expect(mocks.convex.mock.calls[0][0].client).toBe(mocks.convex.mock.calls[1][0].client)
  })
})
