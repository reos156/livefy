# R1.1 — Store configuration redesign

Second pass over requirement R1: the screen the human rejected, plus three product corrections (selectable categories, Colombian payment methods, mandatory WhatsApp) and the request that those catalogues live in the database instead of in code.

Issue: #30 (approved with corrections). Branch: none yet — no branch is cut before the design direction is chosen. Design: `design/config-tienda/`.

## Specs

Quoted verbatim from the human.

- **S1** — Categories are chosen, not typed: "las categorias deben poderse elegir y no ser escritas por el usuario aqui investiga tipos de categorias maneja tiktok para sus tiendas/cuentas". The list proposed in issue #30 was approved ("1. ok").
- **S2** — Payment methods: "2. omite contraentrega y tarjeta o link pago". Remaining set: Nequi · Llave Bre-B · Daviplata · Transferencia a cuenta de ahorros.
- **S3** — Bre-B captures its key: "3. Solicitar la Llave".
- **S4** — WhatsApp is mandatory, with every dial code and Colombia by default: "Para el WhatsApp de contacto que no es opcional usa un selector con el identificador de pais en por defecto el +57 de Colombia" and "4. agrega todos los indicativos de los paises eso ya es facil ahora".
- **S5** — Catalogues live in the database: "Para que estas configuraciones no queden quemadas en el codigo agregalas al esquema de la base de datos".
- **S6** — The screen is redesigned: "no me gusta nada por favor hagamos un rediseño de la UI de esta pantalla".

Boundaries inherited from the approved issue: UI only through official shadcn primitives; the access landing (H1) is out of scope; no real TikTok Shop or Bre-B integration; design directions are chosen by the human before implementation.

## Decisions

- **D-A — Categories are ours, not TikTok's.** Research (issue #30, 2026-11-25) established that TikTok exposes categories only as a closed, market-specific tree via API, that no Colombia tree exists, and that TikTok Shop in Colombia is unconfirmed. The curated ten-item list is therefore our own and maps to TikTok's tree when that market opens.
- **D-B — Bre-B's key is validated as part of the method**, and the value is stored with the shop, not with the catalogue.
- **D-C — Dial codes are data.** The full country list is seeded from a verifiable source with its origin and access date recorded, never transcribed from memory.
- **D-D — `shops` stops holding free text for categories and payment methods** and references catalogue entries; existing rows (the shop created while testing R1) are migrated, never dropped.

## Tasks

- **T1** — Catalogue tables and seed: categories, payment methods, dial codes, with the seed's source documented. Specs: S1, S2, S4, S5. Route: delegated writer (backend unit). Commit: `20281e9`.
- **T2** — `shops` referencing catalogue entries, plus migration of existing rows. Specs: S1, S2, S5, D-D. Route: delegated writer (backend unit). Commit: `20281e9`.
- **T3** — Bre-B key capture and validation, client and server. Specs: S3. Route: delegated writer (backend unit). Commit: `20281e9`.
- **T4** — Mandatory WhatsApp with dial-code selector, +57 default. Specs: S4. Route: delegated writer (backend unit). Commit: `20281e9`.
- **T5** — Redesign of the screen in the chosen direction (`design/config-tienda/02-stepped-wizard.html`, three steps with progress), shadcn only. Specs: S6, S1–S4. Route: delegated writer (bounded UI unit) after the backend contract landed. Commit: `d3e33dc`.
- **T6** — Tests for catalogue validation, mandatory fields, Bre-B key and the screen. Specs: all. Route: delegated writer for both halves, plus one fix round of mine (`37264f7`). Commit: `20281e9`, `d3e33dc`, `37264f7`.
- **T7** — Verification, Windows sync and delivery. Route: independent verifier if the risk line names a high-risk item. Commit: pending.

## Log

