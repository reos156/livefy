import { createContext, useContext, type ReactNode } from 'react'
export type SignInOutcome = 'complete' | 'invalid' | 'challenge' | 'email-code'
export interface SignInAdapter {
  fetching: boolean
  sendEmailCode?(): Promise<SignInOutcome>
  verifyEmailCode?(code: string): Promise<SignInOutcome>
  diagnostic?(): string
  password(credentials: { emailAddress: string; password: string }): Promise<SignInOutcome>
  finalize(): Promise<SignInOutcome>
  persistence(): Promise<'encrypted' | 'memory-only'>
}
const Context = createContext<SignInAdapter | null>(null)
export function SignInProvider({ value, children }: { value: SignInAdapter; children: ReactNode }) {
  return <Context.Provider value={value}>{children}</Context.Provider>
}
export function useSignInAdapter() {
  const adapter = useContext(Context)
  if (!adapter) throw new Error('Sign-in adapter unavailable')
  return adapter
}
