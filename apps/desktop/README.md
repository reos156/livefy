# Base de escritorio de Livefy

## Autoridad actual — autenticación DEV aceptada

El usuario aceptó los flujos reportados de autenticación Google en web y Electron,
incluido el retorno del navegador a Electron. Google es el único proveedor social
MVP: el usuario deshabilitó Facebook/TikTok en Clerk y confirmó que desaparecieron
sus botones. No se ejecutaron cambios remotos en este cierre documental.
Verificación independiente completa: 178/178 tests focalizados, 300/300 completos,
typecheck y build aprobados; permanecen 27 advertencias use-client y un chunk
sobredimensionado. Revisión nativa desactivada; assessment no evaluable por archivos
untracked ambientales, cubierto por verificación independiente, no por aprobación
de revisión. Alcance DEV aceptado, sin certificación de producción.

No se observaron individualmente modo empaquetado, reinicio/persistencia Electron,
revocación/logout tras reinicio, refresh/restauración web, Back y failure/retry,
descubrimiento/reset/verificación/resend/errores, challenge ni la matriz visual.
T3 está **diferido**, no aprobado: cierre DEV acotado sin evidencia separada;
gate: registrar callback/acceso, reinicio/persistencia y logout por modo Windows
antes de aceptar empaquetado o persistencia. Véanse [OAuth](../../odd/tasks/electron-google-oauth.md)
y [paridad web](../../odd/tasks/web-auth-parity.md). La matriz visual #14 no cambia.
Refs auth #8/#10/#12/#13 ya cerradas. Evidencia de commit: pendiente, el parent
registrará el commit local autorizado; sin push/PR/merge.

Esta autoridad reemplaza notas históricas de Google/browser pendientes. Los
límites y observaciones históricas de agentes se conservan con atribución.

## Integración local — Clerk

Clerk gestiona registro e inicio de sesión (H1.3/H1.4) mediante `SignIn`
embebido, `routing="hash"` y `withSignUp`, tanto en desarrollo como en builds
no DEV. El descubrimiento unificado de cuentas pertenece al proveedor; no hay
launcher, modal, SignUp separado ni formularios propios. Appearance local usa
variables compatibles con React 6.17.6, tokens Livefy y Geist ya incluido.
Clerk decide solo cuándo mostrar el formulario: una sesión Clerk sin confirmación
Convex muestra espera, nunca entrada privada. Carga/refresh de Convex conserva
prioridad. Persistencia se consulta al API nativo y se presenta solo con acceso
confirmado; no se infiere cifrado cuando la consulta falta o falla.

Fuentes oficiales verificadas por el parent el 2026-10-11:
https://clerk.com/docs/electron/reference/components/authentication/sign-in ;
https://clerk.com/docs/electron/guides/customizing-clerk/appearance-prop/overview .
Los tests prueban montaje/props del wrapper instalado, no comportamiento del CDN.
En Windows quedan pendientes descubrimiento login/registro, volver, reset,
verificación/resend/errores, tema claro/oscuro, foco/reflow y CAPTCHA si aparece.
Los agentes no certificaron estos casos individuales. La aceptación humana DEV
actual incluye los flujos reportados web/Electron y Google; no certifica producción,
persistencia/reinicio ni protocolo empaquetado.

Convex conserva
`auth.config.ts`, la autorización de `requireUser`/`session:current` basada en la
identidad JWT de Clerk y un router HTTP vacío. El esquema de aplicación no declara
tablas; se retiraron las dependencias, tablas, validación y scripts locales de
Convex Auth. Esto no demuestra eliminación de datos ni cambios de firma remotos.
La instalación raíz `bun install --ignore-scripts` y el codegen fijado a DEV con
`--typecheck disable` finalizaron correctamente (salida 0), reconciliando el
lockfile y los enlaces generados. La verificación independiente completa tras las
correcciones locales sigue pendiente. Codegen puede preparar esquemas/índices
pendientes; no se realizó un despliegue final remoto ni se ejecutó `convex dev`
o `convex deploy`, eliminación de registros o cambios de variables de firma.

Versiones sin cambios: Clerk Electron 0.0.51, Electron 41.10.7 y Convex 1.46.0.
El proveedor actual es `ClerkProvider` → `ConvexProviderWithClerk(useAuth)` con
cliente único. Solo `useConvexAuth` confirma acceso; no se usa el registro
legacy de Convex Auth.

Configuración pública requerida al compilar (no son instrucciones de mutación):

- `VITE_CONVEX_URL=https://polite-parrot-887.convex.cloud`
- `VITE_CLERK_PUBLISHABLE_KEY=<clave pública DEV real del Dashboard>`

No se incluye ni se fabrica una clave. Se valida localmente el host codificado
`organic-snake-7233.clerk.accounts.dev`, no su validez remota. Configuración
faltante/incorrecta no crea proveedores ni cliente. Producción necesitará otra
configuración revisada; no basta con reemplazar estas variables.

Compilar desde `apps/desktop` con `bun run build` genera, además del
renderizador, los dos procesos empaquetados por Vite/Rollup: `dist/preload.cjs`
(precarga, solo Electron externo, compatible con sandbox) y `dist/main.cjs`
(proceso principal, ver «Proceso principal empaquetado» más abajo). `package.json`
apunta su entrada `main` a ese `dist/main.cjs`, y `desktop:dev`/`start` reconstruyen
precarga y proceso principal antes de lanzar Electron, así que nunca se ejecuta
código viejo salvo que se edite `electron/*.cjs` con la aplicación ya abierta:
reiniciar `desktop:dev` es lo que recompila.
El origen empaquetado es `livefy://renderer`; el esquema se registra antes de
readiness y sirve solo archivos contenidos en dist, incluyendo comprobación de
rutas reales. Desarrollo usa `http://127.0.0.1:5173`.

### OAuth bootstrap repair — Clerk Electron 0.0.51

The main process creates `createClerkBridge` before readiness with
`renderer: { scheme: 'livefy', host: 'renderer' }` and deferred TokenStorage.
Clerk owns privileged scheme registration, OAuth IPC and single-instance callback
transport; secondary instances skip ready-time initialization and window creation.
The encrypted-storage adapter still initializes after readiness, before windows
open. Deferred token calls delegate to that adapter and reject before initialization.
Development still loads `http://127.0.0.1:5173/`; the OAuth callback remains
`livefy://renderer/` in both modes. No passkeys are enabled.

