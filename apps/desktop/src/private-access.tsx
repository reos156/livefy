import { useConvexAuth } from 'convex/react'
import type { ReactNode } from 'react'
import { useAuthConfigured } from './lib/auth'

function ConfirmedAccess({ children, rejected }: { children: ReactNode; rejected?: ReactNode }) {
  const { isLoading, isAuthenticated, isRefreshing } = useConvexAuth()
  if (isLoading || isRefreshing) return <p role="status">Checking backend access</p>
  if (!isAuthenticated) return <>{rejected ?? <p role="status">Authentication required</p>}</>
  return <>{children}</>
}

export function PrivateAccess({ children, rejected }: { children: ReactNode; rejected?: ReactNode }) {
  // Do not invoke Convex hooks outside the native provider boundary.
  if (!useAuthConfigured()) return <p role="status">Authentication unavailable</p>
  return <ConfirmedAccess rejected={rejected}>{children}</ConfirmedAccess>
}
