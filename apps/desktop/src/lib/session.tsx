import { createContext, useContext, useRef, useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'

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
  return <main className="mx-auto flex min-h-svh max-w-md flex-col justify-center gap-6 p-8">
    {state === 'pending' && <p role="status">Signing out locally…</p>}
    {state === 'ended' && <p role="status">Signed out on this device.</p>}
    {state === 'failed' && <>
      <p role="alert">Local sign-out incomplete; restart exclusion is not confirmed. Private access remains blocked.</p>
      <Button onClick={() => { void endSession() }}>Retry local sign-out</Button>
    </>}
    <p>Remote session revocation is unconfirmed, including when offline.</p>
    <p>Livefy closes automatically after local sign-out succeeds. Relaunch before signing in again.</p>
  </main>
}
