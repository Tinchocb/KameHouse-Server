# Segundo bloque de fiabilidad — 29/10/2026

Implementación de R-04, R-05 y R-06 de la [revisión del backend](backend-2026-10-29-revision.md), sobre el checkout que ya contiene las correcciones prioritarias y el presupuesto automático de recursos. No se reemplazó el ejecutable, reinició la aplicación, migró la base del usuario ni reindexó Drive.

## Pretranscodificación: cancelación y propiedad de trabajos

`apps/server/internal/mediastream/pretranscode/pretranscode.go`:

- Registrar cancelación y admitir el trabajo son ahora una transición bajo el mismo mutex. Un elemento de cola cancelado o reemplazado no puede empezar a codificar.
- `Enqueue` y `Jobs` entregan snapshots, incluida una copia de `EndedAt`. La respuesta HTTP ya no comparte el objeto que actualiza el worker.
- Un trabajo cancelado que todavía limpia sus recursos bloquea la admisión de su reemplazo. `Delete` reserva el identificador, cancela, espera la limpieza, elimina el estado y realiza el borrado confinado del bloque anterior. Mientras tanto, `Enqueue` devuelve un error y permite reintentar después.
- `Stop` es seguro frente a llamadas simultáneas, impide nuevos trabajos y espera a los workers/procesos antes de permitir que el repositorio instale otro gestor. `Start` no revive un gestor detenido.
- Se conserva la cesión de prioridad a reproducción en vivo: una interrupción por el coordinador de recursos vuelve a intentar el mismo trabajo cuando se libera la admisión de fondo.
- La lectura del progreso se cierra al cancelar, aunque otro proceso mantenga abierto stdout. `WaitDelay` de dos segundos acota la espera de pipes heredados en los comandos FFmpeg/FFprobe construidos en este paquete. No se aumentaron los plazos de reproducción ni los treinta segundos de probe.

La exclusión de generaciones se obtiene manteniendo la propiedad del identificador hasta terminar su limpieza y comprobando la identidad del objeto de cola. No se basa en un tiempo de espera estimado.

## Escáner: errores y contexto

`internal/library/scanner/persistence.go`, `scan_phases.go` e `internal/database/db/library_media.go`:

- `persistMatchedMedia` recibe contexto y devuelve `(map[int]uint, error)`.
- Las consultas de medias existentes y de identificadores comprueban errores y usan ese contexto.
- El upsert por lotes propaga contexto a la transacción. Los consumidores existentes conservan `UpsertLibraryMediaBatch`; el escáner usa la variante con contexto.
- Un fallo de consulta, escritura o cancelación detiene la fase antes de publicar asociaciones o registrar persistencia completada.
- Los fetches opcionales de metadata conservan su fallback, pero heredan la cancelación del escaneo.

El lote de escritura es transaccional. Si falla la consulta posterior de identificadores, la metadata del lote puede estar ya guardada: el escaneo informa el error y no modifica las asociaciones locales. No se afirma que todas las fases del escaneo formen una única transacción.

## Cierre del servidor y tareas

`main.go`, `internal/core/{app.go,modules.go,maintenance.go,config_watcher.go}`, `internal/maintenance/scheduler.go` e `internal/library/autoscanner/autoscanner.go`:

- Una limpieza diferida cubre las salidas posteriores a crear la aplicación, incluidos errores retornados de bind, TLS y Serve. Las señales normales y del sidecar usan el mismo recorrido.
- El servidor intenta drenar HTTP; al vencer su contexto, cierra las conexiones restantes antes de pasar a los recursos de la app.
- `Cleanup` ejecuta una sola secuencia, incluso con varios llamadores. El plazo del llamador abarca también la espera del watcher, que antes ocurría fuera de ese límite.
- Las tareas lanzadas desde `core/modules.go` se registran antes de arrancar, rechazan trabajo después del cierre y se esperan antes de cerrar caché/DB.
- Se espera la operación de mantenimiento que ya estaba en curso. El watcher de configuración espera a su callback de recarga; el escáner automático cancela y espera sus timers/escaneos admitidos.
- Los ajustes del escáner se toman como snapshot local bajo mutex para evitar competir con una actualización de configuración.
- Un panic en un callback de limpieza se registra y no impide ejecutar los callbacks siguientes. Se conserva el orden de detener productores, vaciar telemetría, cerrar caché y cerrar base.

