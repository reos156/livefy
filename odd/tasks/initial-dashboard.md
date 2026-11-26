# R2 — Initial dashboard

Requirement R2 of the MVP scope: the screen the operator lands on after configuring the shop, replacing the R1.1 summary placeholder (decision D-F of `config-wizard-redesign.md`).

Issue: #33 (scope approved by the human, 2026-11-25). Branch: `feat/initial-dashboard`. Design: `design/dashboard-inicial/`.

## Specs

Quoted verbatim from `docs/livefy-scope-mvp_20260928.md`.

- **S1** — R2: "MUST mostrar lives activos, leads nuevos, pendientes, conversión y ventas estimadas." (`:198`)
- **S2** — R2: "MUST mostrar estado vacío y CTA si no hay datos." (`:199`)
- **S3** — R2: "MUST obtener `shopId` desde identidad autorizada, nunca confiar en un identificador arbitrario del cliente." (`:200`)
- **S4** — D4: without data the metrics are zero and the screen offers the CTA; with data, metrics and the operator's lives; the cards are reactive. (`:481`)

## Spec correction: the panel is three columns

The scope defines the operator's panel as a **three-column workspace**, and R2's dashboard is that same
surface in its empty state, not a metrics page:

- **S5** — Goals: "Provveer un panel de control de escritorio en Electron con una interfaz de 3 columnas:
  Columna 1 (Live de TikTok con navegador embebido), Columna 2 (Gestión de productos y drag & drop) y
  Columna 3 (Leads y estados en tiempo real)." (documented at `:105`)
- **S6** — R3 column 1: the isolated TikTok surface, the manual login that does not authenticate the
  ingestor, and the local ingestor health with its gap warning (`:205`–`:211`).
- **S7** — R3 column 2: available products and the active product, drag & drop, create, persisted in Convex (`:213`–`:217`).
- **S8** — R3 column 3: handle, WhatsApp, state, items, total and last activity per lead; receipt with
  validate/reject; close cart or confirm order (`:219`–`:232`).
- **S9** — Success criterion 3: the panel distinguishes `connected`, `reconnecting`, `offline`,
  `suspended-risk`, `disconnected` and `ended` (`:186`).
- **S10** — Two apps on one shared frontend: `app/desktop` (Electron, with the isolated viewer) and
  `app/web` (no viewer). The frontend boundary requires one implementation of screens, routes and state,
  and the web variant offers "productos y eventos en navegador responsive, sin visor de video" (`:11`).
- **S11** — "Finalizar live" is an explicit business action that ends the commercial live; closing the app
  stops only the local runner and revokes its producer session (`:38`, D11).
- **S12** — D2 routes a signed-in operator with a shop straight to the dashboard, and D3 keeps the wizard
  for an identity without one (`:444`–`:456`).

An earlier reading of this document stopped at R3's first column and designed a metrics page with a generic
empty state. That was wrong and the human corrected it, so the directions were rebuilt as the three-column
panel with each column in its empty state: no live connected, no products, no leads.

## Decisions taken in this round

- **D-A — The CTA is visible but disabled, with a note.** Human's answer to issue #33: live capture does not exist yet, so the button cannot lead anywhere honest. It stays inert until the live scope lands.
- **D-B — This scope delivers the dashboard in its empty form only.** Human's answer: no `lives` or `leads` model now. Those states belong to R3 (live view) and R4 (lead state machine), and defining them here would mean deciding another requirement's contract before its own scope.
- **D-C — Editing the shop stays reachable from the dashboard**, because the summary that carried it disappears.
- **D-D — The five metrics are defined now, even at zero**, so the screen and `getDashboardStats` do not change shape when the data arrives.

## Tasks

- **T1** — `getDashboardStats` in Convex: shop derived from the identity, the five metrics, the live connection state and an empty lives list, no client-supplied identifiers. Specs: S1, S3, S4, S9. Route: delegated writer.
- **T2** — The panel in the chosen direction (`design/dashboard-inicial/01-three-columns-one-window.html`): sidebar, top bar, KPI cards and the three columns. Specs: S1, S2, S5–S9, D-A, D-D. Route: delegated writer.
- **T3** — Editing the shop and signing out stay reachable; the summary is retired. Specs: D-C. Route: pending.
- **T4** — Tests: authz, zeroed metrics, empty state with the disabled CTA, the shop edit path. Specs: S1–S4. Route: pending.
- **T5** — Verification, Windows sync, deploy and delivery. Specs: all. Route: pending.

## Log

- **L1** — Issue #33 opened with the scope, and the limit stated honestly: the metrics' sources (`lives`, `leads`, `orders`) do not exist yet.
- **L2** — Human's answers: CTA "Deshabilitado con nota"; scope "Sólo dashboard vacío (recomendado)" after asking whether including lives and leads would invent data — it would not invent rows, but it would decide R4's state machine early.
- **L3** — Design directions written to `design/dashboard-inicial/` and opened on the canvas; implementation waits for the human's choice.
- **L4** — Human's correction, verbatim: "creo que no revisaste muy bien la seccion 2. Spec (contrato verificable propuesto) del @docs/livefy-scope-mvp_20260928.md por que claramente dice que el dashboard va dividido en 3 columnas, etc..., no se de donde sacas que lo unico que nos interesa es leads, conversion, ventas". Accepted: the first six artboards are superseded; the panel is the three-column workspace of R3, shown empty.
- **L5** — The full document was read end to end after the human asked for it, and the previous nine artboards were deleted and redesigned. Three corrections landed: there are two apps (`app/desktop` with the viewer and `app/web` without) over one shared frontend; the post-login routing and the paste-the-URL connect flow were dropped from the design by the human's instruction; and "Finalizar live" stays as an explicit business action in the panel. The new directions differ only in how the viewer coexists with the shared core, because that is the real boundary the document draws.
- **L6** — Human chose artboard `01-three-columns-one-window.html` and its handoff was reported in progress. Branch `feat/initial-dashboard`.
- **L7** — The first deploy attempt of `getDashboardStats` failed schema validation, and the cause is ordering, not the panel: DEV already runs the new `shops` shape from PR #35, while this branch is cut from `main`, which still declares the previous shape. Pushing the older schema over the existing shop document is rejected because that document carries `categorySlugs`/`paymentData` and no longer has `categories`. The panel therefore cannot be deployed or manually tested until #35 merges and this branch is rebased onto it. Recorded rather than retried.
