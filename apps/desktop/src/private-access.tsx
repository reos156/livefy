import { Alert, AlertDescription } from '@/components/ui/alert'
import { VisualShell } from './components/visual-shell'
import { Spinner } from '@/components/kibo-ui/spinner'
import { useConvexAuth } from 'convex/react'
import type { ReactNode } from 'react'
import { useAuthConfigured } from './lib/auth'

function ConfirmedAccess({ children, rejected }: { children: ReactNode; rejected?: ReactNode }) {
  const { isLoading, isAuthenticated, isRefreshing } = useConvexAuth()
  // Announced only: the shell and brand stay on screen, no status text is painted.
  if (isLoading || isRefreshing) return <VisualShell title="Livefy">
    <Alert role="status" className="sr-only"><AlertDescription>Checking backend access</AlertDescription></Alert>
    <Spinner variant="ring" size={28} className="text-foreground" />
  </VisualShell>
  if (!isAuthenticated) return <VisualShell title="Livefy">{rejected ?? <Alert role="status"><AlertDescription>Authentication required</AlertDescription></Alert>}</VisualShell>
  return <>{children}</>
}

export function PrivateAccess({ children, rejected }: { children: ReactNode; rejected?: ReactNode }) {
  // Do not invoke Convex hooks outside the native provider boundary.
  if (!useAuthConfigured()) return <VisualShell title="Livefy"><Alert role="status"><AlertDescription>Authentication unavailable</AlertDescription></Alert></VisualShell>
  return <ConfirmedAccess rejected={rejected}>{children}</ConfirmedAccess>
}
