# Convex Auth legacy cleanup

## Objective
Retire local Convex Auth artifacts while preserving Clerk authentication and Convex backend authorization.

## Scope and authorization
User authorized local cleanup after H1.4 (9c203db, closure 1236146), on feat/mvp. User explicitly authorized DEV codegen after disclosure of pending-schema/index preparation effects. No final deployment, remote record deletion, signing-variable mutation or PR authorized. User subsequently explicitly authorized retrospective issue creation, commit and push of this cleanup. Existing unrelated untracked files preserved. Pre-existing untracked legacy validation pair and matching generated API delta were explicitly within cleanup scope.

## Tasks
- [x] T1 — Retire local legacy auth, reconcile lock/generated API, document architecture and verify regressions.

## Outcome
Removed @convex-dev/auth and @auth/core pins; schema now defineSchema({}). Removed registrationValidation source/test, h1SmokeCleanup source/test, auth.ts placeholder, activate-auth-dev.mjs and smoke-auth-dev.mjs. Added schema regression; adapted auth.config and session tests without casts or suppressed checks. README distinguishes historical instructions from current Clerk architecture. Clerk providers, auth.config.ts, requireUser/session implementation and empty HTTP router retained unchanged.

## Verification evidence
- Schema test observed RED (seven legacy tables), GREEN 1/1 after schema replacement.
- Auth config regression observed RED (deleted module import), GREEN 3/3 after absence assertion.
- Backend tsc initially failed TS2345 session.test.ts legacy users query; correction observed RED then GREEN. Ten focused tests passed, preserving anonymous/forged-identity rejection.
- Root bun install --ignore-scripts: exit 0, lock reconciled.
- DEV-pinned Convex 1.46.0 codegen --typecheck disable: exit 0. Authenticated analysis/upload occurred under explicit preparation-effects authorization; no dev/deploy command or finalization command executed.
- Independent final bun run test: exit 0, 15 files / 118 tests passed.
- Independent bun run typecheck: exit 0.
- Independent bun x --no-install tsc --noEmit -p convex/tsconfig.json: exit 0.
- Independent bun run build: exit 0; ignored dependency use-client directives and >500kB chunk warnings.
- git diff --check: exit 0; parent repeated backend tsc successfully.
- No active legacy refs in audited source/scripts/Convex/generated/manifest/bun.lock. README historical refs retained deliberately.
- Tracked diff: 12 files +46/-301; new schema.test.ts: 9 lines. Task document separate.
- Native ASSESS unavailable due unrelated untracked declaration scope; treated high and independent verifier completed. RDD off globally; native review not started.

## Pending boundaries
User confirmed successful Electron launch via bun run start and successful login. New registration/browser smoke and current remote records/deployed state not verified. Local cleanup is complete, not evidence of remote retirement. No record-deletion commands executed. Generated DEV preparation can persist pending schemas/index work; final deployment not performed.

## Delivery
Issue #11 confirmed: https://github.com/reos156/livefy/issues/11 (retrospective, mvp-task.yml, no labels). User authorized commit and push; work unit: chore(auth): retire legacy Convex Auth artifacts. Implementation commit: 1903f75 (14 files, +92/-301 including tracker/test); all scoped changes staged explicitly, unrelated untracked files excluded. Preserve unrelated local files during any future staging. Rollback local scoped files together; do not assume reverting files clears DEV preparation metadata.

## Next step
Publish implementation and closure evidence commits to feat/mvp. No PR/merge authorized. Any remote retirement/deployment remains separately authorized.
