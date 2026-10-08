import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createMemoryHistory, RouterProvider } from '@tanstack/react-router'
const state = vi.hoisted(() => ({ isLoading: false, isAuthenticated: false, isRefreshing: false }))
const authHook = vi.hoisted(() => vi.fn())
const listeners = vi.hoisted(() => new Set<() => void>())
vi.mock('convex/react', async () => {
  const { useReducer, useEffect } = await import('react')
  return { useConvexAuth: () => {
    authHook()
    const [, update] = useReducer(value => value + 1, 0)
    useEffect(() => { listeners.add(update); return () => { listeners.delete(update) } }, [])
    return state
  } }
})
beforeEach(() => { vi.spyOn(window, 'scrollTo').mockImplementation(() => {}) })
vi.mock('./lib/sign-in', () => ({ useSignInAdapter: () => ({ fetching: false, persistence: async () => 'encrypted' }) }))
vi.mock('./sign-in', () => ({ SignIn: () => <p>Sign-in form</p> }))
vi.mock('./registration', () => ({ Registration: () => <p>Registration form</p> }))
import { AuthConfiguration } from './lib/auth'
import { createAppRouter } from './routes'
afterEach(() => {
  cleanup(); vi.clearAllMocks(); vi.restoreAllMocks()
  Object.assign(state, { isLoading: false, isAuthenticated: false, isRefreshing: false })
})
function setup(path: string, configured = true) {
  const router = createAppRouter(createMemoryHistory({ initialEntries: [path] }))
  const view = render(<AuthConfiguration configured={configured}><RouterProvider router={router} /></AuthConfiguration>)
  return { router, ...view }
}
it('rejects anonymous direct navigation and provides a public return', async () => {
  const { router } = setup('/app')
  expect(await screen.findByText('Authentication required')).toBeTruthy()
  expect(screen.queryByRole('heading', { name: 'Livefy app' })).toBeNull()
  fireEvent.click(screen.getByRole('link', { name: 'Return to access' }))
  expect(await screen.findByRole('heading', { name: 'Livefy' })).toBeTruthy()
  expect(router.state.location.pathname).toBe('/')
})
it.each(['loading', 'refresh', 'unavailable'] as const)('blocks composed private route when %s', async mode => {
  Object.assign(state, { isAuthenticated: true, isLoading: mode === 'loading', isRefreshing: mode === 'refresh' })
  setup('/app', mode !== 'unavailable')
  expect(await screen.findByText(mode === 'unavailable' ? 'Authentication unavailable' : 'Checking backend access')).toBeTruthy()
  expect(screen.queryByRole('heading', { name: 'Livefy app' })).toBeNull()
  if (mode === 'unavailable') expect(authHook).not.toHaveBeenCalled()
})
it('allows confirmed public navigation and removes private content on auth loss', async () => {
  state.isAuthenticated = true
  const { router } = setup('/')
  fireEvent.click(await screen.findByRole('button', { name: 'Open app' }))
  expect(await screen.findByRole('heading', { name: 'Livefy app' })).toBeTruthy()
  expect(router.state.location.pathname).toBe('/app')
  act(() => {
    state.isAuthenticated = false
    listeners.forEach(update => update())
  })
  expect(await screen.findByText('Authentication required')).toBeTruthy()
  expect(screen.queryByRole('heading', { name: 'Livefy app' })).toBeNull()
})
it('does not offer navigation before backend confirmation', async () => {
  setup('/')
  expect(await screen.findByText('Sign-in form')).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Open app' })).toBeNull()
})
