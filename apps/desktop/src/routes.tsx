import { Alert, AlertDescription } from '@/components/ui/alert'
import { createRootRoute, createRoute, createRouter, Link, Outlet, useNavigate, type RouterHistory } from '@tanstack/react-router'
import { AppEntry } from './app-entry'
import { AccessLanding } from './access'
import { PrivateAccess } from './private-access'

function PublicAccess() {
  const navigate = useNavigate()
  return <AccessLanding onEnterApp={() => { void navigate({ to: '/app' }) }} />
}
function PrivateApp() {
  return <PrivateAccess rejected={<><Alert role="status"><AlertDescription>Authentication required</AlertDescription></Alert><Link to="/">Return to access</Link></>}>
    <AppEntry />
  </PrivateAccess>
}
// The browser document keeps Clerk's hash routing while in-app routes live in a
// memory router that always boots at "/". A private deep link therefore only reaches
// the app as the hash `#/app`. Seed that route, then hand the hash back to Clerk's
// completion step so the public access surface can still mount afterwards.
function deepLinkPath(hash: string) {
  return hash === '#/app' ? '/app' : undefined
}
export function createAppRouter(history: RouterHistory) {
  const deepLink = history.location.pathname === '/' ? deepLinkPath(window.location.hash) : undefined
  if (deepLink) {
    history.replace(deepLink)
    try { window.history.replaceState(window.history.state, '', '#/') } catch { /* keep the deep link if the document forbids rewriting it */ }
  }
  const root = createRootRoute({ component: Outlet })
  const access = createRoute({ getParentRoute: () => root, path: '/', component: PublicAccess })
  const app = createRoute({ getParentRoute: () => root, path: '/app', component: PrivateApp })
  return createRouter({ routeTree: root.addChildren([access, app]), history })
}

declare module '@tanstack/react-router' {
  interface Register { router: ReturnType<typeof createAppRouter> }
}
