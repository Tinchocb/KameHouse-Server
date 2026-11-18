# Frente 6/7: SQLite y reconstrucción de biblioteca grande — 2026-11-07

Intervención focal en `local_file_relational.go` y su nueva prueba/benchmark. Se preservó el árbol compartido. Solo se utilizaron bases temporales sintéticas: no se abrió ni alteró la base del usuario. Sin despliegue, reinicio real, commit ni push.

## Hallazgo y cambio

Las dos lecturas relacionales que construyen `dto.LocalFile` usaban `SELECT *`. GORM escaneaba y convertía `CreatedAt`, `UpdatedAt` y `Tags`, aunque `LocalFileModelToDto` no utiliza esos tres campos. En 50.000 archivos eso agrega trabajo de parseo, conversión y asignación de memoria antes de obtener el snapshot de biblioteca.

Se incorporó una proyección explícita de **16 columnas**: identidad de fila y los quince campos consumidos por el DTO. Se conserva toda la información JSON de parsing, carpetas, metadata embebida, metadata de episodio e información técnica, junto con hash, tamaño, mtime, Drive ID, asociaciones y flags.

La proyección se usa en `GetAllLocalFilesRelational` y `GetLocalFilesByMediaIDRelational`. La lectura completa mantiene `ORDER BY id ASC`; la filtrada mantiene su condición y comportamiento de orden anterior. `LocalFile` no tiene un hook AfterFind que utilice los campos omitidos. No se añadieron índices, cambios de esquema, PRAGMA de producción ni transacciones nuevas.

Esto reduce trabajo de la reconstrucción relacional; no cambia las lecturas del snapshot ya caliente ni elimina el coste de decodificar JSON que sí necesita la aplicación.

## Fixture y comparación

`BenchmarkLargeLocalFilesProjection` prepara una base SQLite temporal en WAL, synchronous NORMAL, con statement cache y cuatro conexiones máximas. Tiene 50.000 filas en `local_file`, 500 IDs de media y 100 archivos por ID, con timestamps, flags, cuatro tags y todos los payloads JSON. Es una fixture de la tabla de archivos; no contiene 500 fichas reales enriquecidas de LibraryMedia ni archivos de vídeo del usuario.

Se comparan en la misma fixture:

- Referencia: consulta de todas las columnas y conversión `LocalFileModelToDto`, como la ruta anterior.
- Proyección: función productiva actual `GetAllLocalFilesRelational`.

La preparación/DDL/inserción queda fuera del reloj. SQLite y el filesystem pueden tener páginas calientes tras la preparación; esto **no mide disco completamente frío ni una apertura HTTP completa**. Otros agentes podían ejecutar verificaciones y las duraciones variaron. Cada muestra hace una reconstrucción completa (`-benchtime=1x`), con tres muestras por caso.

| Muestra | SELECT de todas las columnas | Proyección productiva |
| --- | ---: | ---: |
| 1 | 621,480 ms | 638,368 ms |
| 2 | 788,399 ms | 619,107 ms |
| 3 | 686,712 ms | 562,957 ms |

Medianas observadas: **686,7 → 619,1 ms**, alrededor de un 10% menos. Los rangos se solapan y una muestra fue más lenta, por lo que no se presenta como una aceleración garantizada de tiempo real.

El resultado de asignaciones es más estable:

| Mediana por reconstrucción | Referencia | Proyección |
| --- | ---: | ---: |
| Bytes asignados Go | 232.291.272 | 201.469.608 |
| Asignaciones | 5.287.575 | 4.087.530 |

Son aproximadamente **30,8 MB menos asignados (−13%)** y **1,2 millones menos objetos (−23%)** por reconstrucción de esa fixture. No son mediciones de RSS del servidor ni bytes físicos evitados de lectura de disco: SQLite sigue leyendo las páginas que contienen las filas.

## Índices, escrituras y cancelación

La consulta filtrada sobre los 50.000 registros produjo:

```text
SEARCH local_file USING INDEX idx_local_file_media_id (media_id=?)
```

La consulta por media ya usa un índice existente; no hubo evidencia que justificara otro índice. Para recuperar toda la biblioteca el recorrido de todas las filas sigue siendo necesario.

Se mantuvo abierto un cursor real de lectura sobre las 50.000 filas y se realizó una actualización pequeña de una fila desde otra conexión. Aprobó en WAL: las observaciones fueron de unos **14,7–17,7 ms**, incluyendo la obtención/apertura de la otra conexión, sin esperar a cerrar el cursor lector. No se midió latencia del endpoint de progreso del usuario ni se comparó throughput de escrituras completas.

La corrección no agrupa escrituras ni extiende una transacción de escritura. Se evitó introducir un intercambio de mayor throughput por un lock de escritura más largo.

Las dos funciones mantienen la cancelación cuando reciben un handle GORM ya asociado a un contexto cancelado. La prueba verifica `context.Canceled`; no agrega propagación de contexto a los callers que antes no la tenían.

## Equivalencia y límites de datos

- Comparación exacta del DTO producido por SELECT completo y por proyección con filas completas y payloads JSON SQL NULL.
- Comparación del contenido de la lectura por media con el mismo conjunto esperado.
- Orden global de filas conservado.
- JSON inválido guardado como `[]byte`/BLOB conserva el fallback escalar y no elimina la fila.
- Se detectó una limitación **preexistente** fuera de esta optimización: al forzar un payload JSON a SQL TEXT mediante un `string`, el stack actual puede fallar en `database/sql`/GORM con `unsupported Scan ... string into *jsontext.Value`, antes de llegar a la conversión y su fallback. Las escrituras actuales de DTO almacenan `[]byte`. No se cambió esa semántica ni se afirma tolerancia a todos los tipos de corrupción heredada.

## Verificación focal

Los tests de proyección/equivalencia, plan/WAL y cancelación aprobaron. Se ejecutaron además las regresiones focales de LocalFiles/sync y vet de `database/db`. La validación global queda a cargo del frente 7.

Desde `apps/server`:

```powershell
& 'C:/Program Files/Go/bin/go.exe' test ./internal/database/db -run '^TestLocalFilesProjectionPreservesCompleteDTO$' -bench '^BenchmarkLargeLocalFilesProjection$' -benchmem -benchtime=1x -count=3
& 'C:/Program Files/Go/bin/go.exe' test ./internal/database/db -run 'Test(LocalFilesProjection|LargeSQLiteProjection|ProjectedLocalFiles)' -v -count=1
& 'C:/Program Files/Go/bin/go.exe' test ./internal/database/db -run 'Test(LocalFiles|LocalFile|Sync|Partial|Projected|LargeSQLite)' -count=1
& 'C:/Program Files/Go/bin/go.exe' vet ./internal/database/db
```

Los números de la tabla provienen de la comparación final de referencia y función productiva; el primer experimento manual también mostró menos asignaciones, pero no se mezcló con esas medianas.
