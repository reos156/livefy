import { ConvexAuthProvider } from '@convex-dev/auth/react'
import { ConvexReactClient } from 'convex/react'
import type { ReactNode } from 'react'

const expectedEndpoint = 'https://polite-parrot-887.convex.cloud'
let client: ConvexReactClient | undefined

export function validEndpoint(endpoint: string | undefined): endpoint is string {
  return endpoint === expectedEndpoint
}

export function AuthBoundary({ endpoint, children }: { endpoint?: string; children: ReactNode }) {
  if (!validEndpoint(endpoint)) {
    return <><p role="status">Authentication unavailable: deployment configuration missing or invalid.</p>{children}</>
  }
  // One client, including across StrictMode's repeated renders. Password-only:
  // never consume OAuth codes from a renderer URL.
  client ??= new ConvexReactClient(endpoint)
  return <ConvexAuthProvider client={client} shouldHandleCode={false}>{children}</ConvexAuthProvider>
}
