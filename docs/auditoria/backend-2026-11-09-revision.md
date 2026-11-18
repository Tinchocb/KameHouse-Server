# Revisión del backend — 2026-11-09

Estado: los tres hallazgos se corrigieron localmente después de la auditoría. La sección final detalla cambios, pruebas y límites; las reproducciones originales se conservan como evidencia histórica.

Revisión del árbol local actual, con cambios previos conservados. Se inspeccionaron autenticación y rutas, reproducción, marcas de opening/ending, escaneo y persistencia. Los hallazgos siguientes se reprodujeron con SQLite temporal y handlers reales; no son una afirmación de que el resto del backend carezca de problemas.

No se abrió la base personal, no se reinició la aplicación ni se modificó código de producción. Las pruebas específicas de diagnóstico se crearon temporalmente y se retiraron tras ejecutarlas.

## 1. P2 — Resolver marcas por MAL usa una identidad distinta del ID público

Ubicación: `apps/server/internal/handlers/mediastream.go`, `HandleGetEpisodeSkipTimes` y `HandleSaveEpisodeSkipTimes`.

El contrato de `episode_skip_times.media_id` y del detector usa el ID público de la obra. En cambio, cuando solo se entrega `malId`, ambos handlers buscan `LibraryMedia` y reemplazan `mediaId` con `lm.ID`, la clave primaria interna. Las mismas marcas quedan inaccesibles según el parámetro empleado; guardar por MAL también puede crear marcas en otra identidad. Si esa clave coincide con el ID público de otra obra, puede leer o modificar marcas de esa otra obra.

Reproducción: LibraryMedia con PK 1, TMDB 123 y MAL 456; marca manual para media_id 123, episodio 1, OP 60–150.

- `GET /api/v1/mediastream/skip-times?mediaId=123&episodeNumber=1`: 200, devuelve la marca.
- `GET /api/v1/mediastream/skip-times?malId=456&episodeNumber=1`: 200, devuelve `data:null`.

Corrección sugerida: convertir MAL a la identidad pública con el resolver compartido, respetando proveedor/tipo y rechazando asociaciones ambiguas. Usar la misma conversión en lectura y escritura. Cubrir PK distinta del ID público y colisiones con otra obra.

## 2. P2 — Aplicar marcas a la temporada puede informar éxito sin propagarlas

Ubicación: `apps/server/internal/handlers/mediastream.go`, `HandleSaveEpisodeSkipTimes`, consulta `Where("library_media_id = ?", mediaID)`.

`mediaID` es el ID público recibido, pero `library_episodes.library_media_id` es una FK interna. La consulta normalmente devuelve cero episodios, mientras el handler responde `appliedToSeason:true`. Si coincide con la PK de otra obra, selecciona sus episodios para construir las marcas.

Reproducción: obra con PK 1 e ID público 123; episodios 1 y 2 asociados por FK 1. Se guarda OP 60–150 con `mediaId:123`, `episodeNumber:1`, `source:"manual"`, `confidence:1` y `applyToSeason:true`.

Resultado observado:

```json
{"data":{"appliedToSeason":true,"episodesUpdated":0,"saved":true}}
```

La base temporal confirma cero marcas para el episodio 2.

Corrección sugerida: resolver primero la obra, consultar los episodios con su PK y guardar las marcas con su ID público. Verificar también el contrato de numeración absoluta frente a número de episodio y el alcance de temporada antes de propagar.

## 3. P2 — El reinicio de asociaciones del escaneo profundo es rechazado por GORM

Ubicación: `apps/server/internal/database/db/db.go`, `ResetLocalFilesMediaIds`; invocación en `apps/server/internal/handlers/scan.go`.

El UPDATE masivo no tiene `Where` ni `AllowGlobalUpdate`. La conexión usa la configuración normal de GORM, que bloquea esta operación con `gorm.ErrMissingWhereClause` (`WHERE conditions required`). Se revierte la transacción, por lo que tampoco se limpian las asociaciones ghost. El handler registra una advertencia y continúa el escaneo.

