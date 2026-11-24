# Web signup-to-signin navigation

## Authorization and scope
User authorized fixing the web-only signup footer link that opens hosted Clerk sign-in instead of staying in Livefy. Electron is an accepted working control and excluded. Branch: feat/mvp. Preserve unrelated dirty and untracked files. No commit, publishing or service mutation authorized. Human additionally authorized `apps/desktop/dist/**` generated build output, including Vite output-directory cleanup; Electron source remains excluded. For the current test-only follow-up, the user explicitly approved editing `apps/desktop/src/platform/web/main.test.tsx` and this task evidence, plus focused tests, typecheck and the full test suite. No functional source, footer candidate, generated build output, Electron edits, installs, service changes, commits or pushes are authorized in this follow-up.

## Acceptance
Official Clerk signup-to-signin navigation remains app-local at root and served subpaths. Preserve completion redirects, navigation guards, Convex authorization and Electron behavior. Confirm installed SDK semantics before applying candidate provider signInUrl.

## Tasks
- [x] W1 **implemented, independently verified, and human-accepted for the reported web footer; no commit authorized** — Confirm SDK semantics and implement minimal web correction with deterministic RED/GREEN regression coverage. Route: delegated worker (source plus tests).
- [x] W2 **closed by explicit human acceptance of the MVP scope** — Independent checks PASS and reported web footer accepted. Explicit served-subpath browser testing was not performed; accepted as a non-blocking follow-up, not a verified result. No commit authorized.

## Current W1 evidence — native navigation delegation candidate
Both earlier candidates were rejected by the human. Their checks below are historical only. The native-delegation candidate now has human acceptance for the reported web footer and independent passing deterministic checks. W1 implementation is accepted; W2 still lacks explicit served-subpath browser acceptance. No commit authorization; no commits, installs, service mutations or Electron source edits. The iteration checks below are historical; see final verification evidence for the subsequent full-suite and build outcomes.

Parent runtime evidence: Clerk 6.39.0 / UI 1.40.0; installed core 6.38.0 / React 6.17.6. Breakpoint trace: footer onclick → UI navigate → clerk.browser navigate → custom callback → complete. Version-matched BaseRouter suppresses observerRefresh while awaiting external clerkNavigate; synchronous synthetic events are not a reliable mounted-UI update contract.

Parent-verified official source (supplied in this task; access date not supplied, worker did not independently fetch): https://raw.githubusercontent.com/clerk/javascript/%40clerk%2Fclerk-js%406.39.0/packages/shared/src/internal/clerk-js/windowNavigate.ts validates protocols, dispatches clerk:beforeunload and assigns window.location.href. It does not force reload; native hashchange may occur. Neither reload nor successful Clerk screen transition is promised.

New owned seam: validate exact canonical/SDK-relative completion target and current document before any delegation. Unsigned or unknown sessions delegate canonical completion once to callback metadata.windowNavigate; missing metadata fails closed, with no adapter history mutation, synthetic event or memory navigation. Authenticated completion retains replaceState normalization and memory navigation without synthetic events. Metadata type derives from installed ClerkProvider routerPush. BrowserSession binds the provider-owned useClerk instance to a boundary ref with cleanup; memoized callbacks read live loaded/session at invocation. Provider signInUrl, completion redirects, guards, Convex gating and logout ordering remain intact. The shared platform prop type erases browser-only binding; the browser boundary accepts the erased shape but rejects a supplied adapter without its runtime session binder.

Test-first RED: authorized focused command observed 5 failed / 20 passed (25 total): root/subpath delegation spies received zero calls, plus three cases lacked the new session binding seam. GREEN: 26 passed after adding provider integration/session-loss coverage. Triangulation covers authenticated root/subpath completion, session loss without useAuth update, unloaded/unknown state, binding cleanup, logout after session removal, missing metadata, invalid targets and changed-document rejection. These are owned-seam mocks, not Clerk UI acceptance.

