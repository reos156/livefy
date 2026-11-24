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
  audience control. CLOSED by live measurement, see L11.
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
- **S10** The preflight MUST NOT require an empty instance. It MUST record the
  initial user count, and a run MUST succeed only when the final count equals that
  initial count AND the fixture user is absent by ``external_id``. The count delta
  alone is not proof of cleanup; the absent-fixture read is part of the same
  verdict.

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
- T5 (S1, S2) — S1 CLOSED, S2 OPEN BY DECISION. Clerk CLI authenticated (DEV, the
  only app/instance). The authorized audience case exists: template
  `livefy-h1-2c-wrong-aud`
  (`jtmp_3MXHKSGkp6QoTj6qc22lenb5Pqa`, claims `{"aud":"livefy-h1-2c-wrong-aud"}`,
  RS256, Clerk's own signing key) and S9, the attested mint path, is implemented
  and verified, and the live execution succeeded (L11). Re-run command, after
  exporting nothing that holds `CONVEX_DEPLOY_KEY`, `CONVEX_SELF_HOSTED_ADMIN_KEY`
  or `CONVEX_SELF_HOSTED_URL`:

  ```sh
  H1_2C_FIXTURE_EMAIL='<controlled-mailbox>' \
  H1_2C_WRONG_AUDIENCE_TEMPLATE='livefy-h1-2c-wrong-aud' \
  node apps/desktop/scripts/verify-clerk-dev.mjs --one-authorized-fixture
  ```

  Expected success line reports `wrongIssuer` pending and
  `wrongAudience: rejected: attested wrong-audience token refused by the query`.
  S2 stays open by explicit decision: without a second instance there is no
  genuinely signed foreign issuer to test, and the record must say so rather than
  implying the issuer pin is verified.

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
- **L6** Pre-existing work in the same worktree, not part of this feature:
  `README.md` and the eight `odd/tasks/*.md` documentation corrections made
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
- **L9** S9 implemented after the human authenticated the Clerk CLI. Template
  `livefy-h1-2c-wrong-aud` created in the single DEV instance (no production
  instance exists, so the target was unambiguous). The script now mints its own
  wrong-audience token through that named template on the fixture session
  (`POST /sessions/{session_id}/tokens/{template_name}`), and only that path may
  report `rejected: attested wrong-audience token refused by the query`; the
  environment-supplied path still returns pending plus the unverified-provenance
  suffix. Independent verification (`mwu4h5hh-2-0ggz`) found no blocker: it could
  not reach the attested verdict from any supplied token, the conflict guard runs
  before the transport is marked used, the configured-issuer and foreign-audience
  checks cannot be satisfied by a caller-controlled value, and a foreign-issuer or
  `convex`-auditing template fails closed at stage `attested-negative` instead of
  reporting. 377 tests, `tsc --noEmit` exit 0. Advisories recorded, not fixed:
  the verdict attests that the query refused a wrong-audience token, not that the
  audience was the reason for the refusal (mitigated, not eliminated, by the
  same-session accepted-versus-refused differential); the read-only platform
  preflight runs before the conflict guard; and three verifier probes worth adding
  are listed in its report (conflict must not consume the single-use transport,
  foreign-issuer fail-closed, conflict exits 1).
- **L10** Decision (verbatim option selected): «Cambiar a delta cero y correr en
  vivo». The live attested negative could not run: `smoke()` aborts at stage
  `initial-inventory` unless `GET /users/count` returns `total_count === 0`, and
  the DEV instance holds 2 real users, so no fixture email could unblock it. The
  guard existed because `usersAfter: 0` proved cleanup on an empty instance; with
  existing users that proof has to become a delta plus an explicit absent-fixture
  read (S10). Authorized: replace the empty-instance preflight with the delta
  contract, then run the attested negative live.
- **L11** S1 CLOSED by measurement, exit 0:
  `{"validAccepted":true,"anonymousRejected":true,"sessionRevoked":true,"usersBefore":2,"usersAfter":2,"wrongIssuer":"pending: no authorized genuinely signed untrusted issuer source","wrongAudience":"rejected: attested wrong-audience token refused by the query"}`.
  Same session and signing key, only `aud` differs: the `convex` token is accepted
  and the foreign-audience token is refused. A direct probe of the deployment
  returned, for that same token,
  `401 {"code":"NoAuthProvider","message":"No auth provider found matching the given
  token. Check that your JWT's issuer and audience match one of your configured
  providers: [OIDC(domain=https://organic-snake-7233.clerk.accounts.dev,
  app_id=convex)]"}` — so the deployment names both checks and names `app_id=convex`.
  Reaching that verdict needed two corrections found by running it for real: the
  empty-instance preflight (S10) and a refusal predicate that only knew
  `Unauthorized` while the deployment answers `NoAuthProvider`, which made a real
  refusal look inconclusive.
- **L12** Independent verification of S10 plus the refusal predicate
  (`mwu571cw-5-6rsw`) allowed S1 to be recorded closed: 13 bypass attempts on the
  attested path all aborted with no verdict, the single-use transport is checked
  before the preflight, ownership is re-read before every delete, both S10 halves
  are load-bearing and `cleanupChecks` emits `null` rather than `true` when a half
  was not evaluated, and the accepted-versus-refused differential was confirmed to
  be one session with two audiences rather than two reporting paths. 411 tests,
  `tsc --noEmit` exit 0. Advisories recorded: `NoAuthProvider` is Convex's generic
  provider-mismatch body, so a template token refused for a non-audience reason
  would still attest (mitigated by the accepted control, not eliminated); the
  narrowed predicate now aborts on prose forms like `401 Unauthorized` that the
  baseline reported as verdicts (fail-closed only); `sessionRevoked: true` is a
  literal backed by a confirmed revoke rather than derived from it; and
  `cleanupChecks: null` must never be read as clean by a consumer. Also recorded:
  a manual probe I ran to diagnose this left a temporary user behind for a few
  minutes because I used the readonly shell variable `UID` as the delete target;
  it was found by `external_id`, deleted, and the count returned to 2 before any
  further run.
- **L13** The CSP gate's last runtime residual is CLOSED. Earlier rounds proved the
  header was set on the Response object but explicitly could not prove Chromium
  applied it to a packaged renderer, recorded then as "unverified: Electron header
  transmission to the renderer". Verified on Windows against the unpacked artifact
  built by `bun run dist:win` at `C:\Livefy\mvp` with no dev server running:
  `location.protocol` returned `livefy:`, and both `fetch('livefy://renderer/')` and
  `fetch('/')` returned the `content-security-policy` header byte-identical to the
  single-source production policy — no `unsafe-eval`, no `unsafe-inline` in
  `script-src` (only `style-src` keeps it), and no `ws://127.0.0.1:5173`. So the
  packaged renderer really receives the header from `protocol.cjs`, not merely the
  `index.html` meta fallback. Still not claimed: a signed or installed build, and
  any production deployment.
- **L14** Delivery risk observed in the same run, not a defect of this gate:
  electron-builder packs the workspace `node_modules` into the app
  (`resources\app\node_modules\@esbuild\...`), so the portable artifact is far
  larger than the code it ships, while the renderer is already bundled and the main
  process needs only `electron` plus built-ins. `asar` stays deliberately disabled
  because `protocol.cjs` requires real-filesystem containment that an asar cannot
  satisfy. Both belong to a distribution task, not here.

## Delivery

Five work units, in this order on `feat/mvp`:

- `ce8b72d` docs(odd): reconcile H1 evidence with the current tree
- `c6b788d` feat(security): deliver the production CSP as a response header
- `86d47e4` test(auth): cover offline logout, revoked session and memory-only disclosure
- `b45c8ff` fix(verify): keep the JWT negatives pending unless provenance is attested
- `f45864d` docs(odd): track the security gates closure feature
- `bd2354c` feat(verify): attest the wrong-audience negative from a script-minted template token
- `fb67fbd` docs(odd): record the S9 attested path and its live-run command

Each unit carries its own tests; each was verified independently before commit.
The branch is already 13,445 authored lines across 58 commits since `main`, far
past a single review slice, so publishing needs a delivery-shape decision
(chained PRs) rather than one PR. Not decided here and not authorized here.