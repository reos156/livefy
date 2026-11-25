import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createMemoryHistory, RouterProvider } from '@tanstack/react-router'
import { readFileSync } from 'node:fs'
vi.mock('./platform/auth', () => ({
  useAuth: () => ({ isLoaded: true, isSignedIn: false }),
  isNativePlatform: () => true,
  AuthUi: () => <p>Official Clerk launchers</p>,
}))
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
  },
  // The private entry reads the operator's shop; an unconfigured shop keeps it on
  // the wizard, which is the screen these route assertions look for.
  useQuery: () => null,
  useMutation: () => async () => null }
})
beforeEach(() => { vi.spyOn(window, 'scrollTo').mockImplementation(() => {}) })
import { AuthConfiguration } from './lib/auth'
import { createAppRouter } from './routes'
afterEach(() => {
  cleanup(); vi.clearAllMocks(); vi.restoreAllMocks()
  Object.assign(state, { isLoading: false, isAuthenticated: false, isRefreshing: false })
})
it('bootstraps memory navigation independently of Clerk hash and reloads publicly', async () => {
  const source = readFileSync('src/main.tsx', 'utf8')
  expect(source).toContain("createMemoryHistory({ initialEntries: ['/'] })")
  expect(source).not.toContain('createHashHistory')
  const hash = window.location.hash
  window.location.hash = '#/sign-in/reset-password'
  const history = createMemoryHistory({ initialEntries: ['/'] })
  history.push('/app')
  expect(window.location.hash).toBe('#/sign-in/reset-password')
  history.back()
  expect(history.location.pathname).toBe('/')
  expect(createMemoryHistory({ initialEntries: ['/'] }).location.pathname).toBe('/')
  window.location.hash = hash
})
function setup(path: string, configured = true) {
  const router = createAppRouter(createMemoryHistory({ initialEntries: [path] }))
  const view = render(<AuthConfiguration configured={configured}><RouterProvider router={router} /></AuthConfiguration>)
  return { router, ...view }
}
it('rejects anonymous direct navigation and provides a public return', async () => {
  const { router } = setup('/app')
  const required = await screen.findByText('Authentication required')
  // A real refusal stays fully visible; only transient waits are announced-only.
  expect(required.closest('.sr-only')).toBeNull()
  expect(screen.queryByRole('heading', { name: 'Configurá tu tienda' })).toBeNull()
  fireEvent.click(screen.getByRole('link', { name: 'Return to access' }))
  expect(await screen.findByRole('heading', { name: 'Livefy' })).toBeTruthy()
  expect(router.state.location.pathname).toBe('/')
})
it.each(['loading', 'refresh', 'unavailable'] as const)('blocks composed private route when %s', async mode => {
  Object.assign(state, { isAuthenticated: true, isLoading: mode === 'loading', isRefreshing: mode === 'refresh' })
  setup('/app', mode !== 'unavailable')
  const status = await screen.findByRole('status')
  if (mode === 'unavailable') {
    expect(await screen.findByText('Authentication unavailable')).toBeTruthy()
    expect(status.closest('.sr-only')).toBeNull()
    // A refusal is explained in text; it is not a silent wait.
    expect(screen.queryByTitle('Loading...')).toBeNull()
    // A refusal keeps the shell, the brand mark and the title.
    expect(await screen.findByRole('heading', { level: 1, name: 'Livefy' })).toBeTruthy()
    expect(screen.getByText('L').getAttribute('aria-hidden')).toBe('true')
  } else {
    expect(status.textContent).toBe('Checking backend access')
    expect(status.classList.contains('sr-only')).toBe(true)
    // The wait paints the ring alone: no title, no brand mark, no card around it.
    expect(screen.queryByRole('heading')).toBeNull()
    expect(screen.queryByText('L')).toBeNull()
    expect(screen.getByRole('main').querySelector('[data-slot="card"]')).toBeNull()
    expect(screen.getByRole('main').classList.contains('visual-shell')).toBe(true)
    // The sr-only status stays the only live region.
    expect(screen.getByTitle('Loading...').closest('svg')).not.toBeNull()
    expect(screen.getAllByRole('status')).toHaveLength(1)
  }
  expect(screen.queryByRole('heading', { name: 'Configurá tu tienda' })).toBeNull()
  if (mode === 'unavailable') expect(authHook).not.toHaveBeenCalled()
})
it('enters the app by itself on a confirmed session and removes private content on auth loss', async () => {
  state.isAuthenticated = true
  const { router } = setup('/')
  // No click and no intermediate screen: the confirmed session lands on the private app.
  expect(await screen.findByRole('heading', { name: 'Configurá tu tienda' })).toBeTruthy()
  expect(router.state.location.pathname).toBe('/app')
  // The way out lives inside the app now that the landing offers nothing.
  expect(await screen.findByRole('button', { name: 'Sign out' })).toBeTruthy()
  act(() => {
    state.isAuthenticated = false
    listeners.forEach(update => update())
  })
  expect(await screen.findByText('Authentication required')).toBeTruthy()
  expect(screen.queryByRole('heading', { name: 'Configurá tu tienda' })).toBeNull()
})
it('does not enter before backend confirmation', async () => {
  const { router } = setup('/')
  expect(await screen.findByText('Official Clerk launchers')).toBeTruthy()
  expect(router.state.location.pathname).toBe('/')
})