Current commands from apps/desktop: focused tests PASS (2 files / 26 tests); typecheck initially found the shared platform prop erasure and was corrected within web files; final rerun PASS. Scoped diff-check recorded in handoff. Real-browser signup footer acceptance at root and served subpath remains pending, as does independent broad verification. Rollback boundary: only the four web auth source/test files and this task's evidence; preserve unrelated work.

## Historical checks and evidence (rejected candidates)
W1 implements the documented candidate provider configuration: `signInUrl={completionUrl}` in web AuthBoundary. Force completion redirects, guards, Convex gating/logout and component configuration are unchanged. Parent supplied official documentation and authorized proceeding without inaccessible embedded UI internals. This is not a proven footer repair; W2 and real-browser root/subpath acceptance remain pending.

### Failed human retest and revised hypothesis
Human retest after the provider candidate: signup footer returns to `http://127.0.0.1:5173/#/` but still renders "Create your account". The provider candidate prevents hosted exit but does not establish a UI-state transition. W1 is reopened; previous passing checks remain historical, not evidence of resolution.

Owned navigation seam inspection: `createBrowserNavigation.complete` treats `/#/` as public completion, calls `history.replaceState`, emits a synthetic `hashchange` only when href differs, then calls the memory-router public navigation. `BrowserAuthUi` keeps the same mounted SignIn with `withSignUp`; it does not own/reset Clerk's embedded signup state. Thus the completion URL and an effective Clerk sign-in transition are not proven equivalent. The separately loaded UI may require a different route or native history event; its exact subscription/state handling remains unverified.

Smallest observable experiment, no source patch yet: after reproducing Create-account-at-`/#/`, reload that exact URL. If Sign in appears, the URL can initialize sign-in and stale mounted routing state is implicated. If Create your account persists, the URL/embedded-flow route assumption is wrong. For the stale-state branch, compare a real hash transition (away and back) with synthetic `hashchange` and `popstate`, recording which switches the heading and whether the app memory route changes. No test should assert a guessed event protocol as a proven Clerk contract.

Parent documentation request: fetch https://clerk.com/docs/react/reference/components/authentication/sign-in.md (withSignUp, hash routing, signInUrl) and https://clerk.com/docs/guides/how-clerk-works/routing.md if available. Need the documented combined-flow return route or UI router event contract before choosing an owned-seam behavior regression. Worker cannot access online docs or installed UI internals. No additional source edit or repeated baseline suite performed in this investigation.

### Revised history notification candidate
Human discriminating experiment (screenshot observed by parent): reloading the exact failing `http://127.0.0.1:5173/#/` renders "Continue to Livefy", the initial sign-in surface. The URL initializes correctly; stale mounted combined UI state is implicated rather than a need for a separate sign-in URL.

Implemented the smallest owned routing-seam candidate: after validated completion uses replaceState, dispatch `PopStateEvent('popstate', { state: window.history.state })` before the existing hashchange and public memory navigation. replaceState itself emits neither event. This supplies history listeners the missing notification while preserving pathname/origin checks, history state, replacement semantics and the existing hash notification. No extra history entry, full reload, remount, or Clerk UI reimplementation. The event is synthetic, not native browser traversal; Clerk's actual listener response is still a hypothesis requiring human browser retest. Installed wrapper/core evidence above does not prove UI subscription semantics; the local shared bundle search found no routing event implementation.

Owned-seam RED before this source edit: root and `/preview/` cases observed `['hashchange', 'public']`, failing the required `['popstate', 'hashchange', 'public']`; 2 failed / 21 passed. GREEN after the notification: 23 focused tests pass. Tests verify updated URL/state at notification, event order, no duplicate events for unchanged completion, and root/subpath behavior; they do not verify Clerk's screen. Existing negative-target guards and logout coverage remain green.

