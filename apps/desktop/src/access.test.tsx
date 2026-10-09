import { afterEach, expect, it, vi } from 'vitest'
vi.mock('./registration', () => ({ Registration: ({ onPendingChange }: any) => <label>Registration email<input aria-label="Registration email" onChange={() => onPendingChange(true)} /></label> }))
vi.mock('./sign-in', () => ({ SignIn: ({ onPendingChange }: any) => <label>Sign-in email<input aria-label="Sign-in email" onChange={() => onPendingChange(true)} /></label> }))
vi.mock('./lib/sign-in', () => ({ useSignInAdapter: () => ({ fetching: false, persistence: async () => 'encrypted' }) }))
const state = vi.hoisted(() => ({ configured: false, isLoading: false, isAuthenticated: false, isRefreshing: false }))
vi.mock('convex/react', () => ({ useConvexAuth: () => state }))
vi.mock('./lib/auth', () => ({
  useAuthConfigured: () => state.configured,
}))
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { AccessLanding } from './access'
import { SessionBoundary } from './lib/session'

it('offers local logout on backend-confirmed access', () => {
  Object.assign(state, { configured: true, isAuthenticated: true })
  const logout = vi.fn(() => new Promise<void>(() => {}))
  render(<SessionBoundary logout={logout}><AccessLanding /></SessionBoundary>)
  fireEvent.click(screen.getByRole('button', { name: 'Sign out' }))
  expect(logout).toHaveBeenCalledOnce()
  expect(screen.queryByText('Backend access confirmed')).toBeNull()
})

afterEach(() => { cleanup(); Object.assign(state, { configured: false, isLoading: false, isAuthenticated: false, isRefreshing: false }) })

it('explains unavailable access and never offers working authentication', () => {
  render(<AccessLanding />)
  expect(screen.getByRole('heading', { name: 'Livefy' })).toBeTruthy()
  expect(screen.getByText(/Email and password access is not available yet/)).toBeTruthy()
  const button = screen.getByRole('button', { name: 'Sign in — coming soon' }) as HTMLButtonElement
  expect(button.disabled).toBe(true)
  fireEvent.click(button)
  expect(screen.queryByRole('textbox')).toBeNull()
  expect(screen.queryByText(/signed in|dashboard/i)).toBeNull()
})

it('blocks access while a previously confirmed token is being replaced', () => {
  Object.assign(state, { configured: true, isAuthenticated: true, isRefreshing: true })
  render(<AccessLanding />)
  expect(screen.getByText('Checking backend access')).toBeTruthy()
  expect(screen.queryByText('Backend access confirmed')).toBeNull()
  expect(screen.queryByRole('textbox')).toBeNull()
})

it('switches exclusive forms and excludes switching immediately while pending', () => {
  state.configured = true
  render(<AccessLanding />)
  expect(screen.getByLabelText('Sign-in email')).toBeTruthy()
  expect(screen.queryByLabelText('Registration email')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Create an account' }))
  expect(screen.queryByLabelText('Sign-in email')).toBeNull()
  const switchButton = screen.getByRole('button', { name: 'Use an existing account' })
  fireEvent.change(screen.getByLabelText('Registration email'), { target: { value: 'x' } })
  fireEvent.click(switchButton)
  expect(screen.getByLabelText('Registration email')).toBeTruthy()
  expect(switchButton).toHaveProperty('disabled', true)
})

it.each([
  [true, false, 'Checking backend access'],
  [false, false, 'No authenticated session confirmed'],
  [false, true, 'Backend access confirmed'],
] as const)('uses only backend-confirmed access state', (isLoading, isAuthenticated, text) => {
  Object.assign(state, { configured: true, isLoading, isAuthenticated })
  render(<AccessLanding />)
  expect(screen.getByText(text)).toBeTruthy()
  expect(Boolean(screen.queryByRole('textbox'))).toBe(!isAuthenticated && !isLoading)
})

it('composes a polite status and divider only before the selected unauthenticated form', () => {
  state.configured = true
  const view = render(<AccessLanding />)
  const status = screen.getByRole('status')
  expect(status.getAttribute('data-slot')).toBe('alert')
  expect(status.querySelector('[data-slot="alert-description"]')?.textContent).toBe('No authenticated session confirmed')
  expect(screen.queryByRole('alert')).toBeNull()
  const separator = screen.getByRole('separator')
  expect(separator.getAttribute('data-slot')).toBe('separator')
  expect(separator.nextElementSibling?.contains(screen.getByLabelText('Sign-in email'))).toBe(true)
  fireEvent.click(screen.getByRole('button', { name: 'Create an account' }))
  expect(screen.getAllByRole('separator')).toHaveLength(1)
  expect(separator.nextElementSibling?.contains(screen.getByLabelText('Registration email'))).toBe(true)
  state.isLoading = true
  view.rerender(<AccessLanding />)
  expect(screen.queryByRole('separator')).toBeNull()
  state.isLoading = false; state.isAuthenticated = true
  view.rerender(<AccessLanding />)
  expect(screen.queryByRole('separator')).toBeNull()
  state.configured = false
  view.rerender(<AccessLanding />)
  expect(screen.queryByRole('separator')).toBeNull()
})
