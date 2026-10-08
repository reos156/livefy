import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createHashHistory, RouterProvider } from '@tanstack/react-router'
import { AuthBoundary } from './platform/electron/auth'
import { createAppRouter } from './routes'
import './styles.css'

const router = createAppRouter(createHashHistory())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthBoundary endpoint={import.meta.env.VITE_CONVEX_URL} publishableKey={import.meta.env.VITE_CLERK_PUBLISHABLE_KEY}>
      <RouterProvider router={router} />
    </AuthBoundary>
  </StrictMode>,
)
