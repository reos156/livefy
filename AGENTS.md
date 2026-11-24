# Project agent guidance

## TikTools documentation

When working on TikTools integrations (`api.tik.tools`, `@tiktool/live`, or the TikTools MCP server), consult the relevant section of the official documentation at https://tik.tools/docs before relying on API shapes, event fields, authentication, or plan limits. Search for the specific topic and read only the relevant section; do not load or paste the entire documentation into the agent context. Record the source URL and access date in findings, and check the installed SDK version against version-specific guidance when applicable. Treat MCP tool descriptions and examples as distinct from the full REST/WebSocket/SDK reference. If the official documentation is unavailable, state what could not be verified rather than guessing.

## Frontend and UI — standing premise

Every Livefy screen is built on the official shadcn/ui components. Adding an official registry component is authorized; building a competing hand-made visual control is not.

- Read `.pi/skills/shadcn/SKILL.md` and the `rules/` page that matches the work before implementing any frontend surface. It governs loading states (`Spinner`, `Skeleton`, `Progress`; no `animate-pulse` divs), buttons (`Button` has no `isPending`; compose `Spinner` + `data-icon` + `disabled`), feedback, overlays and composition.
- Compose with the primitives installed under `apps/desktop/src/components/ui` (today: alert, button, card, field, input, label, separator) plus any official registry item the work genuinely needs. Name the component to install; never emulate a primitive with custom CSS.
- Follow the shared visual contract in `apps/desktop/README.md` (section "Contrato visual compartido y aceptación de pantallas"): semantic tokens from `src/styles.css` only, `.dark` for the dark theme, the installed primitives, and the per-screen acceptance matrix.
- Application-specific composition, layout and product logic stay ours; this premise does not authorize installing the whole catalog or rewriting business logic.

## Git and delivery — standing premises

- **An issue closes with the pull request that resolves it**, never on the agent's own initiative. Reference it from the PR that carries the work (`Closes #N`) and let the merge close it. A premature close must be reopened, not argued.
- **Publish only in the approved form**: `git -C <absolute worktree path> push <named-https-remote> <branch>`. The delivery guard rejects compound forms such as `cd <path> && git push`, and the SSH remote `origin` is not usable by the agent, so push through the named HTTPS remote authenticated by the `gh` credential helper. Never read, copy or relocate the user's SSH keys.
- **Never discard the error output of a command whose number decides a delivery.** A fetch with its stderr redirected reported a stale remote ref, which produced a wrong "commits unpublished" count and a pull-request branch with no commits of its own. Let the error surface or check the exit status, and re-read the remote ref before sizing or slicing a delivery.
- **One branch per scope, delivered as one pull request.** Cut each scope from an updated remote `main` (`git switch -c <type>/<scope> https-origin/main`), deliver it as its own PR, and merge it before starting the next scope. The access milestone shipped as one branch with 78 commits and roughly 17k changed lines; that shape is acceptable only to close an already-verified milestone and never as the default, because a diff of that size is approved rather than reviewed and a rollback stops being surgical. Keep a branch short-lived, never stack dependent branches (schema → wizard → dashboard is a sequence of merges, not a chain of branches), and keep a work unit that lands on a high-risk item in its own commit so a reviewer can take it alone. A scope may span several units when it closes in days and stays reviewable. Reuse the sequential worktree and switch branches; open a separate worktree only for scopes that truly run in parallel.

<!-- BEGIN:turborepo-agent-rules -->

# This is NOT the Turborepo you know

Turborepo configuration, task behavior, and CLI commands can vary between installed versions and may differ from your training data. Resolve the `turbo` package from this file's directory or relevant workspace; in monorepos, it may not be visible from the repository root. For example, run `node -p "require.resolve('turbo/package.json')"` from a workspace that depends on `turbo`.

Read `docs/README.md` inside that installed package first, then read the relevant pages from its `docs/` directory before changing Turborepo configuration or commands. Heed deprecation notices. These bundled docs match the installed package version and are available without network access.

This block is written and re-added by `turbo` before repository-scoped commands when an AI agent is detected. In the Turborepo source repository, its template is defined in `crates/turborepo-cli/src/cli/agent_guidance.rs`. Removing the managed block while updates are enabled means a later qualifying invocation will add it again. Set `"agentGuidance": false` in the root `turbo.json` or `turbo.jsonc` to opt out; this does not remove an existing block. Keep the block committed with your work to avoid an uncommitted change on the next agent invocation.
<!-- END:turborepo-agent-rules -->
