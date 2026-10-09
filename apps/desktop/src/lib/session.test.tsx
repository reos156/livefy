import { fireEvent, render, screen, act, cleanup } from '@testing-library/react'
import { expect, it, vi, afterEach } from 'vitest'
import { SessionBoundary, LogoutButton } from './session'
afterEach(cleanup)

it('excludes access immediately, excludes duplicates and confirms only native completion', async () => {
  let finish!: () => void
  const logout = vi.fn(() => new Promise<void>(resolve => { finish = resolve }))
  render(<SessionBoundary logout={logout}><p>Private content</p><LogoutButton /></SessionBoundary>)
  const button = screen.getByRole('button', { name: 'Sign out' })
  fireEvent.click(button)
  fireEvent.click(button)
  expect(logout).toHaveBeenCalledTimes(1)
  expect(screen.queryByText('Private content')).toBeNull()
  expect(screen.queryByText('Signed out on this device.')).toBeNull()
  await act(async () => finish())
  expect(screen.getByText('Signed out on this device.')).toBeTruthy()
  expect(screen.getByText(/Remote session revocation is unconfirmed/)).toBeTruthy()
  expect(screen.getByText(/Livefy closes automatically/)).toBeTruthy()
  expect(screen.queryByText(/close Livefy completely/)).toBeNull()
})
it('keeps access excluded on failure and supports a safe deletion retry', async () => {
  const logout = vi.fn().mockRejectedValueOnce(new Error('secret detail')).mockResolvedValue(undefined)
  render(<SessionBoundary logout={logout}><p>Private content</p><LogoutButton /></SessionBoundary>)
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Sign out' })))
  expect(screen.queryByText('Private content')).toBeNull()
  expect(screen.queryByText(/secret detail/)).toBeNull()
  expect(screen.getByRole('alert').textContent).toContain('restart exclusion is not confirmed')
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Retry local sign-out' })))
  expect(screen.getByText('Signed out on this device.')).toBeTruthy()
})
