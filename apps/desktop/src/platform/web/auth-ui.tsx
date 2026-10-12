import { SignIn } from '@clerk/react'

export function browserCompletionUrl(documentUrl: string) {
  const url = new URL(documentUrl)
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new Error('Unsupported browser document URL')
  }
  url.search = ''
  url.hash = '/'
  return url.href
}

export function createBrowserNavigation(completionUrl: string, navigate: (replace: boolean) => unknown) {
  // Only completion enters the shared memory router; Clerk owns all auth-step hashes.
  function complete(to: string, replace: boolean) {
    const completion = new URL(completionUrl)
    // clerk-js navigate supplies same-origin URLs as pathname + search + hash.
    // Compare the canonical spelling, not arbitrary URL-resolved redirects.
    const relativeCompletion = completion.pathname + completion.search + completion.hash
    if (to !== completionUrl && to !== relativeCompletion) throw new Error('Unsupported browser completion target')
    if (browserCompletionUrl(window.location.href) !== completionUrl) throw new Error('Unsupported browser completion document')
    if (window.location.href !== completionUrl) {
      const oldURL = window.location.href
      window.history.replaceState(window.history.state, '', completionUrl)
      window.dispatchEvent(new HashChangeEvent('hashchange', { oldURL, newURL: window.location.href }))
    }
    return navigate(replace)
  }
  return {
    routerPush: (to: string) => complete(to, false),
    routerReplace: (to: string) => complete(to, true),
  }
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
