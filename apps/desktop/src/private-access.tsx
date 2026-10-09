import { Alert, AlertDescription } from '@/components/ui/alert'
import { VisualShell } from './components/visual-shell'
import { useConvexAuth } from 'convex/react'
import type { ReactNode } from 'react'
import { useAuthConfigured } from './lib/auth'

function ConfirmedAccess({ children, rejected }: { children: ReactNode; rejected?: ReactNode }) {
  const { isLoading, isAuthenticated, isRefreshing } = useConvexAuth()
  if (isLoading || isRefreshing) return <VisualShell title="Livefy"><Alert role="status"><AlertDescription>Checking backend access</AlertDescription></Alert></VisualShell>
  if (!isAuthenticated) return <VisualShell title="Livefy">{rejected ?? <Alert role="status"><AlertDescription>Authentication required</AlertDescription></Alert>}</VisualShell>
  return <>{children}</>
}

export function PrivateAccess({ children, rejected }: { children: ReactNode; rejected?: ReactNode }) {
  // Do not invoke Convex hooks outside the native provider boundary.
  if (!useAuthConfigured()) return <VisualShell title="Livefy"><Alert role="status"><AlertDescription>Authentication unavailable</AlertDescription></Alert></VisualShell>
  return <ConfirmedAccess rejected={rejected}>{children}</ConfirmedAccess>
}
