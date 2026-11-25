import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, render, screen, act } from '@testing-library/react'
const state = vi.hoisted(() => ({ configured: false, isLoading: false, isAuthenticated: false, isRefreshing: false, isLoaded: true, isSignedIn: false, native: true, instanceSession: false }))
// Counts reads of the browser-only instance view, so a native render can prove it never asks.
const seam = vi.hoisted(() => ({ reads: 0 }))
vi.mock('convex/react', () => ({ useConvexAuth: () => state }))
vi.mock('./lib/auth', () => ({ useAuthConfigured: () => state.configured }))
vi.mock('./platform/auth', () => ({ useAuth: () => state, isNativePlatform: () => state.native,
  AuthUi: () => <div data-testid="embedded-auth">Official authentication</div> }))
vi.mock('./platform/web/auth', () => ({ useInstanceSession: () => { seam.reads += 1; return state.instanceSession } }))
// Eligibility seam only; platform component contracts are tested separately.
import { AccessLanding } from './access'
afterEach(() => {
  cleanup(); delete window.livefySession; vi.clearAllMocks(); seam.reads = 0
  Object.assign(state, { configured: false, isLoading: false, isAuthenticated: false, isRefreshing: false, isLoaded: true, isSignedIn: false, native: true, instanceSession: false })
})
// The wait is the ring alone on the shared shell: announced by one hidden live region, with no
// heading, brand mark or card to pair it with.
function expectRing() {
  const status = screen.getByRole('status')
  expect(status.textContent).toBe('Loading')
  expect(status.classList.contains('sr-only')).toBe(true)
  expect(screen.getAllByRole('status')).toHaveLength(1)
  const ring = screen.getByTitle('Loading...').closest('svg')
  expect(ring).not.toBeNull()
  expect(ring?.getAttribute('viewBox')).toBe('0 0 44 44')
  expect(ring?.getAttribute('height')).toBe('28')
  expect(screen.queryByRole('heading')).toBeNull()
  const main = screen.getByRole('main')
  expect(main.classList.contains('visual-shell')).toBe(true)
  expect(main.querySelector('.visual-mark')).toBeNull()
  expect(main.querySelector('[data-slot="card"]')).toBeNull()
  expect(main.querySelector('.brand-loader, .brand-dots')).toBeNull()
}
// The intermediate screen is gone: nothing announced, nothing clickable, no way out offered here.
function expectNoControls() {
  expect(screen.queryByText('Backend access confirmed')).toBeNull()
  expect(screen.queryByRole('button')).toBeNull()
}
it.each([true, false])('uses a neutral backend transition without granting controls (native=%s)', native => {
  const enter = vi.fn()
  Object.assign(state, { native, configured: true, isSignedIn: true, isAuthenticated: true, isRefreshing: true })
  render(<AccessLanding onEnterApp={enter} />)
  expectRing()
  expectNoControls()
  expect(screen.queryByTestId('embedded-auth')).toBeNull()
  // A refresh is still checking: it keeps the ring and never enters on the way.
  expect(enter).not.toHaveBeenCalled()
})
it('enters the app once per mount and paints only the ring while it does', () => {
  Object.assign(state, { configured: true, isAuthenticated: true })
  const enter = vi.fn()
  const view = render(<AccessLanding onEnterApp={enter} />)
  // Confirmed access enters by itself, with no click and nothing else painted.
  expect(enter).toHaveBeenCalledOnce()
  expectRing()
  expectNoControls()
  // Re-renders carry a fresh callback from the router every pass: the per-mount lock is what
  // keeps them from asking the memory router for a second navigation.
  for (let pass = 0; pass < 3; pass++) view.rerender(<AccessLanding onEnterApp={enter} />)
  expect(enter).toHaveBeenCalledOnce()
})
it('paints the ring alone when confirmed access has no entry callback to honour', () => {
  Object.assign(state, { configured: true, isAuthenticated: true })
  render(<AccessLanding />)
  // No dead button replaces the deleted one: the confirmed landing offers nothing at all.
  expectRing()
  expectNoControls()
})
it('embeds authentication by default without technical diagnostics or persistence', () => {
  state.configured = true
  render(<AccessLanding />)
  expect(screen.getByTestId('embedded-auth')).toBeTruthy()
  // A settled screen, not a wait: the shell keeps the brand mark and the title.
  expect(screen.getByRole('heading', { level: 1, name: 'Livefy' })).toBeTruthy()
  expect(screen.getByText('L').getAttribute('aria-hidden')).toBe('true')
  expect(screen.queryByRole('status')).toBeNull()
  expect(screen.queryByRole('separator')).toBeNull()
  expect(screen.queryByText(/persistence|No authenticated session/)).toBeNull()
  expect(screen.queryByRole('button')).toBeNull()
})
it.each([
  { isLoaded: false },
  { isSignedIn: true },
  { isLoading: true },
  { isRefreshing: true, isAuthenticated: true },
])('does not embed or enter while guarded: %j', guarded => {
  const enter = vi.fn()
  Object.assign(state, { configured: true }, guarded)
  render(<AccessLanding onEnterApp={enter} />)
  expectRing()
  expectNoControls()
  expect(screen.queryByTestId('embedded-auth')).toBeNull()
  // Guarded is never confirmed: the ring grants nothing and no entry fires.
  expect(enter).not.toHaveBeenCalled()
})
it('keeps the waiting surface while an instance session exists but Convex has not confirmed it', () => {
  // Measured after the reset's document reload: ring, then a flash of the sign-in surface,
  // then the app. Convex settles unauthenticated before it authenticates the session the
  // booted document already holds, and Clerk reports that same session as signed out while
  // it is still activating, so unconfirmed must not be read as signed out.
  Object.assign(state, { native: false, configured: true, isLoaded: true, isSignedIn: false, isAuthenticated: false,
    isLoading: false, isRefreshing: false, instanceSession: true })
  const enter = vi.fn()
  const view = render(<AccessLanding onEnterApp={enter} />)
  expectRing()
  expect(screen.queryByTestId('embedded-auth')).toBeNull()
  // The browser landing does ask the instance; that is what holds the ring here.
  expect(seam.reads).toBeGreaterThan(0)
  // Fail closed is untouched: the ring enters nothing while Convex stays silent.
  expect(enter).not.toHaveBeenCalled()
  // Convex confirming the very same session is the only thing that moves the landing on, and
  // it moves on by itself without painting anything but the ring.
  state.isAuthenticated = true
  view.rerender(<AccessLanding onEnterApp={enter} />)
  expect(screen.queryByTestId('embedded-auth')).toBeNull()
  expect(enter).toHaveBeenCalledOnce()
  expectRing()
  expectNoControls()
})
it('renders the sign-in surface promptly when the instance holds no session and Convex settles unauthenticated', () => {
  // No new delay: with no session on the instance there is nothing to hold the ring for.
  Object.assign(state, { native: false, configured: true, isLoaded: true, isSignedIn: false, instanceSession: false,
    isAuthenticated: false, isLoading: false, isRefreshing: false })
  render(<AccessLanding />)
  expect(screen.getByTestId('embedded-auth')).toBeTruthy()
  expect(screen.queryByTitle('Loading...')).toBeNull()
  expect(screen.queryByRole('status')).toBeNull()
  expect(screen.getByRole('heading', { level: 1, name: 'Livefy' })).toBeTruthy()
})
it('leaves the native gate exactly as it was when a session is observed without confirmation', () => {
  // The native shell builds its own Clerk in process, so its session is already present when
  // the resource boots and this shape does not arise there. The browser-only observation must
  // therefore never reach the native decision: same surface as before the change.
  Object.assign(state, { native: true, configured: true, isLoaded: true, isSignedIn: false, instanceSession: true,
    isAuthenticated: false, isLoading: false, isRefreshing: false })
  const enter = vi.fn()
  render(<AccessLanding onEnterApp={enter} />)
  expect(screen.getByTestId('embedded-auth')).toBeTruthy()
  expect(screen.queryByTitle('Loading...')).toBeNull()
  expect(enter).not.toHaveBeenCalled()
  // Provably unreachable on native: the browser-only instance read is never consulted, so the
  // accepted native gate cannot depend on it even when a session is observed without confirmation.
  expect(seam.reads).toBe(0)
})
it('waits for backend confirmation after Clerk sign-in and keeps refresh authoritative', () => {
  state.configured = true
  const enter = vi.fn()
  const view = render(<AccessLanding onEnterApp={enter} />)
  state.isSignedIn = true
  view.rerender(<AccessLanding onEnterApp={enter} />)
  expect(screen.queryByTestId('embedded-auth')).toBeNull()
  expectRing()
  expect(enter).not.toHaveBeenCalled()
  // The provider confirming the session is what enters, and it enters without a click.
  state.isAuthenticated = true
  view.rerender(<AccessLanding onEnterApp={enter} />)
  expect(enter).toHaveBeenCalledOnce()
  // A later refresh neither re-enters nor paints a second surface.
  state.isRefreshing = true
  view.rerender(<AccessLanding onEnterApp={enter} />)
  expect(enter).toHaveBeenCalledOnce()
  expectRing()
  expectNoControls()
  expect(screen.queryByTestId('embedded-auth')).toBeNull()
})
it('keeps browser restoration backend-gated', async () => {
  // The browser boots with the session its reset created: Clerk reports it signed out while it
  // activates, so only Convex confirming it enters the app.
  Object.assign(state, { native: false, configured: true, isSignedIn: true })
  const enter = vi.fn()
  const persistence = vi.fn().mockResolvedValue('encrypted')
  window.livefySession = { persistence, logout: vi.fn() }
  const view = render(<AccessLanding onEnterApp={enter} />)
  expectRing()
  expect(enter).not.toHaveBeenCalled()
  state.isAuthenticated = true
  state.isRefreshing = true
  view.rerender(<AccessLanding onEnterApp={enter} />)
  expectRing()
  expect(enter).not.toHaveBeenCalled()
  state.isRefreshing = false
  view.rerender(<AccessLanding onEnterApp={enter} />)
  await act(async () => {})
  expect(enter).toHaveBeenCalledOnce()
  // The native-only persistence read belongs to no surface here.
  expect(persistence).not.toHaveBeenCalled()
})
it('explains unavailable access without mounting authentication', () => {
  render(<AccessLanding />)
  expect(screen.getByRole('heading', { name: 'Livefy' })).toBeTruthy()
  expect(screen.getByText('L').getAttribute('aria-hidden')).toBe('true')
  expect(screen.getByText(/Email and password access is not available yet/)).toBeTruthy()
  expect((screen.getByRole('button', { name: 'Sign in — coming soon' }) as HTMLButtonElement).disabled).toBe(true)
  expect(screen.queryByTestId('embedded-auth')).toBeNull()
})
it.each([true, false])('never grants private access to a provider-revoked session (native=%s)', async native => {
  Object.assign(state, { native, configured: true, isLoaded: true, isSignedIn: true, isAuthenticated: false, isRefreshing: false })
  const persistence = vi.fn().mockResolvedValue('memory-only')
  window.livefySession = { persistence, logout: vi.fn() }
  const enter = vi.fn()
  const view = render(<AccessLanding onEnterApp={enter} />)
  await act(async () => {})
  // Fail closed: the revoked session keeps the announced wait and grants nothing.
  expectRing()
  expectNoControls()
  expect(screen.queryByTestId('embedded-auth')).toBeNull()
  // A resolved persistence mode is never disclosed without confirmed access.
  expect(screen.queryByText(/persistence|encryption|restart|memory-only/i)).toBeNull()
  expect(enter).not.toHaveBeenCalled()
  // Differential: the same gate enters only after the provider authenticates the session.
  state.isAuthenticated = true
  view.rerender(<AccessLanding onEnterApp={enter} />)
  expect(enter).toHaveBeenCalledOnce()
})