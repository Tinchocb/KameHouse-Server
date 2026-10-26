# Ejecución del plan backend — 25/10/2026

Implementados los diez hallazgos del plan en `apps/server/`. Se conservaron los cambios anteriores del checkout. Esta ejecución no cambió frontend, dependencias, lockfiles, ramas ni commits, y no inició el servidor contra la biblioteca real.

## Cambios realizados

| ID | Resultado | Evidencia principal |
|---|---|---|
| D-01 | Eliminado el helper sin consumidores `totalFromContentRange`; se conservan los imports usados por el parser activo. | Compilación y suite de Drive. |
| O-01 | Canales acotados al número de workers; productor concurrente cancelable; sin workers para listas vacías ni más workers que rutas. | Pruebas de drenaje, descartes, ausentes y cancelación; benchmark comparativo. |
| O-02 | Índice `(library_media_id, absolute_number)`, proyección de cuatro columnas y contexto en las tres consultas. Los errores de base/cancelación ya no se reportan como 404. | EXPLAIN sobre el driver real, comprobación de SQL emitido, imagen/fallback y cancelación de cada consulta. |
| R-01 | La longitud del slice de segmentos se captura antes de liberar RLock. | Grow y WaitFor concurrentes con `-race`. |
| R-02 | Cada lectura conserva una generación de caché; las escrituras de estos repositorios publican otra después de guardar. Actualizar mappings invalida ambos alias. | Lectura SQL pausada antes de publicar, escritura concurrente y lectura posterior; escenarios positivos/negativos para PK y TMDB/type. |
| R-03 | Migración transaccional: errores de SQL, JSON inválido, filas inválidas y tablas mixtas conservan el origen; fallo en un lote posterior revierte los anteriores. Se reutiliza el conversor para preservar metadata. | Corrupción, null, filas null, path vacío, fallo de consultas, coexistencia, rollback tras 100 filas, metadata e idempotencia. |
| R-04 | Logger obligatorio; cierre del pool si falla la inicialización; error de esquema devuelto al llamador en lugar de `Fatal`. | Logger nil, contexto cancelado, esquema inválido y liberación del archivo temporal en Windows. |
| R-05 | Las migraciones publican estado terminal y error también después de un panic. | Error de migración real y panic inyectado; ambos liberan los waiters y publican failure. |
| R-06 | Respuestas de mappings limitadas a 1 MiB más un byte de detección; se conserva el cierre del Body. | Límite exacto, exceso, error de lectura y cuerpos inexistentes. |
| R-07 | Contexto de Echo propagado al helper; cada participante puede cancelar su espera de la apertura deduplicada. El trabajo compartido mantiene su plazo propio y publica errores ante panic. | Cancelación del primer llamador, resultado compartido con el segundo, un único open, panic y cancelación anterior al inicio. |

Se añadieron 24 funciones de test en seis archivos, con subcasos adicionales y un benchmark. Se adaptaron dos llamadas de tests existentes a la nueva firma del helper de subtítulos.

## Verificación realizada

Con Go 1.26.6, `GOTOOLCHAIN=local`, `GOPROXY=off`, `GOSUMDB=off` y `GOFLAGS=-mod=readonly`:

- `go test ./... -count=1 -timeout=15m`: PASS, sin `-short`.
- `go vet ./...`: PASS.
- `go build -o <temporal>/kamehouse-server.exe .`: PASS.
- `go test -race ./internal/database/db ./internal/mediastream ./internal/mediastream/cassette ./internal/handlers ./internal/library/scanner -short -count=1 -timeout=15m`: PASS.
- Después de refinar la regresión de caché para usar una lectura SQL real pausada: `go test -race ./internal/database/db -run TestLibraryMedia -count=1 -timeout=90s`: PASS.
- Patch específico de esta ejecución comprobado en reversa con `git apply --reverse --check --ignore-space-change`; sin aplicarlo en reversa.

Las integraciones pueden omitir casos cuando falta su dependencia opcional o fixture; un PASS de la suite no certifica cada combinación de codecs, hardware o archivos reales. No se realizaron migraciones ni pruebas de carga sobre la biblioteca del usuario.

## Memoria del escáner

Benchmark `BenchmarkCreateLocalFilesBufferedPipeline`, fixture de 4.096 rutas sobre un archivo temporal conocido, cinco muestras de tres iteraciones. La comparación anterior usa un overlay del archivo `discovery.go` guardado antes de esta implementación; el resto del benchmark es idéntico.

| Variante | Mediana B/op |
|---|---:|
| Anterior | 3.551.621 |
| Actual | 3.455.042 |
| Reducción | 96.579 bytes, aproximadamente 94,3 KiB / 2,7% |

Los tiempos variaron entre muestras y no permiten afirmar una mejora de latencia. La salida completa sigue ocupando O(N); se reduce la capacidad auxiliar de los canales. Esto mide la fixture descrita, no un escaneo de la biblioteca real.

```powershell
# Desde apps/server, usando el ejecutable Go 1.26.6 y el entorno indicados arriba:
& $goAudit test ./internal/library/scanner -run '^$' -bench '^BenchmarkCreateLocalFilesBufferedPipeline$' -benchmem -benchtime=3x -count=5
```

## Comportamientos que requieren atención al desplegar

- Si `local_files` y `local_file` contienen datos, la migración conserva ambas tablas y devuelve un error de conciliación. No intenta elegir automáticamente qué registros descartar; health informa el fallo de migración.
- La coherencia de R-02 cubre las escrituras de `library_media.go`. SQL ejecutado por fuera de esos repositorios sigue necesitando una política explícita de invalidación.
- Invalidar una generación completa puede causar misses en otras medias después de escribir. Se priorizó corregir la coherencia sin serializar las lecturas; no se midió el efecto en tráfico real.
- Cancelar un cliente de Drive abandona su espera. La apertura compartida continúa, con su plazo de 40 segundos, para no cancelar el trabajo de los demás clientes.

## Archivos y revisión

El [plan original](backend-2026-10-25-plan.md) conserva los bloques de la auditoría como referencia histórica. El [patch de implementación](backend-2026-10-25-implementacion.patch) contiene exclusivamente la diferencia respecto del snapshot del checkout tomado al comenzar esta ejecución; sirve para distinguir este trabajo de los cambios anteriores. El patch de propuesta original se conserva como antecedente y no debe reaplicarse.

