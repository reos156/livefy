import { Alert, AlertDescription } from '@/components/ui/alert'
import { createRootRoute, createRoute, createRouter, Link, Outlet, useNavigate, type RouterHistory } from '@tanstack/react-router'
import { VisualShell } from './components/visual-shell'
import { AccessLanding } from './access'
import { PrivateAccess } from './private-access'
import { LogoutButton } from './lib/session'

function PublicAccess() {
  const navigate = useNavigate()
  return <AccessLanding onEnterApp={() => { void navigate({ to: '/app' }) }} />
}
function PrivateApp() {
  return <PrivateAccess rejected={<><Alert role="status"><AlertDescription>Authentication required</AlertDescription></Alert><Link to="/">Return to access</Link></>}>
    <VisualShell title="Livefy app">
      <p>Backend access confirmed.</p>
      <LogoutButton />
      <Link to="/">Return to access</Link>
    </VisualShell>
  </PrivateAccess>
}
export function createAppRouter(history: RouterHistory) {
  const root = createRootRoute({ component: Outlet })
  const access = createRoute({ getParentRoute: () => root, path: '/', component: PublicAccess })
  const app = createRoute({ getParentRoute: () => root, path: '/app', component: PrivateApp })
  return createRouter({ routeTree: root.addChildren([access, app]), history })
}

declare module '@tanstack/react-router' {
  interface Register { router: ReturnType<typeof createAppRouter> }
}
