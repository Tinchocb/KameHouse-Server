# Frente 5/7: cancelación y cierre de trabajo en segundo plano — 2026-11-07

Revisión e implementación focal. Se preservó el árbol local modificado y las correcciones de los frentes 2, 3 y 4. Sin desplegar, reiniciar la instancia real, modificar configuración/credenciales, commit ni push. No se ejecutó una suite global desde este frente.

## Hallazgos

- Core ya disponía de `App.StartBackground`: admite trabajo antes del cierre y lo une antes de cerrar servicios compartidos. Es código preexistente; este frente lo reutiliza, no lo introduce.
- Enriquecimiento de fichas, búsqueda de filler, precarga de metadata, imágenes de estantería y calentado de miniaturas seguían usando goroutines sueltas. El cierre de core no esperaba esas tareas antes de cerrar SQLite/cachés.
- Las demoras de precarga (incluida la inicial de 45 s de miniaturas) y las pausas de metadata usaban `time.Sleep`, por lo que el apagado no interrumpía esas esperas.
- La precarga de imágenes podía continuar admitiendo URLs después de cancelarse el trabajo; el proveedor activo de metadata tampoco recibía `Close` desde el cleanup de la app.

## Cambios implementados

### Ownership y admisión

Los trabajos de enrichment y filler pasan a `StartBackground`. Si se rechaza la admisión al apagar la app, se liberan sus marcas de singleflight/reserva; no quedan estados que impidan un próximo trabajo. Se mantienen las guardias de generación incorporadas por el frente 2 y sus límites de metadata/enriquecimiento.

La precarga de metadata y las imágenes de estantería también son app-owned. Sus demoras/pausas usan una espera cancelable con el contexto de apagado. Las consultas GORM propias de ambos warmers usan `WithContext`; la precarga de estantería comprueba la cancelación antes de consultar stills tras descargar portadas.

El calentado de miniaturas registra ownership **antes de consultar SQLite**. Comunica el total/error de inicialización al caller y después ejecuta el pool existente. La cancelación manual y el apagado cancelan el contexto del pool. El estado `isThumbnailWarming` y `warmingCancel` se liberan juntos bajo su mutex, evitando que una finalización borre la marca de una admisión posterior. No se alteraron el presupuesto Preview del frente 3, los workers, ni la política de pausa por reproducción.

### Imágenes compartidas

Se añadió `ImageProxy.PrewarmContext`; `Prewarm` conserva su firma y delega con un contexto de fondo. Al cancelar, deja de admitir URLs y espera a las descargas ya admitidas. No cambia SSRF, validación de imágenes, caché, deduplicación ni políticas HTTP.

Un fetch `GetImage` ya compartido **no se cancela por la salida de un consumidor de background**: podría servir a una petición visible. Conserva el timeout upstream existente de 30 s y es unido por el trabajo de precarga. No se promete cierre instantáneo ni cancelación de una operación de filesystem/validación ya iniciada.

### Proveedor activo y orden de cierre

Core cierra el proveedor activo después de unir `backgroundWorkers` y antes de ejecutar cleanups de servicios, cerrar `FileCacher` y cerrar SQLite. El frente 4 implementó la admisión/cancelación/unión dentro de los proveedores Jikan/TMDB; este frente no editó esos archivos. Así, el `Close` del proveedor activo se invoca mientras sus dependencias siguen abiertas.

Las operaciones TMDB compartidas que ya se desacoplan del contexto del consumidor pueden prolongar la unión según los límites existentes. El `Cleanup(ctx)` exterior conserva su deadline y puede retornar mientras el cleanup sigue ejecutándose; los recursos no se cierran por adelantado solo para aparentar un apagado rápido.

## Verificación focal

Pruebas nuevas:

- `TestCleanupJoinsMetadataBeforeSharedResources`: una tarea app-owned termina primero, el proveedor se cierra después y un recurso compartido no se cierra hasta que ese proveedor termina. La admisión tardía se rechaza.
- `TestBackgroundDelayCancelsWithoutWaiting`: una espera de una hora se libera al cancelar; una espera nula con contexto cancelado no admite trabajo.
- `TestRejectedHandlerWorkReleasesReservations`: warm/enrichment rechazados por una app cerrada no tocan una DB deliberadamente nil y liberan sus marcas.
- `TestPrewarmCancellationStopsAdmissionAndJoinsDownload`: servidor HTTP privado con la primera descarga bloqueada; cancelar no admite la segunda URL y no retorna antes de unir la primera. Un contexto ya cancelado no emite HTTP.

Esos casos y regresiones relacionadas se repitieron con `-count=20 -cpu=1,4,12`, aprobados. Se pasaron además las pruebas de inicio del warm de miniaturas/enriquecimiento tres veces y vet focal. La prueba de imágenes no usa Google ni imágenes del usuario.

```powershell
& 'C:/Program Files/Go/bin/go.exe' test ./internal/core ./internal/handlers ./internal/util/proxies -run 'Test(CleanupJoinsMetadata|BackgroundDelay|RejectedHandlerWork|PrewarmCancellation|PrewarmBaja|RunThumbnailWarmPool|HandleGetAnimeEntry)' -count=20 '-cpu=1,4,12'
& 'C:/Program Files/Go/bin/go.exe' test ./internal/handlers -run 'Test(StartThumbnailWarm|RejectedHandlerWork|BackgroundDelay|AnimeEnrichment)' -count=3
& 'C:/Program Files/Go/bin/go.exe' vet ./internal/core ./internal/handlers ./internal/util/proxies
```

`git diff --check` focal limpio. No se ejecutó `-race` porque el entorno no tiene el compilador C/CGO requerido; repetir casos concurrentes no sustituye ese detector. La validación global queda para el frente 7.

## Límites abiertos

- El cierre añadido cubre el **proveedor activo**. Los proveedores retirados por un hot reload anterior no se registraban como trabajo propio en el diseño existente. Cerrar cada retirado en un trabajo app-owned sin bloquear publicación/configuración requiere coordinar el cambio de semántica de sus lectores antiguos; no se incorporó un registro que los retenga indefinidamente ni se rediseñó ese reemplazo aquí.
- La búsqueda de filler conserva sus llamadas/límites internos, que no aceptan un contexto en esa API. Ahora está unida a la app, pero el apagado puede esperar que esas operaciones retornen.
- El pool de miniaturas es app-owned, pero `EnsureThumbnailWithContext` comparte una extracción desacoplada que puede sobrevivir a la cancelación de un consumidor hasta sus límites actuales de probe/encode. No se afirma que esta tanda una todo proceso global de miniaturas ni toda goroutine de cassette. Esa extracción no escribe SQLite en su finalización; no se modificó su política del frente 3.
- La revisión de Drive/cassette no produjo cambios en esos paquetes desde este frente. No se usó reproducción real para medir tiempos ni se declara resuelta toda ruta posible de cierre.

## Archivos de esta intervención

Core: `app.go` (cierre activo), `metadata_cleanup_test.go`.

Handlers: `background_lifecycle.go`, `background_lifecycle_test.go`, `anime_metadata_prewarm.go`, `shelf_images.go`, `thumbnail_warm.go`; migraciones mínimas de caller en `anime_entries.go` y `anime_enrichment.go`, preservando el trabajo del frente 2.

Proxy: `util/proxies/image_proxy.go`, `image_proxy_cancel_test.go`.
