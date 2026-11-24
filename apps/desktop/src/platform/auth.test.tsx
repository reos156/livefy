import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
const calls = vi.hoisted(() => ({ native: vi.fn(), browser: vi.fn() }))
vi.mock('@clerk/electron/react', () => ({ useAuth: calls.native }))
vi.mock('@clerk/react', () => ({ useAuth: calls.browser }))
vi.mock('./electron/auth', () => ({ AuthBoundary: () => <p>Native provider</p> }))
vi.mock('./web/auth', () => ({ AuthBoundary: () => <p>Browser provider</p>, BrowserAuthUi: () => <p>Browser pending</p> }))
vi.mock('./electron/auth-ui', () => ({ ElectronAuthUi: () => <p>Native UI</p> }))
import { AuthBoundary, AuthUi, useAuth } from './auth'
function Hook() { useAuth(); return null }
afterEach(() => { cleanup(); delete window.livefySession; vi.clearAllMocks() })
it.each([false, true])('pairs provider, hook and UI for native=%s using bridge presence', native => {
  if (native) window.livefySession = { logout: vi.fn(), persistence: vi.fn() }
  render(<><AuthBoundary>Routes</AuthBoundary><Hook /><AuthUi /></>)
  expect(screen.getByText(native ? 'Native provider' : 'Browser provider')).toBeTruthy()
  expect(screen.getByText(native ? 'Native UI' : 'Browser pending')).toBeTruthy()
  expect(native ? calls.native : calls.browser).toHaveBeenCalledOnce()
  expect(native ? calls.browser : calls.native).not.toHaveBeenCalled()
})
