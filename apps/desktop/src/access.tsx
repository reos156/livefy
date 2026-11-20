import { useAuth, AuthUi, isNativePlatform } from './platform/auth'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { VisualShell } from './components/visual-shell'
import { WaitingScreen } from './components/waiting-screen'
import { Button } from '@/components/ui/button'
import { useConvexAuth } from 'convex/react'
import { useEffect, useState } from 'react'
import { useAuthConfigured } from './lib/auth'
import { LogoutButton } from './lib/session'

function ConfiguredAccess({ onEnterApp }: { onEnterApp?: () => void }) {
  const { isLoading, isAuthenticated, isRefreshing } = useConvexAuth()
  const { isLoaded, isSignedIn } = useAuth()
  const checking = isLoading || isRefreshing
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
  // Announced to assistive technology only: the ring is the only painted element
  // while access is confirmed, and no status text is shown.
  const waiting = <WaitingScreen label="Loading" />
  if (checking || !isLoaded) return waiting
  if (isAuthenticated) return <VisualShell title="Livefy" providerSurface>
    <Alert role="status"><AlertDescription>Backend access confirmed</AlertDescription></Alert>
    {isNativePlatform() && <p>{persistence}</p>}
    <LogoutButton />
    {onEnterApp && <Button onClick={onEnterApp}>Open app</Button>}
  </VisualShell>
  // Clerk controls only UI eligibility; it never grants private access.
  if (isSignedIn) return waiting
  return <VisualShell title="Livefy" providerSurface><AuthUi /></VisualShell>
}
export function AccessLanding({ onEnterApp }: { onEnterApp?: () => void }) {
  const configured = useAuthConfigured()
  // ConfiguredAccess owns the shell so the wait can paint the ring alone on it.
  if (configured) return <ConfiguredAccess onEnterApp={onEnterApp} />
  return <VisualShell title="Livefy">
    <p className="text-muted-foreground">
      Email and password access is not available yet. This desktop preview does not collect credentials.
    </p>
    <Button disabled>Sign in — coming soon</Button>
  </VisualShell>
}