For default Electron launches (`electron .`), the primary instance overrides the
SDK's executable-only protocol registration after bridge creation with
`process.execPath` and the absolute desktop application directory derived from
`__dirname`, never callback-containing launch arguments. Paths are passed as raw
API arguments, without manual quoting; `--livefy-dev` is retained only for a
current development launch. Packaged non-default launches keep SDK registration.
Registration failure emits a fixed diagnostic without callback or launch data.
Restart Electron after this change before retrying Google sign-in/sign-up.
The effective Windows registry command has not been inspected, and mocked
registration tests do not prove that Windows launches the correct app or completes
the real browser callback. The user subsequently accepted the DEV Google return flow; packaged registration
and independently inspected Windows registry evidence remain unobserved.

The SDK checks window main frames, not exact IPC origins. Existing restricted
navigation, denied popups and local protocol containment remain unchanged. The
fixed Clerk preload API permits the SDK's external-browser OAuth transport, not
generic IPC. Cleanup removes OAuth/token handlers and callback listeners and
releases the SDK-owned single-instance lock; logout durability remains unchanged.

Deterministic tests execute the installed CJS SDK with mocked Electron and browser
transport, including callbacks and cleanup; they do not prove Google provider
completion or real OS protocol registration. The user subsequently accepted Google sign-in/sign-up and Electron browser return.
Individual restart/persistence/logout and packaged-mode checks are deferred under T3,
not passed. During the repair, the agents performed no real login or remote mutation.
No fetch tool was available to consult
https://clerk.com/docs/electron/getting-started/quickstart during this repair;
API details were checked against installed 0.0.51 README, types and CJS source.

Tokens: electron-store contiene únicamente envelopes versionados cifrados mediante
safeStorage. Registros raw/desconocidos/corruptos se rechazan sin sobrescribir ni
borrar, incluso al cerrar sesión. Sin cifrado disponible, tokens solo en memoria;
la interfaz indica explícitamente que no sobrevivirán reinicio. No se registran
credenciales. Persistencia real/revocación en Windows siguen pendientes (H1.6).

La CSP permite FAPI DEV exacto, Cloudflare challenges, img.clerk.com y telemetry.
Solo `*.protect.clerk.com` tiene la excepción aprobada de comodín (connect `:*`).
Sin `unsafe-eval`, script inline, ni websocket de desarrollo en producción.
La compatibilidad real del UI/challenges debe verificarse en Windows antes de
aceptar flujos; build/mocks no demuestran autenticación ni empaquetado.

Los orígenes autorizados de Clerk DEV se inicializaron, con autorización explícita,
desde `null` a `[http://127.0.0.1:5173, livefy://renderer]`, según el registro del
worker. La verificación independiente confirmó el estado actual exacto y Native
API habilitada; no reconstruyó la transición histórica ni el número de PATCH.
OAuth IPC and single-instance/deep-link transport are now configured locally as
specified above; the user accepted DEV Google browser return. Packaged callback
and individual persistence evidence remain deferred, not inferred.
Producción/FREE Native API y publicación pertenecen a H1.12.

H1.2d fue aceptado para DEV: la captura de Windows muestra la interfaz y capacidad
de almacenamiento cifrado, no inicio de sesión ni token persistido tras reiniciar.
La entrega local en `feat/mvp` quedó registrada en seis commits: `9839db8`
(pins), `456516f` (diseño de identidad), `f8fd5e5` (confianza del backend),
`3a022e6` (verificador DEV), `d0954ff` (bridge nativo) y `8823782` (proveedores).
El árbol final coincide exactamente con el snapshot verificado independientemente
`c33a1840e7b9c5988ea0f2d6063f727dc4b40859`.

En la raíz aislada, la instalación congelada pasó (528 paquetes); los tests de
escritorio pasaron: 78/78 en 12 archivos. También pasaron typecheck de escritorio,
tsc del backend, build sin variables de entorno, sintaxis Node y diff-check.
Solo se ejecutó el snapshot final combinado: no se certifican funcionalmente los
commits intermedios por separado. Los 22 tests legacy H1.3 (6 de registro UI y
16 de validación) quedaron excluidos. Se observaron advertencias no bloqueantes
`use client` y chunk mayor de 500 kB, sin deriva generada ni secretos detectados.

El parent completó la limpieza: los 30 paths temporales sucios no ignorados
coincidieron byte a byte con el snapshot inmutable `8823782` antes de retirar el
worktree propio `verify-h12`, incluidos sus outputs ignorados de instalación/build.
La lista de worktrees contiene solo primary y mvp. Una aserción inicial falló antes
de mutar por aplicar trim a porcelain; el parser delimitado por NUL lo corrigió,
sin pérdida de estado. No se autorizó ni realizó push; esta edición solo cierra
documentación, sin staging, commits ni cambios de worktree.

Fuentes oficiales aportadas por el parent, acceso 2026-10-06 (no recuperadas aquí):
https://clerk.com/docs/electron/getting-started/quickstart ;
https://clerk.com/docs/guides/development/deployment/electron ;
https://clerk.com/docs/guides/secure/best-practices/csp-headers ;
https://docs.convex.dev/auth/clerk . README/tipos de la SDK instalada inspeccionados.

## Contrato visual compartido y aceptación de pantallas

Las pantallas actuales comparten presentación; sus estados y acciones siguen
siendo responsabilidad de cada pantalla. Para tareas futuras, reutilizar este
contrato y definir la aceptación visual antes de implementar, sin duplicar UI
para escritorio/web ni modificar autenticación por motivos de estilo.

### Fuentes de verdad

| Aspecto | Contrato existente |
| --- | --- |
| Tema | [styles.css](src/styles.css): tokens semánticos de fondo/texto, card, primary, muted, destructive, border/input y ring, además de radios y sombras. Usar estos roles, no colores aislados por pantalla. |
| Claro/oscuro | `:root` define claro; la clase `.dark` y la variante `dark` activan oscuro. No hay selector persistente ni seguimiento automático del sistema. |
| Tipografía | Geist Variable se importa como recurso local y se aplica en `html`. Asta Sans y JetBrains Mono están declaradas en los tokens del tema, pero no se cargan sus assets; una declaración no prueba uso efectivo de esas fuentes. No añadir solicitudes remotas. |
| Estructura | [visual-shell.tsx](src/components/visual-shell.tsx): landmark `main`, marca decorativa `L` con `aria-hidden`, título `h1` dentro de CardTitle y contenido en CardContent/`.visual-content`. Conservar jerarquía de encabezados y semántica al componer una pantalla. |
| Primitivas | Reutilizar los componentes oficiales shadcn Base UI / base-nova instalados en [ui](src/components/ui): Card, Button, Field/Input/Label, Alert y Separator; no recrear controles o paneles paralelos. |
| Estados y foco | Los estados dentro del shell usan Alert con `role="status"` (anuncio polite); los errores, Alert destructivo con `role="alert"`. Conservar etiquetas, estados deshabilitados y foco de las primitivas. CSS añade `:focus-visible` a enlaces ordinarios sin `data-slot`; no sustituirlo por un foco global que compita con los controles. |

