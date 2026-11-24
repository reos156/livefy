# Silent loading states and sign-out sequence

## Objective
Remove the technical status texts that flash during initialization and during a
browser sign-out, without changing the native Electron path and without hiding
real errors.

## Specs

- **S1** On initial load, no status text is shown to the operator. The shared
  shell and its brand stay visible; the status is announced to assistive
  technology only, so accessibility is preserved without visual noise.
- **S2** In the browser, a sign-out shows no intermediate screen: no
  `Signing out locally…`, and nothing between the click and the document reset.
  The last authenticated frame stays on screen until the reload replaces it.
- **S3** The native Electron path keeps its current texts and behaviour,
  including the automatic close and its explanatory line.
- **S4** Real failures stay visible: a failed sign-out still renders its
  destructive alert with the retry action, and a rejected private route still
  explains that authentication is required.
- **S5** No user-visible string in these paths may be developer jargon.

## Context
Today the same wait is labelled three different ways in three files
(`Loading…`, `Loading authentication`, `Checking backend access`), all
user-visible, and the browser sign-out renders `Signing out locally…` before the
document reset. `src/lib/session.tsx` is shared with Electron, so every change
there must be browser-scoped.

## Tasks
- [x] T1 (S1, S4) DONE. The waiting branch paints only the Kibo ring on the
  shared shell through `src/components/waiting-screen.tsx`; the status survives
  as an `sr-only` `role="status"` Alert in `src/access.tsx` (`ConfiguredAccess`)
  and `src/private-access.tsx` (`ConfirmedAccess`). The rejected and required
  messages stay visible, pinned by `src/access.test.tsx:37,126`.
- [x] T2 (S2, S3, S4) DONE. `src/lib/session.tsx` suppresses the browser
  `pending`/`ended` screens and keeps the native path, the `failed` alert and
  the retry action unchanged; `src/platform/web/main.test.tsx:91,185,212` and
  `src/lib/session.test.tsx:52` assert the suppressed strings never reach the
  browser.
- [ ] T3 (S5) PARTIAL. No visible jargon remains on these paths, but the
  accessible labels still read `Checking backend access`
  (`src/private-access.tsx:11`) by design from L5. S5 holds for visible strings;
  the `sr-only` wording needs the operator's decision before this closes.

## Allowed edit surfaces
- apps/desktop/src/access.tsx
- apps/desktop/src/private-access.tsx
- apps/desktop/src/routes.tsx
- apps/desktop/src/lib/session.tsx
- apps/desktop/src/access.test.tsx
- apps/desktop/src/routes.test.tsx
- apps/desktop/src/lib/session.test.tsx
- apps/desktop/src/platform/web/main.test.tsx

## Checks
From `apps/desktop`: focused tests for the touched files observed RED where a
user-visible expectation changes, then GREEN; then `npm test`, `npm run
typecheck`, `npm run build`. Report every test whose expectation had to change
and why, and confirm the native assertions are still asserted. No commits, no
installs, no dependency changes.

## Log
- **L1** User report (verbatim): «no se si puedas verlo pero cada refresco de la
  pagina muestra esta pantalla … y cuando se hace el signout muestra una
  pantalla de sigout y la de loading de forma muy rapida y finalmente la
  pantalla de inicio de sesion, en verdad son necesarias esas pantallas ?»
- **L2** User decision (verbatim): «A - Silencioso, sin textos de estado».
- **L3** Loading design exploration (2026-11-20): produced `design/livefy-loading/`
  with three alternatives for the initial wait, all built from official shadcn/ui
  items — `01-spinner-lockup.html` (registry `spinner`),
  `02-skeleton-body.html` (registry `skeleton`) and
  `03-progress-milestones.html` (registry `progress`) — plus `design/system.md`
  and `design/system.html` synced read-only from `apps/desktop/src/styles.css`.
  No artboard is chosen and no application source changed; the next step is the
  operator's pick, and the chosen direction also needs its registry item
  installed (`bunx --bun shadcn@latest add spinner|skeleton|progress`).
- **L4** Loading cue decision (2026-11-20): the hand-written pulse and the three
  earlier directions were rejected; the cue is the Kibo UI `ring` spinner, no
  visible text, `text-foreground` with `currentColor` at 1.75rem, rendered in the
  `ConfiguredAccess` waiting branch and the `ConfirmedAccess` checking branch
  while the existing `sr-only` `role="status"` Alert stays the only live region.
  Installed from the official registries only: `npx shadcn@latest add spinner`
  (`src/components/ui/spinner.tsx`) then
  `npx shadcn@latest add https://www.kibo-ui.com/r/spinner.json`
  (`src/components/kibo-ui/spinner/index.tsx`, MIT, imports rewritten to this
  project's `@/` aliases); `.brand-loader`, `.brand-dots`, `@keyframes
  brand-pulse` and `@keyframes brand-dot` were removed from `src/styles.css` and
  `VisualShell` no longer takes `busy`. No commit made.
- **L5** Ring-only wait (2026-11-20): the mark, the brand word and the ring read as three
  unrelated objects during the wait, so the wait now paints the ring alone on the
  shared `.visual-shell` background — no `visual-mark`, no `h1`, no card — through a
  small shared `src/components/waiting-screen.tsx` used by the `ConfiguredAccess`
  waiting branch (`access.tsx`, which now owns the shell so the ring can stand alone)
  and the `ConfirmedAccess` checking branch (`private-access.tsx`); the `sr-only`
  `role="status"` Alert stays the only live region, the ring keeps its Kibo size and
  colour, and every non-waiting surface renders byte-identical DOM to the base commit.
