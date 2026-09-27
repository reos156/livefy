# Document TikTok Live Browser Prototype

## Objective
Write a Spanish Markdown reference explaining the browser prototype's design, construction, implementation, security boundaries, adjustments, and supported start/stop workflow for future Livefy implementation.

## Why
The prototype has served as a disposable validation spike. Future Livefy work needs a source-grounded account of what it does, what it does not do, how operators run it, and which assumptions must not be mistaken for production design.

## Scope
- New user-facing guide: `docs/tiktok-live-browser-prototype.md`.
- Reconcile the previous hardening task's manual-check status with the user's screenshot confirmation and current source inspection: `odd/tasks/harden-tiktok-live-browser.md`.
- No application source, Docker configuration, seccomp rules, image, or container state changes.

## Constraints
- Documentation follows the project's existing Castellano convention.
- Describe the checked-out source, not assumed runtime state. Separate source facts, previously recorded runtime evidence, and the user's latest manual video/audio confirmation.
- The screenshot confirms video/audio playback but does not prove which security sandbox layers are active.
- Do not attribute the initial namespace `EPERM` exclusively to seccomp: exact syscall/arguments and host seccomp/LSM audit evidence were not established in the diagnosis.
- Never recommend `--no-sandbox`, privileged mode, `SYS_ADMIN`, `seccomp=unconfined`, or public exposure of the unauthenticated VNC/audio ports.
- Documentation-only task. Strict TDD is not applicable; the prototype's Fase 0 brief excludes Strict TDD for this disposable spike, and its package has no test script. Verify claims against source and review Markdown structure.
- Estimated authored diff: about 300 lines, below the ~400-line delivery threshold. Delivery strategy: `ask-on-risk`; no PR or push requested.

## Tasks

### T1 — Reconcile source facts and prior verification record
- [x] Map the current browser, audio, container, and Compose flow from source.
- [x] Record the user's manual video/audio confirmation and explain the observed Chromium/TikTok notices.
- [x] Reconcile the previous task artifact without presenting the historical `EPERM` as proof of seccomp causality.
- Route: delegated read-only exploration because understanding spans 4+ files; parent spot-checked current sources and updated the previous hardening task record.

### T2 — Write the implementation and operations guide
- [x] Create `docs/tiktok-live-browser-prototype.md` in Castellano with architecture, build/runtime flow, changes, safety limits, Livefy transfer notes, and copyable start/log/stop/recreate commands.
- Route: one bounded `gentle-ai-worker` writer; exact edit surface was the new guide only. Writer read the doc back and reports `paths-injected` skill resolution.

### T3 — Verify the guide
- [x] Cross-check every file path, command, port, flag, and security statement against current source or explicitly label its evidence source.
- [x] Ensure the guide distinguishes prototype behavior from Livefy's planned droplet/ingestor lifecycle and calls out unresolved assumptions.
- [x] Clarify that `up --build` may recreate the container when its image/config changes, so the container-local TikTok profile may be lost without `--force-recreate`.
- [x] State that `restart: unless-stopped` restarts the container, not arbitrary child processes.
- [x] Qualify `clone3` ENOSYS as the no-`CAP_SYS_ADMIN` path; preserve the capability-conditional rule from the upstream profile.
- [x] Run a targeted read-only follow-up verification after corrections.
- Route: delegated `gentle-ai-verify`; no builds, container operations, or code edits. Native ASSESS was unassessable because unrelated untracked files require explicit declaration; its fail-closed plan requires an independent verifier.

## Acceptance Criteria
- A reader can explain the browser/video path and the separate audio capture/playback path.
- A reader can build, start, inspect logs, stop, resume, and intentionally recreate only `tiktok-browser` from the repository root.
- The guide documents manual login/audio activation, local-only bindings, SSH tunneling, persistence/loss on recreation, and current Chromium warning behavior.
- Current source facts and prior runtime/user-confirmed evidence are clearly distinguished; unresolved security causality and prototype limitations remain explicit.
- No code or runtime changes are made.

## Verification Evidence
- Read-only mapper inspected the project brief and prototype Dockerfile, Compose file, entrypoint, audio server, and client implementation; current source includes `seccomp-chromium.json` and a Compose `security_opt` reference using `${PWD}`.
- Writer created `docs/tiktok-live-browser-prototype.md`, read it back, and checked source paths, commands, ports, and caveats. No Docker/build/test commands ran.
- Native `gentle_review` ASSESS returned `unassessable` (`changedPaths: 0`) because unrelated untracked files were not declared. With RDD off, the fail-closed plan requires an independent verifier.
- Independent source review returned conditional pass with three corrections: `up --build` may recreate and lose the container-local profile; Compose restart policy restarts the container rather than child processes; `clone3` ENOSYS is capability-conditional because the Moby profile allows it with `CAP_SYS_ADMIN`. No runtime commands were run.
- Applied all three wording corrections in `docs/tiktok-live-browser-prototype.md`; targeted independent recheck passed for container-profile loss on `up --build`, container-only restart policy, and capability-conditional `clone3` ENOSYS. No source or runtime files were changed.
- Parent spot-check confirms Compose loopback bindings `127.0.0.1:3000/3001`, `/dev/shm`, `shm_size: 2gb`, and service-only custom seccomp profile. The browser runs through `runuser --user chromium`; the entrypoint includes `--disable-setuid-sandbox`, not `--no-sandbox`.
- User-provided screenshot confirms visible TikTok video and working audio. It shows Chromium's warning about `--disable-setuid-sandbox` and TikTok's logged-out viewing/chat notices. This is not new runtime or sandbox-layer verification.
- The project scope brief says the browser is for manual operator viewing; automation is separate. Its DigitalOcean droplet creation/destruction and second live-ingestor container are not implemented by this one-service prototype.

## Progress
- T1: done. Current source mapping and user screenshot are reconciled; prior task evidence now distinguishes successful runtime outcome from unproven `EPERM` causality.
- T2: done; the bounded writer created and self-read the guide.
- T3: done. Independent review found and parent corrected three operational/security wording issues; targeted follow-up verification passed.
- Next: use the guide as a source-grounded reference during Livefy implementation; no prototype runtime changes were needed for this documentation task.