El contexto limita cuánto espera el llamador, no termina por la fuerza una goroutine Go bloqueada. Si vence, la secuencia sigue en segundo plano sin adelantar el cierre de la DB a tareas aún activas; en una salida del proceso no hay garantía de flush completo. Se conserva el presupuesto existente de quince segundos para HTTP y cuarenta y cinco para la app.

## Contratos generados

Se regeneraron los manifiestos de `apps/server/codegen/generated` y los tipos web. El único cambio en `apps/web/src/api/generated/types.ts` es el campo opcional `probeVerified`, ya existente en el modelo Go desde la corrección previa de Drive. No se cambió lógica de interfaz. Dos ejecuciones consecutivas del generador produjeron los mismos hashes de salida.

## Verificación

Se añadieron quince funciones de prueba en seis archivos, además de adaptar las dos pruebas previas de persistencia a la firma con contexto.

Casos ejercitados:

- Cancelar antes de admisión, cola obsoleta, borrado durante limpieza, reencolado, varios `Stop` y snapshots mientras avanza el progreso.
- Cesión a reproducción en vivo y reintento posterior, usando el coordinador real con encode controlado.
- Lector de progreso con el escritor todavía abierto al cancelar.
- Fallos SQL inyectados en las dos consultas y en el upsert; cancelación previa y durante el primer lote, con rollback y asociaciones previas conservadas.
- Deadline durante espera del watcher, varias llamadas a `Cleanup`, tareas activas, mantenimiento activo, callback de limpieza con panic y callback de recarga bloqueado.
- Escáner detenido con notificación pendiente y rechazo de escaneos nuevos.
- Servidor HTTP temporal con petición activa que se cierra al vencer el drenaje.

Entorno: Go 1.26.6, `GOTOOLCHAIN=local`, `GOPROXY=off`, `GOSUMDB=off`, `GOFLAGS=-mod=readonly`, `GOMAXPROCS=2`, `-p 1`. Las pruebas usan bases, medios sintéticos y árboles temporales.

Resultados finales:

- Regresiones específicas del bloque: PASS.
- `go test -p 1 ./... -short -count=1 -timeout=8m`: PASS con el conjunto integrado, repetido después del ajuste final de pipes.
- `go test -race -p 1 . ./internal/core ./internal/database/db ./internal/library/scanner ./internal/library/autoscanner ./internal/maintenance ./internal/mediastream/pretranscode ./internal/mediastream/cassette ./internal/util/resourcebudget -short -count=1 -timeout=8m`: PASS. Después de los últimos ajustes se repitieron core/autoscanner, pretranscode y las regresiones de persistencia por separado con `-race`: PASS.
- `go vet -p 1 ./...`: PASS.
- `go build -p 1 ./...`: PASS.
- Codegen: regenerado; hashes de salida estables entre dos ejecuciones consecutivas. El árbol generado conserva cambios esperados respecto de Git, no está limpio por diseño.
- `git diff --check` en servidor, documentación y contratos generados: PASS.

La suite corta conserva los skips de integración que sus propios tests deciden según plataforma/dependencias. En particular, la prueba de symlinks requiere un privilegio ausente en Windows; la regresión de junctions se ejecuta fuera del aislamiento. Un PASS local no certifica todas las combinaciones de hardware, codecs, red o clientes.

## Pendientes conservados

Los puntos O-01 a O-07 y las simplificaciones condicionadas a compatibilidad siguen siendo propuestas; este bloque no los declara implementados. En particular, `Enqueue` todavía puede hacer un probe de una salida ya existente mientras toma el mutex global (O-02). Los resultados locales no certifican reproducción real, consumo de recursos de un catálogo real ni el cierre de todos los manejadores externos que ignoren cancelación. La prueba de aceptación en navegador y KameHouseTV requiere una fase posterior.
