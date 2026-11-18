# Frente 3/7: prioridad de reproducción y miniaturas — 2026-11-07

Revisión focal de competencia por recursos. Se preservó el árbol local previo. No hubo despliegue, reinicio de instancia real, cambio de configuración de usuario, commit ni push.

## Hallazgos comprobados

- El coordinador ya preempta pretranscodificación y fingerprints cuando llega reproducción. El pretranscode conserva el mismo trabajo en cola y reintenta cuando termina el período de reposo.
- `storyboard.EnsureFrame` ya usa `resourcebudget.Shared.Preview`, un slot local y FFmpeg con un thread/prioridad baja.
- La generación fría de miniaturas de catálogo en `handlers/thumbnail.go` usaba otro semáforo (hasta cuatro extracciones) y FFmpeg con threads automáticos, sin incorporarse al coordinador compartido.
- `Coordinator.Preview` decía admitir una extracción, pero admitía cualquier cantidad concurrente. Una prueba de ocho demandas simultáneas reprodujo un pico de ocho; una segunda Preview tampoco esperaba a que terminara la primera.

## Corrección

`Coordinator.Preview` admite una sola extracción activa en todo el coordinador. Conserva la cuenta de solicitudes pendientes para impedir que un trabajo pesado de fondo se adelante. La espera es cancelable y la cancelación de una solicitud pendiente no libera el slot de otra extracción activa ni retiene demanda fantasma. `Live` sigue admitiéndose sin esperar a esa extracción corta: la política existente permite una Preview junto a reproducción, y se conserva.

Las miniaturas frías de catálogo participan ahora en esa misma clase Preview. El límite es compartido con los fotogramas de storyboard; FFmpeg usa prioridad baja, un thread de entrada, uno de salida y uno de filtros. Se mantienen el formato JPEG, calidad, escala de 480 píxeles, selección automática del vídeo y deduplicación por hash.

Los hits de memoria/disco y las respuestas condicionales permanecen antes de la admisión: no esperan al slot de generación. Una cancelación individual deja de esperar sin destruir una extracción compartida que otro consumidor puede necesitar. Se mantienen los límites existentes de cola (30 s), probe (5 s) y encode (15 s); la extracción compartida termina y libera su lease antes de restaurar cualquier estado de prueba.

No se forzó toda miniatura visible a la clase Background, porque eso haría esperar el período de reposo de playback y podría impedir mostrar imágenes durante reproducción. Tampoco se sustituyeron imágenes por errores o placeholders para simular una aceleración.

## Evidencia antes/después

Antes del cambio fallaron:

- `TestPreviewQueueLimitDoesNotBlockLiveOrLeakOnCancel`: la segunda Preview era admitida con la primera activa.
- `TestPreviewBurstHasOneActiveExtraction`: ocho solicitudes controladas alcanzaron ocho extracciones activas.

Después: el pico es uno; una demanda pendiente cancela correctamente por deadline; reproducción Live se admite aun con una Preview activa y la siguiente Preview puede progresar después de liberar la anterior.

Prueba real con FFmpeg y MP4 sintético de dos segundos, repetida tres veces: el hit de disco responde mientras el slot Preview está ocupado; cancelar el primer consumidor no pierde la imagen compartida; un segundo consumidor obtiene un JPEG decodificable de 480×270 y no se registra un fallo negativo de extracción por aquella cancelación.

No se midieron FPS, latencia al primer fotograma ni uso de CPU de la instalación real. Esta intervención reduce el máximo de competencia de generación, no demuestra que todas las imágenes aparezcan más rápido: una imagen fría puede esperar detrás de otra Preview. Una extracción existente tampoco se mata al llegar playback, por la política explícita de una Preview corta junto a Live.

## Verificación focal

```powershell
& 'C:/Program Files/Go/bin/go.exe' test ./internal/util/resourcebudget -count=20 '-cpu=1,4,12'
& 'C:/Program Files/Go/bin/go.exe' test ./internal/handlers -run 'Test(ThumbnailCacheBypassesPreview|HandleGetVideoThumbnail|RunThumbnailWarmPool|EtagMatches)' -count=3
& 'C:/Program Files/Go/bin/go.exe' test ./internal/mediastream/pretranscode -run 'Test(PlaybackPreemption|BackgroundThreadLimits)' -count=3
```

Pruebas focales aprobadas y `git diff --check` limpio en los archivos productivos de esta intervención. No se ejecutó suite global concurrente ni detector de carreras; la integración global corresponde al agente principal.

## Archivos

- `apps/server/internal/util/resourcebudget/coordinator.go`
- `apps/server/internal/util/resourcebudget/preview_limit_test.go`
- `apps/server/internal/handlers/thumbnail.go`
- `apps/server/internal/handlers/thumbnail_priority_test.go`

No se modificaron `thumbnail_warm.go`, el escáner, cassette ni el ciclo de vida global. La precarga de miniaturas ya pausa su pool entre tareas cuando detecta transcode activo; revisar otras rutas de background o políticas de prioridad entre imágenes visibles y hover queda fuera de esta corrección.
