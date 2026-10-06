import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createHashHistory, createRootRoute, createRoute, createRouter, Outlet, RouterProvider } from '@tanstack/react-router'
import { AccessLanding } from './access'
import { AuthBoundary } from './lib/auth'
import './styles.css'

const rootRoute = createRootRoute({ component: Outlet })
const accessRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: AccessLanding,
})
const router = createRouter({
  routeTree: rootRoute.addChildren([accessRoute]),
  history: createHashHistory(),
})

declare module '@tanstack/react-router' {
  interface Register { router: typeof router }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthBoundary endpoint={import.meta.env.VITE_CONVEX_URL} publishableKey={import.meta.env.VITE_CLERK_PUBLISHABLE_KEY}>
      <RouterProvider router={router} />
    </AuthBoundary>
  </StrictMode>,
)
