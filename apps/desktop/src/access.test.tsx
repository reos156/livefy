import { afterEach, expect, it, vi } from 'vitest'
const state = vi.hoisted(() => ({ configured: false, isLoading: false, isAuthenticated: false }))
vi.mock('convex/react', () => ({ useConvexAuth: () => state }))
vi.mock('./lib/auth', () => ({
  useAuthConfigured: () => state.configured,
  AuthBoundary: ({ children }: { children: React.ReactNode }) => children,
}))
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { AccessLanding } from './access'
import { AuthBoundary } from './lib/auth'

afterEach(() => { cleanup(); state.configured = false })

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

it.each([
  [true, false, 'Checking backend access'],
  [false, false, 'No authenticated session confirmed'],
  [false, true, 'Backend access confirmed'],
] as const)('uses only backend-confirmed access state', (isLoading, isAuthenticated, text) => {
  Object.assign(state, { configured: true, isLoading, isAuthenticated })
  render(<AccessLanding />)
  expect(screen.getByText(text)).toBeTruthy()
  expect(screen.queryByRole('textbox')).toBeNull()
})
