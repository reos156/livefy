import { createRootRoute, createRoute, createRouter, Link, Outlet, useNavigate, type RouterHistory } from '@tanstack/react-router'
import { AccessLanding } from './access'
import { PrivateAccess } from './private-access'

function PublicAccess() {
  const navigate = useNavigate()
  return <AccessLanding onEnterApp={() => { void navigate({ to: '/app' }) }} />
}
function PrivateApp() {
  return <PrivateAccess rejected={<><p role="status">Authentication required</p><Link to="/">Return to access</Link></>}>
    <main className="mx-auto flex min-h-svh max-w-md flex-col justify-center gap-6 p-8">
      <h1 className="text-3xl font-semibold">Livefy app</h1>
      <p>Backend access confirmed.</p>
      <Link to="/">Return to access</Link>
    </main>
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
