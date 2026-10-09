import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { RegistrationProvider, type RegistrationAttempt } from './lib/registration'
import { Registration as SharedRegistration } from './registration'
function attempt() {
  const missingFields: string[] = []
  const existingSession: unknown = undefined
  return {
    status: 'missing_requirements', missingFields, unverifiedFields: ['email_address'],
    isTransferable: false, existingSession,
    password: vi.fn<RegistrationAttempt['password']>(ok), finalize: vi.fn<RegistrationAttempt['finalize']>(ok),
    verifications: {
      sendEmailCode: vi.fn<RegistrationAttempt['verifications']['sendEmailCode']>(ok),
      verifyEmailCode: vi.fn<RegistrationAttempt['verifications']['verifyEmailCode']>(ok),
    },
  }
}
const mocks = { signup: attempt(), auth: { isLoading: false, isAuthenticated: false } }
function Registration(props: { onPendingChange?: (pending: boolean) => void }) {
  return <RegistrationProvider value={{ signUp: mocks.signup, fetchStatus: 'idle', ...mocks.auth }}>
    <SharedRegistration {...props} />
  </RegistrationProvider>
}
function ok() { return Promise.resolve({ error: null }) }
beforeEach(() => {
  mocks.signup = attempt()
  Object.assign(mocks.auth, { isLoading: false, isAuthenticated: false })
})
afterEach(cleanup)
function expectOfficialField(control: HTMLElement, disabled = false) {
  expect(control.getAttribute('data-slot')).toBe('input')
  const field = control.parentElement!
  expect(field.getAttribute('data-slot')).toBe('field')
  expect(field.getAttribute('data-disabled')).toBe(String(disabled))
  expect(field.parentElement?.getAttribute('data-slot')).toBe('field-group')
  expect(field.querySelector('label')?.getAttribute('data-slot')).toBe('field-label')
  expect(field.querySelector('label')?.htmlFor).toBe(control.id)
  expect((control as HTMLInputElement).disabled).toBe(disabled)
}
it('composes official credential fields while retaining native validation and controlled values', () => {
  render(<Registration />)
  const email = screen.getByLabelText('Email') as HTMLInputElement
  const password = screen.getByLabelText('Password') as HTMLInputElement
  expectOfficialField(email)
  expectOfficialField(password)
  expect(email.id).toBe('registration-email')
  expect(email.type).toBe('text')
  expect(email.inputMode).toBe('email')
  expect(email.autocomplete).toBe('email')
  expect(email.required).toBe(true)
  expect(email.closest('form')?.noValidate).toBe(true)
  expect(password.id).toBe('registration-password')
  expect(password.type).toBe('password')
  expect(password.autocomplete).toBe('new-password')
  expect(password.required).toBe(true)
  expect(password.minLength).toBe(8)
  fireEvent.change(email, { target: { value: 'person@example.com' } })
  fireEvent.change(password, { target: { value: 'valid-password' } })
  expect(email.value).toBe('person@example.com')
  expect(password.value).toBe('valid-password')
})
it('matches official credential disabled fields to provider loading and authenticated guards', () => {
  mocks.auth.isLoading = true
  const view = render(<Registration />)
  expectOfficialField(screen.getByLabelText('Email'), true)
  expectOfficialField(screen.getByLabelText('Password'), true)
  mocks.auth.isLoading = false
  mocks.auth.isAuthenticated = true
  view.rerender(<Registration />)
  expectOfficialField(screen.getByLabelText('Email'), true)
  expectOfficialField(screen.getByLabelText('Password'), true)
})
it('composes the official error description with redacted copy', async () => {
  mocks.signup.password.mockResolvedValue({ error: { code: 'unknown', message: 'SECRET' } })
  start()
  const alert = await screen.findByRole('alert')
  expect(alert.getAttribute('data-slot')).toBe('alert')
  expect(alert.querySelector('[data-slot="alert-description"]')?.textContent)
    .toBe('Unable to complete this step. Please try again.')
  expect(alert.textContent).not.toContain('SECRET')
})
it('preserves the single CAPTCHA target and provider children through send retry, verification and resend', async () => {
  mocks.signup.verifications.sendEmailCode.mockResolvedValueOnce({ error: { code: 'unknown' } })
  const view = render(<Registration />)
  const captcha = document.getElementById('clerk-captcha')!
  const providerChild = document.createElement('iframe')
  captcha.appendChild(providerChild)
  function expectCaptcha() {
    expect(view.container.querySelectorAll('#clerk-captcha')).toHaveLength(1)
    expect(document.getElementById('clerk-captcha')).toBe(captcha)
    expect(captcha.firstChild).toBe(providerChild)
    expect(captcha.closest('form')).toBeNull()
    expect(captcha.isConnected).toBe(true)
    expect(captcha.hidden).toBe(false)
  }
  expectCaptcha()
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'person@example.com' } })
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'valid-password' } })
  fireEvent.submit(screen.getByLabelText('Email').closest('form')!)
  expectOfficialField(screen.getByLabelText('Email'), true)
  expectOfficialField(screen.getByLabelText('Password'), true)
  await screen.findByRole('alert')
  expectCaptcha()
  fireEvent.click(screen.getByRole('button', { name: 'Send email code' }))
  const code = await screen.findByLabelText('Email code') as HTMLInputElement
  expectOfficialField(code)
  expect(code.id).toBe('registration-code')
  expect(code.autocomplete).toBe('one-time-code')
  expect(code.closest('form')?.noValidate).toBe(false)
  expectCaptcha()
  fireEvent.change(code, { target: { value: '123456' } })
  expect(code.value).toBe('123456')
  let resolve!: (value: { error: unknown }) => void
  mocks.signup.verifications.sendEmailCode.mockImplementation(() => new Promise(r => { resolve = r }))
  fireEvent.click(screen.getByRole('button', { name: 'Resend code' }))
  expectOfficialField(code, true)
  expect(screen.getByRole('status').getAttribute('data-slot')).toBe('alert')
  expect(screen.getByRole('status').querySelector('[data-slot="alert-description"]')).toBeTruthy()
  expect(screen.queryByRole('alert')).toBeNull()
  expect(screen.getByRole('status').textContent).toBe('Registration request in progress.')
  expectCaptcha()
  await act(async () => resolve({ error: null }))
  expectOfficialField(code)
  expect(code.value).toBe('')
  expectCaptcha()
  verify()
  await screen.findByRole('alert')
  expectCaptcha()
})
it('reports pending synchronously and retains it through finalization', async () => {
  const pending = vi.fn()
  let resolve!: (value: { error: unknown }) => void
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
  let resolve!: (value: { error: unknown }) => void
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
  let resolve!: (value: { error: unknown }) => void
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
