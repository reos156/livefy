# Web logout stuck on a raw placeholder

## Objective
After a completed local sign-out in the web platform the app never leaves the
`Waiting for signed-out session confirmation` placeholder until the operator
reloads the page. Close the transition and remove the raw placeholder without
weakening the existing fail-closed gating.

This document is the authoritative record for the web sign-out transition. The
related W4/W5 work in [Web authentication parity](web-auth-parity.md) addressed a
different root cause in the same transition (a router acknowledgement deadlock
plus a transient status text); it is not a duplicate of this defect and neither
record closes the other.

## Specs

- **S1** After a completed local sign-out, the operator MUST reach the sign-in
  surface with no manual action of their own. The app may reset its own document
  to do it; what is forbidden is requiring the operator to reload by hand.
- **S2** The user-visible string `Waiting for signed-out session confirmation`
  MUST NOT reach the operator. Any post-sign-out status MUST render inside the
  shared shell (`VisualShell`) using an `Alert` with `role="status"`, per the
  visual contract in `apps/desktop/README.md`.
- **S3** Fail-closed MUST be preserved: private content MUST NOT render while
  Clerk reports an active session, and the existing access gating and guards
  stay unchanged.
- **S4** Electron MUST keep its accepted behavior: sign-out closes the app, and
  no new confirmation step is added.

## Verified root cause (measured, not inferred)
Playwright in Chromium against the real dev Clerk instance, user signed in via a
Clerk sign-in token, clicking the real `Sign out` button:

| moment | `Clerk.loaded` | `Clerk.session` | `client.sessions` | UI |
| --- | --- | --- | --- | --- |
| before sign-out | true | active | 1 | `/app` authenticated |
| +300 ms | true | null | 0 | placeholder |
| +7000 ms | true | null | 0 | placeholder |
| after manual reload | true | null | 0 | sign-in surface |

The SDK is correct within 300 ms. The React binding keeps serving
`isSignedIn: true`, so `completedReady = isLoaded && !isSignedIn` in
`src/platform/web/auth.tsx` can never become true and `SessionBoundary`
(`src/lib/session.tsx`) never leaves `ended`. A reload fixes it because the
binding is re-initialized. `@clerk/react` 6.17.6 bundles its own core and does
not expose `addListener`, so the binding cannot be notified directly.

## Tasks
- [ ] **DROPPED — superseded by T3, not open work.** T1 (S1, S3) Write the RED first, then fix the transition. The current test
  passes only because it calls `view.rerender(tree())` to manufacture the
  re-render the browser never performs; the new case must model the measured
  behavior instead: the binding value observed at mount stays stale after
  `signOut` resolves while `clerk.session` becomes null, and the sign-in surface
  still appears with no external re-render. Fix by forcing re-initialization of
  the Clerk binding after a resolved local sign-out, keeping every existing
  guard intact.
- [x] T2 (S2) PARTIAL — the raw `<p role="status">` is gone and the surface now
  renders inside `VisualShell` with `Alert role="status"`. S2 holds; the surface
  is still terminal, which is S1's failure below.
- [x] T3 (S1, S3) DONE. REPLACES T1's mechanism. T1 remounted the consumer of the
  binding (`BindingReader` keyed by a generation counter) on the assumption that
  a fresh mount re-reads the Clerk instance. Measured in Chromium: it does not.
  The stale value lives in the provider context, so remounting a consumer
  re-reads the same stale context and `completedReady` stays false forever.
  Derive completion from the Clerk instance the component already holds instead:
  after `await clerk.signOut(...)` and `await onSignedOut?.()`, record
  `clerk.loaded && !clerk.session` into local state (the instance reported
  `session: null` and `client.sessions: 0` within 300 ms in the browser).
  `completedReady` becomes that instance-derived confirmation OR the binding's
  `isLoaded && !isSignedIn`, so a healthy binding still works. Initial state
  stays fail-closed: no instance confirmation and the binding unconfirmed until
  it reports. No remount, no reload, no page navigation.
  The RED must model the measured staleness honestly: the stale snapshot belongs
  to the provider mount, so remounting a consumer keeps returning stale values.
  With that model the current keyed-remount code must fail and only an
  instance-derived completion can pass.
- [x] T4 (S1) DONE — completion resets the document, because a partial read is
  not sufficient: the Clerk React binding keeps the stale session and
  `ConvexProviderWithClerk` inherits it, leaving the access landing stuck on
  `Loading…` (observed by the human after T3). `logout` now normalizes the URL to
  the completion route with `history.replaceState` and calls
  `window.location.reload()`; the intermediate confirmation surface renders
  nothing, because the document is being replaced and, if the reload were
  blocked, the instance read would still surface the sign-in UI. Verified by the
  human: sign-out returns to the sign-in screen on its own.

## Allowed edit surfaces
- `apps/desktop/src/platform/web/auth.tsx`
- `apps/desktop/src/platform/web/main.test.tsx`
- `apps/desktop/src/lib/session.tsx`

## Checks
From `apps/desktop`: focused `npx vitest run src/platform/web/main.test.tsx`
observed RED before the fix and GREEN after, then `npm test`, `npm run
typecheck` and `npm run build`. Report the exact RED failures. No commits.

## Log
- **L1** User report (verbatim): «el sign out en electron se cierra la app asi se
  definio y en web sale esto … y si refresco ya pasa a la pantalla para iniciar
  sesion»
- **L2** User instruction (verbatim): «arregla el logut ahora antes de seguir»
- **L3** Discovery: Clerk dev instance has Cloudflare Turnstile active on sign-up;
  automated sign-up is impossible and is not bypassed. A Clerk sign-in token
  (official testing mechanism, minted with the authenticated `clerk` CLI) replaced
  it; the reproduction above is real UI, real SDK, real dev backend.
- **L4** Discovery: `Clerk.loaded` is true at +300 ms, so a stuck `isLoaded` is
  excluded; the session is gone, so the defect is the React binding, not the CDN
  or the backend.
- **L5** Human re-test of T1 in the Windows web app (verbatim): «sale esta
  pantalla pero no pasa automaticamente a la de inicio de sesion tengo que
  refrescar para eso», showing `Signed out` + `Confirming signed-out session.`
  T1's keyed consumer remount does not re-read the provider context. T2's shell
  surface is confirmed working in the browser; S1 is not met.
- **L6** Human re-test of T3 (verbatim): «se queda ahi» on `Loading…`. T3 works —
  the boundary leaves `ended` — and exposes the second consumer of the stale
  binding: the Convex client.
- **L7** Human re-test of T4 (verbatim): «hora ya funciona y vuelve al inicio se
  sesion pero se alcanza a ver la pantalla antes de volver al inicio de sesion,
  creeria que ya no es necesaria». S1 met; the transient surface was removed on
  request.