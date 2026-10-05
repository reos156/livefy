# Livefy

Livefy busca facilitar la gestión comercial de transmisiones en vivo de TikTok. El repositorio todavía no ofrece un flujo comercial completo: contiene una base de escritorio Electron/React y un contrato de autenticación y sesión verificado contra Convex en desarrollo (DEV).

## Estado actual

- **Implementado:** ventana Electron aislada, vista previa de acceso en React, navegación con TanStack Router y backend Convex Auth de correo/contraseña con consulta de sesión.
- **Pendiente:** interfaz de registro e inicio de sesión, recorrido completo de acceso y recuperación, y funciones comerciales. Los controles de acceso de la vista previa siguen deshabilitados; inicializar el proveedor no equivale a autenticar al usuario.
- **Windows:** existe evidencia humana del lanzamiento básico de la vista previa (H1.1). La seguridad en ejecución, los flujos Auth y la aplicación empaquetada en Windows no están certificados.

## Tecnologías

Electron, React, TanStack Router, Vite, Shadcn con Base UI, Convex, Turborepo y espacios de trabajo Bun. El gestor fijado en el manifiesto es Bun 1.2.15. Node 22.23.1 fue la versión observada en el entorno de verificación, no un requisito universal obligatorio.

## Preparación y comprobaciones locales

Desde la raíz:

```sh
bun install --frozen-lockfile
bun run typecheck
bun run test
bun run build
```

Estos son comandos disponibles, no comprobaciones ejecutadas al redactar esta documentación. `build` genera los recursos de la aplicación; no crea un instalador ni realiza firma o distribución.

## Desarrollo y ejecución

`bun run dev` desde la raíz coordina las tareas de desarrollo con Turborepo; actualmente inicia Vite, no Electron. Para abrir la aplicación en desarrollo, utiliza dos terminales, ambas en `apps/desktop`:

```sh
# Terminal 1
cd apps/desktop
bun run dev
```

```sh
# Terminal 2
cd apps/desktop
bun run desktop:dev
```

Para cargar los recursos locales después de `bun run build` desde la raíz:

```sh
cd apps/desktop
bun run start
```

La activación o reutilización de operaciones remotas de Auth requiere autorización explícita independiente; estos pasos no despliegan Convex.

## Más información

- [Guía de escritorio](apps/desktop/README.md): configuración DEV, seguridad y límites de la evidencia histórica.
- [Hito de acceso Windows](odd/tasks/mvp-h1-access-windows.md): alcance, tareas pendientes y registro histórico de H1.
