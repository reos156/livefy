# Livefy

Livefy busca facilitar la gestión comercial de transmisiones en vivo de TikTok. El repositorio ofrece hoy una base de escritorio Electron/React con el acceso verificado, el alta de tienda, el dashboard del operador y el visor de TikTok LIVE en la primera de tres columnas. El flujo comercial completo —leads, WhatsApp, productos y cierre de carrito— todavía no existe.

## Estado actual

- **Implementado (DEV), acceso:** ventana Electron aislada con fronteras IPC, Clerk como único emisor de autenticación en web y Electron con la UI oficial del proveedor, registro, inicio de sesión, rutas privadas con guard, sesión nativa, recuperación de contraseña y navegación con TanStack Router sobre Convex. H1.1–H1.8, H1.11 y H1.12 están cerrados en el [hito de acceso Windows](odd/tasks/mvp-h1-access-windows.md); H1.9 y H1.10 quedaron absorbidos por H1.8 y no se pasaron como criterios separados.
- **Implementado (DEV), primera porción comercial:** R1 wizard de tienda con los catálogos en base de datos, R2 dashboard del operador con su contrato de métricas, y R3 columna 1 del panel de live —visor TikTok aislado, aceptado por el operador—. Ver los PR #25, #35, #36 y #42.
- **Pendiente:** R3 columnas 2 y 3 (productos y leads), R4 máquina de estados del lead, R5 WhatsApp por Kapso, R6 sesión de escritorio e ingestor local, R7 producto activo y cierre de carrito, y R8 seguimiento post-live. No existen todavía las tablas `lives`, `leads`, `products` ni `orders`, ni el webhook en `convex/http.ts`; `apps/` contiene sólo `desktop`.
- **Residuales conocidos:** las métricas de R2 tienen contrato en el backend pero el panel no las pinta, los identificadores del bot no se muestran en el wizard, el puente IPC no limita el tamaño del payload, el gate negativo de emisor ajeno (S2) sigue abierto por decisión, y un build firmado e instalado no está certificado.
- **Windows:** existe evidencia humana del lanzamiento básico de la vista previa (H1.1), del acceso y la recuperación en DEV, de la jornada de la aplicación empaquetada (H1.12, `dist:win` sobre `win-unpacked`) y de la CSP de producción entregada por header. La attestation negativa de Clerk no está certificada.
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

Estos son comandos disponibles, no comprobaciones ejecutadas al redactar esta documentación. `build` genera los recursos de la aplicación; no crea un instalador ni realiza firma o distribución. Para eso último existe `bun run dist:win` (o `dist:win:unpacked`) en `apps/desktop`, que tampoco firma ni publica.

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

La activación o reutilización de operaciones remotas de Auth requiere autorización explícita independiente; estos pasos no despliegan Convex. Para que el operador pruebe un cambio en Windows hay además un espejo local del worktree: `scripts/sync-windows.local.sh` previsualiza y `scripts/sync-windows.local.sh --apply` copia hacia `C:\Livefy\mvp`.

## Más información

- [Guía de escritorio](apps/desktop/README.md): configuración DEV, seguridad y límites de la evidencia histórica.
- [Hito de acceso Windows](odd/tasks/mvp-h1-access-windows.md): alcance, tareas pendientes y registro histórico de H1.
