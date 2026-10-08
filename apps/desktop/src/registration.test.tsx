import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
const mocks = vi.hoisted(() => ({ signup: {} as any, auth: { isLoading: false, isAuthenticated: false } }))
vi.mock('@clerk/electron/react', () => ({ useSignUp: () => ({ signUp: mocks.signup, errors: {}, fetchStatus: 'idle' }) }))
vi.mock('convex/react', () => ({ useConvexAuth: () => mocks.auth }))
import { Registration } from './registration'
const ok = () => Promise.resolve({ error: null })
beforeEach(() => {
  mocks.signup = { status: 'missing_requirements', missingFields: [], unverifiedFields: ['email_address'],
    isTransferable: false, existingSession: undefined, password: vi.fn(ok), reset: vi.fn(ok), finalize: vi.fn(ok),
    verifications: { sendEmailCode: vi.fn(ok), verifyEmailCode: vi.fn(ok) } }
  Object.assign(mocks.auth, { isLoading: false, isAuthenticated: false })
})
afterEach(cleanup)
it('reports pending synchronously and retains it through finalization', async () => {
  const pending = vi.fn()
  let resolve!: (value: any) => void
  mocks.signup.status = 'complete'; mocks.signup.unverifiedFields = []
  mocks.signup.finalize.mockImplementation(() => new Promise(r => { resolve = r }))
  render(<Registration onPendingChange={pending} />)
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'person@example.com' } })
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'valid-password' } })
  fireEvent.submit(screen.getByLabelText('Email').closest('form')!)
  expect(pending).toHaveBeenLastCalledWith(true)
  await act(async () => {})
  expect(pending).toHaveBeenLastCalledWith(true)
  await act(async () => resolve({ error: null }))
  expect(pending).toHaveBeenLastCalledWith(false)
})
function start() {
  render(<Registration />)
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'person@example.com' } })
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'a-long-password-123' } })
  fireEvent.click(screen.getByRole('button', { name: 'Register' }))
}
async function verification() { start(); await screen.findByLabelText('Email code') }
function verify() {
  fireEvent.change(screen.getByLabelText('Email code'), { target: { value: '123456' } })
  fireEvent.click(screen.getByRole('button', { name: 'Verify email' }))
}
it('rejects seven characters locally with controlled minimum copy', async () => {
  render(<Registration />)
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'person@example.com' } })
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'Ab1!xyz' } })
  fireEvent.submit(screen.getByLabelText('Password').closest('form')!)
  expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'Use a password with at least 8 characters.')
  expect(mocks.signup.password).not.toHaveBeenCalled()
})
it('forwards exactly eight characters unchanged and advertises the matching HTML minimum', async () => {
  render(<Registration />)
  const password = screen.getByLabelText('Password')
  expect(password.getAttribute('minlength')).toBe('8')
  expect(screen.getByText('Use at least 8 characters.')).toBeTruthy()
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'person@example.com' } })
  fireEvent.change(password, { target: { value: ' Ab1!xy ' } })
  fireEvent.submit(password.closest('form')!)
  await screen.findByLabelText('Email code')
  expect(mocks.signup.password).toHaveBeenCalledWith({ emailAddress: 'person@example.com', password: ' Ab1!xy ' })
})
it('does not bypass a returned provider rejection for an eight-character weak password', async () => {
  mocks.signup.password.mockResolvedValue({ error: { code: 'form_password_not_strong_enough', message: 'SECRET 12345678' } })
  render(<Registration />)
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'person@example.com' } })
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: '12345678' } })
  fireEvent.submit(screen.getByLabelText('Password').closest('form')!)
  expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'Unable to complete this step. Please try again.')
  expect(mocks.signup.password).toHaveBeenCalledWith({ emailAddress: 'person@example.com', password: '12345678' })
  expect(mocks.signup.verifications.sendEmailCode).not.toHaveBeenCalled()
  expect(mocks.signup.finalize).not.toHaveBeenCalled()
})
it('uses controlled copy for a returned provider minimum-length rejection', async () => {
  mocks.signup.password.mockResolvedValue({ error: { code: 'form_password_length_too_short', message: 'SECRET' } })
  start()
  expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'Use a password with at least 8 characters.')
  expect(mocks.signup.finalize).not.toHaveBeenCalled()
})
it('uses the signal password API and sends required verification', async () => {
  await verification()
  expect(mocks.signup.password).toHaveBeenCalledWith({ emailAddress: 'person@example.com', password: 'a-long-password-123' })
  expect(mocks.signup.verifications.sendEmailCode).toHaveBeenCalledTimes(1)
  expect(mocks.signup.finalize).not.toHaveBeenCalled()
  expect(document.getElementById('clerk-captcha')).toBeTruthy()
})
it.each(['returned', 'thrown'])('redacts %s provider failures', async mode => {
  const error = { errors: [{ code: 'unknown', message: 'SECRET person@example.com a-long-password-123' }] }
  mocks.signup.password.mockImplementation(() => mode === 'returned' ? Promise.resolve({ error }) : Promise.reject(error))
  start(); await screen.findByRole('alert')
  expect(screen.getByRole('alert').textContent).not.toMatch(/SECRET|person@|a-long-password/)
  expect(mocks.signup.finalize).not.toHaveBeenCalled()
})
it('excludes same-tick duplicate submissions', async () => {
  let resolve!: (value: any) => void
  mocks.signup.password.mockImplementation(() => new Promise(r => { resolve = r }))
  start()
  const form = screen.getByLabelText('Email').closest('form')!
  act(() => { fireEvent.submit(form); fireEvent.submit(form) })
  expect(mocks.signup.password).toHaveBeenCalledTimes(1)
  await act(async () => resolve({ error: null }))
})
it('retries failed sending without recreating an account', async () => {
  mocks.signup.verifications.sendEmailCode.mockResolvedValueOnce({ error: { code: 'unknown' } })
  start(); await screen.findByRole('alert')
  fireEvent.click(screen.getByRole('button', { name: 'Send email code' }))
  await screen.findByLabelText('Email code')
  expect(mocks.signup.password).toHaveBeenCalledTimes(1)
  expect(mocks.signup.verifications.sendEmailCode).toHaveBeenCalledTimes(2)
})
it.each(['form_code_incorrect', 'verification_expired'])('handles %s safely and allows retry', async code => {
  await verification()
  mocks.signup.verifications.verifyEmailCode.mockResolvedValueOnce({ error: { code } })
  verify(); await screen.findByRole('alert')
  expect(mocks.signup.finalize).not.toHaveBeenCalled()
  verify(); await waitFor(() => expect(mocks.signup.verifications.verifyEmailCode).toHaveBeenCalledTimes(2))
})
it('excludes resend and verification while a resend is pending', async () => {
  await verification()
  let resolve!: (value: any) => void
  mocks.signup.verifications.sendEmailCode.mockImplementation(() => new Promise(r => { resolve = r }))
  fireEvent.click(screen.getByRole('button', { name: 'Resend code' }))
  const form = screen.getByLabelText('Email code').closest('form')!
  act(() => { fireEvent.submit(form); fireEvent.click(screen.getByRole('button', { name: 'Resend code' })) })
  expect(mocks.signup.verifications.verifyEmailCode).not.toHaveBeenCalled()
  expect(mocks.signup.verifications.sendEmailCode).toHaveBeenCalledTimes(2)
  await act(async () => resolve({ error: null }))
})
it.each(['username', 'phone_number', 'legal_accepted'])('fails closed for unsupported requirement %s', async field => {
  mocks.signup.missingFields = [field]
  start(); await screen.findByRole('alert')
  expect(mocks.signup.finalize).not.toHaveBeenCalled()
  expect(mocks.signup.verifications.sendEmailCode).not.toHaveBeenCalled()
})
it('never finalizes incomplete verification', async () => {
  await verification(); verify(); await screen.findByRole('alert')
  expect(mocks.signup.finalize).not.toHaveBeenCalled()
})
it('finalizes complete signup once without claiming backend access', async () => {
  await verification()
  mocks.signup.verifications.verifyEmailCode.mockImplementation(async () => {
    Object.assign(mocks.signup, { status: 'complete', unverifiedFields: [] }); return { error: null }
  })
  verify(); await screen.findByText(/Registration completed; waiting for backend/)
  expect(mocks.signup.finalize).toHaveBeenCalledTimes(1)
  expect(screen.queryByText(/Session confirmed/)).toBeNull()
})
it('retries finalize failure without recreating or reverifying', async () => {
  Object.assign(mocks.signup, { status: 'complete', unverifiedFields: [] })
  mocks.signup.finalize.mockRejectedValueOnce(new Error('SECRET'))
  start(); await screen.findByRole('alert')
  fireEvent.click(screen.getByRole('button', { name: 'Finish registration' }))
  await screen.findByText(/Registration completed; waiting for backend/)
  expect(mocks.signup.password).toHaveBeenCalledTimes(1)
  expect(mocks.signup.finalize).toHaveBeenCalledTimes(2)
})
it.each(['transfer', 'session', 'identifier'])('informs only for existing account %s', async kind => {
  if (kind === 'transfer') mocks.signup.isTransferable = true
  if (kind === 'session') mocks.signup.existingSession = { sessionId: 'private' }
  if (kind === 'identifier') mocks.signup.password.mockResolvedValue({ error: { code: 'form_identifier_exists' } })
  start(); expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'An account already exists. Use sign in; registration will not sign you in.')
  expect(mocks.signup.finalize).not.toHaveBeenCalled()
  expect(mocks.signup.verifications.sendEmailCode).not.toHaveBeenCalled()
})
