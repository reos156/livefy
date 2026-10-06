# Electron-first, web-ready architecture amendment

## Objective and authorization
Document mandatory Electron-first MVP architecture allowing a later responsive web client/cloud ingestor without duplicated UI or business logic. Documentation only; preserve H1.1–H1.3. No runtime/provider changes or PR authorized. User subsequently authorized issue creation, commit and push on feat/mvp.

## Mandatory decisions
- Desktop: video/products/events; future web: products/events without video.
- Shared UI/routes/state/business behavior; native capabilities and authentication bootstrap behind adapters.
- Standalone ingestor; Convex owns business, persistence and authorization.
- Separate commercial live, producer session and viewer presence; desktop closure stops only its local runner.
- Defer web/cloud deployment and verification; no noVNC restoration.
- Future >=90% shared owned frontend target requires measurement, not current certification.

## Tasks
- [x] A1 — Amend scope/access plan and verify consistency while preserving completed evidence.

## Routing and verification
Delegated writer for two non-trivial documents: docs/livefy-scope-mvp_20260928.md and odd/tasks/mvp-h1-access-windows.md. Historical scope read-only. Documentation has no meaningful behavioral RED/GREEN; structural readback and independent verification instead. Forecast 100–180 authored lines; writer estimate ~125 plus three corrective replacements, not independently measurable for untracked scope. Unrelated files untouched.

## Progress and evidence
Completed documentation amendment. Parent spot-check confirmed mandatory boundaries. Native assessment unavailable due untracked declaration requirement; followed returned independent verification plan. Initial verifier FAIL identified unsupported feasibility claim, premature Bun mandate and order/producer shutdown coupling. Writer corrected these; independent re-verification mux4xfyn-7-7bat PASS, no blockers. Tracked access-plan `git diff --check` exit 0; diff confirmed H1.1–H1.3 checklist/evidence unchanged. Targeted reads/grep confirmed corrected scope:57,293,312 and lifecycle consistency.

Qualifications: scope remains untracked; ordinary git diff does not cover it. Whole-file whitespace check reports eight findings at lines 4,5,6,83,295,298,302,509 (exit 3). No independent pre-edit baseline proves their history or exact change count. Left unchanged, not considered semantic blockers. No runtime tests/builds: docs-only. Future web/cloud behavior and >=90% sharing remain unverified. Delivery authorized subsequently: retrospective issue https://github.com/reos156/livefy/issues/9 created and read back OPEN, no labels. Commit/push is restricted to this tracker, current scope and access plan on feat/mvp; no main update. The work-unit commit is identifiable by its issue #9 reference in Git history.

## Next step
Continue H1.4 in a separately authorized implementation turn, enforcing the architecture amendment. Future browser and cloud acceptance remain separately scoped phases.
