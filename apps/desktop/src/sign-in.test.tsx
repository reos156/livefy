import { afterEach, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { SignIn } from './sign-in'
import { SignInProvider, type SignInAdapter } from './lib/sign-in'
afterEach(cleanup)
it('clears unsupported diagnostic during a password retry', async () => {
  let resolve!: (value: 'invalid') => void
  const password = vi.fn().mockResolvedValueOnce('challenge').mockImplementationOnce(() => new Promise<'invalid'>(r => { resolve = r }))
  const { adapter, submit } = setup({ password, diagnostic: () => 'status=needs_second_factor; stage=password; strategy=unsupported' }); submit()
  await screen.findByText(/Sign-in diagnostic:/)
  expect(adapter.finalize).not.toHaveBeenCalled(); submit()
  expect(screen.queryByText(/Sign-in diagnostic:/)).toBeNull()
  await act(async () => resolve('invalid'))
})
it('recovers initial send failure through cancel and a fresh password', async () => {
  const { adapter, submit } = setup({ password: vi.fn().mockResolvedValueOnce('email-code').mockResolvedValueOnce('complete'), sendEmailCode: vi.fn(async () => 'invalid' as const), verifyEmailCode: vi.fn() }); submit()
  expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'Verification failed. Try again or resend the code.')
  expect(adapter.finalize).not.toHaveBeenCalled()
  fireEvent.click(screen.getByText('Cancel verification')); submit()
  await screen.findByText('Sign-in completed; waiting for backend access confirmation.')
  expect(adapter.password).toHaveBeenCalledTimes(2)
  expect(adapter.verifyEmailCode).not.toHaveBeenCalled()
})
it('locks verification/resend/cancel, retries wrong codes and clears state on cancel', async () => {
  let resolve!: (value: 'invalid') => void
  const sendEmailCode = vi.fn(async () => 'email-code' as const)
  const verifyEmailCode = vi.fn(() => new Promise<'invalid'>(r => { resolve = r }))
  const { adapter, submit } = setup({ password: vi.fn(async () => 'email-code' as const), sendEmailCode, verifyEmailCode }); submit()
  const input = await screen.findByLabelText('Email verification code')
  fireEvent.change(input, { target: { value: 'wrong' } })
  const form = input.closest('form')!
  act(() => { fireEvent.submit(form); fireEvent.submit(form); fireEvent.click(screen.getByText('Resend code')); fireEvent.click(screen.getByText('Cancel verification')) })
  expect(verifyEmailCode).toHaveBeenCalledTimes(1)
  expect(sendEmailCode).toHaveBeenCalledTimes(1)
  expect(adapter.finalize).not.toHaveBeenCalled()
  await act(async () => resolve('invalid'))
  expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'Verification failed. Try again or resend the code.')
  expect(input).toHaveProperty('value', '')
  fireEvent.click(screen.getByText('Resend code')); await act(async () => {})
  expect(sendEmailCode).toHaveBeenCalledTimes(2)
  fireEvent.change(input, { target: { value: 'secret-code' } })
  fireEvent.click(screen.getByText('Cancel verification'))
  expect(screen.getByLabelText('Password')).toHaveProperty('value', '')
  expect(screen.queryByLabelText('Email verification code')).toBeNull()
})
it('finalizes verified codes once and retains backend confirmation gate', async () => {
  const { adapter, submit } = setup({ password: vi.fn(async () => 'email-code' as const), sendEmailCode: vi.fn(async () => 'email-code' as const), verifyEmailCode: vi.fn(async () => 'complete' as const) }); submit()
  const input = await screen.findByLabelText('Email verification code')
  fireEvent.change(input, { target: { value: '123456' } }); fireEvent.submit(input.closest('form')!)
  await screen.findByText('Sign-in completed; waiting for backend access confirmation.')
  expect(adapter.finalize).toHaveBeenCalledTimes(1)
})
function setup(overrides: Partial<SignInAdapter> = {}) {
  const adapter: SignInAdapter = { fetching: false, password: vi.fn(async () => 'complete' as const), finalize: vi.fn(async () => 'complete' as const), persistence: async () => 'encrypted', ...overrides }
  const pending = vi.fn()
  const view = render(<SignInProvider value={adapter}><SignIn onPendingChange={pending} /></SignInProvider>)
  function submit() {
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'person@example.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: ' x ' } })
    fireEvent.submit(screen.getByLabelText('Email').closest('form')!)
  }
  return { adapter, pending, submit, ...view }
}
it('forwards short credentials unchanged and waits for backend confirmation', async () => {
  const { adapter, submit } = setup(); submit()
  await screen.findByText('Sign-in completed; waiting for backend access confirmation.')
  expect(adapter.password).toHaveBeenCalledWith({ emailAddress: 'person@example.com', password: ' x ' })
  expect(adapter.finalize).toHaveBeenCalledTimes(1)
  expect(screen.getByLabelText('Password').getAttribute('minlength')).toBeNull()
})
it.each(['returned', 'thrown'])('handles %s invalid credentials without enumeration', async mode => {
  const failure = { code: 'form_identifier_not_found', message: 'SECRET person@example.com' }
  const password = vi.fn(async () => { if (mode === 'thrown') throw failure; return 'invalid' as const })
  const { adapter, submit } = setup({ password }); submit()
  expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'Unable to sign in. Check your email and password and try again.')
  expect(adapter.finalize).not.toHaveBeenCalled()
})
it('locks same-tick duplicates through finalization then unlocks retry on failure', async () => {
  let resolve!: (value: 'invalid') => void
  const finalize = vi.fn(() => new Promise<'invalid'>(r => { resolve = r }))
  const { adapter, pending, submit } = setup({ finalize }); submit()
  await act(async () => {})
  const form = screen.getByLabelText('Email').closest('form')!
  act(() => { fireEvent.submit(form); fireEvent.submit(form) })
  expect(adapter.password).toHaveBeenCalledTimes(1)
  expect(pending).toHaveBeenLastCalledWith(true)
  await act(async () => resolve('invalid'))
  expect(await screen.findByRole('alert')).toBeTruthy()
  expect(pending).toHaveBeenLastCalledWith(false)
  submit(); await act(async () => {})
  expect(adapter.password).toHaveBeenCalledTimes(2)
  await act(async () => resolve('invalid'))
})
it('excludes submissions while provider fetching', () => {
  const { adapter, submit } = setup({ fetching: true }); submit()
  expect(adapter.password).not.toHaveBeenCalled()
})
it.each(['password', 'finalize'] as const)('fails closed on %s challenge', async method => {
  const { submit } = setup({ [method]: vi.fn(async () => 'challenge') }); submit()
  expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'Additional verification is required. Contact support to complete sign-in; access has not been confirmed.')
  expect(screen.queryByText(/Sign-in completed/)).toBeNull()
})
it('validates email and nonempty password locally', async () => {
  const { adapter } = setup()
  fireEvent.submit(screen.getByLabelText('Email').closest('form')!)
  expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'Enter a valid email address and password.')
  expect(adapter.password).not.toHaveBeenCalled()
})
