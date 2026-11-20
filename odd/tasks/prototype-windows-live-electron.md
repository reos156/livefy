# Windows Electron TikTok LIVE Prototype

## Objective

Create a disposable Windows desktop spike that hosts a placeholder Livefy dashboard and a separate top-level TikTok LIVE view in Electron. Answer whether the operator can open a LIVE and play its video/audio locally, without a cloud VM or media relay.

## Why

The current viewer depends on a cloud-style Linux browser stack. The user wants lower latency and infrastructure cost by using the operator's Windows machine. The user selected an Electron installer that hosts both the web dashboard and TikTok in one desktop window.

## Scope and constraints

- Add a new disposable project under `prototypes/tiktok-live-electron/`; do not modify the working Docker prototype.
- Use Electron `WebContentsView` for TikTok as a top-level web page, not an HTML iframe. Keep a small local placeholder dashboard because this checkout has no actual Livefy frontend to embed.
- Play the TikTok page's audio/video directly on the local machine. Do not capture, encode, or relay media to the dashboard or cloud.
- Allow manual TikTok login only. Do not automate credentials or attempt to bypass TikTok restrictions.
- Include a Windows installer build target and a concise run/build guide. The current host is Linux under WSL2; Windows installer/runtime behavior cannot be certified here and needs a Windows smoke test.
- Keep remote TikTok content isolated: no Node integration, context isolation and renderer sandbox enabled, narrow preload/IPC, and safe navigation/permission defaults.
- Non-goals: the production Livefy dashboard, chat ingestion, cloud APIs, remote access, application-loopback streaming into an ordinary browser, and changes to the existing Docker viewer.

## Accepted architecture

Electron is the desktop shell. Its local dashboard pane is a placeholder; a separate `WebContentsView` navigates directly to the operator-supplied TikTok LIVE URL. Electron WebContentsViews are controlled by the main process and are not DOM elements, so pane layout is coordinated by the shell. In this same-window design, no local media-capture or streaming service is needed.

## TDD and checks

- TDD mode: **off**. Source: `docs/livefy-scope-mvp_20260925.md`, Fase 0, which defines spikes as disposable prototypes and explicitly excludes Strict TDD.
- Test runner: none for this spike. Presence of a package or syntax checks does not enable TDD.
- Required focused checks after implementation: `npm run check` and `npm run dist:win` from `prototypes/tiktok-live-electron/`; record exact outcomes. A Windows installer build may be constrained by the WSL2 host/toolchain.
- Runtime harness: **N/A on this host**, because Linux/WSL2 execution does not verify a native Windows install, Windows audio, or TikTok behavior in Windows Chromium. Preserve a manual Windows validation checklist and mark those results pending until actually observed.

## Tasks

### T0 — Reconcile unexpected shared-worktree state

- [x] Identify the provenance of the newly appeared `prototypes/electron-spike/` files without modifying or deleting them.
- [x] Confirm there is a non-overlapping authorized implementation path before resuming T1.
- Route: parent-only incident diagnosis; no product-file writes.
- Evidence: the user confirmed `prototypes/electron-spike/main.js` is their functional Electron prototype and explicitly asked to stop this session's work.

### T1 — Build the local Electron viewer spike

**Status: stopped by the user before implementation; do not resume without new authorization.**

- [ ] Create a minimal secure Electron shell with a local placeholder dashboard and a resizable TikTok `WebContentsView`.
- [ ] Let the operator enter a TikTok LIVE URL and log in manually; preserve the browser profile locally between launches.
- [ ] Keep audio/video local; do not add a capture or relay pipeline.
- [ ] Add a Windows installer target and quick-start/manual-validation documentation.
- Route: delegated to one bounded writer. Trigger: multi-file implementation; allowed edit surface is only `prototypes/tiktok-live-electron/**`.
- Evidence: pending.

### T2 — Verify the spike and record target-platform limits

**Status: canceled; no checks were run in this session.**

- [ ] Run `npm run check` and `npm run dist:win`; record results without masking unsupported-host failures.
- [ ] Confirm the guide distinguishes a generated installer from a verified Windows runtime.
- [ ] Keep actual Windows login, LIVE playback, and audio verification explicitly pending until tested on Windows.
- Route: choose verification routing from native ASSESS after T1; parent must spot-check one reported command. Windows-only manual checks require a Windows host.
- Evidence: pending.

## Acceptance criteria

1. TikTok loads in a separate top-level Electron view rather than an iframe.
2. The dashboard placeholder and TikTok view share one resizable desktop window.
3. The app does not use Docker, Xvfb, VNC/noVNC, PulseAudio, ffmpeg, or a cloud media relay.
4. Remote content has no Node.js integration and only a narrow, validated IPC surface.
5. A Windows installer build is configured and a reproducible command is documented.
6. Windows login, video, and audio results are reported as pending unless actually tested on Windows.

## Progress and evidence

- Repository exploration found the existing viewer under `prototypes/tiktok-live-browser/`, with Xvfb/noVNC and PulseAudio/ffmpeg audio streaming. No Livefy dashboard source exists in this checkout.
- Official references reviewed: Electron [Web Embeds](https://www.electronjs.org/docs/latest/tutorial/web-embeds), [session API](https://www.electronjs.org/docs/latest/api/session), and [Security](https://www.electronjs.org/docs/latest/tutorial/security). These support using a top-level WebContentsView, not relaxing iframe or Electron security.
- The user confirmed `prototypes/electron-spike/main.js` is their functional Electron prototype and instructed this session to stop the implementation tasks. Preserve that directory; this session made no changes there.
- The assigned background worker `muko408q-2-ysvj` timed out after a dismissed question with 0 turns and 0 tool calls. No implementation files were created under the planned `prototypes/tiktok-live-electron/` path.
- T0: complete by user confirmation. T1 and T2: stopped/canceled at user request; no checks, build, or Windows runtime validation were performed.
- Feature branch: `feat/mvp` (already active). No commit or publication was requested; none was made.
- Next step: none unless the user explicitly authorizes a new scoped task.
