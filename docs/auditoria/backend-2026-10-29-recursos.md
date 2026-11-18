# Presupuesto automático de recursos

## Cambios aplicados

- `internal/util/resourcebudget`: perfil conservador según CPU efectiva (`min(NumCPU, GOMAXPROCS)`) y RAM total detectada. Ante RAM desconocida usa el perfil menor.
- Transcodificación automática: 1–2 procesos por software, 1–4 con aceleración. Un límite positivo de `TranscodeThreads` conserva su significado existente: cantidad de procesos, no hilos de un codec.
- FFmpeg: limita hilos del decoder, encoder y filtros. Los perfiles de encoder personalizados conservan sus flags de salida. Los límites de hilos son por codec, no un límite rígido de todos los hilos internos de FFmpeg.
- Miniaturas: 32 MB con RAM desconocida o menor a 4 GiB; 64 MB desde 4 GiB; 128 MB desde 8 GiB; 256 MB desde 16 GiB. `cache.thumbnails.memoryMaxBytesMB = 0` activa selección automática; un valor positivo sigue siendo manual. Configuraciones antiguas que guardaron 256 explícitamente conservarán 256.
- Coordinador compartido entre transcodificadores y gestores de preparación: solo un encode de fondo a la vez. Una solicitud de transcodificación en vivo cancela el encode de fondo y espera su limpieza antes de continuar. La demanda cancelada libera su reserva.
- La preparación vuelve a estado en cola y se reintenta desde el principio tras 15 segundos sin actividad de transcodificación. Los segmentos parciales no se publican. El trabajo especulativo no interrumpe la preparación.
- Antes de iniciar una preparación se exige al menos 512 MiB y 10% de RAM disponible. La espera admite cancelación y apagado.
- Los logs muestran el presupuesto automático de transcodificación y el límite de miniaturas.

## Validación local

- Pruebas de perfiles pequeños/grandes, prioridad, limpieza antes de admisión, cancelación, enfriamiento, presión simulada y límites manuales.
- Suites de `resourcebudget`, `cassette` y `core`: PASS.
- Suite de `pretranscode`: PASS fuera del aislamiento. Dentro del aislamiento falla la creación de junctions de una prueba de seguridad anterior; no se eliminó ni omitió esa prueba.
- Prueba con FFmpeg real `TestPreTranscodeEndToEnd`: PASS, produjo dos segmentos HLS de un clip sintético.
- Detector de carreras en `resourcebudget` y `cassette`: PASS.
- `go vet -p 1 ./...` y `go build -p 1 ./...`: PASS, con Go 1.26.6, módulos readonly y resolución offline.

## Límites de esta implementación

El perfil de CPU/RAM se calcula una vez por proceso. La RAM libre controla la admisión de tareas de fondo; no se añadió un controlador continuo de carga CPU/GPU ni redimensionamiento dinámico de todas las cachés. La memoria detectada es la que informa gopsutil del sistema, sin una política adicional de límites de contenedor.

La prioridad cubre procesos de transcodificación en vivo y preparación. No se conectaron todavía al coordinador el escáner, la reproducción directa, FFprobe ni todas las extracciones de miniaturas/subtítulos. La sonda existente de hardware conserva sus timeouts y su caché.

Interrumpir preparación descarta el encode parcial: no es una pausa con reanudación desde el mismo fotograma. Los 15 segundos evitan reintentos inmediatos entre procesos, pero no equivalen a conocer si el usuario sigue mirando contenido ya almacenado en buffer.

No se cambió resolución, calidad, selección de GPU ni la política de reproducción directa. No se reinició el servidor ni se reemplazó su ejecutable. Hace falta validar reproducción real y medir consumo/fluidez en PCs de distinta capacidad antes de atribuir mejoras de rendimiento o prometer compatibilidad universal.
