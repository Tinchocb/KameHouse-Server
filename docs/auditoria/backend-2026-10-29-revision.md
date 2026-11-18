# Revisión del backend — 29/10/2026

Estado posterior: R-01, R-02 y R-03 se implementaron y verificaron en el [primer bloque de ejecución](backend-2026-10-29-ejecucion.md). R-04, R-05 y R-06 se implementaron en el [segundo bloque de fiabilidad](backend-2026-10-29-fiabilidad.md). El resto de este documento conserva el diagnóstico y las propuestas de la auditoría previa a esos cambios.

Revisión del árbol de trabajo actual, incluidos sus cambios previos sin confirmar. No se modificó código de producción, configuración, dependencias ni datos de la biblioteca. Se inspeccionaron inventario y referencias de `apps/server`, arranque, rutas, autenticación, salud, almacenamiento, escáner, metadatos, Drive, streaming, pretranscodificación, mantenimiento, utilidades y scripts de verificación/build.

Inventario: 508 archivos Go, de los cuales 189 son archivos de pruebas. Esto describe el alcance inventariado; no significa que cada línea ni cada combinación de ejecución haya sido auditada. Se profundizó en los recorridos que mostraron riesgos concretos. Las recomendaciones se apoyan en código local; no incluyen un análisis actualizado de vulnerabilidades de dependencias.

## Resultado y prioridades

Conviene corregir primero límites de borrado, propiedad de objetos de caché y manejo de fallos. Después, controlar tareas concurrentes y cancelación. Las optimizaciones de CPU/SQL y la limpieza de compatibilidad vienen después. No hay evidencia para proponer una reescritura general, sustituir SQLite o aumentar los timeouts de reproducción.

### R-01 · Alta · Ruta de borrado de pretranscodificación sin validar

**Evidencia:** `apps/server/internal/handlers/pretranscode.go:116-134` toma `:hash` y solo comprueba que no esté vacío. `internal/mediastream/pretranscode/pretranscode.go:145-146,257-264` lo une a `OutputDir` y ejecuta `os.RemoveAll` sin exigir un identificador válido ni comprobar confinamiento.

`OutputDirFor("..")` devuelve el directorio padre de la biblioteca preparada. Con la ubicación predeterminada, ese padre es la caché; con una ubicación personalizada el alcance cambia. No hace falta que exista un trabajo con ese identificador para que `Delete` llegue al borrado.

**Comprobación:** una prueba por overlay invocó únicamente el cálculo de ruta, sin ejecutar borrados. Falló la propiedad de confinamiento. No se probó un ataque HTTP completo: acceso efectivo depende de autenticación, restricciones de escritura y tratamiento del path por cliente/proxy. En ausencia de contraseña, las escrituras de este endpoint están restringidas a loopback.

**Cambio:** validar el hash esperado de 40 caracteres hexadecimales en handler y gestor, rechazar separadores y puntos, comprobar que la ruta absoluta sea descendiente estricta de la raíz y limitar el borrado a ese resultado. Verificar también la política ante enlaces del sistema de archivos.

**Validación:** identificadores válidos, `.`/`..`, separadores Windows/Unix, valores codificados, raíz y directorio hermano; usar exclusivamente árboles temporales y verificar que los marcadores externos sobrevivan.

### R-02 · Alta · Caché de archivos publicada como objetos mutables

**Evidencia:** `internal/database/db/localfiles.go:17-39,90-103` devuelve el slice y los punteros almacenados. `internal/handlers/tmdb.go:224-244` modifica `MediaID`, `LibraryMediaId`, `Locked` e `Ignored` sobre esos objetos antes de guardar. La cola de análisis también modifica los objetos recibidos (`internal/library/scanner/background_queue.go:111-139`).

**Comprobación:** una prueba por overlay publicó un objeto, lo obtuvo por `GetLocalFiles`, lo modificó y volvió a leer. La segunda lectura observó la modificación sin ningún guardado en SQL. La prueba usa memoria, sin biblioteca real. La exposición compartida está reproducida; no se ejecutó una reproducción de carrera concurrente con `-race` en esta revisión.

**Consecuencias:** lectores pueden observar cambios aún no persistidos; un error al guardar no restaura el snapshot; lectores y escritores concurrentes pueden competir. Además, la caché y el singleflight son globales al paquete: no están asociados a una instancia de `Database`.

**Cambio:** snapshots inmutables por instancia y copias profundas antes de editar, incluidos metadata, slices y punteros anidados. Preferir operaciones de actualización específicas para no clonar todo el catálogo en cada lectura. Mantener la protección por generaciones ya existente.

