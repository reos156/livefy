import { useAuth, AuthUi, isNativePlatform } from './platform/auth'
import { useInstanceSession } from './platform/web/auth'
import { VisualShell } from './components/visual-shell'
import { WaitingScreen } from './components/waiting-screen'
import { Button } from '@/components/ui/button'
import { useConvexAuth } from 'convex/react'
import { useEffect, useRef, useState } from 'react'
import { useAuthConfigured } from './lib/auth'

function ConfiguredAccess({ onEnterApp, instanceSession }: {
  onEnterApp?: () => void
  // A session this document holds that Convex has not confirmed yet.
  instanceSession: boolean
}) {
  const { isLoading, isAuthenticated, isRefreshing } = useConvexAuth()
  const { isLoaded, isSignedIn } = useAuth()
  const checking = isLoading || isRefreshing
  // The persistence line this used to paint lived only on the confirmed surface this change
  // removes, so nothing reports persistence any more. Accepted here: the capability check is
  // left exactly as it was and re-surfacing it is a follow-up, not part of entering directly.
  const [persistence, setPersistence] = useState('Session persistence status unavailable')
  useEffect(() => {
    if (!isNativePlatform()) return
    let active = true
    window.livefySession?.persistence().then(mode => {
      if (active) setPersistence(mode === 'encrypted' ? 'Encrypted session persistence' :
        'Memory-only session: encryption unavailable; session will not survive restart')
    }).catch(() => { /* Keep explicit unavailable status; never infer persistence. */ })
    return () => { active = false }
  }, [])
  // Confirmed access enters the app on its own, and the lock is per mount: re-renders carry a
  // fresh `onEnterApp` from the router every pass, so this is what keeps them from asking the
  // memory router for a second navigation while the first is still in flight. `checking` is
  // part of the condition so a refresh never enters on an unconfirmed session.
  const confirmed = isAuthenticated && isLoaded && !checking
  const entered = useRef(false)
  useEffect(() => {
    if (!confirmed || !onEnterApp || entered.current) return
    entered.current = true
    onEnterApp()
  }, [confirmed, onEnterApp])
  // Announced to assistive technology only: the ring is the only painted element
  // while access is confirmed, and no status text is shown.
  const waiting = <WaitingScreen label="Loading" />
  if (checking || !isLoaded) return waiting
  // Nothing is offered here any more: `Sign out` lives inside the app now, and the confirmed
  // surface paints the same ring the wait does while the entry navigation is in flight. A
  // landing rendered without `onEnterApp` paints the ring too, never a dead control.
  if (isAuthenticated) return waiting
  // Clerk controls only UI eligibility; it never grants private access. A session the document
  // already holds is not a signed-in document -- the browser boots with the session its reset
  // created, Convex has not authenticated it yet, and Clerk reports it as signed out while it
  // activates, which is the flash measured between the ring and the app. Unconfirmed keeps the
  // ring; only a settled unauthenticated Convex with no session at all reaches the sign-in form.
  if (isSignedIn || instanceSession) return waiting
  return <VisualShell title="Livefy" providerSurface><AuthUi /></VisualShell>
}
// The instance view exists only in the browser: there one document composes clerk-js hydrating
// from the CDN, the Convex client authenticating itself and Clerk driving our router, which is
// how a session can be present before Convex confirms it. The native shell builds its own Clerk
// in process -- its session is already there when the resource boots -- so it composes the
// landing without the instance view and keeps the accepted gate it had.
function BrowserInstanceAccess({ onEnterApp }: { onEnterApp?: () => void }) {
  return <ConfiguredAccess onEnterApp={onEnterApp} instanceSession={useInstanceSession()} />
}
export function AccessLanding({ onEnterApp }: { onEnterApp?: () => void }) {
  const configured = useAuthConfigured()
  // ConfiguredAccess owns the shell so the wait can paint the ring alone on it.
  if (configured) return isNativePlatform()
    ? <ConfiguredAccess onEnterApp={onEnterApp} instanceSession={false} />
    : <BrowserInstanceAccess onEnterApp={onEnterApp} />
  return <VisualShell title="Livefy">
    <p className="text-muted-foreground">
      Email and password access is not available yet. This desktop preview does not collect credentials.
    </p>
    <Button disabled>Sign in — coming soon</Button>
  </VisualShell>
}
