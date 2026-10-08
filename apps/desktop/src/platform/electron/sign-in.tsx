import { useSignIn } from '@clerk/electron/react'
import type { ReactNode } from 'react'
import { SignInProvider, type SignInAdapter } from '../../lib/sign-in'
export function useElectronSignIn(): SignInAdapter {
  const { signIn, fetchStatus } = useSignIn()
  const complete = () => signIn.status === 'complete' && !signIn.isTransferable
  return {
    fetching: fetchStatus === 'fetching',
    async password(credentials) {
      try {
        const { error } = await signIn.password(credentials)
        return error ? 'invalid' : complete() ? 'complete' : 'challenge'
      } catch { return 'invalid' }
    },
    async finalize() {
      if (!complete()) return 'challenge'
      let task = false
      try {
        const { error } = await signIn.finalize({ navigate: async ({ session }) => {
          // No client navigation or access claim; Convex independently authorizes access.
          task = Boolean(session?.currentTask)
        } })
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
