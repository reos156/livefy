# Project agent guidance

## TikTools documentation

When working on TikTools integrations (`api.tik.tools`, `@tiktool/live`, or the TikTools MCP server), consult the relevant section of the official documentation at https://tik.tools/docs before relying on API shapes, event fields, authentication, or plan limits. Search for the specific topic and read only the relevant section; do not load or paste the entire documentation into the agent context. Record the source URL and access date in findings, and check the installed SDK version against version-specific guidance when applicable. Treat MCP tool descriptions and examples as distinct from the full REST/WebSocket/SDK reference. If the official documentation is unavailable, state what could not be verified rather than guessing.

<!-- BEGIN:turborepo-agent-rules -->

# This is NOT the Turborepo you know

Turborepo configuration, task behavior, and CLI commands can vary between installed versions and may differ from your training data. Resolve the `turbo` package from this file's directory or relevant workspace; in monorepos, it may not be visible from the repository root. For example, run `node -p "require.resolve('turbo/package.json')"` from a workspace that depends on `turbo`.

Read `docs/README.md` inside that installed package first, then read the relevant pages from its `docs/` directory before changing Turborepo configuration or commands. Heed deprecation notices. These bundled docs match the installed package version and are available without network access.

This block is written and re-added by `turbo` before repository-scoped commands when an AI agent is detected. In the Turborepo source repository, its template is defined in `crates/turborepo-cli/src/cli/agent_guidance.rs`. Removing the managed block while updates are enabled means a later qualifying invocation will add it again. Set `"agentGuidance": false` in the root `turbo.json` or `turbo.jsonc` to opt out; this does not remove an existing block. Keep the block committed with your work to avoid an uncommitted change on the next agent invocation.
<!-- END:turborepo-agent-rules -->