Latest synchronous post-change checks from `apps/desktop`: focused command 23 tests PASS; typecheck PASS; full test 304 tests PASS; build PASS (existing directive/large-bundle warnings). Scoped diff-check and untracked task whitespace/structure check recorded in handoff. W2 and real-browser signup-footer retest remain pending; no resolution claim until retest.

### Installed SDK evidence
- Installed `@clerk/react/package.json`: 6.17.6 (matches desktop manifest).
- `@clerk/react/dist/ClerkProvider-C0sNM2bh.mjs`: provider options pass through `clerk.load(this.options)` / `clerk.load({...this.options, ui: ...})`; `getClerkUIEntryChunk` loads UI separately with `loadClerkUIScript`.
- Installed `@clerk/clerk-js/dist/clerk.browser.js`: version 6.38.0. `buildSignInUrl` delegates to `#e7`, whose base is `this.#eW[e] || this.environment.displayConfig[e]`: load options override display configuration. Component signInUrl is not consulted in that builder.
- `@clerk/shared/dist/types/clerk.d.ts`: SignInProps and SignUpProps describe signInUrl as filling the SignUp sign-in link; withSignUp enables the combined flow. This does not establish whether embedded SignUp inherits the parent SignIn prop or calls the global builder.
- `@clerk/ui` is absent locally; embedded footer implementation/prop propagation remains unverified. Browser acceptance, not mocked provider assertions, will decide whether the candidate repairs the reported bug.
- Parent accessed https://clerk.com/docs/react/reference/components/clerk-provider.md and supplied the current `signInUrl` string description: "This URL will be used for any redirects that might happen and needs to point to your primary application on the client-side." Access supplied during this task; worker did not independently access online docs. Context7 unavailable through this worker's exposed tools.

### Regression lifecycle and post-change checks
- RED: focused command failed before source edit: both root `/#/create` and served-subpath `/preview/#/create` cases lacked provider `signInUrl`; 2 failed / 19 passed.
- GREEN: after adding the single provider prop, the same focused command passed: 21 tests.
- Triangulation: both document paths retain force completion targets; existing guards, configuration failure, logout and navigation tests remain green. No refactor needed.

### Post-change validation
Executed synchronously from `apps/desktop`:
- `bun run test -- src/platform/web/auth.test.tsx src/platform/web/auth-ui.test.tsx`: PASS, 2 files / 21 tests.
- `bun run typecheck`: PASS.
- `bun run test`: PASS, 23 files / 302 tests; mock cleanup diagnostics on stderr were expected test cases.
- `bun run build`: PASS, authorized dist output regenerated; warnings for ignored use-client directives and large bundle.
- Scoped `git diff --check` and untracked task whitespace/structure check from repository root: recorded in worker handoff.

These checks do not prove the reported navigation works. Mocked provider-prop assertions establish wiring only, not real Clerk/browser behavior. All unrelated dirty/untracked files preserved; no Electron source changes. No Turbo configuration changes. H1.8 recovery validation remains pending separately. Commit pending explicit user request.

### Independent broad verification blocker
Independent verification of native-delegation candidate: focused 26 tests PASS, typecheck PASS, build PASS (known use-client and large-chunk warnings). Full suite FAIL: 302 tests passed, 5 failed; all failures in `apps/desktop/src/platform/web/main.test.tsx`. Four logout/retry cases time out with Sign-out incomplete at line 77; one completion-wiring case throws Browser navigation metadata unavailable at line 99. Attribution to stale mocks versus actual behavior is not yet established. Read-only diagnosis is in progress; no edits to that test file authorized yet. Scoped diff-check clean and Electron source diff empty. W1/W2 remain open; browser root/subpath acceptance is still required.

