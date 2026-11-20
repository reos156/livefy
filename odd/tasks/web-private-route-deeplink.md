# Private route deep link renders an empty shell

## Specs

- **S1** Navigating to the private route while unauthenticated MUST show the
  `Authentication required` surface with its `Return to access` link, never a
  blank page.
- **S2** No uncaught error may abort the render: the same-origin guard MUST NOT
  throw for an in-app target that is not the completion route.
- **S3** Fail-closed stays: private content MUST NOT render without a confirmed
  backend identity.

## Evidence

Chromium, dev web build, 2026-11-20: `/#/app` unauthenticated renders only the
shell title `L Livefy` with an empty body and throws
`Unsupported browser completion target` from `src/platform/web/auth-ui.tsx:24`.
Reproduced in 6 of 6 matrix cases (3 widths × 2 themes).

Cause: `createBrowserNavigation.complete` throws whenever the target is neither
the completion URL nor its relative spelling, and Clerk or the router issues such
a navigation while booting on a non-completion route.

Found by the A2 acceptance matrix, not by the test suite: every existing case
navigates to the private route from an authenticated tree.

## Tasks

- [ ] T1 (S2) RED at the navigation seam: a same-origin in-app target that is not
  the completion route must not throw, and must not strand the view. Then fix,
  keeping the throw for cross-origin or unsupported targets.
- [ ] T2 (S1, S3) Confirm `Authentication required` renders at `/#/app`
  unauthenticated, still fail-closed, and re-run the matrix row for the private
  route at 320/375/1000 in both themes.

## Allowed edit surfaces
- apps/desktop/src/platform/web/auth-ui.tsx
- apps/desktop/src/platform/web/auth-ui.test.tsx
- apps/desktop/src/routes.tsx
- apps/desktop/src/private-access.tsx

## Log

- **L1** Defect found by the A2 matrix run, 2026-11-20. Not reported by a user;
  a deep link to the private route is simply broken today.
