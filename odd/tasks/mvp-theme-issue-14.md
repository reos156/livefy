# Livefy shared visual foundation — issue #14

## Objective and authorization
User authorized installing Claude version green and applying it to existing screens. Tracker: https://github.com/reos156/livefy/issues/14.
Use the existing shared React presentation; Electron first and future responsive web. Screens for future product features are excluded.

## Scope and constraints
Theme source: https://tweakcn.com/r/themes/cmsjfxfkj000304jj9wfw6u75 (registry:style). Preserve auth behavior, handlers, accessibility, CAPTCHA, native adapters, CSP and business authority. No remote font requests or guessed font assets. Preserve existing unrelated untracked files. Git baseline: feat/mvp, no tracked changes or staged changes; several unrelated untracked paths remain untouched.
No push, PR or merge authorized. User explicitly authorized updating issue #14 and committing the verified theme/migration on 2026-10-09. No push, PR, merge or issue closure authorized.

## Closure continuation — 2026-10-11 (current authority)

This section supersedes historical pending and delivery notes only where evidence below is explicit. User authorized continuing issue #14 implementation; no new commit, push, PR, merge or issue closure explicitly requested. Preserve unrelated untracked paths, including .github templates; do not incorporate them automatically.

- [x] C1 Map closure gaps and reconcile delivery: delegated gentle-ai-explore (mapping trigger), plus parent GitHub readback. Remote feat/mvp resolves to 3c2592c09c2aee9957fca23d88bc2ae0561dd894; GitHub PR listing for this head returns no PRs. Historical SSH failure was followed by successful push. Current-screen acceptance and 211-test evidence remain valid historical evidence, not rerun today.
- [x] C2 Document existing visual/responsive rules and require future-screen acceptance: delegated gentle-ai-worker (multi-file write). Drafted: 106 added documentation lines, no runtime edits; writer diff-check and relative links/history checks passed. Independent gentle-ai-verify passed: diff-check twice, links/anchors, source consistency and unchanged unrelated path status; no actionable defects. ASSESS was unassessable on unrelated untracked scope (RDD off), so independent verification was required and performed. Documentation outcome verified; work-unit commit authorized by the human on 2026-11-19; commit hash recorded in Engram after creation, not inside this file. Runtime tests/build/TDD N/A for passive docs. Allowed source documents: apps/desktop/README.md and odd/tasks/mvp-h1-access-windows.md. No runtime changes or untracked template adoption. Passive documentation has no meaningful RED; structural/link/consistency checks apply.
- [ ] C3 Verify narrow/wide layout: actual CSS viewport samples 320, 375 and 1000px, heights recorded, relevant states/light/dark/keyboard/overflow. jsdom is not layout evidence; no browser driver currently available. Native Windows evidence or explicit deferral remains required. Real CAPTCHA challenge not observed; persistent mount is preserved.
- [ ] C4 Reconcile issue evidence and prepare delivery: update stale push notes when authorized; PR/merge/closure remain pending human decisions.

Scope: existing visual foundation only; no theme selector/persistence/system following, new fonts, duplicated web frontend or auth changes. Existing CSS establishes 320px minimum at default root size, not a proven overflow-free viewport. Forecast: 80–140 authored documentation diff lines, zero generated lines. Delivery strategy ask-on-risk; existing oversized migration must not be silently bundled into a new PR. Checks for C2: git diff --check, relative-link existence, documentation versus mapped CSS/shell facts. Runtime tests N/A for passive documentation; visual checks remain separate C3. No task outcome is complete merely because documentation describes it.

Next: guide Windows viewport acceptance; C2 documentation verified, work-unit commit pending explicit authorization. Commit pending explicit user request under the active safety constraint.

## Tasks
- [x] V1 (implemented; logout correction writer-checked): Install verified theme tokens and apply coherent shared presentation to current access, sign-in, registration, private/loading/rejected and logout screens. Route: delegated worker; multi-file write trigger. Check existing behavior tests, typecheck and renderer build. Pure style-token changes have no meaningful deterministic RED; any new testable presentation behavior requires test-first.
- [ ] V2 (in progress; final correction verification and remaining visual cases): Independent verification and readback; record automated results and obtain human Windows visual acceptance. Route: delegated verifier as required by assessment. Browser evidence cannot establish Electron session behavior. Do not mark visual acceptance complete without evidence.

