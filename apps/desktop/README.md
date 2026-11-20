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

Compilar desde `apps/desktop` con `bun run build` genera también `dist/preload.cjs`:
CJS empaquetado por Vite/Rollup, solo Electron externo, compatible con sandbox.
Compilar antes de `desktop:dev` también es necesario para disponer de la precarga.
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

En desarrollo, utiliza dos terminales en `apps/desktop`:

```sh
# Terminal 1
bun run dev
```

```sh
# Terminal 2
bun run desktop:dev
```

`dev` inicia solamente Vite; Electron se inicia con `desktop:dev`. Desde la raíz, `bun run dev` coordina la tarea Vite mediante Turborepo, sin iniciar Electron.

El renderizador utiliza la transformación JSX de Vite sin el preámbulo de Fast Refresh para restringir los scripts de la CSP a archivos locales. TanStack Router usa historial en memoria iniciado en `/`; el fragmento queda
reservado a Clerk. Navegar a `/app` no modifica el hash. El cambio aceptado por el
usuario hace que reload vuelva al acceso público **sin borrar la sesión**;
Convex debe volver a confirmar antes de ofrecer entrada. Producción carga mediante
`livefy://renderer`. La inicialización estándar de Shadcn seleccionó Base UI / base-nova; su componente Button está incluido en el repositorio.

## Seguridad y límites de verificación

- El aislamiento de contexto y el entorno aislado (sandbox) están habilitados; la integración Node y las vistas web están deshabilitadas.
- Se deniegan permisos y ventanas emergentes. La navegación y las redirecciones se limitan al documento de entrada exacto, permitiendo cambios de fragmento.
- Desarrollo carga únicamente `http://127.0.0.1:5173/`; producción sirve `dist` mediante `livefy://renderer`. La CSP bloquea marcos, objetos y envíos de formularios; la compilación elimina el permiso de websocket de desarrollo.
- The preload exposes only the fixed Clerk bridge (including SDK-managed external-browser OAuth) and persistence status described above, not generic IPC. The development server remains trusted local code, not an authenticated service boundary.

Las pruebas Vitest históricas comprueban políticas deterministas y la interfaz de acceso no disponible, no la seguridad de Electron en ejecución. Un intento histórico en Linux registró caídas de procesos GPU (salida 139) y terminó por límite de tiempo (124); no constituye certificación visual ni demuestra por sí solo que la ventana no se abriera.

**H1.1 cuenta con un lanzamiento básico de la vista previa en Windows observado por el usuario.** Esto no certifica seguridad en ejecución, flujos Auth, reinicio/persistencia ni el recorrido de una aplicación empaquetada en Windows. No se ha seleccionado herramienta de instalación, firma o distribución.

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
