import { createContext, useContext, useRef, useState, type ReactNode } from 'react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { VisualShell } from '@/components/visual-shell'

const Session = createContext<(() => void) | undefined>(undefined)
export function LogoutButton() {
  const logout = useContext(Session)
  return <Button disabled={!logout} onClick={logout}>Sign out</Button>
}
export function SessionBoundary({ children, logout }: { children: ReactNode; logout(): Promise<void> }) {
  const [state, setState] = useState<'active' | 'pending' | 'failed' | 'ended'>('active')
  const lock = useRef(false)
  async function endSession() {
    if (lock.current) return
    lock.current = true
    setState('pending')
    try {
      await logout()
      setState('ended')
    } catch {
      setState('failed')
    } finally { lock.current = false }
  }
  if (state === 'active') return <Session.Provider value={() => { void endSession() }}>{children}</Session.Provider>
  // Unmount auth consumers immediately, independently of provider promises or stale tokens.
  return <VisualShell title={{ pending: 'Signing out', ended: 'Signed out', failed: 'Sign-out incomplete' }[state]}>
    {state === 'pending' && <Alert role="status"><AlertDescription>Signing out locally…</AlertDescription></Alert>}
    {state === 'ended' && <Alert role="status"><AlertDescription>Signed out on this device.</AlertDescription></Alert>}
    {state === 'failed' && <>
      <Alert variant="destructive">
        <AlertDescription>Local sign-out incomplete; restart exclusion is not confirmed. Private access remains blocked.</AlertDescription>
      </Alert>
      <Button onClick={() => { void endSession() }}>Retry local sign-out</Button>
    </>}
    <p>Remote session revocation is unconfirmed, including when offline.</p>
    <p>Livefy closes automatically after local sign-out succeeds. Relaunch before signing in again.</p>
  </VisualShell>
}
