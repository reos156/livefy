# Close the three pre-publication security gates

Feature: close the three security gates that block publishing the Electron MVP,
before closing H1.8–H1.11. Owner: parent session. Branch: `feat/mvp`.

The gates come from the accepted H1 records, not from new product scope:
signed JWT negatives (`mvp-h1-access-windows.md:257`), production CSP delivery
(`:257`), and the H1.6 failure paths left open by the DEV closure
(`mvp-h1-native-sessions.md` UX3).

## Specs

- **S1** A validly signed token whose audience is not `convex` MUST be rejected.
  `applicationID: 'convex'` in `apps/desktop/convex/auth.config.ts:4` is the only
  audience control; today nothing proves it is enforced.
- **S2** A token signed by an issuer other than the configured
  `CLERK_JWT_ISSUER_DOMAIN` MUST be rejected.
- **S3** The verification script MUST NOT report a negative as passed when it was
  not run. `apps/desktop/scripts/verify-clerk-dev.mjs:204-205` currently emits
  `'pending: no authorized genuinely signed untrusted issuer source'` and
  `'pending: no authorized genuinely signed wrong-audience source'`; those
  values must stay explicit until a genuinely signed source exists.
- **S4** The packaged renderer MUST receive the production CSP as an HTTP response
  header, not only as the `index.html` meta tag. The header MUST NOT allow
  `unsafe-eval`, and MUST NOT allow `unsafe-inline` in `script-src`.
- **S5** The header MUST NOT contain the dev-only origin `ws://127.0.0.1:5173`,
  matching the existing build transform in `apps/desktop/vite.config.ts:6-8`.
- **S6** Offline logout: when remote session removal fails, the app MUST delete the
  local credential, MUST NOT restore private access after restart, and MUST
  disclose that remote revocation is unconfirmed.
- **S7** A session revoked by the provider MUST NOT grant private access.
- **S8** When OS encryption is unavailable, the app MUST disclose the memory-only
  mode truthfully and MUST NOT claim the session survives restart.
- **S9** A negative MAY be reported as passed only from a token this script minted
  itself from the authorized instance through a named JWT template, which attests
  its provenance. An environment-supplied token stays pending exactly as S3
  requires.

## Tasks

- T1 (S1, S2, S3) — route writer. Negative harness in
  `scripts/verify-clerk-dev.mjs` plus unit negatives and exit-code coverage.
  Code and tests only; no Clerk or Convex service change, no deployment.
  Commit: pending.
- T2 (S4, S5) — route writer. Single-source CSP policy shared by the build
  transform and the Electron response header, with tests.
  Commit: pending.
- T3 (S6, S7, S8) — route writer. End-to-end failure-path coverage through the
  existing mock seams; fix a real gap only if the tests expose one.
  Commit: pending.
- T4 — route gentle-ai-verify. Independent verification of T1–T3 (Risk item 2 and
  item 3 apply). Not optional.
- T5 (S1, S2) — BLOCKED on an interactive CLI login. The audience case is
  authorized: a JWT template with a different `aud` in the DEV instance, no second
  instance. It needs two things in order: (a) S9, the attested mint path, without
  which even a genuinely signed token still reports pending; (b) `clerk auth
  login`, because the CLI is unauthenticated and `.env.local` is blocked by the
  safety policy, so no secret key is reachable. S2 stays open by explicit
  decision: without a second instance there is no genuinely signed foreign issuer
  to test, and the record must say so rather than implying the issuer pin is
  verified.

## Allowed edit surfaces

Per task, held by the writer that owns it, narrow and disjoint:

- T1: `apps/desktop/scripts/verify-clerk-dev.mjs`,
  `apps/desktop/scripts/verify-clerk-dev.test.ts`
- T2: `apps/desktop/electron/csp-policy.cjs`,
  `apps/desktop/electron/protocol.cjs`, `apps/desktop/electron/protocol.test.js`,
  `apps/desktop/electron/security.cjs`, `apps/desktop/electron/security.test.js`,
  `apps/desktop/vite.config.ts`, `apps/desktop/csp.test.ts`
- T3: `apps/desktop/src/platform/electron/auth.test.tsx`,
  `apps/desktop/src/lib/session.test.tsx`,
  `apps/desktop/electron/clerk-storage.test.js`,
  `apps/desktop/src/access.test.tsx`, and, only if a test exposes a real defect,
  `apps/desktop/src/platform/electron/auth.tsx`,
  `apps/desktop/src/lib/session.tsx`, `apps/desktop/electron/clerk-storage.cjs`

## Log

