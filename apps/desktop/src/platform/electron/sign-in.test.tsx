import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { cleanup, renderHook } from '@testing-library/react'
const state = vi.hoisted(() => ({ signIn: {} as any, fetchStatus: 'idle' }))
vi.mock('@clerk/electron/react', () => ({ useSignIn: () => state }))
import { useElectronSignIn } from './sign-in'
beforeEach(() => {
  state.fetchStatus = 'idle'
  state.signIn = { status: 'complete', isTransferable: false, password: vi.fn(async () => ({ error: null })), finalize: vi.fn(async () => ({ error: null })) }
})
afterEach(cleanup)
it('resets diagnostic stage when password restarts a trust attempt', async () => {
  state.signIn.status = 'needs_client_trust'; state.signIn.supportedSecondFactors = [{ strategy: 'email_code' }]
  state.signIn.mfa = { sendEmailCode: vi.fn(async () => ({ error: null })) }
  const { result } = renderHook(useElectronSignIn)
  await result.current.sendEmailCode!()
  await result.current.password({ emailAddress: 'person@example.com', password: 'fresh' })
  expect(result.current.diagnostic!()).toContain('stage=password')
})
it('continues only supported device trust email codes', async () => {
  state.signIn.status = 'needs_client_trust'
  state.signIn.supportedSecondFactors = [{ strategy: 'email_code' }]
  state.signIn.mfa = { sendEmailCode: vi.fn(async () => ({ error: null })), verifyEmailCode: vi.fn(async () => { state.signIn.status = 'complete'; return { error: null } }) }
  const { result } = renderHook(useElectronSignIn)
  expect(await result.current.password({ emailAddress: 'person@example.com', password: 'x' })).toBe('email-code')
  expect(await result.current.sendEmailCode!()).toBe('email-code')
  expect(await result.current.verifyEmailCode!('123456')).toBe('complete')
})
it.each(['sendEmailCode', 'verifyEmailCode'] as const)('handles returned/thrown %s failures without finalization', async method => {
  state.signIn.status = 'needs_client_trust'; state.signIn.supportedSecondFactors = [{ strategy: 'email_code' }]
  state.signIn.mfa = { [method]: vi.fn().mockResolvedValueOnce({ error: { message: 'SECRET' } }).mockRejectedValueOnce('SECRET') }
  const { result } = renderHook(useElectronSignIn)
  const run = () => method === 'sendEmailCode' ? result.current.sendEmailCode!() : result.current.verifyEmailCode!('123456')
  expect(await run()).toBe('invalid'); expect(await run()).toBe('invalid')
  expect(state.signIn.finalize).not.toHaveBeenCalled()
})
it.each(['needs_second_factor', 'needs_protect_check', 'SECRET@example.com', 'needs_client_trust'])('rejects unsupported %s without leaking provider fields', async status => {
  state.signIn.status = status; state.signIn.supportedSecondFactors = [{ strategy: 'SECRET@example.com' }]
  state.signIn.mfa = { sendEmailCode: vi.fn(), verifyEmailCode: vi.fn() }
  const { result } = renderHook(useElectronSignIn)
  expect(await result.current.sendEmailCode!()).toBe('challenge')
  expect(await result.current.verifyEmailCode!('SECRET')).toBe('challenge')
  expect(result.current.diagnostic!()).not.toContain('SECRET')
  expect(state.signIn.mfa.sendEmailCode).not.toHaveBeenCalled()
})
it('does not finalize incomplete verification or transferable trust', async () => {
  state.signIn.status = 'needs_client_trust'; state.signIn.supportedSecondFactors = [{ strategy: 'email_code' }]
  state.signIn.mfa = { verifyEmailCode: vi.fn(async () => ({ error: null })) }
  const { result } = renderHook(useElectronSignIn)
  expect(await result.current.verifyEmailCode!('123456')).toBe('email-code')
  expect(await result.current.finalize()).toBe('challenge')
  state.signIn.isTransferable = true
  expect(await result.current.verifyEmailCode!('123456')).toBe('challenge')
  expect(state.signIn.mfa.verifyEmailCode).toHaveBeenCalledTimes(1)
})
it('uses the installed signal password shape unchanged', async () => {
  const { result } = renderHook(useElectronSignIn)
  expect(await result.current.password({ emailAddress: 'person@example.com', password: ' x ' })).toBe('complete')
  expect(state.signIn.password).toHaveBeenCalledWith({ emailAddress: 'person@example.com', password: ' x ' })
})
it.each(['needs_first_factor', 'needs_second_factor', 'needs_client_trust', 'needs_new_password', 'needs_protect_check', null])('does not finalize %s', async status => {
  state.signIn.status = status
  const { result } = renderHook(useElectronSignIn)
  expect(await result.current.password({ emailAddress: 'person@example.com', password: 'x' })).toBe('challenge')
  expect(await result.current.finalize()).toBe('challenge')
  expect(state.signIn.finalize).not.toHaveBeenCalled()
})
it.each(['password', 'finalize'] as const)('maps returned and thrown %s errors to controlled outcomes', async method => {
  const { result } = renderHook(useElectronSignIn)
  state.signIn[method].mockResolvedValueOnce({ error: { message: 'SECRET' } }).mockRejectedValueOnce({ message: 'SECRET' })
  const run = () => method === 'password' ? result.current.password({ emailAddress: 'person@example.com', password: 'x' }) : result.current.finalize()
  expect(await run()).toBe('invalid'); expect(await run()).toBe('invalid')
})
it('fails closed for session tasks without navigating', async () => {
  state.signIn.finalize.mockImplementation(async ({ navigate }: any) => { await navigate({ session: { currentTask: { key: 'choose-organization' } } }); return { error: null } })
  const { result } = renderHook(useElectronSignIn)
  expect(await result.current.finalize()).toBe('challenge')
})
it('exposes provider pending and rejects transferable completion', async () => {
  state.fetchStatus = 'fetching'; state.signIn.isTransferable = true
  const { result } = renderHook(useElectronSignIn)
  expect(result.current.fetching).toBe(true)
  expect(await result.current.finalize()).toBe('challenge')
})
