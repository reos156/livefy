import { useAuth, AuthUi, isNativePlatform } from './platform/auth'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { VisualShell } from './components/visual-shell'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/kibo-ui/spinner'
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
  // Announced to assistive technology only: the shared shell and brand stay on screen
  // and the operator sees a silent ring, not status text, while access is confirmed.
  const waiting = <>
    <Alert role="status" className="sr-only"><AlertDescription>Loading</AlertDescription></Alert>
    <Spinner variant="ring" size={28} className="text-foreground" />
  </>
  if (checking || !isLoaded) return waiting
  if (isAuthenticated) return <>
    <Alert role="status"><AlertDescription>Backend access confirmed</AlertDescription></Alert>
    {isNativePlatform() && <p>{persistence}</p>}
    <LogoutButton />
    {onEnterApp && <Button onClick={onEnterApp}>Open app</Button>}
  </>
  // Clerk controls only UI eligibility; it never grants private access.
  if (isSignedIn) return waiting
  return <AuthUi />
}
export function AccessLanding({ onEnterApp }: { onEnterApp?: () => void }) {
  const configured = useAuthConfigured()
  return <VisualShell title="Livefy" providerSurface={configured}>
    {configured ? <ConfiguredAccess onEnterApp={onEnterApp} /> : <>
      <p className="text-muted-foreground">
        Email and password access is not available yet. This desktop preview does not collect credentials.
      </p>
      <Button disabled>Sign in — coming soon</Button>
    </>}
  </VisualShell>
}
