# README de Livefy en español

## Objetivo
Crear el README principal y actualizar la guía de escritorio en español, con instrucciones basadas en los scripts existentes y límites de verificación explícitos.

## Alcance y restricciones
- Archivos: `README.md` y `apps/desktop/README.md`.
- Los textos y mensajes publicados en GitHub deben estar en español por instrucción del usuario; mantener identificadores, comandos y nombres de herramientas.
- No modificar código, dependencias, configuración, secretos ni archivos sin seguimiento ajenos.
- No desplegar ni crear cuentas. El usuario autorizó explícitamente commit y push de esta documentación.
- No enlazar documentos sin seguimiento ni presentar prototipos o planes como capacidades terminadas.

## Tareas
- [x] D1 — Explorar estructura, scripts y estado real. Evidencia: explorador confirmó scripts raíz y desktop; H1.1/H1.2 completadas, interfaz Auth pendiente.
- [x] D2 — Crear README raíz y actualizar README desktop en español. Escritor confirmó lectura completa, comandos contra manifiestos y `git diff --check` correcto.
- [x] D3 — Verificar enlaces relativos, comandos, lenguaje y alcance del diff; registrar resultado. Verificador independiente no encontró discrepancias; enlaces, comandos, español y límites de evidencia correctos. `git diff --check`: exit 0. README nuevo: comprobación no-index sin diagnósticos (exit 1 por diferencia esperada con /dev/null).

## Criterios y comprobaciones
Ambos README deben distinguir objetivos de implementación, enlazarse correctamente, describir Vite y Electron como procesos separados y aclarar que build no crea un instalador. La guía desktop debe conservar detalles de seguridad y Auth sin credenciales, distinguir lanzamiento humano básico Windows de certificación integral y advertir que `smoke-auth-dev.mjs --verify-removed` invoca una referencia de función, no un inventario de solo lectura.

No corresponde RED/GREEN: documentación pasiva sin cambio de comportamiento. Se realizará revisión estructural independiente, sin instalar dependencias ni ejecutar operaciones remotas.

## Progreso y siguiente paso
Escritura y verificación independiente terminadas, limitadas a documentación. Evaluación nativa no disponible por archivos sin seguimiento preexistentes; cubierta por revisión documental independiente sin hallazgos. No se ejecutaron tests, builds, instalaciones ni acciones remotas porque no cambió el comportamiento. Commit documental creado con autorización explícita: `ba96f5a` (`docs: documentar Livefy y escritorio en español`), contiene únicamente ambos README. Este registro se agrega en un commit de cierre separado. Push autorizado de `feat/mvp` pendiente de confirmación remota; ninguna modificación de main. Archivos ajenos preservados.
