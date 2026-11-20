import { ClerkProvider, useAuth, useClerk } from '@clerk/react'
import { ConvexReactClient } from 'convex/react'
import { ConvexProviderWithClerk } from 'convex/react-clerk'
import { type ReactNode, type MutableRefObject, useEffect, useMemo, useRef, useState } from 'react'
import { AuthConfiguration } from '../../lib/auth'
import { SessionBoundary } from '../../lib/session'
import { browserCompletionUrl, createBrowserNavigation } from './auth-ui'
export { BrowserAuthUi } from './auth-ui'

type BrowserClerk = ReturnType<typeof useClerk>
type BrowserBinding = { isLoaded: boolean; isSignedIn: boolean }
// The binding is fail-closed until it reports: only a loaded, signed-out read confirms completion.
const unconfirmedBinding: BrowserBinding = { isLoaded: false, isSignedIn: true }
function BrowserSession({ children, onSignedOut, clerkRef }: {
  children: ReactNode; onSignedOut?: () => unknown; clerkRef: MutableRefObject<BrowserClerk | undefined>
}) {
  const clerk = useClerk()
  useEffect(() => {
    clerkRef.current = clerk
    return () => { if (clerkRef.current === clerk) clerkRef.current = undefined }
  }, [clerk, clerkRef])
  const { isLoaded, isSignedIn } = useAuth()
  // The installed binding keeps serving the value its provider subscribed with, so a
  // resolved local sign-out may never reach it. Completion recorded from the instance
  // the component already holds closes the transition without a remount or a reload.
  const [instanceSignedOut, setInstanceSignedOut] = useState(false)
  async function logout() {
    await clerk.signOut({ redirectUrl: browserCompletionUrl(window.location.href) })
    await onSignedOut?.()
    setInstanceSignedOut(!!(clerk.loaded && !clerk.session))
    resetToCompletion()
  }
  function resetToCompletion() {
    // A hash-only change does not reload the document, and both the Clerk React binding
    // and the Convex client keep the stale session in this one, which leaves the access
    // landing stuck on its loading state. Only a fresh document re-initializes both.
    // Normalize the URL first so the reload lands on the public completion route, and
    // replace state so the signed-out private view stays out of history.
    try { window.history.replaceState(null, '', browserCompletionUrl(window.location.href)) } catch { /* keep current URL */ }
    try { window.location.reload() } catch { /* blocked reload: the confirmation surface stays */ }
  }
  const binding: BrowserBinding = isLoaded ? { isLoaded, isSignedIn: !!isSignedIn } : unconfirmedBinding
  const completedReady = instanceSignedOut || (binding.isLoaded && !binding.isSignedIn)
  return <SessionBoundary browser logout={logout} completedReady={completedReady} completedContent={completedReady ? children : null}>
    {children}
  </SessionBoundary>
}
let client: ConvexReactClient | undefined
export function AuthBoundary({ endpoint, publishableKey, children, onSignedOut, modalNavigation }: {
  endpoint?: string; publishableKey?: string; children: ReactNode; onSignedOut?: () => unknown
  modalNavigation?: Pick<ReturnType<typeof createBrowserNavigation>, 'routerPush' | 'routerReplace'> &
    Partial<Pick<ReturnType<typeof createBrowserNavigation>, 'withSession'>>
}) {
  const clerkRef = useRef<BrowserClerk | undefined>(undefined)
  const navigation = useMemo(() => {
    if (!modalNavigation) return undefined
    // The shared platform boundary erases browser-only binding from its prop type.
    if (!modalNavigation.withSession) throw new Error('Browser session navigation binding unavailable')
    return modalNavigation.withSession(() => {
      const clerk = clerkRef.current
      return !!(clerk?.loaded && clerk.session)
    })
  }, [modalNavigation])
  let validKey = false
  try { validKey = !!publishableKey?.startsWith('pk_test_') && atob(publishableKey.slice(8)) === 'organic-snake-7233.clerk.accounts.dev$' } catch { /* Invalid configuration fails closed. */ }
  if (endpoint !== 'https://polite-parrot-887.convex.cloud' || !validKey || !publishableKey) {
    return <AuthConfiguration configured={false}>
      <p role="status">Authentication unavailable: deployment configuration missing or invalid.</p>{children}
    </AuthConfiguration>
  }
  client ??= new ConvexReactClient(endpoint)
  const completionUrl = browserCompletionUrl(window.location.href)
  return <ClerkProvider publishableKey={publishableKey} {...navigation} signInUrl={completionUrl}
    signInForceRedirectUrl={completionUrl} signUpForceRedirectUrl={completionUrl}
    allowedRedirectOrigins={[window.location.origin]} allowedRedirectProtocols={['http:', 'https:']}>
    <BrowserSession onSignedOut={onSignedOut} clerkRef={clerkRef}>
      <ConvexProviderWithClerk client={client} useAuth={useAuth}>
        <AuthConfiguration configured>{children}</AuthConfiguration>
      </ConvexProviderWithClerk>
    </BrowserSession>
  </ClerkProvider>
}
