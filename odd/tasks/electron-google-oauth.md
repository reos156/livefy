# Electron Google OAuth

## Current authority — DEV accepted
User accepted Google authentication in web and Electron, including the reported Electron sign-in/sign-up browser return. MVP social authentication is Google only: the user disabled Facebook/TikTok in Clerk and confirmed their buttons disappeared. This section supersedes stale pending-runtime and no-commit notes below; those notes retain historical evidence, not current authority.

Independent verification is complete: latest focused 178/178 and full 300/300 tests, typecheck and build passed. Build retains 27 ignored use-client warnings and an oversized-chunk warning. Native review mode is off; assessment was unassessable due ambient untracked files, not a passed review. DEV scope is accepted, not production or packaged certification. Auth refs #8/#10/#12/#13 are already closed; no issue operation is required. Issue #14 and its visual matrix remain outside this closure.

Commit evidence: pending — parent to record the authorized local commit after creation. No push/PR/merge authorized.

## Intent
Restore Google sign-in and sign-up OAuth IPC in @clerk/electron 0.0.51 without changing existing authentication UI or encrypted-storage semantics.

## Scope and constraints
- Edit electron/main.cjs, electron/clerk-main.test.js, electron/clerk-oauth.test.js and narrowly relevant desktop README documentation only.
- Preserve unrelated dirty and untracked files; no commits without explicit user request, no push/deploy.
- SDK bridge must register livefy/renderer before app readiness; initialize safeStorage-backed adapter only after readiness through deferred TokenStorage.
- Respect isPrimaryInstance and remove duplicate privileged scheme registration.
- Delivery: ask-on-risk; forecast 100–200 authored diff lines; one coherent fix unit; commit pending user authorization.

## Tasks
- [x] T1 Implement bootstrap correction with observed RED/GREEN regression tests (implementation verified; commit not authorized).
- [x] T2 Independently verify focused tests, desktop tests/typecheck/build and document limitations.
- [x] T4 Correct default Electron protocol launch arguments with RED/GREEN tests (commit not authorized).
- [x] T5 Independently verify Windows callback registration correction.
- [ ] T3 Explicitly deferred: individually observed restart/persistence/logout and packaged Windows checks are not supplied by general human acceptance. Reason: bounded DEV closure, without separate evidence for these cases. Gate: record mode-specific Windows browser callback, post-auth access, restart/session persistence and logout observations before claiming packaged/persistence acceptance. Google sign-in/sign-up and return to Electron are human accepted; browser tab may remain open.

## Routing
T1 delegated gentle-ai-worker: main bootstrap, test and documentation require multi-file writing.
T2 gentle-ai-verify according to native assessment; functional Google browser completion may require human interaction.

## Acceptance
OAuth handlers register before renderer starts in development and packaged modes; secondary instance creates no window; storage encryption check stays post-ready; cleanup and logout behavior remain intact.

## Evidence
Explorer confirmed storage-only bridge omits OAuth handlers in installed SDK. Main bootstrap spot-check confirms storage-only initialization after ready and manual scheme registration.
Writer updated main.cjs, clerk-main.test.js, new clerk-oauth.test.js and narrowly README.md. RED: 8 intended failures, 43 passes. GREEN and post-refactor: 51/51 focused tests passed. Installed real SDK integration covers OAuth registration/callback/security/cleanup. Online docs unavailable to writer. ASSESS unassessable due to ambient untracked files; RDD off; independent verifier required. Real Google OS callback and completion remain pending.

## Windows callback follow-up evidence
T4 fixes defaultApp registration after SDK using executable plus absolute application directory; primary-only, raw paths, development flag preserved, static failure diagnostic. RED 4 intended failures/53 passes; GREEN 57 then final 58/58. Independent T5: focused 58/58, full 270/270 across 19 files, typecheck and build passed. Build warnings unchanged (use-client and oversized chunk). Git status identical before/after verification. Effective Windows registry and real Google callback not inspected; no OS registry mutation or app launch by agents. No commits authorized.

## Next
Independent verification passed: focused 51/51, full suite 263/263 across 19 files, npm run typecheck and npm run build exit 0. Build warnings: ignored use-client directives and oversized bundle. Normal ignored dist outputs generated; Git status unchanged by verification. No scoped blocking findings. Next: restart Electron and manually test Google sign-in/sign-up, OS browser return, post-auth access, restart persistence and logout in Windows development/packaged modes. Online official docs not freshly fetched. No work-unit commit authorized; no real login claimed.
