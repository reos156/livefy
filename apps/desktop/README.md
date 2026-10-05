# Livefy desktop bootstrap

H1.1: an isolated Electron shell and React access preview. Authentication,
credential collection and packaging are not implemented; access controls remain unavailable.

This is a present logical reconstruction of the bootstrap boundary, not an exact
historical snapshot. Current staged checks are separate from prior human evidence.

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
Prior human Windows evidence: typecheck, 4 tests and build passed; a screenshot
showed the access preview after launch. That evidence belongs to the earlier bootstrap,
not this reconstructed snapshot. No fresh Windows launch is claimed here. Restart,
installer/distribution and comprehensive runtime security checks remain unverified.
No installer, signing or distribution tooling has been selected.
