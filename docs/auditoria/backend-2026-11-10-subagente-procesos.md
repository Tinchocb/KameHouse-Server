# Revisión de procesos multimedia — 2026-11-10

## Defecto confirmado y corrección

Scanner, videofile y skipdetect elegían el ejecutable mediante `ffprobe.SetFFProbeBinPath`, que escribe una variable global sin sincronización en el SDK. El mutex privado de videofile no protegía los otros escritores ni la lectura dentro de `ProbeURL`. Además de la carrera, era posible reproducir el defecto sin concurrencia: crear un segundo scanner con un ejecutable inexistente hacía fallar el sondeo del primero, aunque este conservaba una ruta válida en su configuración.

Se amplió `TestProbeReplacesStreamsAndPreservesFractionalDuration` para construir ese segundo scanner antes de usar el primero. Falló antes de la corrección y pasó después con el FFprobe instalado y el WAV temporal generado por la prueba.

`internal/util/ffmpegutil/probe.go` ejecuta FFprobe con la ruta de cada llamada y conserva las opciones, los modelos y los campos legacy de tags del SDK. No serializa procesos. Reutiliza la resolución de shims y la creación de procesos sin ventana de util. Scanner, videofile y skipdetect utilizan ese punto de entrada; no quedan setters ni sondeos globales del SDK en producción. Un test de fingerprint conserva una llamada directa al SDK, sin escribir su global.

La función existente `videofile.SetGlobalFFProbePath` se conserva como compatibilidad: actualiza un default atómico que solo se consulta cuando el nuevo wrapper recibe una ruta vacía. Los sondeos configurados con ruta explícita y los constructores de scanner ya no modifican el default de otros componentes. No hay cambios de rutas HTTP, configuración persistida ni dependencias.

## Recursos y errores

- JSON de salida limitado a 16 MiB; formato ausente, JSON inválido y streams nulos devuelven error.
- Stderr se descarta para impedir que URLs autenticadas del medio terminen en errores o logs a través del wrapper.
- `CommandContext` cancela el proceso y `Run` lo espera. `WaitDelay` de dos segundos limita la espera de pipes heredados; los timeouts existentes de scanner (30 s), videofile (40 s) y detector (15 s) permanecen.
- El contexto precancelado impide lanzar el proceso; los errores de deadline/cancelación admiten `errors.Is`.
- El wrapper usa el resolvedor existente para evitar el problema conocido de shims Chocolatey. No garantiza terminar árboles de hijos arbitrarios de ejecutables personalizados; esa limitación es distinta del FFprobe ordinario y se mantiene explícita.

## Validación

Pasaron sin caché:

```text
go test ./internal/util/ffmpegutil ./internal/library/scanner ./internal/mediastream/videofile ./internal/skipdetect -count=1 -timeout 180s
go test ./internal/util/ffmpegutil -run '^TestProbe' -count=1 -timeout 45s
```

El helper de proceso prueba ocho sondeos simultáneos con una ruta válida y un default inválido, compatibilidad de tags y flags, default vacío, errores sin secretos, JSON inválido/sin formato/con streams nulos, exceso de salida, deadline y contexto precancelado. El sondeo WAV usa un archivo sintético local; no se accedió a datos personales ni a servicios reales.

No se atribuye una mejora de velocidad a esta corrección. No se reinició la instancia, ni se hizo commit, push o despliegue. Detector de carreras pendiente por CGO deshabilitado y ausencia de compilador compatible. Las suites generales y compilaciones las coordina el agente principal.
