# R1 — Configuration wizard

Implementation of requirement R1 (configuration wizard) from `docs/livefy-scope-mvp_20260928.md`, plus the shop data model it needs. R2 (initial dashboard) is a separate later scope and is not delivered here.

Branch: `feat/config-wizard` (cut from `https-origin/main` at `c69b491`). Issue: #24.

## Specs

Quoted verbatim from `docs/livefy-scope-mvp_20260928.md`.

- **S1** — R1: "MUST capturar nombre de tienda, descripción, categorías y al menos un medio de pago." (`:190`)
- **S2** — R1: "MUST permitir editar esa información luego." (`:191`)
- **S3** — R1: "MUST mostrar el handle bot TikTok y número bot WhatsApp provistos por plataforma." (`:192`)
- **S4** — R1: "SHOULD permitir WhatsApp personal opcional para notificaciones." (`:193`)
- **S5** — R1: "MUST NOT solicitar ni persistir secretos globales del proveedor dentro del instalador." (`:194`)
- **S6** — D3: "`E->>C: shops.completeWizard`" → "`C->>C: Verifica identidad y crea shop`" → "`C-->>E: shopId y datos públicos de bots`" (`:468`–`:470`)
- **S7** — R2 (applies here because the wizard is what creates and reads `shopId`): "MUST obtener `shopId` desde identidad autorizada, nunca confiar en un identificador arbitrario del cliente." (`:200`)
- **S8** — AC1: "Wizard completo conduce al CTA “Conectá tu primer live”." (`:336`)

Cross-cutting from the same document: `:392` "authz por ownership" for Convex, `:396` frontend tests covering "wizard".

## Decisions taken inside the spec's silence

The scope document names the entities but writes no field, type, validator, catalogue or table for them. These decisions close that gap without adding requirements:

- **D-A — Categories and payment methods are operator-entered values.** The document never enumerates a catalogue, so none is invented: both are free-entry lists with add/remove, validated non-empty. A preset catalogue would be a new product requirement.
- **D-B — One shop per authenticated operator** for the MVP. `shopId` is therefore derived from the authenticated identity, never passed by the client (S7).
- **D-C — `shops.completeWizard` is create-or-update.** S2 requires later editing, so the same mutation serves the first completion and every edit, and is safe to resubmit.
- **D-D — Bot identifiers are platform-owned.** `tiktokBotHandle` and `whatsappBotNumber` are never accepted from the client; the mutation preserves whatever the platform set, and the screen displays them read-only with an explicit pending-assignment state. This satisfies S3 without inventing a provisioning pipeline and keeps S5 intact (no provider secrets, global or otherwise, in the installer, renderer, or plain storage).
- **D-E — Screen copy is Spanish**, because S8 quotes the CTA verbatim in Spanish and the product's operators are Spanish-speaking; the existing access screens stay untouched and out of scope.
- **D-F — Route shape.** `/app` (behind the existing `PrivateAccess` gate) renders the wizard when the operator has no shop, and the completion summary carrying the S8 CTA when it does. R2 replaces that summary with the dashboard in its own branch; no dashboard metrics are implemented here.

## Tasks

- **T1** — Convex shop model: `shops` table, validators, `shops.completeWizard` (create-or-update, identity-derived ownership, platform-owned bot fields preserved) and the shop query the app entry reads. Specs: S1, S2, S3, S5, S6, S7. Route: inline. Commit: `e8a902c`.
- **T2** — Wizard screen using only official shadcn primitives (`FieldGroup`/`Field`, `Input`, `Button` with `Spinner` for pending state), free-entry list editors for categories and payment methods, read-only bot block, optional personal WhatsApp. Specs: S1, S3, S4, D-A, D-D, D-E. Route: inline. Commit: `686d221`.
- **T3** — App entry routing: no shop → wizard, shop present → completion summary with the exact CTA "Conectá tu primer live". Specs: S6, S8, D-F. Route: inline. Commit: `2b2f348`.
- **T4** — Tests: Convex ownership/authz, idempotency, edit path, platform-field preservation, validation rejection; UI required/optional fields, list editing and submission. Specs: S1–S7. Route: inline, plus one bounded `gentle-ai-worker` for the S2 edit entry point. Commit: `e8a902c`, `686d221`, `2b2f348`.
- **T5** — Verification (focused, full suite, typecheck, build) and delivery. Specs: all. Route: independent `gentle-ai-verify` (risk line names security). Commit: the `docs(odd)` commit carrying this evidence; its hash lives in the PR body, since a document cannot contain the hash of the commit that creates it.

## Log

- **L1** — "retomemos el mvp, puedes listar nuevamente el todo para elegir por donde seguir"
- **L2** — Scope choice, from the offered options: "R1 + R2: Wizard y Dashboard".
- **L3** — "recuerda que una vez hecho el merge tanto las ramas remotas como locales se deben eliminar y alinear todo a main"
- **L4** — "recuerda que una vez hecho el merge tanto las ramas remotas como locales se deben eliminar y alinear todo a main, esto debe ser premisa e ir en agents.md" + "continua". Delivered separately as issue #22 / PR #23 before this scope, per the one-branch-per-scope premise.
- **L5** — Sequencing decision (parent, not the human): the repository premise states "schema → wizard → dashboard is a sequence of merges, not a chain of branches", so R2 is deferred to its own branch cut from `main` after this scope merges.

