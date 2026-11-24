import { ClerkProvider, useAuth, useClerk } from '@clerk/react'
import { ConvexReactClient } from 'convex/react'
import { ConvexProviderWithClerk } from 'convex/react-clerk'
import { type ReactNode, type MutableRefObject, useEffect, useMemo, useRef, useState } from 'react'
import { AuthConfiguration } from '../../lib/auth'
import { SessionBoundary } from '../../lib/session'
import { browserCompletionUrl, createBrowserNavigation } from './auth-ui'
export { BrowserAuthUi } from './auth-ui'

type BrowserClerk = ReturnType<typeof useClerk>
// Read-only seam for the shared access landing: whether this document's Clerk instance holds a
// session of its own, including one that has not finished activating. In the installed SDK the gap
// is exactly the activating session: `clerk.isSignedIn` is `session?.status !== 'pending' &&
// !!session`, and `useAuth()` (via `resolveAuthState`, `treatPendingAsSignedOut` defaults to true)
// reports `isSignedIn: false, isLoaded: true` while the session's status is `pending`. So `!!session`
// is false only when there is no session at all, which is what makes it the right read here: a
// document that boots with an activating session would otherwise paint the sign-in surface
// (measured: ring, sign-in flash, app) until the session becomes active. Nothing here waits or
// polls: it is the session the instance already holds, and the landing is the only consumer.
export function useInstanceSession() {
  const clerk = useClerk()
  return !!clerk.session
}
// The binding value the provider captured at mount, as the session boundary observes it.
type BindingSnapshot = { isLoaded: boolean; isSignedIn: boolean | undefined }
// A completed entry can hand control back well before the session it activated is
// observable here, so the transition observes both sources it holds for a bounded window.
// The window is not a failure threshold any more: measured twice by the operator, an expired
// window still ended with the session present and only the in-document providers blind to it
// (their own recovery reload came up authenticated), which fits clerk-js `setActive` awaiting
// the completion navigation that `createBrowserNavigation.complete` intercepts. Polling longer
// cannot change that, so expiry means "reset the document now", and the bound only exists so
// the observation can never become a reload loop.
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
  // Set when this transition has asked for its one document reset: the document is being
  // replaced, so nothing is rendered in the meantime.
  const [resetting, setResetting] = useState(false)
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
        // Two shapes of the same blind document both end here: a session the instance reports
        // while the binding stays stale, and a window that expires with no session observable
        // at all. The operator measured the second shape twice -- the session exists and
        // persists, only this document cannot see it -- so the answer to both is the recovery
        // the operator performed by hand, not a surface claiming the session is missing.
        //
        // Bounded: one document reset per transition. The instance can keep reporting the
        // same session forever inside this document, and that must not become a reload loop.
        if ((instance?.loaded && instance.session) || Date.now() >= deadline) {
          entryResetDone.current = true
          setResetting(true)
          resetToCompletion()
          return
        }
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
  // The document is being replaced, so nothing is painted: no waiting ring, no failure card
  // and no claim about the session. The new document decides on its own -- if it still cannot
  // confirm, it shows the ordinary sign-in surface like any other signed-out document.
  if (resetting) return null
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