**Validación:** mutación de copia, fallo de SQL, dos bases independientes, lectura concurrente y guardado/cancelación bajo `-race`.

### R-03 · Alta · Panic al reintentar descargas de FFmpeg

**Evidencia:** `internal/util/ffmpegutil/downloader.go:265-269` usa `zerolog.DefaultContextLogger.With()` al segundo intento. No hay una asignación a ese logger global en el servidor. El logger de la aplicación se construye por otra vía.

**Comprobación:** la suite aislada llegó a un panic en la línea 267 después de un fallo de conexión. Se confirmó con un transporte HTTP simulado que siempre devuelve error: al segundo intento aparece el mismo nil dereference, sin usar red. La suite normal pasa porque sus respuestas exitosas no recorren esa condición.

**Cambio:** propagar el logger ya recibido por `downloadAndExtractSpec`, o usar un logger seguro obtenido del contexto. El reintento debe terminar con un error normal cuando no haya conexión.

**Validación:** primer fallo seguido de éxito, errores persistentes, cancelación durante backoff y logger ausente. Inyectar reloj/backoff para que la regresión no requiera esperar segundos.

### R-04 · Media · Estado y cancelación de trabajos de pretranscodificación

**Evidencia estática:** `internal/mediastream/pretranscode/pretranscode.go:174-218,222-264,267-308,721-747`.

- `Enqueue` devuelve el puntero interno del trabajo; el worker actualiza ese mismo objeto mientras el handler puede serializarlo. `Jobs` ya copia los trabajos, pero `Enqueue` no.
- El worker comprueba `StatusQueued` antes de registrar la cancelación. Una cancelación que cae en ese intervalo puede marcar el trabajo cancelado y, aun así, dejar que `run` lo inicie.
- `Delete` cancela y elimina sin esperar la salida del proceso. Si se vuelve a encolar el mismo archivo, una ejecución anterior puede seguir limpiando el mismo directorio o actualizando el nuevo trabajo porque `finish` busca por hash.
- `Stop` usa comprobar-canal-y-cerrar sin `sync.Once` y no espera a los workers. Dos llamadas concurrentes pueden competir al cerrar. El reemplazo del gestor no garantiza que sus procesos hayan finalizado antes de iniciar el siguiente.

**Cambio:** estado de cada ejecución con identificador/generación, transición atómica de queued a running, snapshots para respuestas, cancelación registrada junto con la transición y una espera acotada de terminación. Hacer `Stop` idempotente bajo concurrencia.

**Validación:** coordinar esos intervalos con barreras de prueba, borrar/reencolar la misma fuente y reemplazar gestor durante codificación. Confirmar con `-race` y FFmpeg sintético. Son riesgos identificados por lectura; no se atribuye un incidente real a estas intercalaciones.

### R-05 · Media · Persistencia del escáner oculta errores

**Evidencia:** `internal/library/scanner/persistence.go:19,57,255-276,310` realiza consultas sin comprobar `.Error`, registra un fallo de upsert y devuelve únicamente un mapa. `internal/library/scanner/scan_phases.go:376-385` continúa y registra la fase como completada.

**Cambio:** devolver `(map[int]uint, error)`, comprobar consultas y propagar el fallo a la fase. Usar el contexto del escaneo también en estas operaciones y en los fetches de metadata que actualmente nacen de `context.Background()`.

**Validación:** error de lectura, fallo del lote y cancelación entre lotes. El escaneo debe informar error y conservar asociaciones previas, sin publicar un éxito parcial como completo.

### R-06 · Media · Cierre incompleto en salidas por error

**Evidencia:** `apps/server/main.go:70-80,152-183` crea servicios antes de escuchar. Si falla el bind o llega un error por `errCh`, retorna sin `app.Cleanup`; las dos ramas de cierre normal duplican el procedimiento. Si `Shutdown` agota su tiempo, se registra el error pero no se fuerza el cierre HTTP antes de cerrar recursos.

`internal/core/app.go:435-484` llama a la detención del watcher/config antes del bloque gobernado por el timeout; un bloqueo ahí puede exceder el plazo. El mantenimiento recibe cancelación, pero su scheduler no ofrece una espera de finalización (`internal/maintenance/scheduler.go:37-81`) y varios jobs no propagan contexto a sus operaciones SQL.

**Cambio:** una ruta de cierre única, ejecutada también ante errores después de inicializar; asegurar cierre HTTP al agotar drenaje; detener y esperar productores antes de cerrar caché/DB, con presupuesto de tiempo en todas las fases.

**Validación:** bind ocupado, fallo TLS, servidor con petición activa, job de mantenimiento en curso, detención repetida y deadline vencido. No reiniciar la aplicación real para probarlo.

