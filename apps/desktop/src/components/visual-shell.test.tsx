import { afterEach, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { VisualShell } from './visual-shell'

afterEach(cleanup)

it('composes Card slots while retaining the main, h1, decorative mark and child controls', () => {
  render(<VisualShell title="Livefy"><button>Continue</button></VisualShell>)
  const main = screen.getByRole('main')
  const heading = screen.getByRole('heading', { level: 1, name: 'Livefy' })
  const button = screen.getByRole('button', { name: 'Continue' })
  expect(main.querySelector('[data-slot="card"]')).not.toBeNull()
  expect(main.querySelector('[data-slot="card-header"]')?.contains(heading)).toBe(true)
  expect(main.querySelector('[data-slot="card-title"]')?.contains(heading)).toBe(true)
  expect(main.querySelector('[data-slot="card-content"].visual-content')?.contains(button)).toBe(true)
  expect(screen.getByText('L').getAttribute('aria-hidden')).toBe('true')
})

it('retains changing titles and child content without introducing extra landmarks', () => {
  const { rerender } = render(<VisualShell title="Checking"><p role="status">Waiting</p></VisualShell>)
  rerender(<VisualShell title="Ended"><button>Retry</button></VisualShell>)
  expect(screen.getAllByRole('main')).toHaveLength(1)
  expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
  expect(screen.getByRole('heading', { name: 'Ended' })).toBeTruthy()
  expect(screen.queryByRole('status')).toBeNull()
  expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy()
})
