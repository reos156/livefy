import { ClerkProvider, useAuth } from '@clerk/electron/react'
import { ConvexReactClient } from 'convex/react'
import { ConvexProviderWithClerk } from 'convex/react-clerk'
import type { ReactNode } from 'react'
import { AuthConfiguration } from '../../lib/auth'
import { ElectronSignInProvider } from './sign-in'
import { ElectronRegistrationProvider } from './registration'

const expectedEndpoint = 'https://polite-parrot-887.convex.cloud'
let client: ConvexReactClient | undefined
export function validEndpoint(endpoint: string | undefined): endpoint is string {
  return endpoint === expectedEndpoint
}
function validKey(key: string | undefined): key is string {
  if (!key?.startsWith('pk_test_')) return false
  try {
    return atob(key.slice(8)) === 'organic-snake-7233.clerk.accounts.dev$'
  } catch { return false }
}
export function AuthBoundary({ endpoint, publishableKey, children }: {
  endpoint?: string; publishableKey?: string; children: ReactNode
}) {
  if (!validEndpoint(endpoint) || !validKey(publishableKey)) {
    return <AuthConfiguration configured={false}>
      <p role="status">Authentication unavailable: deployment configuration missing or invalid.</p>{children}
    </AuthConfiguration>
  }
  client ??= new ConvexReactClient(endpoint)
  return <ClerkProvider publishableKey={publishableKey}>
    <ConvexProviderWithClerk client={client} useAuth={useAuth}>
      <ElectronSignInProvider><ElectronRegistrationProvider>
        <AuthConfiguration configured>{children}</AuthConfiguration>
      </ElectronRegistrationProvider></ElectronSignInProvider>
    </ConvexProviderWithClerk>
  </ClerkProvider>
}