## Optimizaciones con evidencia de estructura, pendientes de medición

### O-01 · Concurrencia del matcher

`internal/util/parallel/parallel.go:9-23` crea una goroutine por elemento. `internal/library/scanner/matcher.go:36-43` lo usa para todos los archivos; cada uno puede recorrer el catálogo de candidatos (`matcher.go:103` en adelante).

Usar workers acotados, cancelación y un índice de candidatos por señales fuertes antes del scoring difuso. Medir con catálogos sintéticos crecientes: duración, allocations, pico de goroutines y resultados de matching idénticos. El coste estructural existe; no se midió aquí una mejora ni se concluye que cause los bloqueos de reproducción.

### O-02 · Evitar I/O bajo el lock global de trabajos

`internal/mediastream/pretranscode/pretranscode.go:184-204` mantiene `m.mu` mientras ejecuta `probeStreams`, cuyo plazo es 30 segundos. Durante ese tiempo puede bloquear listado, actualizaciones de progreso y operaciones que requieren el mismo lock.

Reservar estado bajo lock, hacer probe fuera de él y verificar generación al publicar. Propagar un contexto explícito. No subir el timeout.

### O-03 · Asignación manual TMDB más pequeña y transaccional

`internal/handlers/tmdb.go:218-247` carga todos los archivos, realiza una búsqueda lineal por cada path y vuelve a guardar el catálogo recibido. El coste de búsqueda es O(paths seleccionados × archivos del catálogo).

Consultar/actualizar solo los paths seleccionados y guardar la asignación con una transacción junto al registro de media cuando corresponda. Esto también reduce el alcance de escrituras concurrentes. Medir filas afectadas y SQL; verificar asignaciones existentes, rutas ausentes y rollback.

### O-04 · Reutilizar clientes y conexiones de metadatos

`internal/handlers/anime_enrichment.go:26-47` construye providers; `internal/library/metadata/tmdb_provider.go:25-33` crea un cliente, y `internal/api/tmdb/tmdb.go:46-56` crea otro transporte HTTP. `internal/handlers/health.go:289` construye un cliente por chequeo. `internal/util/http/client.go:34-64` confirma que cada cliente crea su propio transporte.

Reutilizar cliente/transporte por configuración de credenciales e idioma. El constructor `NewTMDBProviderWithClient` ya permite inyección. No fusionar sin más `library/metadata` y `api/metadata_provider`: ambos tienen consumidores y responsabilidades diferentes. Medir conexiones y hits antes/después.

### O-05 · Health operativo separado de dependencias opcionales

`internal/handlers/health.go:112-116,145-148,250-329` convierte una caída de TMDB en estado global `down` y HTTP 503. Si un supervisor usa ese endpoint para decidir disponibilidad, puede tratar como caído un servidor que todavía reproduce contenido local.

Definir liveness, readiness local y diagnóstico de proveedores. Mantener el detalle de TMDB sin bloquear la disponibilidad básica cuando sea opcional. Reutilizar transporte. Los snapshots de health también son globales al paquete; conviene asociarlos a la app.

### O-06 · Acotar cuerpos de error de Drive

`internal/drive/client.go:320,380,444,457,545` lee cuerpos mediante `io.ReadAll` sin límite. Aunque los endpoints habituales son de Google, un error/proxy puede entregar una respuesta mucho mayor que el diagnóstico necesario.

Usar lectura limitada con indicador de truncamiento y conservar cierre y cancelación. Verificar cuerpos grandes y clasificación de errores 403/429/5xx. No se observó aquí un OOM causado por esos cuerpos.

### O-07 · Estado de trabajos terminados

`internal/mediastream/pretranscode/pretranscode.go:79,187-201,241-251` conserva trabajos completados/fallidos en memoria y devuelve la colección completa; no se encontró retención temporal o paginación en ese gestor.

Definir retención de historial y listado paginado para servidores de larga duración. Mantener los archivos preparados como biblioteca explícita, con política separada del historial de tareas. Medir antes de fijar un límite; no borrar medios preparados por un TTL genérico.

## Qué eliminar o simplificar

### D-01 · Opción Systray y target sin comportamiento actual

La búsqueda en el repositorio encontró `Server.Systray` solo en `internal/core/config.go:25`, un comentario de `config_watcher.go:121` y salida generada. `apps/server/Makefile:65-68` anuncia un build `nosystray`, pero no se encontraron archivos Go con build tags o código de systray que cambien con esa etiqueta.

