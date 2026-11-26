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
| T1 | Design directions for the live view shell, canvas, human pick | S1, S6 | inline + gentle-design | — |
| T2 | TikTok surface in main: `WebContentsView` on `persist:tiktok` + hardening policy | S2, S3, S4, S5, S9 | inline | — |
| T3 | IPC allowlist: mount, unmount, bounds, state — with argument validation | S1, S3 | inline | — |
| T4 | `/app/live` route, 3-column shell, honest empty states | S1, S6 | inline | — |
| T5 | Tests: surface hardening policy and guest wiring | S3, S4, S5, S7 | inline | — |
| T6 | Tests: shell rendering and empty states | S6, S7 | inline | — |
| T7 | Docs: acceptance matrix row and partition persistence note | S7 | inline | — |
| T8 | Checks, Windows mirror sync, human acceptance | S7, S8 | inline | — |

## Log

L1 (user): "Decime por cuál arrancamos y lo primero que hago es el issue, para que lo aprobues antes de que escriba una"

L2 (user): "usa el prototipo de tiktok que ya esta probado y funcional, seria adaptarlo a la app"

L3 (user): "el prototipo al que me referia era a este \proyectos\livefy\code\worktrees\mvp\prototypes\electron-spike"

L4 (user): "aceptado el issue #39, implementalo"

L5 (decision, agent): the spike's `<webview partition="persist:tiktok">` is not transferable as markup: the app freezes `webPreferences` with `webviewTag: false` and cancels `will-attach-webview`, and the scope forbids relaxing sandbox/CSP/navigation. The surface becomes a `WebContentsView` owned by the main process; the spike contributes what it proved (TikTok loads and manual login persists in Electron's Chromium), not its markup.