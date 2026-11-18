# Correcciones de la auditoría del backend — 2026-11-05

Alcance: servidor Go, contratos generados y scripts de verificación/build de KameHouse. KameHouseTV queda fuera del alcance por decisión del usuario. El working tree ya tenía cambios de otras sesiones; este informe describe esta intervención, no todo el diff contra HEAD.

## Cambios

- `Makefile` y `verify.mjs` incluyen el paquete raíz en vet/tests; el target race también lo incluye. `make dev` pasa `--port`.
- `pre-push`, `all` y `codegen` fallan si falta Go, antes de ejecutar otras comprobaciones. Se conserva el aviso y skip de vet en `pre-commit`.
- `build-server.mjs --cross` falla antes de limpiar, compilar o copiar archivos, incluso combinado con `--dev`. Se retiró el fallback que etiquetaba binarios del host como otros targets.
- El mantenimiento usa el contexto del scheduler en consultas GORM, limpieza por lotes, checkpoint, barridos de caché y recorte de logs. La limpieza de DB crea un manager local con `WithContext`, sin mutar el handle compartido. La cancelación no incrementa el contador de fallos del barrido ni dispara su notificación crítica.
- La limpieza de buckets actualiza los buckets ya procesados en memoria aunque se cancele antes de terminar el recorrido.
- Se eliminó el wrapper interno `WarmMediaInfo`; se conserva `WarmMediaInfoContext` y se corrigió la ubicación de su comentario.
- Se compartieron la escritura mediante temporal y rename (`util.WriteFileAtomic`), la similitud por bigramas (`util/strsim.Dice`) y la conversión SQL de listas separadas por comas. Se conservan los nombres `LibraryPaths` y `StringSlice` y la semántica de vacío/error.
- Se retiró la sección `[tmdb]` ignorada del ejemplo; se conserva `[metadata] tmdbApiKey`.
- La anotación de `/library/collection` anuncia solo GET. Se regeneraron los artefactos, sin edición manual.
- Se corrigieron comentarios que mencionaban `UpsertLibraryMediaBatch` en lugar de `UpsertLibraryMediaBatchContext`.

## Correcciones al informe recibido

`audioStreamIndex` sí tiene consumidores web, por ejemplo en `player-core.ts`, `usePlayerSkip.ts`, rutas de películas/series y pruebas de `mediastream.hooks`. Se conservan ambos campos del request: aunque los handlers no los leen, su eliminación requeriría adaptar esos consumidores. S-02 no se aplicó.

Se conservaron `TvMode`, `FeatureFlags`, `MediaPlayerSettings`, `Systray`, el alias `SeaResponse` y los endpoints de logs. No hay migración ni retirada de esos contratos.

La regeneración completa también actualizó drift previo respecto de la copia guardada antes de generar: `CharacterRole` y `EpisodeType` pasan de uniones literales a `string`, de acuerdo con los DTO actuales sin constantes; los JSON intermedios reflejan además cambios preexistentes de autenticación, campos privados y constantes. La segunda generación sobre las mismas fuentes no produjo cambios adicionales. Esto no equivale a `codegen:check` limpio contra Git: hay artefactos modificados sin commit.

## Verificación

- `go build ./...` y `go vet ./...`.
- Suite corta completa: `go test -short . ./internal/... ./codegen/...`.
- Race focalizado en raíz, maintenance, core, database/db, util/filecache y util/cache; pasada adicional de database/db y mediastream tras los últimos ajustes.
- Pruebas de cancelación para mantenimiento de DB, logs, cachés y directorios de video; preservación de datos al cancelar; sincronización de buckets parcialmente procesados.
- Pruebas de equivalencia para similitud Unicode, bigramas repetidos, Scan/Value y reemplazo/limpieza de temporales en Windows.
- `node --test scripts/backend-tooling.test.mjs`: dos pruebas de rechazo temprano, incorporadas a `pre-push`.
- Typecheck web y las siete pruebas de `mediastream.hooks.test.tsx`.
- Regeneración repetida con comparación de hashes, sin cambios adicionales; `git diff --check` limitado a los archivos de esta intervención.

## Límites

La cancelación es cooperativa: las operaciones de filesystem ya iniciadas, como `ReadDir` o el `RemoveAll` de un directorio de video, deben retornar antes de poder observarla. No se promete cierre instantáneo ni se modificó el orden de cierre global.

No se ejecutó `make` porque no está instalado; se ejecutaron sus comandos Go directamente. No se ejecutó `verify all` completo ni toda la suite web. La primera regeneración encontró bloqueos transitorios de archivos de Windows; los reintentos terminaron y se comprobó estabilidad.

No se inició/reinició el servidor de uso real, no se desplegó, no se probó reproducción real y no se creó un commit.