## Official shadcn migration (resumed)
User authorized continuing migration in the new session. Preserve existing dirty theme changes; no commits or publishing authorized.
- [x] M1 (automated independently verified; no commit authorized): Install official @shadcn/card and compose the shared shell; preserve main/h1/visual-content semantics and remove only redundant shell CSS. Delegate bounded writer; focused regression checks.
- [x] M2 (sign-in and registration independently verified; no commit authorized): Migrate sign-in and registration using official Field/Input/Alert in separate bounded units after registry previews; preserve auth and CAPTCHA behavior.
- [x] M4 (independently verified; no commit authorized): Replace remaining failed-logout custom error with installed Alert; then bounded status/divider/focus and obsolete CSS cleanup. Preserve polite status roles and ordinary semantic text.
- [x] M3 (automated verification and user-requested visual acceptance complete; evidence limits below): Independent full tests, typecheck, renderer build and structural readback; human Windows light/dark/reflow/CAPTCHA acceptance remains pending.
Read-only preview: @shadcn/card creates only src/components/ui/card.tsx and reports cn dependency (already declared; installed resolution to verify). Official reference: https://ui.shadcn.com/docs/components/base/card, accessed 2026-10-09. Generated and authored diff sizes must be recorded separately. Existing baseline approximately 382 authored lines; do not bundle all forms into shell unit.

M1 writer evidence: official base-nova Card installed unchanged (102 generated lines), shared shell composed with Card/Header/Title/Content retaining main/h1/L/children; redundant shell CSS removed, form CSS/tokens retained. Two new regression tests observed RED then GREEN; 58 existing screen/session tests and typecheck/diff-check passed. No manifests/lockfiles/commits changed. Independent full tests/build/readback pending. ASSESS returned unassessable because unrelated untracked scope lacks explicit declaration; RDD off, separate verifier required.

M1 independent verification: 199 tests across 22 files, typecheck, renderer/preload build and diff-check passed. Build warnings remain: ignored use-client directives and ~2074kB renderer chunk. Windows acceptance pending; upstream byte equality not independently compared. M2 dry-run creates exactly ui/input.tsx, alert.tsx, label.tsx, separator.tsx, field.tsx; cn only already declared. Official base Field/Input/Alert docs fetched by parent 2026-10-09. Split sign-in and registration; generated lines separately recorded.

M2a sign-in writer completed: official Field/Input/Alert plus Label/Separator dependencies generated unchanged (371 registry lines). Incremental authored diff 100 lines (+85/-15): sign-in composition, three test-first regressions and five narrow legacy CSS exclusions. RED three new cases, GREEN 15 sign-in cases; combined access/sign-in/registration 44 passed, typecheck/diff-check passed. Auth handlers, guards, copy, registration and manifests/lock preserved. Independent verification pending before registration writer. ASSESS again unassessable due unrelated untracked scope; RDD off, independent verifier required.

M2a independent verification passed: 202 tests/22 files, typecheck/Electron syntax, renderer/preload builds and diff-check. No actionable defect; handlers, locks, props, labels and alert copy retained. Build warnings include ignored use-client, separator source-map location and 2083.34kB chunk; Windows acceptance remains pending. M2b registration starts next using installed primitives, edits limited to registration.tsx/test. Preserve persistent single clerk-captcha node outside conditional forms, credentials noValidate and existing native attributes/handlers.

M2b writer implemented registration using installed Field/Input/Alert: 130 authored diff lines (+120/-10), no generated changes; four regressions observed RED then GREEN (26 registration tests, 48 combined form/access tests); typecheck and diff-check passed. Auth logic unchanged; unconditional CAPTCHA node and provider-child identity tested. Independent verification pending; ASSESS unassessable on undeclared untracked scope, RDD off => verifier required. Final verifier also maps remaining raw callouts and legacy CSS before declaring migration complete.

