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
  // Announced only: visually hidden, while the shared shell and brand stay on screen.
  expect(status.classList.contains('sr-only')).toBe(true)
  expect(screen.getByRole('heading', { level: 1, name: 'Livefy' })).toBeTruthy()
  // The wait is signalled by motion on the existing mark, not by text.
  const mark = screen.getByRole('heading', { level: 1, name: 'Livefy' }).closest('header')?.querySelector('[aria-hidden="true"]')
  expect(mark?.classList.contains('brand-loader')).toBe(true)
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
  expect(screen.getByRole('heading', { level: 1, name: 'Livefy' })).toBeTruthy()
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
  expect(screen.getByText(/Email and password access is not available yet/)).toBeTruthy()
  expect((screen.getByRole('button', { name: 'Sign in — coming soon' }) as HTMLButtonElement).disabled).toBe(true)
  expect(screen.queryByTestId('embedded-auth')).toBeNull()
})
