import { ClerkProvider, SignIn } from '@clerk/react'
import { type ComponentProps } from 'react'

type RouterCallback = NonNullable<ComponentProps<typeof ClerkProvider>['routerPush']>
type NavigationMetadata = Parameters<RouterCallback>[1]

export function browserCompletionUrl(documentUrl: string) {
  const url = new URL(documentUrl)
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new Error('Unsupported browser document URL')
  }
  url.search = ''
  url.hash = '/'
  return url.href
}

// clerk-js resolves its auth steps inside this document's hash, and the app's own
// routes live in a memory router that never writes that hash. A same-origin http(s)
// target without credentials is therefore an in-app destination the app already owns:
// it must never abort the render, and it is deliberately not delegated here.
function isInAppTarget(to: string) {
  let target: URL
  try { target = new URL(to, window.location.href) } catch { return false }
  return ['http:', 'https:'].includes(target.protocol) && !target.username && !target.password &&
    target.origin === window.location.origin
}

export function createBrowserNavigation(completionUrl: string, navigate: (replace: boolean) => unknown) {
  // Only completion enters the shared memory router; Clerk owns all auth-step hashes.
  function complete(to: string, replace: boolean, metadata: NavigationMetadata, hasSession: () => boolean) {
    const completion = new URL(completionUrl)
    // clerk-js navigate supplies same-origin URLs as pathname + search + hash.
    // Compare the canonical spelling, not arbitrary URL-resolved redirects.
    const relativeCompletion = completion.pathname + completion.search + completion.hash
    if (to !== completionUrl && to !== relativeCompletion) {
      // Leave in-app targets to the app instead of throwing; only genuinely
      // unsupported destinations below stay refused.
      if (isInAppTarget(to)) return
      throw new Error('Unsupported browser completion target')
    }
    if (browserCompletionUrl(window.location.href) !== completionUrl) throw new Error('Unsupported browser completion document')
    if (!hasSession()) {
      if (!metadata?.windowNavigate) throw new Error('Browser navigation metadata unavailable')
      return metadata.windowNavigate(completionUrl)
    }
    if (window.location.href !== completionUrl) {
      window.history.replaceState(window.history.state, '', completionUrl)
    }
    return navigate(replace)
  }
  function withSession(hasSession: () => boolean) {
    return {
      routerPush: (to: string, metadata?: NavigationMetadata) => complete(to, false, metadata, hasSession),
      routerReplace: (to: string, metadata?: NavigationMetadata) => complete(to, true, metadata, hasSession),
    }
  }
  // An unbound adapter has unknown session state and must not enter the memory router.
  return { ...withSession(() => false), withSession }
}

export function BrowserAuthUi() {
  const completionUrl = browserCompletionUrl(window.location.href)
  return <SignIn routing="hash" withSignUp oauthFlow="redirect" signInUrl={completionUrl}
    forceRedirectUrl={completionUrl} signUpForceRedirectUrl={completionUrl}
    appearance={{
      variables: {
        colorPrimary: 'var(--primary)', colorPrimaryForeground: 'var(--primary-foreground)',
        colorBackground: 'var(--card)', colorForeground: 'var(--foreground)',
        colorMuted: 'var(--muted)', colorMutedForeground: 'var(--muted-foreground)',
        colorInput: 'var(--input)', colorInputForeground: 'var(--foreground)',
        colorBorder: 'var(--border)', colorRing: 'var(--ring)', colorDanger: 'var(--destructive)',
        borderRadius: 'var(--radius)', fontFamily: "'Geist Variable', ui-sans-serif, sans-serif",
      },
      elements: { rootBox: { width: '100%' }, cardBox: { width: '100%' } },
    }} />
}
