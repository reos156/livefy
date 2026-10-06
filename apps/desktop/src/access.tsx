import { Button } from '@/components/ui/button'
import { useConvexAuth } from 'convex/react'
import { useEffect, useState } from 'react'
import { useAuthConfigured } from './lib/auth'

function NativeAccess() {
  const { isLoading, isAuthenticated } = useConvexAuth()
  const [persistence, setPersistence] = useState('Session persistence status unavailable')
  useEffect(() => {
    let active = true
    window.livefySession?.persistence().then(mode => {
      if (active) setPersistence(mode === 'encrypted' ? 'Encrypted session persistence' :
        'Memory-only session: encryption unavailable; session will not survive restart')
    }).catch(() => { /* Keep explicit unavailable status; never infer persistence. */ })
    return () => { active = false }
  }, [])
  return <>
    <p role="status">{isLoading ? 'Checking backend access' : isAuthenticated ?
      'Backend access confirmed' : 'No authenticated session confirmed'}</p>
    <p>{persistence}</p>
    <Button disabled>Sign in — coming soon</Button>
  </>
}
export function AccessLanding() {
  const configured = useAuthConfigured()
  return <main className="mx-auto flex min-h-svh max-w-md flex-col justify-center gap-6 p-8">
    <h1 className="text-3xl font-semibold">Livefy</h1>
    {configured ? <NativeAccess /> : <>
      <p className="text-muted-foreground">
        Email and password access is not available yet. This desktop preview does not collect credentials.
      </p>
      <Button disabled>Sign in — coming soon</Button>
    </>}
  </main>
}
