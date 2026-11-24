import { useAuth as useNativeAuth } from '@clerk/electron/react'
import { useAuth as useBrowserAuth } from '@clerk/react'
import { type ComponentProps } from 'react'
import { AuthBoundary as NativeBoundary } from './electron/auth'
import { ElectronAuthUi } from './electron/auth-ui'
import { AuthBoundary as BrowserBoundary, BrowserAuthUi } from './web/auth'

// The preload-owned bridge is fixed for the lifetime of an application document.
export function isNativePlatform() { return !!window.livefySession }
export function useAuth() {
  const usePlatformAuth = isNativePlatform() ? useNativeAuth : useBrowserAuth
  return usePlatformAuth()
}
export function AuthBoundary(props: ComponentProps<typeof NativeBoundary> & { onSignedOut?: () => unknown }) {
  return isNativePlatform() ? <NativeBoundary {...props} /> : <BrowserBoundary {...props} />
}
export function AuthUi() { return isNativePlatform() ? <ElectronAuthUi /> : <BrowserAuthUi /> }
