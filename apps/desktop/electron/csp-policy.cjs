// Single source of truth for the renderer Content-Security-Policy.
//
// META_CSP is the policy the index.html meta tag carries. It is the only place
// the development-server websocket origin is allowed, because the dev renderer
// is served by Vite from http://127.0.0.1:5173 and talks to it over ws://.
//
// PRODUCTION_CSP is what the packaged renderer receives, from this one string,
// in two places that must never disagree:
//   1. the index.html meta tag, rewritten by the build transform in vite.config.ts;
//   2. the Content-Security-Policy response header of the livefy:// renderer
//      response produced by electron/protocol.cjs.
// The meta tag stays in the built document as the documented fallback for
// contexts that read only the document.
//
// csp.test.ts fails if the shipped index.html meta and META_CSP diverge, and
// electron/protocol.test.js fails if the header differs from the built policy.
const DEV_ONLY_ORIGIN = 'ws://127.0.0.1:5173'
const META_CSP = "default-src 'self'; script-src 'self' https://organic-snake-7233.clerk.accounts.dev https://challenges.cloudflare.com https://*.protect.clerk.com; style-src 'self' 'unsafe-inline'; connect-src 'self' https://organic-snake-7233.clerk.accounts.dev https://*.protect.clerk.com:* https://clerk-telemetry.com https://polite-parrot-887.convex.cloud wss://polite-parrot-887.convex.cloud https://polite-parrot-887.convex.site ws://127.0.0.1:5173; img-src 'self' https://img.clerk.com data:; worker-src 'self' blob:; object-src 'none'; frame-src 'self' https://challenges.cloudflare.com https://*.protect.clerk.com; base-uri 'none'; form-action 'none'"
const PRODUCTION_CSP = META_CSP.replace(` ${DEV_ONLY_ORIGIN}`, '')

function productionCsp(html) {
  // A build whose document drifted from this module would ship a meta tag that
  // disagrees with the response header, so refuse to produce it.
  if (!html.includes(META_CSP)) {
    throw new Error('index.html Content-Security-Policy meta does not match electron/csp-policy.cjs')
  }
  return html.replace(META_CSP, PRODUCTION_CSP)
}

module.exports = Object.freeze({ DEV_ONLY_ORIGIN, META_CSP, PRODUCTION_CSP, productionCsp })
