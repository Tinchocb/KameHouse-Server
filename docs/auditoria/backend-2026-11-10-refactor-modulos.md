# Refactorización y optimización de módulos

Pasada local del 10 de noviembre de 2026 sobre sondeo de archivos, ejecución paralela y listados de subtítulos Drive. Se conservaron los cambios anteriores, las funciones activas y los contratos HTTP. No se reinició la instancia ni se usó la biblioteca personal.

## Cambios

### Pool paralelo compartido

`EachTaskLimit` conserva su interfaz y el límite de concurrencia. La distribución de índices utiliza ahora un contador atómico compartido entre los workers, en lugar de un canal y un productor que envía cada índice. El consumo de memoria de la planificación no crece con la cantidad de elementos.

Se añadió `EachTaskLimitContext`: deja de tomar trabajo al observar cancelación y espera a los callbacks ya admitidos. Los callbacks con I/O siguen debiendo respetar ese contexto. Las pruebas comprueban cada índice exactamente una vez, límite de workers, lote vacío, cancelación y espera a tres callbacks bloqueados antes de regresar.

### Sondeo de archivos

`FileProber` reutiliza ese pool, con el mismo tope de ocho workers. Para un solo archivo trabaja directamente dentro de la llamada síncrona, evitando crear ocho goroutines. Se retiró la cola de punteros dimensionada al tamaño completo del lote y se extrajo el recorrido por archivo para compartirlo entre ambos caminos.

La transformación de FFprobe a DTO se separó de la ejecución del proceso. Publica un snapshot nuevo de información técnica, sustituye las pistas embebidas de audio/subtítulos/video y conserva las referencias a sidecars y flags que no modifica. Se preasignan las listas de pistas según sus tamaños. Una repetición del sondeo ya no acumula pistas ni deja un video obsoleto en un archivo que no tiene video. La duración conserva la fracción de segundo.

La regresión usa un WAV PCM sintético de 1,25 s y FFprobe instalado. Antes fallaba porque se conservaba una pista antigua junto a la nueva. Ahora comprueba una sola pista después de varios sondeos, duración de 1250 ms, conservación de sidecars, ausencia de mutaciones en el snapshot anterior y conservación del resultado cuando falla el proceso siguiente.

### Caché de subtítulos Drive

Se separaron la resolución del padre y el listado de la carpeta. `Client.ListSubtitleFiles` conserva su comportamiento de consulta directa. El servicio utiliza cachés LRU privadas de cada cliente: hasta 256 archivos y 256 carpetas. Se retiraron el mapa global con claves que retenían punteros de clientes y el vaciado completo de la caché al alcanzar su límite.

Al abrir otro episodio, se resuelve su padre y se reutiliza el listado de subtítulos de esa carpeta. Los archivos de una misma carpeta comparten los datos internos inmutables y cada respuesta recibe una copia. Se conserva la validación del cliente activo antes de leer la caché, el aislamiento al desconectar/cambiar de cliente y la política de no guardar errores.

Los hits por archivo heredan la fecha de vencimiento original del listado de carpeta. Acceder a otro episodio no prolonga dos minutos adicionales la vida de datos antiguos. Las pruebas cubren este vencimiento, su refresco, reintento tras error y mutación de respuestas. La consulta directa y los archivos sin padre conservan sus contratos anteriores.

## Medición

Mismo equipo (Ryzen 5 5600G, Windows amd64), Go y benchmarks antes/después. Tres repeticiones con `-benchmem -count=3 -benchtime=300ms`.

| Benchmark | Antes | Después |
| --- | --- | --- |
| Planificar un archivo, sin ejecutar FFprobe | 2921–3135 ns/op; 520–522 B/op; 11 allocs/op | 39,99–42,14 ns/op; 0 B/op; 0 allocs/op |
| Planificar 10.000 archivos, sin ejecutar FFprobe | 557946–562720 ns/op; 82432 B/op; 11 allocs/op | 243865–294215 ns/op; 700–852 B/op; 11 allocs/op |
| Pool genérico, 10.000 callbacks con contador | 2771946–2834411 ns/op | 80549–98434 ns/op |
| Diez episodios de una carpeta, cliente frío y HTTP local | 20 solicitudes; 5,31–5,85 ms/op; 180328–183372 B/op | 11 solicitudes; 0,916–0,954 ms/op; 89415–89521 B/op |

Comandos reproducibles:

```text
go test ./internal/library/scanner ./internal/util/parallel -run '^$' -bench 'BenchmarkProbeFilesScheduling|BenchmarkEachTaskLimit' -benchmem -count=3 -benchtime=300ms
go test ./internal/drive -run '^$' -bench '^BenchmarkSiblingSubtitleEpisodes$' -benchmem -count=3 -benchtime=300ms
```

El caso Drive baja de diez consultas de padre y diez listados a diez consultas de padre y un listado. La medición es secuencial con servidor simulado; los misses concurrentes de una carpeta fría todavía pueden consultar en paralelo. No se añadió un productor compartido ni una goroutine desligada para esa caché.

Los benchmarks de planificación no abren archivos ni ejecutan FFprobe. Sus mejoras no son multiplicadores del rendimiento de un escaneo completo. Los tiempos HTTP locales no predicen la latencia de Google. No se midieron memoria residente global, carga prolongada, Drive real o reproducción en dispositivos físicos.

## Validación

- Suites completas de `drive`, `parallel` y `scanner` sin caché: pasaron.
- `go test -short . ./internal/... ./codegen/... -count=1 -timeout 180s`: pasó.
- `go vet . ./internal/... ./codegen/...` y compilación Windows de raíz/internal/codegen: pasaron.
- Compilación cruzada Linux: pasó; no se ejecutó el binario Linux.
- Codegen: segunda generación estable por SHA-256 en sus cinco archivos; ningún archivo TypeScript cambió respecto del estado de entrada de esta pasada.
- `pnpm --filter kamehouse-web typecheck`: pasó.
- Comprobación final de whitespace: pasó. Inventario actualizado: 58 paquetes, 336 archivos de producción y 296 archivos de pruebas.
- Sin cambios de dependencias, commit, push, despliegue, reinicio o datos personales. Sin detector de carreras con CGO deshabilitado.

Como siguiente candidata a revisión queda la selección global del binario FFprobe, que comparten scanner, videofile y detector. Esta pasada conservó ese mecanismo y sus timeouts; los cambios medidos se concentran en planificación, transformación de resultados y reutilización de listados.
