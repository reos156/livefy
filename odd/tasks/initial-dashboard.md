# R2 — Initial dashboard

Requirement R2 of the MVP scope: the screen the operator lands on after configuring the shop, replacing the R1.1 summary placeholder (decision D-F of `config-wizard-redesign.md`).

Issue: #33 (scope approved by the human, 2026-11-25). Branch: `feat/initial-dashboard`. Design: `design/dashboard-inicial/`.

## Specs

Quoted verbatim from `docs/livefy-scope-mvp_20260928.md`.

- **S1** — R2: "MUST mostrar lives activos, leads nuevos, pendientes, conversión y ventas estimadas." (`:198`)
- **S2** — R2: "MUST mostrar estado vacío y CTA si no hay datos." (`:199`)
- **S3** — R2: "MUST obtener `shopId` desde identidad autorizada, nunca confiar en un identificador arbitrario del cliente." (`:200`)
- **S4** — D4: without data the metrics are zero and the screen offers the CTA; with data, metrics and the operator's lives; the cards are reactive. (`:481`)

## Decisions taken in this round

- **D-A — The CTA is visible but disabled, with a note.** Human's answer to issue #33: live capture does not exist yet, so the button cannot lead anywhere honest. It stays inert until the live scope lands.
- **D-B — This scope delivers the dashboard in its empty form only.** Human's answer: no `lives` or `leads` model now. Those states belong to R3 (live view) and R4 (lead state machine), and defining them here would mean deciding another requirement's contract before its own scope.
- **D-C — Editing the shop stays reachable from the dashboard**, because the summary that carried it disappears.
- **D-D — The five metrics are defined now, even at zero**, so the screen and `getDashboardStats` do not change shape when the data arrives.

## Tasks

- **T1** — `getDashboardStats` in Convex: shop derived from the identity, the five metrics and an empty lives list, no client-supplied identifiers. Specs: S1, S3, S4. Route: pending.
- **T2** — The dashboard screen in the direction the human chooses, official primitives and tokens only. Specs: S1, S2, D-A, D-D. Route: pending.
- **T3** — Editing the shop and signing out stay reachable; the summary is retired. Specs: D-C. Route: pending.
- **T4** — Tests: authz, zeroed metrics, empty state with the disabled CTA, the shop edit path. Specs: S1–S4. Route: pending.
- **T5** — Verification, Windows sync, deploy and delivery. Specs: all. Route: pending.

## Log

- **L1** — Issue #33 opened with the scope, and the limit stated honestly: the metrics' sources (`lives`, `leads`, `orders`) do not exist yet.
- **L2** — Human's answers: CTA "Deshabilitado con nota"; scope "Sólo dashboard vacío (recomendado)" after asking whether including lives and leads would invent data — it would not invent rows, but it would decide R4's state machine early.
- **L3** — Design directions written to `design/dashboard-inicial/` and opened on the canvas; implementation waits for the human's choice.