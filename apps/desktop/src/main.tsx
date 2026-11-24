import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createMemoryHistory, Outlet, RouterProvider } from '@tanstack/react-router'
import { AuthBoundary, isNativePlatform } from './platform/auth'
import { createAppRouter } from './routes'
import './styles.css'
import { createModalNavigation, publicCompletionUrl } from './platform/electron/auth-ui'
import { browserCompletionUrl, createBrowserNavigation } from './platform/web/auth-ui'

import { SessionContent, SessionInfrastructure } from './lib/session'

const router = createAppRouter(createMemoryHistory({ initialEntries: ['/'] }))
if (!isNativePlatform()) router.routeTree.update({ component: () => <SessionContent><Outlet /></SessionContent> })
const navigatePublic = (replace: boolean) => router.navigate({ to: '/', replace })
const modalNavigation = isNativePlatform()
  ? createModalNavigation(publicCompletionUrl(window.location.href), navigatePublic)
  : createBrowserNavigation(browserCompletionUrl(window.location.href), navigatePublic)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SessionInfrastructure><AuthBoundary endpoint={import.meta.env.VITE_CONVEX_URL} publishableKey={import.meta.env.VITE_CLERK_PUBLISHABLE_KEY} modalNavigation={modalNavigation} onSignedOut={() => router.navigate({ to: '/', replace: true })}>
      <RouterProvider router={router} />
    </AuthBoundary></SessionInfrastructure>
  </StrictMode>,
)
