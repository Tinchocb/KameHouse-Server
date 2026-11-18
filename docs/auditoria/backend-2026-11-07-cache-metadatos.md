# Backend: caché caliente y aislamiento de metadata de vídeo — 2026-11-07

Continuación del pulido del backend. Se preservaron los cambios locales previos. Sin despliegue, reinicio de instancia real, cambios de datos del usuario, commit ni push.

## Jikan: evitar trabajo cuando la caché ya tiene el resultado

`internal/api/metadata_provider/jikan_impl.go` creaba una goroutine productora y un temporizador incluso cuando los metadatos ya estaban disponibles en memoria. La consulta interna encontraba el valor cacheado, pero el consumidor había pagado toda la coordinación de un fallo de caché.

Ahora comprueba esa caché bajo el mismo mutex antes de crear trabajo compartido. Se conservan la prioridad del estado de caída/fallo reciente, el vencimiento, la consulta persistente y la ruta singleflight/espera inline para datos que aún faltan.

`BenchmarkJikanMemoryHit` mide exactamente esa lectura caliente, sin base de datos ni red, en Windows amd64 / Ryzen 5 5600G:

| Corrida | Antes | Después |
| --- | ---: | ---: |
| 1 | 1.987 ns, 456 B, 6 asignaciones | 19,49 ns, 0 B, 0 asignaciones |
| 2 | 2.515 ns, 456 B, 6 asignaciones | 19,51 ns, 0 B, 0 asignaciones |
| 3 | 2.910 ns, 456 B, 6 asignaciones | 20,01 ns, 0 B, 0 asignaciones |

El punto es eliminar goroutines, timers y asignaciones evitables en cada hit. Es un microbenchmark del proveedor: no significa que una pantalla completa ni la red sean cien veces más rápidas, ni modifica la espera de Jikan con caché fría.

## MediaInfo: impedir contaminación de la caché entre consumidores

`MediaInfoExtractor.GetInfoContext` devolvía el mismo puntero cacheado y el mismo resultado de probe a varios consumidores. Además, la reparación de MIME HEVC heredado escribía sobre ese objeto compartido. Los slices y punteros anidados podían quedar modificados para la siguiente lectura.

La regresión `TestExtractorReturnsOwnedInfo` falló antes del cambio: modificar la primera respuesta alteraba el resultado de la segunda. Ahora el extractor devuelve una copia propia de cada resultado, tanto desde caché como desde el probe compartido. Copia las pistas, punteros de texto, capítulos y fuentes; conserva la relación del vídeo seleccionado con su elemento en `Videos` cuando existía, y la diferencia entre slices nil y vacíos.

La reparación del MIME se aplica a la copia del consumidor. El objeto cacheado permanece inmutable. No se obliga a ejecutar ffprobe otra vez y se conservan singleflight, cancelación individual y cierre del extractor, que ya existían antes de esta tanda.

Se corrigió también otro fallo reproducido: una entrada `null` del bucket devolvía `(nil, nil)` como si contuviera información de vídeo válida. Ahora se considera un miss y se vuelve a consultar mediante el probe compartido.

### Coste de aislamiento

Una primera copia segura con una asignación por puntero necesitaba 60 asignaciones en la fixture. Se agruparon los textos copiados en un único array privado para reducir ese coste sin volver a compartir memoria mutable.

Fixture: un vídeo seleccionado dentro de `Videos`, seis audios, ocho subtítulos, dos fuentes y veinte capítulos. `BenchmarkOwnedMediaInfoCopy`:

- Copia inicial: 1,601 / 2,187 / 2,594 µs; 3.072 B y 60 asignaciones por copia.
- Copia agrupada final: 0,847 / 1,057 / 1,011 µs; 3.232 B y 7 asignaciones por copia.

La copia final asigna ligeramente más bytes en esa fixture por capacidad/clase de asignación del array, pero muchos menos objetos. Comparada con devolver un puntero compartido, la copia añade trabajo: es un coste explícito de aislamiento y estabilidad, no una aceleración del hit de MediaInfo. El benchmark no incluye búsqueda de caché, hashing de ruta, reparación de MIME ni coste de ffprobe.

## Verificación

- Lectura caliente de Jikan sin activar el productor; conservación del vencimiento y de la prioridad de caída.
- Cambios del primer consumidor no afectan a la siguiente lectura de MediaInfo.
- Dieciséis consumidores concurrentes comparten un solo probe y reciben copias independientes; la reparación HEVC no modifica el objeto del productor.
- Vídeo seleccionado, vídeo independiente, slices nil/vacíos y entrada nula de caché.
- Casos focalizados repetidos 20 veces con `-cpu=1,4,12`: 60 ejecuciones por caso, aprobadas.
- Tres pruebas con FFmpeg/ffprobe reales y un MP4 sintético de dos segundos: modificar el resultado no contamina la segunda lectura y solo se ejecuta un probe.
- Suite corta completa, `go vet ./...` y `go build -buildvcs=false ./...` comprobados con los cambios finales.

`-race` continúa pendiente por falta de compilador C/CGO disponible; las pruebas concurrentes no sustituyen ese detector. No se ejecutó una reproducción Drive/Tauri del usuario ni se atribuye a esta tanda una mejora nueva del primer fotograma.

Comandos desde `apps/server`:

```powershell
& 'C:/Program Files/Go/bin/go.exe' test ./internal/api/metadata_provider -run '^$' -bench '^BenchmarkJikanMemoryHit$' -benchmem -count=3
& 'C:/Program Files/Go/bin/go.exe' test ./internal/mediastream/videofile -run '^$' -bench '^BenchmarkOwnedMediaInfoCopy$' -benchmem -count=3
& 'C:/Program Files/Go/bin/go.exe' test ./internal/mediastream/videofile -run '^TestExtractorRealProbeCacheIsolation$' -v -count=3
& 'C:/Program Files/Go/bin/go.exe' test ./internal/mediastream/videofile ./internal/api/metadata_provider -run 'Test(ExtractorReturnsOwnedInfo|ExtractorIgnoresNullCachedInfo|SharedProbeInfo|OwnedInfo|JikanMemoryHit)' -count=20 '-cpu=1,4,12'
```
