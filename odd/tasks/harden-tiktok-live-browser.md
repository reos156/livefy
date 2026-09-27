# Harden TikTok Live Browser Prototype

## Objective
Keep the viewer's noVNC/audio host ports local-only, remove Compose's obsolete-version warning, distinguish intentional ffmpeg shutdown, and run Chromium without `--no-sandbox` under an unprivileged account. Rebuild and smoke-test the viewer while leaving it ready for the user's manual visual/audio check.

## Why
The existing prototype previously published unauthenticated endpoints on all host interfaces and launched Chromium with its Linux sandbox disabled. The user authorized restricting the ports and rebuilding/recreating the active browser container to test the sandbox change. Compose and ffmpeg warning cleanup are also in scope; Chromium's unrelated STUN/DNS diagnostic must not be hidden without evidence.

## Scope
- `prototypes/tiktok-live-browser/docker-compose.yml`: loopback-only host bindings, no obsolete `version` key, and service-scoped seccomp configuration (implemented and runtime-verified).
- `prototypes/tiktok-live-browser/audio-server.js`: child-specific ffmpeg lifecycle and intentional-stop reporting (completed earlier).
- `prototypes/tiktok-live-browser/Dockerfile` and `entrypoint.sh`: dedicated non-root Chromium user, no `--no-sandbox`, and selection of Chromium's unprivileged namespace sandbox (implemented and runtime-verified).
- `prototypes/tiktok-live-browser/seccomp-chromium.json`: profile derived from the active Docker Engine's built-in default, with evidence-backed, argument-filtered namespace rules. The user explicitly approved the full 875-line baseline and narrowly scoped adjustment/tests on 2026-09-27.

## Constraints
- Keep host ports bound to `127.0.0.1`; do not expose VNC/audio on `0.0.0.0`.
- The user authorized rebuilding/recreating only this browser service; do not touch unrelated containers or run `docker system prune`.
- Recreating the browser can terminate its current session and require TikTok login again.
- Do not add `--no-sandbox`, use `privileged`, add `SYS_ADMIN`, set `seccomp=unconfined`, change daemon-wide security policy or host sysctls, or suppress unrelated STUN/DNS messages.
- Preserve the built-in seccomp profile's default-deny behavior. Allow only argument-filtered namespace operations justified by Chromium's unprivileged namespace sandbox. If the host/kernel still denies them, stop and report instead of broadening privileges.
- Strict TDD is not applicable to this disposable prototype: the project brief's Fase 0 explicitly excludes it, and the package has no test script. Use focused build/runtime smoke checks.

## Tasks

### T1 — Harden local exposure and audio shutdown diagnostics
- [x] Bind both published host ports to `127.0.0.1` and remove the obsolete top-level Compose `version` field.
- [x] Track ffmpeg capture instances and distinguish requested shutdown while preserving exit code/signal.
- Evidence: syntax, resolved Compose config, and whitespace checks passed; independent verifier and parent spot-check passed.

### T2 — Verify local-only Compose configuration
- [x] Verify both resolved host bindings use `127.0.0.1` and the obsolete-version warning is gone.
- [x] Provide the user local URL, manual audio activation steps, and remote SSH-tunnel option.
- Evidence: source/config verification passed.

### T3 — Run Chromium as an unprivileged user with its sandbox enabled
- [x] Add a dedicated Chromium user and process-switching support.
- [x] Launch only Chromium as that non-root user with explicit display/audio environment and X access.
- [x] Remove `--no-sandbox` and install Debian `chromium-sandbox`.
- [x] Diagnose the default-policy baseline: as user `chromium`, `unshare --user --map-root-user`, plus PID and network variants, all fail `Operation not permitted` under the current container policy.
- [x] Add the full version-matched Docker default profile and only evidence-backed argument-filtered namespace rules; apply it solely to `tiktok-browser`. On x86_64, `clone()` allows namespace masks USER (`0x10000000`), USER|PID|NET (`0x70000000`), and PID (`0x20000000`); `unshare()` allows only USER (`0x10000000`). Other namespace bits remain denied.
- [x] Disable only the legacy setuid sandbox path (not the namespace sandbox), then verify Chromium's namespace sandbox starts and remains enabled.
- Evidence: Chromium's helper is installed root-owned mode 4755. Docker Engine is 29.7.2; service inspection reports `Privileged=false` and no added capabilities. Moby tag `docker-v29.7.2` (tag object `d681cdaead9340bd36c513c7f5413a21bc679cfa`) peels to commit `6a43e3d5afddf4111da0f864bbc7cae5d7e95001`; its 875-line `seccomp/default.json` baseline SHA-256 is `536529b665dd0972c37bfb569f5d4ac8a53592e7b00752bc39ff063ca9864c74`. Final profile is 962 lines, SHA-256 `a82f21c1953bb7d6d408357f46fcf2e791b5758decf3ee6da06c5f26d39763a6`, retaining default deny and `clone3` ENOSYS. Runtime verifier confirmed Chromium UID 999, no forbidden sandbox flags, distinct renderer user/PID/network namespaces, and `Seccomp_filters=2` in renderers (one in container init). Logs show no namespace `EPERM` or “No usable sandbox”.

