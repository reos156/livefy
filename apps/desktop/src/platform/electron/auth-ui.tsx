import { SignIn } from '@clerk/electron/react'

export function publicCompletionUrl(rendererUrl: string): string {
  const url = new URL(rendererUrl)
  // Match the raw custom URL too: URL parsing normalizes dot paths and controls.
  const trustedRenderer = url.protocol === 'livefy:' &&
    /^livefy:\/\/renderer\/(?:[?#][^\u0000-\u0020\u007f]*)?$/.test(rendererUrl)
  if ((!['http:', 'https:', 'file:'].includes(url.protocol) && !trustedRenderer) || url.username || url.password) {
    throw new Error('Unsupported renderer URL')
  }
  url.search = ''
  url.hash = '/'
  return url.href
}

type NavigationMetadata = { windowNavigate: (to: URL | string) => void }
export function createModalNavigation(completionUrl: string, navigate: (replace: boolean) => unknown) {
  function complete(to: string, replace: boolean) {
    // Only this literal alias is eligible; URL equivalence alone admits normalization tricks.
    // Resolved equality also prevents a root alias from changing HTTP/file document paths.
    const safeRootAlias = to === '/#/' && new URL(to, completionUrl).href === completionUrl
    if (to !== completionUrl && !safeRootAlias) {
      throw new Error('Unsupported Clerk completion target')
    }
    // Helpers for another document must not mutate the active renderer.
    if (typeof window !== 'undefined' && publicCompletionUrl(window.location.href) === completionUrl && window.location.hash !== '#/') {
      if (replace) {
        const oldURL = window.location.href
        window.history.replaceState(window.history.state, '', '#/')
        window.dispatchEvent(new HashChangeEvent('hashchange', { oldURL, newURL: window.location.href }))
      } else {
        // A same-document hash push emits the native hashchange event.
        window.location.hash = '#/'
      }
    }
    return navigate(replace)
  }
  return {
    routerPush: (to: string, _metadata?: NavigationMetadata) => complete(to, false),
    routerReplace: (to: string, _metadata?: NavigationMetadata) => complete(to, true),
  }
}

// Zero-prop bootstrap seam; Clerk remains owned by the existing AuthBoundary.
export function ElectronAuthUi() {
  const completionUrl = publicCompletionUrl(window.location.href)
  return <SignIn routing="hash" withSignUp signInUrl={completionUrl}
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
