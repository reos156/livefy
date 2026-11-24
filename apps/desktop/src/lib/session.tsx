import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { VisualShell } from '@/components/visual-shell'

const Session = createContext<(() => void) | undefined>(undefined)
const Infrastructure = createContext(false)
const Content = createContext<{ visible: boolean; fallback: ReactNode }>({ visible: true, fallback: null })
// Opt in only when all routed consumers sit behind SessionContent. Router's
// Transitioner must remain mounted outside this gate to acknowledge navigation.
export function SessionInfrastructure({ children }: { children: ReactNode }) {
  return <Infrastructure.Provider value>{children}</Infrastructure.Provider>
}
export function SessionContent({ children }: { children: ReactNode }) {
  const { visible, fallback } = useContext(Content)
  return visible ? children : fallback
}
export function LogoutButton() {
  const logout = useContext(Session)
  return <Button disabled={!logout} onClick={logout}>Sign out</Button>
}
export function SessionBoundary({ children, logout, browser = false, completedContent, completedReady = false }: {
  children: ReactNode; logout(): Promise<void>; browser?: boolean; completedContent?: ReactNode; completedReady?: boolean
}) {
  const [state, setState] = useState<'active' | 'pending' | 'failed' | 'ended'>('active')
  const lock = useRef(false)
  const infrastructure = useContext(Infrastructure) && browser
  useEffect(() => {
    if (browser && state === 'ended' && completedReady) setState('active')
  }, [browser, state, completedReady])
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
  const visible = state === 'active' || (browser && state === 'ended' && completedReady)
  if (visible) return <Session.Provider value={() => { void endSession() }}><Content.Provider value={{ visible: true, fallback: null }}>{children}</Content.Provider></Session.Provider>
  if (!infrastructure && browser && state === 'ended') return <Session.Provider value={() => { void endSession() }}>{completedContent}</Session.Provider>
  // Unmount auth consumers immediately, independently of provider promises or stale tokens.
  // Browser: the document resets after a successful sign-out, so no intermediate screen is
  // painted between the click and the reload. Only a real failure keeps a visible surface,
  // and the wait itself stays announced to assistive technology.
  const fallback = !browser || state === 'failed'
    ? <VisualShell title={{ pending: 'Signing out', ended: 'Signed out', failed: 'Sign-out incomplete' }[state]}>
      {state === 'pending' && <Alert role="status"><AlertDescription>Signing out locally…</AlertDescription></Alert>}
      {state === 'ended' && <Alert role="status"><AlertDescription>Signed out on this device.</AlertDescription></Alert>}
      {state === 'failed' && <>
        <Alert variant="destructive">
          <AlertDescription>{browser ? 'Sign-out incomplete. Private access remains blocked.' : 'Local sign-out incomplete; restart exclusion is not confirmed. Private access remains blocked.'}</AlertDescription>
        </Alert>
        <Button onClick={() => { void endSession() }}>{browser ? 'Retry sign-out' : 'Retry local sign-out'}</Button>
      </>}
      <p>Remote session revocation is unconfirmed, including when offline.</p>
      {!browser && <p>Livefy closes automatically after local sign-out succeeds. Relaunch before signing in again.</p>}
    </VisualShell>
    : state === 'ended' ? completedContent : <span role="status" className="sr-only">Signing out</span>
  return infrastructure ? <Session.Provider value={undefined}><Content.Provider value={{ visible: false, fallback }}>{children}</Content.Provider></Session.Provider> : fallback
}
