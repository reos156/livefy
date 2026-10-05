import { afterEach, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { AccessLanding } from './access'

afterEach(cleanup)

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
