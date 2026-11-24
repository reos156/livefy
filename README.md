# Livefy

Livefy busca facilitar la gestión comercial de transmisiones en vivo de TikTok. El repositorio todavía no ofrece un flujo comercial completo: contiene una base de escritorio Electron/React y un contrato de autenticación y sesión verificado contra Convex en desarrollo (DEV).

## Estado actual

- **Implementado (DEV):** ventana Electron aislada con fronteras IPC, Clerk como único emisor de autenticación en web y Electron con la UI oficial del proveedor, registro, inicio de sesión, rutas privadas con guard, sesión nativa y navegación con TanStack Router sobre Convex. Ver H1.1–H1.7 en el [hito de acceso Windows](odd/tasks/mvp-h1-access-windows.md).
- **Pendiente:** recuperación de contraseña (H1.8–H1.12), la attestation negativa de Clerk y la CSP de producción, la aplicación empaquetada en Windows y todas las funciones comerciales del MVP (wizard de tienda, dashboard, panel de live, productos, leads, Kapso e ingestor local).
- **Windows:** existe evidencia humana del lanzamiento básico de la vista previa (H1.1) y del acceso en DEV. La seguridad en ejecución, la attestation negativa de Clerk y la aplicación empaquetada en Windows no están certificados.
- **Alcance:** DEV aceptado, sin certificación de producción ni despliegue.

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