## Verification

Implemented on `feat/config-wizard`, three work units: `e8a902c` (Convex model, 339 lines), `686d221` (screen, 413 lines), `2b2f348` (entry and route wiring, 204 lines).

Observed RED before implementing, in two stages and without inventing a pass:
- First stage, both new modules absent: `bun run test src/shop-wizard.test.tsx src/app-entry.test.tsx convex/shops.test.ts` → exit 1, 14 failed / 1 passed, failing on module resolution (`Could not find module for: "shops"`, missing `./shop-wizard`). This is module-resolution RED, not behaviour-level RED; it proves the tests exercise code that did not exist, nothing more.
- Second stage, before the S2 edit entry point: `bun run test src/app-entry.test.tsx` → exit 1, 1 failed / 5 passed, "Unable to find an accessible element with the role 'button' and the name 'Editar datos de la tienda'". That one is behaviour-level RED.

Final GREEN, reported by the independent verifier from its own run and re-run by the parent after the commits:

| Check | Command | Result |
| --- | --- | --- |
| Focused | `bun run test <7 files>` | exit 0, 57 passed |
| Full suite | `bun run test` | exit 0, 26 files, 455 passed, 0 skipped |
| Desktop typecheck | `bun run typecheck` | exit 0 (`tsc --noEmit`, two `node --check`) |
| Convex typecheck | `bun x --no-install tsc --noEmit -p convex/tsconfig.json` | exit 0 |
| Build | `bun run build` | exit 0; renderer 2101.53 kB, preload 4.21 kB, main 417.67 kB; only the pre-existing >500 kB chunk advisory |
| Whitespace | `git diff --check` plus direct reads of the new files | exit 0 |

Independent verification (`gentle-ai-verify`, read-only, risk item 2) found **no blocking defect** and passed every claim it was given:
- A — `shopId` and `ownerId` cannot come from the client; ownership always derives from `requireUser`. A probe sending `ownerId` got "Validator error: Unexpected field". (S7)
- B — bot identifiers are absent from the mutation arguments and survive an edit; a client attempt is rejected and the row stays byte-identical. (S3, D-D)
- C — validation is enforced server-side: 16 invalid shapes rejected on create and on edit, with the whole table identical before and after each rejection; boundaries 80/500/10/40/32 accepted. (S1)
- D — no env, key, secret, token, `console` or plain storage access in the new code. (S5)
- E — the summary renders the CTA byte-identical to the spec string. (S8)
- F — no authentication, CSP, protocol, packaging or dependency file touched.

The new table adds no migration concern: the baseline schema declared zero tables, so there is no row to backfill and Convex creates the table on deploy.

## First review round and its corrections

The first native review approved the three unit commits (`lineage review-2291edf0b6f7ca17`, authority burned) and left five non-blocking findings. They were fixed in `c81b538` before delivery, because one of them was a real defect:

- **Sign out also submitted the shop form.** The wizard painted its `footer` slot inside `<form>`, and the caller passes `LogoutButton` there; a button without `type="button"` defaults to submit. The case was written first and failed for the right reason — clicking it called `onSubmit` with the current values — which is behaviour-level RED, not module resolution. The footer is now a sibling of the form, so no caller-supplied control can submit it.
- The form now mirrors the list-length bound it already uses to hide the add control.
- The edit path no longer writes the server-owned `ownerId`; the insert path still writes it.
- The operator-copy map is typed against the closed set of backend codes, so a renamed code fails the typecheck instead of silently falling back.
- One boundary test per remaining validation bound (description, list item, payment methods, personal WhatsApp), each asserting rejection plus unchanged stored data.

Suite after the corrections: 26 files, 460 tests, exit 0; both typechecks and the build exit 0.

The final review receipt for this candidate is recorded in the PR body, since a committed document cannot contain the review of its own commit.

## Follow-ups, deliberately outside this scope

- **S2 edit form has no cancel control.** An operator who opens the prefilled form can only save (idempotent, harmless) or sign out. Not required by R1; left out rather than expanding the diff. Candidate for R2 or a small polish unit.
- **`_generated/api.d.ts` still lacks `shops`.** Regenerating it needs the deployment (`npx convex dev`), which this scope did not authorize. `src/lib/shop-api.ts` therefore carries explicit typed function references; regenerate and drop them when the backend is deployed.
- **`by_owner` is not unique.** Convex mutations serialize conflicting writes, so a duplicate first completion is not expected, but both reads take `.first()` precisely so a duplicate would degrade instead of bricking the screen.
- **No renderer error boundary.** A `shops:current` "function not found" (backend not deployed) throws during render. The renderer and the functions ship together; a boundary is a separate resilience unit.
- **Bot identifiers have no writer yet.** Whatever provisions them must supply `wizardCompletedAt` and `updatedAt`, which the schema requires.

## Risk

`Risk: item 2` (security) — this lands the authorization surface of a new multi-tenant model: ownership derived from the server-validated identity, a mutation that must never accept a client-supplied owner or shop, and platform-owned fields that must stay unwritable. Independently verified as above; item 1 does not apply (additive table, no migration, validated writes) and item 3 does not apply (no consumer of the new contract yet).
