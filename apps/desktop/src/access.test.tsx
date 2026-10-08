import { afterEach, expect, it, vi } from 'vitest'
vi.mock('./registration', () => ({ Registration: ({ onPendingChange }: any) => <label>Registration email<input aria-label="Registration email" onChange={() => onPendingChange(true)} /></label> }))
vi.mock('./sign-in', () => ({ SignIn: ({ onPendingChange }: any) => <label>Sign-in email<input aria-label="Sign-in email" onChange={() => onPendingChange(true)} /></label> }))
vi.mock('./lib/sign-in', () => ({ useSignInAdapter: () => ({ fetching: false, persistence: async () => 'encrypted' }) }))
const state = vi.hoisted(() => ({ configured: false, isLoading: false, isAuthenticated: false }))
vi.mock('convex/react', () => ({ useConvexAuth: () => state }))
vi.mock('./lib/auth', () => ({
  useAuthConfigured: () => state.configured,
  AuthBoundary: ({ children }: { children: React.ReactNode }) => children,
}))
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { AccessLanding } from './access'
import { AuthBoundary } from './lib/auth'

afterEach(() => { cleanup(); Object.assign(state, { configured: false, isLoading: false, isAuthenticated: false }) })

it('explains unavailable access and never offers working authentication', () => {
  render(<AuthBoundary><AccessLanding /></AuthBoundary>)
  expect(screen.getByRole('heading', { name: 'Livefy' })).toBeTruthy()
  expect(screen.getByText(/Email and password access is not available yet/)).toBeTruthy()
  const button = screen.getByRole('button', { name: 'Sign in — coming soon' }) as HTMLButtonElement
  expect(button.disabled).toBe(true)
  fireEvent.click(button)
  expect(screen.queryByRole('textbox')).toBeNull()
  expect(screen.queryByText(/signed in|dashboard/i)).toBeNull()
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