### Geometría existente, no certificación de reflow

- `body` tiene `min-width: 20rem`: equivale a 320 CSS px **solo con raíz de
  16px por defecto**. Cambiar el tamaño raíz puede aumentar ese mínimo; no
  garantiza ausencia de desbordamiento a 320px.
- `.visual-shell` usa flex centrado, `min-height: 100svh` y padding
  `clamp(1rem, 4vw, 3rem)`. La card usa ancho completo, máximo `30rem` y
  `wrap-anywhere`; el contenido se organiza en columna con separación `1.25rem`.
- 320, 375 y 1000 CSS px son **muestras propuestas para aceptación**, no
  breakpoints implementados ni viewports ya certificados. El ancho exterior de
  Electron no es necesariamente el ancho CSS disponible en el renderizador.
  La altura, zoom, escala de Windows y tamaño raíz también afectan el resultado.

### Checklist manual — Windows y DevTools

Registrar resultados por combinación de pantalla/estado, tema y viewport; no
marcar toda la matriz aceptada a partir de una captura aislada.

1. Abrir la aplicación Windows del modo que se está evaluando (desarrollo o
   empaquetado) y anotar versión/commit, modo, escala de Windows y zoom.
   En DevTools registrar el **ancho y la altura reales del renderizador** en
   CSS px, por ejemplo `window.innerWidth` y `window.innerHeight`, junto con
   `getComputedStyle(document.documentElement).fontSize`. Repetir la medición
   tras redimensionar o acoplar DevTools; no usar solo el tamaño de la ventana.
2. Probar las muestras propuestas de ancho 320/375/1000 si el entorno permite
   alcanzarlas y anotar la altura real en cada caso, incluyendo una altura
   reducida. Si se usa emulación de DevTools, identificarla como tal: no equivale
   a una ventana Electron nativa de esas dimensiones. Registrar lo no alcanzado
   como pendiente o diferido, nunca como aprobado.
3. Repetir en claro y oscuro. Para inspeccionar oscuro puede añadirse
   temporalmente `dark` al elemento `html` desde DevTools y retirarse después;
   es una técnica de prueba, no una preferencia guardada ni un selector del
   producto. Comprobar legibilidad de texto, campos, errores y foco en ambos.
4. Recorrer los estados relevantes disponibles: acceso sin sesión, login,
   registro/confirmación de código, solicitudes pendientes, acceso privado,
   carga/rechazo de acceso y logout pendiente/finalizado/fallido. Especificar
   cuáles pertenecen a la tarea y cómo se alcanzaron; no provocar mutaciones
   remotas o crear cuentas sin autorización independiente.
5. Revisar desbordamiento horizontal, texto largo/errores largos, recortes de
   card/campos/acciones y acceso vertical: todo contenido y acción debe poder
   alcanzarse mediante scroll cuando no cabe en altura. `scrollWidth` frente a
   `clientWidth` puede ayudar, pero no sustituye la inspección de recortes.
6. Recorrer con Tab/Shift+Tab y activar los controles por teclado: orden lógico,
   foco visible, acciones alcanzables y exclusión durante estados pendientes.
   Comprobar que el mensaje de error sigue siendo legible sin depender del color.
7. Si el proveedor **presenta realmente CAPTCHA**, inspeccionar su ajuste,
   visibilidad, interacción y acceso por teclado/scroll. Si no aparece, registrar
   «no presentado; challenge interactivo pendiente», no afirmar que se probó o
   que está deshabilitado. Clerk gestiona el challenge dentro de su UI oficial.

### Evidencia y requisito para tareas futuras

| Evidencia | Qué puede demostrar / qué no |
| --- | --- |
| Tests estructurales Vitest/jsdom | Composición, roles, encabezados, montaje y comportamiento con mocks; no layout, dimensiones, reflow ni ejecución real del challenge. |
| Layout en navegador/DevTools | Geometría, recortes, scroll y foco en el entorno/viewport registrado; no persistencia nativa, bridge ni sesión Electron Windows. |
| Ejecución Windows | Solo los recorridos nativos realmente observados, con su modo y evidencias; una captura visual no demuestra reinicio, revocación o seguridad del bridge. |

Toda tarea futura de pantalla debe incluir una matriz explícita de aceptación
visual: pantalla/estado, claro/oscuro, ancho **y altura** CSS reales, zoom/tamaño
raíz, entorno/método y resultado. Para cada caso registrar **aceptado, pendiente
o diferido**, referencia a captura/observación/comando y sus límites; los diferidos
necesitan motivo y gate/tarea de seguimiento. Separar resultados estructurales,
layout y bridge/sesión Windows, sin convertir uno en prueba de los otros.

