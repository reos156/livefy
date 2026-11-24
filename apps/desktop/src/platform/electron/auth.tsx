import { ClerkProvider, useAuth, useClerk } from '@clerk/electron/react'
import { ConvexReactClient } from 'convex/react'
import { ConvexProviderWithClerk } from 'convex/react-clerk'
import { useRef, type ReactNode } from 'react'
import { AuthConfiguration } from '../../lib/auth'
import { SessionBoundary } from '../../lib/session'
import { createModalNavigation, publicCompletionUrl } from './auth-ui'
type ModalNavigation = ReturnType<typeof createModalNavigation>

function NativeSessionBoundary({ children, modalNavigation }: { children: ReactNode; modalNavigation?: ModalNavigation }) {
  const clerk = useClerk()
  const terminalAttempted = useRef(false)
  async function logout() {
    if (modalNavigation) {
      clerk.closeSignIn()
      clerk.closeSignUp()
    }
    const native = window.livefySession
    if (!native) throw new Error('Native session bridge unavailable')
    let confirmed = false
    if (!terminalAttempted.current && native.preserveAndQuit) {
      try {
        const client = clerk.client
        const id = client?.id
        if (client && id) {
          await client.removeSessions()
          const reloaded = await client.reload()
          const current = clerk.client
          confirmed = !!reloaded && reloaded.id === id && current?.id === id &&
            reloaded.sessions.length === 0 && reloaded.signedInSessions.length === 0 &&
            current.sessions.length === 0 && current.signedInSessions.length === 0 && clerk.session === null
        }
      } catch { /* Unconfirmed remote state requires safe local deletion. */ }
    }
    // A failed native terminal has fenced SDK access; retries must delete locally.
    terminalAttempted.current = true
    if (confirmed && native.preserveAndQuit) await native.preserveAndQuit()
    else await native.logout()
  }
  return <SessionBoundary logout={logout}>{children}</SessionBoundary>
}

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
export function AuthBoundary({ endpoint, publishableKey, children, modalNavigation }: {
  endpoint?: string; publishableKey?: string; children: ReactNode; modalNavigation?: ModalNavigation
}) {
  if (!validEndpoint(endpoint) || !validKey(publishableKey)) {
    return <AuthConfiguration configured={false}>
      <p role="status">Authentication unavailable: deployment configuration missing or invalid.</p>{children}
    </AuthConfiguration>
  }
  client ??= new ConvexReactClient(endpoint)
  return <ClerkProvider publishableKey={publishableKey} signInUrl={publicCompletionUrl(window.location.href)} experimental={{ rethrowOfflineNetworkErrors: true }} {...modalNavigation}>
    <NativeSessionBoundary modalNavigation={modalNavigation}>
    <ConvexProviderWithClerk client={client} useAuth={useAuth}>
      <AuthConfiguration configured>{children}</AuthConfiguration>
    </ConvexProviderWithClerk>
    </NativeSessionBoundary>
  </ClerkProvider>
}
