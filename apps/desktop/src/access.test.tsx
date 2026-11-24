import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, act } from '@testing-library/react'
const state = vi.hoisted(() => ({ configured: false, isLoading: false, isAuthenticated: false, isRefreshing: false, isLoaded: true, isSignedIn: false, native: true }))
vi.mock('convex/react', () => ({ useConvexAuth: () => state }))
vi.mock('./lib/auth', () => ({ useAuthConfigured: () => state.configured }))
vi.mock('./platform/auth', () => ({ useAuth: () => state, isNativePlatform: () => state.native,
  AuthUi: () => <div data-testid="embedded-auth">Official authentication</div> }))
// Eligibility seam only; platform component contracts are tested separately.
import { AccessLanding } from './access'
import { SessionBoundary } from './lib/session'
afterEach(() => {
  cleanup(); delete window.livefySession; vi.clearAllMocks()
  Object.assign(state, { configured: false, isLoading: false, isAuthenticated: false, isRefreshing: false, isLoaded: true, isSignedIn: false, native: true })
})
it.each([true, false])('uses a neutral backend transition without granting controls (native=%s)', native => {
  Object.assign(state, { native, configured: true, isSignedIn: true, isAuthenticated: true, isRefreshing: true })
  render(<SessionBoundary logout={async () => {}}><AccessLanding onEnterApp={vi.fn()} /></SessionBoundary>)
  const status = screen.getByRole('status')
  expect(status.textContent).toBe('Loading')
  // Announced only: visually hidden while the ring alone is painted on the shell.
  expect(status.classList.contains('sr-only')).toBe(true)
  // No brand mark, no title and no card around the cue.
  expect(screen.queryByRole('heading')).toBeNull()
  expect(screen.queryByText('L')).toBeNull()
  expect(screen.getByRole('main').querySelector('[data-slot="card"]')).toBeNull()
  expect(screen.getByRole('main').querySelector('.visual-mark')).toBeNull()
  // Centring still comes from the shared shell layout.
  expect(screen.getByRole('main').classList.contains('visual-shell')).toBe(true)
  // The wait is signalled by the ring cue, never by a second live region.
  expect(screen.getAllByRole('status')).toHaveLength(1)
  const ring = screen.getByTitle('Loading...').closest('svg')
  expect(ring).not.toBeNull()
  expect(ring?.getAttribute('viewBox')).toBe('0 0 44 44')
  expect(ring?.getAttribute('height')).toBe('28')
  expect(ring?.classList.contains('text-foreground')).toBe(true)
  expect(screen.getByRole('main').querySelector('.brand-loader, .brand-dots')).toBeNull()
  expect(screen.queryByText('Checking backend access')).toBeNull()
  expect(screen.queryByText('Backend access confirmed')).toBeNull()
  expect(screen.queryByRole('button', { name: 'Open app' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Sign out' })).toBeNull()
  expect(screen.queryByTestId('embedded-auth')).toBeNull()
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
  expect(screen.queryByRole('button', { name: 'Open app' })).toBeNull()
})
it.each([
  { isLoaded: false },
  { isSignedIn: true },
  { isLoading: true },
  { isRefreshing: true, isAuthenticated: true },
])('does not embed or enter while guarded: %j', guarded => {
  Object.assign(state, { configured: true }, guarded)
  render(<AccessLanding onEnterApp={vi.fn()} />)
  const status = screen.getByRole('status')
  expect(status.textContent).toBe('Loading')
  expect(status.classList.contains('sr-only')).toBe(true)
  // The wait paints the ring alone, with no heading and no brand mark to pair it with.
  expect(screen.queryByRole('heading')).toBeNull()
  expect(screen.getByRole('main').querySelector('.visual-mark')).toBeNull()
  // The cue is painted where the wait is, and announced only by the sr-only status.
  expect(screen.getByTitle('Loading...').closest('svg')).not.toBeNull()
  expect(screen.getAllByRole('status')).toHaveLength(1)
  expect(screen.queryByTestId('embedded-auth')).toBeNull()
  expect(screen.queryByRole('button', { name: 'Open app' })).toBeNull()
})
it('waits for backend confirmation after Clerk sign-in and keeps refresh authoritative', () => {
  state.configured = true
  const enter = vi.fn()
  const view = render(<SessionBoundary logout={async () => {}}><AccessLanding onEnterApp={enter} /></SessionBoundary>)
  state.isSignedIn = true
  view.rerender(<SessionBoundary logout={async () => {}}><AccessLanding onEnterApp={enter} /></SessionBoundary>)
  expect(screen.queryByTestId('embedded-auth')).toBeNull()
  expect(screen.queryByRole('button', { name: 'Open app' })).toBeNull()
  state.isAuthenticated = true
  view.rerender(<SessionBoundary logout={async () => {}}><AccessLanding onEnterApp={enter} /></SessionBoundary>)
  fireEvent.click(screen.getByRole('button', { name: 'Open app' }))
  expect(enter).toHaveBeenCalledOnce()
  state.isRefreshing = true
  view.rerender(<AccessLanding onEnterApp={enter} />)
  expect(screen.queryByRole('button', { name: 'Open app' })).toBeNull()
  expect(screen.queryByTestId('embedded-auth')).toBeNull()
})
it.each(['encrypted', 'memory', 'missing', 'rejected'] as const)('reports truthful %s persistence only on confirmed presentation', async mode => {
  Object.assign(state, { configured: true, isAuthenticated: true })
  if (mode !== 'missing') window.livefySession = { persistence: vi.fn(() => mode === 'rejected' ? Promise.reject(new Error('unavailable')) : Promise.resolve(mode === 'memory' ? 'memory-only' as const : 'encrypted' as const)), logout: vi.fn() }
  render(<SessionBoundary logout={async () => {}}><AccessLanding /></SessionBoundary>)
  await act(async () => {})
  expect(screen.getByText(mode === 'encrypted' ? 'Encrypted session persistence' : mode === 'memory' ?
    'Memory-only session: encryption unavailable; session will not survive restart' : 'Session persistence status unavailable')).toBeTruthy()
})
it('offers local logout on backend-confirmed access', () => {
  Object.assign(state, { configured: true, isAuthenticated: true })
  const logout = vi.fn(() => new Promise<void>(() => {}))
  render(<SessionBoundary logout={logout}><AccessLanding /></SessionBoundary>)
  // Confirmed access keeps its visible status and shows no waiting cue.
  expect(screen.queryByTitle('Loading...')).toBeNull()
  expect(screen.getByRole('heading', { level: 1, name: 'Livefy' })).toBeTruthy()
  expect(screen.getByText('L').getAttribute('aria-hidden')).toBe('true')
  fireEvent.click(screen.getByRole('button', { name: 'Sign out' }))
  expect(logout).toHaveBeenCalledOnce()
  expect(screen.queryByText('Backend access confirmed')).toBeNull()
})
it('keeps browser restoration backend-gated and omits native persistence claims', async () => {
  Object.assign(state, { native: false, configured: true, isSignedIn: true })
  const enter = vi.fn()
  const persistence = vi.fn().mockResolvedValue('encrypted')
  window.livefySession = { persistence, logout: vi.fn() }
  const view = render(<AccessLanding onEnterApp={enter} />)
  expect(screen.queryByRole('button', { name: 'Open app' })).toBeNull()
  expect(screen.getByRole('status').classList.contains('sr-only')).toBe(true)
  expect(screen.queryByText(/Waiting for backend access/)).toBeNull()
  state.isAuthenticated = true
  state.isRefreshing = true
  view.rerender(<AccessLanding onEnterApp={enter} />)
  expect(screen.getByRole('status').textContent).toBe('Loading')
  expect(screen.getByRole('status').classList.contains('sr-only')).toBe(true)
  expect(screen.queryByText('Checking backend access')).toBeNull()
  expect(screen.queryByRole('button', { name: 'Open app' })).toBeNull()
  state.isRefreshing = false
  view.rerender(<AccessLanding onEnterApp={enter} />)
  await act(async () => {})
  fireEvent.click(screen.getByRole('button', { name: 'Open app' }))
  expect(enter).toHaveBeenCalledOnce()
  expect(persistence).not.toHaveBeenCalled()
  expect(screen.queryByText(/persistence|encryption|restart/i)).toBeNull()
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
  const view = render(<SessionBoundary logout={async () => {}}><AccessLanding onEnterApp={enter} /></SessionBoundary>)
  await act(async () => {})
  // Fail closed: the revoked session keeps the announced wait and grants nothing.
  expect(screen.getByRole('status').textContent).toBe('Loading')
  expect(screen.getByRole('status').classList.contains('sr-only')).toBe(true)
  expect(screen.queryByText('Backend access confirmed')).toBeNull()
  expect(screen.queryByRole('button', { name: 'Open app' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Sign out' })).toBeNull()
  expect(screen.queryByTestId('embedded-auth')).toBeNull()
  // A resolved persistence mode is never disclosed without confirmed access.
  expect(screen.queryByText(/persistence|encryption|restart|memory-only/i)).toBeNull()
  expect(enter).not.toHaveBeenCalled()
  // Differential: the same gate grants only after the provider authenticates the session.
  state.isAuthenticated = true
  view.rerender(<SessionBoundary logout={async () => {}}><AccessLanding onEnterApp={enter} /></SessionBoundary>)
  fireEvent.click(screen.getByRole('button', { name: 'Open app' }))
  expect(enter).toHaveBeenCalledOnce()
})
it('claims restart survival only for encrypted persistence and discloses memory-only truthfully', async () => {
  Object.assign(state, { native: true, configured: true, isLoaded: true, isSignedIn: true, isAuthenticated: true, isRefreshing: false })
  const claim = {
    encrypted: 'Encrypted session persistence',
    'memory-only': 'Memory-only session: encryption unavailable; session will not survive restart',
  } as const
  for (const mode of ['encrypted', 'memory-only'] as const) {
    window.livefySession = { persistence: vi.fn().mockResolvedValue(mode), logout: vi.fn() }
    const view = render(<SessionBoundary logout={async () => {}}><AccessLanding /></SessionBoundary>)
    await act(async () => {})
    expect(screen.getByText(claim[mode])).toBeTruthy()
    const text = screen.getByRole('main').textContent ?? ''
    if (mode === 'memory-only') {
      // The only survival claim is the negation; no persistence claim is made.
      expect(text).toContain('session will not survive restart')
      expect(text).not.toContain(claim.encrypted)
      expect(text).not.toMatch(/will survive|survives restart|session persists/i)
    } else {
      // Only the encrypted case may claim survival across restart.
      expect(text).not.toContain('will not survive restart')
      expect(text).not.toMatch(/memory-only/i)
    }
    view.unmount()
  }
})