- **L1** — "cuando incio sesion en la app pasa a esta pantalla [Image#1] creo que esto era de pruebas y quedo ahi, cuando hago click en open app pasa a la pantalla de "Configurá tu tienda" pero no me gusta nada por favor hagamos un rediseño de la UI de esta pantalla. las categorias deben poderse elegir y no ser escritas por el usuario aqui investiga tipos de categorias maneja tiktok para sus tiendas/cuentas, para los medios de pago como la app va ser inicialmente lanzada en Colombia debe ofrecer los medios de pago mas comunes y faciles de usar Llaves BreB, Billeteras digitales o cuentas de ahorro, Para el WhatsApp de contacto que no es opcional usa un selector con el identificador de pais en por defecto el +57 de Colombia"
- **L2** — "1. ok, 2. omite contraentrega y tarjeta o link pago, 3. Solicitar la Llave, 4. agrega todos los indicativos de los paises eso ya es facil ahora. Para que estas configuraciones no queden quemadas en el codigo agregalas al esquema de la base de datos"
- **L3** — Research outcome (issue #30, 2026-11-25): TikTok publishes no category list and has no Colombia tree; TikTok Shop in Colombia is unconfirmed; Bre-B has operated since 2026-10-06 with 36M users and 116M keys; Nequi has 29.3M users and Daviplata ~20M; PSE is 63.9% of online checkout. The approved list omits contraentrega and card, per L2.
- **L4** — Scope decision: the H1 access landing seen before the app is a real delivered screen, not test scaffolding, and it stays out of this scope until the human asks for it.
- **L5** — Design directions written to `design/config-tienda/` (three structural options) and opened on the canvas; implementation waits for the human's choice.
- **L6** — Human chose artboard `02-stepped-wizard.html` (three steps with progress) and its implement handoff was reported to the canvas as in progress. Branch `feat/config-wizard-redesign` cut from `https-origin/main` (`8d7f69c`).

## Verification

Three commits: `20281e9` (backend, 1,048 lines), `d3e33dc` (UI, 1,111 lines), `37264f7` (fix round). Total ~2,167 authored lines across 16 files, of which ~1,203 are production.

Observed RED, both halves, before implementing:
- Backend: `bun run test convex/` → exit 1, 4 files failed / 38 tests failed / 13 passed, on `Could not find module for: "catalog"` and the missing `migrations` module. Module-resolution RED.
- UI: `bun run test src/shop-wizard.test.tsx src/app-entry.test.tsx` → exit 1, 18 failed / 2 passed, first failure `Unable to find an accessible element with the role "button" and name "Continuar"`. Behaviour-level RED.

Independent verification (`gentle-ai-verify`, risk items 1 and 2) ran the full suite, both typechecks, the build and `diff --check` in a scratch copy, and probed the claims itself:

| Check | Result |
| --- | --- |
| Full suite | exit 0, 28 files, 481 tests |
| `bun run typecheck` | exit 0 |
| `tsc -p convex/tsconfig.json` | exit 0 |
| `bun run build` | exit 0, only the pre-existing >500 kB advisory |
| `git diff --check` | exit 0 |

Claim verdicts: **A** nothing hard-coded (the screen renders rows the database holds; an invented row appears without a code change) · **B** seed provenance recorded, 10 categories and 4 payment methods in the approved order, 244 dial codes all `+`-prefixed with the six spot checks present · **C** server authority proven with its own probes (unknown slug rejected, Bre-B required only with its method, seven rejected submissions left the row byte-identical) · **D** ownership still identity-derived · **E** migration maps only documented values, counts the rest, preserves platform fields, is re-run safe, and strips a nation-prefixed `+57` without losing digits · **F** the 14 validation codes in the UI and the backend are the same set, and the payload matches the mutation args · **G** no authentication, CSP, protocol, packaging or dependency surface moved.

Its one change-caused defect — the summary printing payment slugs — is fixed in `37264f7` with a regression case, together with the uncounted dropped WhatsApp and two missing final newlines.

## Follow-ups, deliberately outside this scope

- `_generated/api.d.ts` still lacks `catalog` and `migrations`; it regenerates with the next `convex dev` run.
- `validWhatsapp` scans `dialCodes` with a filter instead of an index (`dialCodes` has no `by_dial`). Fine at 244 rows; an index belongs with the first catalogue that grows.
- The form carries a literal `+57` default. It is a default, not a catalogue: with a seed that lacks `+57` the form blocks and says so.
- Four dial codes are concatenations of legitimate ranges (`+441481`, `+441624`, `+441534`, `+35818`) and read as long codes; the selector still labels them correctly.
- The catalogue queries are unauthenticated public reads. They expose no tenant data, and they are the reason the screen cannot be hard-coded.

## Risk

`Risk: item 1` and `Risk: item 2`. Item 1: the migration rewrites stored rows and deletes values it cannot map, so a mistake is hard to undo; it is bounded by explicit mapping, per-value counting and a re-run-safe shape. Item 2: the multi-tenant authorization surface changed shape, and the catalogues now gate what may be written. Both were independently verified.
