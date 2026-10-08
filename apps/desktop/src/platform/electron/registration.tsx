import { useSignUp } from '@clerk/electron/react'
import { useConvexAuth } from 'convex/react'
import type { ReactNode } from 'react'
import { RegistrationProvider, type RegistrationAdapter } from '../../lib/registration'

export function useElectronRegistration(): RegistrationAdapter {
  const { signUp, fetchStatus } = useSignUp()
  const { isLoading, isAuthenticated } = useConvexAuth()
  return {
    fetchStatus, isLoading, isAuthenticated,
    signUp: {
      // Signal resources update during awaited calls, before React rerenders.
      get status() { return signUp.status },
      get missingFields() { return signUp.missingFields },
      get unverifiedFields() { return signUp.unverifiedFields },
      get isTransferable() { return signUp.isTransferable },
      get existingSession() { return signUp.existingSession },
      password: credentials => signUp.password(credentials),
      // Keep navigation local; Convex remains the access authority.
      finalize: () => signUp.finalize({ navigate: async () => {} }),
      verifications: {
        sendEmailCode: () => signUp.verifications.sendEmailCode(),
        verifyEmailCode: params => signUp.verifications.verifyEmailCode(params),
      },
    },
  }
}
export function ElectronRegistrationProvider({ children }: { children: ReactNode }) {
  const adapter = useElectronRegistration()
  return <RegistrationProvider value={adapter}>{children}</RegistrationProvider>
}
