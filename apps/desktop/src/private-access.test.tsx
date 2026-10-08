import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { useEffect } from 'react'
const state = vi.hoisted(() => ({ configured: true, isLoading: false, isAuthenticated: false, isRefreshing: false }))
const authHook = vi.hoisted(() => vi.fn())
vi.mock('convex/react', () => ({ useConvexAuth: () => { authHook(); return state } }))
vi.mock('./lib/auth', () => ({ useAuthConfigured: () => state.configured }))
import { PrivateAccess } from './private-access'
afterEach(() => {
  cleanup(); vi.clearAllMocks()
  Object.assign(state, { configured: true, isLoading: false, isAuthenticated: false, isRefreshing: false })
})
it.each([
  { isLoading: true, isAuthenticated: false, isRefreshing: false },
  { isLoading: true, isAuthenticated: true, isRefreshing: false },
  { isLoading: false, isAuthenticated: true, isRefreshing: true },
  { isLoading: false, isAuthenticated: false, isRefreshing: false },
])('never mounts children in rejected state %j', value => {
  Object.assign(state, value)
  const mounted = vi.fn()
  function Child() { useEffect(mounted, []); return <p>Private child</p> }
  render(<PrivateAccess><Child /></PrivateAccess>)
  expect(mounted).not.toHaveBeenCalled()
  expect(screen.queryByText('Private child')).toBeNull()
})
it('never calls the Convex hook when configuration is unavailable', () => {
  state.configured = false
  render(<PrivateAccess>Private child</PrivateAccess>)
  expect(authHook).not.toHaveBeenCalled()
  expect(screen.queryByText('Private child')).toBeNull()
})
it('unmounts confirmed content on refresh or authentication loss', () => {
  state.isAuthenticated = true
  const unmount = vi.fn()
  function Child() { useEffect(() => unmount, []); return <p>Private child</p> }
  const view = render(<PrivateAccess><Child /></PrivateAccess>)
  expect(screen.getByText('Private child')).toBeTruthy()
  state.isRefreshing = true
  view.rerender(<PrivateAccess><Child /></PrivateAccess>)
  expect(unmount).toHaveBeenCalledTimes(1)
  expect(screen.queryByText('Private child')).toBeNull()
  state.isRefreshing = false
  view.rerender(<PrivateAccess><Child /></PrivateAccess>)
  state.isAuthenticated = false
  view.rerender(<PrivateAccess><Child /></PrivateAccess>)
  expect(unmount).toHaveBeenCalledTimes(2)
  expect(screen.queryByText('Private child')).toBeNull()
})