### T4 — Recreate and smoke-test for the user's manual check
- [x] Rebuild/recreate only `tiktok-browser` as previously authorized.
- [x] Confirm loopback-only bindings, HTTP 200 on noVNC and the combined page, and a 9,600-byte audio PCM frame.
- [x] Receive explicit user authorization for a narrowly scoped `tiktok-browser` seccomp adjustment and tests (2026-09-27).
- [x] After the safe policy/runtime change, confirm Chromium's UID/arguments and active sandbox, plus browser/audio service; leave it running for manual testing.
- Evidence: rebuilt/recreated only `tiktok-browser`; Compose retains loopback bindings, both HTTP endpoints return 200, and the audio WebSocket produced one 9,600-byte PCM frame. `docker inspect` confirms the custom profile, `Privileged=false`, no `CapAdd`, and no unconfined seccomp. A headless `chrome://sandbox` probe returned `chrome://newtab` (“incorrect profile type”) and did not expose its diagnostic page; independent `/proc` namespace and seccomp evidence confirmed active sandbox layers. The user still needs to confirm visible TikTok playback and audible output manually.

## Acceptance Criteria
- Chromium runs as non-root and without `--no-sandbox`.
- Chromium's namespace and seccomp sandboxing are active without privileged mode, `SYS_ADMIN`, or unconfined seccomp.
- Host ports remain loopback-only.
- noVNC and combined page work; the audio WebSocket supplies PCM data; user can manually confirm visual and audible output.
- No unrelated services are touched; the browser service remains loopback-only.
- STUN/DNS diagnostics are not suppressed or represented as resolved.

## Verification Evidence So Far
- `node --check` for audio server and prior Compose configuration/whitespace checks passed.
- Static checks for entrypoint, Compose, no-`--no-sandbox`, and whitespace passed.
- Build installed `chromium-sandbox` version `154.0.8037.57-1~deb12u1`; helper reports `4755 root:root`.
- Prior runtime: Compose service Up on loopback; ports 3000/3001 and audio page both HTTP 200; audio WebSocket supplied 9,600 bytes.
- Prior Chromium sandbox launch failed namespace creation with `Operation not permitted`; no Chromium process survived. Docker reported built-in seccomp and no added capabilities.
- On 2026-09-27, a verifier ran three non-persistent baseline probes inside the running service as `chromium`: `unshare --user --map-root-user true`, plus the PID and network variants, each exited 1 with `Operation not permitted`. Afterward, no Chromium process was present. No files or runtime state were changed by those probes.
- Version-matched research on 2026-09-27 verified Moby Engine tag `docker-v29.7.2` (tag object `d681cdaead9340bd36c513c7f5413a21bc679cfa`, peeled commit `6a43e3d5afddf4111da0f864bbc7cae5d7e95001`); the exact 875-line default seccomp JSON SHA-256 is `536529b665dd0972c37bfb569f5d4ac8a53592e7b00752bc39ff063ca9864c74`. Chromium's current `namespace_sandbox.cc` uses USER/PID/NET namespace flags, and `credentials.cc` probes `clone(CLONE_NEWUSER)` plus `unshare(CLONE_NEWUSER)`.
- Runtime verification rebuilt/recreated only the browser service. Chromium runs as UID 999; renderers have distinct user/PID/network namespaces and two seccomp filters, while the container init has one. HTTP 200 on loopback ports 3000/3001 and a 9,600-byte audio PCM frame passed. The headless `chrome://sandbox` page probe was inconclusive (“incorrect profile type”), but `/proc` independently confirmed the namespace/seccomp layers. STUN DNS warning `stun.l.google.com` / `-105` remains visible and unresolved.
- No manual visual playback or perceptual audio confirmation was performed; the viewer is left running for the user-owned check.
- No package test script exists. Manual visual playback and perceptual audio confirmation remain pending from the user.

## User Test Procedure
Once Chromium is confirmed running, open `http://127.0.0.1:3001/` on the Docker host, click **Activar audio**, verify the embedded noVNC browser, and confirm TikTok video/audio manually. The URL is hard-coded; an offline live may show no stream. Recreating can require a fresh TikTok login. Stop afterward with `docker compose -f prototypes/tiktok-live-browser/docker-compose.yml stop tiktok-browser`.

## Progress
- T1: done.
- T2: done.
- T3: done. The default-deny Docker profile is preserved with argument-filtered Chromium user/PID/network namespace rules, applied only to `tiktok-browser`; Chromium launches as non-root without disabling its namespace sandbox.
- T4: automated runtime smoke complete; service remains running on loopback. The user-owned visual TikTok playback and audible audio confirmation remain pending. The headless `chrome://sandbox` probe was inconclusive, but `/proc` confirms renderer namespaces and the additional seccomp filter.
- Next: open `http://127.0.0.1:3001/`, click **Activar audio**, and manually confirm the embedded TikTok video/audio. If that passes, the browser hardening work unit is fully validated. Never fall back to `--no-sandbox`.