La [evidencia de issue #14](../../odd/tasks/mvp-theme-issue-14.md) conserva las
aceptaciones humanas históricas de pantallas actuales y sus límites: no certifica
una matriz completa estrecha/ancha ni un challenge real. Esta guía no añade
aceptación actual, no reabre los casos aceptados y no acepta el futuro cliente
web; sus gates siguen siendo independientes en el [hito H1](../../odd/tasks/mvp-h1-access-windows.md).

## Superficie del live de TikTok

La columna 1 del panel abre TikTok en una superficie adaptable creada por el proceso
principal (`electron/live-surface.cjs`), nunca por el renderer. El renderer informa un
rectángulo, un canal y muestra el estado; no nombra una URL ni instancia un `<webview>`.

| Aspecto | Contrato |
| --- | --- |
| Propiedad | `WebContentsView` creado en `main`; la superficie es hermana del renderer, no hija de su DOM. |
| Canal | El renderer envía **sólo el handle** por `livefy:live-surface-mount`. `main` valida el patrón estricto (letras, dígitos, punto y guion bajo, 2–24 caracteres, al menos una letra o dígito), construye `https://www.tiktok.com/@<handle>/live` y lo comprueba contra la allowlist antes de cargar. Un handle inválido se rechaza con error y nunca se carga. |
| Sesión | Partición `persist:tiktok`: sobrevive a reinicios. Borrar el directorio de particiones de `userData` pierde el login guardado en este equipo. |
| Aislamiento | `sandbox: true`, `contextIsolation: true`, `nodeIntegration: false`, `webviewTag: false`, sin preload. |
| Navegación | Sólo `https://` en `tiktok.com` y sus subdominios; el resto se cancela. Un login que salga del dominio (por ejemplo OAuth de Google o Apple) queda bloqueado: usar teléfono o email. |
| Permisos | Ninguno concedido: pedidos y comprobaciones responden `false`. La reproducción de video y audio no los requiere. |
| Ventanas y descargas | `window.open` en deny y `will-download` cancelado en la sesión de la partición. |
| Estado | `idle`, `loading`, `ready` o `failed` con motivo; una carga fallida se muestra como error, no como rectángulo vacío. `ready` llega en `dom-ready` (y en `did-finish-load`, que es el mismo final); un fallo conserva su motivo. |
| Escala | El guest renderiza al 50 % (`LIVE_ZOOM` en `electron/live-surface.cjs`): el layout de escritorio de TikTok necesita ~1000 CSS px para mostrar su riel de comentarios y la columna da ~410 DIP. A 0,8 el riel seguía cortado. El costo es video y texto a mitad de tamaño: es una decisión del operador, no un ajuste automático. |

El reparto de las tres columnas es estado de sesión: dos separadores arrastrables y, por
teclado, flechas de 16 px y `Shift`+flecha de 48 px, con mínimos de 340 px (live) y 240 px
(productos). Los anchos no se persisten y, bajo el ancho del artboard (1100 CSS px), el
layout pasa a una columna y los separadores no se renderizan.

La superficie no incorpora eventos: chat, regalos y leads son R4/R6 y todavía no existen.
Las columnas 2 y 3 conservan su estado vacío real. La fila de cinco KPI dejó de pintarse
(el contrato `metrics` de la consulta de dashboard no cambió) y la leyenda de seis estados
salió de la columna: el estado de conexión se lee en el badge de la barra superior.

### Matriz de aceptación de la vista de live (pendiente)

Requiere ejecución en la app (DevTools de Electron, no el navegador) y la aceptación del
humano. Ningún caso está aceptado todavía.

| Pantalla/estado | Tema | Ancho × alto CSS | Entorno/método | Resultado |
| --- | --- | --- | --- | --- |
| Panel, visor sin abrir | claro / oscuro | registrar en DevTools | Electron dev | pendiente |
| Panel, canal vacío (botón «Abrir el live» deshabilitado, motivo en `aria-describedby`) | claro / oscuro | registrar en DevTools | Electron dev | pendiente |
| Panel, cargando | claro / oscuro | registrar en DevTools | Electron dev | pendiente |
| Panel, live abierto con login guardado | claro / oscuro | registrar en DevTools | Electron dev | pendiente |
| Panel, live abierto con el visor a todo el alto de la columna | claro / oscuro | registrar en DevTools | Electron dev | pendiente |
| Panel, carga fallida (sin red) | claro / oscuro | registrar en DevTools | Electron dev | pendiente |
| Panel, foco de teclado en un separador (flechas y `Shift`+flecha) | claro / oscuro | registrar en DevTools | Electron dev | pendiente |
| Panel, reparto arrastrado hasta el mínimo de la columna live (340 px) | claro / oscuro | registrar en DevTools | Electron dev | pendiente |
| Panel, layout de una columna bajo 1100 CSS px, sin separadores | claro / oscuro | registrar en DevTools | Electron dev | pendiente |
| Panel, barra lateral colapsada | claro / oscuro | registrar en DevTools | Electron dev | pendiente |

## Historial H1.1/H1.2 (no describe los proveedores actuales)

La base H1.1/H1.2 combina una ventana Electron aislada, una vista previa de acceso en React y un contrato de autenticación correo/contraseña y sesión activado en Convex DEV. La interfaz de registro/inicio de sesión, la recogida de credenciales en el renderizador y el empaquetado no están implementados. Los controles de acceso siguen deshabilitados; inicializar el proveedor no representa una autenticación correcta.

Consulta el [README principal](../../README.md) y el [registro del hito H1](../../odd/tasks/mvp-h1-access-windows.md).

## Browser parity — embedded authentication

From `apps/desktop`, run `npm run dev` and open
`http://127.0.0.1:5173/` in a browser; do not launch Electron for this preview.
The existing public DEV configuration above is still required. Missing or invalid
configuration does not construct authentication providers.

W1a selects `@clerk/react` 6.17.6 without the preload session bridge and retains
`@clerk/electron` 0.0.51 when the bridge is present. Shared routes, theme and
Convex-confirmed private access are unchanged. Browser logout immediately excludes
private consumers, supports failure/retry, and returns to public access after
signed-out confirmation without native IPC, quitting or relaunch instructions.
Browser storage is not described as native encrypted persistence.
The browser router stays mounted during sign-out so TanStack can acknowledge
Clerk's awaited public navigation; the root-route session gate unmounts all
routed consumers immediately and keeps them excluded on failure/retry. Navigation
and signed-out confirmation are both awaited before public consumers return.
The shared web/Electron access landing displays neutral `Loading…` during backend
loading and refresh instead of `Checking backend access`. Private-route loading
presentation remains unchanged; Convex confirmation still gates `Open app` and private UI.

Browser authentication mounts the installed `@clerk/react` SignIn with `withSignUp`,
Livefy appearance and hash routing. OAuth uses browser redirects, not native IPC
or `livefy:` callbacks. Both sign-in and sign-up force completion to the current
HTTP(S) document path with query removed and `#/`; only that exact completion
(or the literal `/#/` when equivalent) enters the public memory route. Clerk owns
intermediate auth-step hashes. Completion does not grant private access: Convex
must confirm the session before the existing main-screen entry action is enabled.
No service settings were changed. SDK 6.17.6 installed types/mount wrapper were
inspected; official online browser documentation was not fetched here.

Focused checks from `apps/desktop`:
```sh
npm run test -- src/access.test.tsx src/private-access.test.tsx src/routes.test.tsx src/lib/session.test.tsx src/platform/electron/auth.test.tsx src/platform/electron/auth-ui.test.tsx src/platform/auth.test.tsx src/platform/web
npm run typecheck
```

Human acceptance of reported web/Electron Google flows is complete. The following
matrix remains a checklist of individually unobserved cases, not a claim that all
browser authentication is pending or that every item passed (mocks do not certify CDN UI):
1. On the configured DEV origin, sign in with an existing authorized account,
   including Google; verify return to the public app, Convex confirmation, then
   enter the main screen with its existing action.
2. With separate authorization to create an account, repeat with a fresh account
   using embedded sign-up/Google and any required verification/challenge steps.
3. Reload the main screen: public access should restore the browser session,
   wait for Convex confirmation and offer entry again; do not expect native
   encrypted-storage guarantees.
4. Sign out; confirm private content disappears immediately and public access
   returns after confirmation. Check Back and refresh cannot expose private
   content, then sign in again without closing the tab. Check failure/retry when
   sign-out cannot finish.
5. Check auth-step Back/refresh, clear/dark appearance, keyboard focus and narrow
   viewport layout. Record actual provider/origin/callback errors; allowed origin
   or provider configuration changes require separate authorization.

## Ejecución local

El manifiesto fija Bun 1.2.15. Node 22.23.1 es la versión observada en el entorno de verificación histórica, no un requisito universal obligatorio.

Desde la raíz del repositorio:

```sh
bun install --frozen-lockfile
bun run typecheck
bun run test
bun run build
```

La compilación genera recursos locales, no un instalador. Después de compilar:

```sh
cd apps/desktop
bun run start
```

`bun run start` reconstruye `dist/preload.cjs` y `dist/main.cjs` antes de abrir
Electron.

En desarrollo, utiliza dos terminales en `apps/desktop`:

```sh
# Terminal 1
bun run dev
```

```sh
# Terminal 2
bun run desktop:dev
```

`dev` inicia solamente Vite; Electron se inicia con `desktop:dev`, que
reconstruye la precarga y el proceso principal antes de lanzar Electron contra el
servidor de desarrollo. Desde la raíz, `bun run dev` coordina la tarea Vite mediante Turborepo, sin iniciar Electron.

El renderizador utiliza la transformación JSX de Vite sin el preámbulo de Fast Refresh para restringir los scripts de la CSP a archivos locales. TanStack Router usa historial en memoria iniciado en `/`; el fragmento queda
reservado a Clerk. Navegar a `/app` no modifica el hash. El cambio aceptado por el
usuario hace que reload vuelva al acceso público **sin borrar la sesión**;
Convex debe volver a confirmar antes de ofrecer entrada. Producción carga mediante
`livefy://renderer`. La inicialización estándar de Shadcn seleccionó Base UI / base-nova; su componente Button está incluido en el repositorio.

## Empaquetado Windows (portable) — preparación H1.12

Alcance de esta configuración: producir y ejecutar en Windows un paquete **sin
instalador** (salida sin empaquetar `dir` y ejecutable único `portable`), para
poder validar el recorrido real de acceso desde una aplicación empaquetada.
Instalador, firma de código, MSIX/Store y actualización automática quedan
deliberadamente fuera: son una decisión de distribución separada y no están
configurados aquí. Nada de esta sección se ejecutó en el host Linux de autoría;
ver «Lo que no se verificó» al final.

El paquete es **autocontenido**: no lleva `node_modules`. El renderizador lo
empaqueta Vite y los procesos principal y de precarga se empaquetan en
`dist/main.cjs` y `dist/preload.cjs` (ver «Proceso principal empaquetado»), así
que en tiempo de ejecución solo se resuelven `electron` (lo aporta el propio
runtime) y módulos nativos de Node.

### Herramienta y versiones

`electron-builder` 26.18.0 como `devDependency` de este paquete, configurado en
`electron-builder.yml`. La versión de Electron no se fija a mano: electron-builder
la resuelve a **41.10.7** desde `devDependencies.electron` de este `package.json`
(aunque `node_modules/electron` esté izado a la raíz del workspace).

### Comandos exactos (host Windows x64)

Desde la raíz del repositorio:

```bat
bun install --frozen-lockfile
cd apps\desktop
bun run dist:win
```

`dist:win` ejecuta `vite build` (renderizador en `dist/index.html` + `assets/`),
los dos empaquetados de proceso (`dist/preload.cjs` y `dist/main.cjs`) y después
`electron-builder --win`, que aplica los dos objetivos del archivo de
configuración y produce:

- `apps\desktop\release\win-unpacked\Livefy.exe` — árbol sin empaquetar (lo que
  se inspecciona para verificar contenido);
- `apps\desktop\release\Livefy-0.0.0-portable.exe` — ejecutable único.

Solo el árbol sin empaquetar (iteración más rápida, sin recompresión):

```bat
bun run dist:win:unpacked
```

Ejecutar lo producido:

```bat
release\win-unpacked\Livefy.exe
release\Livefy-0.0.0-portable.exe
```

`release/` está ignorado por git (`apps/desktop/.gitignore`). No hay firma de
código configurada: Windows mostrará su advertencia habitual de SmartScreen para
el `.exe` portable. No existe ningún paso de publicación ni de actualización.

### Qué contiene el paquete

`electron-builder.yml` declara solo archivos de ejecución y el paquete no lleva
árbol de `node_modules`. electron-builder recolecta `node_modules` únicamente a
partir del campo `dependencies` de `package.json` (nunca de `devDependencies`), y
este `package.json` ya no declara dependencias de producción: todo lo que necesita
el build está en `devDependencies` porque se inlinea al compilar.

| Entra | Por qué |
| --- | --- |
| `package.json` | metadatos y entrada `main: dist/main.cjs` |
| `dist/index.html` + `dist/assets/**` | renderizador compilado servido por `livefy://renderer/` |
| `dist/main.cjs` | proceso principal empaquetado (incluye `@clerk/electron`, `electron-store`, `protocol`, `csp-policy`, `security`, `clerk-storage`) |
| `dist/preload.cjs` | precarga empaquetada que carga `main.cjs` |
| `node_modules` | **no entra** |

No entran `src/`, `index.html`, `vite.config.ts`, `csp.test.ts`, el backend
remoto `convex/`, `scripts/`, los scripts de compilación (`electron/build-*.mjs`),
las fuentes sin empaquetar `electron/*.cjs` ni ningún `*.test.*`.

La reducción esperada frente al paquete anterior es de unos **260 MB** en
`win-unpacked` (de ~607 MB medidos a ~345 MB, antes de comprimir), porque
desaparece `resources/app/node_modules` — los ~300 paquetes de producción — y en
su lugar quedan los ~418 kB de `dist/main.cjs`. La cifra exacta depende de
comprobaciones de Windows y de la compresión del objetivo `portable`, así que se
confirma midiendo el artefacto, no aquí.

Para verificar el autocontenido del artefacto sin abrirlo, basta inspeccionar
`resources/app/node_modules` (no debe existir) y comprobar que `resources/app`
solo contiene `package.json` y `dist/`. En el árbol de fuentes, el equivalente es:

```sh
# solo debe listar electron y builtins de Node (path, fs, crypto, …)
grep -oE 'require\("[^"]+"\)' dist/main.cjs | sort -u
```

Las apariciones de `require("ajv/…")` que ese `grep` muestra son parte de
cadenas de código generado de ajv (`x.code = 'require("ajv/dist/runtime/equal")'`),
no llamadas que se resuelvan aquí: los módulos de runtime de ajv sí están
inlineados. La comprobación real de resolución es cargar `dist/main.cjs` con un
`require` que lance ante cualquier especificador que no sea `electron` ni un
builtin de Node; el arranque crea la ventana sobre `livefy://renderer/` y registra
los canales de Clerk y `livefy:session-*` sin tocar otro paquete.

### Proceso principal empaquetado (`electron/build-main.mjs`)

`electron/build-main.mjs` compila `electron/main.cjs` a **`dist/main.cjs`**, igual
que `build-preload.mjs` compila la precarga. Rollup inlinea los módulos hermanos
(`protocol.cjs`, `csp-policy.cjs`, `security.cjs`, `clerk-storage.cjs`),
`@clerk/electron` y `electron-store` con su árbol de dependencias. Quedan externos
solo `electron` y los builtins de Node, así que el paquete no necesita
`node_modules` en ninguna ruta de ejecución.

- `package.json` declara `main: dist/main.cjs`; el paquete y el arranque local
  (`bun run start`) usan el mismo archivo.
- `desktop:dev` y `start` ejecutan primero `node electron/build-preload.mjs` y
  después `node electron/build-main.mjs`, antes de `electron .`, de modo que
  nunca se lanza el bundle de una compilación anterior. Editar `electron/*.cjs`
  con la aplicación abierta no recarga nada: hay que reiniciar `desktop:dev`,
  que recompila.
- Los caminos derivados de `__dirname` siguen siendo válidos y quedan explícitos
  en `main.cjs:14`: `distDir = path.resolve(__dirname, '../dist')`. La fuente vive
  en `electron/main.cjs` y el bundle en `dist/main.cjs`, ambos exactamente un
  nivel por debajo de `dist`, así que el renderizador y la precarga se resuelven
  en el mismo directorio en las dos disposiciones; el directorio de la
  aplicación sigue siendo el padre de `__dirname` (`main.cjs:33-39`). Ningún camino
  depende ya de `electron/` dentro del paquete.
- `@clerk/electron` importa dinámicamente su peer nativo opcional
  `@clerk/electron-passkeys` solo en la ruta `createClerkBridge({ passkeys: true })`.
  Esta aplicación nunca habilita passkeys y el paquete no está instalado, así que
  el build lo sustituye por un módulo inerte que informa «no disponible» en lugar
  de dejar un especificador suelto en el bundle. Habilitar passkeys nativas más
  adelante requiere instalar el paquete y quitar ese stub; no hay binarios
  nativos, rutas de asset ni `require` dinámicos de otra dependencia en el
  bundle (verificado con el arranque descrito arriba).
- `electron-store`/`conf` arrastran ajv. ajv genera validadores con `new Function`
  solo si se le pasa un `schema`; este código crea el store sin `schema`, así que
  esa ruta no se ejecuta. En el proceso principal `new Function` no está sujeto a
  CSP (la CSP es del renderizador y no cambia).

### Decisión sobre asar: archivo deshabilitado (`asar: false`)

La entrada empaquetada calcula la raíz del renderizador en `main.cjs:14` como
`path.resolve(__dirname, '../dist')` y entrega ese directorio a `protocol.cjs`
(`main.cjs:62`). `electron/protocol.cjs:39-41` exige que
`fs.realpath(root)` y `fs.realpath(target)` compartan ancestro (`path.relative`
no puede empezar por `..` ni ser absoluto) y solo después pasa la ruta real a
`net.fetch(pathToFileURL(file).href)` (`protocol.cjs:42`). Esa comprobación es la
que impide servir un archivo fuera de `dist`, y `electron/protocol.test.js:66`
la fija sobre rutas reales del sistema de archivos.

Dentro de un asar esas dos rutas son virtuales del archivo, no del disco: ni
`fs.realpath` ni `net.fetch('file://…app.asar/…')` están cubiertos por este
repositorio, y `asarUnpack` no elimina el problema sino que lo agrava — el
archivo conserva la ruta virtual `app.asar/dist/...` mientras los bytes viven en
`app.asar.unpacked/dist/...`, justo el caso que el cálculo de ancestro común
rechaza. Si esa comprobación falla, cada respuesta del renderizador es 403/404 y
`main.cjs:54-58` cierra la aplicación: el empaquetado no arrancaría.

Por eso este objetivo de validación usa `asar: false` y el paquete queda como un
árbol de archivos idéntico al que el código ya sirve hoy desde disco. Habilitar
asar requiere un cambio de código en `electron/protocol.cjs` (o en la raíz del
renderizador) **más** una ejecución empaquetada observada en Windows; no es un
interruptor de configuración. Esa decisión no cambia el renderizador, la CSP ni
los ajustes de seguridad.

### Checklist manual del paquete (Windows)

Registrar modo y artefacto (`win-unpacked` o `portable`), versión y resultado de
cada paso; no marcar aceptado un paso no observado.

0. **Contenido del paquete**: `dir apps\desktop\release\win-unpacked\resources\app`
   debe listar solo `dist` y `package.json`; `dir ...\resources\app\node_modules`
   debe fallar con «no se encuentra». Si `node_modules` existe, el `package.json`
   empaquetado volvió a declarar `dependencies` de producción. Para el objetivo
   `portable`, copiar el `.exe` fuera del workspace (por ejemplo `C:\Temp`) y
   ejecutarlo desde ahí: antes fallaba con `Cannot find module
   '@clerk/electron'` justamente por depender del `node_modules` izado del
   workspace, así que este paso es el que prueba el autocontenido.
1. **Arranque**: la ventana abre el renderizador y no aparece
   «Unable to load the local Livefy renderer». Si aparece, el paquete no cargó
   `livefy://renderer/` desde `dist` y la validación se detiene aquí.
2. **CSP en el renderizador empaquetado**: con DevTools abierto en esa ventana,
   ejecutar en la consola
   `await fetch('livefy://renderer/').then(r => r.headers.get('content-security-policy'))`
   y comprobar que devuelve la política de producción —sin `ws://127.0.0.1:5173`
   y sin `unsafe-eval`— y no `null`. Si el panel Network registra la petición
   `livefy://renderer/`, la misma cabecera debe aparecer en sus response headers.
   La fuente única sigue siendo `electron/csp-policy.cjs`: la cabecera
   (`protocol.cjs:23-27`) y el `<meta>` compilado deben coincidir.
3. **Registro**: crear una cuenta real y confirmar el código.
4. **Login**: entrar con esa cuenta y comprobar acceso privado (`/app`).
5. **Reinicio**: cerrar y volver a abrir el artefacto; la sesión se restaura
   desde el almacén cifrado del paquete (`%APPDATA%\Livefy`, nombre
   `productName`, separado del usado en desarrollo) o se informa explícitamente
   que la sesión quedó solo en memoria si `safeStorage` no está disponible.
6. **Logout**: cerrar sesión; la aplicación borra el almacén local y termina. Al
   reabrir debe pedir acceso de nuevo.
7. **Recuperación**: recorrer «Forgot password?» completo dentro de la ventana
   (código, contraseña nueva, la nueva entra y la vieja no).

### Límites de un build portable

- El paquete es autocontenido y **está verificado en ejecución**: `portable`, corrido
desde `C:\Temp` fuera del workspace, abre y recorre todo el flujo, incluido Google
OAuth, sin depender de ningún `node_modules` ajeno al artefacto.
- No hay registro `livefy://` permanente sin instalador. `@clerk/electron` registra
  el esquema en tiempo de arranque (ahora inlineado en `dist/main.cjs`) y
  `main.cjs:33-39` solo añade el directorio de la app cuando corre en modo
  desarrollo; el objetivo `portable` se autoextrae en `%TEMP%` en cada ejecución.
  **Medido:** mientras la app corre, el retorno de OAuth por deep link funciona
  también en `portable`. El residuo es el registro que queda tras cerrar: apunta a
  una ruta temporal que ya no existe. Un instalador lo resuelve; definir la
  distribución sigue siendo otra decisión.
- `portable` extrae el árbol en cada arranque: el primer inicio es más lento que
  `win-unpacked` y consume espacio temporal. Para validar contenido y rendimiento
  de arranque usar `win-unpacked`; `portable` solo confirma que el ejecutable
  único funciona.
- Sin firma: SmartScreen puede avisar; no es un defecto del paquete.

### Verificado por el operador en Windows (H1.12)

Sobre `release\win-unpacked\Livefy.exe`, sin servidor de desarrollo: la app arranca,
`location.protocol` es `livefy:`, la cabecera `content-security-policy` llega desde
`protocol.cjs` en las dos rutas consultadas, y el recorrido completo pasa contra
Clerk y Convex reales — registro con verificación por email, login, reinicio con
sesión persistida, logout y recuperación de contraseña. **También el login con
Google**, en los dos artefactos: `win-unpacked` y el `portable` ejecutado desde
`C:\Temp`, fuera del workspace, que es el caso que antes fallaba con
`Cannot find module '@clerk/electron'`. Una predicción previa de esta sesión afirmó
lo contrario para el portable y queda corregida por esta observación: el SDK
registra el esquema en cada arranque, así que el deep link funciona mientras la app
corre. El artefacto quedó autosuficiente: `resources\app` contiene solo `dist` y
`package.json`, sin `node_modules`, y `win-unpacked` bajó de 607 MB a 347 MB.

### Lo que no se verificó al escribir esta configuración

El host de autoría es Linux/WSL sin wine ni Windows, y la tarea prohíbe explícitamente
producir el artefacto. Verificado aquí: el archivo de configuración carga con el
cargador real de electron-builder y pasa su validación de esquema (`files` resuelto
a `package.json` + `dist/**/*`, sin `node_modules`), los objetivos resueltos son
`dir` y `portable` para x64, la versión de Electron resuelta es 41.10.7, y
`test`/`typecheck`/`build` siguen verdes en este host, con `dist/main.cjs`
cargable por `node --check` y arrancando sobre `livefy://renderer/` con un
`require` que rechaza cualquier especificador que no sea `electron` o un builtin.
**No** verificado aquí: que el `.exe` resultante arranque, el tamaño final y el
contenido real de `resources/app` (en un workspace con dependencias izadas esta
versión de electron-builder trae un colector específico de bun por recorrido de
archivos, `out/node-module-collector/bunNodeModulesCollector.js`, y un respaldo
por recorrido en `out/util/appFileCopier.js:305-320`; el paquete ya no declara
dependencias de producción, así que el colector no tiene nada que recolectar, pero
no se ejecutó), la cabecera CSP en la ventana empaquetada ni ningún paso del
checklist anterior. Todo eso pertenece a la ejecución Windows de H1.12.

## Seguridad y límites de verificación

- El aislamiento de contexto y el entorno aislado (sandbox) están habilitados; la integración Node y las vistas web están deshabilitadas.
- Se deniegan permisos y ventanas emergentes. La navegación y las redirecciones se limitan al documento de entrada exacto, permitiendo cambios de fragmento.
- Desarrollo carga únicamente `http://127.0.0.1:5173/`; producción sirve `dist` mediante `livefy://renderer`. La CSP bloquea marcos, objetos y envíos de formularios; la compilación elimina el permiso de websocket de desarrollo.
- The preload exposes only the fixed Clerk bridge (including SDK-managed external-browser OAuth) and persistence status described above, not generic IPC. The development server remains trusted local code, not an authenticated service boundary.

Las pruebas Vitest históricas comprueban políticas deterministas y la interfaz de acceso no disponible, no la seguridad de Electron en ejecución. Un intento histórico en Linux registró caídas de procesos GPU (salida 139) y terminó por límite de tiempo (124); no constituye certificación visual ni demuestra por sí solo que la ventana no se abriera.

**H1.1 cuenta con un lanzamiento básico de la vista previa en Windows observado por el usuario.** Esto no certifica seguridad en ejecución, flujos Auth, reinicio/persistencia ni el recorrido de una aplicación empaquetada en Windows. El empaquetado se limita por ahora al objetivo de validación sin instalador descrito en
«Empaquetado Windows (portable)»; no se ha seleccionado herramienta de instalación, firma ni
distribución.

## Historial H1.2: autenticación DEV y contrato de sesión

Lo siguiente describe la implementación retirada, no instrucciones actuales ni
el contrato vigente de sesión. No se deben reinstalar sus dependencias o scripts.

Versiones fijadas: Convex 1.46.0, `@convex-dev/auth` 0.0.96, `@auth/core` 0.41.1 y `convex-test` 0.0.60.

`session:current` no recibe argumentos: obtiene la identidad mediante `getAuthUserId(ctx)`, exige que exista el documento de usuario y devuelve solamente `{ userId }`. Rechaza identidades anónimas y usuarios eliminados. La protección reutilizable está en `convex/lib/requireUser.ts`; nunca se debe aceptar un identificador enviado por el renderizador como identidad.

El renderizador acepta únicamente `VITE_CONVEX_URL=https://polite-parrot-887.convex.cloud`. Si la configuración falta o no coincide, conserva la vista previa y muestra un estado no disponible, sin construir el cliente. Con configuración válida, envuelve el enrutador existente en un único ConvexAuthProvider/cliente. El modo exclusivo de contraseña desactiva el consumo de códigos desde la URL.

La CSP permite únicamente HTTPS/WSS del dominio cloud de este despliegue y HTTPS de su dominio site, además del websocket local de Vite solo en desarrollo. No añade comodines ni `unsafe-eval`.

### Evidencia histórica de activación y prueba API

La activación autorizada se limitó a `reos156/livefy`, DEV `polite-parrot-887`:

- Las comprobaciones CLI de identidad coincidieron con equipo, proyecto, despliegue y tipo mediante vinculación explícita del proceso.
- Ambas variables de firma estaban ausentes. Node crypto generó RS256/PKCS8 y JWKS público en memoria; una operación CLI por entrada estándar configuró solo `JWT_PRIVATE_KEY` y `JWKS`, sin `--force`. Se conserva una configuración completa existente; una configuración parcial detiene el procedimiento.
- `convex dev --once` de la versión fijada publicó Auth/sesión y generó los enlaces reales `_generated`. No se ejecutó `convex deploy`, no hubo cambios en producción ni rotación de claves. Convex proporciona `CONVEX_SITE_URL`; el modo exclusivo de contraseña no requiere un `SITE_URL` adicional.
- Un registro real por contraseña con ConvexHttpClient emitió un token. `session:current` autenticada coincidió con el usuario de ese token; la solicitud anónima fue rechazada con `Unauthorized`.
- El cierre de sesión funcionó. La limpieza INTERNAL protegida por marcador eliminó exactamente un usuario de prueba y una cuenta de contraseña; tras la limpieza de sesión/renovación del SDK, los recuentos dependientes fueron cero. Repetir la búsqueda/eliminación con el marcador exacto devolvió todos los recuentos a cero.
- Se retiró el registro temporal de limpieza y se volvió a publicar. Una comprobación CLI confirmó la ausencia de `h1SmokeCleanup:removeFixture`. No se añadió un endpoint público de administración.

En ese hito, `convex/h1SmokeCleanup.ts` conservaba solo una función auxiliar no registrada para regresiones locales; el archivo y sus tests ya se retiraron. Las pruebas históricas cubren rechazo del marcador, eliminación exacta de dependencias indexadas, conservación de usuarios/cuentas ajenos e idempotencia. Las credenciales por contraseña no crean verificadores OAuth en Auth 0.0.96; esta limpieza no es un eliminador general de cuentas.

Una verificación independiente posterior comprobó identidad DEV, nombres de variables de firma, rechazo anónimo y ausencia de la función temporal mediante inventario de funciones de solo lectura. No repitió el registro autenticado ni la limpieza tras eliminar los datos de prueba. Esta evidencia API/JWT **no equivale a evidencia de navegador, Electron o Auth en Windows**.

### Scripts retirados (referencia histórica)

Los siguientes scripts ya no existen en el árbol actual. La tabla conserva sus
efectos históricos, no comandos ejecutables ni pasos de preparación. Cualquier
operación remota equivalente requiere revisión y autorización independiente:

| Comando | Efecto y precaución |
| --- | --- |
| `node scripts/activate-auth-dev.mjs` | Comprueba identidad DEV, configura firma sin sobrescribir y publica. `--push-only` conserva la firma y solo publica. |
| `node scripts/smoke-auth-dev.mjs --verify-removed` | Invoca `convex run` contra la referencia de limpieza para comprobar su ausencia. **No es un inventario de funciones de solo lectura**: si la función existe, podría ejecutar la limpieza. |
| `node scripts/smoke-auth-dev.mjs` | Prueba con cuenta desechable. Al cierre de H1.2 fallaba en la comprobación previa de limpieza, antes del registro, porque el endpoint temporal fue retirado. Requiere un ciclo separado y revisado de registro INTERNAL temporal, pruebas locales y retirada. |

Los scripts retirados no leían directamente archivos locales de entorno, no imprimían la salida cruda CLI/Auth, no persistían credenciales de prueba ni registraban identificadores de cuentas. Rechazaban claves de despliegue heredadas, establecían una vinculación DEV explícita y anunciaban las mutaciones antes de cada subproceso/acción. La CLI fijada puede actualizar sus archivos locales autorizados de vinculación/exclusión durante `dev --once`.

## Fuentes y comprobaciones históricas

La limpieza actual sí ejecutó el test focalizado de esquema: falló con las siete
tablas legacy y pasó con el esquema vacío. No verificó el estado remoto. La
instalación y el codegen DEV ya finalizaron correctamente; queda pendiente la
verificación independiente completa posterior a las correcciones locales, no
un despliegue remoto autorizado.

En la actualización documental histórica descrita a continuación, no se consultaron fuentes externas ni se ejecutaron instalaciones, pruebas de comportamiento, compilaciones o comprobaciones remotas al actualizar estos README. La revisión actual fue documental: manifiestos, enlaces relativos, lectura estructural y alcance de los cambios.

Fuentes oficiales de Auth aportadas como contexto verificado de la tarea, con fecha de referencia 2026-10-05; no se recuperaron independientemente durante la activación ni en esta actualización:

- https://labs.convex.dev/auth/setup
- https://labs.convex.dev/auth/setup/manual
- https://labs.convex.dev/auth/config/passwords

Históricamente, los tipos y fuentes instalados confirmaron la exportación Password, el contrato del proveedor, la firma de `getAuthUserId` y las opciones de ConvexAuthProvider.

Referencias API comprobadas históricamente:

- https://ui.shadcn.com/docs/components/base/button — documentación Base UI seleccionada por la CLI.
- https://ui.shadcn.com/code/apps/v4/registry/bases/base/examples/button-example.tsx
- https://www.electronjs.org/docs/latest/tutorial/security
- https://vite.dev/guide/build.html — base relativa; también se comprobaron tipos de Vite 7 instalado.

El sitio de TanStack respondió 403; una ruta obsoleta inicial respondió 404. Los tipos y fuentes instalados de Router/History confirmaron el enrutamiento por código y el historial por fragmento. Los tipos instalados y las comprobaciones de tipos históricas son evidencia específica de versión, no evidencia de ejecución.