- **L1** User request (verbatim): «dale, implementemos los gates y luego cerramos
  H1.8 - H1.11».
- **L2** Decision (verbatim context): «creo que las pruebas de UX ya las hicimos
  todas». Accepted: the H1.6 experience cases are closed as recorded in
  `mvp-h1-native-sessions.md` (UX1/UX2 marked done, Windows acceptance quoted from
  the DEV closure). What remains is not UX: offline logout, revoked-session
  rejection, memory-only disclosure and exhaustive both-screen coverage.
- **L3** Read-only mapping of the three surfaces before any write: no response
  header CSP exists anywhere (`webRequest`/`onHeadersReceived`: zero matches), the
  renderer response is produced by `electron/protocol.cjs:24-40` with no headers,
  `scripts/verify-clerk-dev.mjs` decodes claims without verifying a signature
  (`:81-90`) and hard-codes the two pending negatives (`:204-205`), and the storage
  disclosure wording is already asserted in `src/access.test.tsx:92-98,112-134`.
- **L4** Scope boundary: the genuinely signed negatives (T5) need an external
  issuer. Minting RS256 locally cannot satisfy them because Convex trusts only the
  JWKS published by the configured `domain`. Recorded as a human decision, not
  implemented on assumption.
- **L5** Independent verification of T1–T3 (verifier `mwu3muq9-7-ik4j`) passed
  T2 (CSP: 24 probe assertions, header byte-equal to the production meta on all
  four response paths, only `ws://127.0.0.1:5173` removed, nothing added or
  widened), T3 (failure paths, with the two in-test differentials holding) and the
  `security.cjs` and dependency checks. It found one **blocking** defect in T1 S3:
  `exerciseNegative` reported any `Unauthorized` as a passed negative, so a locally
  forged, unsigned token carrying the intended mismatch cleared the `pending: `
  state without disclosing that its provenance was unverified. The writer's own
  tests locked that behavior in with `unverified-signature` fixtures. Corrected
  parent-side: a refusal now keeps the gate explicitly pending and appends
  `(refused by the query, provenance unverified)`, the inverted rationale comment
  is gone, and a regression test pins that a forged token never starts with
  `rejected:`. The exact `script-src` token list is also pinned in
  `electron/protocol.test.js`. S1 and S2 therefore remain honestly open until T5.
- **L6** Pre-existing work in the same worktree, not part of this feature:  `README.md` and the eight `odd/tasks/*.md` documentation corrections made
  earlier in the session, plus the untracked `.agents/`, `.github/`, `.mcp.json`,
  `.pi/`, `apps/desktop/.h1-2c-recovery/`, `prototypes/` and `skills-lock.json`.
  Only the paths under `## Allowed edit surfaces` belong to T1–T3.
- **L7** Final state of T1–T3: 352 tests across 23 files and `tsc --noEmit` exit 0.
  Independent verification was run twice (`mwu3muq9-7-ik4j`, `mwu3urqp-8-ud1g`);
  the second round reproduced the forged-token probe verbatim
  (`pending: … (refused by the query, provenance unverified)` for every supplied
  token, `pending:` intact with no token), proved the regression test bites by
  restoring the old `rejected:` body in a scratch copy (3 failed | 39 passed), and
  proved the `script-src` pin fails when an origin is added while `csp.test.ts`
  does not. Its durable `it.each` for both mis-match kinds was added, taking the
  suite from 350 to 352.
- **L8** Native review status: RDD is on, but `gentle_review` assess returned
  `nativeRisk: unassessable` — the working tree carries untracked paths that need
  an explicit declaration before a candidate exists. This is the same ambient
  condition recorded throughout the H1 documents, not caused by this feature. It
  clears when the untracked scope is declared or when the work units are committed
  so the candidate is a commit range. Follow-ups recorded, not fixed here: only
  `script-src` is pinned exactly (an origin added to `connect-src` would not fail
  that assertion), and S1/S2 stay open until T5.

## Delivery

Five work units, in this order on `feat/mvp`:

- `ce8b72d` docs(odd): reconcile H1 evidence with the current tree
- `c6b788d` feat(security): deliver the production CSP as a response header
- `86d47e4` test(auth): cover offline logout, revoked session and memory-only disclosure
- `b45c8ff` fix(verify): keep the JWT negatives pending unless provenance is attested
- `f45864d` docs(odd): track the security gates closure feature

Each unit carries its own tests; each was verified independently before commit.
The branch is already 13,445 authored lines across 58 commits since `main`, far
past a single review slice, so publishing needs a delivery-shape decision
(chained PRs) rather than one PR. Not decided here and not authorized here.