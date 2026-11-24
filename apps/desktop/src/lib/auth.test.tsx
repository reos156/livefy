import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { ConvexProviderWithAuth } from 'convex/react'
import { PrivateAccess } from '../private-access'
import { AuthConfiguration, useAuthConfigured } from './auth'
afterEach(cleanup)
it('requires real Convex provider confirmation and blocks rejected-token refresh', () => {
  let confirm!: (authenticated: boolean) => void
  let refresh!: (refreshing: boolean) => void
  const client = {
    setAuth: (_fetch: unknown, onChange: typeof confirm, onRefresh?: typeof refresh) => {
      confirm = onChange; refresh = onRefresh!
    },
    clearAuth: vi.fn(),
  }
  const fetchAccessToken = async () => 'mock-token'
  const useAuth = () => ({ isLoading: false, isAuthenticated: true, fetchAccessToken })
  render(<AuthConfiguration configured>
    <ConvexProviderWithAuth client={client} useAuth={useAuth}>
      <PrivateAccess>Private child</PrivateAccess>
    </ConvexProviderWithAuth>
  </AuthConfiguration>)
  expect(screen.getByText('Checking backend access')).toBeTruthy()
  expect(screen.queryByText('Private child')).toBeNull()
  act(() => confirm(true))
  expect(screen.getByText('Private child')).toBeTruthy()
  act(() => refresh(true))
  expect(screen.queryByText('Private child')).toBeNull()
  expect(screen.getByText('Checking backend access')).toBeTruthy()
  act(() => { refresh(false); confirm(false) })
  expect(screen.getByText('Authentication required')).toBeTruthy()
  expect(screen.queryByText('Private child')).toBeNull()
})
function Configuration() { return <p>{String(useAuthConfigured())}</p> }
it('defaults to unavailable without a provider', () => {
  render(<Configuration />)
  expect(screen.getByText('false')).toBeTruthy()
})
it('tracks the enclosing configuration and fails closed when it is lost', () => {
  const view = render(<AuthConfiguration configured><Configuration /></AuthConfiguration>)
  expect(screen.getByText('true')).toBeTruthy()
  view.rerender(<AuthConfiguration configured={false}><Configuration /></AuthConfiguration>)
  expect(screen.getByText('false')).toBeTruthy()
})
