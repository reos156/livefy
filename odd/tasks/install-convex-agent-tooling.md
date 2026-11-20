# Install Convex Agent Tooling

## Objective

Prepare this Pi workspace with the official Convex agent knowledge and MCP integration, without initializing an application or provisioning a deployment.

## Problem

The workspace originally had WhatsApp skills and the Kapso MCP server, but no Convex-specific agent skills, MCP server, or managed AI guidance.

## Why

Installing agent tooling now provides current Convex workflows and deployment inspection tools before application development begins, while deferring application and infrastructure decisions.

## Scope

- Install all official `get-convex/agent-skills` skills for Pi.
- Add the official Convex MCP server beside the existing Kapso server.
- Install Convex AI files only when an application root exists and can target Pi safely.
- Preserve all existing tooling and user files.

## Constraints

- Do not initialize a Convex application.
- Do not install the Convex application dependency.
- Do not create or select a Convex deployment.
- Do not enable production deployment access.
- The user manually removed the Convex skills recovery trees; do not recreate them.
- Preserve the unrelated local `.codegraph/` index.
- Do not commit because the user did not explicitly authorize commits.
- Technical artifacts remain in English.

## Delivery Strategy

- Strategy: `ask-on-risk`.
- Forecast: 33 third-party skill directories plus MCP and AI-file configuration; generated/vendor skill contents are excluded from authored-line estimates.
- Pull request and commit delivery are out of scope for this request.

## TDD and Verification

- TDD mode: not applicable to tooling installation.
- Source: this change adds agent assets and configuration, not runtime behavior.
- Verification: CLI inventory/status commands and structural readback.

## Tasks

- [x] **CONVEX-TOOLS-1 — Install all official Convex skills for Pi**
  - Route: delegated direct; recovery completed after installation CLI scope errors.
  - Acceptance: all 33 currently published official skills are installed under Pi's project skill path and recorded by the skills lock.
  - Checks: `npx -y skills@latest list --agent pi`; read-only structural verification of skill files, lock sources, WhatsApp skills, and active destinations.
  - Evidence: independent verifier confirmed all 33 Convex skills and `SKILL.md` files under `.pi/skills`, 33 official `get-convex/agent-skills` lock entries, and all three WhatsApp skills retained. It found no active Convex entries in 54 unintended destinations and confirmed 1,782 unintended entries quarantined reversibly. RDD assessment failed closed as unassessable because the candidate includes untracked paths; independent verification was therefore required and passed.

- [x] **CONVEX-TOOLS-2 — Configure the Convex MCP server**
  - Route: inline direct, one known config file.
  - Acceptance: `.mcp.json` preserves Kapso and adds Convex using `npx -y convex@latest mcp start`, without production flags or a guessed app path.
  - Checks: delegated structural validation of JSON and server command/arguments.
  - Evidence: verifier parsed `.mcp.json`, confirmed the Kapso URL remained unchanged and the Convex command/arguments matched the official docs; no production flags or project path were configured. The current MCP tool gateway still does not list Convex, so runtime activation/server startup remains unverified and may require a host/session reload.

- [x] **CONVEX-TOOLS-3 — Check AI files readiness without initializing an app**
  - Route: delegated read-only exploration and verification.
  - Acceptance: establish whether AI files can be safely installed now; record the exact blocker without creating an app or choosing another agent target.
  - Checks: `npx -y convex@latest ai-files status`; inspect official docs and CLI behavior.
  - Evidence: status exited 1 because the root lacks `package.json` and Convex app root. It stopped before checking AI-file state. Read-only inspection established `ai-files install` reads project config, defaults skill targets to Claude Code and Codex unless configured, and would create generated Convex guideline/state files plus managed agent files. No files were changed. AI files are deferred until an app/package root exists and can target Pi explicitly.

- [x] **CONVEX-TOOLS-4 — Verify the installed Convex tooling**
  - Route: delegated verification plus parent structural spot-check.
  - Acceptance: skills and MCP JSON are structurally valid; every skipped or blocked check is reported.
  - Checks: CLI inventory/status where available, JSON parse, Git status and MCP gateway readback.
  - Evidence: independent verifiers confirmed all 33 skills, lock entries, WhatsApp preservation, quarantine counts, and valid `.mcp.json`. Parent readback confirmed `.pi/skills/convex/SKILL.md`, the lockfile, `.mcp.json`, Git status, and the current MCP gateway inventory. AI file status remains blocked as above; gateway does not yet expose Convex.

- [ ] **CONVEX-TOOLS-5 — Install AI files once the Convex app target exists**
  - Route: delegated writer when app development begins.
  - Acceptance: install current Convex AI files from the chosen Convex app root with Pi explicitly selected, without enabling deployment access or overwriting non-managed user content.
  - Checks: inspect AI file status and managed sections after install.
  - Evidence: deferred; the root currently has no `package.json` or Convex app target, and the user deferred app setup/dependency/deployment until development begins.

## Progress

- Official Convex documentation and CLI help were reviewed. The repository root has no Convex app, `convex.json`, or root `package.json`.
- The Skills CLI reported 33 official skills and detected Pi. A recovery attempt mistakenly ran the CLI's `--all` option, which populated 54 other agent skill destinations.
- The user explicitly authorized reversible quarantine of all unintended Convex entries from exact enumerated roots. A worker moved 1,782 entries into `odd/recovery/convex-skills-unintended/`; the earlier partial state was preserved under `odd/recovery/convex-skills-partial/`. The user later deleted the recovery trees manually; a read-only audit confirmed both paths are absent.
- After the user authorized cleanup of confirmed-empty destinations, `rmdir` removed 53 empty skill destinations and their empty parent directories where applicable (107 directory removals total). No files or non-empty directories were removed. Independent verification confirmed all 53 targets are absent; `.agents/skills` still contains the three WhatsApp skills, `.pi/skills` retains 33 Convex skills plus three WhatsApp links, and the 33 Convex plus three WhatsApp lock entries remain.
- Independent read-only verification confirmed 33 active Pi skills, 33 official lock entries, three WhatsApp skills available to Pi, zero active Convex entries in the 54 unintended roots, and the documented quarantine counts.
- `.mcp.json` now preserves Kapso and adds Convex's official `npx -y convex@latest mcp start` command. It deliberately has no project target or production access flags. The current MCP tool gateway does not yet list Convex; runtime activation/server startup is unverified.
- Convex AI files were not installed: the official CLI status check failed closed without a root app `package.json`, and there is no safe Pi-targeted app root yet.
- `.codegraph/` is an unrelated local index and remains preserved.

## Next Step

When app development starts, select the Convex app root, install AI files there with Pi explicitly targeted, then reload the Pi host/session so the installed skills and MCP configuration can be loaded. Do not initialize the app or configure a deployment as part of this tooling setup.