M2b independent verification: 206 tests/22 files, typecheck/Electron syntax, renderer/preload build and diff-check passed. No registration defect, CAPTCHA identity preserved. Remaining migration: raw failed-logout alert session.tsx:30; custom status panel CSS styles.css:280–284; section divider, obsolete raw field rules and Button focus override. M4 begins failed logout only, then scoped cleanup. Windows acceptance and registry byte equality remain unverified; build warnings unchanged (~2083.53kB chunk).

Human visual evidence 2026-10-09: user supplied light sign-in/access and authenticated private-screen screenshots and explicitly confirmed changes. These two screen cases accepted; registration, real CAPTCHA, dark mode, reflow, keyboard and failed-logout visual cases remain pending. No delivery authorization inferred.
M4a logout writer completed: 24 authored diff lines (+16/-8), installed destructive Alert/AlertDescription, one RED->GREEN regression; six session and 19 combined focused cases/typecheck/diff-check passed. Removed obsolete legacy alert rule only. Independent verification pending; ASSESS unassessable due untracked scope, RDD off.

M4a independent verification passed: 19 focused cases, typecheck/Electron syntax and diff-check; logout copy/role/retry/exclusion/locks retained. M4b next: migrate existing shell-scoped status panels to installed Alert role=status (polite), insert installed Separator before unauthenticated form in access, remove obsolete custom panel/divider/raw field CSS and narrow focus styling to links. Estimated 100–150 authored lines, zero generated; preserve ordinary text and provider-level status outside shared shell. Final full checks follow.

M4b writer completed: shell-scoped statuses now installed Alert/AlertDescription role=status; access conditional Separator; obsolete raw form/status/divider CSS removed and focus narrowed to ordinary links. 108 authored diff lines (+62/-46), zero generated. Six regression failures observed RED then 70 focused tests GREEN; typecheck/diff-check passed. Independent final full verification in progress; ASSESS unassessable due untracked declarations, RDD off, verifier required. No commit/manifest/install mutations.

Final independent verification complete: 211 tests/22 files (70 focused), typecheck/Electron syntax, renderer/preload build and pre/post diff-check passed; git status unchanged. No blocker or competing custom controls/panels in bounded current screens. Nine official status Alerts preserve polite semantics; conditional Separator and primitive-owned focus verified; CAPTCHA/handlers/guards retained. Aggregate versus HEAD includes prior theme work: 20 files,1121 changed lines (648 authored,473 installed primitive lines). Review workload exceeds400 authored aggregate lines: future delivery needs scoped review slices, not one oversized review. Build warnings: use-client directives, Separator sourcemap diagnostic,2084.21kB renderer chunk. RDD off; native ASSESS unavailable on undeclared untracked scope, independent verification performed instead. No commits,push,PR or issue closure. Remaining human acceptance: registration/real CAPTCHA,dark,reflow,keyboard,logout visuals. Upstream byte equality and historical RED runs not independently reconstructed.

Final human acceptance update 2026-10-09: user confirms registration/login, keyboard and logout correct, states no CAPTCHA in their current experience, and then explicitly approves dark mode with dark sign-in/error and authenticated private screenshots. User-requested migration checks closed. Evidence limits: no independently observed full narrow/wide matrix or real provider challenge; existing CAPTCHA mount preserved, not removed. Dark tested with temporary root class; persistent theme selector/system-following not implemented. Earlier pending visual notes above are historical and superseded for the accepted cases only. No commit or publishing authorized.

## Authorized work-unit delivery
One coherent current-screen visual migration commit on feat/mvp, with generated primitives, theme, composition, regression tests and this record. Aggregate authored diff exceeds the advisory 400-line review budget; reported explicitly, never compressed to hide size. Rollback boundary: scoped apps/desktop visual source/tests/CSS and this task record; no auth provider/platform/backend changes. Verification: 211 tests, typecheck, renderer/preload build, diff-check and human light/dark/auth/keyboard/logout acceptance. Runtime evidence: user Windows screenshots and confirmations; no native platform boundary changes. Commit identity is recorded in issue #14 and Engram after creation to avoid self-referential commit content.

## Acceptance
- Complete exact light/dark theme values, semantic colors, focus and legibility.
- Shared UI only, no platform duplication or auth/state-machine edits.
- Font declarations and actual locally loaded assets distinguished explicitly.
- Existing functional tests, typecheck and build pass.
- User validates first screen and current-screen visual adaptation in Windows; light/dark and narrow/wide evidence pending.

