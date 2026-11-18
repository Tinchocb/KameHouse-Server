# Backend: rendimiento y preparación de reproducción — 2026-11-06

Trabajo sobre el árbol local existente, rama `version-2.0`. Este informe describe solo esta intervención; el diff contra HEAD incluye trabajo previo. No se revirtieron cambios, no se abrió la base de datos del usuario ni se inició/reinició la instancia real. Sin despliegue, commit ni push.

## Cambios implementados

### Cachés persistentes

`internal/util/filecache/filecache.go` conserva cada valor del archivo como JSON hasta que un consumidor pide su tipo concreto. Antes, abrir un bucket decodificaba todos sus valores a árboles de mapas, slices e interfaces, aunque solo se solicitara una entrada. Luego volvía a codificar la entrada solicitada para convertirla al tipo final.

La nueva ruta evita esa decodificación anticipada y la recodificación intermedia. Mantiene el formato del archivo, TTL, hidratación posterior en memoria y escritura de entradas que todavía no fueron consultadas. También evita redondear enteros grandes mediante `float64`. Se comprueban valores superiores a 2^53, reapertura, escritura de una mezcla de valores hidratados y pendientes, expiración y campos de valor ausentes.

Cada bucket ahora sincroniza su carga con `sync.Once`: publicar su handle antes de leer disco ya no permite que otro lector observe un bucket vacío ni que un escritor compita con la carga inicial. Otros buckets conservan independencia; un error de apertura permite reintentar con un handle nuevo.

### Consultas de archivos por serie

`internal/database/db/localfiles.go` incorpora un índice por MediaID a cada generación inmutable del snapshot. Las consultas repetidas copian únicamente los archivos de la serie solicitada. Antes recorrían toda la biblioteca en cada llamada.

Se conservan orden, copia profunda entregada al consumidor, resultado nil cuando no hay coincidencias, aislamiento entre bases de datos e invalidación por generación. La consulta SQL cuando el snapshot está frío no cambia. No se modificaron esquema, índices SQLite ni datos persistidos.

El índice se construye en la primera consulta por MediaID de cada generación. Tiene un coste inicial y memoria adicional proporcional al número de archivos; no es una mejora gratuita para una generación que solo se consulta una vez.

### Preparación de pretranscodificación

`internal/mediastream/pretranscode/pretranscode.go` obtiene duración, dimensiones, pistas, idiomas, títulos y pista predeterminada en una sola ejecución de ffprobe, solicitando solo esos campos. Antes ejecutaba un probe de duración (o consultaba el extractor compartido) y después ejecutaba otro de pistas obligatoriamente. Se retiraron los helpers de duración y el cableado de `Options.Extractor`, ya innecesarios. El extractor de reproducción y su caché permanecen activos.

La comparación de procesos aplica al camino anterior sin duración ya cacheada. Si el extractor compartido ya tenía la duración, el ahorro de un proceso adicional no aplica; aun así ahora la duración llega de la consulta de pistas que siempre era necesaria.

También se corrigió un fallo reproducido con el FFmpeg 9.0.2 instalado en Windows: las salidas HLS con `%v` y rutas absolutas fallaban al escribir la cabecera con `Permission denied`, incluso en un temporal escribible. Crear previamente los subdirectorios y convertir separadores no solucionaba el fallo. Ejecutar FFmpeg dentro del staging privado, con salidas relativas, sí lo resolvió. Se resuelven las rutas locales de entrada y del ejecutable para conservar su significado al cambiar el directorio de trabajo. La publicación continúa siendo mediante staging y rename al completar.

Las pruebas reales que fallaban al comenzar (`TestPreTranscodeEndToEnd` y `TestPreTranscodeKeepsEveryAudioTrack`) ahora pasan; verifican playlists VOD, segmentos legibles por ffprobe y conservación de tres pistas de audio.

## Medición reproducible

Windows amd64, Go 1.26.6, AMD Ryzen 5 5600G. Tres corridas por caso, valores de la mediana. Fixtures sintéticas: bucket de 2.000 entradas; biblioteca en memoria de 50.000 archivos, 100 por serie; vídeo local de ocho segundos generado con FFmpeg.

| Operación | Referencia anterior | Implementación nueva | Relación aproximada |
| --- | ---: | ---: | ---: |
| Abrir bucket y leer una entrada | 2,497 ms | 1,588 ms | 1,57× más rápido |
| Consultar una serie, snapshot caliente | 97,020 µs | 17,106 µs | 5,67× más rápido |
| Preparar datos para pretranscode, duración sin caché | 103,201 ms | 50,821 ms | 2,03× más rápido |

