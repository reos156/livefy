# Live view: TikTok surface and 3-column shell

Issue: reos156/livefy#39 · Branch: `feat/live-view` · Base: `https-origin/main` @ `53dd449`

## Specs

S1 — La vista `/app/live` es alcanzable desde el sidebar del panel y queda marcada como activa.

S2 — La columna 1 muestra TikTok en la partición `persist:tiktok`; el login manual persiste al cerrar y reabrir la app; el video y el audio se reproducen.

S3 — La superficie corre con `sandbox: true`, `contextIsolation: true`, `nodeIntegration: false`, sin preload privilegiado, y `webviewTag: false` sigue igual, con `will-attach-webview` bloqueado.

S4 — La navegación fuera de `tiktok.com` y sus CDN se bloquea, `window.open` se deniega, las descargas se bloquean y los permisos no justificados se deniegan; cada permiso permitido queda nombrado y justificado.

S5 — `apps/desktop/electron/csp-policy.cjs` no cambia: ni `frame-src` ni `connect-src` admiten el origen de TikTok.

S6 — Las columnas 2 y 3 declaran el estado vacío real, sin ceros ni métricas inventadas.

S7 — `bun run typecheck`, `bun run build` y `bun run test` en verde desde la raíz, incluyendo los tests nuevos.

S8 — El espejo de Windows queda sincronizado y el humano ejercita y acepta la pantalla.

S9 — No se relajan CSP, `sandbox`, `contextIsolation`, navegación ni permisos; el renderer de producto no importa Electron ni Node.

S10 — No se integra el contenedor `prototypes/tiktok-live-browser` (Docker + noVNC); no hay tablas `lives` ni `leads`, ni lectura de eventos, ni WhatsApp, ni ingestor.

## Tasks

| ID | Task | Specs | Route | Commit |
|---|---|---|---|---|
| T1 | Design directions for the live view shell | S1, S6 | dropped — the 3-column shell already exists in `panel.tsx` | — |
| T2 | TikTok surface in main: `WebContentsView` on `persist:tiktok` + hardening policy | S2, S3, S4, S5, S9 | inline | af932f8 |
| T3 | IPC allowlist: mount, unmount, bounds, state — with argument validation | S1, S3 | inline | af932f8 |
| T4 | Live surface mounted in the first column of the panel, honest empty states | S1, S6 | inline | b51921f |
| T5 | Tests: surface hardening policy and guest wiring | S3, S4, S5, S7 | inline | af932f8 |
| T6 | Tests: first column with and without the native surface | S6, S7 | inline | b51921f |
| T7 | Docs: acceptance matrix and partition persistence note | S7 | inline | b51921f |
| T8 | Checks, Windows mirror sync, human acceptance | S7, S8 | inline | — (pending) |

## Log

L1 (user): "Decime por cuál arrancamos y lo primero que hago es el issue, para que lo aprobues antes de que escriba una"

L2 (user): "usa el prototipo de tiktok que ya esta probado y funcional, seria adaptarlo a la app"

L3 (user): "el prototipo al que me referia era a este \proyectos\livefy\code\worktrees\mvp\prototypes\electron-spike"

L4 (user): "aceptado el issue #39, implementalo"

L5 (decision, agent): the spike's `<webview partition="persist:tiktok">` is not transferable as markup: the app freezes `webPreferences` with `webviewTag: false` and cancels `will-attach-webview`, and the scope forbids relaxing sandbox/CSP/navigation. The surface becomes a `WebContentsView` owned by the main process; the spike contributes what it proved (TikTok loads and manual login persists in Electron's Chromium), not its markup.
## Delivery notes

**Deviation — no `/app/live` route.** S1 named a route and a sidebar entry, written before
the code was read. The panel (`src/panel.tsx`) already *is* the three-column live workspace:
`LiveColumn`, `ProductsColumn` and `LeadsColumn` with the visual contract from the README.
Adding a second route that renders the same screen would duplicate it, so the surface opens
in the existing first column and the sidebar's `Panel` entry stays current. A separate route
becomes meaningful only when the live workspace stops being the panel body.

**Deviation — no design directions.** T1 was planned because the issue assumed a new screen.
The screen exists with an accepted visual contract (`.dark`, semantic tokens, installed
primitives), and the change fills a rectangle without restyling anything. Running the design
round would have proposed a second look nobody asked for. Reversible: if the operator wants
a different live layout, it is a new issue with its own directions.

**Slice boundary.** Two commits, `af932f8` (main-process boundary, IPC, hardening, its tests,
feature document — 438 authored lines) and `b51921f` (renderer hook, panel, panel tests,
README — 240 authored lines). The boundary commit is the high-risk one and can be reviewed
alone.

**Known limits, recorded rather than hidden.** Third-party OAuth (Google/Apple) navigates off
`tiktok.com` and is therefore blocked by the navigation allowlist; manual login has to use
phone or email. The surface carries no event ingestion, so columns 2 and 3 stay empty.
Nothing here has been exercised in the packaged Windows app yet.
