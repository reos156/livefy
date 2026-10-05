# Livefy desktop bootstrap

H1.2: an isolated Electron shell, React access preview, and activated DEV Convex Auth
email/password backend/session contract. Registration/login UI, renderer credential
collection and packaging are not implemented. The access controls remain
unavailable; provider initialization does not represent successful authentication.

## Run

Use Bun 1.2.15 and Node 22.23.1 (host verification versions).
From the repository root:

```sh
bun install --frozen-lockfile
bun run typecheck
bun run test
bun run build
```

Production assets load locally; after building:

```sh
cd apps/desktop
bun run start
```

For development, use two terminals in `apps/desktop`:

```sh
bun run dev
# In the other terminal:
bun run desktop:dev
```

The renderer uses Vite's JSX transform (no Fast Refresh preamble) to keep
script CSP restricted to local files. TanStack Router uses hash history for `file:` loading.
Shadcn CLI standard initialization selected Base UI / base-nova; its Button is checked in.

## Security and verification limits

Sandbox and context isolation are enabled; Node integration and webviews are disabled.
Permissions and popups are denied. Navigation/redirects are limited to the exact
entry document, allowing hash changes. Development explicitly loads only
`http://127.0.0.1:5173/`; production loads `dist/index.html`. CSP blocks frames,
objects and form submissions; the development websocket allowance is removed at build.
No preload, IPC, external-browser opening, credentials or secrets are provided.
The development server is trusted local code, not an authenticated service boundary.

Vitest checks deterministic policy and unavailable-access UI, not Electron runtime safety.
Linux launch was attempted: GPU processes crashed (exit 139); the bounded run ended
with timeout 124. No successful visual/runtime certification is claimed.
**Windows launch and runtime security smoke checks remain pending before H1.1 closure.**
No installer, signing or distribution tooling has been selected.

## H1.2 authentication — DEV API verified

Local pins: Convex 1.46.0, @convex-dev/auth 0.0.96, @auth/core 0.41.1,
convex-test 0.0.60. `session:current` has no arguments, derives identity using
`getAuthUserId(ctx)`, requires the user document to exist, and returns only `{ userId }`.
Anonymous and deleted-user identities are rejected. The reusable guard is
`convex/lib/requireUser.ts`; never accept a renderer-supplied user ID as identity.

The renderer accepts only `VITE_CONVEX_URL=https://polite-parrot-887.convex.cloud`.
Missing or mismatched configuration preserves the preview and displays an unavailable
status, without constructing a client. A configured renderer wraps the existing router
in one ConvexAuthProvider/client. Password-only operation disables URL code consumption.
CSP permits only this deployment's cloud HTTPS/WSS and site HTTPS endpoints, alongside
local Vite websocket in development only. No wildcard or unsafe-eval is added.

Authorized activation targeted only `reos156/livefy`, DEV `polite-parrot-887`:

- CLI identity checks matched team/project/deployment/type using explicit process binding.
- Both signing variables were absent. Node crypto generated RS256/PKCS8 and public JWKS
  in memory; one CLI bulk-stdin operation set only `JWT_PRIVATE_KEY` and `JWKS`, without
  `--force`. Existing complete configuration is preserved; partial configuration stops.
- Pinned `convex dev --once` pushed Auth/session and generated real `_generated` bindings.
  No `convex deploy`, production change, or key rotation was performed. Convex supplies
  `CONVEX_SITE_URL`; password-only operation does not require additional `SITE_URL`.
- A real ConvexHttpClient password signup issued a token. Authenticated `session:current`
  matched the signup token user; an anonymous request was rejected with `Unauthorized`.
- Sign-out succeeded. Marker-guarded INTERNAL cleanup removed exactly one fixture user
  and one password account; dependent counts were zero after SDK session/refresh cleanup.
  A repeated exact-marker lookup/deletion returned all zero counts.
- The temporary cleanup registration was removed and pushed again. A CLI probe confirmed
  that `h1SmokeCleanup:removeFixture` no longer exists. No public admin endpoint was added.

`convex/h1SmokeCleanup.ts` now contains only an unregistered helper for local regression
coverage. Tests cover marker rejection, exact indexed dependency deletion, preservation
of unrelated users/accounts, and idempotence. Password credentials do not create OAuth
verifiers in installed Auth 0.0.96; cleanup is deliberately not a general account deleter.

Operational scripts (require separate explicit authorization before reuse):

- `node scripts/activate-auth-dev.mjs`: DEV identity check, non-overwriting signing setup,
  and push. `--push-only` preserves signing configuration and only pushes.
- `node scripts/smoke-auth-dev.mjs --verify-removed`: confirm cleanup endpoint absence.
- `node scripts/smoke-auth-dev.mjs`: disposable smoke harness; currently fails its cleanup
  preflight before signup because the temporary endpoint was removed. Reuse requires a
  separately reviewed, locally tested temporary INTERNAL registration and removal cycle.

Scripts never directly read local environment files, print CLI/Auth raw output, persist
fixture credentials, or log account identifiers. They reject inherited deployment keys,
set explicit DEV process binding, and announce mutations before each subprocess/action.
The pinned CLI may update its authorized local binding/ignore files during `dev --once`.

This is real API/JWT evidence, **not** browser, Electron, or Windows runtime evidence.
Registration/login UI and Windows/Electron runtime verification remain pending.

Official Auth sources supplied as verified task context (date baseline: 2026-10-05;
not independently fetched during activation):
- https://labs.convex.dev/auth/setup
- https://labs.convex.dev/auth/setup/manual
- https://labs.convex.dev/auth/config/passwords

Installed pinned types/source independently confirmed the named Password export,
provider contract, getAuthUserId signature, and ConvexAuthProvider options.

## API references checked

- https://ui.shadcn.com/docs/components/base/button (CLI-selected Base UI docs)
- https://ui.shadcn.com/code/apps/v4/registry/bases/base/examples/button-example.tsx
- https://www.electronjs.org/docs/latest/tutorial/security
- https://vite.dev/guide/build.html (relative base; installed Vite 7 types also checked)

The TanStack website returned 403 (an initial obsolete path returned 404);
installed Router/History types and source confirmed code-based routing and hash history.
Installed types and successful typechecking are version-specific evidence, not runtime evidence.
