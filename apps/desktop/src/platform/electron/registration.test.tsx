import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
const state = vi.hoisted(() => ({
  signUp: { status: 'missing_requirements', missingFields: [], unverifiedFields: ['email_address'],
    isTransferable: false, existingSession: undefined, password: vi.fn(async () => ({ error: null })),
    finalize: vi.fn(async (_options: { navigate: () => Promise<void> }) => ({ error: null })),
    verifications: { sendEmailCode: vi.fn(async () => ({ error: null })), verifyEmailCode: vi.fn<RegistrationAttempt['verifications']['verifyEmailCode']>(async () => ({ error: null })) } },
  fetchStatus: 'idle',
}))
vi.mock('@clerk/electron/react', () => ({ useSignUp: () => state }))
vi.mock('convex/react', () => ({ useConvexAuth: () => ({ isLoading: false, isAuthenticated: false }) }))
import { ElectronRegistrationProvider } from './registration'
import { useRegistrationAdapter, type RegistrationAttempt } from '../../lib/registration'
afterEach(cleanup)
it.each(['returned', 'thrown'])('preserves %s failures for shared safe-error handling', async mode => {
  let adapter: ReturnType<typeof useRegistrationAdapter> | undefined
  const failure = { code: 'form_code_incorrect' }
  const verify = state.signUp.verifications.verifyEmailCode
  verify.mockImplementationOnce(() =>
    mode === 'returned' ? Promise.resolve({ error: failure }) : Promise.reject(failure))
  function Probe() { adapter = useRegistrationAdapter(); return null }
  render(<ElectronRegistrationProvider><Probe /></ElectronRegistrationProvider>)
  if (!adapter) throw new Error('Adapter unavailable')
  const result = adapter.signUp.verifications.verifyEmailCode({ code: '123456' })
  if (mode === 'returned') await expect(result).resolves.toEqual({ error: failure })
  else await expect(result).rejects.toBe(failure)
  expect(verify).toHaveBeenCalledWith({ code: '123456' })
})
it('projects live attempt fields and forwards native methods without claiming access', async () => {
  let adapter: ReturnType<typeof useRegistrationAdapter> | undefined
  function Probe() { adapter = useRegistrationAdapter(); return <p>{adapter.signUp.status}</p> }
  render(<ElectronRegistrationProvider><Probe /></ElectronRegistrationProvider>)
  expect(screen.getByText('missing_requirements')).toBeTruthy()
  if (!adapter) throw new Error('Adapter unavailable')
  await adapter.signUp.password({ emailAddress: 'person@example.com', password: 'password' })
  expect(state.signUp.password).toHaveBeenCalledWith({ emailAddress: 'person@example.com', password: 'password' })
  state.signUp.status = 'complete'
  expect(adapter.signUp.status).toBe('complete')
  await adapter.signUp.finalize()
  const options = state.signUp.finalize.mock.calls[0]?.[0]
  expect(options?.navigate).toBeTypeOf('function')
  await options?.navigate()
  expect(adapter.isAuthenticated).toBe(false)
})