### Human browser acceptance and integration-test diagnosis
Human reports the web footer now works correctly after the native-delegation candidate. This accepts the reported web behavior; no explicit served-subpath, login/logout or recovery-flow acceptance was supplied. Independent diagnosis attributes the five full-suite failures to obsolete mocks in `apps/desktop/src/platform/web/main.test.tsx`: callbacks omit metadata, provider navigation props are discarded, and the mocked Clerk instance has no live loaded/session fields. No application source regression is demonstrated by those failures. Updating that integration test requires extending the original exact edit scope; awaiting human authorization. Full suite remained failing at diagnosis time until corrected and rerun. W1/W2 remain open; no commit authorized.

### Authorized integration-test mock correction
Updated only `apps/desktop/src/platform/web/main.test.tsx` and this evidence. The mock provider now captures its actual navigation callbacks; `useClerk` returns a stable mutable loaded/session object. Sign-out removes the live session before calling the provider callback with SDK-style `windowNavigate` metadata. The main-entry wiring test mounts the real browser boundary rather than replacing it, asserting unsigned delegation without memory navigation followed by authenticated URL normalization and memory completion without further delegation. All five existing tests and logout/retry/private-access guard assertions remain intact. No production defect was found; the human-accepted footer candidate is unchanged.

Observed RED before edits from `apps/desktop`: `bun run test -- src/platform/web/main.test.tsx` failed, 1 file / 5 failed tests (four sign-out completion timeouts and one missing-metadata error). Observed GREEN after correction: the same command passed, 1 file / 5 tests.

Post-change validation from `apps/desktop`:
- `bun run test -- src/platform/web/main.test.tsx src/platform/web/auth.test.tsx src/platform/web/auth-ui.test.tsx`: PASS, 3 files / 31 tests.
- `bun run typecheck`: PASS.
- `bun run test`: PASS, 23 files / 307 tests. Four existing mock fixture-cleanup diagnostics appeared on stderr; no test failures or additional warnings.
- No build: test-only follow-up; the previous candidate build remains historical evidence.

Scoped diff/structure checks are recorded in the worker handoff. W1/W2 stay open pending independent post-change verification and outstanding acceptance. Human web footer success is recorded above; explicit served-subpath, login/logout and recovery acceptance were not supplied. No commits, dependency/service mutation, Electron or functional-source edits. Memory persistence is deferred to the parent because no validated project name was supplied.

### Final independent deterministic verification
Verifier PASS: combined web main/auth/auth-ui tests 31/31 (3 files), typecheck PASS, full suite 307/307 (23 files), zero failures. Four expected fixture-cleanup stderr diagnostics remain. Existing assertions were retained; mocks now use actual provider-bound callbacks, remove live session before logout navigation and supply SDK metadata. Scoped diff-check clean; both Electron source scopes have empty diff. Prior independently observed functional-candidate build PASS remains applicable; no rebuild for the subsequent test-only change. Human acceptance of the reported web footer is recorded. W1 implementation is accepted without a commit; W2 remains open only for explicit served-subpath browser acceptance. H1.8 recovery acceptance is a separate pending task. Whole-worktree ASSESS remains unassessable due unrelated untracked scope, not a scoped verification failure. No commits, installs, publishing or service changes.

### Explicit W2 closure decision
Human explicitly requested closing W2 after independent PASS and real web footer acceptance. W2 is closed for the accepted MVP scope. Explicit served-subpath browser acceptance was not obtained and is retained as a non-blocking follow-up, not claimed passed. This decision supersedes earlier open-W2 notes. H1.8 recovery remains pending and separate. No commit, push or publishing authorization was supplied.

### Authorized delivery — issue #15
User subsequently authorized issue creation, commit and push of W1/W2 only. This supersedes prior no-commit notes for this unit, without authorizing other dirty files, a PR, merge or main changes. Retrospective issue created and read back: https://github.com/reos156/livefy/issues/15 (OPEN, no labels), using the repository MVP YAML form; open/closed duplicate search found no equivalent. Delivery scope is the five web source/test files plus this feature document. Conventional commit will reference #15; exact commit and remote verification evidence is recorded in the session's delivery record after creation. Branch: feat/mvp. H1 and theme documentation remain excluded.