## Verification commands
Run in apps/desktop:
- bun run test -- src/access.test.tsx src/sign-in.test.tsx src/registration.test.tsx src/routes.test.tsx src/private-access.test.tsx src/lib/session.test.tsx
- bun run test
- bun run typecheck
- bun run build
Build owns ignored apps/desktop/dist outputs; no deploy/codegen.

## Delivery and progress
Forecast: approximately 250–380 authored lines, advisory only. Strategy: ask-on-risk if coherent diff materially exceeds 400 authored lines. No commits yet. Theme installed via bunx --no-install shadcn add https://tweakcn.com/r/themes/cmsjfxfkj000304jj9wfw6u75 --yes after registry view/dry-run/diff inspection. Shared VisualShell applied to current screens; 362 authored changed lines reported. Writer observed 55 focused tests and 194 total tests passing, typecheck/build/diff-check passing. Build retains module-directive and large-chunk warnings. Theme font declarations retained; locally bundled Geist is the explicit active fallback, not Asta Sans/JetBrains Mono loading. No dependencies added or auth/security changes reported. Browser tooling unavailable; screenshots and Windows light/dark/narrow/wide acceptance pending. Native ASSESS failed because untracked files require explicit scope declaration; returned unassessable/high-equivalent plan requires independent verifier. RDD remains off; no review lifecycle started.

## Next step
Final independent verification confirms 53 light and 52 dark registry values and all authorized checks pass. It finds incomplete logout coverage in apps/desktop/src/lib/session.tsx:27–39: pending/ended/failed screens do not use VisualShell or visual-content. Logout correction completed in session.tsx and session.test.tsx: shared VisualShell and headings cover all three branches. Three new regression cases failed before correction (RED), then five session cases passed (GREEN); full197tests/typecheck/build/diff-check passed. Correction20 changed lines; overall382 source/test lines reported. Final independent verification mv0i2s6e-5-jpz2 passed: five session tests, 197 full tests across 21 files, typecheck and diff-check. Shared shells/headings/content verified for all three logout branches; retry, exclusion, duplicate-call lock and handlers unchanged. No blocker found. Build was not repeated by this final verifier; the correction writer already observed build passing with the documented warnings. Independent verifier also flags global 320px minimum width as a pending human reflow/CAPTCHA check, not a verified failure. Rerun checks after correction. User supplied a light sign-in screenshot and explicitly confirmed the theme applied. First-screen visual acceptance observed: Livefy panel, green primary action, fields and secondary action. This does not establish other states, dark mode, narrow/wide reflow or CAPTCHA fit; those cases remain pending. No issue closure or publishing yet.

## A2 measured matrix — 2026-11-20

Automated in Chromium against the dev web build, measuring rather than judging:
`scrollingElement.scrollWidth` vs `clientWidth`, every control rect against
`innerWidth`, real heights, root font size, and a six-step keyboard focus trail.

Scope: 18 cases = 3 surfaces (sign-in, registration, private route) × 3 viewports
(320×640, 375×667, 1000×700) × 2 themes (light, and dark via the `.dark` class).

Measured:
- Root font size 16px in every case.
- **Zero horizontal overflow and zero off-screen controls in all 18 cases.**
- Keyboard focus visible in every traversed case: buttons expose it as a ring
  (box-shadow) because the primitive owns it, inputs as a 2px outline, links as an
  auto outline. Trails: 4 steps on sign-in, 6 on registration.
- **12 of 18 cases accepted**: sign-in and registration, light and dark, at all
  three widths.
- The private route at `/#/app` unauthenticated rendered an empty shell in 6 of
  18 cases during this run. Fixed immediately after: it now paints
  `Authentication required` with `Return to access`, with no page error, and its
  six cases re-measured green (`web-private-route-deeplink.md`). **18 of 18
  reachable cases accepted.**
- **Authenticated `/app` remains unmeasured**: it needs a live session, which this
  harness cannot obtain. Pending human observation.

This matrix measures layout and focus. It does not judge aesthetics, and it does
not replace looking at the screens.
