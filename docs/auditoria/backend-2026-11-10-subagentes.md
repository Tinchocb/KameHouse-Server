# Backend: revisión de cachés, procesos y cierre

Revisión local del 10 de noviembre de 2026, repartida entre tres subagentes y coordinada en el mismo árbol de trabajo. Se conservan los cambios previos y las funciones activas. No se utilizan datos personales ni se reinicia la instancia del usuario.

## Alcance

- Limpieza de cachés con descargas, lecturas y escrituras pendientes: `drive/blockcache`, `util/filecache` y `util/cache`.
- Selección de FFprobe y gestión de procesos: scanner, extracción de información multimedia y detección de segmentos.
- Cierre del servidor: core, eventos, WebSockets y tareas de reproducción.

Los informes de [cachés](backend-2026-11-10-subagente-caches.md), [procesos](backend-2026-11-10-subagente-procesos.md) y [cierre](backend-2026-11-10-subagente-cierre.md) detallan las reproducciones y sus límites. Esta revisión complementa el inventario general y las pasadas anteriores; no implica una nueva validación de servicios o dispositivos reales.

## Correcciones

### Limpieza y descargas de Drive

Se reprodujo que una descarga iniciada antes de `BlockCache.Clear`, todavía esperando cabeceras, volvía a crear metadata y bloques después del borrado. Las generaciones de caché separan las descargas anteriores de las nuevas: el lector activo puede terminar en memoria, pero su resultado no vuelve a persistirse ni lo reutilizan solicitudes nuevas.

### Selección de FFprobe

Construir un segundo sondeador con otro ejecutable podía alterar el primero por el estado global del SDK. Los consumidores scanner, videofile y skipdetect ahora ejecutan FFprobe mediante un helper común con ruta explícita por llamada. Se conservan los modelos, flags y tags usados por el servidor y la API de configuración del default para llamadas sin ruta.

El helper mantiene la ventana oculta en Windows, resuelve shims existentes, espera la salida del proceso, admite cancelación y limita la metadata a 16 MiB. Los errores no incluyen stderr, que puede contener URLs autenticadas. No se atribuye una mejora de rendimiento a este cambio: corrige aislamiento y gestión de recursos.

### WebSockets al apagar

El cierre HTTP no posee las conexiones WebSocket que ya hicieron upgrade. Se reprodujo que quedaba un handler leyendo después de `Cleanup`. El manager ahora tiene cierre idempotente, libera las conexiones fuera de los locks de registro y escritura y rechaza registros tardíos. Core lo cierra antes de esperar otras tareas.

## Validación conjunta

- Suites de cada frente sin caché: pasaron. Las regresiones de limpieza de bloques se repitieron diez veces, incluyendo cuerpo pendiente y lectura de dos bloques.
- `go test -short . ./internal/... ./codegen/... -count=1 -timeout 180s`: pasó en el árbol integrado.
- `go vet . ./internal/... ./codegen/...`: pasó.
- `go build . ./internal/... ./codegen/...`: pasó para Windows y mediante compilación cruzada para Linux; el binario Linux no se ejecutó.
- Integraciones con FFmpeg/FFprobe reales y medios sintéticos: pasaron `TestSettingsRefreshKeepsActiveHLS`, `TestRepeatedSyntheticHLSReleasesResources` y `TestPlaybackStartOverThrottledHTTP`. Cubren conservación de HLS activo, seis ciclos con liberación de procesos/slots/mapas/salida y arranque con HTTP local limitado y audio/vídeo decodificados.
- Codegen se ejecutó dos veces; los SHA-256 de sus cinco archivos quedaron estables. Los tres archivos TypeScript generados son idénticos al inicio de esta pasada: no hubo cambios de contrato compartido ni se repitió el typecheck del frontend.
- `git diff --check` sobre los archivos de esta pasada: pasó.
- Inventario de `internal` actualizado: 58 paquetes, 337 archivos de producción y 300 de pruebas.

Durante la validación del subagente de cierre falló una vez el test existente `TestDriveWindowReadsOnlyTheRequestedPart`: contabilizó 106.816.575 bytes frente al umbral 106.079.908 (90% del fixture). La repetición puntual pasó con aproximadamente 89% y la suite general integrada también pasó. El fixture usa prefetch especulativo y mide sin esperar su finalización, por lo que el contador puede variar con la planificación. No se relajó la aserción ni se considera resuelta la estabilidad de esa medición; queda una incidencia explícita para aislar el contador de la lectura anticipada y comprobar su causa. No se usa ese resultado para atribuir mejoras de rendimiento.

## Límites

Pruebas con archivos temporales, servidores HTTP/WebSocket locales, procesos helper y medios sintéticos. No se valida OAuth/Drive real, biblioteca personal ni dispositivos físicos. El detector de carreras no está disponible con `CGO_ENABLED=0` y sin GCC/Clang instalados; no se instalaron herramientas.

No se eliminaron funciones activas, cambiaron dependencias, hicieron commits/push/despliegues ni se reinició la instancia personal.
