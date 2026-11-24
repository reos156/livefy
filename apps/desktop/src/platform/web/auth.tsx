import { ClerkProvider, useAuth, useClerk } from '@clerk/react'
import { ConvexReactClient } from 'convex/react'
import { ConvexProviderWithClerk } from 'convex/react-clerk'
import { type ReactNode, type MutableRefObject, useEffect, useMemo, useRef, useState } from 'react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { VisualShell } from '@/components/visual-shell'
import { AuthConfiguration } from '../../lib/auth'
import { SessionBoundary } from '../../lib/session'
import { browserCompletionUrl, createBrowserNavigation } from './auth-ui'
export { BrowserAuthUi } from './auth-ui'

type BrowserClerk = ReturnType<typeof useClerk>
// The binding value the provider captured at mount, as the session boundary observes it.
type BindingSnapshot = { isLoaded: boolean; isSignedIn: boolean | undefined }
// A completed entry can hand control back well before the session it activated is
// observable here. The operator's browser reproduced exactly that: the reset had succeeded,
// but the session only became observable moments after the half-second window the first cut
// allowed, so the flow declared a failure the session contradicted. The window is therefore
// long enough to catch that late activation, and still bounded so an instance that never
// converges cannot turn the observation into a reload loop.
const EntryConfirmationWindow = 2000
const EntryConfirmationInterval = 100

function resetToCompletion() {
  // The installed Clerk binding keeps serving the value its provider subscribed with,
  // and the Convex client inherits the same stale session, so no partial read inside
  // this document reaches the sign-in surface. A fresh document re-initializes both.
  // Normalize the URL first so the reload lands on the public completion route, and
  // replace state so the signed-out private view stays out of history.
  try { window.history.replaceState(null, '', browserCompletionUrl(window.location.href)) } catch { /* keep current URL */ }
  try { window.location.reload() } catch { /* blocked reload: nothing private is rendered either way */ }
}

function BrowserSession({ children, onSignedOut, clerkRef, bindingRef, signingOutRef, entryAttempt }: {
  children: ReactNode; onSignedOut?: () => unknown
  clerkRef: MutableRefObject<BrowserClerk | undefined>
  bindingRef: MutableRefObject<BindingSnapshot | undefined>
  signingOutRef: MutableRefObject<boolean>
  entryAttempt: number
}) {
  const clerk = useClerk()
  const { isLoaded, isSignedIn } = useAuth()
  const [entry, setEntry] = useState<'idle' | 'recovered' | 'failed'>('idle')
  const entryResetDone = useRef(false)
  useEffect(() => {
    clerkRef.current = clerk
    return () => { if (clerkRef.current === clerk) clerkRef.current = undefined }
  }, [clerk, clerkRef])
  useEffect(() => {
    bindingRef.current = { isLoaded, isSignedIn }
    return () => { bindingRef.current = undefined }
  }, [bindingRef, isLoaded, isSignedIn])
  async function logout() {
    signingOutRef.current = true
    try {
      await clerk.signOut({ redirectUrl: browserCompletionUrl(window.location.href) })
      await onSignedOut?.()
    } finally { signingOutRef.current = false }
    resetToCompletion()
  }
  // A completed password reset creates and activates a session, so this is an entry
  // transition, not a sign-out. The binding captured at mount can keep reporting the
  // signed-out value it subscribed with, so the transition is read from the instance
  // this component already holds, never from that binding value.
  useEffect(() => {
    if (!entryAttempt) return
    // A binding that already published the session needs no repair.
    if (!(isLoaded && !isSignedIn)) return
    if (entryResetDone.current) return
    const deadline = Date.now() + EntryConfirmationWindow
    let firstLook = true
    let timer: ReturnType<typeof setTimeout> | undefined
    let cancelled = false
    function settle() {
      if (cancelled || signingOutRef.current) return
      if (!firstLook) {
        // clerk-js awaits this completion callback before it emits the new session, so the
        // binding necessarily still reports signed-out at the first look: a sign-in or OAuth
        // return converges on its own a moment later. Only a later look may decide, and it
        // reads both sources this component can observe.
        //
        // A converged binding is the normal transition and needs no repair. A session on the
        // instance with the binding still stale is the reset's activation, which neither the
        // binding nor the Convex client can serve inside this document, so the reset follows
        // as soon as it is visible -- not after the window expires.
        const binding = bindingRef.current
        if (binding?.isLoaded && binding.isSignedIn) return
        const instance = clerkRef.current
        if (instance?.loaded && instance.session) {
          // Bounded: one document reset per transition. The instance can keep reporting
          // the same session forever inside this document, and that must not become a
          // reload loop.
          entryResetDone.current = true
          setEntry('recovered')
          resetToCompletion()
          return
        }
        // Only an exhausted window is a failure: a session that activates late is followed,
        // never pre-empted by a surface the session would contradict.
        if (Date.now() >= deadline) { setEntry('failed'); return }
      }
      firstLook = false
      timer = setTimeout(settle, EntryConfirmationInterval)
    }
    settle()
    return () => { cancelled = true; clearTimeout(timer) }
  }, [bindingRef, clerkRef, entryAttempt, isLoaded, isSignedIn, signingOutRef])
  // Nothing is rendered while the binding is stale: the document is being replaced, and
  // rendering the access landing first would flash its loading state. A binding that does
  // report the closed session keeps rendering the public surface as before.
  const bindingSignedOut = isLoaded && !isSignedIn
  // A real failure stays visible: the whole window closed with neither source reporting the
  // session, so the operator gets the reason and a way out instead of a ring. The copy states
  // what was observed -- no confirmation -- because the session may exist and simply not be
  // observable in this document, which is the very defect this window guards against.
  if (entry === 'failed') return <VisualShell title="Livefy">
    <Alert variant="destructive">
      <AlertDescription>Password reset incomplete. The new session could not be confirmed on this device; sign in again to continue.</AlertDescription>
    </Alert>
    <Button onClick={resetToCompletion}>Return to sign in</Button>
  </VisualShell>
  if (entry === 'recovered') return null
  return <SessionBoundary browser logout={logout} completedReady={bindingSignedOut} completedContent={bindingSignedOut ? children : null}>
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
  const bindingRef = useRef<BindingSnapshot | undefined>(undefined)
  const signingOutRef = useRef(false)
  // Each Clerk completion the app did not initiate is one entry transition, whether the
  // flow created a session (password reset, sign-in) or handed control back without one.
  const [entryAttempt, setEntryAttempt] = useState(0)
  const navigation = useMemo(() => {
    if (!modalNavigation) return undefined
    // The shared platform boundary erases browser-only binding from its prop type.
    if (!modalNavigation.withSession) throw new Error('Browser session navigation binding unavailable')
    return modalNavigation.withSession(() => {
      const clerk = clerkRef.current
      const signedIn = !!(clerk?.loaded && clerk.session)
      // Clerk calls this check only for its own completion target, so it marks the
      // moment the entry flow hands control back. A sign-out is the one completion that
      // must keep its accepted behavior, so it is never counted as an entry attempt.
      const binding = bindingRef.current
      if (binding && !binding.isSignedIn && !signingOutRef.current) setEntryAttempt(attempt => attempt + 1)
      return signedIn
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
    <BrowserSession onSignedOut={onSignedOut} clerkRef={clerkRef} bindingRef={bindingRef}
      signingOutRef={signingOutRef} entryAttempt={entryAttempt}>
      <ConvexProviderWithClerk client={client} useAuth={useAuth}>
        <AuthConfiguration configured>{children}</AuthConfiguration>
      </ConvexProviderWithClerk>
    </BrowserSession>
  </ClerkProvider>
}
