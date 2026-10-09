import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { VisualShell } from './components/visual-shell'
import { Button } from '@/components/ui/button'
import { Registration } from './registration'
import { useConvexAuth } from 'convex/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { SignIn } from './sign-in'
import { useSignInAdapter } from './lib/sign-in'
import { useAuthConfigured } from './lib/auth'
import { LogoutButton } from './lib/session'

function ConfiguredAccess({ onEnterApp }: { onEnterApp?: () => void }) {
  const { isLoading, isAuthenticated, isRefreshing } = useConvexAuth()
  const checking = isLoading || isRefreshing
  const adapter = useSignInAdapter()
  const [view, setView] = useState<'sign-in' | 'registration'>('sign-in')
  const switchLock = useRef(false)
  const [pending, setPending] = useState(false)
  const onPendingChange = useCallback((value: boolean) => {
    switchLock.current = value; setPending(value)
  }, [])
  const [persistence, setPersistence] = useState('Session persistence status unavailable')
  useEffect(() => {
    let active = true
    adapter.persistence().then(mode => {
      if (active) setPersistence(mode === 'encrypted' ? 'Encrypted session persistence' :
        'Memory-only session: encryption unavailable; session will not survive restart')
    }).catch(() => { /* Keep explicit unavailable status; never infer persistence. */ })
    return () => { active = false }
  }, [])
  return <>
    <Alert role="status"><AlertDescription>{checking ? 'Checking backend access' : isAuthenticated ?
      'Backend access confirmed' : 'No authenticated session confirmed'}</AlertDescription></Alert>
    <p>{persistence}</p>
    {!checking && isAuthenticated && <LogoutButton />}
    {!checking && isAuthenticated && onEnterApp && <Button onClick={onEnterApp}>Open app</Button>}
    {!checking && !isAuthenticated && <>
      <Separator />
      {view === 'sign-in' ? <SignIn onPendingChange={onPendingChange} /> : <Registration onPendingChange={onPendingChange} />}
      <Button variant="outline" disabled={pending || adapter.fetching} onClick={() => {
        if (!switchLock.current && !adapter.fetching) setView(view === 'sign-in' ? 'registration' : 'sign-in')
      }}>{view === 'sign-in' ? 'Create an account' : 'Use an existing account'}</Button>
    </>}
  </>
}
export function AccessLanding({ onEnterApp }: { onEnterApp?: () => void }) {
  const configured = useAuthConfigured()
  return <VisualShell title="Livefy">
    {configured ? <ConfiguredAccess onEnterApp={onEnterApp} /> : <>
      <p className="text-muted-foreground">
        Email and password access is not available yet. This desktop preview does not collect credentials.
      </p>
      <Button disabled>Sign in — coming soon</Button>
    </>}
  </VisualShell>
}
