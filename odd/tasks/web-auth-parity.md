# Web authentication parity

## Current authority — DEV accepted
User accepted reported authentication flows in web and Electron after W4/W5. Google is the only MVP social provider: the user disabled Facebook/TikTok in Clerk and confirmed their buttons disappeared. Historical pending browser/Google and no-commit notes below are superseded by this authority, not deleted.

Independent verification completed: focused 178/178, full 300/300 across 23 files, typecheck and build passed; 27 use-client and oversized-chunk warnings remain. Native review is off; assessment unassessable due ambient untracked files was covered by independent verification, not converted into review approval. General human acceptance does not individually certify browser refresh/session restoration, failure/retry, Back exclusion, provider challenge or visual matrix cases. These remain unobserved unless separately recorded. Electron restart/persistence and packaged mode are explicitly deferred under T3 in [Electron Google OAuth](electron-google-oauth.md), with reason and acceptance gate.

DEV scope accepted; no production certification. Auth refs #8/#10/#12/#13 remain closed; issue #14 is untouched. Commit evidence: pending — parent records authorized local commit after creation; no push/PR/merge authorized.

## Objective
Support browser sign-in, Google sign-up and sign-out with the same shared application UI and backend-confirmed private access as Electron.

## Findings
The browser uses apps/desktop Vite entry but currently loads Electron authentication unconditionally. Native SDK uses non-browser transport; native logout requires IPC and terminal relaunch instructions. Installed browser SDK @clerk/react 6.17.6 is transitive. No backend change is indicated.

## Constraints
Preserve all dirty/untracked local changes and native OAuth fixes. No commits without explicit user request, no deployment, service configuration changes or real account mutations. Keep existing memory routing unless a demonstrated OAuth requirement demands bounded completion handling. Browser session guarantees must not reuse native encryption claims. No backend/schema/native electron files edits.

## Tasks
- [x] W1a Add platform seam, browser provider and browser-compatible logout with test-first coverage (verified; commit not authorized).
- [x] W1b Add embedded browser UI and safe OAuth completion with test-first coverage (corrected and independently revalidated; no commit authorized).
- [x] W2 Independently verify browser/native regressions, types/build and document browser test procedure.
- [x] W4 Fix real-router logout acknowledgement deadlock and suppress shared Checking backend access transient message without bypassing backend confirmation. Worker observed actual-router RED (2 failures), GREEN 178 focused tests and typecheck. Browser infrastructure retained, routed consumers excluded; shared neutral Loading… presentation. No commit per user constraint.
- [x] W5 Independently verify logout lifecycle and shared transition correction. Independent verifier passed focused 178/178, full 300/300 across 23 files, typecheck and build. Actual-router positive completion assertions; no blocking defect. README landing-only scope corrected and structurally read back (passive documentation, no meaningful RED). Build retains 27 use-client and one oversized-chunk warnings (2069.04 kB / gzip 744.76 kB). Mock omits Clerk no-session early return/swallowed network_error; real SDK acceptance pending. Future root error/pending consumers require equivalent gating. Assessment unassessable due ambient untracked declaration; RDD off. No commit per user constraint.
- [x] W3 Human acceptance: user confirmed correct operation in both web and Electron after W4/W5. Manual acceptance of reported flows; no separate claim of individually observed refresh/session-restoration cases. No commits per user constraint.

## Routing and scope
W1 delegated gentle-ai-worker: multi-file change. Allowed shared main/access/session files, narrow platform seam/web modules and tests, direct pinned browser SDK declaration and minimal bun.lock metadata update, narrow README instructions. W2 delegated verifier following assessment. W3 human browser authentication; mocked tests cannot certify Google.

## Acceptance
Browser chooses standard browser SDK without native transport; Electron retains specialized provider. Shared access requires Convex authentication confirmation. Browser sign-out excludes private consumers immediately, supports safe failure/retry and returns public UI without closing tab/relaunch copy. Sign-up supported by browser UI, OAuth completion navigates appropriately. Existing native regression tests remain green.

## Delivery
ask-on-risk. Concrete forecast 460–550 authored diff lines (180–220 implementation, 230–270 tests, 50–60 integration/docs). Human selected split_w1: implement W1a platform/provider/logout, then W1b embedded browser UI/OAuth completion; retain all coverage. No code written at size decision. PR delivery strategy remains undecided; this task split does not authorize publishing. No incidental Clerk upgrade. Work-unit commit pending explicit authorization; no push/PR authorized.

## Manual follow-up
User reports browser flows working but logout stuck Signing out. Explorer confirmed SessionBoundary pending unmounts RouterProvider while Clerk awaits navigation requiring Transitioner acknowledgement before session refresh. Existing navigation mocks missed this. User also explicitly identified undesired shared transient text Checking backend access; suppress that presentation in web/Electron without changing Convex access guard or Backend access confirmed destination. Authorized narrow lifecycle/shared UI correction; no native transport or backend edits.

## Blocking verifier findings
W2 ran focused 186/186, full 291/291, typecheck/build green but source inspection found functional gaps: Clerk logout defaults navigation to / rejected by browser completion allowlist, potentially retaining blocked failure UI; SDK supplies origin-relative /preview/#/ rejected by subpath completion. Correct both with faithful SDK-navigation regression tests before marking W1b/W2 complete. No Chromium/Playwright available; real browser acceptance pending. No commits.

## Final automated revalidation
Focused 188/188 across 10 files; full 293/293 across 23 files; typecheck/build passed independently. No remaining blockers in corrected logout/subpath paths. Build warnings: 27 ignored dependency use-client directives and oversized renderer bundle (~2068 kB, gzip ~745 kB). Expected mocked cleanup diagnostics in tests. Git status unchanged by verifier; only permitted ignored dist outputs generated. No real browser/Google/UI/persistence acceptance: tooling unavailable, W3 remains pending human tests at http://127.0.0.1:5173 via apps/desktop npm run dev. No commits, installs or deployment.

## Latest verification
W1a independently passed focused 171, full 276 tests, typecheck/build. W1b writer added browser auth-ui and SDK-backed tests, provider completion options, bootstrap wiring and README checklist (~160 authored lines). RED missing UI module then GREEN 186/186 focused tests across 10 files; typecheck/diff check passed. Completion allowlist preserves Clerk intermediate fragments. No real web Google, persistence or visual acceptance observed. ASSESS unassessable on ambient untracked; RDD off; independent verifier required. Next W2 focused/full tests, typecheck/build and functional browser availability check; W3 human auth remains pending.

## Evidence and next
Explorer mapped main.tsx, access.tsx, lib/session.tsx, platform/electron auth modules and installed SDK 0.0.51/browser 6.17.6. Official online docs not fetched by explorer. Existing dirty state confirmed on feat/mvp. W1a writer completed ~240 authored lines excluding old changes/lock metadata. RED missing module, route mock integration failures, subsequent-session exclusion regression observed; GREEN 171 required tests across 8 files and typecheck passed. Routes mock migration human-approved, assertions preserved. Browser UI placeholder remains pending W1b. Native modules untouched. ASSESS unassessable due existing untracked files, RDD off => independent verifier required. W1a remains in progress until independent checks. Next verify W1a, then W1b.
