import { useSignIn } from '@clerk/electron/react'
import { useRef, type ReactNode } from 'react'
import { SignInProvider, type SignInAdapter } from '../../lib/sign-in'
export function useElectronSignIn(): SignInAdapter {
  const { signIn, fetchStatus } = useSignIn()
  const complete = () => signIn.status === 'complete' && !signIn.isTransferable
  const trust = () => !signIn.isTransferable && signIn.status === 'needs_client_trust' &&
    signIn.supportedSecondFactors?.some(factor => factor.strategy === 'email_code')
  const stage = useRef('password')
  const outcome = () => complete() ? 'complete' as const : trust() ? 'email-code' as const : 'challenge' as const
  return {
    fetching: fetchStatus === 'fetching',
    diagnostic() {
      const statuses = ['complete', 'needs_first_factor', 'needs_second_factor', 'needs_client_trust', 'needs_new_password', 'needs_protect_check']
      const status = statuses.includes(signIn.status ?? '') ? signIn.status : 'unknown'
      return `status=${status}; stage=${stage.current}; strategy=${trust() ? 'email_code' : 'unsupported'}`
    },
    async sendEmailCode() {
      if (!trust()) return 'challenge'
      stage.current = 'send'
      try { const { error } = await signIn.mfa.sendEmailCode(); return error ? 'invalid' : outcome() }
      catch { return 'invalid' }
    },
    async verifyEmailCode(code) {
      if (!trust()) return 'challenge'
      stage.current = 'verify'
      try { const { error } = await signIn.mfa.verifyEmailCode({ code }); return error ? 'invalid' : outcome() }
      catch { return 'invalid' }
    },
    async password(credentials) {
      stage.current = 'password'
      try {
        const { error } = await signIn.password(credentials)
        return error ? 'invalid' : outcome()
      } catch { return 'invalid' }
    },
    async finalize() {
      if (!complete()) return 'challenge'
      stage.current = 'finalize'
      let task = false
      try {
        const { error } = await signIn.finalize({ navigate: async ({ session }) => {
          // No client navigation or access claim; Convex independently authorizes access.
          task = Boolean(session?.currentTask)
        } })
        if (task) stage.current = 'session-task'
        return error ? 'invalid' : task ? 'challenge' : 'complete'
      } catch { return 'invalid' }
    },
    async persistence() {
      if (!window.livefySession) throw new Error('Persistence unavailable')
      return window.livefySession.persistence()
    },
  }
}
export function ElectronSignInProvider({ children }: { children: ReactNode }) {
  const adapter = useElectronSignIn()
  return <SignInProvider value={adapter}>{children}</SignInProvider>
}
