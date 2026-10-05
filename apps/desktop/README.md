# Base de escritorio de Livefy

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

El renderizador utiliza la transformación JSX de Vite sin el preámbulo de Fast Refresh para restringir los scripts de la CSP a archivos locales. TanStack Router usa historial por fragmento para cargar mediante `file:`. La inicialización estándar de Shadcn seleccionó Base UI / base-nova; su componente Button está incluido en el repositorio.

## Seguridad y límites de verificación

- El aislamiento de contexto y el entorno aislado (sandbox) están habilitados; la integración Node y las vistas web están deshabilitadas.
- Se deniegan permisos y ventanas emergentes. La navegación y las redirecciones se limitan al documento de entrada exacto, permitiendo cambios de fragmento.
- Desarrollo carga únicamente `http://127.0.0.1:5173/`; producción carga `dist/index.html`. La CSP bloquea marcos, objetos y envíos de formularios; la compilación elimina el permiso de websocket de desarrollo.
- No se proporciona precarga, IPC, apertura de navegador externo, credenciales ni secretos. El servidor de desarrollo es código local de confianza, no una frontera de servicio autenticado.

Las pruebas Vitest históricas comprueban políticas deterministas y la interfaz de acceso no disponible, no la seguridad de Electron en ejecución. Un intento histórico en Linux registró caídas de procesos GPU (salida 139) y terminó por límite de tiempo (124); no constituye certificación visual ni demuestra por sí solo que la ventana no se abriera.

**H1.1 cuenta con un lanzamiento básico de la vista previa en Windows observado por el usuario.** Esto no certifica seguridad en ejecución, flujos Auth, reinicio/persistencia ni el recorrido de una aplicación empaquetada en Windows. No se ha seleccionado herramienta de instalación, firma o distribución.

## H1.2: autenticación DEV y contrato de sesión

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

`convex/h1SmokeCleanup.ts` conserva solo una función auxiliar no registrada para regresiones locales. Las pruebas históricas cubren rechazo del marcador, eliminación exacta de dependencias indexadas, conservación de usuarios/cuentas ajenos e idempotencia. Las credenciales por contraseña no crean verificadores OAuth en Auth 0.0.96; esta limpieza no es un eliminador general de cuentas.

Una verificación independiente posterior comprobó identidad DEV, nombres de variables de firma, rechazo anónimo y ausencia de la función temporal mediante inventario de funciones de solo lectura. No repitió el registro autenticado ni la limpieza tras eliminar los datos de prueba. Esta evidencia API/JWT **no equivale a evidencia de navegador, Electron o Auth en Windows**.

### Operaciones que requieren autorización independiente

Los siguientes scripts son referencias operativas históricas, no pasos de preparación rutinaria. Su reutilización requiere autorización explícita separada:

| Comando | Efecto y precaución |
| --- | --- |
| `node scripts/activate-auth-dev.mjs` | Comprueba identidad DEV, configura firma sin sobrescribir y publica. `--push-only` conserva la firma y solo publica. |
| `node scripts/smoke-auth-dev.mjs --verify-removed` | Invoca `convex run` contra la referencia de limpieza para comprobar su ausencia. **No es un inventario de funciones de solo lectura**: si la función existe, podría ejecutar la limpieza. |
| `node scripts/smoke-auth-dev.mjs` | Prueba con cuenta desechable. Actualmente falla en la comprobación previa de limpieza, antes del registro, porque el endpoint temporal fue retirado. Requiere un ciclo separado y revisado de registro INTERNAL temporal, pruebas locales y retirada. |

Los scripts no leen directamente archivos locales de entorno, no imprimen la salida cruda CLI/Auth, no persisten credenciales de prueba ni registran identificadores de cuentas. Rechazan claves de despliegue heredadas, establecen una vinculación DEV explícita y anuncian las mutaciones antes de cada subproceso/acción. La CLI fijada puede actualizar sus archivos locales autorizados de vinculación/exclusión durante `dev --once`.

## Fuentes y comprobaciones históricas

No se consultaron fuentes externas ni se ejecutaron instalaciones, pruebas de comportamiento, compilaciones o comprobaciones remotas al actualizar estos README. La revisión actual fue documental: manifiestos, enlaces relativos, lectura estructural y alcance de los cambios.

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
