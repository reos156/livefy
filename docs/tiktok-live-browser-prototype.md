# Prototipo de navegador remoto para TikTok LIVE

Este prototipo descartable permite que un operador vea e interactúe manualmente con un LIVE de TikTok desde Chromium remoto, con video por noVNC y audio por una captura separada de PulseAudio. Sirve como referencia para implementar Livefy; **no es la arquitectura completa de Livefy ni un servicio listo para producción**.

## Recorrido rápido

Ejecutá los comandos desde la raíz del repositorio: Compose interpola `${PWD}` para encontrar el perfil seccomp.

1. Construí y levantá únicamente `tiktok-browser`:

   ```bash
   docker compose -f prototypes/tiktok-live-browser/docker-compose.yml up -d --build tiktok-browser
   ```

   **Si repetís el comando**, Compose puede reemplazar el contenedor cuando cambie la imagen o configuración. El perfil de TikTok está dentro del contenedor, no en un volumen; asumí que podés perder el login al reconstruir.

2. En el host Docker, abrí <http://127.0.0.1:3001/>. En la ventana noVNC, iniciá sesión manualmente en TikTok si hace falta; después pulsá **Activar audio** en la página combinada.
3. Para consultar el estado o seguir los registros, usá los comandos de [operación](#operación).

Los puertos publicados sólo escuchan en loopback. Para acceder desde otra máquina, usá el [túnel SSH](#acceso-remoto-por-ssh); no publiques estos puertos en una interfaz de red ni en un firewall.

## Componentes y flujo

| Componente | Función en el prototipo |
|---|---|
| Chromium + Xvfb + Fluxbox | Abre una URL de TikTok LIVE fija en un escritorio virtual de 1280 × 720. |
| x11vnc + websockify/noVNC | Exporta el escritorio al puerto interno 5900 y lo presenta por el puerto 3000. x11vnc usa `-nopw`. |
| PulseAudio | Envía el audio del navegador al sink virtual `tiktok_sink`. |
| `audio-server.js` + ffmpeg | Sirve la página combinada y un WebSocket en 3001; ffmpeg captura `tiktok_sink.monitor` como PCM estéreo de 48 kHz, signed 16-bit little-endian. |
| Página combinada | Inserta noVNC y recibe el PCM por WebSocket para reproducirlo en el navegador del operador. |
| Compose | Orquesta un único servicio, `tiktok-browser`, con publicaciones host loopback y un perfil seccomp propio. |

El recorrido de video es Chromium → pantalla virtual Xvfb → x11vnc → websockify/noVNC (`:3000`) → operador. El recorrido de audio es Chromium → PulseAudio `tiktok_sink` → ffmpeg → WebSocket (`:3001`) → `AudioContext` del navegador del operador.

Al abrir la página combinada, el cliente establece el WebSocket. La primera conexión inicia ffmpeg; si se desconecta el último cliente, el servidor espera dos segundos y envía `SIGTERM`. Si ffmpeg termina inesperadamente mientras siguen conectados clientes, se intenta reiniciarlo tras un segundo. El clic en **Activar audio** reanuda el `AudioContext` ante la política de activación por gesto del navegador; no inicia el inicio de sesión de TikTok.

## Construcción e implementación

El `Dockerfile` parte de Debian Bookworm slim e instala Chromium y `chromium-sandbox`, Xvfb, Fluxbox, x11vnc, websockify, PulseAudio, ffmpeg, Node/npm y las utilidades necesarias. Descarga noVNC 1.4.0, instala la dependencia Node `ws` (`^8.16.0`) y copia el entrypoint y `audio-server.js`.

El entrypoint arranca PulseAudio, Xvfb y Fluxbox, permite acceso al display a root y al usuario `chromium`, y abre Chromium con una URL fija: `https://www.tiktok.com/@jdenglish20/live`. El entrypoint y los servicios auxiliares corren como root; **sólo Chromium** se ejecuta mediante `runuser --user chromium`, con su perfil en `/home/chromium/profile`. La pantalla y el servidor de audio quedan disponibles en los puertos de contenedor 3000 y 3001.

Compose publica:

| Host | Contenedor | Uso |
|---|---:|---|
| `127.0.0.1:3000` | `3000` | noVNC/websockify |
| `127.0.0.1:3001` | `3001` | Página combinada y WebSocket de audio |

También configura `SCREEN_RESOLUTION=1280x720`, monta `/dev/shm`, solicita `shm_size: 2gb`, aplica `seccomp-chromium.json` y define `restart: unless-stopped`. Docker puede reiniciar el **contenedor** si termina su proceso principal, salvo que se haya detenido explícitamente; esta política no supervisa ni reinicia por separado cada proceso hijo, no finaliza un LIVE ni elimina el contenedor.

## Ajustes de seguridad y límites

Los cambios registrados para este prototipo endurecieron la exposición de red y el arranque de Chromium:

- Las publicaciones de ambos puertos se limitaron a `127.0.0.1`; se quitó la clave superior `version` obsoleta de Compose.
- Se incorporó el usuario de sistema `chromium` y el helper `chromium-sandbox`. El comando conserva `--disable-setuid-sandbox`, pero no contiene `--no-sandbox` ni `--disable-namespace-sandbox`.
- Compose aplica el perfil `seccomp-chromium.json` sólo a este servicio. Conserva `SCMP_ACT_ERRNO` como acción predeterminada. La regla de `clone3` devuelve `ENOSYS` (errno 38) cuando aplica la regla sin `CAP_SYS_ADMIN`; también se conserva la regla condicional heredada de Moby que permite `clone3` junto con otras syscalls cuando esa capacidad está presente. Compose no agrega `CAP_SYS_ADMIN`; no la agregues para resolver errores.
- El perfil suma reglas de argumentos con máscara `0x7e020000`: para `clone`, USER (`0x10000000`), USER|PID|NET (`0x70000000`) y PID (`0x20000000`); para `unshare`, USER (`0x10000000`). Los demás casos siguen sujetos a las reglas del perfil derivado y al default-deny.
- El perfil se documentó como derivado del perfil predeterminado de Moby/Docker Engine 29.7.2: commit Moby `6a43e3d5afddf4111da0f864bbc7cae5d7e95001`; SHA-256 de la base upstream de 875 líneas `536529b665dd0972c37bfb569f5d4ac8a53592e7b00752bc39ff063ca9864c74`.
- `audio-server.js` distingue el cierre solicitado de ffmpeg de una salida inesperada; no se oculta la salida de diagnóstico.

**La configuración fuente no demuestra por sí sola qué capas están activas en una instancia en ejecución.** Tampoco hay contraseña de VNC ni autenticación en la página/WebSocket de audio. El enlace sólo es apto para uso local o mediante un túnel SSH desde una máquina autorizada; no abras 3000/3001 a una red pública ni amplíes privilegios para resolver fallos.

El perfil de Chromium vive en el sistema de archivos del contenedor, no en un volumen persistente de Compose. `stop` conserva el contenedor detenido y su perfil; una recreación forzada o la eliminación del contenedor puede perder la sesión de TikTok y exigir otro inicio de sesión. No guardes credenciales esperando que sobrevivan a una recreación.

## Operación

Todos los comandos siguientes se ejecutan desde la raíz del repositorio, para que `${PWD}` resuelva la ruta de `seccomp-chromium.json`.

**Construir y arrancar** (también sirve para arrancar el servicio cuando no existe):

```bash
docker compose -f prototypes/tiktok-live-browser/docker-compose.yml up -d --build tiktok-browser
```

**Ver estado:**

```bash
docker compose -f prototypes/tiktok-live-browser/docker-compose.yml ps
```

**Seguir los registros:**

```bash
docker compose -f prototypes/tiktok-live-browser/docker-compose.yml logs -f tiktok-browser
```

**Detener sin eliminar el contenedor** — conserva el perfil guardado en ese contenedor:

```bash
docker compose -f prototypes/tiktok-live-browser/docker-compose.yml stop tiktok-browser
```

**Reanudar el mismo contenedor detenido:**

```bash
docker compose -f prototypes/tiktok-live-browser/docker-compose.yml start tiktok-browser
```

**Reconstruir y recrear intencionalmente** — puede descartar el perfil y requerir otro login:

```bash
docker compose -f prototypes/tiktok-live-browser/docker-compose.yml up -d --build --force-recreate tiktok-browser
```

`stop` detiene y conserva el contenedor; `start` lo vuelve a iniciar. `up --build` también puede reemplazarlo si cambia la imagen o configuración; `--force-recreate` lo reemplaza intencionalmente. Ninguno equivale a reanudar sin cambios. La ausencia de un volumen para `/home/chromium/profile` impide asumir que el estado de login persistirá después de cualquier recreación o eliminación.

## Acceso local, remoto y uso manual

- **En el host Docker:** `http://127.0.0.1:3001/` muestra la página combinada. `http://127.0.0.1:3000/` abre noVNC directamente, sin la interfaz combinada de audio.
- **Desde una estación remota:** iniciá un túnel desde esa estación al host donde corre Docker, sustituyendo `usuario` y `servidor`:

  ```bash
  ssh -N -L 127.0.0.1:3000:127.0.0.1:3000 -L 127.0.0.1:3001:127.0.0.1:3001 usuario@servidor
  ```

  Con el túnel activo, abrí <http://127.0.0.1:3001/> en el navegador de la estación. El túnel cubre ambos puertos; no cambies el bind del host para hacerlo accesible.
- **Login y reproducción:** el operador inicia sesión manualmente en TikTok dentro de Chromium. Después pulsa **Activar audio** en la página combinada. Si la cuenta no inició sesión o el LIVE no está disponible, TikTok puede mostrar una pantalla de login o no haber transmisión que reproducir. El prototipo no automatiza el login.

## Avisos observados y evidencia

- **Aviso de Chromium:** la captura compartida por el usuario muestra la advertencia asociada a `--disable-setuid-sandbox`. Ese flag desactiva la ruta del sandbox setuid; su presencia no equivale a `--no-sandbox` y no demuestra por sí sola si el sandbox de namespaces está activo.
- **Avisos de TikTok:** la captura muestra la limitación de visualización para una sesión sin login/su overlay de login y avisos rutinarios del chat del LIVE. Son mensajes de la página, no verificaciones de seguridad del contenedor.
- **STUN/DNS:** se registró anteriormente un aviso de DNS para `stun.l.google.com` (`-105`). Sigue sin resolver y no se oculta.
- **Atribución de `EPERM`:** las pruebas históricas con el perfil predeterminado registraron `Operation not permitted` para probes `unshare` ejecutados como `chromium`. No se obtuvo evidencia de auditoría del host que vincule la syscall y sus argumentos exactos a seccomp, en vez de a la política del kernel o LSM. El éxito posterior con el perfil personalizado no prueba que seccomp fuera la causa exclusiva del fallo inicial.

La evidencia debe leerse separando su origen:

| Evidencia | Alcance |
|---|---|
| Inspección actual de Compose y fuentes | Declara los binds loopback, puertos, proceso Chromium no-root, flags y perfil seccomp configurado. No certifica el estado de un contenedor actual. |
| Verificación de runtime registrada anteriormente en `odd/tasks/harden-tiktok-live-browser.md` | Informó Chromium UID 999, observaciones de namespaces/seccomp, HTTP 200 en ambos puertos y una trama PCM de 9.600 bytes. La prueba headless de `chrome://sandbox` fue inconclusa (`incorrect profile type`); las observaciones de `/proc` se registraron por separado. No se repitieron esas comprobaciones al escribir esta guía. |
| Confirmación manual posterior del usuario mediante captura | Confirma reproducción visible de video y audio y muestra los avisos descritos arriba. No verifica capas de sandbox ni políticas del host. |

El paquete no define un script `npm test`. Esta tarea documental no ejecutó tests, builds ni comandos de Docker; la evidencia de runtime anterior no es una comprobación nueva.

## Qué transfiere a Livefy y qué queda fuera

El brief de Livefy describe el navegador remoto como herramienta para que el operador vea e interactúe manualmente con el LIVE. La lectura y el envío automatizado de mensajes se asignan por separado a un ingestor basado en `tiktok-live-api`, sin controlar Chromium.

| En el brief más amplio de Livefy | En este prototipo |
|---|---|
| Droplet efímero de DigitalOcean por sesión, con creación y destrucción automatizadas | No hay API de DigitalOcean, ciclo de vida de droplet ni apagado automático del LIVE. |
| Dos contenedores: navegador e ingestor | Compose contiene sólo `tiktok-browser`; el ingestor no está implementado aquí. |
| Dashboard, backend, eventos/leads y coordinación de sesión | No hay integración con Convex, dashboard ni flujo de datos de leads. |
| Login manual del operador y visualización/interacción humana | Sí: Chromium abre TikTok y el operador se autentica e interactúa manualmente. El login no se automatiza. |

Tomá el flujo de visualización, la separación entre video y audio y las precauciones de acceso como evidencia del spike, no como especificación de producción. Livefy todavía debe definir el almacenamiento/persistencia de sesión, autenticación del acceso remoto, gestión de credenciales, ciclo de vida del droplet y coordinación segura con el ingestor.

## Fuentes

- [Compose](../prototypes/tiktok-live-browser/docker-compose.yml)
- [Dockerfile](../prototypes/tiktok-live-browser/Dockerfile) y [entrypoint](../prototypes/tiktok-live-browser/entrypoint.sh)
- [Servidor de audio y página combinada](../prototypes/tiktok-live-browser/audio-server.js), [dependencias](../prototypes/tiktok-live-browser/package.json) y [perfil seccomp](../prototypes/tiktok-live-browser/seccomp-chromium.json)
- [Brief de alcance Livefy](livefy-scope-mvp_20260925.md)
- [Registro previo de hardening y runtime](../odd/tasks/harden-tiktok-live-browser.md)