Bucket: aproximadamente 1.939.373 → 1.378.212 bytes asignados por operación (−29%); 52.063 → 18.061 asignaciones (−65%). Son asignaciones Go, no medición del RSS de todo el servidor.

Construir el índice y consultar por primera vez cuesta una mediana de 1,270 ms y aproximadamente 1,19 MB asignados en esa fixture de 50.000 archivos. Los 17 µs corresponden al índice ya construido. No se presentan como tiempo de la primera carga de una pantalla.

Las referencias se conservan dentro de los benchmarks: decodificación anticipada y conversión JSON anterior; recorrido completo con copias profundas; dos procesos ffprobe frente a uno. La referencia de probes usa la consulta nueva de pistas para aislar el coste del proceso extra. La referencia de lectura del bucket reproduce su decodificación y conversión anteriores, sin todo el envoltorio de sincronización del cacher. Estas comparaciones son microbenchmarks del trabajo indicado, no pruebas HTTP extremo a extremo.

La primera medición, simultánea a compilación/pruebas, fue mucho más variable. Se descartó para calcular estas relaciones; la tabla usa las comparaciones posteriores ejecutadas sin las otras verificaciones Go en paralelo.

```powershell
Set-Location E:/Proyectos_personales/KameHouse/apps/server
& 'C:/Program Files/Go/bin/go.exe' test ./internal/util/filecache ./internal/database/db ./internal/mediastream/pretranscode -run '^$' -bench 'Benchmark(PersistentBucketLoad|LocalFilesByMediaID|PretranscodeProbe)$' -benchmem -count=3
```

## Revisión de las demás rutas

- Arranque: se revisaron inicialización de core, base de datos y módulos. Las migraciones de datos y detección/descarga de FFmpeg ya están fuera del camino síncrono principal. Se conserva el DDL síncrono necesario para abrir rutas con esquema válido. No se midió el arranque completo de la instalación real ni se atribuye una reducción global de arranque a este trabajo.
- API/biblioteca: la colección ya utiliza ETag, caché y singleflight; la hidratación principal ya precarga LibraryMedia y progreso por lotes. Se conserva ese comportamiento. La mejora implementada aquí afecta al acceso por serie al snapshot y a los consumidores de cachés persistentes, no demuestra una aceleración de todas las rutas HTTP.
- Drive: cliente OAuth con timeout, listados concurrentes, rangos acotados y caché de bloques ya existen. La validación del tamaño de bloques se ejecuta en background una vez por archivo. No se redujeron validaciones ni se amplió la vigencia de metadatos para fabricar hits. No se midió Google Drive real.
- Reproducción/probe: se conserva singleflight del extractor y sus límites/cancelación. Se revisó preparación del contenedor, caché de información y calentado. La decodificación diferida beneficia la primera apertura de sus buckets; no elimina un probe necesario cuando falta información.
- Transcode: se corrigió la producción de HLS pretranscodificado y el probe redundante descritos arriba. No se cambió calidad, codec, duración de segmentos ni selección de hardware.
- Subtítulos y miniaturas: se revisaron extracción Drive, trabajos compartidos, cachés y límites de concurrencia de miniaturas. No se hicieron cambios adicionales sin una mejora demostrada. Una extracción pendiente, lectura de rangos remotos o generación de una imagen sigue necesitando trabajo real.

## Verificación y límites

- Suite corta completa: `go test -short . ./internal/... ./codegen/...`, aprobada tras las correcciones de FFmpeg.
- `go vet ./...`, aprobado.
- `go build -buildvcs=false ./...`, aprobado. El build normal encuentra el problema de ownership Git del checkout; no se cambió la configuración global de Git.
- Nuevas regresiones de caché e índice repetidas 20 veces con `-cpu=1,4,12`, aprobadas. Cubren concurrencia, copias profundas, renovación de generación, precisión, persistencia, TTL y recuperación tras error de carga.
- `go test -race` no pudo ejecutarse en este entorno: CGO está desactivado y no se encontró GCC/Clang disponible. Las pruebas concurrentes aprobadas no sustituyen al detector de carreras.
- No se probó reproducción real Drive/Tauri, ni latencia al primer fotograma o HTTP en la instancia del usuario. Los clips FFmpeg son pruebas locales de integración.

Estos cambios reducen trabajo evitable. No garantizan latencia cero: primera conexión a Drive, cuota, ancho de banda, probes sin caché, primer segmento de FFmpeg, extracción de subtítulos y buffers del cliente mantienen sus propios costes.
