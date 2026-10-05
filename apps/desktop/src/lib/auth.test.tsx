import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { AuthBoundary, validEndpoint } from './auth'
afterEach(cleanup)
describe('safe auth configuration', () => {
  it.each([undefined, '', 'not a URL', 'http://polite-parrot-887.convex.cloud', 'https://evil.test', 'https://polite-parrot-887.convex.cloud/path'])('rejects %s', endpoint => {
    expect(validEndpoint(endpoint)).toBe(false)
    render(<AuthBoundary endpoint={endpoint}><div>Access preview</div></AuthBoundary>)
    expect(screen.getByText('Access preview')).toBeTruthy()
    expect(screen.getByRole('status').textContent).toContain('unavailable')
  })
  it('accepts only the expected deployment endpoint', () => {
    expect(validEndpoint('https://polite-parrot-887.convex.cloud')).toBe(true)
  })
})
