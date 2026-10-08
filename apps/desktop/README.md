# Base de escritorio de Livefy

## Integración local actual — Clerk nativo

Clerk gestiona registro e inicio de sesión (H1.3/H1.4). Convex conserva
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

El bridge usa `createClerkBridge({storage})`, sin renderer/OAuth/passkeys. La SDK
comprueba el frame principal, no el origen exacto de cada IPC. La ventana controlada,
la navegación restringida y los popups denegados mantienen ese origen. La precarga
expone el API fijo público de Clerk y una consulta fija de estado de persistencia;
no expone IPC genérico. Cleanup retira handlers al salir.

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
No hay OAuth ni single-instance/deep-link flows en este modo.
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

## Historial H1.1/H1.2 (no describe los proveedores actuales)

La base H1.1/H1.2 combina una ventana Electron aislada, una vista previa de acceso en React y un contrato de autenticación correo/contraseña y sesión activado en Convex DEV. La interfaz de registro/inicio de sesión, la recogida de credenciales en el renderizador y el empaquetado no están implementados. Los controles de acceso siguen deshabilitados; inicializar el proveedor no representa una autenticación correcta.

Consulta el [README principal](../../README.md) y el [registro del hito H1](../../odd/tasks/mvp-h1-access-windows.md).

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

El renderizador utiliza la transformación JSX de Vite sin el preámbulo de Fast Refresh para restringir los scripts de la CSP a archivos locales. TanStack Router usa historial por fragmento; producción carga mediante
`livefy://renderer`. La inicialización estándar de Shadcn seleccionó Base UI / base-nova; su componente Button está incluido en el repositorio.

## Seguridad y límites de verificación

- El aislamiento de contexto y el entorno aislado (sandbox) están habilitados; la integración Node y las vistas web están deshabilitadas.
- Se deniegan permisos y ventanas emergentes. La navegación y las redirecciones se limitan al documento de entrada exacto, permitiendo cambios de fragmento.
- Desarrollo carga únicamente `http://127.0.0.1:5173/`; producción sirve `dist` mediante `livefy://renderer`. La CSP bloquea marcos, objetos y envíos de formularios; la compilación elimina el permiso de websocket de desarrollo.
- La precarga expone solo el bridge fijo de Clerk y el estado de persistencia descritos arriba, no IPC genérico ni apertura de navegador externo. El servidor de desarrollo es código local de confianza, no una frontera de servicio autenticado.

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
