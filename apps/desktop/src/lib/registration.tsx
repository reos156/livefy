import { createContext, useContext, type ReactNode } from 'react'

type Result = { error: unknown }
export interface RegistrationAttempt {
  readonly status: string | null
  readonly missingFields: readonly string[]
  readonly unverifiedFields: readonly string[]
  readonly isTransferable: boolean
  readonly existingSession: unknown
  password(credentials: { emailAddress: string; password: string }): Promise<Result>
  finalize(): Promise<Result>
  verifications: {
    sendEmailCode(): Promise<Result>
    verifyEmailCode(params: { code: string }): Promise<Result>
  }
}
export interface RegistrationAdapter {
  signUp: RegistrationAttempt
  fetchStatus: 'idle' | 'fetching'
  isLoading: boolean
  isAuthenticated: boolean
}
const Context = createContext<RegistrationAdapter | null>(null)
export function RegistrationProvider({ value, children }: { value: RegistrationAdapter; children: ReactNode }) {
  return <Context.Provider value={value}>{children}</Context.Provider>
}
export function useRegistrationAdapter() {
  const adapter = useContext(Context)
  if (!adapter) throw new Error('Registration adapter unavailable')
  return adapter
}
