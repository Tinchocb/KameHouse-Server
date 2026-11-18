# Frente 7/7: validación integrada y binario — 2026-11-07

Validación después de que el agente principal confirmó estables los cambios productivos de los frentes 1–6, incluido el último ajuste de `handlers/metadata.go`. No se modificó código productivo, no se ejecutó ni reemplazó el servidor existente, no hubo despliegue, reinicio real, commit ni push. Se preservó el árbol local modificado.

No se encontró un `AGENTS.md` en la búsqueda del repositorio excluyendo dependencias, `.git` y `target`. Se revisaron los seis informes y los puntos de integración: generación de fichas/proveedores, barreras de borrado de metadata, ownership de warmers, orden de cierre y admisión compartida de Preview.

## Resultado global

Herramienta observada en esta ejecución: **Go 1.27.3, windows/amd64**, en `C:/Program Files/Go/bin/go.exe`. No se reutilizó como versión actual la referencia histórica a Go 1.26.6 de otras tandas.

Desde `apps/server`:

```powershell
& 'C:/Program Files/Go/bin/go.exe' test -short . ./internal/... ./codegen/...
& 'C:/Program Files/Go/bin/go.exe' vet ./...
& 'C:/Program Files/Go/bin/go.exe' build -buildvcs=false ./...
```

**Todo aprobado, código de salida 0.** La suite incluye el paquete raíz, los paquetes internos y codegen. Algunos paquetes sin cambios usaron resultados cacheados de Go; no se presenta como una repetición forzada de todas las pruebas. Los casos nuevos relevantes se ejecutaron además focalmente en sus frentes y la pasada de integración real siguiente usó `-count=1`.

`git diff --check` focal sobre los archivos productivos de esta tanda quedó limpio. `gofmt -l` de los nuevos archivos Go de los frentes 2–6 no reportó archivos. No se formateó ni limpió el resto del árbol ajeno a esta intervención.

## Integración real de medios después de las comprobaciones globales

```powershell
& 'C:/Program Files/Go/bin/go.exe' test ./internal/mediastream/cassette ./internal/mediastream/videofile ./internal/handlers -run '^Test(PlaybackStartOverThrottledHTTP|ThumbnailCacheBypassesPreview.*|ExtractorRealProbeCacheIsolation)$' -v -count=1
```

Los tres casos aprobaron:

- `TestPlaybackStartOverThrottledHTTP`: fixture MP4 de 90 s y 7.866.450 bytes, HTTP privado limitado y FFmpeg/ffprobe reales. HLS listo en 341 ms, primer segmento 487 ms, fotograma decodificable 529 ms y comprobación de audio 710 ms. Conservó continuidad, búsqueda, índice completo de 45 keyframes y reutilización caliente. Son observaciones de una regresión funcional, no una nueva comparación causal de rendimiento.
- `TestExtractorRealProbeCacheIsolation`: probe real sobre fixture local, segunda lectura sin repetir ffprobe y sin contaminación por la modificación del primer consumidor.
- `TestThumbnailCacheBypassesPreviewQueueAndCancelledCallerDoesNotLoseSharedImage`: el hit de caché evita la cola de Preview; cancelar un consumidor no destruye la extracción compartida y el consumidor restante recibe el JPEG esperado.

No se usaron episodios del usuario, Drive público ni presentación en navegador/Tauri. La calidad Source de la prueba de reproducción copia vídeo H.264: no representa recodificación pesada en CPU/GPU.

## Ejecutable temporal y preservación del existente

Se compiló también el paquete raíz a una ruta privada temporal mediante `go build -buildvcs=false -o <temporal> .`, sin escribir en `apps/server/kamehouse.exe`:

```text
C:/Users/marti/AppData/Local/Temp/kamehouse-frente7-efbcdb1ed56f4a8d981eba180081297d/kamehouse-validation.exe
```

- Tamaño: **95.858.176 bytes**.
- SHA-256: `425DA780FCF7D90696902E3F5F139DC8F4FE924D643445EFA0C55C8D918B656A`.
- `go version -m`: Go 1.27.3, paquete `kamehouse`, ejecutable Windows amd64, CGO desactivado.
- El temporal **no se ejecutó** y no forma parte de una instalación/despliegue.

El ejecutable existente `apps/server/kamehouse.exe` tiene 95.714.816 bytes y última escritura observada del 06/11 a las 16:39 local. Su metadata declara Go 1.27.3, revisión Git `03e7985d647282f800725c5ec2fff1af849c6092`, `vcs.modified=true`, CGO desactivado y `-trimpath=true`.

Su SHA-256 antes y después de compilar fue idéntico:

```text
992683B72B4C1E64CA5B640ED74173658BC1DA0DA17B517BCD60E96FBACEB46B
```

Esto acredita que esta validación no sobrescribió el binario existente. La desigualdad entre el SHA temporal y el existente **no identifica por sí sola qué parches contiene cada uno**: también influyen flags, VCS, rutas y assets embebidos. Un `vcs.modified=true` no permite reconstruir exactamente el árbol dirty usado para el binario instalado. No se declara que ese ejecutable ya incluya las mejoras actuales ni que se haya probado su comportamiento en uso real.

## Límites de la validación

- `CGO_ENABLED=0` y sin GCC/Clang descubierto en PATH. No se ejecutó el detector `-race`; las repeticiones concurrentes de los frentes no lo sustituyen.
- No se ejecutó `verify all`, una suite frontend completa, codegen de regeneración ni pruebas de instalación/Tauri. Se comprobó Go build/vet/test; no se presentan como una validación de distribución de escritorio completa.
- El cierre activo del proveedor, las barreras del DELETE y el ownership nuevo están integrados y pasaron sus regresiones. Persisten los límites documentados: proveedores retirados por hot reload, operaciones compartidas que pueden prolongar el cierre, búsqueda de filler sin API de contexto y extracciones compartidas de miniaturas que pueden sobrevivir a la salida de un consumidor.
- Los campos anidados de LibraryMedia con copia superficial, AniList no modificado y el refetch del cliente HTTP inferior siguen fuera de las garantías nuevas del frente 4.
- La proyección SQLite reduce asignaciones en la fixture del frente 6, pero no acredita una aceleración fija en la biblioteca real. Los tiempos concurrentes de esta validación no se usaron para recalcular sus benchmarks.
- Sigue pendiente una sesión real de Drive ya autorizada y correlacionada desde el clic hasta el primer fotograma presentado. No hay un resultado real que sustituir por la fixture.

No se encontraron fallos de compilación, vet o regresiones en las comprobaciones integradas ejecutadas.
