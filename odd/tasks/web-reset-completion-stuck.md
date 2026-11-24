# Web password reset leaves the operator on the waiting ring

## Specs

- **S1** After a completed password reset in the browser, the operator MUST reach
  the authenticated surface without a manual refresh. Today the document stays on
  the waiting ring at `#/` until the operator reloads by hand.
- **S2** The transition MUST be derived from the Clerk instance the component
  already holds, never from the binding snapshot taken at provider mount. This is
  the same measured mechanism as `web-logout-stuck.md` T3, in the opposite
  direction: the reset **creates and activates a session**, it does not sign out.
- **S3** Any document reset MUST be bounded: at most one per transition, and it
  MUST NOT loop when the instance never converges. A reload loop is a worse defect
  than the spinner it replaces.
- **S4** The native Electron path keeps its accepted behaviour, and the existing
  browser sign-out behaviour is unchanged.
- **S5** When the confirmation window expires with no session observable in the
  document, the app MUST perform its single bounded document reset instead of
  declaring failure. Measured twice by the operator: the session exists and only the
  in-document providers cannot see it, so re-initializing the document — the very
  action its own recovery button performed successfully — is the correct outcome,
  not a terminal card. A failure surface that asserts no session was created is
  forbidden: the operator demonstrated that claim was false.

## Tasks

- T1 (S1, S2, S3, S5) — route writer. RED first in
  `platform/web/main.test.tsx`, modelling the measured staleness (the binding value
  observed at mount stays stale; a consumer remount re-reads the same stale
  context), then the fix in `platform/web/auth.tsx`.
  Commit: pending.
- T2 — route gentle-ai-verify. Independent verification, including a
  non-repetition proof. Risk item 2 applies.
- T3 — human re-test on the web app by the operator. Required; source cannot
  settle it.

## Allowed edit surfaces
- apps/desktop/src/platform/web/auth.tsx
- apps/desktop/src/platform/web/main.test.tsx
- apps/desktop/src/platform/web/auth.test.tsx

## Log

- **L1** User report (verbatim): «todo funciona correctamente lo unico es que en la
  app web cuando cambio la contraseña no entra a la sino que se queda ahi hasta que
  le doy refresh, eso ya nos habia pasado antes en otras pantallas y lo corregiste,
  en la app desktop todo funciona correctamente». The same message confirms real
  email delivery, signup verification, the reset journey, the new password working
  and the old password failing — so H1.11's other criteria passed, and this is the
  only remaining defect.
- **L2** Read-only mapping before any write: the ring comes from `WaitingScreen`
  and the stall is in `useConvexAuth`, not in `isSignedIn` alone
  (`access.tsx:32-46`); the only document reset in the web adapter lives inside
  `logout()` (`platform/web/auth.tsx:23-33`) and has no counterpart for the entry
  transition; the installed SDK shows `resetPassword` moves the sign-in status to
  `complete` and activates a session, so the state is signed-in-with-a-new-session.
  What source cannot settle: which waiting branch renders the ring, whether the
  binding publishes the reset-created session, and which target Clerk hands back.
- **L3** Non-goal recorded: this is not the external-URL seam. The reset flow is
  code-based and stays inside the app (H1.8), so no deep-link or origin work
  belongs here.
- **L4** First implementation verified (`mwu7uogh-9-7cmp`): no reload loop could be
  constructed (a reload landing still stale resets once and stops; repeated
  completion navigations reset once per document), the failure surface requires both
  a completion navigation and a missing session, sign-out and the native path were
  untouched, and the RED was reproduced against the base file. It also found a
  regression the first cut introduced: clerk-js awaits the provider's navigate
  callback **before** emitting the new session, so the binding is necessarily stale
  at that moment and every sign-in or OAuth return would have taken one extra full
  document reload with a blank flash. Corrected by deferring the first decision by
  one tick and re-reading the binding: a converging binding is left alone, only a
  still-stale binding over an instance session resets, and the reset case keeps
  working. 415 tests, `tsc --noEmit` exit 0. That correction carries the writer's
  RED/GREEN and has not been re-verified independently; the operator's real-browser
  re-test (T3) is the authoritative check for S1.
- **L5** Known residual, recorded rather than hidden: the tick re-read goes through
  a ref, so if Clerk updates its context without re-rendering this consumer, the
  bounded single reset still happens — the flash survives that path, though it can
  never loop. And if clerk-js completes a code-based reset with no navigation
  callback at all, the recovery never fires and the operator falls back to today's
  ring plus manual refresh, with no failure surface shown.
- **L6** Operator re-test after the two-second window (verbatim): «no entiendo porque en
  la app de desktop todo es mas rapido y transparente que en la web que se queda
  colgado, volvio a pasar lo mismo y si le doy al return entra a la app, ademas luego de
  cambiar el password aparece una pantalla con un mensaje pero no alcance a tomarle foto
  por que se fue muy rapido a la pantalla del anillo de espera». Two facts follow. First,
  the card now renders centred inside the shared shell, so the earlier off-centre
  rendering was a stale bundle, not a layout defect. Second, and decisive: an expired
  window without a session is not a timing problem. The session is created and persists —
  the operator's own recovery button reloads straight into an authenticated app — while the
  in-document providers never observe it. That fits `setActive` awaiting the completion
  navigation that `createBrowserNavigation.complete` intercepts. Polling longer cannot fix
  it, so S5 was rewritten: the correct response to an expired window is the bounded
  document reset itself. The desktop shell differs structurally — it builds its own
  `Clerk` in process, with no CDN clerk-js and no hash-router completion interception —
  so its session is already present when the native resource boots.