La receta `build-server-nosystray` usa flags de enlazado distintos en Windows: aunque la etiqueta no selecciona código, no es un duplicado exacto del build normal. Simplificar su nombre/etiqueta conservando esa diferencia de compilación cuando sea necesaria. Retirar o deprecar la opción sin efecto si hay configuraciones externas que convenga seguir aceptando. Regenerar contratos si se retira del struct; no editar los JSON generados a mano. El ahorro principal es claridad, no rendimiento.

### D-02 · Duplicación del cierre

Eliminar los dos bloques casi iguales de `main.go:154-183` al implementar R-06. Una sola ruta reduce divergencias futuras entre cierre por señal del sistema y cierre del sidecar.

### D-03 · Compatibilidad residual tvMode, retiro condicionado

`internal/database/models/models.go:77` y `internal/handlers/settings.go:354-355` todavía conservan `TvMode`. En el frontend actual las referencias encontradas fuera de generados corresponden a limpieza de estado antiguo y sus pruebas.

Es un candidato para retirar del contrato activo cuando se verifiquen los consumidores de KameHouseTV y clientes externos. Mantener Maratón. No eliminar columnas o contratos de servidor solo por la ausencia del control web; una migración puede aceptar/ignorar la clave antigua durante la transición.

### D-04 · Reducir superficies de build y verificación que divergen

`apps/server/Makefile` mezcla recetas POSIX y ramas de PowerShell; existe además `scripts/build-server.mjs`. El Makefile anuncia `SERVER_PORT` pero `dev` solo pasa `--datadir` (`Makefile:90-93`).

Elegir un flujo canónico multiplataforma y dejar wrappers pequeños. `scripts/verify.mjs` actualmente omite Go si no lo encuentra y puede terminar con verify OK; para una verificación obligatoria, esa ausencia debe fallar o declararse como resultado incompleto. Sus comandos Go no incluyen el paquete raíz y su conjunto habitual de race no cubre todos los subsistemas críticos de Drive/DB/cassette.

No se identificó una lista de paquetes completos que sea seguro borrar. Se comprobaron consumidores de utilidades, providers y parsers antes de proponer eliminación: varias abstracciones aparentemente antiguas siguen usadas. No eliminar pruebas porque aparezcan fallos del entorno.

## Verificación realizada y límites

1. `go vet ./...`: PASS con Go 1.26.6, módulos readonly y resolución de módulos offline.
2. `go test ./... -short -count=1 -timeout=8m` en aislamiento: compiló y ejecutó paquetes; hubo fallos de sockets loopback bloqueados, descarga de fpcalc sin DNS y el panic real de R-03 durante un reintento. No equivale a un fallo general del producto.
3. Reejecución de `go test ./... -short -count=1 -timeout=5m` fuera del aislamiento: pasaron los paquetes de pruebas salvo `core`, cuyo linker falló por falta de memoria. Reejecución individual de `core` con `-p 1`, `GOMAXPROCS=2`: PASS. Esto es validación en ejecuciones separadas; no se presenta como una única suite íntegramente verde.
4. Tres pruebas adicionales por overlay demostraron fallos esperados de las propiedades que se busca exigir: confinamiento del path, independencia de objetos de caché y devolución de error sin panic en reintento. Se conservaron sus fuentes fuera del código productivo, en la carpeta `backend-audit` de visualizaciones de esta conversación.

No se ejecutó `-race` nuevo, una carga de catálogo real, despliegue, reindexado Drive, migración sobre la base del usuario ni reproducción real navegador/TV. Los resultados históricos de auditorías anteriores no sustituyen esas validaciones. No hay cifras de ahorro de CPU, latencia o memoria medidas para las propuestas nuevas.

Las pruebas multimedia existentes pueden provisionar herramientas en cachés de prueba. Conviene separar tests deterministas offline de integraciones que descargan fpcalc o requieren FFmpeg: por ejemplo, `internal/skipdetect/fpcalc_test.go:34-42` descarga si falta el binario incluso al ejecutar la suite corta. Declarar dependencias previamente instaladas en CI y marcar las integraciones evita que un equipo sin red parezca tener regresiones funcionales.

## Orden de implementación propuesto

1. R-01, R-02 y R-03, cada uno con su regresión mínima.
2. R-04 y R-05: transiciones de trabajos y propagación de fallos del escáner.
3. R-06 y O-05: cierre y disponibilidad operativa.
4. O-01 a O-04: medir fixtures representativas y aplicar optimizaciones con resultados comparables.
5. O-06/O-07 y D-01 a D-04: límites de recursos y simplificación, con compatibilidad explícita.

Aplicar cambios pequeños y revisar el diff de cada bloque. Mantener las correcciones actuales de streaming/Drive y los contratos consumidos por KameHouseTV. La reproducción real sigue siendo una fase de aceptación separada de las pruebas locales.