Reproducción: invocar `ResetLocalFilesMediaIds()` sobre la base temporal creada por el fixture normal de handlers. La comprobación `errors.Is(err, gorm.ErrMissingWhereClause)` devuelve true.

Impacto: el paso que pretende forzar la reidentificación no se ejecuta. Las asociaciones ghost anteriores permanecen y el matcher puede reutilizarlas, conservando una identificación equivocada durante un escaneo profundo.

Corrección sugerida: permitir explícitamente el UPDATE global solo en esa operación, conservando su transacción. Revisar además que la limpieza no se confirme antes de que un escaneo exitoso pueda sustituir las asociaciones; habilitar el UPDATE sin revisar ese orden introduciría pérdida de asociaciones ante errores posteriores.

## Validación y límites

- `go test -short . ./internal/... ./codegen/...`: pasó; algunos paquetes usaron caché de Go.
- `go vet . ./internal/... ./codegen/...`: pasó.
- `go test ./internal/handlers -run TestAuditNov09 -count=1 -v`: las tres reproducciones pasaron, comprobando expresamente el comportamiento defectuoso descrito arriba. No son pruebas de correcciones.
- Las reproducciones usaron el fixture `newChronologyQueryFixture`, que crea una base temporal y espera a que terminen las migraciones.
- Sin validación contra Drive real, biblioteca personal ni reproducción de extremo a extremo.
- No se ejecutó detector de carreras; `CGO_ENABLED=0` en este entorno.

Prioridad sugerida: corregir juntos los dos errores de identidad y después el reinicio del escaneo, revisando su atomicidad antes de habilitar la escritura global.

## Correcciones implementadas — 2026-11-09

1. Lectura y escritura de marcas por MAL comparten `db.ResolvePublicMediaIDByMAL`. Prioriza la asociación explícita de archivos y valida la identidad con el resolver público existente. Respeta el offset de películas y la identidad MAL de anime; rechaza con 409 candidatos o asociaciones ambiguos. No utiliza una PK interna como ID público.
2. La propagación resuelve la PK real de la obra, identifica la temporada del episodio y usa numeración absoluta cuando existe. No alcanza otras temporadas ni obras con una PK coincidente. Un episodio ausente o ambiguo devuelve `appliedToSeason:false` y `seasonError`, conservando el guardado individual. La caché se invalida también después de propagar.
3. Se retiró `ResetLocalFilesMediaIds` y su llamada previa al escaneo. El modo profundo limpia identidad y metadata de matching únicamente en copias privadas de los archivos que va a procesar. El matcher ignora asociaciones ghost en ese modo, sin borrarlas de la base. Los archivos que se omiten por bloqueo, Drive o biblioteca desconectada conservan sus asociaciones. No es necesario habilitar un UPDATE global ni borrar datos antes de escanear.

Pruebas permanentes agregadas:

- `internal/handlers/skip_identity_regression_test.go`: equivalencia MAL/ID público en lectura y escritura, colisión con PK, rechazo de MAL ambiguo, propagación limitada a temporada con numeración absoluta y episodio desconocido.
- `internal/database/db/skip_identity_test.go`: series, películas con offset, anime/MAL, asociaciones locales explícitas y colisiones entre asociaciones.
- `internal/library/scanner/deep_scan_identity_test.go`: reidentificación en copias independientes, conservación de archivos omitidos, bypass de ghost durante un escaneo profundo y conservación de asociaciones persistidas tras cancelar.

Validación final:

- Pruebas específicas de handlers/base/scanner con `-count=1`: pasaron.
- Pruebas `TestDeepScan` con la comprobación de ghost/cancelación: pasaron.
- `go test -short . ./internal/... ./codegen/...`: pasó.
- `go vet . ./internal/... ./codegen/...`: pasó.
- `git diff --check` sobre los archivos tocados: pasó.

No se migraron marcas históricas guardadas bajo una PK equivocada: no se puede distinguir con seguridad su obra original. La mejora del escaneo evita el borrado previo de asociaciones; no convierte todas las escrituras de metadata del pipeline en una única transacción. Sin reinicio de la instancia, uso de la biblioteca personal, commit ni despliegue.
