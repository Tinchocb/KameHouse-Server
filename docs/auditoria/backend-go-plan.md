# Auditoría del backend `apps/server` — Plan de implementación

Snapshot: **2026-10-22**, rama `version-2.0` con cambios sin commitear (se analizó el estado en disco, no HEAD).

## Estado de aplicación (22/10/2026)

**Aplicado al árbol de trabajo de `apps/server`, sin commit.** Antes de empezar se respaldaron los 124 archivos que se tocan (copia en la carpeta temporal de la sesión, `scratchpad/backup-real`).

- **Pasos aplicados:** 71 de 73. Quedan fuera OP-07 y RB-03, que son excluyentes con DM-03 (ver regla 3).
- **Comprobación edición por edición:** las 263 ediciones de esos 71 pasos están presentes en el repo (cada DESPUÉS presente, cada ANTES ausente, archivos borrados inexistentes).
- **Verificación sobre el repo real:** `go build ./...` y `go vet ./...` sin errores; `go test ./... -short` con 39 paquetes en verde; `go test -race` en verde en 14 paquetes (`filecache`, `events`, `database/db`, `drive`, `util/proxies`, `util/cache`, `library/filesystem`, `library/scanner`, `skipdetect` y todo `mediastream`). `gofmt -l` solo marca los 2 archivos que ya venían mal formateados.
- **Hecho fuera del plan, como consecuencia de los pasos:**
  - `go mod tidy`: elimina `github.com/5rahim/hls-m3u8` (solo lo usaba el proxy que borra DM-03; 1 línea de `go.mod` y 4 de `go.sum`).
  - Codegen regenerado (`cd codegen && go run main.go`): `codegen/generated/handlers.json`, `codegen/generated/public_structs.json`, `apps/web/src/api/generated/endpoints.ts` y `endpoint.types.ts` ya no listan las rutas y estructuras borradas. `pnpm exec tsc --noEmit` en la web: 0 errores.
- **No se regeneró `apps/web/src/api/generated/types.ts`** (se dejó como estaba): al regenerarlo aparecen 4 errores de TypeScript, porque `codegen/internal/generate_types.go` (línea ~183) emite alias fijos a `ScanSummaryItem`, `ScanSummaryGroup`, `ScanSummaryFile` y `ScanSummary`, tipos que otra sesión está sacando del servidor (`scan_summary_dto.go` está modificado en el árbol). Hay que arreglar ese generador y regenerar; mientras tanto `types.ts` conserva entradas viejas (por ejemplo `showChangelogTour`), que nadie usa.
- **Incidente durante la aplicación:** el disco `C:` se quedó sin espacio (la caché de compilación de Go llegó a 10 GB) y varios pasos se revirtieron solos porque `go build` fallaba; se limpió la caché y se reanudó con los pasos pendientes. Conviene vigilar el espacio de `C:`, que quedó cerca del 97 %.
- **Pendiente:**
  - Probar con reproducción HLS real OP-19, OP-21 y RB-20 (solo se revisaron leyendo).
  - Restos inertes de DM-14: la entrada de `sensitiveMethodRoutes` y el caso de `sensitive_endpoint_test.go` para `POST /drive/callback`.
  - DM-02 no borra la tabla `user_media_progresses` de las bases ya creadas (es inocua).
  - Hallazgo no incluido: la carrera por mutación de `settings.FfmpegPath/FfprobePath` en `internal/mediastream/repository.go` (~131).
  - Barrido exhaustivo por paquete de rendimiento y robustez.


## Resumen ejecutivo

- **73 pasos**: 23 de código muerto, 25 de optimización y 25 de robustez (Alta 6 · Media 34 · Baja 33).
- Los 71 pasos no condicionales se aplicaron **en orden de ID** sobre una copia aislada del servidor, compilando (`go build ./...`) tras cada paso, y la secuencia se repitió desde cero sobre una copia nueva con resultado idéntico. OP-07 y RB-03 (condicionales) se validaron aparte sobre una copia limpia. Resultado final: `go vet ./...` sin avisos, `go test ./... -short` en verde (39 paquetes; los 3 que desaparecen son `api/dragonball` y sus subpaquetes, borrados por DM-01) y `go test -race` en verde para `filecache`, `events`, `database/db`, `drive`, `util/proxies`, `util/cache`, `library/filesystem`, `library/scanner`, `skipdetect` y `mediastream/cassette`.
- Línea base antes de tocar nada: `go build`, `go vet` y `go test ./... -short` pasaban (42 paquetes). `gofmt -l` marca `internal/library/scanner/watcher_test.go` e `internal/util/result/boundedcache.go`, que **ya venían mal formateados**: no los causa el plan.
- **Mayor impacto esperado:** RB-15 (las miniaturas locales en frío fallaban siempre: `ffmpeg` no puede elegir el formato con un temporal `.tmp`), RB-16 (carrera de datos real en el escáner), DM-01 (módulo `api/dragonball` entero, ~1.800 líneas, ya inalcanzable), OP-01/OP-03/OP-02 (singleflight en AniList y cálculo repetido en el matcher del escáner), OP-05/OP-11 (E/S de disco bajo lock en `BlockCache` y `ffprobe` duplicado) y RB-02/RB-07 (carreras en WebSocket y `filecache`).

### Nivel de verificación y límites (leer antes de ejecutar)

- La auditoría se **redujo de alcance** porque la primera corrida agotó el límite de uso de la cuenta. Hubo 12 agentes de descubrimiento (3 de código muerto, 2 de endpoints, 7 transversales: consultas SQLite, locks, `singleflight`, `context`, cierre de recursos, nil, asignaciones) y un barrido acotado posterior de 4 agentes sobre los caminos calientes (cassette/HLS, escáner, proxy de imágenes y handlers, huellas y Drive), que aportó RB-15 a RB-25 y OP-18 a OP-25. **No** se hizo el barrido exhaustivo por paquete, así que pueden quedar hallazgos fuera de esos ejes y caminos. Está pendiente, entre otros, la carrera por mutación de `settings.FfmpegPath/FfprobePath` en `InitializeModules` (`internal/mediastream/repository.go`, ~131).
- **RB-08 y RB-09** pasaron por un verificador LLM independiente y otros 67 pasos se revisaron a mano contra el código real y los clientes (web, TV, escritorio); solo **DM-09, DM-20, OP-23 y RB-25** (eliminar campos y tipos que nada lee, y cambios menores) se apoyan únicamente en la compilación. No se encontró ningún error de lógica; las precondiciones o interacciones relevantes están en DM-01 y OP-11. **OP-19, OP-21 y RB-20** cambian la política de concurrencia de HLS y solo se revisaron leyendo el código: probarlos con reproducción real. Todos pasaron además la verificación **mecánica** (el bloque ANTES coincide exactamente con el archivo, compila, `vet` y tests pasan). La compilación y los tests no prueban por sí solos que un cambio de comportamiento sea correcto, por eso conviene leer con atención los de severidad Alta.
- Cinco pasos se corrigieron al aplicarlos: DM-05 (se conservan los títulos alternativos de TMDB, que usa `tmdb_provider.go`), OP-01 (su ANTES parte del código que deja DM-09), OP-17 (indentación), OP-24 (el ancla del tercer edit era una llave ambigua) y la pareja OP-07/RB-03 (ver reglas).

## Reglas para la IA que ejecute el plan

1. Ejecutar las fases en orden (1 → 2 → 3) y, dentro de cada fase, en el orden de los IDs: **así se validó**. Correr `go build ./...` tras cada paso y `go vet ./...` al final de cada fase.
2. Los **rangos de líneas son del snapshot**. Tras pasos previos se desplazan: localizar por el **bloque ANTES** (aparece una sola vez; si hubiera varias coincidencias, usar el rango como desempate). Si el ANTES no coincide, parar y reportar; no improvisar.
3. **OP-07 y RB-03 son excluyentes con DM-03**: DM-03 borra `internal/handlers/proxy.go`, que ellos editan. Si se ejecuta DM-03, omitirlos; si se decide conservar la ruta `/api/v1/proxy`, omitir DM-03 y aplicarlos (se validaron sobre una copia limpia: aplican y compilan).
4. No commitear ni cambiar de rama sin que el usuario lo pida: el checkout es compartido con otras sesiones. Tocar solo los archivos del paso.
5. El plan se calculó sobre el **árbol de trabajo** (con cambios sin commitear de otras sesiones), no sobre HEAD. **DM-01 exige que `routes.go` ya no importe ni registre `api/dragonball`** (en HEAD sí lo hace): sobre un checkout limpio de HEAD no compila. Ídem para cualquier paso cuyo ANTES no coincida.
6. Los pasos que eliminan rutas HTTP (DM-03 a DM-08, DM-14 a DM-16) cambian el contrato con el frontend: regenerar el codegen (`go run ./codegen` desde `apps/server`), regenerar `apps/web/src/api/generated/*` y pasar el typecheck de la web. Antes de borrar una ruta, confirmar que KameHouseTV (`D:\Proyectos_personales\KameHouseTV\src`) tampoco la usa.

## 1. Tabla resumen de hallazgos

| ID | Severidad | Archivo y líneas | Tipo | Resumen del problema | Aplicación | Verificación |
|---|---|---|---|---|---|---|
| DM-01 | Alta | `internal/api/dragonball/router.go:1-64` (+16 ediciones) | Código Muerto | El módulo internal/api/dragonball (router, controller, service, repository, domain, dto y 6 ficheros seed_*.go) ya no lo importa ni lo registra nadie: el árbol de trabajo ya quitó `dragonball.Register(v1)` y su import de internal/handlers/routes.go. Solo se importan entre sí sus propios subpaquetes y sus propios tests, y ninguna ruta /api/v1/dragonball/* la consume el frontend, la TV ni el escritorio. | ✓ | mecánica + revisión manual |
| DM-02 | Media | `internal/database/models/models.go:336-345` (+6 ediciones) | Código Muerto | El modelo models.UserMediaProgress se registra en AutoMigrate, el flush de telemetría le hace un upsert en lote cada vez que algún episodio supera el 90 por ciento, y el cleanup la limpia al borrar medios, pero ninguna consulta, handler, DTO ni cliente la lee jamás. | ✓ | mecánica + revisión manual |
| DM-03 | Media | `internal/handlers/proxy.go:1-284` (+4 ediciones) | Código Muerto | La ruta /api/v1/proxy (handler VideoProxy, proxy HLS/video hacia URLs remotas arbitrarias, 284 lineas en proxy.go) no es llamada por la web, la app de TV, el escritorio Tauri ni los scripts; solo se autorreferencia al reescribir playlists dentro del propio proxy. Es ademas una superficie SSRF/proxy abierto expuesta a la LAN sin uso real. | ✓ | mecánica + revisión manual |
| DM-04 | Media | `internal/handlers/routes_library.go:14-14` (+1 ediciones) | Código Muerto | El listado paginado de local files no tiene consumidor: la web usa /library/collection, /anime-entry/:id y /anime-entry/:id/local-files, y la TV usa /library/collection. El archivo internal/handlers/localfiles.go contiene unicamente este handler. | ✓ | mecánica + revisión manual |
| DM-05 | Media | `internal/handlers/routes_settings.go:18-19` (+7 ediciones) | Código Muerto | HandleTMDBGetDetails y HandleTMDBImages no tienen consumidores (la web solo usa /tmdb/search, /tmdb/episode y /library/local-files/tmdb-assign). Al quitarlos quedan huerfanos GetMovieAlternativeTitles, GetTVAlternativeTitles, GetMovieImages, GetTVImages y los tipos AlternativeTitle, AlternativeTitlesResponse, TMDBImage e ImagesResponse del paquete internal/api/tmdb. | ✓ | mecánica + revisión manual |
| DM-06 | Media | `internal/handlers/routes_streaming.go:11-12` (+1 ediciones) | Código Muerto | HandleGetMediastreamSettings y HandleSaveMediastreamSettings no tienen consumidor en web, TV ni escritorio. El estado de mediastream se inicializa en el arranque (InitOrRefreshMediastreamSettings) y el cliente guarda sus ajustes por PATCH /settings. | ✓ | mecánica + revisión manual |
| DM-07 | Media | `internal/handlers/routes_streaming.go:36-39` (+5 ediciones) | Código Muerto | HandlePlaybackSync no tiene ningun cliente: la web reporta el progreso por WebSocket (playback-heartbeat) y por PATCH /continuity/item; la TV usa /continuity/item. La ruta, el handler y su entrada en la lista blanca de escrituras LAN son codigo sin llamadores. | ✓ | mecánica + revisión manual |
| DM-08 | Media | `internal/handlers/routes.go:329-330` (+9 ediciones) | Código Muerto | Las rutas GET /api/v1/intelligence/best-source y /stats no tienen consumidores; su unico uso arrastra a Handler.IntelligenceSelector y a todo el motor de seleccion (selector.go, scorer.go, cache.go, types.go de internal/intelligence, ~670 lineas) que ningun otro codigo de produccion usa. Ademas intelligence.NewSelector se construye en cada arranque. | ✓ | mecánica + revisión manual |
| DM-09 | Baja | `internal/core/feature_flags.go:20-20` (+16 ediciones) | Código Muerto | FeatureManager, AnimeFillerList, jikan_platform.Platform, SimulatedPlatform, los clientes anilist y jikan y los proveedores AniListProvider/JikanProvider guardan un *zerolog.Logger en un campo que ningún método lee (todos figuran como 'field logger is unused' en la semilla). Se eliminan los campos y su asignación; donde el parámetro del constructor queda sin uso se pasa a '_' para no tocar a los llamadores. | ✓ | mecánica |
| DM-10 | Baja | `internal/core/migrations.go:1-63` (+7 ediciones) | Código Muerto | runMigrations solo calcula App.ShowTour a partir de un mapa Tours con la unica entrada heredada '3.5.0'; ShowTour se expone como showChangelogTour en /status pero ningun cliente (web, desktop, TV) lo lee, asi que todo el archivo y su cableado son codigo muerto. | ✓ | mecánica + revisión manual |
| DM-11 | Baja | `internal/database/db/db_migrations.go:142-145` | Código Muerto | La migración crea el índice (account_id, updated_at DESC) sobre watch_histories, pero ninguna consulta ordena esa tabla por updated_at: Continue Watching sale del filecache de continuidad y la única lectura de la tabla (BuildChronologyProgress) filtra por media_id y account_id. | ✓ | mecánica + revisión manual |
| DM-12 | Baja | `internal/database/db/db.go:28-28` (+3 ediciones) | Código Muerto | SetOnError guarda un callback en Database.OnError y core/app.go lo registra para emitir un toast de error por WebSocket, pero ningun codigo invoca jamas db.OnError, asi que el toast 'DB Error' es inalcanzable. | ✓ | mecánica + revisión manual |
| DM-13 | Baja | `internal/database/models/dto/normalized_media.go:23-23` (+2 ediciones) | Código Muerto | NormalizedMedia declara ImdbRating, ImdbVotes, Director, Awards, Rated, RTRating (comentados como 'enrichment OMDb' que no existe) y Relations con su tipo NormalizedMediaRelation; ningun codigo los lee ni los escribe. | ✓ | mecánica + revisión manual |
| DM-14 | Baja | `internal/handlers/routes_drive.go:13-13` (+4 ediciones) | Código Muerto | El callback de Google Drive se registra para GET y POST con un handler de doble rama. La web solo usa el flujo de redirect del navegador (GET, popup que hace postMessage KAMEHOUSE_DRIVE_CONNECTED); nadie hace POST a /drive/callback con code/clientId/clientSecret/redirectUri en el cuerpo. | ✓ | mecánica + revisión manual |
| DM-15 | Baja | `internal/handlers/routes_library.go:10-10` (+4 ediciones) | Código Muerto | HandleGetScanStatus no tiene consumidor: la web recibe el estado del escaneo por WebSocket (WSEvents.SCAN_STATUS) y no existe ninguna llamada a scan/status. Al quitarlo, db.GetScanSummaries y el tipo dto.ScanSummaryItem solo eran usados por este handler. | ✓ | mecánica + revisión manual |
| DM-16 | Baja | `internal/handlers/routes_streaming.go:24-27` | Código Muerto | Hay dos pares de rutas hacia el mismo handler (subs/subtitles y subs/pgs/subtitles/pgs). Los clientes usan solo /subtitles (texto) y /subs/pgs (PGS); /subs y /subtitles/pgs son alias duplicados sin consumidor. | ✓ | mecánica + revisión manual |
| DM-17 | Baja | `internal/handlers/routes.go:9-11` (+1 ediciones) | Código Muerto | limitersCache es un hashicorp lru.Cache (con su propio lock) creado con tamano 1000, asi que lru.New nunca devuelve error ni nil; las ramas 'limitersCache != nil' / 'limitersCache == nil' son inalcanzables y reasignan una variable de paquete sin sincronizacion. limiterMu solo agrega un segundo mutex global en cada fallo de cache (cada IP nueva). | ✓ | mecánica + revisión manual |
| DM-18 | Baja | `internal/library/scanner/discovery.go:36-44` | Código Muerto | En discoverFilePaths se construye existingFolders recorriendo todos los ExistingLocalFiles (filepath.Dir + NormalizePath + inserción en mapa por archivo) y la variable no se vuelve a usar: es trabajo y memoria muertos en cada escaneo. | ✓ | mecánica + revisión manual |
| DM-19 | Baja | `internal/library/scanner/scanner_engine.go:39-42` (+2 ediciones) | Código Muerto | Scanner.MatchingAlgorithm y ScannerOptions.MatchingAlgorithm se copian en NewScanner, pero ningún llamador (handlers/scan.go, autoscanner) lo rellena y ningún código del escáner lo lee: es un resto del matcher legacy. | ✓ | mecánica + revisión manual |
| DM-20 | Baja | `internal/matroska/types.go:10-12` (+1 ediciones) | Código Muerto | internal/matroska/types.go arrastra el modelo de demuxing de paquetes de la librería original (struct Packet, constantes UnknownStart/UnknownEnd/KF/GAP/StreamMask/StreamShift y SeekToPrevKeyFrame/SeekToPrevKeyFrameStrict). El paquete solo parsea cabeceras, pistas, cues, capítulos, tags y adjuntos; no existe ReadPacket ni Seek y nadie referencia estos símbolos. | ✓ | mecánica |
| DM-21 | Baja | `internal/mediastream/cassette/pipeline.go:83-83` (+12 ediciones) | Código Muerto | Cinco piezas de estado se asignan y jamás se consultan: head.stdin en cassette/pipeline.go, drive.Client.tokenSource, mediastream.Repository.fileCacher y Repository.database (con la opción NewRepositoryOptions.Database y su asignación en core/modules.go) y la variable segmentCount de pgs.DecodePacket. Las tres primeras aparecen como 'unused' en la semilla de linter. | ✓ | mecánica + revisión manual |
| DM-22 | Baja | `internal/util/hmac_auth.go:46-51` (+4 ediciones) | Código Muerto | Cuatro símbolos de producción no tienen ningún llamador ni en código de producción ni en pruebas: el getter HMACAuth.TTL, el método RWMutexMap.LoadAndDelete, el setter RangeSource.SetChunk y el error centinela extsubs.ErrTooLarge. Al quitar ErrTooLarge el import "errors" de store.go queda huérfano y también se elimina. | ✓ | mecánica + revisión manual |
| DM-23 | Baja | `internal/util/strings.go:3-18` (+7 ediciones) | Código Muerto | util.IsBase64 (con su regexp reBase64Chars y su test), filecache.Cacher.Clear y Demuxer/MatroskaParser.GetCuesPos no tienen ningún llamador de producción; solo los invocan pruebas que existen únicamente para ellos. Se eliminan los símbolos junto con esas pruebas, y la prueba de seekhead lee el campo cuesPos directamente. | ✓ | mecánica + revisión manual |
| OP-01 | Alta | `internal/api/anilist/client.go:3-25` (+1 ediciones) | Optimización | Client.GetMediaByID solo mira la cache sync.Map antes de consultar; mientras el primer fetch no termina, cada peticion concurrente por el mismo ID pasa el chequeo de cache, consume un token del limitador y repite el mismo POST GraphQL (con characters, relations y streamingEpisodes). La Cronologia pide /anilist/episode/:id/:abs por cada tile, todos del mismo media. | ✓ | mecánica + revisión manual |
| OP-02 | Alta | `internal/library/scanner/fuzzy_matcher.go:3-8` (+4 ediciones) | Optimización | FuzzyMatchScore calcula TokenSetRatio, JaroWinkler y Levenshtein dos veces (sobre la cadena normalizada y sobre la expandida) aunque expandAcronyms devuelva la misma cadena (caso habitual). Además TokenSetRatio vuelve a llamar cleanFuzzyString sobre cadenas ya limpias (4 limpiezas extra por llamada) y LevenshteinRatio convierte a []rune solo para medir el largo y luego LevenshteinDistance las convierte otra vez. | ✓ | mecánica + revisión manual |
| OP-03 | Alta | `internal/library/scanner/matcher.go:96-98` (+6 ediciones) | Optimización | En BayesianResolve cada archivo se evalúa contra TODOS los media del catálogo y, en cada llamada a calculateBayesianScore, se vuelve a ejecutar ResolveDragonBallID(pm.Title) (ToLower, normalización, varias regexp con ReplaceAllString/FindStringSubmatch), extractUniqueYear (regexp) y strings.ToLower(pm.Title) una vez por cada título candidato. Las tres cosas dependen solo del título del archivo, no del media. | ✓ | mecánica + revisión manual |
| OP-04 | Media | `internal/database/db/db_migrations.go:155-166` (+3 ediciones) | Optimización | migrateSchema y los tags de GORM crean 7 indices que duplican a otro existente o que ninguna consulta usa (incluido file_hash en local_file, la tabla mas grande); cada INSERT/UPSERT paga su mantenimiento y AutoMigrate nunca los elimina de las bases ya creadas. | ✓ | mecánica + revisión manual |
| OP-05 | Media | `internal/drive/blockcache.go:16-17` (+5 ediciones) | Optimización | setFileMeta y Clear ejecutan dirSize (filepath.Walk de hasta ~1300 bloques) con c.mu tomado, y evict borra bloques de 16 MB uno por uno con c.mu tomado. fileMeta, download, hasBlock-path e inflightCount toman ese mismo mutex en cada pedido de rango de reproduccion, asi que mientras dura la E/S se congela todo el streaming desde Drive. Ademas varias descargas pasadas del tope lanzan evict en paralelo. | ✓ | mecánica + revisión manual |
| OP-06 | Media | `internal/handlers/anime_collection.go:3-22` (+1 ediciones) | Optimización | El handler consulta libraryCollectionCache (TTL 5 min, se vacia en cada escaneo) pero, ante un fallo de cache, cada peticion concurrente carga todos los LocalFile desde SQLite y ejecuta anime.NewLibraryCollection por su cuenta, usando ademas el ctx del request (un cliente que se va cancela el calculo). | ✓ | mecánica + revisión manual |
| OP-07 | Media | `internal/handlers/proxy.go:133-133` (+13 ediciones) | Optimización | En la reescritura de playlists HLS del proxy, cada URI (segmentos, keys, maps, variantes) pasa por toProxyURL, que hace json.Marshal(headerMap) + url2.QueryEscape + string() + concatenación. El mapa de headers es idéntico para todo el playlist, así que el trabajo se repite N veces (N = cantidad de segmentos, fácilmente 500-3000). | ✓ (condicional) | mecánica + revisión manual |
| OP-08 | Media | `internal/library/anime/intelligence.go:3-13` (+3 ediciones) | Optimización | IntelligenceService.computeIntelligence ejecuta `WHERE tmdb_id = ?` y, si falla, `WHERE id = ?` (First sobre el modelo completo, con description, synonyms, tags, genres, audio_tracks...) UNA VEZ POR EPISODIO, para leer solo Score y Genres de la misma serie. | ✓ | mecánica + revisión manual |
| OP-09 | Media | `internal/library/scanner/fuzzy_matcher.go:69-72` (+1 ediciones) | Optimización | JaroWinklerSimilarity hace []rune(s1), []rune(s2) y dos make([]bool) en cada llamada; tokenCoverageScore la invoca \|S\|x\|T\| veces por dirección, para palabras de 3-10 caracteres. Cada comparación cuesta 4 asignaciones para datos que caben de sobra en la pila. | ✓ | mecánica + revisión manual |
| OP-10 | Media | `internal/mediastream/hls_client_id.go:22-44` | Optimización | Cada petición de master/índice de video/índice de audio (y las listas pre-transcodificadas) pasa el playlist por withClientID, que lo parte con strings.Split, ejecuta uriAttrRe.ReplaceAllStringFunc sobre TODA línea que empieza con # (cada #EXTINF, con 2 asignaciones aunque no haya URI) y concatena una cadena nueva por cada línea de segmento antes del strings.Join final. | ✓ | mecánica + revisión manual |
| OP-11 | Media | `internal/mediastream/videofile/info.go:15-16` (+2 ediciones) | Optimización | Tras un fallo de la cache en disco, GetInfoContext ejecuta ffprobe directamente, sin deduplicar. La deduplicacion existente (PlaybackManager.containerGroup) solo cubre newMediaContainer y su clave incluye capacidades del cliente y tipo de stream, no solo el archivo; WarmMediaInfo, pretranscode, skipdetect y los endpoints de Drive (GetMediaInfoContext) llaman al extractor por su cuenta. | ✓ | mecánica + revisión manual |
| OP-12 | Baja | `internal/database/db/db_migrations.go:170-172` | Optimización | Varias consultas filtran library_media solo por tmdb_id (`tmdb_id = ?` / `tmdb_id IN ?`) pero el único índice que lo contiene empieza por type, así que SQLite (sin sqlite_stat1, no hay skip-scan) recorre la tabla entera. | ✓ | mecánica + revisión manual |
| OP-13 | Baja | `internal/database/db/slow_trace_logger.go:27-28` (+2 ediciones) | Optimización | Al llegar a 50 entradas, el callback after de GORM llama flushLocked con s.mu tomado: lee el archivo completo, lo deserializa, lo reserializa con indentacion (hasta 500 entradas) y lo escribe. Para Create/Update/Delete el callback corre dentro de la transaccion de escritura abierta, asi que SQLite (un solo escritor en WAL) queda retenido durante esa E/S y las demas consultas lentas se encolan en s.mu. | ✓ | mecánica + revisión manual |
| OP-14 | Baja | `internal/database/models/dto/normalized_media_helpers.go:24-28` | Optimización | GetAllTitles parte de make([]*string, 0) y hace hasta cuatro append individuales más un append de Synonyms, provocando 3-4 reasignaciones por media. Se llama una vez por media y por archivo en el Paso 4 del matcher. | ✓ | mecánica + revisión manual |
| OP-15 | Baja | `internal/handlers/drive.go:294-295` (+3 ediciones) | Optimización | Cuatro lecturas puntuales traen todas las columnas (incluidos los blobs JSON parsed_data, embedded_metadata, technical_info, metadata) cuando solo usan 1-3 campos. | ✓ | mecánica + revisión manual |
| OP-16 | Baja | `internal/handlers/thumbnail.go:5-6` (+1 ediciones) | Optimización | thumbnailHash se calcula en cada petición a /thumbnail (incluidas las que terminan en 304 o aciertan la caché LRU) y construye la clave con fmt.Sprintf dos veces y el hex con fmt.Sprintf("%x", sha256.Sum256(...)), que pasa por reflexión y asigna varias veces; una grilla fría dispara cientos de estas llamadas. | ✓ | mecánica + revisión manual |
| OP-17 | Baja | `internal/library/scanner/persistence.go:54-55` (+1 ediciones) | Optimización | persistence.go hace `Find` de LibraryMedia completo (description, synonyms, tags, genres, audio/subtitle_tracks) en dos bucles por bloques de 500 tmdb_id, pero solo usa TmdbID, Type e ID; además cada pasada del escaneo los repite. | ✓ | mecánica + revisión manual |
| OP-18 | Media | `internal/drive/scan.go:87-118` | Optimización | El callback de ListVideoFiles llama ResolveDriveFile (parser.Parse, 5 regex y ResolveDragonBallPath) por cada archivo de la carpeta dentro de la closure pasada a updateProgress, que corre con s.mu.Lock() tomado; el mismo mutex lo toman en lectura GetClient/IsEnabled/GetFolderID en cada reproduccion de Drive. | ✓ | mecánica + revisión manual |
| OP-19 | Media | `internal/mediastream/cassette/pipeline.go:626-633` (+4 ediciones) | Optimización | prefetch() lanza `go p.runHead(p.ctx, i, true)` en cada pedido de segmento (incluso los ya listos) y runHead bloquea en governor.Acquire sin límite; como la cabeza aún no reclamó su slot en p.heads, minHeadDistance (que ignora cabezas con cmd==nil) no la ve y cada pedido siguiente deja otra goroutine parada para el mismo segmento. Al liberarse slots, las especulativas viejas pasan antes que la cabeza real del seek, y varias terminan lanzando ffmpeg duplicados para el mismo rango. | ✓ | mecánica + revisión manual |
| OP-20 | Media | `internal/mediastream/playback.go:276-277` (+2 ediciones) | Optimización | newMediaContainer reutiliza un MediaContainer cacheado si coincide el tipo pedido, y buildMediaContainer es el único lugar que consulta PreTranscoder.Ready. Un archivo reproducido en vivo antes de terminar su pre-transcode (que PreloadPlayback encola justamente para el próximo play) sigue sirviéndose por transcode en vivo en cada reproducción posterior hasta reiniciar el módulo. | ✓ | mecánica + revisión manual |
| OP-21 | Media | `internal/mediastream/playback.go:454-457` (+3 ediciones) | Optimización | startAttachmentExtraction usa LoadOrStore por hash: si una precarga (priority=false) ya registró el trabajo y espera cupo en attachmentSemaphore (2 plazas), la llamada de RequestPlayback con priority=true devuelve sin hacer nada, y los endpoints de subtítulos/PGS esperan en WaitForExtraction detrás de la cola de otros archivos. | ✓ | mecánica + revisión manual |
| OP-22 | Media | `internal/skipdetect/animethemes_match.go:3-8` (+2 ediciones) | Optimización | animeThemesScan recorre `need` en un bucle secuencial, y por episodio lanza dos pipelines ffmpeg\|fpcalc (390 s de OP y 480 s de ED); crossEpisodeScan, en cambio, reparte el mismo tipo de trabajo entre min(NumCPU,4) workers. Al ser el metodo primario, una serie larga tarda ~N veces mas de lo necesario. | ✓ | mecánica + revisión manual |
| OP-23 | Baja | `internal/library/scanner/hydrator.go:65-65` (+1 ediciones) | Optimización | samber/lo/parallel.GroupBy (v1.53.0) delega en lop.Map, que lanza una goroutine por elemento; aquí la función iteratee es `localFile.MediaID`, por lo que el paralelismo solo agrega costo. | ✓ | mecánica |
| OP-24 | Baja | `internal/library/scanner/scanner_phases.go:192-192` (+2 ediciones) | Optimización | Para cada archivo aún sin matchear, cada worker hace FileExists sobre [archivo].nfo, tvshow.nfo, anime.nfo y movie.nfo, repitiendo los 3 de carpeta por cada episodio de la misma carpeta. | ✓ | mecánica + revisión manual |
| OP-25 | Baja | `internal/skipdetect/detector.go:78-98` (+1 ediciones) | Optimización | Cuando falta la duracion y no hay AudioStreams en TechnicalInfo, loadEpisodes ejecuta ffprobe.ProbeURL para la duracion y luego preferredAudioIndex vuelve a ejecutar ffprobe.ProbeURL sobre el mismo input; un solo ProbeData contiene Format y Streams. Ademas los archivos indexados desde Drive nunca traen AudioStreams (IndexDriveFiles solo rellena Size/Duration/VideoStream), por lo que siempre caen en la rama del segundo probe. | ✓ | mecánica + revisión manual |
| RB-01 | Media | `internal/database/db/localfiles.go:1-49` (+3 ediciones) | Robustez | intelligence.go lee la variable global exportada db.CurrLocalFiles sin tomar localFilesMutex, mientras GetLocalFiles/InvalidateLocalFilesCache la escriben (carrera de datos sobre un mo.Option de dos campos). Ademas, una carga en vuelo puede publicar en la cache datos leidos antes de una escritura que ya invalido, dejando la cache rancia hasta la proxima invalidacion. | ✓ | mecánica + revisión manual |
| RB-02 | Media | `internal/events/websocket.go:187-203` (+4 ediciones) | Robustez | AddConn reemplaza y cierra la conexion anterior de un mismo id, pero el handler viejo, al fallar su ReadMessage, llama RemoveConn(id), que borra y cierra por id: termina sacando la conexion NUEVA que ya lleva ese id. Lo mismo pasa con los fallos de escritura en SendEvent y SendEventTo, que tambien eliminan por id. | ✓ | mecánica + revisión manual |
| RB-03 | Media | `internal/handlers/proxy.go:46-46` | Robustez | VideoProxy arma la peticion con videoProxyClient2.R() sin SetContext, asi que si el cliente (HLS.js, <video>) cancela o cambia de segmento mientras el upstream tarda en responder, la conexion saliente sigue abierta hasta el timeout del cliente (60 s). | ✓ (condicional) | mecánica + revisión manual |
| RB-04 | Media | `internal/handlers/system.go:189-189` | Robustez | HandleGetDiagnosticsReport escribe el zip en un io.Pipe desde una goroutine y entrega el lector a c.Stream, que solo hace io.Copy y nunca cierra el lector. Si el cliente se desconecta, el copy termina con error, nadie lee mas el pipe y la goroutine queda bloqueada para siempre en pw.Write, manteniendo abierto el archivo de log. | ✓ | mecánica + revisión manual |
| RB-05 | Media | `internal/mediastream/pretranscode/pretranscode.go:198-198` (+5 ediciones) | Robustez | Manager.transcode(ctx, job) recibe el contexto que Cancel/Delete/Stop cancelan, pero probeDuration, probeStreams y probeDurationWithFfprobe cuelgan de context.Background() (30 s cada uno, mas 40 s del GetInfo cacheado). Cancelar o parar el manager durante la fase de sondeo no corta esos procesos. | ✓ | mecánica + revisión manual |
| RB-06 | Media | `internal/skipdetect/subtitle_hints.go:82-82` (+4 ediciones) | Robustez | Detector.subtitleHints(ctx, ...) comprueba ctx solo entre episodios, pero extractSubsOnDemand lanza GetInfo (ffprobe, hasta 40 s) y ExtractAttachment(context.Background()) (ffmpeg, hasta 2 min) sin ligarlos al scan; hasta subMaxOnDemand=8 episodios por scan. | ✓ | mecánica + revisión manual |
| RB-07 | Media | `internal/util/filecache/filecache.go:353-359` | Robustez | El snapshot de saveToFile copia solo los punteros *cacheItem bajo RLock y luego los codifica a JSON sin lock, pero Get (hidratacion perezosa) y Range escriben item.Value en el lugar bajo cs.mu.Lock. Es una carrera de datos sobre un campo interface{} (lectura rota posible) que ocurre en el flujo normal: guardado diferido por un heartbeat mientras otra request lee el historial por primera vez. | ✓ | mecánica + revisión manual |
| RB-08 | Baja | `internal/api/animethemes/client.go:143-147` | Robustez | Ante un HTTP 429 el bucle de reintentos de fetchThemes hace time.Sleep(2 * time.Second) sin observar ctx.Done(). Una cancelacion (apagado del servidor o cierre del escaneo) debe esperar hasta 2 s por intento (hasta 6 s con 3 intentos) antes de que la goroutine salga. | ✓ | LLM + mecánica |
| RB-09 | Baja | `internal/api/animethemes/client.go:276-282` | Robustez | Tras copiar el audio, f.Close() no se comprueba y, si os.Rename falla (por ejemplo, destino bloqueado en Windows por otro proceso), el .tmp queda en disco. Un fallo del flush final dejaria un .ogg truncado promovido como definitivo, que la comprobacion de idempotencia inicial (info.Size() > 0, linea 246) daria por bueno para siempre. | ✓ | LLM + mecánica |
| RB-10 | Baja | `internal/handlers/health.go:56-62` (+1 ediciones) | Robustez | HandleHealth toma healthCache.mu y solo lo suelta con Unlock explicito al final de una funcion que ejecuta cinco chequeos (DB, cache, TMDB, migraciones, ffmpeg). Si cualquiera entra en panico (Echo Recover lo atrapa), el mutex queda tomado para siempre y todos los pedidos posteriores a /api/health (anonimo y sin rate limit) quedan colgados. | ✓ | mecánica + revisión manual |
| RB-11 | Baja | `internal/library/anime/swimlanes.go:142-150` | Robustez | buildEpisodeSwimlanesBatch trae `Order(episode_number ASC).Limit(len(laneNames)*50)` sobre TODAS las lanes juntas y luego recorta a 20 por lane en Go: si unas lanes acaparan los 50*N números de episodio más bajos, otras lanes reciben 0 episodios y desaparecen de la portada. | ✓ | mecánica + revisión manual |
| RB-12 | Baja | `internal/library/scanner/discovery.go:71-71` | Robustez | El filtro util.IsValidMediaFile comprueba strings.HasPrefix(path, "._"), pero discoverFilePaths le pasa la ruta completa (siempre absoluta, p. ej. D:\Anime\._Ep01.mkv), de modo que la condición nunca se cumple y los archivos de metadatos AppleDouble de macOS (._*.mkv, ~4 KB) entran al escaneo como si fueran videos. | ✓ | mecánica + revisión manual |
| RB-13 | Baja | `internal/mediastream/playback.go:297-301` (+1 ediciones) | Robustez | PlaybackManager.buildMediaContainer lee directamente el campo p.repository.settings (un mo.Option, struct de dos palabras: bool + puntero) con IsPresent()+MustGet() sin tomar settingsMu, mientras Repository.InitializeModules lo reemplaza bajo settingsMu.Lock(). Es una carrera de datos sobre el Option y MustGet() de un Option que el lector vio como presente se evalua en una segunda lectura no atomica. | ✓ | mecánica + revisión manual |
| RB-14 | Baja | `internal/skipdetect/fpcalc.go:90-90` (+3 ediciones) | Robustez | EnsureFpcalcBinary descarga el release con client.Get(release.url) (timeout fijo de 2 min, sin contexto) aunque su unico caller, ScanSeries, tiene un ctx cancelable; cancelar el scan o apagar el servidor espera a que termine la descarga. | ✓ | mecánica + revisión manual |
| RB-15 | Alta | `internal/handlers/thumbnail.go:299-299` | Robustez | ensureThumbnailFile le pasa a ffmpeg un archivo de salida llamado <hash>.jpg.<nanos>.tmp. ffmpeg decide el formato por la extension final y .tmp no corresponde a ningun muxer, asi que toda extraccion en frio de un video local falla. | ✓ | mecánica + revisión manual |
| RB-16 | Alta | `internal/library/filesystem/mediapath.go:8-8` (+2 ediciones) | Robustez | createLocalFiles lanza 2*NumCPU workers que llaman a dto.NewLocalFileS(path, libraryPaths) con el MISMO slice, y SeparateFilePathS hace sort.Slice(potentialPrefixes, ...) sobre él en cada llamada. | ✓ | mecánica + revisión manual |
| RB-17 | Media | `internal/library/scanner/watcher.go:58-78` (+1 ediciones) | Robustez | El callback de WalkDir devuelve el error de Watcher.Add; un solo directorio no vigilable corta el recorrido, Init devuelve error y core.initLibraryWatcher retorna sin iniciar StartWatching ni cerrar el fsnotify.Watcher. | ✓ | mecánica + revisión manual |
| RB-18 | Media | `internal/library/scanner/watcher.go:119-123` | Robustez | El filtro de extensión trata como archivo no válido cualquier Create cuyo nombre tenga punto (filepath.Ext), de modo que carpetas como 'Show.S01.1080p.WEB-DL-GRP' o 'Mob Psycho 100 S2.5' no se registran en fsnotify. | ✓ | mecánica + revisión manual |
| RB-19 | Media | `internal/mediastream/cassette/pipeline.go:196-215` (+1 ediciones) | Robustez | Al crear un Pipeline, una goroutine escanea el directorio y marca como listos todos los segmentos `...-0-N.ts` presentes, sin comprobar que estén completos. El archivo más nuevo de un tramo puede ser el que ffmpeg estaba escribiendo cuando lo mataron (SIGKILL/taskkill), o el que una cabeza lanzada en ese momento escribe ahora (el escaneo corre concurrente con el primer runHead), y se serviría truncado. | ✓ | mecánica + revisión manual |
| RB-20 | Media | `internal/mediastream/playback.go:196-200` (+2 ediciones) | Robustez | Todas las precargas de "zero latency" usan el mismo cliente del tracker (preloadClientID). Si se solapan dos (p. ej. pasar el mouse por dos episodios en 25 s), cada GetVideoSegment cambia la ruta de ese único cliente y ClientTracker.handleClientUpdate mata la sesión de la ruta anterior, de modo que ambas precargas se reinician mutuamente; además PreloadDone de una detiene las cabezas de la ruta del otro. | ✓ | mecánica + revisión manual |
| RB-21 | Media | `internal/skipdetect/detector.go:176-180` (+1 ediciones) | Robustez | ScanSeries consulta IsScanning y luego llama setScanning(true) en dos secciones criticas distintas; dos llamadas concurrentes para el mismo mediaID pasan ambas la comprobacion y ejecutan el pipeline completo (ffmpeg\|fpcalc, descargas de themes, upsert) en paralelo. | ✓ | mecánica + revisión manual |
| RB-22 | Media | `internal/util/cache/image_cache.go:4-4` (+3 ediciones) | Robustez | Set hace Remove, ajusta currentBytes y luego Add sin exclusion mutua. Si dos goroutines guardan la misma clave a la vez, el segundo Add reemplaza el valor sin disparar el callback de eviccion y currentBytes queda inflado en len(data) de forma permanente. | ✓ | mecánica + revisión manual |
| RB-23 | Media | `internal/util/proxies/image_proxy.go:28-29` | Robustez | imageProxyClient usa la lectura automatica de req v3: el cliente hace io.ReadAll del cuerpo completo antes de devolver la respuesta, de modo que el io.LimitReader(resp.Body, 25MB+1) de fetchImage opera sobre un buffer que ya esta entero en memoria y luego lo copia otra vez. | ✓ | mecánica + revisión manual |
| RB-24 | Baja | `internal/drive/client.go:62-73` | Robustez | config.TokenSource(context.Background(), ...) hace que el refresco use http.DefaultClient (sin Timeout ni ResponseHeaderTimeout) y que ReuseTokenSource lo serialice con un mutex; si el endpoint OAuth acepta la conexion y no responde, todos los pedidos a Drive quedan bloqueados en oauth2.Transport sin que su contexto pueda cancelarlos. | ✓ | mecánica + revisión manual |
| RB-25 | Baja | `internal/library/scanner/hydrator.go:361-365` (+1 ediciones) | Robustez | Las dos esperas del limitador antes de GetAnimeMetadata usan context.Background() aunque el ctx del errgroup (cancelado con el escaneo) está disponible en hydrateGroupMetadata. | ✓ | mecánica |

Leyenda: ✓ aplicado y compilado en la copia de prueba · ⚠ no se pudo aplicar mecánicamente.

## 2. Plan de implementación detallado

### Fase 1: Eliminación de código muerto

#### DM-01 · Eliminar el paquete completo internal/api/dragonball (módulo huérfano de ~1.800 líneas de producción)

- **Severidad:** Alta · **Tipo:** Código Muerto · **Verificación:** mecánica + revisión manual
- **Problema:** El módulo internal/api/dragonball (router, controller, service, repository, domain, dto y 6 ficheros seed_*.go) ya no lo importa ni lo registra nadie: el árbol de trabajo ya quitó `dragonball.Register(v1)` y su import de internal/handlers/routes.go. Solo se importan entre sí sus propios subpaquetes y sus propios tests, y ninguna ruta /api/v1/dragonball/* la consume el frontend, la TV ni el escritorio.

**DM-01.1 — Archivo:** `internal/api/dragonball/router.go` · **Líneas:** 1–64 · **Acción:** delete-file

Eliminar el archivo completo. Primeras líneas actuales:

```go
// Package dragonball es el punto de entrada del módulo de la enciclopedia de
// Dragon Ball. Aquí se realiza la inyección de dependencias (repository ->
// service -> controller) y el registro de las rutas REST sobre un grupo de Echo.
//
// Arquitectura en capas:
//
//	domain      -> entidades puras + interfaz Repository (sin dependencias)
//	repository  -> almacenamiento en memoria + datos seed (seed_*.go)
//	service     -> lógica de negocio (filtros, paginación, validación)
//	controller  -> adaptadores HTTP (Echo) con envoltorio JSON estándar
```

**DM-01.2 — Archivo:** `internal/api/dragonball/router_test.go` · **Líneas:** 1–204 · **Acción:** delete-file

Eliminar el archivo completo. Primeras líneas actuales:

```go
package dragonball_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/labstack/echo/v4"
```

**DM-01.3 — Archivo:** `internal/api/dragonball/controller/controller.go` · **Líneas:** 1–131 · **Acción:** delete-file

Eliminar el archivo completo. Primeras líneas actuales:

```go
// Package controller adapta las peticiones HTTP de Echo a llamadas al servicio y
// serializa las respuestas con el mismo envoltorio {"data"|"error"} que usa el
// resto de la API de KameHouse, para que el cliente TypeScript tenga una forma
// predecible.
package controller

import (
	"net/http"
	"strconv"
```

**DM-01.4 — Archivo:** `internal/api/dragonball/domain/models.go` · **Líneas:** 1–102 · **Acción:** delete-file

Eliminar el archivo completo. Primeras líneas actuales:

```go
// Package domain contiene las entidades puras y los contratos de la API de
// Dragon Ball. No depende de ningún framework (Echo, base de datos, etc.): sólo
// tipos de datos y la interfaz del repositorio. El resto de las capas
// (repository, service, controller) dependen de este paquete y nunca al revés.
package domain

// MilestoneType clasifica un hito narrativo para permitir el filtrado por
// categoría en el endpoint de milestones.
type MilestoneType string
```

**DM-01.5 — Archivo:** `internal/api/dragonball/domain/repository.go` · **Líneas:** 1–44 · **Acción:** delete-file

Eliminar el archivo completo. Primeras líneas actuales:

```go
package domain

// EpisodeQuery encapsula los filtros aplicables a la guía episódica. Los campos
// vacíos (cadena vacía o cero/nil) se interpretan como "sin filtro".
type EpisodeQuery struct {
	SeriesID string // Filtra por serie ("classic", "z", ...)
	SagaID   string // Filtra por saga
	Villain  string // Coincidencia parcial (case-insensitive) sobre los villanos
	Query    string // Búsqueda libre sobre título y hito
	Filler   *bool  // Filtro de relleno: nil => todos, true => solo relleno, false => solo canon
```

**DM-01.6 — Archivo:** `internal/api/dragonball/dto/dto.go` · **Líneas:** 1–36 · **Acción:** delete-file

Eliminar el archivo completo. Primeras líneas actuales:

```go
// Package dto define los objetos de transferencia (request/response) de la API
// de Dragon Ball. Mantener los DTOs separados del dominio permite evolucionar el
// contrato HTTP (paginación, campos derivados) sin contaminar las entidades.
package dto

import "kamehouse/internal/api/dragonball/domain"

// SeriesSummary enriquece la entidad Series con el conteo de sagas para el
// listado de resumen.
type SeriesSummary struct {
```

**DM-01.7 — Archivo:** `internal/api/dragonball/repository/anchors_test.go` · **Líneas:** 1–90 · **Acción:** delete-file

Eliminar el archivo completo. Primeras líneas actuales:

```go
package repository

import (
	"strings"
	"testing"
)

// The user requested at least 40 anchors (8 per series) with source URLs explicitly documented.
// Authority: TMDB global numbering or Dragon Ball Fandom wiki.
// URL Source: All cited within comments.
```

**DM-01.8 — Archivo:** `internal/api/dragonball/repository/memory.go` · **Líneas:** 1–353 · **Acción:** delete-file

Eliminar el archivo completo. Primeras líneas actuales:

```go
// Package repository implementa el almacenamiento en memoria de la enciclopedia
// de Dragon Ball. Los datos viven en los archivos seed_*.go (uno por serie) y se
// cargan una única vez al construir el repositorio, indexándose para consultas
// O(1) por serie/saga y O(log n) por número de episodio.
package repository

import (
	"sort"
	"strings"
```

**DM-01.9 — Archivo:** `internal/api/dragonball/repository/memory_test.go` · **Líneas:** 1–91 · **Acción:** delete-file

Eliminar el archivo completo. Primeras líneas actuales:

```go
package repository

import (
	"fmt"
	"testing"
)

// TestEpisodeCoverageIsComplete verifica que las entradas de guía de cada serie
// cubran de forma contigua y sin solapamientos todos los episodios declarados,
// desde 1 hasta EpisodeCount. Esto protege contra huecos o rangos duplicados al
```

**DM-01.10 — Archivo:** `internal/api/dragonball/repository/seed_classic.go` · **Líneas:** 1–201 · **Acción:** delete-file

Eliminar el archivo completo. Primeras líneas actuales:

```go
package repository

import "kamehouse/internal/api/dragonball/domain"

func classicSeries() domain.Series {
	return domain.Series{
		ID:           "classic",
		Title:        "Dragon Ball",
		TMDBID:       12609,
		Year:         "1986–1989",
```

**DM-01.11 — Archivo:** `internal/api/dragonball/repository/seed_daima.go` · **Líneas:** 1–53 · **Acción:** delete-file

Eliminar el archivo completo. Primeras líneas actuales:

```go
package repository

import "kamehouse/internal/api/dragonball/domain"

func daimaSeries() domain.Series {
	return domain.Series{
		ID:           "daima",
		Title:        "Dragon Ball Daima",
		TMDBID:       236994,
		Year:         "2024–2025",
```

**DM-01.12 — Archivo:** `internal/api/dragonball/repository/seed_gt.go` · **Líneas:** 1–104 · **Acción:** delete-file

Eliminar el archivo completo. Primeras líneas actuales:

```go
package repository

import "kamehouse/internal/api/dragonball/domain"

func gtSeries() domain.Series {
	return domain.Series{
		ID:           "gt",
		Title:        "Dragon Ball GT",
		TMDBID:       12697,
		Year:         "1996–1997",
```

**DM-01.13 — Archivo:** `internal/api/dragonball/repository/seed_milestones.go` · **Líneas:** 1–59 · **Acción:** delete-file

Eliminar el archivo completo. Primeras líneas actuales:

```go
package repository

import "kamehouse/internal/api/dragonball/domain"

// milestones es el catálogo curado de hitos narrativos clave de la franquicia,
// clasificados explícitamente por tipo para permitir el filtrado
// (transformation, sacrifice, wish, death, event). A diferencia del campo
// Milestone de cada episodio (texto libre), esta lista destaca los momentos más
// significativos con una categoría estable.
func milestones() []domain.Milestone {
```

**DM-01.14 — Archivo:** `internal/api/dragonball/repository/seed_super.go` · **Líneas:** 1–182 · **Acción:** delete-file

Eliminar el archivo completo. Primeras líneas actuales:

```go
package repository

import "kamehouse/internal/api/dragonball/domain"

func superSeries() domain.Series {
	return domain.Series{
		ID:           "super",
		Title:        "Dragon Ball Super",
		TMDBID:       62715,
		Year:         "2015–2018",
```

**DM-01.15 — Archivo:** `internal/api/dragonball/repository/seed_z.go` · **Líneas:** 1–327 · **Acción:** delete-file

Eliminar el archivo completo. Primeras líneas actuales:

```go
package repository

import "kamehouse/internal/api/dragonball/domain"

func zSeries() domain.Series {
	return domain.Series{
		ID:           "z",
		Title:        "Dragon Ball Z",
		TMDBID:       12971,
		Year:         "1989–1996",
```

**DM-01.16 — Archivo:** `internal/api/dragonball/service/service.go` · **Líneas:** 1–161 · **Acción:** delete-file

Eliminar el archivo completo. Primeras líneas actuales:

```go
// Package service contiene la lógica de negocio de la API de Dragon Ball:
// normalización de paginación, validación de filtros y ensamblado de los DTOs de
// respuesta. Depende únicamente del dominio (interfaz Repository) y de los DTOs,
// nunca de Echo ni del transporte HTTP.
package service

import (
	"errors"
	"strings"
```

**DM-01.17 — Archivo:** `internal/api/dragonball/service/service_test.go` · **Líneas:** 1–209 · **Acción:** delete-file

Eliminar el archivo completo. Primeras líneas actuales:

```go
package service_test

import (
	"testing"

	"kamehouse/internal/api/dragonball/domain"
	"kamehouse/internal/api/dragonball/repository"
	"kamehouse/internal/api/dragonball/service"
)
```

- **Razón técnica:** Historia: en HEAD, internal/handlers/routes.go importaba kamehouse/internal/api/dragonball y llamaba a dragonball.Register(v1); el diff del árbol de trabajo elimina ambas líneas (git diff HEAD muestra '-"kamehouse/internal/api/dragonball"' y '-dragonball.Register(v1)'), por lo que NewModule/RegisterRoutes/Register, y todo lo que cuelga de ellos, quedaron inalcanzables (coincide con deadcode.txt, que marca todo el paquete: Controller.*, Service.*, MemoryRepository.*, seed*, Episode.Covers, etc.). La enciclopedia en memoria (6 series, sagas, episodios, villanos, hitos) no tiene ningún consumidor: la única ruta Dragon Ball viva es /api/v1/lore/dragonball (HandleGetDragonballLore en internal/handlers/lore.go), que es independiente y usa su propio origen de datos. El comentario de Module ('por si otras partes del servidor necesitan reutilizar el servicio, p. ej. para enriquecer el endpoint de lore') describe un uso que nunca se cableó. Los ficheros scanner/dragonball_resolver*.go, scanner/dragonball_path_resolver*.go, scanner/dragonball_sagas.go, database/db/db_dragonball_heal.go y metadata_provider/dragonball_filler.go NO importan este paquete ni comparten sus tipos o semillas (son lógica de escaneo/migración distinta), así que se quedan. Los 4 ficheros _test.go del paquete solo prueban código del propio módulo y se borran con él.
- **Impacto esperado:** Elimina 17 ficheros y 2.411 líneas (≈1.800 de producción + ≈590 de tests) del árbol, incluido ~1.000 líneas de datos seed duplicados respecto a otras fuentes de cronología. Reduce el tiempo de compilación/vet/test del servidor (6 paquetes menos y 4 suites menos) y quita un módulo con 6 rutas REST fantasma que nadie mantiene. Sin cambio de comportamiento observable respecto al árbol de trabajo actual (las rutas /api/v1/dragonball/* ya no se registran).
- **Revisión manual (22/10):** PRECONDICIÓN: en HEAD, internal/handlers/routes.go todavía importa y registra el módulo (dragonball.Register(v1), líneas 21 y 309); el árbol de trabajo actual (cambio sin commitear de otra sesión) ya lo quitó. Este paso solo es válido sobre ese árbol: aplicarlo sobre un checkout limpio de HEAD rompe la compilación. Verificado además: ningún importador fuera del propio paquete y ningún consumidor en la web, la TV ni el escritorio (las 6 menciones de 'dragonball' en types.ts y las 3 de endpoints.ts son la ruta de lore, no este módulo).
- **Riesgos / a revisar:** 1) ORDEN/COMMIT: el HEAD de git todavía importa el paquete desde routes.go; el borrado solo compila porque el árbol de trabajo ya quitó import y Register. Hay que commitear el cambio de routes.go junto con este borrado (si se descartaran los cambios sin commitear de routes.go, hay que volver a quitar import+llamada o el build rompe). 2) Se pierde del árbol la guía episódica curada (seed_*.go, ~1.000 líneas con TMDBIDs, sagas, villanos, hitos y 90 anclas de test con URLs de fuente); queda recuperable en git (commits 462a906 / 4c22bd7 / d2feed6). Si se quisiera reutilizar para el endpoint de lore o la cronología, habría que moverlo antes; hoy ningún consumidor lo hace. 3) Se elimina la API /api/v1/dragonball/{series,episodes,episodes/:series/:number,villains,milestones,stats} respecto a HEAD; no hay clientes (web, TV, escritorio, bundle estático) que la llamen. 4) codegen/generated/public_structs.json (generado, modificado en el árbol) conserva 17 entradas con filepath '../internal/api/dragonball/...' (Controller, MilestoneType, Series, Saga, Episode, Villain, Milestone, Stats, SeriesStats, EpisodeQuery, SeriesSummary, Pagination, EpisodeList, EpisodeDetail, MemoryRepository, Module, Service): quedarán obsoletas hasta la próxima ejecución de `go run ./codegen` (no ejecutada aquí por la regla de solo lectura); no afecta al build ni a apps/web/src/api/generated/*.ts porque ningún handler referencia esos tipos. 5) Los ficheros del worktree están en CRLF (cr == nº de líneas), el bloque 'before' se dio con saltos LF; para los delete-file solo importa la ruta. 6) Tras borrar, verificar con `go build ./... && go vet ./... && go test ./internal/handlers/... ./internal/library/scanner/...` (no se tocó nada de eso, solo confirmación). Ningún cambio en go.mod.
- **Evidencia del hallazgo:** 1) Grep 'api/dragonball' en todo el árbol .go de apps/server: ningún fichero fuera de internal/api/dragonball/ lo importa. 2) `go list -f '{{.ImportPath}} {{join .Imports " "}} {{join .TestImports " "}} {{join .XTestImports " "}}' ./...` filtrado por 'kamehouse/internal/api/dragonball': solo devuelve los 6 paquetes del propio módulo (dragonball, controller, domain, dto, repository, service); es decir, ni código de producción ni tests de otros paquetes lo usan. 3) `git grep -n api/dragonball HEAD` muestra que solo HEAD:internal/handlers/routes.go:21 (import) y :308 (comentario) lo referenciaban, y `git diff HEAD -- internal/handlers/routes.go` los muestra eliminados en el árbol actual; en routes.go actual solo queda v1.GET("/lore/dragonball", h.HandleGetDragonballLore). 4) Grep de las rutas (dragonball/(series|episodes|villains|milestones|stats), api/v1/dragonball, /dragonball/) en todo el repo excluyendo node_modules/.git/target/dist: cero coincidencias en apps/web/src, apps/web/src/api/generated/endpoints.ts, apps/desktop, KameHouseTV/src (grep -i dragonball ahí no devuelve nada) ni en el bundle apps/server/web/static; las únicas coincidencias están en codegen/generated/public_structs.json (salida generada, ver riesgos). codegen/generated/handlers.json solo contiene HandleGetDragonballLore (lore), ningún handler del módulo, y apps/web/src/api/generated/types.ts solo tiene DragonballLore* (del handler de lore), ningún tipo de domain/dto. 5) Los structs/identificadores del módulo (classicEpisodes, zEpisodes, MilestoneType, domain.Series, etc.) no aparecen fuera del paquete. 6) Imports de terceros del módulo: solo github.com/labstack/echo/v4 (usado por todo el servidor), no hay //go:embed, build tags ni go:generate, por lo que go.mod/go.sum no cambian. 7) Ninguna de las semillas zero-ref-identifiers/unused-strict-tests/lint marca nada del módulo (porque sus símbolos se referencian entre sí y desde sus tests); solo deadcode.txt lo detecta (50 entradas), que es la señal correcta.

#### DM-02 · Tabla user_media_progresses: solo se escribe, nadie la lee

- **Severidad:** Media · **Tipo:** Código Muerto · **Verificación:** mecánica + revisión manual
- **Problema:** El modelo models.UserMediaProgress se registra en AutoMigrate, el flush de telemetría le hace un upsert en lote cada vez que algún episodio supera el 90 por ciento, y el cleanup la limpia al borrar medios, pero ninguna consulta, handler, DTO ni cliente la lee jamás.

**DM-02.1 — Archivo:** `internal/database/models/models.go` · **Líneas:** 336–345 · **Acción:** replace

ANTES:

```go
type UserMediaProgress struct {
	BaseModel
	AnonUserId string  `gorm:"column:anon_user_id;uniqueIndex:idx_anon_media" json:"anonUserId"`
	MediaID    int     `gorm:"column:media_id;uniqueIndex:idx_anon_media" json:"mediaId"`
	Status     string  `gorm:"column:status" json:"status"`
	Progress   int     `gorm:"column:progress" json:"progress"`
	Score      float64 `gorm:"column:score" json:"score"`
}

// MetadataCache stores raw JSON responses from metadata providers (TMDB, AniList, etc.)
```

DESPUÉS:

```go
// MetadataCache stores raw JSON responses from metadata providers (TMDB, AniList, etc.)
```

**DM-02.2 — Archivo:** `internal/database/db/db_migrations.go` · **Líneas:** 103–104 · **Acción:** replace

ANTES:

```go
		&models.WatchHistory{},
		&models.UserMediaProgress{},
```

DESPUÉS:

```go
		&models.WatchHistory{},
```

**DM-02.3 — Archivo:** `internal/database/db/cleanup_manager.go` · **Líneas:** 174–176 · **Acción:** delete-lines

ANTES:

```go
			if err := tx.Where("media_id = ?", row.ID).Delete(&models.UserMediaProgress{}).Error; err != nil {
				return err
			}
```

DESPUÉS: _(se elimina el bloque)_

**DM-02.4 — Archivo:** `internal/continuity/telemetry.go` · **Líneas:** 3–12 · **Acción:** replace

ANTES:

```go
import (
	"fmt"
	"kamehouse/internal/database/db"
	"kamehouse/internal/database/models"
	"sync"
	"time"

	"github.com/rs/zerolog"
	"gorm.io/gorm/clause"
)
```

DESPUÉS:

```go
import (
	"kamehouse/internal/database/db"
	"kamehouse/internal/database/models"
	"sync"
	"time"

	"github.com/rs/zerolog"
)
```

**DM-02.5 — Archivo:** `internal/continuity/telemetry.go` · **Líneas:** 122–122 · **Acción:** delete-lines

ANTES:

```go
	var completedProgress []models.UserMediaProgress
```

DESPUÉS: _(se elimina el bloque)_

**DM-02.6 — Archivo:** `internal/continuity/telemetry.go` · **Líneas:** 137–151 · **Acción:** delete-lines

ANTES:

```go

		// If ratio is >= 90%, record the progress
		if entry.Duration > 0 && (entry.CurrentTime/entry.Duration) >= IgnoreRatioThreshold {
			anonUserId := fmt.Sprintf("%d", entry.AccountID)
			status := "watching"
			if entry.MediaID >= 1_000_000 {
				status = "completed"
			}
			completedProgress = append(completedProgress, models.UserMediaProgress{
				AnonUserId: anonUserId,
				MediaID:    entry.MediaID,
				Status:     status,
				Progress:   entry.EpisodeNumber,
			})
		}
```

DESPUÉS: _(se elimina el bloque)_

**DM-02.7 — Archivo:** `internal/continuity/telemetry.go` · **Líneas:** 161–179 · **Acción:** delete-lines

ANTES:

```go

	if len(completedProgress) > 0 {
		// Bulk Upsert in batches to avoid locking SQLite.
		// Sin transacción a propósito (SkipDefaultTransaction=true): cada fila es
		// un upsert independiente e idempotente y el flush no reintenta, así que
		// un todo-o-nada convertiría un fallo parcial en pérdida total.
		err := tm.repository.DB.Clauses(clause.OnConflict{
			Columns: []clause.Column{
				{Name: "anon_user_id"},
				{Name: "media_id"},
			},
			DoUpdates: clause.AssignmentColumns([]string{"status", "progress"}),
		}).CreateInBatches(completedProgress, 50).Error
		if err != nil {
			tm.logger.Error().Err(err).Msg("telemetry: Bulk media progress update failed")
		} else {
			tm.logger.Debug().Int("count", len(completedProgress)).Msg("telemetry: Bulk updated media progress")
		}
	}
```

DESPUÉS: _(se elimina el bloque)_

- **Razón técnica:** Grep de UserMediaProgress y de user_media_progress/AnonUserId/anon_user_id en todo apps/server (produccion y tests) solo devuelve: la definicion, AutoMigrate, internal/continuity/telemetry.go (construye y upserta) y cleanup_manager.go (Delete). No hay ningun Find/First/Scan/Raw sobre la tabla, ni handler, ni DTO; en apps/web/src/api/generated/types.ts hay 0 apariciones y no hay consumo en KameHouseTV. Es una tabla write-only: costo de escritura en cada flush de telemetria (CreateInBatches con ON CONFLICT sobre un indice unico) sin ningun consumidor. Ademas, el delete en cleanup_manager.go DEBE salir junto con el modelo: en una base nueva sin la tabla, ese Delete fallaria dentro de la transaccion y revertiria el borrado de medios colisionados.
- **Impacto esperado:** Elimina un upsert en lote por cada flush de telemetria que contenga episodios al 90 por ciento o mas (escritura SQLite en WAL sin lectores), una tabla con su indice unico idx_anon_media y unas 45 lineas de codigo. Menos contencion de escritura en la base compartida con el historial de reproduccion.
- **Revisión manual (22/10):** Verificado: UserMediaProgress solo aparece en AutoMigrate, en el upsert de telemetría y en el cleanup; ninguna consulta, DTO ni cliente (web/TV) la lee. Las bases existentes conservan la tabla huérfana (inocua). Toca internal/continuity/telemetry.go, zona de otra sesión.
- **Riesgos / a revisar:** 1) Las bases existentes conservan la tabla huerfana user_media_progresses (AutoMigrate no borra tablas); es inocua. Si se quiere limpiar, opcional: db.Migrator().DropTable("user_media_progresses") en migrateSchema (destructivo sobre datos derivados de telemetria que nadie lee; no se incluye). 2) codegen/generated/public_structs.json contiene 2 entradas de UserMediaProgress: regenerar con go run ./codegen (no se ejecuto en este analisis). 3) Los tres edits de telemetry.go y los de models.go/db_migrations.go/cleanup_manager.go deben aplicarse juntos o no compila. 4) telemetry.go esta en internal/continuity (zona de otro agente) y esta modificado en el arbol de trabajo; los edits se calcularon sobre el estado actual en disco.
- **Evidencia del hallazgo:** Grep -rn 'UserMediaProgress' *.go: telemetry.go:122,145; cleanup_manager.go:174; db_migrations.go:104; models.go:336. Grep 'user_media_progress|anon_user_id|AnonUserId' en .go: solo telemetry.go (146,169) y el tag del modelo. Grep en web generated types: 0. IgnoreRatioThreshold sigue usandose en internal/continuity/history.go:13,202. fmt y gorm.io/gorm/clause en telemetry.go solo se usan dentro de los bloques eliminados (lineas 140, 167-172). WatchHistoryRepository.DB sigue en uso por UpsertBatch y por watch_history_index_test.go.
- Nota de aplicación: línea real 120 (desfase -2); línea real 134 (desfase -3); línea real 143 (desfase -18)

#### DM-03 · Eliminar ruta GET/HEAD /api/v1/proxy (VideoProxy) sin consumidores

- **Severidad:** Media · **Tipo:** Código Muerto · **Verificación:** mecánica + revisión manual
- **Problema:** La ruta /api/v1/proxy (handler VideoProxy, proxy HLS/video hacia URLs remotas arbitrarias, 284 lineas en proxy.go) no es llamada por la web, la app de TV, el escritorio Tauri ni los scripts; solo se autorreferencia al reescribir playlists dentro del propio proxy. Es ademas una superficie SSRF/proxy abierto expuesta a la LAN sin uso real.

**DM-03.1 — Archivo:** `internal/handlers/proxy.go` · **Líneas:** 1–284 · **Acción:** delete-file

Eliminar el archivo completo. Primeras líneas actuales:

```go
package handlers

import (
	"bytes"
	"io"
	"kamehouse/internal/util"
	"net/http"
	url2 "net/url"
	"strconv"
	"strings"
```

**DM-03.2 — Archivo:** `internal/handlers/routes.go` · **Líneas:** 290–291 · **Acción:** delete-lines

ANTES:

```go
	v1.GET("/proxy", h.VideoProxy)
	v1.HEAD("/proxy", h.VideoProxy)
```

DESPUÉS: _(se elimina el bloque)_

**DM-03.3 — Archivo:** `internal/handlers/routes.go` · **Líneas:** 184–184 · **Acción:** delete-lines

ANTES:

```go
		"/api/v1/proxy",
```

DESPUÉS: _(se elimina el bloque)_

**DM-03.4 — Archivo:** `internal/handlers/routes.go` · **Líneas:** 122–122 · **Acción:** delete-lines

ANTES:

```go
		strings.HasPrefix(path, "/api/v1/proxy") ||
```

DESPUÉS: _(se elimina el bloque)_

**DM-03.5 — Archivo:** `internal/handlers/server_features_middleware.go` · **Líneas:** 42–42 · **Acción:** delete-lines

ANTES:

```go
	{"/api/v1/proxy", core.Proxy, nil, nil},
```

DESPUÉS: _(se elimina el bloque)_

- **Razón técnica:** Ningun cliente emite GET/HEAD a /api/v1/proxy. Los unicos productores de esa URL son toProxyURL/rewriteURI dentro de proxy.go, que solo corren cuando alguien ya llamo a VideoProxy. Se borra el archivo completo (handler, cliente req videoProxyClient2, rewriteURI, resolveURL, toProxyURL, isAlreadyProxied, proxyPassthroughHeaders), el registro de ruta, el prefijo en isGzipSkippedPath, la entrada en urisToSkip del logger y la regla de features /api/v1/proxy. La regla de features de /api/v1/image-proxy y core.Proxy se mantienen porque ImageProxy si se usa.
- **Impacto esperado:** -284 lineas, se cierra un proxy HTTP saliente expuesto a la LAN (superficie SSRF), un cliente HTTP global impersonando Chrome menos y se libera la dependencia github.com/5rahim/hls-m3u8 (solo la usa proxy.go).
- **Revisión manual (22/10):** Verificado: ni la web, ni la TV, ni el escritorio, ni scripts llaman a /api/v1/proxy (búsqueda por URL literal; la ruta no está en el cliente generado).
- **Riesgos / a revisar:** Regenerar codegen (apps/server/codegen -> codegen/generated/*.json y apps/web/src/api/generated/*.ts; el proxy no figuraba en endpoints.ts asi que el cambio ahi es nulo, pero handlers.json/public_structs.json si cambian). Ejecutar 'go mod tidy' despues: github.com/5rahim/hls-m3u8 queda sin uso (el build y vet no fallan por un require sobrante). Comentario en internal/util/url.go:105 sigue mencionando /api/v1/proxy (solo texto). Si algun reproductor externo (mpv por URL) usara el proxy, habria que confirmarlo: en el repo no hay evidencia. Si se ejecuta este paso, OP-07 y RB-03 (que editan proxy.go) quedan sin objeto y deben omitirse.
- **Evidencia del hallazgo:** Busqueda literal '/proxy', 'proxy?' y 'api/v1/proxy' (excluyendo image-proxy) en apps/web/src, KameHouseTV/src, apps/desktop/src-tauri/src y scripts: 0 resultados. endpoints.ts generado tampoco la lista. Grep Go de VideoProxy|toProxyURL|rewriteURI|resolveURL|isAlreadyProxied|videoProxyClient2|proxyPassthroughHeaders fuera de proxy.go: solo routes.go:290-291. Los helpers util.IsValidProxyURL, FilterProxyRequestHeaders, ProxySafeDialContext, HardenProxyResponse siguen usados por internal/util/proxies/image_proxy.go (no quedan huerfanos). SafeProxyContentType no tenia llamadores de produccion y se borro en el lote 3 (la politica vigente es SafeImageContentType). Ningun test referencia /api/v1/proxy ni isGzipSkippedPath con ese prefijo (routes_gzip_test.go no lo afirma). grep de 5rahim/hls-m3u8: solo handlers/proxy.go.

#### DM-04 · Eliminar GET /library/local-files y su handler (HandleGetLocalFiles)

- **Severidad:** Media · **Tipo:** Código Muerto · **Verificación:** mecánica + revisión manual
- **Problema:** El listado paginado de local files no tiene consumidor: la web usa /library/collection, /anime-entry/:id y /anime-entry/:id/local-files, y la TV usa /library/collection. El archivo internal/handlers/localfiles.go contiene unicamente este handler.

**DM-04.1 — Archivo:** `internal/handlers/routes_library.go` · **Líneas:** 14–14 · **Acción:** delete-lines

ANTES:

```go
	v1Library.GET("/local-files", h.HandleGetLocalFiles)
```

DESPUÉS: _(se elimina el bloque)_

**DM-04.2 — Archivo:** `internal/handlers/localfiles.go` · **Líneas:** 1–90 · **Acción:** delete-file

Eliminar el archivo completo. Primeras líneas actuales:

```go
package handlers

import (
	"strconv"

	"kamehouse/internal/database/db"
	"kamehouse/internal/database/models"
	"kamehouse/internal/database/models/dto"

	"github.com/labstack/echo/v4"
```

- **Razón técnica:** Ningun cliente llama a GET /api/v1/library/local-files (el unico 'local-files' que usa la web es la ruta distinta anime-entry/{id}/local-files, armada por concatenacion en anime_entries.hooks.ts:20). El handler no tiene otros llamadores en Go. db.LocalFileModelToDto sigue usado por local_file_relational.go:46 y :103, y models.LocalFile/dto.LocalFile por el resto del paquete, por lo que no quedan helpers huerfanos.
- **Impacto esperado:** Quita un endpoint que ademas hace un Count + Find paginado sobre la tabla local_files (y una rama ?page=all que carga todo en memoria); 90 lineas menos y una ruta LAN de lectura menos.
- **Revisión manual (22/10):** Verificado: GetLocalFiles (LOCALFILES) no se usa en la web ni la TV, ni por constante ni por URL.
- **Riesgos / a revisar:** Regenerar el codegen (apps/server/codegen) para actualizar codegen/generated/handlers.json, public_structs.json y apps/web/src/api/generated/endpoints.ts (grupo LOCALFILES.GetLocalFiles) y endpoint.types.ts. Los tests security_p0_test.go:127, sensitive_endpoint_test.go:46/84 y server_auth_middleware.go:135 (DELETE /library/local-files) operan sobre cadenas de ruta, no sobre el router, por lo que siguen pasando y no requieren cambios; aun asi, la entrada DELETE de sensitiveMethodRoutes y el comentario 'los clientes LAN listan la biblioteca' quedan obsoletos y se pueden depurar aparte. Si una futura app LAN quisiera listar archivos locales por ruta, deberia reintroducirse.
- **Evidencia del hallazgo:** Bucle de shell de fragmentos: 'library/local-files' en apps/web/src (sin generated) = 0, KameHouseTV/src = 0, apps/desktop/src-tauri/src = 0, scripts = 0; grep repo-wide solo encuentra apps/web/src/api/generated/endpoint.types.ts y endpoints.ts. grep 'GetLocalFiles|LOCALFILES' en web = 0. grep de HandleGetLocalFiles en apps/server: definicion + routes_library.go:14. Read de localfiles.go: 90 lineas, un unico handler.

#### DM-05 · Eliminar POST /tmdb/details y GET /tmdb/images/:type/:id junto con los metodos huerfanos del cliente TMDB

- **Severidad:** Media · **Tipo:** Código Muerto · **Verificación:** mecánica + revisión manual
- **Problema:** HandleTMDBGetDetails y HandleTMDBImages no tienen consumidores (la web solo usa /tmdb/search, /tmdb/episode y /library/local-files/tmdb-assign). Al quitarlos quedan huerfanos GetMovieAlternativeTitles, GetTVAlternativeTitles, GetMovieImages, GetTVImages y los tipos AlternativeTitle, AlternativeTitlesResponse, TMDBImage e ImagesResponse del paquete internal/api/tmdb.

**DM-05.1 — Archivo:** `internal/handlers/routes_settings.go` · **Líneas:** 18–19 · **Acción:** delete-lines

ANTES:

```go
	v1TMDB.POST("/details", h.HandleTMDBGetDetails)
	v1TMDB.GET("/images/:type/:id", h.HandleTMDBImages)
```

DESPUÉS: _(se elimina el bloque)_

**DM-05.2 — Archivo:** `internal/handlers/tmdb.go` · **Líneas:** 377–410 · **Acción:** delete-lines

ANTES:

```go

// HandleTMDBImages fetches all backdrops, posters, and logos for a TV show or movie from TMDb.
//
//	@summary get TMDB images (backdrops, posters, logos)
//	@desc Fetches backdrops, posters, and logos from TMDb with caching.
//	@route /api/v1/tmdb/images/:type/:id [GET]
func (h *Handler) HandleTMDBImages(c echo.Context) error {
	mediaType := c.Param("type") // "tv" or "movie"
	idStr := c.Param("id")
	id, err := strconv.Atoi(idStr)
	if err != nil || id <= 0 {
		return h.RespondWithCodeError(c, http.StatusBadRequest, errors.New("valid positive id is required"))
	}

	client := h.App.Metadata.TMDBClient
	if client == nil || !client.HasApiKey() {
		return h.RespondWithCodeError(c, http.StatusServiceUnavailable, errors.New("tmdb client not configured"))
	}

	var resp *tmdb.ImagesResponse
	if mediaType == "movie" {
		resp, err = client.GetMovieImages(c.Request().Context(), id)
	} else if mediaType == "tv" {
		resp, err = client.GetTVImages(c.Request().Context(), id)
	} else {
		return h.RespondWithCodeError(c, http.StatusBadRequest, errors.New("invalid type, expected 'tv' or 'movie'"))
	}

	if err != nil {
		return h.RespondWithError(c, err)
	}

	return h.RespondWithData(c, resp)
}
```

DESPUÉS: _(se elimina el bloque)_

**DM-05.3 — Archivo:** `internal/handlers/tmdb.go` · **Líneas:** 171–211 · **Acción:** delete-lines

ANTES:

```go
	}

	if client == nil || !client.HasApiKey() || err != nil || len(altTitles) == 0 {
		// Fallback: fetch details from Jikan
		jikanClient := jikan.Shared(h.App.Logger)
		if fullRes, jErr := jikanClient.GetAnimeFull(c.Request().Context(), id); jErr == nil && fullRes != nil {
			if fullRes.Data.TitleEng != "" {
				altTitles = append(altTitles, tmdb.AlternativeTitle{
					Title:    fullRes.Data.TitleEng,
					ISO31661: "US",
					Type:     "English Title",
				})
			}
			if fullRes.Data.TitleJpn != "" {
				altTitles = append(altTitles, tmdb.AlternativeTitle{
					Title:    fullRes.Data.TitleJpn,
					ISO31661: "JP",
					Type:     "Japanese Title",
				})
			}
			if fullRes.Data.Title != "" && fullRes.Data.Title != fullRes.Data.TitleEng {
				altTitles = append(altTitles, tmdb.AlternativeTitle{
					Title:    fullRes.Data.Title,
					ISO31661: "RO",
					Type:     "Romaji Title",
				})
			}
			err = nil
		}
	}

	if err != nil && len(altTitles) == 0 {
		return h.RespondWithError(c, err)
	}

	return h.RespondWithData(c, map[string]interface{}{
		"id":                id,
		"alternativeTitles": altTitles,
	})
}
```

DESPUÉS: _(se elimina el bloque)_

**DM-05.4 — Archivo:** `internal/handlers/tmdb.go` · **Líneas:** 130–170 · **Acción:** delete-lines

ANTES:

```go
// HandleTMDBGetDetails ...
//
//	@summary get TMDB (or Jikan) anime details and alternative titles.
//	@desc Returns detailed metadata and alternative titles for a show.
//	@returns map[string]interface{}
//	@route /api/v1/tmdb/details [POST]
func (h *Handler) HandleTMDBGetDetails(c echo.Context) error {
	type body struct {
		ID          int    `json:"id"`
		TVID        int    `json:"tvId"` // Legacy
		MediaType   string `json:"mediaType"`
		BearerToken string `json:"bearerToken"`
	}

	var b body
	if err := c.Bind(&b); err != nil {
		return h.RespondWithError(c, err)
	}

	id := b.ID
	if id == 0 {
		id = b.TVID
	}

	if id <= 0 {
		return h.RespondWithCodeError(c, http.StatusBadRequest, errors.New("valid positive id is required"))
	}
	if b.MediaType != "" && b.MediaType != "tv" && b.MediaType != "movie" {
		return h.RespondWithCodeError(c, http.StatusBadRequest, errors.New("invalid mediaType, expected 'tv' or 'movie'"))
	}

	client := h.App.Metadata.TMDBClient
	var altTitles []tmdb.AlternativeTitle
	var err error

	if client != nil && client.HasApiKey() {
		if b.MediaType == "movie" {
			altTitles, err = client.GetMovieAlternativeTitles(c.Request().Context(), id)
		} else {
			altTitles, err = client.GetTVAlternativeTitles(c.Request().Context(), id)
		}
```

DESPUÉS: _(se elimina el bloque)_

**DM-05.5 — Archivo:** `internal/handlers/server_auth_middleware.go` · **Líneas:** 159–159 · **Acción:** delete-lines

ANTES:

```go
	"/api/v1/tmdb/details":                   true,
```

DESPUÉS: _(se elimina el bloque)_

**DM-05.6 — Archivo:** `internal/api/tmdb/tv.go` · **Líneas:** 217–232 · **Acción:** delete-lines

ANTES:

```go

// GetTVImages fetches all backdrops, posters, and logos for a TV show from TMDb.
func (c *Client) GetTVImages(ctx context.Context, tvID int) (*ImagesResponse, error) {
	cacheKey := fmt.Sprintf("tv_images:%d", tvID)
	if cached, ok := GetCached[*ImagesResponse](c, cacheKey); ok {
		return cached, nil
	}

	resp, err := executeWithRetry[ImagesResponse](ctx, c, fmt.Sprintf("/tv/%d/images", tvID))
	if err != nil {
		return nil, fmt.Errorf("tmdb get tv images: %w", err)
	}

	SetCached(c, cacheKey, resp, 7*24*time.Hour)
	return resp, nil
}
```

DESPUÉS: _(se elimina el bloque)_

**DM-05.7 — Archivo:** `internal/api/tmdb/types.go` · **Líneas:** 109–127 · **Acción:** delete-lines

ANTES:

```go

// TMDBImage represents a backdrop, poster, or logo from TMDb.
type TMDBImage struct {
	AspectRatio float64 `json:"aspect_ratio"`
	FilePath    string  `json:"file_path"`
	Height      int     `json:"height"`
	ISO6391     *string `json:"iso_639_1"`
	VoteAverage float64 `json:"vote_average"`
	VoteCount   int     `json:"vote_count"`
	Width       int     `json:"width"`
}

// ImagesResponse is the response from /tv/{id}/images or /movie/{id}/images.
type ImagesResponse struct {
	ID        int         `json:"id"`
	Backdrops []TMDBImage `json:"backdrops"`
	Posters   []TMDBImage `json:"posters"`
	Logos     []TMDBImage `json:"logos"`
}
```

DESPUÉS: _(se elimina el bloque)_

**DM-05.8 — Archivo:** `internal/api/tmdb/movie.go` · **Líneas:** 61–75 · **Acción:** delete-lines

ANTES:

```go

// GetMovieImages fetches all backdrops, posters, and logos for a movie from TMDb.
func (c *Client) GetMovieImages(ctx context.Context, movieID int) (*ImagesResponse, error) {
	cacheKey := fmt.Sprintf("movie_images:%d", movieID)
	if cached, ok := GetCached[*ImagesResponse](c, cacheKey); ok {
		return cached, nil
	}

	resp, err := executeWithRetry[ImagesResponse](ctx, c, fmt.Sprintf("/movie/%d/images", movieID))
	if err != nil {
		return nil, fmt.Errorf("tmdb get movie images: %w", err)
	}

	SetCached(c, cacheKey, resp, 7*24*time.Hour)
	return resp, nil
}
```

DESPUÉS: _(se elimina el bloque)_

- **Razón técnica:** Ambos endpoints son huerfanos en todos los clientes. El resto de tmdb.go sigue usando todos sus imports (jikan, tmdb.NewClient en HandleTMDBSearch, errors, http, strconv en TMDBAssign/EpisodeStill, context, lo, etc.), por lo que no hace falta tocar el bloque import. En internal/api/tmdb, las cuatro funciones de cliente y los cuatro tipos solo eran alcanzables desde estos handlers (grep de GetMovieAlternativeTitles|GetTVAlternativeTitles|GetMovieImages|GetTVImages|ImagesResponse|AlternativeTitle|TMDBImage en todo apps/server: solo definiciones y los dos handlers; ni tests ni interfaces/mocks). movie.go y tv.go siguen usando context, fmt, url, strings y time en el resto de funciones; executeWithRetry, GetCached y SetCached siguen en uso.
- **Impacto esperado:** Elimina dos endpoints (uno abierto a escritura LAN via POST) y alrededor de 190 lineas de codigo en handlers y cliente TMDB, incluidas llamadas de red a TMDB que nadie dispara.
- **Revisión manual (22/10):** Verificado: TMDBGetDetails y TMDBImages no se usan en la web ni la TV (ni por constante ni por URL).
- **Riesgos / a revisar:** Aplicar todos los edits juntos (cliente + handlers + lanWriteRoutes): TestLANWriteRoutesExist falla si /api/v1/tmdb/details queda en lanWriteRoutes sin ruta registrada. Regenerar el codegen (apps/server/codegen) para actualizar handlers.json, public_structs.json (AlternativeTitle/ImagesResponse si figuran) y apps/web/src/api/generated/endpoints.ts (TMDB.TMDBGetDetails, TMDB.TMDBImages) + endpoint.types.ts; confirmar con tsc que la web no importa esos tipos (grep de 'TMDBGetDetails|TMDBImages' fuera de generated = 0). Ninguna prueba Go referencia estos handlers ni los tipos. Si se piensa usar titulos alternativos para el matching del scanner mas adelante, habria que reintroducir los metodos del cliente. NO borrar GetMovieAlternativeTitles, GetTVAlternativeTitles ni los tipos AlternativeTitle/AlternativeTitlesResponse de internal/api/tmdb: los usa internal/library/metadata/tmdb_provider.go (comprobado: borrarlos rompe la compilación).
- **Evidencia del hallazgo:** Bucle de shell: 'tmdb/details' y 'tmdb/images' en apps/web/src (sin generated), KameHouseTV/src, apps/desktop/src-tauri/src y scripts = 0; grep repo-wide: solo apps/web/src/api/generated/endpoint.types.ts y endpoints.ts. apps/web/src/api/hooks/tmdb-search.hooks.ts usa unicamente TMDBSearch (34-36) y TMDBAssign (43-44); tmdb-episode.hooks.ts:28 usa TMDBEpisodeStill. grep -rn en apps/server de los simbolos del cliente: movie.go:44,62; tv.go:111,219; types.go:27,34,111,122; handlers/tmdb.go:162-196,396-400. routes_lan_writes_test.go:66-80 valida lanWriteRoutes contra rutas registradas.
- Nota de aplicación: línea real 60 (desfase -1)

#### DM-06 · Eliminar GET/PATCH /mediastream/settings (los ajustes viajan por /settings)

- **Severidad:** Media · **Tipo:** Código Muerto · **Verificación:** mecánica + revisión manual
- **Problema:** HandleGetMediastreamSettings y HandleSaveMediastreamSettings no tienen consumidor en web, TV ni escritorio. El estado de mediastream se inicializa en el arranque (InitOrRefreshMediastreamSettings) y el cliente guarda sus ajustes por PATCH /settings.

**DM-06.1 — Archivo:** `internal/handlers/routes_streaming.go` · **Líneas:** 11–12 · **Acción:** delete-lines

ANTES:

```go
	v1Mediastream.GET("/settings", h.HandleGetMediastreamSettings)
	v1Mediastream.PATCH("/settings", h.HandleSaveMediastreamSettings)
```

DESPUÉS: _(se elimina el bloque)_

**DM-06.2 — Archivo:** `internal/handlers/mediastream.go` · **Líneas:** 34–91 · **Acción:** delete-lines

ANTES:

```go
// HandleGetMediastreamSettings returns the mediastream settings.
//
//	@summary get mediastream settings.
//	@desc This returns the mediastream settings.
//	@returns models.MediastreamSettings
//	@route /api/v1/mediastream/settings [GET]
func (h *Handler) HandleGetMediastreamSettings(c echo.Context) error {
	mediastreamSettings, found := h.App.Database.GetMediastreamSettings()
	if !found {
		// Create default settings if none exist
		defaultSettings := &models.MediastreamSettings{
			BaseModel: models.BaseModel{
				ID: 1,
			},
			TranscodeEnabled: false,
			TranscodeHwAccel: "auto",
			TranscodePreset:  "fast",
			TranscodeThreads: 0,
			DirectPlayOnly:   false,
			FfmpegPath:       "",
			FfprobePath:      "",
		}
		saved, err := h.App.Database.UpsertMediastreamSettings(defaultSettings)
		if err != nil {
			return h.RespondWithError(c, err)
		}
		return h.RespondWithData(c, saved)
	}

	return h.RespondWithData(c, mediastreamSettings)
}

// HandleSaveMediastreamSettings saves the mediastream settings.
//
//	@summary save mediastream settings.
//	@desc This saves the mediastream settings.
//	@returns models.MediastreamSettings
//	@route /api/v1/mediastream/settings [PATCH]
func (h *Handler) HandleSaveMediastreamSettings(c echo.Context) error {
	type body struct {
		Settings models.MediastreamSettings `json:"settings"`
	}

	var b body
	if err := c.Bind(&b); err != nil {
		return h.RespondWithError(c, err)
	}

	settings, err := h.App.Database.UpsertMediastreamSettings(&b.Settings)
	if err != nil {
		return h.RespondWithError(c, err)
	}

	h.App.InitOrRefreshMediastreamSettings()

	return h.RespondWithData(c, settings)
}
```

DESPUÉS: _(se elimina el bloque)_

- **Razón técnica:** Ambos handlers solo envuelven Database.GetMediastreamSettings/UpsertMediastreamSettings, que siguen siendo usados por internal/core/modules.go (36, 95, 293, 296, 318) y por mediastream.go:874/922, y InitOrRefreshMediastreamSettings sigue invocandose desde core/app.go:231. Los imports de mediastream.go (models, echo, etc.) siguen usandose en el resto del archivo (skipTimesCache usa models), por lo que no hace falta tocar el bloque import.
- **Impacto esperado:** Quita dos endpoints (uno de ellos de escritura de configuracion del servidor, solo permitido a localhost) y ~58 lineas sin consumidor.
- **Revisión manual (22/10):** Verificado: GetMediastreamSettings y SaveMediastreamSettings no se usan en la web, la TV ni el escritorio.
- **Riesgos / a revisar:** Regenerar el codegen (apps/server/codegen) para actualizar handlers.json, public_structs.json y apps/web/src/api/generated/endpoints.ts + endpoint.types.ts (GetMediastreamSettings/SaveMediastreamSettings_Variables); confirmar con tsc que ningun import de la web usa esos tipos (grep de 'MediastreamSettings' en apps/web/src fuera de generated = 0). Las entradas obsoletas de server_auth_middleware.go:144 (sensitiveMethodRoutes), server_features_middleware.go:33 y :50, y los casos path-only de sensitive_endpoint_test.go:25/57 y routes_gzip_test.go:27 quedan inertes pero siguen compilando y pasando; se pueden depurar despues (si se borra la de sensitiveMethodRoutes hay que borrar el caso de test de la linea 57). Verificar manualmente que la pantalla de rendimiento (apps/web/src/routes/settings/tabs/performance-tab.tsx) guarda via /settings antes de aplicar.
- **Evidencia del hallazgo:** Bucle de shell: 'mediastream/settings' en apps/web/src (sin generated), KameHouseTV/src, apps/desktop/src-tauri/src y scripts = 0; grep 'MediastreamSettings' en web fuera de generated = 0. grep repo-wide: solo apps/web/src/api/generated/endpoint.types.ts y endpoints.ts. grep en apps/server de los dos handlers: definiciones en mediastream.go y registro en routes_streaming.go:11-12; ningun test los invoca. El modelo Settings incluye Mediastream (models.go:44) y la web lo guarda en /settings (lib/server/settings.ts).

#### DM-07 · Eliminar POST /playback/sync y su handler (telemetria HTTP reemplazada por WebSocket)

- **Severidad:** Media · **Tipo:** Código Muerto · **Verificación:** mecánica + revisión manual
- **Problema:** HandlePlaybackSync no tiene ningun cliente: la web reporta el progreso por WebSocket (playback-heartbeat) y por PATCH /continuity/item; la TV usa /continuity/item. La ruta, el handler y su entrada en la lista blanca de escrituras LAN son codigo sin llamadores.

**DM-07.1 — Archivo:** `internal/handlers/routes_streaming.go` · **Líneas:** 36–39 · **Acción:** replace

ANTES:

```go
	v1.GET("/video-thumbnail", h.HandleGetVideoThumbnail)

	// Playback telemetry
	v1.POST("/playback/sync", h.HandlePlaybackSync)
```

DESPUÉS:

```go
	v1.GET("/video-thumbnail", h.HandleGetVideoThumbnail)
```

**DM-07.2 — Archivo:** `internal/handlers/playback_sync.go` · **Líneas:** 30–53 · **Acción:** delete-lines

ANTES:

```go
// HandlePlaybackSync ...
//
//	@summary receives playback telemetry from the frontend.
//	@desc    Updates continuity watch history and, when progress >= 85%,
//	         automatically scrobbles the episode as watched to Platform.
//	@route /api/v1/playback/sync [POST]
//	@returns bool
func (h *Handler) HandlePlaybackSync(c echo.Context) error {
	var b PlaybackHeartbeatPayload
	if err := c.Bind(&b); err != nil {
		return h.RespondWithError(c, err)
	}

	if !validPlaybackBeat(b.MediaID, b.EpisodeNumber, b.CurrentTime, b.Duration) {
		return h.RespondWithData(c, true)
	}

	if h.App.ContinuityManager != nil && h.App.ContinuityManager.TelemetryManager != nil {
		h.App.ContinuityManager.TelemetryManager.UpdateProgress(currentAccountID(c), b.MediaID, b.EpisodeNumber, b.CurrentTime, b.Duration)
	}

	return h.RespondWithData(c, true)
}
```

DESPUÉS: _(se elimina el bloque)_

**DM-07.3 — Archivo:** `internal/handlers/playback_sync.go` · **Líneas:** 3–7 · **Acción:** replace

ANTES:

```go
import (
	"kamehouse/internal/events"

	"github.com/labstack/echo/v4"
)
```

DESPUÉS:

```go
import (
	"kamehouse/internal/events"
)
```

**DM-07.4 — Archivo:** `internal/handlers/server_auth_middleware.go` · **Líneas:** 155–155 · **Acción:** delete-lines

ANTES:

```go
	"/api/v1/playback/sync":                  true,
```

DESPUÉS: _(se elimina el bloque)_

**DM-07.5 — Archivo:** `internal/handlers/sensitive_endpoint_test.go` · **Líneas:** 78–78 · **Acción:** delete-lines

ANTES:

```go
		{http.MethodPost, "/api/v1/playback/sync", false},
```

DESPUÉS: _(se elimina el bloque)_

**DM-07.6 — Archivo:** `internal/handlers/security_p0_test.go` · **Líneas:** 125–125 · **Acción:** replace

ANTES:

```go
		{"LAN reporta progreso", http.MethodPost, "/api/v1/playback/sync", "192.168.1.50:1", http.StatusOK},
```

DESPUÉS:

```go
		{"LAN reporta progreso", http.MethodPatch, "/api/v1/continuity/item", "192.168.1.50:1", http.StatusOK},
```

- **Razón técnica:** El handler HTTP duplica la ruta WebSocket: StartPlaybackHeartbeatSubscriber (que se conserva) y validPlaybackBeat siguen usandose desde el dispatcher de eventos, y el progreso HTTP lo cubre PATCH /continuity/item (HandleUpdateContinuityWatchHistoryItem). Al quitar el handler, el import de echo en playback_sync.go queda sin uso y se elimina. currentAccountID sigue usado por chronology_progress.go, continuity.go y home.go. TestLANWriteRoutesExist (routes_lan_writes_test.go:66-80) exige que cada entrada de lanWriteRoutes corresponda a una ruta de escritura registrada, por eso hay que quitar tambien la entrada de la lista blanca; los dos casos de test que dependian de ella se eliminan/reapuntan a la ruta LAN real de progreso.
- **Impacto esperado:** Elimina un endpoint de escritura abierto a la LAN que nadie llama, junto con 25 lineas de handler y una entrada de la lista blanca de seguridad. Menos superficie de ataque y menos mantenimiento.
- **Revisión manual (22/10):** Verificado: PlaybackSync no se usa en la web ni la TV ni el escritorio.
- **Riesgos / a revisar:** Aplicar TODOS los edits juntos: si se quita la ruta pero no la entrada de lanWriteRoutes, TestLANWriteRoutesExist falla; si se quita la entrada pero no los casos de test, TestIsRestrictedWrite (sensitive_endpoint_test.go:78) y TestOptionalAuthMiddleware_LANWritesRestricted (security_p0_test.go:125) fallan. Regenerar el codegen (apps/server/codegen: go run ./codegen) para actualizar codegen/generated/handlers.json, public_structs.json y apps/web/src/api/generated/endpoints.ts (grupo PLAYBACK_SYNC) y endpoint.types.ts. El caso OPTIONS /playback/sync de sensitive_endpoint_test.go:86 es path-only y puede quedar (o limpiarse despues). Tras gofmt, el bloque lanWriteRoutes conserva la alineacion porque la clave mas larga ('/api/v1/mediastream/shutdown-transcode') no cambia. Si se planea un cliente movil por LAN que reporte progreso por HTTP, deberia usar /continuity/item.
- **Evidencia del hallazgo:** Grep de 'playback/sync' y 'PlaybackSync' en apps/web/src (sin api/generated), KameHouseTV/src, apps/desktop/src-tauri/src y scripts = 0 resultados; repo-wide solo aparece en apps/web/src/api/generated/endpoints.ts (grupo PLAYBACK_SYNC). La web envia heartbeats por WS: grep 'playback-heartbeat' -> apps/web/src/components/video/use-mpv-player.ts y usePlayerBackendSync.ts. apps/web/src/api/hooks/continuity-pending.ts:107 documenta que el progreso en descarga de pagina va por PATCH continuity. grep en apps/server de HandlePlaybackSync: solo la definicion y routes_streaming.go:39. grep 'currentAccountID(' muestra otros 4 usos fuera del handler.
- Nota de aplicación: línea real 34 (desfase -2)

#### DM-08 · Eliminar /intelligence/best-source y /intelligence/stats junto con el Selector huerfano

- **Severidad:** Media · **Tipo:** Código Muerto · **Verificación:** mecánica + revisión manual
- **Problema:** Las rutas GET /api/v1/intelligence/best-source y /stats no tienen consumidores; su unico uso arrastra a Handler.IntelligenceSelector y a todo el motor de seleccion (selector.go, scorer.go, cache.go, types.go de internal/intelligence, ~670 lineas) que ningun otro codigo de produccion usa. Ademas intelligence.NewSelector se construye en cada arranque.

**DM-08.1 — Archivo:** `internal/handlers/routes.go` · **Líneas:** 329–330 · **Acción:** delete-lines

ANTES:

```go
	intel.GET("/best-source", h.HandleGetBestSource)
	intel.GET("/stats", h.HandleGetIntelligenceStats)
```

DESPUÉS: _(se elimina el bloque)_

**DM-08.2 — Archivo:** `internal/handlers/routes.go` · **Líneas:** 255–258 · **Acción:** replace

ANTES:

```go
	h := &Handler{
		App:                  app,
		IntelligenceSelector: intelligence.NewSelector(app.Database, app.Logger),
	}
```

DESPUÉS:

```go
	h := &Handler{
		App: app,
	}
```

**DM-08.3 — Archivo:** `internal/handlers/routes.go` · **Líneas:** 127–130 · **Acción:** replace

ANTES:

```go
type Handler struct {
	App                  *core.App
	IntelligenceSelector *intelligence.Selector
}
```

DESPUÉS:

```go
type Handler struct {
	App *core.App
}
```

**DM-08.4 — Archivo:** `internal/handlers/routes.go` · **Líneas:** 22–22 · **Acción:** delete-lines

ANTES:

```go
	"kamehouse/internal/intelligence"
```

DESPUÉS: _(se elimina el bloque)_

**DM-08.5 — Archivo:** `internal/handlers/intelligence.go` · **Líneas:** 75–88 · **Acción:** replace

ANTES:

```go
}

func splitLangs(s string) []string {
	var langs []string
	for _, part := range strings.Split(s, ",") {
		if t := strings.TrimSpace(part); t != "" {
			langs = append(langs, t)
		}
	}
	if len(langs) == 0 {
		return []string{"spa", "eng"}
	}
	return langs
}
```

DESPUÉS:

```go
}
```

**DM-08.6 — Archivo:** `internal/handlers/intelligence.go` · **Líneas:** 1–63 · **Acción:** replace

ANTES:

```go
package handlers

import (
	"errors"
	"kamehouse/internal/intelligence"
	"net/http"
	"strconv"
	"strings"

	"github.com/labstack/echo/v4"
)

// HandleGetBestSource retorna el mejor archivo para un título/episodio.
//
//	@summary get best source for playback.
//	@desc Evaluates all available sources (local + Jellyfin) and returns the winner.
//	@returns intelligence.SelectionResult
//	@route /api/v1/intelligence/best-source [GET]
func (h *Handler) HandleGetBestSource(c echo.Context) error {
	tmdbIDStr := c.QueryParam("tmdbId")
	episodeStr := c.QueryParam("episode")
	langStr := c.QueryParam("preferredLangs")

	tmdbID, err := strconv.Atoi(tmdbIDStr)
	if err != nil || tmdbID <= 0 {
		return h.RespondWithCodeError(c, http.StatusBadRequest, errors.New("valid positive tmdbId is required"))
	}

	episode := 1
	if episodeStr != "" {
		ep, err := strconv.Atoi(episodeStr)
		if err != nil || ep < 0 {
			return h.RespondWithCodeError(c, http.StatusBadRequest, errors.New("invalid episode number"))
		}
		episode = ep
	}

	preferredLangs := []string{"spa", "eng"}
	if langStr != "" {
		preferredLangs = splitLangs(langStr)
	}

	result, err := h.IntelligenceSelector.SelectBestSource(c.Request().Context(), tmdbID, episode, preferredLangs)
	if err != nil {
		return h.RespondWithError(c, err)
	}

	return h.RespondWithData(c, result)
}

// HandleGetIntelligenceStats retorna estadísticas del motor de selección.
//
//	@summary get intelligence engine stats.
//	@desc Returns cache stats and scoring configuration.
//	@returns map
//	@route /api/v1/intelligence/stats [GET]
func (h *Handler) HandleGetIntelligenceStats(c echo.Context) error {
	stats := map[string]interface{}{
		"weights": h.IntelligenceSelector.GetWeights(),
		"cache":   h.IntelligenceSelector.GetCacheStats(),
	}
	return h.RespondWithData(c, stats)
}
```

DESPUÉS:

```go
package handlers

import (
	"kamehouse/internal/intelligence"

	"github.com/labstack/echo/v4"
)
```

**DM-08.7 — Archivo:** `internal/intelligence/selector.go` · **Líneas:** 1–343 · **Acción:** delete-file

Eliminar el archivo completo. Primeras líneas actuales:

```go
package intelligence

import (
	"context"
	"encoding/json"
	"fmt"
	"kamehouse/internal/database/db"
	"path/filepath"
	"sort"
	"strconv"
```

**DM-08.8 — Archivo:** `internal/intelligence/scorer.go` · **Líneas:** 1–163 · **Acción:** delete-file

Eliminar el archivo completo. Primeras líneas actuales:

```go
package intelligence

import (
	"math"
	"strings"
)

// ScoreCandidate evalúa un archivo y retorna un puntaje de 0.0 a 1.0.
// Cada criterio es evaluado independientemente y ponderado por los weights.
func ScoreCandidate(c *MediaCandidate, preferredLangs []string, weights ScoringWeights) float64 {
```

**DM-08.9 — Archivo:** `internal/intelligence/cache.go` · **Líneas:** 1–120 · **Acción:** delete-file

Eliminar el archivo completo. Primeras líneas actuales:

```go
package intelligence

import (
	"sync"
	"time"
)

// ResultCache es una caché en memoria para resultados de selección.
// Evita re-evaluar los mismos archivos repetidamente.
type ResultCache struct {
```

**DM-08.10 — Archivo:** `internal/intelligence/types.go` · **Líneas:** 1–41 · **Acción:** delete-file

Eliminar el archivo completo. Primeras líneas actuales:

```go
package intelligence

// MediaCandidate representa un archivo de video candidato para selección.
type MediaCandidate struct {
	FilePath   string   `json:"filePath"`
	Resolution int      `json:"resolution"` // 2160, 1080, 720, 480
	Codec      string   `json:"codec"`      // "h264", "hevc", "av1"
	Bitrate    uint32   `json:"bitrate"`    // bytes/s
	AudioLangs []string `json:"audioLangs"` // ["spa", "eng"]
	AudioCodec string   `json:"audioCodec"` // "aac", "flac", "dts"
```

- **Razón técnica:** Sin los dos handlers, h.IntelligenceSelector, intelligence.NewSelector y todo el paquete selector/scorer/cache/types quedan sin referencias de produccion. Se quitan el campo del Handler, su construccion, el import en routes.go, splitLangs (solo lo usaba best-source) y los cuatro archivos del motor. Se conservan chronology.go y semantic_search.go (usados por HandleGetChronologyProgress y HandleSemanticSearch). Las lineas de intelligence.go se refieren al archivo original: aplicar los dos edits de ese archivo de abajo hacia arriba.
- **Impacto esperado:** ~700 lineas menos, un Selector con cache y goroutine de limpieza (ResultCache.cleanupLoop) que hoy se inicializa en cada arranque sin ser consultado, y 2 endpoints menos expuestos.
- **Revisión manual (22/10):** Verificado: GetBestSource y GetIntelligenceStats no se usan en la web ni la TV.
- **Riesgos / a revisar:** Regenerar codegen (handlers.json, public_structs.json por intelligence.SelectionResult/MediaCandidate/ScoringWeights, y endpoints.ts/types.ts de apps/web: desaparecen INTELLIGENCE.GetBestSource y GetIntelligenceStats; confirmado que la web no los importa). No hay tests de handlers que enumeren estas rutas. Verificar con go build ./... && go vet ./... (el import 'db' de intelligence deja de usarse solo en archivos borrados). Si se planea reactivar la seleccion de fuente (Jellyfin) habria que recuperarla de git.
- **Evidencia del hallazgo:** Busqueda 'best-source', 'intelligence/stats', 'GetIntelligenceStats' en apps/web/src, KameHouseTV/src, desktop y scripts: 0 resultados (fuera de generated/). Grep Go de IntelligenceSelector: solo routes.go:129,257 e intelligence.go:43,59,60. Grep de simbolos (MediaCandidate|ScoringWeights|DefaultWeights|SelectionResult|CacheStats|ResultCache|normalizeLang|ScoreCandidate|infer*|generateReason|score*) en chronology.go, semantic_search.go y chronology_test.go: 0 coincidencias. Usos externos de intelligence.*: BuildChronologyProgress, ChronologyProgressResponse, SearchSemanticEntities, SemanticSearchResult (todos se conservan); NewSelector/Selector/SelectionResult solo en esto. Ningun test construye Handler con IntelligenceSelector.
- Nota de aplicación: línea real 325 (desfase -4); línea real 253 (desfase -2); línea real 126 (desfase -1)

#### DM-09 · Quitar campos logger guardados y nunca leídos en clientes, plataformas y proveedores de metadatos

- **Severidad:** Baja · **Tipo:** Código Muerto · **Verificación:** mecánica
- **Problema:** FeatureManager, AnimeFillerList, jikan_platform.Platform, SimulatedPlatform, los clientes anilist y jikan y los proveedores AniListProvider/JikanProvider guardan un *zerolog.Logger en un campo que ningún método lee (todos figuran como 'field logger is unused' en la semilla). Se eliminan los campos y su asignación; donde el parámetro del constructor queda sin uso se pasa a '_' para no tocar a los llamadores.

**DM-09.1 — Archivo:** `internal/core/feature_flags.go` · **Líneas:** 20–20 · **Acción:** delete-lines

ANTES:

```go
		logger           *zerolog.Logger
```

DESPUÉS: _(se elimina el bloque)_

**DM-09.2 — Archivo:** `internal/core/feature_flags.go` · **Líneas:** 47–47 · **Acción:** delete-lines

ANTES:

```go
		logger:           logger,
```

DESPUÉS: _(se elimina el bloque)_

**DM-09.3 — Archivo:** `internal/api/filler/filler.go` · **Líneas:** 41–41 · **Acción:** delete-lines

ANTES:

```go
		logger  *zerolog.Logger
```

DESPUÉS: _(se elimina el bloque)_

**DM-09.4 — Archivo:** `internal/api/filler/filler.go` · **Líneas:** 51–51 · **Acción:** delete-lines

ANTES:

```go
		logger: logger,
```

DESPUÉS: _(se elimina el bloque)_

**DM-09.5 — Archivo:** `internal/platforms/jikan_platform/platform.go` · **Líneas:** 14–14 · **Acción:** delete-lines

ANTES:

```go
	logger      *zerolog.Logger
```

DESPUÉS: _(se elimina el bloque)_

**DM-09.6 — Archivo:** `internal/platforms/jikan_platform/platform.go` · **Líneas:** 20–20 · **Acción:** delete-lines

ANTES:

```go
		logger:      logger,
```

DESPUÉS: _(se elimina el bloque)_

**DM-09.7 — Archivo:** `internal/platforms/simulated_platform/simulated_platform.go` · **Líneas:** 10–18 · **Acción:** replace

ANTES:

```go
type SimulatedPlatform struct {
	logger *zerolog.Logger
}

func NewSimulatedPlatform(logger *zerolog.Logger) *SimulatedPlatform {
	return &SimulatedPlatform{
		logger: logger,
	}
}
```

DESPUÉS:

```go
type SimulatedPlatform struct{}

func NewSimulatedPlatform(_ *zerolog.Logger) *SimulatedPlatform {
	return &SimulatedPlatform{}
}
```

**DM-09.8 — Archivo:** `internal/api/anilist/client.go` · **Líneas:** 21–21 · **Acción:** delete-lines

ANTES:

```go
	logger     *zerolog.Logger
```

DESPUÉS: _(se elimina el bloque)_

**DM-09.9 — Archivo:** `internal/api/anilist/client.go` · **Líneas:** 28–28 · **Acción:** replace

ANTES:

```go
func NewClient(logger *zerolog.Logger) *Client {
```

DESPUÉS:

```go
func NewClient(_ *zerolog.Logger) *Client {
```

**DM-09.10 — Archivo:** `internal/api/anilist/client.go` · **Líneas:** 30–30 · **Acción:** delete-lines

ANTES:

```go
		logger:     logger,
```

DESPUÉS: _(se elimina el bloque)_

**DM-09.11 — Archivo:** `internal/api/jikan/client.go` · **Líneas:** 29–29 · **Acción:** delete-lines

ANTES:

```go
	logger     *zerolog.Logger
```

DESPUÉS: _(se elimina el bloque)_

**DM-09.12 — Archivo:** `internal/api/jikan/client.go` · **Líneas:** 57–57 · **Acción:** replace

ANTES:

```go
func NewClient(logger *zerolog.Logger) *Client {
```

DESPUÉS:

```go
func NewClient(_ *zerolog.Logger) *Client {
```

**DM-09.13 — Archivo:** `internal/api/jikan/client.go` · **Líneas:** 59–59 · **Acción:** delete-lines

ANTES:

```go
		logger:     logger,
```

DESPUÉS: _(se elimina el bloque)_

**DM-09.14 — Archivo:** `internal/library/metadata/anilist_provider.go` · **Líneas:** 22–22 · **Acción:** delete-lines

ANTES:

```go
	logger      *zerolog.Logger
```

DESPUÉS: _(se elimina el bloque)_

**DM-09.15 — Archivo:** `internal/library/metadata/anilist_provider.go` · **Líneas:** 31–31 · **Acción:** delete-lines

ANTES:

```go
		logger:      logger,
```

DESPUÉS: _(se elimina el bloque)_

**DM-09.16 — Archivo:** `internal/library/metadata/jikan_provider.go` · **Líneas:** 22–22 · **Acción:** delete-lines

ANTES:

```go
	logger      *zerolog.Logger
```

DESPUÉS: _(se elimina el bloque)_

**DM-09.17 — Archivo:** `internal/library/metadata/jikan_provider.go` · **Líneas:** 31–31 · **Acción:** delete-lines

ANTES:

```go
		logger:      logger,
```

DESPUÉS: _(se elimina el bloque)_

- **Razón técnica:** Ninguno de estos tipos usa su campo logger en ningún método (el linter 'unused' lo marca en cada uno, contando pruebas como uso). Mantenerlo da la falsa impresión de que registran algo y retiene una referencia inútil. En feature_flags.go y en los proveedores el parámetro logger del constructor se sigue usando (el logger.Warn de NewFeatureManager y anilist.NewClient(logger)/jikan.Shared(logger)). En SimulatedPlatform y en los NewClient de anilist y jikan el parámetro queda sin uso, por lo que se renombra a '_' y no hay que tocar a ninguno de sus llamadores.
- **Impacto esperado:** Elimina 9 campos muertos y 9 asignaciones; sin cambio de comportamiento ni de firmas públicas.
- **Riesgos / a revisar:** Muy bajo. Si se planea añadir logging a esos tipos se tendría que reincorporar el campo. No se tocaron mkvparser.realLogger, notifier.appName ni los campos de metadata.go para mantener el cambio acotado.
- **Evidencia del hallazgo:** unused-strict-tests.txt: 'field logger is unused' en simulated_platform.go:11, jikan_platform/platform.go:14, anilist/client.go:21, jikan/client.go:29, api/filler/filler.go:41, library/metadata/anilist_provider.go:22, library/metadata/jikan_provider.go:22 y core/feature_flags.go:20. Grep -n 'logger' en cada archivo: solo aparecen la declaración, la asignación del constructor y (en feature_flags.go) un uso del parámetro, nunca c.logger/p.logger/af.logger leído. Copia en scratchpad con todos los edits aplicados: gofmt -l limpio, go build ./... y go vet ./... (compila todas las pruebas) sin errores.
- Nota de aplicación: línea real 46 (desfase -1); línea real 50 (desfase -1); línea real 19 (desfase -1); línea real 27 (desfase -1); línea real 29 (desfase -1); línea real 56 (desfase -1); línea real 58 (desfase -1); línea real 30 (desfase -1); línea real 30 (desfase -1)

#### DM-10 · Maquinaria de tour de changelog sin consumidor (core/migrations.go)

- **Severidad:** Baja · **Tipo:** Código Muerto · **Verificación:** mecánica + revisión manual
- **Problema:** runMigrations solo calcula App.ShowTour a partir de un mapa Tours con la unica entrada heredada '3.5.0'; ShowTour se expone como showChangelogTour en /status pero ningun cliente (web, desktop, TV) lo lee, asi que todo el archivo y su cableado son codigo muerto.

**DM-10.1 — Archivo:** `internal/core/migrations.go` · **Líneas:** 1–63 · **Acción:** delete-file

Eliminar el archivo completo. Primeras líneas actuales:

```go
package core

import (
	"kamehouse/internal/constants"
	"kamehouse/internal/util"

	"github.com/Masterminds/semver/v3"
)

// Tours represents all version tours available to highlight changes
```

**DM-10.2 — Archivo:** `internal/core/app.go` · **Líneas:** 102–102 · **Acción:** delete-lines

ANTES:

```go
		previousVersion      string
```

DESPUÉS: _(se elimina el bloque)_

**DM-10.3 — Archivo:** `internal/core/app.go` · **Líneas:** 115–117 · **Acción:** replace

ANTES:

```go
		configWatcher *ConfigWatcher

		ShowTour string
```

DESPUÉS:

```go
		configWatcher *ConfigWatcher
```

**DM-10.4 — Archivo:** `internal/core/app.go` · **Líneas:** 128–132 · **Acción:** replace

ANTES:

```go
	previousVersion := constants.Version
	configOpts.OnVersionChange = append(configOpts.OnVersionChange, func(oldVersion string, newVersion string) {
		logger.Info().Str("prev", oldVersion).Str("current", newVersion).Msg("app: Version change detected")
		previousVersion = oldVersion
	})
```

DESPUÉS:

```go
	configOpts.OnVersionChange = append(configOpts.OnVersionChange, func(oldVersion string, newVersion string) {
		logger.Info().Str("prev", oldVersion).Str("current", newVersion).Msg("app: Version change detected")
	})
```

**DM-10.5 — Archivo:** `internal/core/app.go` · **Líneas:** 199–199 · **Acción:** delete-lines

ANTES:

```go
		previousVersion:   previousVersion,
```

DESPUÉS: _(se elimina el bloque)_

**DM-10.6 — Archivo:** `internal/core/app.go` · **Líneas:** 226–226 · **Acción:** delete-lines

ANTES:

```go
	app.runMigrations()
```

DESPUÉS: _(se elimina el bloque)_

**DM-10.7 — Archivo:** `internal/handlers/status.go` · **Líneas:** 53–53 · **Acción:** delete-lines

ANTES:

```go
	ShowChangelogTour   string                      `json:"showChangelogTour"`
```

DESPUÉS: _(se elimina el bloque)_

**DM-10.8 — Archivo:** `internal/handlers/status.go` · **Líneas:** 104–104 · **Acción:** delete-lines

ANTES:

```go
		ShowChangelogTour:   h.App.ShowTour,
```

DESPUÉS: _(se elimina el bloque)_

- **Razón técnica:** Grep de ShowTour, Tours, previousVersion, runMigrations y showChangelogTour: ShowTour solo se asigna en core/migrations.go y solo se lee en handlers/status.go:104; previousVersion solo se lee en migrations.go; showChangelogTour solo aparece en apps/web/src/api/generated/types.ts (tipo generado, ningun componente lo usa), no aparece en apps/desktop ni en KameHouseTV/src. El mapa Tours esta atado a constants.Version = '3.5.0' (resto de la base heredada) y no es una migracion de datos pese al nombre del archivo; las migraciones reales viven en internal/database/db/db_migrations.go.
- **Impacto esperado:** Quita un archivo completo (63 lineas), dos campos del struct App, una variable capturada por un closure, una llamada en el arranque y un campo del JSON de /status; evita parsear semver y evaluar constraints en cada arranque.
- **Revisión manual (22/10):** Verificado: showChangelogTour solo aparece en el tipo generado types.ts; ningún componente de la web, la TV ni el escritorio lo lee. El campo desaparece del JSON de /status; regenerar el codegen.
- **Riesgos / a revisar:** 1) El campo showChangelogTour desaparece del JSON de /status: hay que regenerar codegen/generated/public_structs.json y apps/web/src/api/generated/types.ts con go run ./codegen (no se ejecuto aqui). Nadie lee el campo, pero el tipo generado quedaria desfasado hasta regenerar. 2) util.VersionIsOlderThan pierde su unico llamador de produccion (sigue cubierto por version_test.go): candidato a limpieza en el ambito de util. 3) Si se quisiera un tour de changelog propio en el futuro hay que reintroducirlo con un mecanismo nuevo. 4) app.go esta modificado en el arbol de trabajo; numeros de linea tomados del estado actual en disco. Los edits de app.go de este hallazgo y del hallazgo OnError tocan zonas distintas del archivo.
- **Evidencia del hallazgo:** Grep -rn 'ShowTour|Tours\b' en .go: app.go:117, migrations.go, status.go:104 (no existe core.Tours fuera de migrations.go). Grep -rniE 'showChangelogTour' en web/src, KameHouseTV/src, apps/desktop/src y src-tauri/src: solo web/src/api/generated/types.ts:1155. Grep 'runMigrations': app.go:226 y la definicion. util.VersionIsOlderThan solo lo llama migrations.go en produccion. semver sigue en uso por internal/util/version.go, por lo que go.mod no cambia.
- Nota de aplicación: línea real 114 (desfase -1); línea real 125 (desfase -3); línea real 194 (desfase -5); línea real 220 (desfase -6); línea real 103 (desfase -1)

#### DM-11 · Índice idx_watch_history_acc_updated sin ninguna consulta que lo use

- **Severidad:** Baja · **Tipo:** Código Muerto · **Verificación:** mecánica + revisión manual
- **Problema:** La migración crea el índice (account_id, updated_at DESC) sobre watch_histories, pero ninguna consulta ordena esa tabla por updated_at: Continue Watching sale del filecache de continuidad y la única lectura de la tabla (BuildChronologyProgress) filtra por media_id y account_id.

**DM-11.1 — Archivo:** `internal/database/db/db_migrations.go` · **Líneas:** 142–145 · **Acción:** replace

ANTES:

```go
	// 3. Índices compuestos para consultas de alto tráfico (Continue Watching, catálogo, escaneo y caché)
	if err := db.Exec("CREATE INDEX IF NOT EXISTS idx_watch_history_acc_updated ON watch_histories (account_id, updated_at DESC)").Error; err != nil {
		logger.Error().Err(err).Msg("db: failed to create index idx_watch_history_acc_updated")
	}
```

DESPUÉS:

```go
	// 3. Índices compuestos para consultas de alto tráfico (catálogo, escaneo y caché).
	// watch_histories no se lee ordenada por updated_at (Continue Watching sale del filecache
	// de continuidad): se retira el índice (account_id, updated_at) que solo costaba escritura.
	if err := db.Exec("DROP INDEX IF EXISTS idx_watch_history_acc_updated").Error; err != nil {
		logger.Warn().Err(err).Msg("db: notice while dropping idx_watch_history_acc_updated")
	}
```

- **Razón técnica:** Cada insert nuevo de (account, media, episodio) en el flush de telemetría mantiene un B-tree adicional que nadie consulta. Además UpsertBatch hace DoUpdates solo de current_time y duration, así que updated_at ni siquiera se actualiza en los conflictos y el índice no refleja recencia real. Borrar un índice no toca filas.
- **Impacto esperado:** Menos trabajo de escritura en cada flush de telemetría de reproducción y menos espacio en disco/WAL; efecto pequeño pero sin ningún costo funcional.
- **Revisión manual (22/10):** Verificado: ninguna consulta ordena watch_histories por updated_at. Borrar un índice no toca filas.
- **Riesgos / a revisar:** Mínimo: si en el futuro se quiere leer watch_histories ordenada por recencia habrá que recrear el índice y hacer que UpsertBatch actualice updated_at. Ningún test referencia el índice (grep idx_watch_history_acc_updated: solo db_migrations.go:143-144).
- **Evidencia del hallazgo:** Grep `models.WatchHistory|watch_histories|UserMediaProgress` en código de producción: lecturas de la tabla solo en intelligence/chronology.go:90-94 (Where media_id IN ? AND account_id IN ?, cubierto por idx_media_episode); home.go:36 documenta que Continue Watching usa el filecache. Grep del nombre del índice: únicamente su creación en db_migrations.go.
- Nota de aplicación: línea real 141 (desfase -1)

#### DM-12 · Database.OnError y SetOnError: callback registrado que nunca se invoca

- **Severidad:** Baja · **Tipo:** Código Muerto · **Verificación:** mecánica + revisión manual
- **Problema:** SetOnError guarda un callback en Database.OnError y core/app.go lo registra para emitir un toast de error por WebSocket, pero ningun codigo invoca jamas db.OnError, asi que el toast 'DB Error' es inalcanzable.

**DM-12.1 — Archivo:** `internal/database/db/db.go` · **Líneas:** 28–28 · **Acción:** delete-lines

ANTES:

```go
	OnError                 func(error)
```

DESPUÉS: _(se elimina el bloque)_

**DM-12.2 — Archivo:** `internal/database/db/db.go` · **Líneas:** 49–53 · **Acción:** replace

ANTES:

```go
func (db *Database) SetOnError(f func(error)) {
	db.OnError = f
}

func (db *Database) Gorm() *gorm.DB {
```

DESPUÉS:

```go
func (db *Database) Gorm() *gorm.DB {
```

**DM-12.3 — Archivo:** `internal/core/app.go` · **Líneas:** 154–154 · **Acción:** replace

ANTES:

```go
	_, wsEventManager := initEventSystem(logger, database, shutdownCtx)
```

DESPUÉS:

```go
	_, wsEventManager := initEventSystem(logger, shutdownCtx)
```

**DM-12.4 — Archivo:** `internal/core/app.go` · **Líneas:** 382–391 · **Acción:** replace

ANTES:

```go
func initEventSystem(logger *zerolog.Logger, database *db.Database, shutdownCtx context.Context) (events.Dispatcher, *events.WSEventManager) {
	dispatcher := events.NewDispatcher()
	wsEventManager := events.NewWSEventManager(logger, dispatcher, shutdownCtx)
	database.SetOnError(func(err error) {
		if wsEventManager != nil {
			wsEventManager.SendEvent(events.ErrorToast, "DB Error: "+err.Error())
		}
	})
	return dispatcher, wsEventManager
}
```

DESPUÉS:

```go
func initEventSystem(logger *zerolog.Logger, shutdownCtx context.Context) (events.Dispatcher, *events.WSEventManager) {
	dispatcher := events.NewDispatcher()
	wsEventManager := events.NewWSEventManager(logger, dispatcher, shutdownCtx)
	return dispatcher, wsEventManager
}
```

- **Razón técnica:** Grep -rnw 'OnError' sobre todo el codigo de produccion devuelve unicamente db.go:28 (campo) y db.go:50 (asignacion); no hay ninguna llamada db.OnError(...) ni lectura del campo. En tests la unica coincidencia es el nombre TestListVideoFilesAbortsOnError (falso positivo por substring). El callback es un cable muerto: el usuario nunca recibe ese toast aunque falle una escritura.
- **Impacto esperado:** Elimina un campo, un metodo y un closure inalcanzable, y simplifica la firma de initEventSystem (un parametro menos). Evita dar la falsa impresion de que los errores de DB se notifican a la UI.
- **Revisión manual (22/10):** Verificado: al borrar el campo OnError cualquier llamada restante habría roto la compilación y no la rompe, así que el toast 'DB Error' era inalcanzable.
- **Riesgos / a revisar:** Si se quisiera de verdad notificar errores de DB a la UI habria que invocar el callback desde los puntos de error (p. ej. slow_trace_logger o un callback de GORM) en vez de borrarlo; hoy ese comportamiento no existe. events.ErrorToast puede quedar con menos usos (no se verifico si otros codigos lo emiten). app.go esta modificado en el arbol de trabajo y es zona de otro agente; los numeros de linea son del estado actual en disco.
- **Evidencia del hallazgo:** Grep -rn '\.OnError\b|OnError:' en internal: solo db.go:50. Grep -rnw SetOnError: app.go:385 y la definicion. initEventSystem tiene un unico llamador (app.go:154). El import db de app.go sigue en uso (otros parametros *db.Database) y events sigue en uso (NewDispatcher, NewWSEventManager).
- Nota de aplicación: línea real 48 (desfase -1); línea real 149 (desfase -5); línea real 375 (desfase -7)

#### DM-13 · dto.NormalizedMedia: campos OMDb y Relations sin ninguna referencia

- **Severidad:** Baja · **Tipo:** Código Muerto · **Verificación:** mecánica + revisión manual
- **Problema:** NormalizedMedia declara ImdbRating, ImdbVotes, Director, Awards, Rated, RTRating (comentados como 'enrichment OMDb' que no existe) y Relations con su tipo NormalizedMediaRelation; ningun codigo los lee ni los escribe.

**DM-13.1 — Archivo:** `internal/database/models/dto/normalized_media.go` · **Líneas:** 23–23 · **Acción:** delete-lines

ANTES:

```go
	Relations         []*NormalizedMediaRelation
```

DESPUÉS: _(se elimina el bloque)_

**DM-13.2 — Archivo:** `internal/database/models/dto/normalized_media.go` · **Líneas:** 30–37 · **Acción:** replace

ANTES:

```go
	// OMDb enrichment (filled in Stage 4 if OMDb API key is configured)
	ImdbRating *string // "8.4"
	ImdbVotes  *string // "1,234,567"
	Runtime    *int    // minutes
	Director   *string
	Awards     *string
	Rated      *string // "PG-13"
	RTRating   *string // Rotten Tomatoes rating e.g. "94%"
```

DESPUÉS:

```go
	Runtime *int // minutes
```

**DM-13.3 — Archivo:** `internal/database/models/dto/normalized_media.go` · **Líneas:** 70–74 · **Acción:** delete-lines

ANTES:

```go

type NormalizedMediaRelation struct {
	RelationType string
	Media        *NormalizedMedia
}
```

DESPUÉS: _(se elimina el bloque)_

- **Razón técnica:** NormalizedMedia es un DTO interno de Go sin tags json y sin uso en el frontend (0 apariciones en web/src/api/generated/types.ts y en componentes). Grep de ImdbRating|ImdbVotes|RTRating|Awards|Director|Rated|omdb en todo apps/server solo coincide en este archivo (el unico otro match case-insensitive fue buildCandidateFromDb en selector.go, falso positivo por la subcadena 'omdb'); no existe cliente OMDb. Grep de '\.Relations\b|Relations:' sobre todos los .go (incluidos tests) no encuentra ni una lectura ni una asignacion de NormalizedMedia.Relations; NormalizedMediaRelation solo la referencia ese campo. Runtime si tiene referencias y se conserva.
- **Impacto esperado:** Quita 9 declaraciones muertas del DTO de metadatos mas un tipo, y un comentario que describe una integracion OMDb inexistente. Reduce el tamaño de NormalizedMedia en memoria por cada instancia creada durante el escaneo.
- **Revisión manual (22/10):** Verificado: ni imdbRating, imdbVotes, director, awards, rated, rtRating ni Relations se leen ni se escriben en el servidor, y la web no los recibe.
- **Riesgos / a revisar:** codegen/generated/public_structs.json lista NormalizedMedia (62 menciones del nombre): regenerar con go run ./codegen para que el JSON no quede desfasado; no afecta a los tipos TS (no se exportan). Si se planea sumar enriquecimiento OMDb, habria que reintroducir los campos entonces.
- **Evidencia del hallazgo:** Seed zero-ref-identifiers.txt marca ImdbRating(31), ImdbVotes(32), Director(34), Awards(35), Rated(36), RTRating(37) con prodRefs=0 y testRefs=0; verificado ademas con grep por nombre en composite literals (normalized_media_factory.go:51, anidb_provider.go:347, anilist_provider.go) que ninguno los asigna. Relations no estaba en el seed pero el grep demuestra 0 referencias. Lineas numeradas contando el archivo de 74 lineas (coinciden con los numeros del seed).
- Nota de aplicación: línea real 29 (desfase -1); línea real 62 (desfase -8)

#### DM-14 · Eliminar POST /drive/callback (rama POST programatica de HandleDriveCallback)

- **Severidad:** Baja · **Tipo:** Código Muerto · **Verificación:** mecánica + revisión manual
- **Problema:** El callback de Google Drive se registra para GET y POST con un handler de doble rama. La web solo usa el flujo de redirect del navegador (GET, popup que hace postMessage KAMEHOUSE_DRIVE_CONNECTED); nadie hace POST a /drive/callback con code/clientId/clientSecret/redirectUri en el cuerpo.

**DM-14.1 — Archivo:** `internal/handlers/routes_drive.go` · **Líneas:** 13–13 · **Acción:** delete-lines

ANTES:

```go
	drive.POST("/callback", h.HandleDriveCallback)
```

DESPUÉS: _(se elimina el bloque)_

**DM-14.2 — Archivo:** `internal/handlers/drive.go` · **Líneas:** 202–207 · **Acción:** replace

ANTES:

```go
		`)
	}

	return h.RespondWithData(c, map[string]interface{}{
		"success": true,
	})
```

DESPUÉS:

```go
		`)
```

**DM-14.3 — Archivo:** `internal/handlers/drive.go` · **Líneas:** 186–187 · **Acción:** replace

ANTES:

```go
	if c.Request().Method == http.MethodGet {
		return c.HTML(http.StatusOK, `
```

DESPUÉS:

```go
	return c.HTML(http.StatusOK, `
```

**DM-14.4 — Archivo:** `internal/handlers/drive.go` · **Líneas:** 141–148 · **Acción:** replace

ANTES:

```go
	token, err := drive.ExchangeCode(c.Request().Context(), clientID, clientSecret, code, redirectURI)
	if err != nil {
		h.App.Logger.Error().Err(err).Msg("drive: Failed to exchange OAuth code")
		if c.Request().Method == http.MethodGet {
			return c.HTML(http.StatusBadRequest, fmt.Sprintf("<html><body><h3>Error al intercambiar código: %s</h3></body></html>", html.EscapeString(err.Error())))
		}
		return h.RespondWithError(c, err)
	}
```

DESPUÉS:

```go
	token, err := drive.ExchangeCode(c.Request().Context(), clientID, clientSecret, code, redirectURI)
	if err != nil {
		h.App.Logger.Error().Err(err).Msg("drive: Failed to exchange OAuth code")
		return c.HTML(http.StatusBadRequest, fmt.Sprintf("<html><body><h3>Error al intercambiar código: %s</h3></body></html>", html.EscapeString(err.Error())))
	}
```

**DM-14.5 — Archivo:** `internal/handlers/drive.go` · **Líneas:** 73–139 · **Acción:** replace

ANTES:

```go
// HandleDriveCallback exchanges the authorization code for OAuth2 tokens and saves them in Settings.
// Supports both browser redirect (GET) and programmatic POST.
//
//	@summary exchanges code and enables Google Drive integration.
//	@route /api/v1/drive/callback [GET, POST]
func (h *Handler) HandleDriveCallback(c echo.Context) error {
	var code, clientID, clientSecret, redirectURI string

	if c.Request().Method == http.MethodGet {
		state := c.QueryParam("state")
		if _, err := h.App.GetServerPasswordHMACAuth().ValidateToken(state, "drive-oauth"); err != nil {
			h.App.Logger.Warn().Err(err).Msg("drive: Invalid or expired OAuth state")
			return c.HTML(http.StatusBadRequest, "<html><body style='font-family:sans-serif;background:#121212;color:#fff;padding:2rem;'><h3>Error de seguridad</h3><p>El token de estado OAuth es inválido o ha expirado. Por favor, intenta conectar nuevamente desde Ajustes.</p></body></html>")
		}

		code = c.QueryParam("code")
		if code == "" {
			errParam := c.QueryParam("error")
			if errParam == "" {
				errParam = "authorization failed"
			}
			return c.HTML(http.StatusBadRequest, fmt.Sprintf("<html><body><h3>Error de autorización: %s</h3></body></html>", html.EscapeString(errParam)))
		}
		// Read saved client credentials from settings
		if s, err := h.App.Database.GetSettings(); err == nil && s != nil {
			clientID = s.GoogleDrive.ClientID
			clientSecret = s.GoogleDrive.ClientSecret
		}
		proto := "http"
		if c.IsTLS() || c.Request().Header.Get("X-Forwarded-Proto") == "https" {
			proto = "https"
		}
		redirectURI = fmt.Sprintf("%s://%s/api/v1/drive/callback", proto, c.Request().Host)
	} else {
		var req struct {
			Code         string `json:"code"`
			ClientID     string `json:"clientId"`
			ClientSecret string `json:"clientSecret"`
			RedirectURI  string `json:"redirectUri"`
		}
		if err := c.Bind(&req); err != nil {
			return h.RespondWithError(c, err)
		}
		code = req.Code
		clientID = req.ClientID
		clientSecret = req.ClientSecret
		// El formulario reenvía el secreto enmascarado que recibió: usar el guardado.
		if models.IsMaskedSecret(clientSecret) {
			clientSecret = ""
		}
		redirectURI = req.RedirectURI

		if clientID == "" || clientSecret == "" {
			if s, err := h.App.Database.GetSettings(); err == nil && s != nil {
				if clientID == "" {
					clientID = s.GoogleDrive.ClientID
				}
				if clientSecret == "" {
					clientSecret = s.GoogleDrive.ClientSecret
				}
			}
		}
	}

	if code == "" || clientID == "" || clientSecret == "" {
		return h.RespondWithCodeError(c, http.StatusBadRequest, errors.New("code, clientId and clientSecret are required"))
	}
```

DESPUÉS:

```go
// HandleDriveCallback exchanges the authorization code for OAuth2 tokens and saves them in Settings.
// Es el redirect del navegador (GET) con el que Google cierra la autorización.
//
//	@summary exchanges code and enables Google Drive integration.
//	@route /api/v1/drive/callback [GET]
func (h *Handler) HandleDriveCallback(c echo.Context) error {
	state := c.QueryParam("state")
	if _, err := h.App.GetServerPasswordHMACAuth().ValidateToken(state, "drive-oauth"); err != nil {
		h.App.Logger.Warn().Err(err).Msg("drive: Invalid or expired OAuth state")
		return c.HTML(http.StatusBadRequest, "<html><body style='font-family:sans-serif;background:#121212;color:#fff;padding:2rem;'><h3>Error de seguridad</h3><p>El token de estado OAuth es inválido o ha expirado. Por favor, intenta conectar nuevamente desde Ajustes.</p></body></html>")
	}

	code := c.QueryParam("code")
	if code == "" {
		errParam := c.QueryParam("error")
		if errParam == "" {
			errParam = "authorization failed"
		}
		return c.HTML(http.StatusBadRequest, fmt.Sprintf("<html><body><h3>Error de autorización: %s</h3></body></html>", html.EscapeString(errParam)))
	}
	// Read saved client credentials from settings
	var clientID, clientSecret string
	if s, err := h.App.Database.GetSettings(); err == nil && s != nil {
		clientID = s.GoogleDrive.ClientID
		clientSecret = s.GoogleDrive.ClientSecret
	}
	proto := "http"
	if c.IsTLS() || c.Request().Header.Get("X-Forwarded-Proto") == "https" {
		proto = "https"
	}
	redirectURI := fmt.Sprintf("%s://%s/api/v1/drive/callback", proto, c.Request().Host)

	if clientID == "" || clientSecret == "" {
		return h.RespondWithCodeError(c, http.StatusBadRequest, errors.New("code, clientId and clientSecret are required"))
	}
```

- **Razón técnica:** La unica ruta que alcanza el handler en uso es el redirect GET de Google (los URI de redireccion que muestra apps/web/src/routes/settings/components/-google-drive-card.tsx:237-255 son para configurar la consola de Google; la pagina HTML de exito hace window.opener.postMessage KAMEHOUSE_DRIVE_CONNECTED). La rama POST (clientId/clientSecret/redirectUri en el cuerpo) no tiene ningun llamador, ni siquiera un DriveCallback en el endpoints.ts generado. Se conserva el comportamiento del GET byte a byte (HTML, mensajes, validacion de state). Los imports de drive.go siguen todos en uso: models.IsMaskedSecret en HandleDriveAuthURL (linea 30), errors, html, fmt, http. Las lineas internas del raw string de la pagina de exito no se tocan, solo se des-anida el return.
- **Impacto esperado:** Reduce la superficie de la API: deja de existir un endpoint de escritura que aceptaba credenciales OAuth en el cuerpo y un redirectUri arbitrario; el handler queda lineal y mas corto (~35 lineas menos).
- **Revisión manual (22/10):** Verificado: la web solo muestra la URL de callback como URI de redirección de Google (GET); nadie hace POST. Quedan inertes la entrada de sensitiveMethodRoutes y su caso de test, como indica el paso.
- **Riesgos / a revisar:** Regenerar el codegen (apps/server/codegen) por el cambio de la anotacion @route ([GET, POST] -> [GET]). Quedan inertes y siguen pasando (son path-only) la entrada de sensitiveMethodRoutes server_auth_middleware.go:145 y el caso sensitive_endpoint_test.go:58 de POST /drive/callback; se pueden depurar despues (si se borra la entrada hay que borrar tambien ese caso). TestLANWriteRoutesExist no se ve afectado (/drive/callback no esta en lanWriteRoutes). Aplicar los 5 edits de drive.go juntos y en orden de lineas descendente (estan dados con numeros del archivo actual). Si se anticipa un cliente de escritorio/movil que complete OAuth con codigo manual por POST, habria que reintroducirlo.
- **Evidencia del hallazgo:** Bucle de shell: 'drive/callback' en apps/web/src solo aparece en -google-drive-card.tsx (cadenas de texto de URIs de redireccion, lineas 237-240 y 255), no hay fetch/buildApiQuery a esa ruta; KameHouseTV/src, apps/desktop/src-tauri/src y scripts = 0. apps/web/src/api/generated/endpoints.ts tiene DRIVE.DriveAuthURL/Status/Disconnect/Scan pero ningun DriveCallback. Read de drive.go:73-208 confirma que la rama else (POST) solo se alimenta del cuerpo JSON; ningun test Go invoca HandleDriveCallback (grep 'HandleDriveCallback' en *_test.go = 0).

#### DM-15 · Eliminar GET /library/scan/status, su handler y las funciones que quedan huerfanas (db.GetScanSummaries, dto.ScanSummaryItem)

- **Severidad:** Baja · **Tipo:** Código Muerto · **Verificación:** mecánica + revisión manual
- **Problema:** HandleGetScanStatus no tiene consumidor: la web recibe el estado del escaneo por WebSocket (WSEvents.SCAN_STATUS) y no existe ninguna llamada a scan/status. Al quitarlo, db.GetScanSummaries y el tipo dto.ScanSummaryItem solo eran usados por este handler.

**DM-15.1 — Archivo:** `internal/handlers/routes_library.go` · **Líneas:** 10–10 · **Acción:** delete-lines

ANTES:

```go
	v1Library.GET("/scan/status", h.HandleGetScanStatus)
```

DESPUÉS: _(se elimina el bloque)_

**DM-15.2 — Archivo:** `internal/handlers/scan.go` · **Líneas:** 248–278 · **Acción:** delete-lines

ANTES:

```go
// HandleGetScanStatus ...
//
//	@summary returns the latest scan summary.
//	@desc Returns metadata about the most recent library scan:
//	@desc  - timestamp, duration, matched/unmatched file counts, errors.
//	@desc Clients can poll this endpoint instead of relying solely on WebSocket events.
//	@route /api/v1/library/scan/status [GET]
//	@returns dto.ScanSummaryItem
func (h *Handler) HandleGetScanStatus(c echo.Context) error {
	summaries, err := db.GetScanSummaries(h.App.Database)
	if err != nil {
		return h.RespondWithError(c, err)
	}

	if len(summaries) == 0 {
		return h.RespondWithData(c, map[string]any{
			"status":  "idle",
			"message": "No scan has been performed yet",
		})
	}

	// Return the most recent summary (GetScanSummaries returns them in insertion order).
	latest := summaries[len(summaries)-1]
	return h.RespondWithData(c, map[string]any{
		"status":     "done",
		"lastScanAt": latest.CreatedAt,
		"summary":    latest.ScanSummary,
		"engine":     "Antigravity-v2",
	})
}
```

DESPUÉS: _(se elimina el bloque)_

**DM-15.3 — Archivo:** `internal/database/db/scan_summary.go` · **Líneas:** 10–33 · **Acción:** delete-lines

ANTES:

```go
func GetScanSummaries(database *Database) ([]*dto.ScanSummaryItem, error) {
	var res []*models.ScanSummary
	err := database.Gorm().Find(&res).Error
	if err != nil {
		return nil, err
	}

	// Unmarshal the data
	var items []*dto.ScanSummaryItem
	for _, r := range res {
		smBytes := r.Value
		var sm dto.ScanSummary
		if err := json.Unmarshal(smBytes, &sm); err != nil {
			return nil, err
		}
		items = append(items, &dto.ScanSummaryItem{
			CreatedAt:   r.CreatedAt,
			ScanSummary: &sm,
		})
	}

	return items, nil
}
```

DESPUÉS: _(se elimina el bloque)_

**DM-15.4 — Archivo:** `internal/database/models/dto/scan_summary_dto.go` · **Líneas:** 35–39 · **Acción:** delete-lines

ANTES:

```go

	ScanSummaryItem struct { // Database item
		CreatedAt   time.Time    `json:"createdAt"`
		ScanSummary *ScanSummary `json:"scanSummary"`
	}
```

DESPUÉS: _(se elimina el bloque)_

**DM-15.5 — Archivo:** `internal/database/models/dto/scan_summary_dto.go` · **Líneas:** 3–6 · **Acción:** delete-lines

ANTES:

```go
import (
	"time"
)
```

DESPUÉS: _(se elimina el bloque)_

- **Razón técnica:** La unica referencia a GetScanSummaries es scan.go:257 y a ScanSummaryItem son scan_summary.go y el comentario @returns del handler. InsertScanSummary (usado en scan.go:226) conserva los imports models, dto y json de scan_summary.go, de modo que ese bloque import no cambia. En scan_summary_dto.go, 'time' solo se usaba en ScanSummaryItem, por eso se elimina tambien el import; el resto de tipos del grupo type() no cambia. scan.go sigue usando db (InsertScanSummary) asi que su import tampoco cambia. Ademas desaparece la cadena de texto 'Antigravity-v2' del motor.
- **Impacto esperado:** Quita una ruta, un handler, una consulta que cargaba toda la tabla scan_summaries y un tipo DTO muertos (~70 lineas).
- **Revisión manual (22/10):** Verificado: GetScanStatus no se usa en la web ni la TV.
- **Riesgos / a revisar:** Regenerar el codegen (apps/server/codegen) para actualizar handlers.json, public_structs.json (ScanSummaryItem) y apps/web/src/api/generated/endpoints.ts + types.ts (SCAN.GetScanStatus, y el grupo SCAN_SUMMARY.GetScanSummaries de /library/scan-summaries, que ya esta obsoleto: esa ruta no existe en ningun routes*.go, solo en la lista de server_features_middleware.go:39, entrada que tambien se puede depurar despues). Confirmar con tsc que la web no importa el tipo ScanSummaryItem (grep fuera de generated = 0). Ningun test Go referencia estos simbolos. Si algun cliente LAN futuro quisiera sondear el estado del escaneo por HTTP, habria que reintroducirlo.
- **Evidencia del hallazgo:** Bucle de shell: 'scan/status' en apps/web/src (sin generated), KameHouseTV/src, apps/desktop/src-tauri/src y scripts = 0; apps/web/src/lib/server/scan-status.ts solo traduce estados del evento WS (websocket-provider.tsx:253 case WSEvents.SCAN_STATUS). grep 'GetScanSummaries' en apps/server: definicion scan_summary.go:10 y uso scan.go:257; grep 'ScanSummaryItem': scan_summary.go, dto/scan_summary_dto.go:36 y el comentario de scan.go:255; sin tests. grep 'scan-summaries' en Go: solo server_features_middleware.go:39.

#### DM-16 · Quitar alias de subtitulos sin uso: /mediastream/subs y /mediastream/subtitles/pgs

- **Severidad:** Baja · **Tipo:** Código Muerto · **Verificación:** mecánica + revisión manual
- **Problema:** Hay dos pares de rutas hacia el mismo handler (subs/subtitles y subs/pgs/subtitles/pgs). Los clientes usan solo /subtitles (texto) y /subs/pgs (PGS); /subs y /subtitles/pgs son alias duplicados sin consumidor.

**DM-16.1 — Archivo:** `internal/handlers/routes_streaming.go` · **Líneas:** 24–27 · **Acción:** replace

ANTES:

```go
	v1Mediastream.GET("/subs", h.HandleMediastreamGetSubtitles)
	v1Mediastream.GET("/subs/pgs", h.HandleMediastreamGetPGSEvents)
	v1Mediastream.GET("/subtitles", h.HandleMediastreamGetSubtitles)     // alias matching frontend requests
	v1Mediastream.GET("/subtitles/pgs", h.HandleMediastreamGetPGSEvents) // alias matching frontend requests
```

DESPUÉS:

```go
	// El front pide /subtitles (texto) y /subs/pgs (imagen/PGS); no hay mas alias.
	v1Mediastream.GET("/subs/pgs", h.HandleMediastreamGetPGSEvents)
	v1Mediastream.GET("/subtitles", h.HandleMediastreamGetSubtitles)
```

- **Razón técnica:** Se conservan las dos rutas reales y se quitan los alias. El prefijo '/api/v1/mediastream/subs' en streamTokenPathPrefixes (server_auth_middleware.go:84) sigue cubriendo /subs/pgs por HasPrefix, y '/api/v1/mediastream/subtitles' cubre /subtitles, por lo que los tokens de streaming no se ven afectados. Las pruebas de gzip (routes_gzip_test.go:23-24) y de endpoint sensible (sensitive_endpoint_test.go:18) trabajan por cadena de ruta, no por ruta registrada.
- **Impacto esperado:** Dos registros de ruta duplicados menos y una API mas clara (una sola ruta por tipo de subtitulo).
- **Revisión manual (22/10):** Verificado: la web pide /mediastream/subtitles y /mediastream/subs/pgs, y la TV /mediastream/subtitles; el paso conserva exactamente esas dos y quita /subs y /subtitles/pgs, que nadie usa.
- **Riesgos / a revisar:** No requiere regenerar nada del front, pero si regenera handlers.json de codegen (las anotaciones @route ya apuntan al handler, verificar que el generador no dependa de los alias). Si algun cliente externo (mpv/otras apps) usara /subs o /subtitles/pgs recibira 404; no hay evidencia en el repo. El comentario de la ruta se ajusta porque la alineacion de comentarios finales de gofmt cambia al quedar una sola linea con comentario.
- **Evidencia del hallazgo:** apps/web/src/components/video/player-orchestrator.tsx:128 elige '/api/v1/mediastream/subs/pgs' o '/api/v1/mediastream/subtitles'; KameHouseTV/src/utils/useSubtitleCues.ts:77 usa '/api/v1/mediastream/subtitles'. Grep recursivo de 'mediastream/(subs|subtitles)' y '/subtitles/pgs' en apps (Go, web, desktop), TV y scripts: ninguna llamada a '/mediastream/subs' (sin /pgs) ni a '/subtitles/pgs'; solo tests y las listas de prefijos de auth. endpoints.ts generado no incluye estas rutas. internal/mediastream/videofile/extract.go:20 usa '/subs' como directorio del sistema de archivos, no como URL.
- Nota de aplicación: línea real 22 (desfase -2)

#### DM-17 · getLimiter: mutex externo y ramas nil inalcanzables sobre un lru.Cache que ya es thread-safe

- **Severidad:** Baja · **Tipo:** Código Muerto · **Verificación:** mecánica + revisión manual
- **Problema:** limitersCache es un hashicorp lru.Cache (con su propio lock) creado con tamano 1000, asi que lru.New nunca devuelve error ni nil; las ramas 'limitersCache != nil' / 'limitersCache == nil' son inalcanzables y reasignan una variable de paquete sin sincronizacion. limiterMu solo agrega un segundo mutex global en cada fallo de cache (cada IP nueva).

**DM-17.1 — Archivo:** `internal/handlers/routes.go` · **Líneas:** 9–11 · **Acción:** replace

ANTES:

```go
	"strings"
	"sync"
	"time"
```

DESPUÉS:

```go
	"strings"
	"time"
```

**DM-17.2 — Archivo:** `internal/handlers/routes.go` · **Líneas:** 48–70 · **Acción:** replace

ANTES:

```go
var (
	limiterMu        sync.Mutex
	limitersCache, _ = lru.New[string, *rate.Limiter](1000)
)

func getLimiter(key string, r rate.Limit, b int) *rate.Limiter {
	if limitersCache != nil {
		if l, ok := limitersCache.Get(key); ok {
			return l
		}
	}
	limiterMu.Lock()
	defer limiterMu.Unlock()
	if limitersCache == nil {
		limitersCache, _ = lru.New[string, *rate.Limiter](1000)
	}
	if l, ok := limitersCache.Get(key); ok {
		return l
	}
	l := rate.NewLimiter(r, b)
	limitersCache.Add(key, l)
	return l
}
```

DESPUÉS:

```go
// limitersCache es seguro entre goroutines por si mismo (lru.Cache lleva su propio lock) y
// lru.New solo falla con tamano <= 0: no hace falta mutex externo ni reconstruirlo.
var limitersCache, _ = lru.New[string, *rate.Limiter](1000)

func getLimiter(key string, r rate.Limit, b int) *rate.Limiter {
	if l, ok := limitersCache.Get(key); ok {
		return l
	}
	l := rate.NewLimiter(r, b)
	// PeekOrAdd es atomico: si otra goroutine creo el limitador entre el Get y aca, gana el primero.
	if prev, ok, _ := limitersCache.PeekOrAdd(key, l); ok {
		return prev
	}
	return l
}
```

- **Razón técnica:** Cada request remoto pasa por getLimiter dos veces (rateLimitMiddleware y authRateLimitMiddleware). lru.Cache.Get ya serializa internamente (actualiza el orden de recencia), por lo que el camino caliente solo contiene ese lock; limiterMu solo se toma al fallar. Quitarlo y usar PeekOrAdd (disponible en golang-lru/v2 v2.0.7, go.mod:18) conserva la garantia de un unico limitador por clave con menos codigo y sin el chequeo/reasignacion nil que era una carrera potencial sobre la variable de paquete. No se reemplaza el lock interno del LRU: la ganancia de rendimiento es pequena y el objetivo es eliminar el segundo mutex y el codigo muerto.
- **Impacto esperado:** Menos codigo y un solo punto de sincronizacion en el middleware de rate limit; elimina una carrera teorica sobre limitersCache. Mejora de contencion marginal (el lock interno del LRU permanece).
- **Revisión manual (22/10):** Correcto: PeekOrAdd de golang-lru/v2 es atómico, así que se conserva un único limitador por clave sin el mutex externo ni la reasignación de la variable de paquete.
- **Riesgos / a revisar:** Ningun otro archivo referencia limiterMu ni limitersCache (Grep sobre apps/server/*.go). El import 'sync' de routes.go se usaba unicamente para limiterMu (Grep 'sync\.' en internal/handlers: routes.go solo en la linea 49), por eso se elimina. Para un uso intensivo con miles de IPs distintas habria que shardear el LRU, no se propone aqui.
- **Evidencia del hallazgo:** Grep 'limiterMu|getLimiter' en apps/server: unicos usos en routes.go (49, 53-70, 88, 102). Read de routes.go 1-107. golang-lru v2.0.7 en go.mod incluye (*Cache).PeekOrAdd(key, value) (previous V, ok, evicted bool).
- Nota de aplicación: línea real 46 (desfase -2)

#### DM-18 · Mapa existingFolders de discoverFilePaths se llena pero nunca se lee

- **Severidad:** Baja · **Tipo:** Código Muerto · **Verificación:** mecánica + revisión manual
- **Problema:** En discoverFilePaths se construye existingFolders recorriendo todos los ExistingLocalFiles (filepath.Dir + NormalizePath + inserción en mapa por archivo) y la variable no se vuelve a usar: es trabajo y memoria muertos en cada escaneo.

**DM-18.1 — Archivo:** `internal/library/scanner/discovery.go` · **Líneas:** 36–44 · **Acción:** replace

ANTES:

```go
	existingFolders := make(map[string]struct{})
	for _, lf := range scn.ExistingLocalFiles {
		if lf == nil {
			continue
		}
		existingFolders[util.NormalizePath(filepath.Dir(lf.Path))] = struct{}{}
	}

	retrievedPathMap := make(map[string]struct{})
```

DESPUÉS:

```go
	retrievedPathMap := make(map[string]struct{})
```

- **Razón técnica:** Go no marca el mapa como 'declarado y no usado' porque indexarlo para asignar cuenta como uso, pero el contenido jamás se consulta. Eliminarlo no cambia ningún comportamiento observable. Los imports filepath y util siguen usándose en el resto de la función (WalkDir, Ext, NormalizePath, IsValidMediaFile).
- **Impacto esperado:** Evita, por escaneo, una asignación de filepath.Dir y otra de NormalizePath (ToLower en Windows) por cada archivo ya conocido, más el crecimiento incremental del mapa: con 5000 archivos son ~10-15 mil asignaciones y un mapa de miles de entradas retenido durante todo el recorrido de directorios.
- **Revisión manual (22/10):** Correcto: el mapa solo se llenaba; el compilador confirma que no tiene otra referencia.
- **Riesgos / a revisar:** Ninguno funcional. Verificado que no hay otras referencias.
- **Evidencia del hallazgo:** Grep existingFolders en internal/library/scanner: solo discovery.go:36 (declaración) y discovery.go:41 (inserción). Read de discovery.go L20-102: ninguna lectura posterior en discoverFilePaths, que devuelve paths, libraryPaths y sortedLibraryPaths.

#### DM-19 · Eliminar el campo MatchingAlgorithm de Scanner y ScannerOptions: nadie lo asigna ni lo lee

- **Severidad:** Baja · **Tipo:** Código Muerto · **Verificación:** mecánica + revisión manual
- **Problema:** Scanner.MatchingAlgorithm y ScannerOptions.MatchingAlgorithm se copian en NewScanner, pero ningún llamador (handlers/scan.go, autoscanner) lo rellena y ningún código del escáner lo lee: es un resto del matcher legacy.

**DM-19.1 — Archivo:** `internal/library/scanner/scanner_engine.go` · **Líneas:** 39–42 · **Acción:** replace

ANTES:

```go
	MatchingThreshold   float64 // only used by legacy

	MatchingAlgorithm string // only used by legacy
	StrictStructure   bool   // new matching mode
```

DESPUÉS:

```go
	MatchingThreshold   float64 // only used by legacy

	StrictStructure bool // new matching mode
```

**DM-19.2 — Archivo:** `internal/library/scanner/scanner_engine.go` · **Líneas:** 86–86 · **Acción:** delete-lines

ANTES:

```go
	MatchingAlgorithm    string
```

DESPUÉS: _(se elimina el bloque)_

**DM-19.3 — Archivo:** `internal/library/scanner/scanner_engine.go` · **Líneas:** 124–124 · **Acción:** delete-lines

ANTES:

```go
		MatchingAlgorithm:    opts.MatchingAlgorithm,
```

DESPUÉS: _(se elimina el bloque)_

- **Razón técnica:** El único flujo del campo es ScannerOptions.MatchingAlgorithm -> Scanner.MatchingAlgorithm dentro de NewScanner. Los dos sitios que construyen ScannerOptions (scan.go:150 y autoscanner.go:234) solo fijan MatchingThreshold, y scan_phases.go solo lee scn.MatchingThreshold. En la configuración del usuario tampoco existe un ajuste scannerMatchingAlgorithm (models.go solo tiene ScannerMatchingThreshold), así que no hay nada que cablear. MatchingThreshold sí se usa y se conserva.
- **Impacto esperado:** Elimina una opción de configuración fantasma y su cadena de copia; reduce confusión sobre qué algoritmos admite el escáner.
- **Revisión manual (22/10):** Correcto: ningún llamador rellena MatchingAlgorithm y el struct del escáner no se serializa.
- **Riesgos / a revisar:** Ninguno. Si se quiere reintroducir un selector de algoritmo habría que añadirlo de nuevo con consumidor real. El struct Scanner no se serializa ni aparece en codegen/generated.
- **Evidencia del hallazgo:** Grep -rn --include=*.go -E 'MatchingThreshold|MatchingAlgorithm' sobre el módulo: MatchingAlgorithm aparece solo en scanner_engine.go (líneas 41, 86 y 124); grep en codegen/generated/*.json sin resultados. Copia en scratchpad con los tres edits: gofmt -l limpio, go build ./... y go vet ./... sin errores (incluye compilación de pruebas), go test ./internal/library/scanner/ en verde.
- Nota de aplicación: línea real 85 (desfase -1); línea real 122 (desfase -2)

#### DM-20 · Eliminar Packet, las banderas de paquete y los tipos de seek del paquete matroska (nunca se usa un demuxer de paquetes)

- **Severidad:** Baja · **Tipo:** Código Muerto · **Verificación:** mecánica
- **Problema:** internal/matroska/types.go arrastra el modelo de demuxing de paquetes de la librería original (struct Packet, constantes UnknownStart/UnknownEnd/KF/GAP/StreamMask/StreamShift y SeekToPrevKeyFrame/SeekToPrevKeyFrameStrict). El paquete solo parsea cabeceras, pistas, cues, capítulos, tags y adjuntos; no existe ReadPacket ni Seek y nadie referencia estos símbolos.

**DM-20.1 — Archivo:** `internal/matroska/types.go` · **Líneas:** 10–12 · **Acción:** replace

ANTES:

```go
//   - Seek types for navigation
//   - Packet flags for demuxed data
//   - Core data structures like Packet, TrackInfo, SegmentInfo, Attachment, Chapter, Cue, and Tag
```

DESPUÉS:

```go
//   - Core data structures like TrackInfo, SegmentInfo, Attachment, Chapter, Cue, and Tag
```

**DM-20.2 — Archivo:** `internal/matroska/types.go` · **Líneas:** 58–118 · **Acción:** replace

ANTES:

```go
// Seek types
//
// These constants define the different seeking behaviors that can be used when navigating
// through a Matroska file. They control how the player handles seeking operations.
const (
	// SeekToPrevKeyFrame seeks to the previous key frame before the requested position.
	SeekToPrevKeyFrame = 1
	// SeekToPrevKeyFrameStrict seeks to the previous key frame before the requested position,
	// but does not allow going beyond that point even if it means displaying nothing.
	SeekToPrevKeyFrameStrict = 2
)

// Packet flags
//
// These constants define flags that can be returned with a matroska.Packet in its Flags member.
// They provide additional information about the packet's properties and characteristics.
const (
	// UnknownStart indicates that the packet starts at an unknown position.
	UnknownStart = 0x00000001
	// UnknownEnd indicates that the packet ends at an unknown position.
	UnknownEnd = 0x00000002
	// KF indicates that the packet is a key frame.
	KF = 0x00000004
	// GAP indicates that the packet is a gap packet, which should be skipped during playback.
	GAP = 0x00800000
	// StreamMask is a bitmask used to extract the stream number from the Flags field.
	StreamMask = 0xff000000
	// StreamShift is the number of bits to shift right to extract the stream number from the Flags field.
	StreamShift = 24
)

// Packet contains a demuxed packet from a Matroska file.
//
// A Packet represents a single unit of media data that has been extracted (demuxed) from
// a Matroska container. It contains all the necessary information to process the media data,
// including timing information, track association, and the actual data payload.
type Packet struct {
	// Track is the track number this packet belongs to.
	// This corresponds to the TrackInfo.Number of the track.
	Track uint8
	// StartTime is the start time of this packet in nanoseconds.
	// This is the timestamp when the packet should be presented.
	StartTime uint64
	// EndTime is the end time of this packet in nanoseconds.
	// This is the timestamp when the packet should stop being presented.
	EndTime uint64
	// FilePos is the position in the input stream where this packet is located.
	// This can be useful for seeking or debugging purposes.
	FilePos uint64
	// Data contains the actual packet data.
	// This is the raw media data that needs to be decoded by the appropriate codec.
	Data []byte
	// Flags contains any packet flags. See the packet flag constants for details.
	// These flags provide additional information about the packet's properties.
	Flags uint32
	// Discard indicates whether this packet can be discarded.
	// A non-zero value suggests that the packet can be safely discarded without affecting playback.
	Discard int64
}

// TrackInfo contains information about a track in a Matroska file.
```

DESPUÉS:

```go
// TrackInfo contains information about a track in a Matroska file.
```

- **Razón técnica:** El paquete matroska solo se consume desde cassette/keyframe.go y mkvparser/mkvparser.go, y desde fuera solo se usan NewDemuxer, TypeVideo/TypeAudio/TypeSubtitle, los IDs de elementos, Cue, Tag y Demuxer. Packet y sus banderas pertenecían a la API ReadPacket/Seek de la librería de origen, que no se portó. Quedan solo menciones en comentarios de documentación.
- **Impacto esperado:** Quita 61 líneas de tipos y documentación que sugieren una capacidad de demuxing que el paquete no tiene, y evita que alguien intente usarlos. Sin cambio de comportamiento.
- **Riesgos / a revisar:** Ninguno: no hay referencias en producción, pruebas, codegen ni clientes. Quedan comentarios de ejemplo en matroska.go y parser.go que mencionan ReadPacket (documentación obsoleta, no tocada aquí). Las constantes CompZlib/Target*/IDxxx de ebml.go también tienen cero referencias pero son un catálogo de la especificación y se dejaron a propósito.
- **Evidencia del hallazgo:** Grep -rn --include=*.go de '\bPacket\b' en internal/matroska: solo comentarios y la declaración en types.go; grep de SeekToPrevKeyFrame|UnknownStart|UnknownEnd|StreamMask|StreamShift fuera de types.go: sin resultados; KF y GAP solo en types.go. zero-ref-identifiers.txt los lista con prodRefs=0 y testRefs=0. Copia en scratchpad con el edit aplicado: gofmt -l limpio, go build ./... y go vet ./... sin errores, go test ./internal/matroska/... en verde.
- Nota de aplicación: línea real 56 (desfase -2)

#### DM-21 · Eliminar campos que se guardan pero nunca se leen: head.stdin, Client.tokenSource, Repository.fileCacher/database y segmentCount

- **Severidad:** Baja · **Tipo:** Código Muerto · **Verificación:** mecánica + revisión manual
- **Problema:** Cinco piezas de estado se asignan y jamás se consultan: head.stdin en cassette/pipeline.go, drive.Client.tokenSource, mediastream.Repository.fileCacher y Repository.database (con la opción NewRepositoryOptions.Database y su asignación en core/modules.go) y la variable segmentCount de pgs.DecodePacket. Las tres primeras aparecen como 'unused' en la semilla de linter.

**DM-21.1 — Archivo:** `internal/mediastream/cassette/pipeline.go` · **Líneas:** 83–83 · **Acción:** delete-lines

ANTES:

```go
	stdin    io.WriteCloser     // Used to gracefully quit ffmpeg via "q".
```

DESPUÉS: _(se elimina el bloque)_

**DM-21.2 — Archivo:** `internal/mediastream/cassette/pipeline.go` · **Líneas:** 802–802 · **Acción:** replace

ANTES:

```go
			cmd: cmd, stdin: stdin, gen: gen,
```

DESPUÉS:

```go
			cmd: cmd, gen: gen,
```

**DM-21.3 — Archivo:** `internal/drive/client.go` · **Líneas:** 30–34 · **Acción:** replace

ANTES:

```go
	httpClient  *http.Client
	transport   *http.Transport
	tokenSource oauth2.TokenSource
	logger      *zerolog.Logger
	apiBase     string // overridable in tests; empty means driveAPIBase
```

DESPUÉS:

```go
	httpClient *http.Client
	transport  *http.Transport
	logger     *zerolog.Logger
	apiBase    string // overridable in tests; empty means driveAPIBase
```

**DM-21.4 — Archivo:** `internal/drive/client.go` · **Líneas:** 86–89 · **Acción:** replace

ANTES:

```go
		httpClient:  httpClient,
		transport:   baseTransport,
		tokenSource: reusingTokenSource,
		logger:      logger,
```

DESPUÉS:

```go
		httpClient: httpClient,
		transport:  baseTransport,
		logger:     logger,
```

**DM-21.5 — Archivo:** `internal/mediastream/repository.go` · **Líneas:** 7–7 · **Acción:** delete-lines

ANTES:

```go
	"kamehouse/internal/database/db"
```

DESPUÉS: _(se elimina el bloque)_

**DM-21.6 — Archivo:** `internal/mediastream/repository.go` · **Líneas:** 35–35 · **Acción:** delete-lines

ANTES:

```go
		fileCacher         *filecache.Cacher
```

DESPUÉS: _(se elimina el bloque)_

**DM-21.7 — Archivo:** `internal/mediastream/repository.go` · **Líneas:** 37–40 · **Acción:** replace

ANTES:

```go
		cacheDir           string // where attachments are stored
		transcodeDir       string // where stream segments are stored
		database           *db.Database
		warmingActive      atomic.Bool // guards WarmMediaInfo against overlapping runs
```

DESPUÉS:

```go
		cacheDir           string      // where attachments are stored
		transcodeDir       string      // where stream segments are stored
		warmingActive      atomic.Bool // guards WarmMediaInfo against overlapping runs
```

**DM-21.8 — Archivo:** `internal/mediastream/repository.go` · **Líneas:** 54–54 · **Acción:** delete-lines

ANTES:

```go
		Database       *db.Database
```

DESPUÉS: _(se elimina el bloque)_

**DM-21.9 — Archivo:** `internal/mediastream/repository.go` · **Líneas:** 65–65 · **Acción:** delete-lines

ANTES:

```go
		fileCacher:         opts.FileCacher,
```

DESPUÉS: _(se elimina el bloque)_

**DM-21.10 — Archivo:** `internal/mediastream/repository.go` · **Líneas:** 67–67 · **Acción:** delete-lines

ANTES:

```go
		database:           opts.Database,
```

DESPUÉS: _(se elimina el bloque)_

**DM-21.11 — Archivo:** `internal/core/modules.go` · **Líneas:** 69–69 · **Acción:** delete-lines

ANTES:

```go
		Database:       a.Database,
```

DESPUÉS: _(se elimina el bloque)_

**DM-21.12 — Archivo:** `internal/pgs/pgs.go` · **Líneas:** 101–101 · **Acción:** delete-lines

ANTES:

```go
	segmentCount := 0
```

DESPUÉS: _(se elimina el bloque)_

**DM-21.13 — Archivo:** `internal/pgs/pgs.go` · **Líneas:** 117–117 · **Acción:** delete-lines

ANTES:

```go
		segmentCount++
```

DESPUÉS: _(se elimina el bloque)_

- **Razón técnica:** head.stdin: el cierre ordenado de ffmpeg con 'q' usa la variable local stdin pasada a readSegments y a la goroutine de cancelación (pipeline.go:808 y 813), nunca el campo; además la rama de actualización de la línea 795 ni siquiera lo rellena. Client.tokenSource: el reusingTokenSource ya vive dentro del oauth2.Transport; el campo no se consulta. Repository.fileCacher: el cacher solo se usa para crear mediaInfoExtractor con opts.FileCacher, que se conserva. Repository.database y NewRepositoryOptions.Database: sin ninguna lectura; sus únicos productores son NewRepository y modules.go (las pruebas de handlers solo pasan Logger). segmentCount se incrementa pero nunca se consulta. Al quitar database, el import de db en repository.go queda huérfano y los comentarios de la estructura se realinean como exige gofmt.
- **Impacto esperado:** Menos estado muerto y una dependencia menos en mediastream.Repository sobre el paquete de base de datos; evita que alguien confíe en un 'stdin' del head que no es el que realmente se cierra. Sin cambio de comportamiento.
- **Revisión manual (22/10):** Correcto: head.stdin, Client.tokenSource, Repository.fileCacher y Repository.database solo se asignaban; la variable local stdin sigue en uso (el pipe se crea igual que antes).
- **Riesgos / a revisar:** Ninguno funcional. El único caller externo de NewRepositoryOptions.Database es core/modules.go (incluido en los edits); las pruebas de handlers/external_subtitles_test.go solo pasan Logger. unused-strict-tests.txt (que cuenta las pruebas como uso) los marca igualmente.
- **Evidencia del hallazgo:** unused-strict-tests.txt: 'field stdin is unused' (pipeline.go:83), 'field tokenSource is unused' (drive/client.go:32), 'field fileCacher is unused' y 'field database is unused' (mediastream/repository.go:35 y :39), 'var segmentCount is unused' (pgs.go:101). Grep -n confirma que cada campo solo aparece en su declaración y en la asignación; grep de NewRepositoryOptions: solo core/modules.go y dos pruebas con Logger. Copia en scratchpad con todos los edits: gofmt -l limpio, go build ./... y go vet ./... (compila todas las pruebas) sin errores.
- Nota de aplicación: línea real 801 (desfase -1); línea real 85 (desfase -1); línea real 34 (desfase -1); línea real 35 (desfase -2); línea real 51 (desfase -3); línea real 61 (desfase -4); línea real 62 (desfase -5); línea real 116 (desfase -1)

#### DM-22 · Eliminar símbolos con cero referencias: HMACAuth.TTL, RWMutexMap.LoadAndDelete, RangeSource.SetChunk y extsubs.ErrTooLarge

- **Severidad:** Baja · **Tipo:** Código Muerto · **Verificación:** mecánica + revisión manual
- **Problema:** Cuatro símbolos de producción no tienen ningún llamador ni en código de producción ni en pruebas: el getter HMACAuth.TTL, el método RWMutexMap.LoadAndDelete, el setter RangeSource.SetChunk y el error centinela extsubs.ErrTooLarge. Al quitar ErrTooLarge el import "errors" de store.go queda huérfano y también se elimina.

**DM-22.1 — Archivo:** `internal/util/hmac_auth.go` · **Líneas:** 46–51 · **Acción:** replace

ANTES:

```go
// TTL returns the current TTL
func (h *HMACAuth) TTL() time.Duration {
	return h.ttl
}

// SetTTL sets a new TTL
```

DESPUÉS:

```go
// SetTTL sets a new TTL
```

**DM-22.2 — Archivo:** `internal/util/map.go` · **Líneas:** 31–43 · **Acción:** replace

ANTES:

```go
func (m *RWMutexMap) LoadAndDelete(key interface{}) (value interface{}, loaded bool) {
	m.mu.Lock()
	value, loaded = m.dirty[key]
	if !loaded {
		m.mu.Unlock()
		return nil, false
	}
	delete(m.dirty, key)
	m.mu.Unlock()
	return value, loaded
}

func (m *RWMutexMap) Delete(key interface{}) {
```

DESPUÉS:

```go
func (m *RWMutexMap) Delete(key interface{}) {
```

**DM-22.3 — Archivo:** `internal/drive/rangesource.go` · **Líneas:** 37–44 · **Acción:** replace

ANTES:

```go
// SetChunk cambia el máximo que se pide a Drive en una sola petición.
func (s *RangeSource) SetChunk(n int64) {
	if n > 0 {
		s.chunk = n
	}
}

// Size es el tamaño del archivo.
```

DESPUÉS:

```go
// Size es el tamaño del archivo.
```

**DM-22.4 — Archivo:** `internal/mediastream/extsubs/store.go` · **Líneas:** 7–9 · **Acción:** replace

ANTES:

```go
	"encoding/json"
	"errors"
	"fmt"
```

DESPUÉS:

```go
	"encoding/json"
	"fmt"
```

**DM-22.5 — Archivo:** `internal/mediastream/extsubs/store.go` · **Líneas:** 194–198 · **Acción:** replace

ANTES:

```go
	return []byte(string(utf16.Decode(units)))
}

// ErrTooLarge se usa al leer con tope.
var ErrTooLarge = errors.New("extsubs: subtitle file too large")
```

DESPUÉS:

```go
	return []byte(string(utf16.Decode(units)))
}
```

- **Razón técnica:** Son restos de APIs que nadie consume. HMACAuth.TTL: el campo ttl solo se lee internamente (GenerateToken) y SetTTL es el único accesor que queda. RWMutexMap.LoadAndDelete: RWMutexMap solo la usan result/resultcache.go y result/resultmap.go, y ninguno la llama (el LoadAndDelete de cassette.go es de otro tipo, un sync.Map). RangeSource.SetChunk: el tamaño de bloque se fija en NewRangeSource y nadie lo cambia. ErrTooLarge: el tope de lectura se aplica con MaxFileSize y el error nunca se devuelve ni se compara.
- **Impacto esperado:** Menos superficie pública y mantenimiento (unas 35 líneas); cero cambio de comportamiento. deadcode ya marcaba TTL y LoadAndDelete como inalcanzables (TTL también en deadcode-test.txt, es decir, incluso contando pruebas).
- **Revisión manual (22/10):** Correcto: cuatro símbolos sin referencias; build, vet y tests lo confirman en la copia aislada.
- **Riesgos / a revisar:** Ninguno funcional. Los cuatro identificadores son internos del servidor Go: no los consumen codegen, apps/web, apps/desktop ni KameHouseTV. Se aplicaron los edits sobre una copia en scratchpad y go build ./..., go vet ./... (que compila todas las pruebas) y gofmt -l salieron limpios.
- **Evidencia del hallazgo:** Grep -rn de cada nombre sobre todo el módulo (incluidos _test.go): TTL( solo aparece en su declaración; LoadAndDelete solo en map.go y en cassette.go sobre un sync.Map (deadcode.txt lo marca inalcanzable para RWMutexMap); SetChunk solo en su declaración; ErrTooLarge solo en su declaración y 'errors.' solo se usa en esa línea de store.go. go vet ./... sobre la copia editada compila las pruebas y no reporta símbolos faltantes. ThumbnailCache.Len, que la semilla también marcaba, se DESCARTÓ: go vet reveló que lo usan thumbnail_disk_test.go:40 y cache_handlers_test.go:83.
- Nota de aplicación: línea real 193 (desfase -1)

#### DM-23 · Eliminar helpers exportados que solo ejercita su propia prueba: IsBase64, Cacher.Clear y GetCuesPos

- **Severidad:** Baja · **Tipo:** Código Muerto · **Verificación:** mecánica + revisión manual
- **Problema:** util.IsBase64 (con su regexp reBase64Chars y su test), filecache.Cacher.Clear y Demuxer/MatroskaParser.GetCuesPos no tienen ningún llamador de producción; solo los invocan pruebas que existen únicamente para ellos. Se eliminan los símbolos junto con esas pruebas, y la prueba de seekhead lee el campo cuesPos directamente.

**DM-23.1 — Archivo:** `internal/util/strings.go` · **Líneas:** 3–18 · **Acción:** replace

ANTES:

```go
import (
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"path/filepath"
	"regexp"
	"runtime"
	"strings"
	"unicode"

	"github.com/dustin/go-humanize"
)

var reBase64Chars = regexp.MustCompile("^[A-Za-z0-9+/]*=*$")

func Bytes(size uint64) string {
```

DESPUÉS:

```go
import (
	"crypto/sha256"
	"encoding/hex"
	"path/filepath"
	"runtime"
	"strings"
	"unicode"

	"github.com/dustin/go-humanize"
)

func Bytes(size uint64) string {
```

**DM-23.2 — Archivo:** `internal/util/strings.go` · **Líneas:** 54–88 · **Acción:** replace

ANTES:

```go
}

func IsBase64(s string) bool {
	// 1. Check if string is empty
	if len(s) == 0 {
		return false
	}

	// 2. Check if length is valid (must be multiple of 4)
	if len(s)%4 != 0 {
		return false
	}

	// 3. Check for valid padding
	padding := strings.Count(s, "=")
	if padding > 2 {
		return false
	}

	// 4. Check if padding is at the end only
	if padding > 0 && !strings.HasSuffix(s, strings.Repeat("=", padding)) {
		return false
	}

	// 5. Check if string contains only valid base64 characters
	if !reBase64Chars.MatchString(s) {
		return false
	}

	// 6. Try to decode - this is the final verification
	_, err := base64.StdEncoding.DecodeString(s)
	return err == nil
}

func ReplaceExtension(path, newExt string) string {
```

DESPUÉS:

```go
}

func ReplaceExtension(path, newExt string) string {
```

**DM-23.3 — Archivo:** `internal/util/strings_test.go` · **Líneas:** 1–29 · **Acción:** delete-file

Eliminar el archivo completo. Primeras líneas actuales:

```go
package util

import "testing"

func TestIsBase64Encoded(t *testing.T) {

	tests := []struct {
		str      string
		isBase64 bool
	}{
```

**DM-23.4 — Archivo:** `internal/util/filecache/filecache.go` · **Líneas:** 80–111 · **Acción:** replace

ANTES:

```go
}

func (c *Cacher) Clear() error {
	c.mu.Lock()
	defer c.mu.Unlock()
	for _, store := range c.stores {
		store.timerMu.Lock()
		if store.saveTimer != nil {
			store.saveTimer.Stop()
			store.saveTimer = nil
		}
		store.dirty = false
		store.timerMu.Unlock()
	}
	c.stores = make(map[string]*CacheStore)

	entries, err := os.ReadDir(c.dir)
	if err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return err
	}
	for _, e := range entries {
		if !e.IsDir() && strings.HasSuffix(e.Name(), ".cache") {
			_ = os.Remove(filepath.Join(c.dir, e.Name()))
		}
	}
	return nil
}

// getStore returns a cache store for the given bucket name and TTL.
```

DESPUÉS:

```go
}

// getStore returns a cache store for the given bucket name and TTL.
```

**DM-23.5 — Archivo:** `internal/util/filecache/filecache_test.go` · **Líneas:** 192–205 · **Acción:** replace

ANTES:

```go
	assert.False(t, foundAfter, "general bucket should be deleted after RemoveAllBy")

	// Probar Clear(): debe limpiar todo en memoria y en disco
	err = cacher.Set(generalBucket, "item2", "new_val")
	require.NoError(t, err)
	err = cacher.Clear()
	require.NoError(t, err)

	entries, err := os.ReadDir(cacher.dir)
	require.NoError(t, err)
	for _, e := range entries {
		assert.False(t, filepath.Ext(e.Name()) == ".cache", "no .cache file should remain after Clear()")
	}
}
```

DESPUÉS:

```go
	assert.False(t, foundAfter, "general bucket should be deleted after RemoveAllBy")
}
```

**DM-23.6 — Archivo:** `internal/matroska/matroska.go` · **Líneas:** 306–313 · **Acción:** replace

ANTES:

```go
func (d *Demuxer) GetCues() []*Cue {
	return d.parser.GetCues()
}

// GetCuesPos returns the byte position of the cues element.
func (d *Demuxer) GetCuesPos() uint64 {
	return d.parser.GetCuesPos()
}
```

DESPUÉS:

```go
func (d *Demuxer) GetCues() []*Cue {
	return d.parser.GetCues()
}
```

**DM-23.7 — Archivo:** `internal/matroska/parser.go` · **Líneas:** 608–618 · **Acción:** replace

ANTES:

```go
// GetCues returns all cues
func (mp *MatroskaParser) GetCues() []*Cue {
	return mp.cues
}

// GetCuesPos returns the byte position of the cues element.
func (mp *MatroskaParser) GetCuesPos() uint64 {
	return mp.cuesPos
}

func (mp *MatroskaParser) parseSeekHead(size uint64) error {
```

DESPUÉS:

```go
// GetCues returns all cues
func (mp *MatroskaParser) GetCues() []*Cue {
	return mp.cues
}

func (mp *MatroskaParser) parseSeekHead(size uint64) error {
```

**DM-23.8 — Archivo:** `internal/matroska/seekhead_buffer_test.go` · **Líneas:** 85–85 · **Acción:** replace

ANTES:

```go
		if got := d.GetCuesPos(); got < uint64(cuesOffset) || got > uint64(cuesOffset)+8 {
```

DESPUÉS:

```go
		if got := d.parser.cuesPos; got < uint64(cuesOffset) || got > uint64(cuesOffset)+8 {
```

- **Razón técnica:** IsBase64 no la llama nadie en producción (grep: solo strings.go y strings_test.go); su única razón de ser es TestIsBase64Encoded, que se borra entero (el archivo contiene solo ese test). Cacher.Clear solo la invoca un bloque de TestCacher... en filecache_test.go (líneas 194-204); el resto de la limpieza de disco la cubren RemoveAllBy y ClearMediastreamVideoFiles. GetCuesPos (en Demuxer y en MatroskaParser) solo la usa seekhead_buffer_test.go:85; la prueba pasa a leer el campo cuesPos del mismo paquete, que es lo que realmente quiere verificar. Quitar IsBase64 deja sin uso los imports encoding/base64 y regexp y la variable reBase64Chars.
- **Impacto esperado:** Unas 110 líneas menos entre código y pruebas; desaparece un método con mutex que borra archivos de disco y no se usa en producción. Comportamiento observable idéntico.
- **Revisión manual (22/10):** Correcto: se borran los símbolos junto con las pruebas que existían solo para ellos (strings_test.go entero contiene únicamente TestIsBase64Encoded). Si se quiere conservar Cacher.Clear como utilidad de administración, omitir solo las ediciones de filecache.
- **Riesgos / a revisar:** Se pierde la cobertura de IsBase64 y del tramo Clear() de esa prueba, pero ya no hay código que cubrir. Si alguien quiere conservar Clear como utilidad de administración, descartar solo el segundo y cuarto edit. deadcode.txt confirma IsBase64, Cacher.Clear y los dos GetCuesPos como inalcanzables desde main.
- **Evidencia del hallazgo:** deadcode.txt: 'unreachable func' para util/strings.go IsBase64, util/filecache/filecache.go Cacher.Clear, matroska.go Demuxer.GetCuesPos y parser.go MatroskaParser.GetCuesPos. Grep -rn --include=*.go sobre el módulo: IsBase64 solo en strings.go y strings_test.go; GetCuesPos solo en sus declaraciones y seekhead_buffer_test.go:85; Clear() solo en filecache_test.go:197. Verificado sobre copia en scratchpad: gofmt -l limpio, go build ./... y go vet ./... sin errores, go test de ./internal/util/..., ./internal/matroska/... y ./internal/mediastream/extsubs/... en verde.
- Nota de aplicación: línea real 50 (desfase -4)

### Fase 2: Optimizaciones de memoria, consultas y locks

#### OP-01 · AniList GetMediaByID: N peticiones simultaneas del mismo ID repiten el POST N veces (sin singleflight)

- **Severidad:** Alta · **Tipo:** Optimización · **Verificación:** mecánica + revisión manual
- **Problema:** Client.GetMediaByID solo mira la cache sync.Map antes de consultar; mientras el primer fetch no termina, cada peticion concurrente por el mismo ID pasa el chequeo de cache, consume un token del limitador y repite el mismo POST GraphQL (con characters, relations y streamingEpisodes). La Cronologia pide /anilist/episode/:id/:abs por cada tile, todos del mismo media.

**OP-01.1 — Archivo:** `internal/api/anilist/client.go` · **Líneas:** 3–25 · **Acción:** replace

ANTES:

```go
import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"time"

	"github.com/rs/zerolog"
	"golang.org/x/time/rate"
	httputil "kamehouse/internal/util/http"
)

const graphQLEndpoint = "https://graphql.anilist.co"

// Client handles AniList public GraphQL queries.
type Client struct {
	httpClient *http.Client
	limiter    *rate.Limiter
	cache      sync.Map
}
```

DESPUÉS:

```go
import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"time"

	"github.com/rs/zerolog"
	"golang.org/x/sync/singleflight"
	"golang.org/x/time/rate"
	httputil "kamehouse/internal/util/http"
)

const graphQLEndpoint = "https://graphql.anilist.co"

// anilistFetchTimeout acota la consulta compartida de GetMediaByID (espera del limitador incluida).
const anilistFetchTimeout = 30 * time.Second

// Client handles AniList public GraphQL queries.
type Client struct {
	httpClient *http.Client
	limiter    *rate.Limiter
	cache      sync.Map
	// flights colapsa las consultas simultaneas por el mismo ID de media.
	flights singleflight.Group
}
```

**OP-01.2 — Archivo:** `internal/api/anilist/client.go` · **Líneas:** 239–248 · **Acción:** replace

ANTES:

```go
// GetMediaByID fetches complete anime metadata by AniList ID.
func (c *Client) GetMediaByID(ctx context.Context, id int) (*AniListMedia, error) {
	cacheKey := fmt.Sprintf("id:%d", id)
	if cached, ok := c.cache.Load(cacheKey); ok {
		return cached.(*AniListMedia), nil
	}

	if err := c.limiter.Wait(ctx); err != nil {
		return nil, err
	}
```

DESPUÉS:

```go
// GetMediaByID fetches complete anime metadata by AniList ID.
//
// Las llamadas simultaneas por el mismo ID comparten una sola consulta: la Cronologia pide
// la miniatura de cientos de episodios a la vez (todas del mismo media) y, sin esto, cada una
// gastaba un token del limitador y repetia el mismo POST mientras la cache seguia vacia.
func (c *Client) GetMediaByID(ctx context.Context, id int) (*AniListMedia, error) {
	cacheKey := fmt.Sprintf("id:%d", id)
	if cached, ok := c.cache.Load(cacheKey); ok {
		return cached.(*AniListMedia), nil
	}

	flight := c.flights.DoChan(cacheKey, func() (interface{}, error) {
		// Otro vuelo pudo llenar la cache entre el Load de arriba y este punto.
		if cached, ok := c.cache.Load(cacheKey); ok {
			return cached.(*AniListMedia), nil
		}
		// Desacoplado del request: lo comparten todos los que esperan, y que el primero
		// se vaya (tile fuera de vista, pestana cerrada) no debe cancelarles la consulta.
		fetchCtx, cancel := context.WithTimeout(context.WithoutCancel(ctx), anilistFetchTimeout)
		defer cancel()
		return c.fetchMediaByID(fetchCtx, id, cacheKey)
	})

	select {
	case res := <-flight:
		if res.Err != nil {
			return nil, res.Err
		}
		return res.Val.(*AniListMedia), nil
	case <-ctx.Done():
		return nil, ctx.Err()
	}
}

// fetchMediaByID hace la consulta real a AniList (limitador incluido) y la deja en la cache.
func (c *Client) fetchMediaByID(ctx context.Context, id int, cacheKey string) (*AniListMedia, error) {
	if err := c.limiter.Wait(ctx); err != nil {
		return nil, err
	}
```

- **Razón técnica:** singleflight.Group con clave estable id:<anilistId> (la misma que la cache). Se usa DoChan y un contexto desacoplado (context.WithoutCancel + timeout de 30 s) para que la cancelacion del primer llamador no mate la consulta de los seguidores; cada llamador sigue pudiendo abandonar su espera con su propio ctx. Se re-chequea la cache dentro del vuelo. El resto del cuerpo original (marshal, POST, decode, c.cache.Store) queda intacto dentro de fetchMediaByID, que usa cacheKey recibido por parametro.
- **Impacto esperado:** Una pagina de Cronologia con 100-300 tiles frios pasa de N POST identicos (cada uno esperando un token del limitador de 90 req/min, con el ultimo tile tardando minutos) a 1 POST. Elimina la cola artificial en limiter.Wait que retrasaba tambien las busquedas/metadata de otros IDs y el riesgo de 429.
- **Revisión manual (22/10):** Correcto. DoChan con contexto desacoplado (WithoutCancel + 30 s): el vuelo termina siempre, cada llamador conserva su propio ctx para abandonar la espera, la clave coincide con la de la caché y el tipo devuelto es coherente (*AniListMedia, incluso nil tipado). Sin objeciones.
- **Riesgos / a revisar:** Si todos los esperadores se van, la consulta termina igual (maximo 30 s) y llena la cache: efecto deseado. GetMediaByID pasa a devolver ctx.Err() del llamador si este cancela, igual que antes. Callers (handlers/anilist.go, metadata_provider/anilist_impl.go, library/metadata/anilist_provider.go) no cambian. El puntero *AniListMedia ya se compartia via sync.Map, no hay mutacion nueva. go vet: Client no se copia por valor (se crea con NewClient y puntero). Su ANTES ya refleja DM-09 (campo logger eliminado de Client): ejecutar después de DM-09.
- **Evidencia del hallazgo:** Grep singleflight en apps/server: no aparece en internal/api/anilist. Read client.go:240-291: GetMediaByID solo hace c.cache.Load y luego limiter.Wait + POST sin ninguna deduplicacion; la cache se escribe recien al final (c.cache.Store). Read handlers/anilist.go:37-60: HandleAniListEpisodeThumbnail llama GetEpisodeThumbnail -> GetMediaByID por cada tile, con un cliente compartido (el comentario del archivo reconoce los 429 de la Cronologia, pero el cliente compartido solo evita recrear la cache, no deduplica concurrentes). Limitador rate.Every(minute/90), burst 10, httpClient NewFastClient (timeout 10 s).
- Nota de aplicación: línea real 243 (desfase 4)

#### OP-02 · FuzzyMatchScore duplica todo el cálculo cuando no hay acrónimos y re-limpia las cadenas varias veces

- **Severidad:** Alta · **Tipo:** Optimización · **Verificación:** mecánica + revisión manual
- **Problema:** FuzzyMatchScore calcula TokenSetRatio, JaroWinkler y Levenshtein dos veces (sobre la cadena normalizada y sobre la expandida) aunque expandAcronyms devuelva la misma cadena (caso habitual). Además TokenSetRatio vuelve a llamar cleanFuzzyString sobre cadenas ya limpias (4 limpiezas extra por llamada) y LevenshteinRatio convierte a []rune solo para medir el largo y luego LevenshteinDistance las convierte otra vez.

**OP-02.1 — Archivo:** `internal/library/scanner/fuzzy_matcher.go` · **Líneas:** 3–8 · **Acción:** replace

ANTES:

```go
import (
	"math"
	"sort"
	"strings"
	"unicode"
)
```

DESPUÉS:

```go
import (
	"math"
	"sort"
	"strings"
	"unicode"
	"unicode/utf8"
)
```

**OP-02.2 — Archivo:** `internal/library/scanner/fuzzy_matcher.go` · **Líneas:** 57–57 · **Acción:** replace

ANTES:

```go
	len1, len2 := len([]rune(s1)), len([]rune(s2))
```

DESPUÉS:

```go
	len1, len2 := utf8.RuneCountInString(s1), utf8.RuneCountInString(s2)
```

**OP-02.3 — Archivo:** `internal/library/scanner/fuzzy_matcher.go` · **Líneas:** 143–146 · **Acción:** replace

ANTES:

```go
func TokenSetRatio(s1, s2 string) float64 {
	tokens1 := extractUniqueTokens(s1)
	tokens2 := extractUniqueTokens(s2)
```

DESPUÉS:

```go
func TokenSetRatio(s1, s2 string) float64 {
	return tokenSetRatioTokens(extractUniqueTokens(s1), extractUniqueTokens(s2))
}

// tokenSetRatioClean es TokenSetRatio para cadenas que ya salieron de cleanFuzzyString:
// salta la re-limpieza (idempotente) que repetía el mismo trabajo en cada llamada.
func tokenSetRatioClean(c1, c2 string) float64 {
	return tokenSetRatioTokens(uniqueSortedTokens(c1), uniqueSortedTokens(c2))
}

func tokenSetRatioTokens(tokens1, tokens2 []string) float64 {
```

**OP-02.4 — Archivo:** `internal/library/scanner/fuzzy_matcher.go` · **Líneas:** 216–222 · **Acción:** replace

ANTES:

```go
	// Expand standard acronyms (e.g. DBS -> Dragon Ball Super, DBZ -> Dragon Ball Z, DB -> Dragon Ball)
	qExpanded := expandAcronyms(qNorm)
	tExpanded := expandAcronyms(tNorm)

	tokenRatio := math.Max(TokenSetRatio(qNorm, tNorm), TokenSetRatio(qExpanded, tExpanded))
	jwSimilarity := math.Max(JaroWinklerSimilarity(qNorm, tNorm), JaroWinklerSimilarity(qExpanded, tExpanded))
	levRatio := math.Max(LevenshteinRatio(qNorm, tNorm), LevenshteinRatio(qExpanded, tExpanded))
```

DESPUÉS:

```go
	tokenRatio := tokenSetRatioClean(qNorm, tNorm)
	jwSimilarity := JaroWinklerSimilarity(qNorm, tNorm)
	levRatio := LevenshteinRatio(qNorm, tNorm)

	// Expand standard acronyms (e.g. DBS -> Dragon Ball Super, DBZ -> Dragon Ball Z, DB -> Dragon Ball).
	// Si ninguna cadena tiene acrónimos la versión expandida es idéntica y repetir las tres
	// métricas daría el mismo máximo, así que solo se recalcula cuando algo cambió.
	if qExpanded, tExpanded := expandAcronyms(qNorm), expandAcronyms(tNorm); qExpanded != qNorm || tExpanded != tNorm {
		tokenRatio = math.Max(tokenRatio, tokenSetRatioClean(qExpanded, tExpanded))
		jwSimilarity = math.Max(jwSimilarity, JaroWinklerSimilarity(qExpanded, tExpanded))
		levRatio = math.Max(levRatio, LevenshteinRatio(qExpanded, tExpanded))
	}
```

**OP-02.5 — Archivo:** `internal/library/scanner/fuzzy_matcher.go` · **Líneas:** 264–276 · **Acción:** replace

ANTES:

```go
func extractUniqueTokens(s string) []string {
	words := strings.Fields(cleanFuzzyString(s))
	seen := make(map[string]bool)
	var unique []string
	for _, w := range words {
		if !seen[w] && len(w) > 0 {
			seen[w] = true
			unique = append(unique, w)
		}
	}
	sort.Strings(unique)
	return unique
}
```

DESPUÉS:

```go
func extractUniqueTokens(s string) []string {
	return uniqueSortedTokens(cleanFuzzyString(s))
}

// uniqueSortedTokens parte una cadena ya limpia en palabras únicas ordenadas. Los títulos tienen
// pocas palabras, así que se deduplica in situ con búsqueda lineal en vez de crear un mapa.
func uniqueSortedTokens(clean string) []string {
	words := strings.Fields(clean)
	unique := words[:0]
	for _, w := range words {
		dup := false
		for _, u := range unique {
			if u == w {
				dup = true
				break
			}
		}
		if !dup {
			unique = append(unique, w)
		}
	}
	sort.Strings(unique)
	return unique
}
```

- **Razón técnica:** Con qExpanded == qNorm y tExpanded == tNorm (sin dbs/dbz/dbgt/db/sp, el caso normal) math.Max(f(a), f(a)) == f(a): la segunda pasada es trabajo puro desperdiciado y es la mayor parte del costo (tokenCoverageScore hace |S|x|T| JaroWinkler por dirección). cleanFuzzyString es idempotente (su salida son solo letras/dígitos en minúscula separados por un espacio), por lo que re-limpiar en TokenSetRatio no cambia el resultado y se evita con tokenSetRatioClean. La deduplicación in situ sobre el slice de Fields preserva el orden y el resultado ordenado y evita el map. LevenshteinRatio contaba runas convirtiendo a []rune; utf8.RuneCountInString da el mismo número sin asignar. La API pública (TokenSetRatio, extractUniqueTokens, expandAcronyms) conserva su contrato.
- **Impacto esperado:** FuzzyMatchScore se llama 2 veces por cada título de cada media por cada archivo no resuelto en el Paso 4 de curación (matcher.go:190-192). Para un par de ~4 palabras sin acrónimos se pasa de unas 350 asignaciones por llamada a unas 40-60 (sumando con los hallazgos de JaroWinkler y cleanFuzzyString, menos de 15) y se elimina ~50% del cómputo de JaroWinkler/Levenshtein/tokens. El resultado numérico es idéntico.
- **Revisión manual (22/10):** Equivalente al original. cleanFuzzyString es idempotente (filtra a letras, dígitos y espacios y recompone con Fields) y expandAcronyms solo emite tokens en minúscula separados por un espacio, así que saltar la re-limpieza no cambia ningún resultado; el máximo con la versión expandida solo se omite cuando es idéntica. utf8.RuneCountInString equivale a len([]rune(s)), también con bytes inválidos.
- **Riesgos / a revisar:** Depende de que cleanFuzzyString sea idempotente (lo es: su salida ya está en minúscula, sin acentos y con espacios simples). Los tests existentes (fuzzy_matcher_test.go) usan umbrales mínimos y siguen válidos. Si otro hallazgo reescribe cleanFuzzyString, debe mantener esa propiedad.
- **Evidencia del hallazgo:** Read completo de fuzzy_matcher.go: FuzzyMatchScore L202-227 llama TokenSetRatio/JaroWinkler/LevenshteinRatio dos veces; TokenSetRatio L143-159 llama extractUniqueTokens que llama cleanFuzzyString (L265); LevenshteinRatio L57 hace len([]rune()) y luego LevenshteinDistance repite la conversión. Grep de llamadores en internal/ (sin tests): FuzzyMatchScore solo se usa en matcher.go:190 y :192 dentro de for media × for GetAllTitles(media). Grep en fuzzy_matcher_test.go: los tests solo comparan con mínimos. No se ejecutaron benchmarks (solo lectura).
- Nota de aplicación: línea real 58 (desfase 1); línea real 144 (desfase 1); línea real 224 (desfase 8); línea real 277 (desfase 13)

#### OP-03 · calculateBayesianScore recalcula ResolveDragonBallID, extractYear y ToLower(pm.Title) por cada media

- **Severidad:** Alta · **Tipo:** Optimización · **Verificación:** mecánica + revisión manual
- **Problema:** En BayesianResolve cada archivo se evalúa contra TODOS los media del catálogo y, en cada llamada a calculateBayesianScore, se vuelve a ejecutar ResolveDragonBallID(pm.Title) (ToLower, normalización, varias regexp con ReplaceAllString/FindStringSubmatch), extractUniqueYear (regexp) y strings.ToLower(pm.Title) una vez por cada título candidato. Las tres cosas dependen solo del título del archivo, no del media.

**OP-03.1 — Archivo:** `internal/library/scanner/matcher.go` · **Líneas:** 96–98 · **Acción:** replace

ANTES:

```go
	if m.MediaContainer != nil {
		for _, media := range m.MediaContainer.NormalizedMedia {
			confidence, matchedTitle := m.calculateBayesianScore(pm, media)
```

DESPUÉS:

```go
	if m.MediaContainer != nil {
		pre := newBayesPre(pm.Title)
		for _, media := range m.MediaContainer.NormalizedMedia {
			confidence, matchedTitle := m.calculateBayesianScore(pm, pre, media)
```

**OP-03.2 — Archivo:** `internal/library/scanner/matcher.go` · **Líneas:** 146–148 · **Acción:** replace

ANTES:

```go
			if m.MediaContainer != nil {
				for _, media := range m.MediaContainer.NormalizedMedia {
					conf, _ := m.calculateBayesianScore(pm, media)
```

DESPUÉS:

```go
			if m.MediaContainer != nil {
				healedPre := newBayesPre(pm.Title)
				for _, media := range m.MediaContainer.NormalizedMedia {
					conf, _ := m.calculateBayesianScore(pm, healedPre, media)
```

**OP-03.3 — Archivo:** `internal/library/scanner/matcher.go` · **Líneas:** 164–168 · **Acción:** replace

ANTES:

```go
				folderPM := pm
				folderPM.Title = folderTitle

				for _, media := range m.MediaContainer.NormalizedMedia {
					conf, _ := m.calculateBayesianScore(folderPM, media)
```

DESPUÉS:

```go
				folderPM := pm
				folderPM.Title = folderTitle
				folderPre := newBayesPre(folderTitle)

				for _, media := range m.MediaContainer.NormalizedMedia {
					conf, _ := m.calculateBayesianScore(folderPM, folderPre, media)
```

**OP-03.4 — Archivo:** `internal/library/scanner/matcher.go` · **Líneas:** 231–232 · **Acción:** replace

ANTES:

```go
// calculateBayesianScore implements a naive Bayes estimation for identity correlation.
func (m *Matcher) calculateBayesianScore(pm parser.ParsedMedia, media *dto.NormalizedMedia) (float64, string) {
```

DESPUÉS:

```go
// bayesPre agrupa lo que calculateBayesianScore deriva solo del título parseado (no del media).
// Se calcula una vez por archivo y no una vez por archivo × media: ResolveDragonBallID corre
// varias regexp y asigna decenas de cadenas, y su resultado no depende del media evaluado.
type bayesPre struct {
	lowerTitle string
	year       int
	dbID       int
	isDb       bool
}

func newBayesPre(title string) bayesPre {
	dbID, _, isDb := ResolveDragonBallID(title)
	return bayesPre{
		lowerTitle: strings.ToLower(title),
		year:       extractYear(title),
		dbID:       dbID,
		isDb:       isDb,
	}
}

// calculateBayesianScore implements a naive Bayes estimation for identity correlation.
func (m *Matcher) calculateBayesianScore(pm parser.ParsedMedia, pre bayesPre, media *dto.NormalizedMedia) (float64, string) {
```

**OP-03.5 — Archivo:** `internal/library/scanner/matcher.go` · **Líneas:** 270–271 · **Acción:** replace

ANTES:

```go
		lTitle := strings.ToLower(title)
		lQuery := strings.ToLower(pm.Title)
```

DESPUÉS:

```go
		lTitle := strings.ToLower(title)
		lQuery := pre.lowerTitle
```

**OP-03.6 — Archivo:** `internal/library/scanner/matcher.go` · **Líneas:** 294–294 · **Acción:** replace

ANTES:

```go
	if dbId, _, isDb := ResolveDragonBallID(pm.Title); isDb {
```

DESPUÉS:

```go
	if dbId, isDb := pre.dbID, pre.isDb; isDb {
```

**OP-03.7 — Archivo:** `internal/library/scanner/matcher.go` · **Líneas:** 327–327 · **Acción:** replace

ANTES:

```go
	fileYear := extractYear(pm.Title)
```

DESPUÉS:

```go
	fileYear := pre.year
```

- **Razón técnica:** calculateBayesianScore es el bucle más caliente del matcher (archivos × media, y se repite en los pasos de auto-curación). ResolveDragonBallID(title) es una función pura del título (verificado: sin estado global ni mutación), igual que extractYear(title) y strings.ToLower(title). Mover esos tres cálculos a una estructura por archivo (bayesPre) da el mismo resultado exacto con M veces menos trabajo (M = media del catálogo). Además se saca strings.ToLower(pm.Title), que estaba dentro del bucle de títulos candidatos y asignaba una cadena nueva por título. calculateBayesianScore solo tiene 3 llamadores (todos en matcher.go) y ningún test lo invoca, así que el cambio de firma no rompe nada.
- **Impacto esperado:** Para F archivos sin match directo y M media: se eliminan F×M ejecuciones de ResolveDragonBallID (estimado 15-30 asignaciones y varias pasadas de regexp cada una), F×M ejecuciones de extractYear (1-2 asignaciones) y F×M×T ToLower del query (T = títulos candidatos, ~6). Con 2000 archivos y 300 media son del orden de 10-30 millones de asignaciones menos por escaneo y varios segundos de CPU. Comportamiento observable idéntico.
- **Revisión manual (22/10):** Correcto. Los tres sitios de llamada construyen bayesPre con el mismo título que pasan en pm (el original, el saneado por SanitizeSubGroupTags y folderTitle); extractYear solo usa una regexp y en ResolveDragonBallID no se ve estado compartido, así que precalcularlos por archivo da el mismo resultado.
- **Riesgos / a revisar:** Los tres sitios de llamada deben construir su bayesPre desde el mismo título que pasan en pm (main: pm.Title; curación: pm.Title ya saneado; carpeta: folderTitle). El paso 2 reasigna pm.Title antes de construir healedPre, así que usa el título saneado. No hay otros llamadores (Grep calculateBayesianScore en apps/server: solo matcher.go:98,148,168).
- **Evidencia del hallazgo:** Read de matcher.go 1-345: BayesianResolve recorre m.MediaContainer.NormalizedMedia llamando calculateBayesianScore(pm, media) (L98, L148, L168); dentro, L270-271 hace ToLower(pm.Title) por título, L294 llama ResolveDragonBallID(pm.Title) y L327 extractYear(pm.Title). Read de dragonball_resolver.go:146-174 muestra ToLower + normalizeDragonBallTitle + epRegex.MatchString + 2x ReplaceAllString + FindStringSubmatch por llamada. Grep de estado global/mutex/Store en dragonball_resolver.go: sin coincidencias relevantes (función pura). Grep calculateBayesianScore( en apps/server: solo 3 llamadas + la definición, ningún _test. No se ejecutaron benchmarks (solo lectura); las cifras son estimaciones por lectura de código.
- Nota de aplicación: línea real 147 (desfase 1); línea real 166 (desfase 2); línea real 234 (desfase 3); línea real 293 (desfase 23); línea real 317 (desfase 23); línea real 350 (desfase 23)

#### OP-04 · Indices duplicados o sin ninguna consulta que los use

- **Severidad:** Media · **Tipo:** Optimización · **Verificación:** mecánica + revisión manual
- **Problema:** migrateSchema y los tags de GORM crean 7 indices que duplican a otro existente o que ninguna consulta usa (incluido file_hash en local_file, la tabla mas grande); cada INSERT/UPSERT paga su mantenimiento y AutoMigrate nunca los elimina de las bases ya creadas.

**OP-04.1 — Archivo:** `internal/database/db/db_migrations.go` · **Líneas:** 155–166 · **Acción:** replace

ANTES:

```go
	if err := db.Exec("CREATE INDEX IF NOT EXISTS idx_local_file_lib_media ON local_file (library_media_id)").Error; err != nil {
		logger.Error().Err(err).Msg("db: failed to create index idx_local_file_lib_media")
	}
	if err := db.Exec("CREATE INDEX IF NOT EXISTS idx_metadata_cache_provider_key ON metadata_caches (provider, key)").Error; err != nil {
		logger.Error().Err(err).Msg("db: failed to create index idx_metadata_cache_provider_key")
	}
	if err := db.Exec("CREATE INDEX IF NOT EXISTS idx_media_entry_list_status ON media_entry_list_data (status)").Error; err != nil {
		logger.Error().Err(err).Msg("db: failed to create index idx_media_entry_list_status")
	}
	if err := db.Exec("CREATE INDEX IF NOT EXISTS idx_media_filler_media_id ON media_fillers (media_id)").Error; err != nil {
		logger.Error().Err(err).Msg("db: failed to create index idx_media_filler_media_id")
	}
```

DESPUÉS:

```go
	// Índices redundantes o sin consumidor. AutoMigrate nunca borra índices, así que las
	// bases existentes los conservan hasta que se eliminan aquí (DROP IF EXISTS es idempotente):
	//   - idx_local_file_lib_media duplica idx_local_file_library_media_id (tag de LocalFile).
	//   - idx_metadata_cache_provider_key duplica el único idx_provider_key (provider, key).
	//   - idx_media_filler_media_id es prefijo de idx_media_filler (media_id, provider).
	//   - El resto no lo usa ninguna consulta (status de media_entry_list_data, file_hash de
	//     local_file, suggested_swimlane de library_media y saga de library_episodes).
	for _, idx := range []string{
		"idx_local_file_lib_media",
		"idx_metadata_cache_provider_key",
		"idx_media_filler_media_id",
		"idx_media_entry_list_status",
		"idx_local_file_file_hash",
		"idx_library_media_suggested_swimlane",
		"idx_episode_saga",
	} {
		if err := db.Exec("DROP INDEX IF EXISTS " + idx).Error; err != nil {
			logger.Warn().Err(err).Str("index", idx).Msg("db: failed to drop obsolete index")
		}
	}
```

**OP-04.2 — Archivo:** `internal/database/models/local_file.go` · **Líneas:** 13–13 · **Acción:** replace

ANTES:

```go
	FileHash       string `gorm:"column:file_hash;index" json:"fileHash"`
```

DESPUÉS:

```go
	FileHash       string `gorm:"column:file_hash" json:"fileHash"`
```

**OP-04.3 — Archivo:** `internal/database/models/library.go` · **Líneas:** 47–49 · **Acción:** replace

ANTES:

```go
	DominantVibe      string          `gorm:"column:dominant_vibe" json:"dominantVibe"`
	SuggestedSwimlane string          `gorm:"column:suggested_swimlane;index" json:"suggestedSwimlane"`
	TotalEpisodes     int             `gorm:"column:total_episodes" json:"totalEpisodes"`
```

DESPUÉS:

```go
	DominantVibe      string          `gorm:"column:dominant_vibe" json:"dominantVibe"`
	SuggestedSwimlane string          `gorm:"column:suggested_swimlane" json:"suggestedSwimlane"`
	TotalEpisodes     int             `gorm:"column:total_episodes" json:"totalEpisodes"`
```

**OP-04.4 — Archivo:** `internal/database/models/library.go` · **Líneas:** 126–127 · **Acción:** replace

ANTES:

```go
	SagaName string `gorm:"column:saga_name;index:idx_episode_saga" json:"sagaName"`
	SagaId   string `gorm:"column:saga_id;index:idx_episode_saga" json:"sagaId"`
```

DESPUÉS:

```go
	SagaName string `gorm:"column:saga_name" json:"sagaName"`
	SagaId   string `gorm:"column:saga_id" json:"sagaId"`
```

- **Razón técnica:** Duplicados exactos: (1) metadata_caches ya tiene el unico idx_provider_key (provider, key) por los tags de MetadataCache, y el CREATE INDEX manual idx_metadata_cache_provider_key cubre exactamente las mismas columnas; la tabla es de escritura intensa (UpsertMetadataCache). (2) media_fillers tiene idx_media_filler (media_id, provider) por tags, y idx_media_filler_media_id (media_id) es un prefijo estricto. (3) local_file ya tiene el index de GORM sobre library_media_id (idx_local_file_library_media_id) y idx_local_file_lib_media lo repite. Sin consumidor: ninguna consulta filtra media_entry_list_data por status (solo library_media_id), ni local_file por file_hash (solo se copia entre structs y aparece en listas de columnas de upsert), ni library_media por suggested_swimlane (swimlanes.go:145 filtra library_episodes, que conserva su indice), ni library_episodes por saga_name/saga_id (chronology_frames.go:176 solo la selecciona, filtra por library_media_id y absolute_number). Los tags del modelo se quitan junto con el DROP para que AutoMigrate no los recree en cada arranque.
- **Impacto esperado:** Menos B-trees que mantener en cada escritura de las tablas mas calientes (local_file en cada escaneo e indexado de Drive, metadata_caches en cada cache de proveedor, media_fillers), menos tamaño de archivo SQLite y de WAL, y arranques de AutoMigrate que dejan de crear indices inutiles. Sin cambio funcional: las consultas siguen usando los indices que si quedan.
- **Revisión manual (22/10):** Verificado: no hay consultas por file_hash ni filtros por status de media_entry_list_data; suggested_swimlane y saga solo se leen como columnas (el WHERE de swimlanes.go:145 es sobre library_episodes, no sobre library_media). Los índices que se conservan existen: idx_local_file_library_media_id (tag index de LocalFile, nombre por defecto de GORM), idx_provider_key e idx_media_filler.
- **Riesgos / a revisar:** 1) El estado final correcto requiere aplicar juntos el DROP y los cambios de tags; si solo se aplica el DROP, GORM recrea los tres indices de tags en cada arranque y se vuelven a borrar (churn, no rotura). 2) Si algun nombre autogenerado de GORM difiriera del supuesto, DROP INDEX IF EXISTS no hace nada y el indice huerfano queda inofensivo. 3) Antes de borrar idx_local_file_lib_media y similares se apoya en que AutoMigrate (que corre antes en migrateSchema) ya creo idx_local_file_library_media_id, idx_provider_key e idx_media_filler; es el orden actual del codigo. 4) No se tocaron idx_local_file_media_locked ni idx_library_media_type_format: su falta de uso no esta demostrada (swimlanes.go:309,343 filtra format sin type; SQLite no usa un indice compuesto sin su prefijo). 5) Es optimizacion de esquema, no de logica; no requiere regenerar codegen (los tags gorm no afectan al JSON).
- **Evidencia del hallazgo:** Lectura de db_migrations.go:142-172 y de los tags de models.go (MetadataCache idx_provider_key, MediaFiller idx_media_filler), local_file.go y library.go. Grep -rnE 'file_hash' en .go: solo listas de columnas de upsert (local_file_relational.go:19, indexer.go:427) y el tag; Grep 'Where.*provider' en database: metadata_cache.go:15 (provider+key, cubierto por idx_provider_key) y :64; consultas de media_entry_list_data: library_media.go:67, chronology.go:72, collection_hydrate.go:77 (Find completo), todas por library_media_id; grep de saga_id/saga_name con Where/Raw/Order/Group: solo chronology_frames.go:176 (Select). Nombres de indices autogenerados por GORM: idx_<tabla>_<columna> (tablas local_file y library_media confirmadas por los CREATE INDEX manuales del mismo archivo).
- Nota de aplicación: línea real 156 (desfase 1)

#### OP-05 · BlockCache de Drive hace E/S de disco (Walk de todo el cache y os.Remove) con c.mu tomado

- **Severidad:** Media · **Tipo:** Optimización · **Verificación:** mecánica + revisión manual
- **Problema:** setFileMeta y Clear ejecutan dirSize (filepath.Walk de hasta ~1300 bloques) con c.mu tomado, y evict borra bloques de 16 MB uno por uno con c.mu tomado. fileMeta, download, hasBlock-path e inflightCount toman ese mismo mutex en cada pedido de rango de reproduccion, asi que mientras dura la E/S se congela todo el streaming desde Drive. Ademas varias descargas pasadas del tope lanzan evict en paralelo.

**OP-05.1 — Archivo:** `internal/drive/blockcache.go` · **Líneas:** 16–17 · **Acción:** replace

ANTES:

```go
	"sync"
	"time"
```

DESPUÉS:

```go
	"sync"
	"sync/atomic"
	"time"
```

**OP-05.2 — Archivo:** `internal/drive/blockcache.go` · **Líneas:** 40–40 · **Acción:** replace

ANTES:

```go
	used     int64
```

DESPUÉS:

```go
	used     int64
	evicting atomic.Bool
```

**OP-05.3 — Archivo:** `internal/drive/blockcache.go` · **Líneas:** 100–103 · **Acción:** replace

ANTES:

```go
	c.mu.Lock()
	c.meta = make(map[string]blockFileMeta)
	c.used, _ = dirSize(c.dir)
	c.mu.Unlock()
```

DESPUÉS:

```go
	used, _ := dirSize(c.dir)
	c.mu.Lock()
	c.meta = make(map[string]blockFileMeta)
	c.used = used
	c.mu.Unlock()
```

**OP-05.4 — Archivo:** `internal/drive/blockcache.go` · **Líneas:** 294–297 · **Acción:** replace

ANTES:

```go
		_ = os.RemoveAll(c.fileDir(fileID))
		c.mu.Lock()
		c.used, _ = dirSize(c.dir)
		c.mu.Unlock()
```

DESPUÉS:

```go
		_ = os.RemoveAll(c.fileDir(fileID))
		used, _ := dirSize(c.dir)
		c.mu.Lock()
		c.used = used
		c.mu.Unlock()
```

**OP-05.5 — Archivo:** `internal/drive/blockcache.go` · **Líneas:** 341–341 · **Acción:** replace

ANTES:

```go
func (c *BlockCache) evict() {
```

DESPUÉS:

```go
func (c *BlockCache) evict() {
	// Una sola pasada a la vez: varias descargas que terminan pasadas del tope recorrian el
	// directorio y borraban los mismos bloques en paralelo.
	if !c.evicting.CompareAndSwap(false, true) {
		return
	}
	defer c.evicting.Store(false)
```

**OP-05.6 — Archivo:** `internal/drive/blockcache.go` · **Líneas:** 355–365 · **Acción:** replace

ANTES:

```go
	c.mu.Lock()
	defer c.mu.Unlock()
	target := c.maxBytes / 10 * 9
	for _, b := range blocks {
		if c.used <= target {
			break
		}
		if os.Remove(b.path) == nil {
			c.used -= b.size
		}
	}
```

DESPUÉS:

```go
	c.mu.Lock()
	excess := c.used - c.maxBytes/10*9
	c.mu.Unlock()

	// Borrar bloques es E/S de disco: se hace sin c.mu, que toman fileMeta y download en cada
	// pedido de rango de un reproductor.
	var freed int64
	for _, b := range blocks {
		if freed >= excess {
			break
		}
		if os.Remove(b.path) == nil {
			freed += b.size
		}
	}
	c.mu.Lock()
	c.used -= freed
	c.mu.Unlock()
```

- **Razón técnica:** Fetcher() llama a c.fileMeta(fileID) (Lock de c.mu) en cada Range de cada reproductor/ffprobe/transcoder, y blockReader y download usan el mismo mutex. En setFileMeta (cuando el tamano en Drive cambia), en Clear() y en evict() (que se dispara al pasar los 20 GB: borra ~2 GB, unos 128 archivos de 16 MB, con c.mu tomado) la E/S de disco queda dentro de la seccion critica, de modo que cualquier lectura de video concurrente se frena por la duracion del Walk o de los borrados (en Windows, decenas o cientos de ms). Medir/borrar fuera del lock y tomarlo solo para leer/ajustar el contador elimina el bloqueo; el guard atomico evita pasadas simultaneas que antes serializaba el propio mutex.
- **Impacto esperado:** Los pedidos de rango de reproduccion dejan de congelarse cuando el cache de bloques se llena, se limpia o detecta que un archivo cambio de tamano en Drive: menos micro-cortes de video justo cuando el cache esta bajo presion.
- **Revisión manual (22/10):** Correcto. blockReader.open ya cae a descarga si os.Open falla y esa ventana nunca estaba protegida por c.mu, así que borrar bloques fuera del lock no empeora nada; evict calcula el exceso igual que antes y el CompareAndSwap evita pasadas paralelas. El contador used queda aproximado durante dirSize (error de pocos bloques, ya señalado).
- **Riesgos / a revisar:** c.used pasa a ser un contador aproximado alrededor de esas operaciones: si una descarga termina durante el Walk de dirSize, su incremento puede perderse (error acotado a unos pocos bloques de 16 MB, tolerable para un tope de 20 GB). Si evict() ya esta corriendo, otra llamada sale sin hacer nada; la siguiente descarga completada que pase el tope volvera a lanzar la limpieza. No cambia la API; revisar blockcache_test.go si algun test asume que evict() es sincronico bajo concurrencia.
- **Evidencia del hallazgo:** Read completo de internal/drive/blockcache.go: Clear (lineas 100-103) y setFileMeta (294-297) hacen 'c.used, _ = dirSize(c.dir)' entre c.mu.Lock/Unlock (la evaluacion de dirSize ocurre con el lock tomado); evict (355-365) mantiene 'defer c.mu.Unlock()' mientras llama os.Remove por cada bloque. fileMeta (273-288) y download (425-437) toman c.mu en cada llamada y Fetcher (143) llama fileMeta en cada Range. Grep 'dirSize\(|\.evict\(\)': unicos usos en blockcache.go (74, 102, 296, 506).
- Nota de aplicación: línea real 41 (desfase 1); línea real 102 (desfase 2); línea real 297 (desfase 3); línea real 345 (desfase 4); línea real 366 (desfase 11)

#### OP-06 · HandleGetLibraryCollection: con la cache vacia, peticiones concurrentes reconstruyen la coleccion completa N veces

- **Severidad:** Media · **Tipo:** Optimización · **Verificación:** mecánica + revisión manual
- **Problema:** El handler consulta libraryCollectionCache (TTL 5 min, se vacia en cada escaneo) pero, ante un fallo de cache, cada peticion concurrente carga todos los LocalFile desde SQLite y ejecuta anime.NewLibraryCollection por su cuenta, usando ademas el ctx del request (un cliente que se va cancela el calculo).

**OP-06.1 — Archivo:** `internal/handlers/anime_collection.go` · **Líneas:** 3–22 · **Acción:** replace

ANTES:

```go
import (
	"fmt"
	"net/http"
	"sync/atomic"
	"time"

	"kamehouse/internal/database/db"
	"kamehouse/internal/database/models/dto"
	"kamehouse/internal/library/anime"
	"kamehouse/internal/platforms/platform"
	"kamehouse/internal/util"
	"kamehouse/internal/util/result"

	"github.com/labstack/echo/v4"
)

var (
	libraryCollectionCache = result.NewCache[string, *anime.LibraryCollection]()
	collectionVersion      atomic.Uint64
)
```

DESPUÉS:

```go
import (
	"context"
	"fmt"
	"net/http"
	"sync/atomic"
	"time"

	"kamehouse/internal/database/db"
	"kamehouse/internal/database/models/dto"
	"kamehouse/internal/library/anime"
	"kamehouse/internal/util"
	"kamehouse/internal/util/result"

	"github.com/labstack/echo/v4"
	"golang.org/x/sync/singleflight"
)

var (
	libraryCollectionCache = result.NewCache[string, *anime.LibraryCollection]()
	collectionVersion      atomic.Uint64
	// libraryCollectionFlight colapsa las construcciones simultaneas con la cache vacia.
	libraryCollectionFlight singleflight.Group
)

// libraryCollectionBuildTimeout acota la construccion compartida, que ya no depende del request.
const libraryCollectionBuildTimeout = 2 * time.Minute
```

**OP-06.2 — Archivo:** `internal/handlers/anime_collection.go` · **Líneas:** 56–119 · **Acción:** replace

ANTES:

```go
	// Use cache if available
	if ret, ok := libraryCollectionCache.Get("main"); ok {
		return h.RespondWithData(c, ret)
	}

	animeCollection, err := h.App.GetAnimeCollection(false)
	if err != nil {
		return h.RespondWithError(c, err)
	}

	if animeCollection == nil {
		animeCollection = &platform.UnifiedCollection{}
	}

	originalAnimeCollection := animeCollection

	var lfs []*dto.LocalFile
	lfs, _, err = db.GetLocalFiles(h.App.Database)
	if err != nil {
		return h.RespondWithError(c, err)
	}
	lfs = h.visibleLocalFiles(lfs)

	libraryCollection, err := anime.NewLibraryCollection(c.Request().Context(), &anime.NewLibraryCollectionOptions{
		Database:            h.App.Database,
		PlatformRef:         h.App.Metadata.Platform,
		LocalFiles:          lfs,
		MetadataProviderRef: h.App.Metadata.Provider,
	})
	if err != nil {
		return h.RespondWithError(c, err)
	}

	_ = originalAnimeCollection

	// Hydrate total library size
	if libraryCollection != nil && libraryCollection.Stats != nil {
		libraryCollection.Stats.TotalSize = util.Bytes(h.App.TotalLibrarySize)
	}

	// Defensa: nunca serializar entries nulos (Go nil -> JSON null revienta
	// `entry.media` en el cliente con "Cannot read properties of null").
	if libraryCollection != nil {
		for _, list := range libraryCollection.Lists {
			if list == nil {
				continue
			}
			filtered := list.Entries[:0]
			for _, e := range list.Entries {
				if e != nil {
					filtered = append(filtered, e)
				}
			}
			for i := len(filtered); i < len(list.Entries); i++ {
				list.Entries[i] = nil
			}
			list.Entries = filtered
		}
	}

	libraryCollectionCache.SetT("main", libraryCollection, 5*time.Minute)

	return h.RespondWithData(c, libraryCollection)
}
```

DESPUÉS:

```go
	// Use cache if available
	if ret, ok := libraryCollectionCache.Get("main"); ok {
		return h.RespondWithData(c, ret)
	}

	// Con la cache vacia (arranque, tras un escaneo o a los 5 minutos) varias pantallas piden la
	// coleccion a la vez: un solo vuelo lee los archivos locales y la arma para todas.
	reqCtx := c.Request().Context()
	flight := libraryCollectionFlight.DoChan("main", func() (interface{}, error) {
		// Otra peticion pudo dejarla en cache mientras esta esperaba su turno.
		if ret, ok := libraryCollectionCache.Get("main"); ok {
			return ret, nil
		}
		// Desacoplado del request: lo comparten todos los que esperan, y que el primero
		// cierre la pestana no debe cancelarles la construccion.
		ctx, cancel := context.WithTimeout(context.WithoutCancel(reqCtx), libraryCollectionBuildTimeout)
		defer cancel()
		return h.buildLibraryCollection(ctx)
	})

	select {
	case res := <-flight:
		if res.Err != nil {
			return h.RespondWithError(c, res.Err)
		}
		libraryCollection, _ := res.Val.(*anime.LibraryCollection)
		return h.RespondWithData(c, libraryCollection)
	case <-reqCtx.Done():
		return h.RespondWithError(c, reqCtx.Err())
	}
}

// buildLibraryCollection arma la coleccion principal y la deja en cache.
func (h *Handler) buildLibraryCollection(ctx context.Context) (*anime.LibraryCollection, error) {
	// Si algo invalida la cache mientras se arma (escaneo, cambio de ajustes), lo armado ya es
	// viejo: se entrega a quienes lo esperan pero no se guarda.
	version := collectionVersion.Load()

	if _, err := h.App.GetAnimeCollection(false); err != nil {
		return nil, err
	}

	var lfs []*dto.LocalFile
	lfs, _, err := db.GetLocalFiles(h.App.Database)
	if err != nil {
		return nil, err
	}
	lfs = h.visibleLocalFiles(lfs)

	libraryCollection, err := anime.NewLibraryCollection(ctx, &anime.NewLibraryCollectionOptions{
		Database:            h.App.Database,
		PlatformRef:         h.App.Metadata.Platform,
		LocalFiles:          lfs,
		MetadataProviderRef: h.App.Metadata.Provider,
	})
	if err != nil {
		return nil, err
	}

	// Hydrate total library size
	if libraryCollection != nil && libraryCollection.Stats != nil {
		libraryCollection.Stats.TotalSize = util.Bytes(h.App.TotalLibrarySize)
	}

	// Defensa: nunca serializar entries nulos (Go nil -> JSON null revienta
	// `entry.media` en el cliente con "Cannot read properties of null").
	if libraryCollection != nil {
		for _, list := range libraryCollection.Lists {
			if list == nil {
				continue
			}
			filtered := list.Entries[:0]
			for _, e := range list.Entries {
				if e != nil {
					filtered = append(filtered, e)
				}
			}
			for i := len(filtered); i < len(list.Entries); i++ {
				list.Entries[i] = nil
			}
			list.Entries = filtered
		}
	}

	if collectionVersion.Load() == version {
		libraryCollectionCache.SetT("main", libraryCollection, 5*time.Minute)
	}

	return libraryCollection, nil
}
```

- **Razón técnica:** Clave estable "main" (la misma de la cache). DoChan + context.WithoutCancel con tope de 2 min: el ctx del primer request ya no cancela el calculo compartido, y cada esperador puede irse con el suyo. Se re-chequea la cache dentro del vuelo. Se extrae la construccion a buildLibraryCollection (cuerpo original sin cambios de logica) y se eliminan las asignaciones muertas animeCollection/originalAnimeCollection (por eso sale el import de platform; GetAnimeCollection(false) se sigue llamando por si devuelve error). Extra de robustez: collectionVersion capturado al inicio evita guardar en cache una coleccion armada antes de un ClearLibraryCollectionCache concurrente (hoy la construccion lenta podia resucitar datos viejos 5 min).
- **Impacto esperado:** Tras cada escaneo/limpieza de cache (o a los 5 min) el front dispara varias lecturas de /library/collection en paralelo; pasan de N x (GetLocalFiles de toda la biblioteca + NewLibraryCollection) a 1 x, y una pestana cerrada ya no aborta el calculo de las demas. Reduce picos de CPU/SQLite en el pool WAL.
- **Revisión manual (22/10):** Correcto. La coleccion compartida se lee sin mutarse tras publicarse y la comprobación de versión evita cachear lo invalidado a mitad de camino. Único cambio de comportamiento: la construcción tiene tope de 2 min y no depende del request.
- **Riesgos / a revisar:** platform queda sin uso en el archivo (verificado: solo se usaba en la asignacion muerta del nil-guard); collection_etag_test.go solo precarga la cache y no depende del cuerpo. La respuesta a quienes esperaron un vuelo invalidado a mitad de camino puede ser de la version previa (igual que antes). Timeout nuevo de 2 min (antes ilimitado salvo el ctx del request): ajustar si la primera construccion con metadata externa tarda mas.
- **Evidencia del hallazgo:** Grep singleflight: sin coincidencias en handlers/anime_collection.go (si en anime_entries.go, swimlanes.go, localfiles.go). Read anime_collection.go:19-119: cache result.Cache con SetT 5 min y ClearLibraryCollectionCache incrementa collectionVersion; fallo de cache -> GetAnimeCollection + db.GetLocalFiles + anime.NewLibraryCollection(c.Request().Context(), ...) por peticion. Grep libraryCollectionCache: solo este archivo y collection_etag_test.go.
- Nota de aplicación: línea real 62 (desfase 6)

#### OP-07 · VideoProxy serializa el mismo mapa de headers a JSON y lo URL-escapa por cada segmento del playlist

- **Severidad:** Media · **Tipo:** Optimización · **Verificación:** mecánica + revisión manual
- **Problema:** En la reescritura de playlists HLS del proxy, cada URI (segmentos, keys, maps, variantes) pasa por toProxyURL, que hace json.Marshal(headerMap) + url2.QueryEscape + string() + concatenación. El mapa de headers es idéntico para todo el playlist, así que el trabajo se repite N veces (N = cantidad de segmentos, fácilmente 500-3000).
- ⚠ **Condicional:** Aplicar SOLO si NO se ejecuta DM-03 (que borra internal/handlers/proxy.go). Si se ejecuta DM-03, omitir este paso.

**OP-07.1 — Archivo:** `internal/handlers/proxy.go` · **Líneas:** 133–133 · **Acción:** replace

ANTES:

```go
	baseURL, _ := url2.Parse(url) // Base URL for resolving relative paths
```

DESPUÉS:

```go
	baseURL, _ := url2.Parse(url) // Base URL for resolving relative paths
	// Las cabeceras son las mismas para toda URI del playlist: se serializan una sola vez.
	headersParam := proxyHeadersParam(headerMap, h.App.Logger)
```

**OP-07.2 — Archivo:** `internal/handlers/proxy.go` · **Líneas:** 142–142 · **Acción:** replace

ANTES:

```go
				if rewriteURI(&segment.URI, baseURL, headerMap, h.App.Logger) {
```

DESPUÉS:

```go
				if rewriteURI(&segment.URI, baseURL, headersParam) {
```

**OP-07.3 — Archivo:** `internal/handlers/proxy.go` · **Líneas:** 148–148 · **Acción:** replace

ANTES:

```go
					if rewriteURI(&segment.Keys[i].URI, baseURL, headerMap, h.App.Logger) {
```

DESPUÉS:

```go
					if rewriteURI(&segment.Keys[i].URI, baseURL, headersParam) {
```

**OP-07.4 — Archivo:** `internal/handlers/proxy.go` · **Líneas:** 154–154 · **Acción:** replace

ANTES:

```go
					if rewriteURI(&segment.Map.URI, baseURL, headerMap, h.App.Logger) {
```

DESPUÉS:

```go
					if rewriteURI(&segment.Map.URI, baseURL, headersParam) {
```

**OP-07.5 — Archivo:** `internal/handlers/proxy.go` · **Líneas:** 164–164 · **Acción:** replace

ANTES:

```go
				if rewriteURI(&segment.URI, baseURL, headerMap, h.App.Logger) {
```

DESPUÉS:

```go
				if rewriteURI(&segment.URI, baseURL, headersParam) {
```

**OP-07.6 — Archivo:** `internal/handlers/proxy.go` · **Líneas:** 171–171 · **Acción:** replace

ANTES:

```go
			if rewriteURI(&mediaPl.PreloadHints.URI, baseURL, headerMap, h.App.Logger) {
```

DESPUÉS:

```go
			if rewriteURI(&mediaPl.PreloadHints.URI, baseURL, headersParam) {
```

**OP-07.7 — Archivo:** `internal/handlers/proxy.go` · **Líneas:** 177–177 · **Acción:** replace

ANTES:

```go
			if rewriteURI(&mediaPl.Map.URI, baseURL, headerMap, h.App.Logger) {
```

DESPUÉS:

```go
			if rewriteURI(&mediaPl.Map.URI, baseURL, headersParam) {
```

**OP-07.8 — Archivo:** `internal/handlers/proxy.go` · **Líneas:** 184–184 · **Acción:** replace

ANTES:

```go
			if rewriteURI(&mediaPl.Keys[i].URI, baseURL, headerMap, h.App.Logger) {
```

DESPUÉS:

```go
			if rewriteURI(&mediaPl.Keys[i].URI, baseURL, headersParam) {
```

**OP-07.9 — Archivo:** `internal/handlers/proxy.go` · **Líneas:** 199–199 · **Acción:** replace

ANTES:

```go
				if rewriteURI(&variant.URI, baseURL, headerMap, h.App.Logger) {
```

DESPUÉS:

```go
				if rewriteURI(&variant.URI, baseURL, headersParam) {
```

**OP-07.10 — Archivo:** `internal/handlers/proxy.go` · **Líneas:** 205–205 · **Acción:** replace

ANTES:

```go
					if alternative != nil && rewriteURI(&alternative.URI, baseURL, headerMap, h.App.Logger) {
```

DESPUÉS:

```go
					if alternative != nil && rewriteURI(&alternative.URI, baseURL, headersParam) {
```

**OP-07.11 — Archivo:** `internal/handlers/proxy.go` · **Líneas:** 214–214 · **Acción:** replace

ANTES:

```go
			if rewriteURI(&masterPl.SessionKeys[i].URI, baseURL, headerMap, h.App.Logger) {
```

DESPUÉS:

```go
			if rewriteURI(&masterPl.SessionKeys[i].URI, baseURL, headersParam) {
```

**OP-07.12 — Archivo:** `internal/handlers/proxy.go` · **Líneas:** 243–243 · **Acción:** replace

ANTES:

```go
func rewriteURI(uri *string, baseURL *url2.URL, headerMap map[string]string, logger *zerolog.Logger) bool {
```

DESPUÉS:

```go
func rewriteURI(uri *string, baseURL *url2.URL, headersParam string) bool {
```

**OP-07.13 — Archivo:** `internal/handlers/proxy.go` · **Líneas:** 253–253 · **Acción:** replace

ANTES:

```go
	*uri = toProxyURL(*uri, headerMap, logger)
```

DESPUÉS:

```go
	*uri = toProxyURL(*uri, headersParam)
```

**OP-07.14 — Archivo:** `internal/handlers/proxy.go` · **Líneas:** 268–279 · **Acción:** replace

ANTES:

```go
func toProxyURL(targetMediaURL string, headerMap map[string]string, logger *zerolog.Logger) string {
	proxyURL := "/api/v1/proxy?url=" + url2.QueryEscape(targetMediaURL)
	if len(headerMap) > 0 {
		headersStrB, err := json.Marshal(headerMap)
		if err != nil {
			logger.Warn().Err(err).Msg("proxy: failed to marshal headers")
		} else if len(headersStrB) > 2 {
			proxyURL += "&headers=" + url2.QueryEscape(string(headersStrB))
		}
	}
	return proxyURL
}
```

DESPUÉS:

```go
// proxyHeadersParam devuelve el sufijo "&headers=<json escapado>" que acompaña a toda URI
// reescrita (cadena vacía si no hay cabeceras). Se calcula una vez por playlist.
func proxyHeadersParam(headerMap map[string]string, logger *zerolog.Logger) string {
	if len(headerMap) == 0 {
		return ""
	}
	headersStrB, err := json.Marshal(headerMap)
	if err != nil {
		logger.Warn().Err(err).Msg("proxy: failed to marshal headers")
		return ""
	}
	if len(headersStrB) <= 2 {
		return ""
	}
	return "&headers=" + url2.QueryEscape(string(headersStrB))
}

func toProxyURL(targetMediaURL, headersParam string) string {
	return "/api/v1/proxy?url=" + url2.QueryEscape(targetMediaURL) + headersParam
}
```

- **Razón técnica:** headerMap se fija una vez por petición (ya filtrado por FilterProxyRequestHeaders) y json.Marshal de un map[string]string es determinista (claves ordenadas), de modo que el sufijo resultante es el mismo para cada URI. Precalcularlo da exactamente las mismas URLs reescritas. Además de evitar N marshal + N QueryEscape + N string(bytes), el aviso de error de marshal (que no puede ocurrir con map[string]string) se emite una vez en vez de N veces. rewriteURI/toProxyURL/resolveURL solo se usan en proxy.go (Grep sin llamadores en otros archivos ni en tests), así que cambiar la firma no afecta a nadie más.
- **Impacto esperado:** Por playlist de N URIs se evitan N json.Marshal (con ordenación de claves y buffer del encoder), N QueryEscape de ~100-300 bytes, N string(bytes) y N concatenaciones: del orden de 8-10 asignaciones y ~400 bytes por segmento. Un playlist de 1000 segmentos ahorra ~8-10 mil asignaciones y ~400 KB de basura por cada refresco del playlist.
- **Revisión manual (22/10):** Correcto (condicional a no ejecutar DM-03): las cabeceras se serializan una sola vez por playlist en vez de una por segmento.
- **Riesgos / a revisar:** Cambia la firma interna de rewriteURI y toProxyURL; los 10 sitios de llamada están todos en VideoProxy y están incluidos como ediciones. La variable headersParam solo se declara en el camino HLS (después del decode exitoso), donde se usa; compila porque el caso 'default' del switch no la necesita pero ya fue declarada antes de él. Los imports (json, zerolog, url2) siguen en uso.
- **Evidencia del hallazgo:** Read de internal/handlers/proxy.go 1-285: toProxyURL (L268-279) hace json.Marshal(headerMap) y url2.QueryEscape por llamada; rewriteURI (L243-255) lo invoca por cada URI; los 10 call sites en L142-L214 recorren mediaPl.Segments/PartialSegments/Keys y masterPl.Variants/SessionKeys. Grep de rewriteURI( | toProxyURL( | resolveURL( en internal/: solo proxy.go. json es github.com/goccy/go-json (orden determinista por defecto). No se ejecutaron benchmarks.
- Nota de aplicación: ANTES aparece 2 veces; se usó la más cercana a la línea 142; línea real 150 (desfase 2); línea real 156 (desfase 2); línea real 166 (desfase 2); línea real 173 (desfase 2); línea real 179 (desfase 2); línea real 186 (desfase 2); línea real 201 (desfase 2); línea real 207 (desfase 2); línea real 216 (desfase 2); línea real 245 (desfase 2); línea real 255 (desfase 2); línea real 270 (desfase 2)

#### OP-08 · N+1 en computeIntelligence: 1-2 consultas con fila completa de LibraryMedia por cada episodio

- **Severidad:** Media · **Tipo:** Optimización · **Verificación:** mecánica + revisión manual
- **Problema:** IntelligenceService.computeIntelligence ejecuta `WHERE tmdb_id = ?` y, si falla, `WHERE id = ?` (First sobre el modelo completo, con description, synonyms, tags, genres, audio_tracks...) UNA VEZ POR EPISODIO, para leer solo Score y Genres de la misma serie.

**OP-08.1 — Archivo:** `internal/library/anime/intelligence.go` · **Líneas:** 3–13 · **Acción:** replace

ANTES:

```go
import (
	"context"
	"encoding/json"
	"fmt"
	"kamehouse/internal/database/db"
	"kamehouse/internal/database/models"
	"kamehouse/internal/database/models/dto"
	"strings"

	"github.com/rs/zerolog"
)
```

DESPUÉS:

```go
import (
	"context"
	"encoding/json"
	"fmt"
	"kamehouse/internal/database/db"
	"kamehouse/internal/database/models"
	"kamehouse/internal/database/models/dto"
	"kamehouse/internal/util/cache"
	"strconv"
	"strings"
	"time"

	"github.com/rs/zerolog"
)
```

**OP-08.2 — Archivo:** `internal/library/anime/intelligence.go` · **Líneas:** 145–149 · **Acción:** replace

ANTES:

```go
type IntelligenceService struct {
	db     *db.Database
	fm     FillerChecker // may be nil when filler data is not yet loaded
	logger *zerolog.Logger
}
```

DESPUÉS:

```go
type IntelligenceService struct {
	db     *db.Database
	fm     FillerChecker // may be nil when filler data is not yet loaded
	logger *zerolog.Logger

	// scoringMedia memoriza (30 s) el LibraryMedia con el que se puntúa cada episodio.
	scoringMedia *cache.Cache[*models.LibraryMedia]
}
```

**OP-08.3 — Archivo:** `internal/library/anime/intelligence.go` · **Líneas:** 153–159 · **Acción:** replace

ANTES:

```go
func NewIntelligenceService(database *db.Database, fm FillerChecker, logger *zerolog.Logger) *IntelligenceService {
	return &IntelligenceService{
		db:     database,
		fm:     fm,
		logger: logger,
	}
}
```

DESPUÉS:

```go
func NewIntelligenceService(database *db.Database, fm FillerChecker, logger *zerolog.Logger) *IntelligenceService {
	return &IntelligenceService{
		db:           database,
		fm:           fm,
		logger:       logger,
		scoringMedia: cache.NewCache[*models.LibraryMedia](30*time.Second, 512),
	}
}

// lookupScoringMedia resuelve el LibraryMedia con el que se puntúa un episodio
// (primero por tmdb_id y, si no existe, por id). Solo trae las columnas que usa
// computeIntelligence (score y genres) y memoriza el resultado, incluido el "no
// encontrado", para no repetir 1-2 consultas por cada episodio de la serie.
func (s *IntelligenceService) lookupScoringMedia(mediaID int) *models.LibraryMedia {
	key := strconv.Itoa(mediaID)
	if s.scoringMedia != nil {
		if cached, ok := s.scoringMedia.Get(key); ok {
			return cached
		}
	}

	var found *models.LibraryMedia
	var m models.LibraryMedia
	if err := s.db.Gorm().Select("id", "score", "genres").Where("tmdb_id = ?", mediaID).First(&m).Error; err == nil {
		found = &m
	} else if err := s.db.Gorm().Select("id", "score", "genres").Where("id = ?", mediaID).First(&m).Error; err == nil {
		found = &m
	}

	if s.scoringMedia != nil {
		s.scoringMedia.Set(key, found)
	}
	return found
}
```

**OP-08.4 — Archivo:** `internal/library/anime/intelligence.go` · **Líneas:** 192–200 · **Acción:** replace

ANTES:

```go
	var media *models.LibraryMedia
	func() {
		defer func() { recover() }() //nolint:errcheck
		var m models.LibraryMedia
		if err := s.db.Gorm().Where("tmdb_id = ?", mediaID).First(&m).Error; err == nil {
			media = &m
		} else if err := s.db.Gorm().Where("id = ?", mediaID).First(&m).Error; err == nil {
			media = &m
		}
```

DESPUÉS:

```go
	var media *models.LibraryMedia
	func() {
		defer func() { recover() }() //nolint:errcheck
		media = s.lookupScoringMedia(mediaID)
```

- **Razón técnica:** NewEpisode/NewSimpleEpisode (entry.go:425, entry_simple.go:196) llaman a computeIntelligence por cada episodio al armar la ficha de una serie; todos comparten el mismo mediaID (opts.Media.ID), así que las consultas son idénticas. Además cargaban la fila completa (texto pesado) para leer solo Score y Genres (DeriveSeriesVibes y umbral épico). Se memoriza el resultado 30 s (cache.Cache ya es seguro entre goroutines, y entry_simple lo invoca desde un Map concurrente) y se limita el SELECT a id, score, genres. La semántica (tmdb_id primero, luego id; recover ante panics por db nil) se conserva: la búsqueda sigue dentro del func() con defer recover.
- **Impacto esperado:** Una serie de 291 episodios (DBZ) pasa de 291-582 consultas con fila completa a 1-2 consultas de 3 columnas por apertura de ficha (y 0 si repite dentro de 30 s). Menos contención sobre el pool SQLite y menos asignaciones por json.RawMessage.
- **Revisión manual (22/10):** Correcto: computeIntelligence solo usa Score y Genres del media, que son las columnas que ahora se seleccionan; el resultado (incluido el 'no encontrado') se memoriza 30 s. DeriveSeriesVibes, que es público, sigue recibiendo el modelo completo desde otros llamadores.
- **Riesgos / a revisar:** El score puede estar desactualizado hasta 30 s tras un reescaneo (solo afecta etiqueta EPIC/vibes). Se conserva la rareza previa de buscar `tmdb_id = <PK>` primero. IntelligenceService solo se construye en NewIntelligenceService (grep `IntelligenceService{` = 1 resultado), y lookupScoringMedia tolera scoringMedia nil. NewCache lanza una goroutine reaper (patrón ya usado en swimlanes.go). Verificar que no exista otro identificador `cache`/`time`/`strconv` a nivel de paquete en intelligence.go (no lo hay en el archivo).
- **Evidencia del hallazgo:** Grep computeIntelligence: solo episode.go:303 y episode.go:460 (uno por episodio, con int(opts.Media.ID)). Grep NewEpisode/NewSimpleEpisode: entry.go:425 y entry_simple.go:196 (dentro de iteración por episodios). Read intelligence.go 163-223: media solo se usa para media.Score y DeriveSeriesVibes (Genres, Score). Grep `IntelligenceService\{`: único literal en intelligence.go:154. Lectura de util/cache/cache.go: Get/Set con RWMutex, NewCache[T](ttl, maxItems...). No se ejecutó benchmark.
- Nota de aplicación: línea real 148 (desfase 3); línea real 159 (desfase 6); línea real 225 (desfase 33)

#### OP-09 · JaroWinklerSimilarity asigna 4 slices en el heap por comparación de tokens

- **Severidad:** Media · **Tipo:** Optimización · **Verificación:** mecánica + revisión manual
- **Problema:** JaroWinklerSimilarity hace []rune(s1), []rune(s2) y dos make([]bool) en cada llamada; tokenCoverageScore la invoca |S|x|T| veces por dirección, para palabras de 3-10 caracteres. Cada comparación cuesta 4 asignaciones para datos que caben de sobra en la pila.

**OP-09.1 — Archivo:** `internal/library/scanner/fuzzy_matcher.go` · **Líneas:** 69–72 · **Acción:** replace

ANTES:

```go
// JaroWinklerSimilarity computes the Jaro-Winkler distance between s1 and s2 (score 0.0 to 1.0).
func JaroWinklerSimilarity(s1, s2 string) float64 {
	r1, r2 := []rune(s1), []rune(s2)
	len1, len2 := len(r1), len(r2)
```

DESPUÉS:

```go
// runeBufLen es el tamaño de los buffers en pila de JaroWinklerSimilarity: cubre palabras y
// títulos habituales sin asignar en el heap.
const runeBufLen = 64

// appendRunes agrega los runes de s a dst (equivale a []rune(s) reutilizando dst).
func appendRunes(dst []rune, s string) []rune {
	for _, r := range s {
		dst = append(dst, r)
	}
	return dst
}

// zeroedBools devuelve un []bool en cero de largo n, apoyado en buf cuando entra.
func zeroedBools(buf *[runeBufLen]bool, n int) []bool {
	if n <= len(buf) {
		return buf[:n]
	}
	return make([]bool, n)
}

// JaroWinklerSimilarity computes the Jaro-Winkler distance between s1 and s2 (score 0.0 to 1.0).
func JaroWinklerSimilarity(s1, s2 string) float64 {
	var runes1, runes2 [runeBufLen]rune
	r1, r2 := appendRunes(runes1[:0], s1), appendRunes(runes2[:0], s2)
	len1, len2 := len(r1), len(r2)
```

**OP-09.2 — Archivo:** `internal/library/scanner/fuzzy_matcher.go` · **Líneas:** 85–86 · **Acción:** replace

ANTES:

```go
	r1Matches := make([]bool, len1)
	r2Matches := make([]bool, len2)
```

DESPUÉS:

```go
	var m1, m2 [runeBufLen]bool
	r1Matches, r2Matches := zeroedBools(&m1, len1), zeroedBools(&m2, len2)
```

- **Razón técnica:** Las palabras (y la mayoría de títulos normalizados) tienen menos de 64 runas, así que los buffers pueden vivir en la pila: los arrays locales son cero-inicializados en cada llamada, por lo que las marcas de match parten en false igual que con make. Para entradas más largas se cae al heap (append crece o make exacto), con el mismo resultado. appendRunes con range produce exactamente las mismas runas que []rune(s), incluida la sustitución de bytes inválidos por U+FFFD. Los slices no escapan de la función, así que el compilador mantiene los arrays en la pila.
- **Impacto esperado:** Pasa de 4 asignaciones a 0 por llamada para cadenas de hasta 64 runas. Con tokenCoverageScore (|S|x|T| x 2 direcciones, dos veces por FuzzyMatchScore antes del otro hallazgo) un par de títulos de 4-5 palabras ahorra ~150-300 asignaciones; a escala de F archivos x M media x T títulos se evitan decenas de millones de asignaciones pequeñas por escaneo y se reduce presión del GC.
- **Revisión manual (22/10):** Correcto: los buffers de pila de 64 runas/bools cubren palabras y títulos habituales; si una cadena es más larga, append y make los pasan al heap, así que el resultado no cambia. Los buffers de bool nacen en cero en cada llamada.
- **Riesgos / a revisar:** Comprobar con go build -gcflags=-m que runes1/m1 no se marquen como escapan (no deberían: solo se pasan por puntero a funciones que devuelven un slice derivado y el resultado no sale de JaroWinklerSimilarity). Stack extra ~640 bytes por frame, irrelevante. Compatible con el hallazgo de FuzzyMatchScore (regiones de líneas distintas).
- **Evidencia del hallazgo:** Read de fuzzy_matcher.go L70-139: r1, r2 := []rune(...) y make([]bool, len1/len2) en cada llamada; tokenCoverageScore L161-198 llama JaroWinklerSimilarity(s, t) por cada par de tokens. Único llamador externo de la cadena: matcher.go:190-192 en el bucle media x títulos. Go 1.26 (builtin min/max disponible, no usado aquí). No se ejecutaron benchmarks.
- Nota de aplicación: línea real 70 (desfase 1); línea real 107 (desfase 22)

#### OP-10 · withClientID: regexp en cada etiqueta, Split/Join de todo el playlist y concatenación por segmento

- **Severidad:** Media · **Tipo:** Optimización · **Verificación:** mecánica + revisión manual
- **Problema:** Cada petición de master/índice de video/índice de audio (y las listas pre-transcodificadas) pasa el playlist por withClientID, que lo parte con strings.Split, ejecuta uriAttrRe.ReplaceAllStringFunc sobre TODA línea que empieza con # (cada #EXTINF, con 2 asignaciones aunque no haya URI) y concatena una cadena nueva por cada línea de segmento antes del strings.Join final.

**OP-10.1 — Archivo:** `internal/mediastream/hls_client_id.go` · **Líneas:** 22–44 · **Acción:** replace

ANTES:

```go
	lines := strings.Split(playlist, "\n")
	for i, line := range lines {
		body, cr := line, ""
		if strings.HasSuffix(body, "\r") {
			body, cr = strings.TrimSuffix(body, "\r"), "\r"
		}
		switch {
		case body == "":
		case strings.HasPrefix(body, "#"):
			body = uriAttrRe.ReplaceAllStringFunc(body, func(attr string) string {
				inner := uriAttrRe.FindStringSubmatch(attr)[1]
				if inner == "" || strings.Contains(inner, "://") {
					return attr
				}
				return `URI="` + appendClientParam(inner, param) + `"`
			})
		case strings.Contains(body, "://"):
		default:
			body = appendClientParam(body, param)
		}
		lines[i] = body + cr
	}
	return strings.Join(lines, "\n")
```

DESPUÉS:

```go
	// Una sola pasada escribiendo en un Builder del tamaño estimado: antes se partía la lista en
	// un []string, se corría la regexp en CADA etiqueta (#EXTINF incluidas, con 2 asignaciones
	// aunque no hubiera URI) y cada segmento hacía una concatenación nueva.
	var sb strings.Builder
	sb.Grow(len(playlist) + (strings.Count(playlist, "\n")/2+1)*(len(param)+1))
	for rest := playlist; ; {
		line, tail, more := strings.Cut(rest, "\n")
		body, cr := line, ""
		if strings.HasSuffix(body, "\r") {
			body, cr = body[:len(body)-1], "\r"
		}
		sep := byte(0) // separador del parámetro a sumar tras el cuerpo; 0 = nada
		switch {
		case body == "":
		case body[0] == '#':
			if strings.Contains(body, `URI="`) {
				body = uriAttrRe.ReplaceAllStringFunc(body, func(attr string) string {
					inner := attr[5 : len(attr)-1] // URI="<inner>"
					if inner == "" || strings.Contains(inner, "://") {
						return attr
					}
					return `URI="` + appendClientParam(inner, param) + `"`
				})
			}
		case strings.Contains(body, "://"):
		default:
			if !strings.Contains(body, "clientId=") {
				sep = '?'
				if strings.Contains(body, "?") {
					sep = '&'
				}
			}
		}
		sb.WriteString(body)
		if sep != 0 {
			sb.WriteByte(sep)
			sb.WriteString(param)
		}
		sb.WriteString(cr)
		if !more {
			break
		}
		sb.WriteByte('\n')
		rest = tail
	}
	return sb.String()
```

- **Razón técnica:** Equivale línea a línea al código anterior: strings.Cut recorre las mismas líneas que Split (incluida la última vacía tras un salto de línea final) y se re-emite el separador entre ellas igual que Join; el tratamiento de \r, de líneas vacías, de URLs absolutas y de la regla 'no repetir clientId=' es el mismo. El atributo URI se obtiene cortando la coincidencia (`URI="` ocupa 5 bytes y el grupo capturado es todo hasta la comilla final), lo que da el mismo valor que FindStringSubmatch()[1] sin ejecutar una segunda regexp. La regexp solo puede coincidir si la línea contiene el literal URI=", por lo que el Contains previo no cambia el resultado. appendClientParam se conserva (también para los tests que la usen).
- **Impacto esperado:** Para un índice de 1800 segmentos (3600 líneas): de ~5400 asignaciones (slice de líneas, 2 por cada #EXTINF vía ReplaceAllStringFunc, 1 por segmento, Join) y un par de copias completas del texto a 1 asignación para el Builder. Se ejecuta en cada refresco de playlist (no-cache) de cada cliente reproduciendo. El resto de la cadena (c.Blob([]byte(...))) mantiene una copia, que ya no es evitable sin cambiar la API de los llamadores.
- **Revisión manual (22/10):** Equivalente: uriAttrRe es URI="([^"]*)", así que attr[5:len(attr)-1] es exactamente el grupo capturado, y el precheck con Contains('URI="') solo salta líneas donde la regexp no podía coincidir. Los tests de hls_client_id pasan.
- **Riesgos / a revisar:** Probar con hls_client_id_test.go (idempotencia, clientID vacío, URIs absolutas, CRLF). La estimación del Grow es aproximada; si se queda corta el Builder simplemente crece una vez más.
- **Evidencia del hallazgo:** Read de hls_client_id.go completo (L16-45) y Grep de withClientID( : llamadores en transcode.go:89,112,135,241 (siempre convertido a []byte para c.Blob) y tests en hls_client_id_test.go:18,36,40,47. Analizado el código de regexp.replaceAll de la stdlib: aun sin coincidencias copia src a un buffer y luego a string (2 asignaciones). No se ejecutaron benchmarks.

#### OP-11 · MediaInfoExtractor.GetInfoContext: ffprobe duplicado para el mismo archivo desde distintos puntos de entrada

- **Severidad:** Media · **Tipo:** Optimización · **Verificación:** mecánica + revisión manual
- **Problema:** Tras un fallo de la cache en disco, GetInfoContext ejecuta ffprobe directamente, sin deduplicar. La deduplicacion existente (PlaybackManager.containerGroup) solo cubre newMediaContainer y su clave incluye capacidades del cliente y tipo de stream, no solo el archivo; WarmMediaInfo, pretranscode, skipdetect y los endpoints de Drive (GetMediaInfoContext) llaman al extractor por su cuenta.

**OP-11.1 — Archivo:** `internal/mediastream/videofile/info.go` · **Líneas:** 15–16 · **Acción:** replace

ANTES:

```go
	"github.com/samber/lo"
	"golang.org/x/text/language"
```

DESPUÉS:

```go
	"github.com/samber/lo"
	"golang.org/x/sync/singleflight"
	"golang.org/x/text/language"
```

**OP-11.2 — Archivo:** `internal/mediastream/videofile/info.go` · **Líneas:** 160–163 · **Acción:** replace

ANTES:

```go
type MediaInfoExtractor struct {
	fileCacher *filecache.Cacher
	logger     *zerolog.Logger
}
```

DESPUÉS:

```go
type MediaInfoExtractor struct {
	fileCacher *filecache.Cacher
	logger     *zerolog.Logger
	// probes colapsa los ffprobe simultaneos del mismo archivo (clave: hash de la ruta).
	probes singleflight.Group
}
```

**OP-11.3 — Archivo:** `internal/mediastream/videofile/info.go` · **Líneas:** 201–235 · **Acción:** replace

ANTES:

```go
	e.logger.Debug().Str("hash", hash).Msg("mediastream: Extracting media information using FFprobe")

	// Get the media information of the file.
	mi, err = FfprobeGetInfoContext(ctx, ffprobePath, path, hash)
	if err != nil {
		e.logger.Error().Err(err).Str("path", path).Msg("mediastream: Failed to extract media information using FFprobe")
		return nil, err
	}

	// Save in the cache
	_ = e.fileCacher.Set(bucket, hash, mi)

	// [DIAGNOSTIC] Log detected audio and subtitle streams so we can
	// see exactly what ffprobe found in the file (before any filtering).
	for _, a := range mi.Audios {
		e.logger.Info().
			Uint32("index", a.Index).
			Str("codec", a.Codec).
			Uint32("channels", a.Channels).
			Bool("default", a.IsDefault).
			Msg("mediastream: [diag] audio stream")
	}
	for _, s := range mi.Subtitles {
		e.logger.Info().
			Uint32("index", s.Index).
			Str("codec", s.Codec).
			Bool("isImageBased", s.IsImageBased).
			Bool("default", s.IsDefault).
			Bool("forced", s.IsForced).
			Msg("mediastream: [diag] subtitle stream")
	}

	e.logger.Debug().Str("hash", hash).Msg("mediastream: Extracted media information using FFprobe")

	return mi, nil
```

DESPUÉS:

```go
	e.logger.Debug().Str("hash", hash).Msg("mediastream: Extracting media information using FFprobe")

	// Un solo ffprobe por archivo aunque lo pidan a la vez la construccion del container (que se
	// deduplica por hash+capacidades+tipo, no solo por archivo), el calentado de la biblioteca, el
	// pretranscode, skipdetect y los endpoints de Drive: cada ffprobe de Drive lee el archivo por
	// loopback y cada uno local ocupa CPU y disco.
	flight := e.probes.DoChan(hash, func() (interface{}, error) {
		// Otro vuelo pudo dejarlo en cache entre el Get de arriba y este punto.
		var cached *MediaInfo
		if found, _ := e.fileCacher.Get(bucket, hash, &cached); found && cached != nil {
			repairLegacyHevcMime(cached)
			return cached, nil
		}

		// Desacoplado de quien lo pidio: lo comparten todos los que esperan y el tope de 40 s de
		// FfprobeGetInfoContext lo sigue acotando. Si todos se van, el resultado igual queda en cache.
		probed, probeErr := FfprobeGetInfoContext(context.WithoutCancel(ctx), ffprobePath, path, hash)
		if probeErr != nil {
			e.logger.Error().Err(probeErr).Str("path", path).Msg("mediastream: Failed to extract media information using FFprobe")
			return nil, probeErr
		}

		// Save in the cache
		_ = e.fileCacher.Set(bucket, hash, probed)

		// [DIAGNOSTIC] Log detected audio and subtitle streams so we can
		// see exactly what ffprobe found in the file (before any filtering).
		for _, a := range probed.Audios {
			e.logger.Info().
				Uint32("index", a.Index).
				Str("codec", a.Codec).
				Uint32("channels", a.Channels).
				Bool("default", a.IsDefault).
				Msg("mediastream: [diag] audio stream")
		}
		for _, s := range probed.Subtitles {
			e.logger.Info().
				Uint32("index", s.Index).
				Str("codec", s.Codec).
				Bool("isImageBased", s.IsImageBased).
				Bool("default", s.IsDefault).
				Bool("forced", s.IsForced).
				Msg("mediastream: [diag] subtitle stream")
		}

		e.logger.Debug().Str("hash", hash).Msg("mediastream: Extracted media information using FFprobe")

		return probed, nil
	})

	select {
	case res := <-flight:
		if res.Err != nil {
			return nil, res.Err
		}
		return res.Val.(*MediaInfo), nil
	case <-ctx.Done():
		return nil, ctx.Err()
	}
```

- **Razón técnica:** Clave estable = hash de la ruta (la misma de la cache en disco). DoChan + context.WithoutCancel: el ffprobe sigue acotado por los 40 s internos de FfprobeGetInfoContext y la cancelacion del lider no mata a los seguidores; cada llamador conserva su propia salida por ctx.Done(). Dentro del vuelo se repite el Get de la cache para cubrir la ventana entre el chequeo inicial y el inicio del vuelo. Los logs diagnosticos se mueven dentro del vuelo para que salgan una vez, no una por esperador.
- **Impacto esperado:** Evita ffprobe repetidos: p. ej. la primera apertura de un episodio de Drive dispara a la vez /mediastream de Drive (requestDriveMediaContainer -> GetMediaInfoContext), /drive/subtitles/status|extract y WarmMediaInfo/preloads; cada ffprobe de Drive lee cabeceras por loopback+Range y puede tardar decenas de segundos. En local, el calentado de 3 workers ya no choca con la reproduccion que arranca en el mismo archivo, y dos clientes con capacidades distintas (claves distintas en containerGroup) comparten el probe.
- **Revisión manual (22/10):** Correcto con una salvedad: el ffprobe compartido se desacopla del contexto (WithoutCancel), así que cancelar a un llamador libera su espera pero NO mata el proceso (acotado a 40 s). INTERACCIÓN con RB-05 y RB-06: al pasar ctx a GetInfoContext, la cancelación del job/scan ya no corta ese ffprobe concreto; sí corta los demás procesos (probeStreams, probeDurationWithFfprobe, ExtractAttachment).
- **Riesgos / a revisar:** Los llamadores reciben ahora el mismo *MediaInfo compartido cuando coinciden en un vuelo; revisados: publicDriveContainer y withLocalExternalSubtitles copian la estructura antes de mutar Subtitles/Fonts, y PlaybackManager ya comparte el puntero via su cache de containers, por lo que se tratan como solo-lectura. Cambio de semantica: si el cliente cancela, el ffprobe no se corta (hasta 40 s) pero deja la info en cache. MediaInfoExtractor contiene ahora un singleflight.Group: no debe copiarse por valor (solo se construye con NewMediaInfoExtractor, que devuelve puntero).
- **Evidencia del hallazgo:** Grep GetMediaInfoContext|mediaInfoExtractor.GetInfo|.GetInfo( : llamadas en handlers/drive_subtitles.go:133,169, handlers/drive_mediastream.go:236, mediastream/repository.go:289 (WarmMediaInfo), pretranscode/pretranscode.go:668, skipdetect/subtitle_hints.go:135 y mediastream/playback.go:302. Read playback.go:239-277: containerGroup.Do usa clave hash|caps:streamType. Read videofile/info.go:181-236: miss de cache -> FfprobeGetInfoContext sin ningun group. Grep singleflight: sin coincidencias en videofile/. Read drive_mediastream.go:236 confirma que el camino directo de Drive no pasa por containerGroup.
- Nota de aplicación: línea real 161 (desfase 1); línea real 204 (desfase 3)

#### OP-12 · Falta índice (tmdb_id, type) en library_media: el único existente es (type, tmdb_id)

- **Severidad:** Baja · **Tipo:** Optimización · **Verificación:** mecánica + revisión manual
- **Problema:** Varias consultas filtran library_media solo por tmdb_id (`tmdb_id = ?` / `tmdb_id IN ?`) pero el único índice que lo contiene empieza por type, así que SQLite (sin sqlite_stat1, no hay skip-scan) recorre la tabla entera.

**OP-12.1 — Archivo:** `internal/database/db/db_migrations.go` · **Líneas:** 170–172 · **Acción:** replace

ANTES:

```go
	if err := db.Exec("CREATE INDEX IF NOT EXISTS idx_local_file_media_ignored_locked ON local_file (media_id, ignored, locked)").Error; err != nil {
		logger.Error().Err(err).Msg("db: failed to create index idx_local_file_media_ignored_locked")
	}
```

DESPUÉS:

```go
	if err := db.Exec("CREATE INDEX IF NOT EXISTS idx_local_file_media_ignored_locked ON local_file (media_id, ignored, locked)").Error; err != nil {
		logger.Error().Err(err).Msg("db: failed to create index idx_local_file_media_ignored_locked")
	}
	// Consultas por tmdb_id sin type (scanner, cronología, selector, intelligence): el único
	// idx_tmdb_id_type es (type, tmdb_id) y no sirve sin type. Con type incluido el índice
	// también cubre las proyecciones id/tmdb_id/type (el id va en el rowid).
	if err := db.Exec("CREATE INDEX IF NOT EXISTS idx_library_media_tmdb_type ON library_media (tmdb_id, type)").Error; err != nil {
		logger.Error().Err(err).Msg("db: failed to create index idx_library_media_tmdb_type")
	}
```

- **Razón técnica:** models/library.go:16 y :32 declaran `uniqueIndex:idx_tmdb_id_type` en Type (primero) y TmdbID (segundo), y GORM ordena las columnas del índice compuesto por prioridad y luego por orden del campo: (type, tmdb_id). Una consulta solo por tmdb_id no puede usar el prefijo izquierdo, y no hay ANALYZE/PRAGMA optimize en el código que habilite el skip-scan. Un índice (tmdb_id, type) sirve a todas esas búsquedas y, junto con el Select de columnas del hallazgo del escáner, las vuelve cubiertas.
- **Impacto esperado:** Pasa de recorrido completo de library_media a búsqueda por índice en: scanner/persistence.go:55 y :273 (por bloques de 500), intelligence/chronology.go:46, library/anime/collection_hydrate.go:357, intelligence/selector.go:97, media_audio_preference.go:61, drive/indexer.go:235. Mejora crece con el tamaño de la biblioteca; para pocos cientos de filas es modesta.
- **Revisión manual (22/10):** Verificado: hay consultas solo por tmdb_id (media_audio_preference, indexer, chronology, selector) que no pueden usar el prefijo (type, tmdb_id). El índice nuevo cuesta una escritura extra por alta/cambio en una tabla pequeña.
- **Riesgos / a revisar:** Una escritura de índice más por insert/update de tmdb_id o type en library_media (tabla pequeña). CREATE INDEX IF NOT EXISTS es idempotente y corre en el arranque junto a los demás. El nombre es nuevo y no choca con idx_library_media_tmdb_id (el legado que la migración elimina en línea 176-184).
- **Evidencia del hallazgo:** Grep `tmdb_id IN|tmdb_id = ` en internal/: los siete sitios listados filtran sin type. Grep `ANALYZE|PRAGMA optimize` en apps/server: sin resultados (solo wal_checkpoint, integrity_check y VACUUM INTO). Lectura de db_migrations.go 133-172: ningún índice sobre library_media(tmdb_id) salvo el único compuesto de GORM. No se ejecutó EXPLAIN QUERY PLAN contra la base real; el orden del índice se dedujo de los tags GORM.
- Nota de aplicación: línea real 179 (desfase 9)

#### OP-13 · SlowTraceLogger vuelca slow_traces.json a disco dentro del callback de GORM y con el mutex tomado

- **Severidad:** Baja · **Tipo:** Optimización · **Verificación:** mecánica + revisión manual
- **Problema:** Al llegar a 50 entradas, el callback after de GORM llama flushLocked con s.mu tomado: lee el archivo completo, lo deserializa, lo reserializa con indentacion (hasta 500 entradas) y lo escribe. Para Create/Update/Delete el callback corre dentro de la transaccion de escritura abierta, asi que SQLite (un solo escritor en WAL) queda retenido durante esa E/S y las demas consultas lentas se encolan en s.mu.

**OP-13.1 — Archivo:** `internal/database/db/slow_trace_logger.go` · **Líneas:** 27–28 · **Acción:** replace

ANTES:

```go
	mu        sync.Mutex
	filePath  string
```

DESPUÉS:

```go
	mu        sync.Mutex
	fileMu    sync.Mutex
	filePath  string
```

**OP-13.2 — Archivo:** `internal/database/db/slow_trace_logger.go` · **Líneas:** 107–114 · **Acción:** replace

ANTES:

```go
		s.mu.Lock()
		s.entries = append(s.entries, entry)

		// Flush to disk when buffer is full
		if len(s.entries) >= s.maxBuffer {
			s.flushLocked()
		}
		s.mu.Unlock()
```

DESPUÉS:

```go
		s.mu.Lock()
		s.entries = append(s.entries, entry)

		// Flush to disk when buffer is full: el lote se saca bajo el lock y se escribe en segundo
		// plano, para que la consulta lenta (y la transaccion de GORM de la que forma parte) no
		// espere la E/S del archivo.
		var batch []SlowTraceEntry
		if len(s.entries) >= s.maxBuffer {
			batch = s.entries
			s.entries = make([]SlowTraceEntry, 0, 64)
		}
		s.mu.Unlock()

		if batch != nil {
			go s.writeBatch(batch)
		}
```

**OP-13.3 — Archivo:** `internal/database/db/slow_trace_logger.go` · **Líneas:** 118–160 · **Acción:** replace

ANTES:

```go
// Flush writes all buffered entries to slow_traces.json.
func (s *SlowTraceLogger) Flush() {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.flushLocked()
}

// flushLocked writes entries to disk. Must be called with s.mu held.
func (s *SlowTraceLogger) flushLocked() {
	if len(s.entries) == 0 {
		return
	}

	// Read existing entries from file
	var existing []SlowTraceEntry
	data, err := os.ReadFile(s.filePath)
	if err == nil && len(data) > 0 {
		_ = json.Unmarshal(data, &existing)
	}

	// Append new entries
	combined := append(existing, s.entries...)

	// Keep only the most recent 500 entries to prevent unbounded growth
	const maxEntries = 500
	if len(combined) > maxEntries {
		combined = combined[len(combined)-maxEntries:]
	}

	// Write back
	output, err := json.MarshalIndent(combined, "", "  ")
	if err != nil {
		fmt.Fprintf(os.Stderr, "slow_trace_logger: failed to marshal: %v\n", err)
		return
	}

	if err := os.WriteFile(s.filePath, output, 0644); err != nil {
		fmt.Fprintf(os.Stderr, "slow_trace_logger: failed to write: %v\n", err)
	}

	// Clear buffer
	s.entries = s.entries[:0]
}
```

DESPUÉS:

```go
// Flush writes all buffered entries to slow_traces.json.
func (s *SlowTraceLogger) Flush() {
	s.mu.Lock()
	batch := s.entries
	s.entries = make([]SlowTraceEntry, 0, 64)
	s.mu.Unlock()

	s.writeBatch(batch)
}

// writeBatch agrega batch a slow_traces.json. Corre sin s.mu tomado: leer, recodificar y
// escribir el archivo es E/S de disco y no debe frenar a las demas consultas lentas ni retener
// una transaccion de escritura abierta cuando se invoca desde un callback de GORM.
func (s *SlowTraceLogger) writeBatch(batch []SlowTraceEntry) {
	if len(batch) == 0 {
		return
	}

	// fileMu serializa el ciclo leer-modificar-escribir del archivo.
	s.fileMu.Lock()
	defer s.fileMu.Unlock()

	// Read existing entries from file
	var existing []SlowTraceEntry
	data, err := os.ReadFile(s.filePath)
	if err == nil && len(data) > 0 {
		_ = json.Unmarshal(data, &existing)
	}

	// Append new entries
	combined := append(existing, batch...)

	// Keep only the most recent 500 entries to prevent unbounded growth
	const maxEntries = 500
	if len(combined) > maxEntries {
		combined = combined[len(combined)-maxEntries:]
	}

	// Write back
	output, err := json.MarshalIndent(combined, "", "  ")
	if err != nil {
		fmt.Fprintf(os.Stderr, "slow_trace_logger: failed to marshal: %v\n", err)
		return
	}

	if err := os.WriteFile(s.filePath, output, 0644); err != nil {
		fmt.Fprintf(os.Stderr, "slow_trace_logger: failed to write: %v\n", err)
	}
}
```

- **Razón técnica:** El logger esta activo (db.go:146-148, umbral 500 ms) y registra callbacks para Query/Create/Update/Delete. El callback After de Create/Update/Delete se ejecuta antes del commit cuando la operacion va dentro de una transaccion (por ejemplo UpsertLocalFileRelationalBatch usa d.gormdb.Transaction), por lo que la E/S del volcado (ReadFile + Unmarshal + MarshalIndent + WriteFile de un JSON de hasta 500 entradas) extiende el tiempo que se retiene el unico escritor de SQLite justo cuando ya hubo escrituras lentas, y bloquea en s.mu a cualquier otro callback concurrente. Sacar el lote bajo el lock y escribirlo en segundo plano con un mutex de archivo propio mantiene la serializacion del archivo sin esos bloqueos.
- **Impacto esperado:** Reduce la contencion de escritura en SQLite durante escaneos/guardados masivos, que es cuando se generan consultas lentas, y evita que los callbacks se encolen detras de una E/S de archivo.
- **Revisión manual (22/10):** Correcto con una salvedad conocida: el lote en vuelo puede perderse si el proceso termina antes de que la goroutine escriba (es un log de diagnóstico). fileMu serializa el ciclo leer-modificar-escribir.
- **Riesgos / a revisar:** Las entradas de un lote en vuelo pueden perderse si el proceso termina antes de que la goroutine escriba (es un log de diagnostico best-effort; Flush() de cierre y de backup sigue escribiendo de forma sincrona lo pendiente). Dos lotes pueden llegar al archivo en orden distinto al cronologico (cada entrada lleva Timestamp). writeBatch no puede entrar en panico con tipos simples; si se prefiere, envolver la goroutine con util.HandlePanicInModuleThen. Ningun otro codigo referencia flushLocked (Grep).
- **Evidencia del hallazgo:** Read completo de slow_trace_logger.go; Grep 'NewSlowTraceLogger|RegisterCallbacks' en internal/database: db.go:146-148 lo crea y registra, db.go:182 y backup.go:38 llaman Flush(). Grep 'flushLocked|\.entries\b': solo usado dentro de slow_trace_logger.go (112, 122, 127, 139, 159).
- Nota de aplicación: línea real 108 (desfase 1); línea real 127 (desfase 9)

#### OP-14 · GetAllTitles crece el slice con appends sucesivos en el bucle media x archivo

- **Severidad:** Baja · **Tipo:** Optimización · **Verificación:** mecánica + revisión manual
- **Problema:** GetAllTitles parte de make([]*string, 0) y hace hasta cuatro append individuales más un append de Synonyms, provocando 3-4 reasignaciones por media. Se llama una vez por media y por archivo en el Paso 4 del matcher.

**OP-14.1 — Archivo:** `internal/database/models/dto/normalized_media_helpers.go` · **Líneas:** 24–28 · **Acción:** replace

ANTES:

```go
func GetAllTitles(m *NormalizedMedia) []*string {
	titles := make([]*string, 0)
	if m.Title == nil {
		return titles
	}
```

DESPUÉS:

```go
func GetAllTitles(m *NormalizedMedia) []*string {
	if m.Title == nil {
		return make([]*string, 0)
	}
	titles := make([]*string, 0, 4+len(m.Synonyms))
```

- **Razón técnica:** El tamaño máximo es conocido (4 títulos + len(Synonyms)), así que se reserva una sola vez. El caso Title == nil devuelve el mismo slice vacío no nulo que antes (sin considerar sinónimos, como el original). El resto de la función no cambia.
- **Impacto esperado:** De 3-4 asignaciones (capacidades 1, 2, 4 y luego crecimiento al añadir sinónimos) a 1 por llamada. Con F archivos sin match x M media son F x M x ~3 asignaciones menos (p. ej. 2000 x 300 x 3 = 1.8 millones).
- **Revisión manual (22/10):** Correcto: solo cambia la capacidad inicial del slice.
- **Riesgos / a revisar:** Ninguno: único llamador es matcher.go:185 (Grep de GetAllTitles( sin tests), que solo itera el resultado.
- **Evidencia del hallazgo:** Read de normalized_media_helpers.go L24-43 vía Grep -A 30 y Grep GetAllTitles( en internal/: definición + una única llamada en internal/library/scanner/matcher.go:185 dentro de for media := range NormalizedMedia.

#### OP-15 · First() con fila completa de local_file/library_media en HEAD de Drive, tamaño de subtítulos y episode-file

- **Severidad:** Baja · **Tipo:** Optimización · **Verificación:** mecánica + revisión manual
- **Problema:** Cuatro lecturas puntuales traen todas las columnas (incluidos los blobs JSON parsed_data, embedded_metadata, technical_info, metadata) cuando solo usan 1-3 campos.

**OP-15.1 — Archivo:** `internal/handlers/drive.go` · **Líneas:** 294–295 · **Acción:** replace

ANTES:

```go
		var dbFile models.LocalFile
		if err := h.App.Database.Gorm().Where("drive_file_id = ? OR path LIKE ?", fileID, "gdrive://"+fileID+"/%").First(&dbFile).Error; err == nil && dbFile.FileSize > 0 {
```

DESPUÉS:

```go
		var dbFile models.LocalFile
		if err := h.App.Database.Gorm().Select("name", "file_size").Where("drive_file_id = ? OR path LIKE ?", fileID, "gdrive://"+fileID+"/%").First(&dbFile).Error; err == nil && dbFile.FileSize > 0 {
```

**OP-15.2 — Archivo:** `internal/handlers/drive_subtitles.go` · **Líneas:** 210–211 · **Acción:** replace

ANTES:

```go
	var dbFile models.LocalFile
	if err := h.App.Database.Gorm().Where("path = ?", drivePath).First(&dbFile).Error; err == nil && dbFile.FileSize > 0 {
```

DESPUÉS:

```go
	var dbFile models.LocalFile
	if err := h.App.Database.Gorm().Select("file_size").Where("path = ?", drivePath).First(&dbFile).Error; err == nil && dbFile.FileSize > 0 {
```

**OP-15.3 — Archivo:** `internal/handlers/chronology_frames.go` · **Líneas:** 41–42 · **Acción:** replace

ANTES:

```go
	if err := h.App.Database.Gorm().
		Where("tmdb_id = ? AND type IN (?, ?)", tmdbID, "ANIME", "SHOW").
```

DESPUÉS:

```go
	if err := h.App.Database.Gorm().
		Select("id").
		Where("tmdb_id = ? AND type IN (?, ?)", tmdbID, "ANIME", "SHOW").
```

**OP-15.4 — Archivo:** `internal/handlers/chronology_frames.go` · **Líneas:** 74–75 · **Acción:** replace

ANTES:

```go
		Table("local_file").
		Where("library_media_id = ?", libMedia.ID).
```

DESPUÉS:

```go
		Table("local_file").
		Select("path", "file_mod_time", "file_size").
		Where("library_media_id = ?", libMedia.ID).
```

- **Razón técnica:** drive.go:295 (HEAD que hace el reproductor/ffprobe antes de cada reproducción) solo usa dbFile.FileSize y dbFile.Name; drive_subtitles.go:211 (driveFileSizeCtx) solo usa FileSize; chronology_frames.go solo usa libMedia.ID y localFile.Path/FileModTime/FileSize. SQLite solo lee las páginas de overflow de las columnas pedidas, así que seleccionar las necesarias evita leer y copiar los blobs JSON de varios KB por fila. Los sitios vecinos (drive_mediastream.go:228, drive_thumbnail.go:44) ya aplican este patrón.
- **Impacto esperado:** Menor E/S y asignaciones por cada HEAD/apertura de reproducción desde Drive y por cada consulta de miniatura de cronología; en rutas de reproducción es latencia directa.
- **Revisión manual (22/10):** Verificado: las columnas seleccionadas (name, file_size, path, file_mod_time) existen en LocalFile y el código posterior solo lee esos campos. First sigue ordenando por id, que SQLite resuelve aunque no esté en el SELECT.
- **Riesgos / a revisar:** Bajo: se verificó que ninguno de los cuatro sitios lee otros campos del struct tras la consulta (drive.go 296-309 usa FileSize y Name; chronology_frames.go 50, 75 usan libMedia.ID y 89-95 usan Path/FileModTime/FileSize). El First() sigue agregando ORDER BY id, que SQLite resuelve aunque la columna id no esté en el SELECT.
- **Evidencia del hallazgo:** Read drive.go 291-310, drive_subtitles.go 203-222, chronology_frames.go 39-97 y drive_mediastream.go 223-231 (patrón Select ya presente). Modelo LocalFile (models/local_file.go): 5 columnas json.RawMessage type:text.
- Nota de aplicación: línea real 253 (desfase -41); línea real 75 (desfase 1)

#### OP-16 · thumbnailHash usa 4 fmt.Sprintf (uno con %x reflexivo) en cada petición de miniatura

- **Severidad:** Baja · **Tipo:** Optimización · **Verificación:** mecánica + revisión manual
- **Problema:** thumbnailHash se calcula en cada petición a /thumbnail (incluidas las que terminan en 304 o aciertan la caché LRU) y construye la clave con fmt.Sprintf dos veces y el hex con fmt.Sprintf("%x", sha256.Sum256(...)), que pasa por reflexión y asigna varias veces; una grilla fría dispara cientos de estas llamadas.

**OP-16.1 — Archivo:** `internal/handlers/thumbnail.go` · **Líneas:** 5–6 · **Acción:** replace

ANTES:

```go
	"crypto/sha256"
	"errors"
```

DESPUÉS:

```go
	"crypto/sha256"
	"encoding/hex"
	"errors"
```

**OP-16.2 — Archivo:** `internal/handlers/thumbnail.go` · **Líneas:** 68–74 · **Acción:** replace

ANTES:

```go
func thumbnailHash(videoPath string, videoStat os.FileInfo, offsetSec *int) string {
	key := fmt.Sprintf("%s:%d:%d", videoPath, videoStat.ModTime().UnixNano(), videoStat.Size())
	if offsetSec != nil {
		key = fmt.Sprintf("%s:t=%d", key, *offsetSec)
	}
	return fmt.Sprintf("%x", sha256.Sum256([]byte(key)))
}
```

DESPUÉS:

```go
func thumbnailHash(videoPath string, videoStat os.FileInfo, offsetSec *int) string {
	key := make([]byte, 0, len(videoPath)+64)
	key = append(key, videoPath...)
	key = append(key, ':')
	key = strconv.AppendInt(key, videoStat.ModTime().UnixNano(), 10)
	key = append(key, ':')
	key = strconv.AppendInt(key, videoStat.Size(), 10)
	if offsetSec != nil {
		key = append(key, ":t="...)
		key = strconv.AppendInt(key, int64(*offsetSec), 10)
	}
	sum := sha256.Sum256(key)
	return hex.EncodeToString(sum[:])
}
```

- **Razón técnica:** La clave es byte a byte la misma ("ruta:modtimeNano:tamaño" y opcionalmente ":t=N") y el hex en minúsculas de sha256 es idéntico al de %x sobre [32]byte, por lo que los nombres de archivo de la caché en disco, los ETag y las entradas del LRU no cambian. strconv.AppendInt y hex.EncodeToString evitan la reflexión y las cadenas intermedias de Sprintf. strconv y fmt ya están importados/en uso en el archivo (fmt sigue usándose en L194, L246 y L299).
- **Impacto esperado:** De ~8-10 asignaciones por llamada (3 Sprintf + conversión []byte(key) + boxing de argumentos) a 3 (buffer de la clave, array del hash en pila, string del hex). Se ejecuta en cada tile de miniatura aunque la respuesta sea 304, así que una grilla de 100-200 tiles ahorra del orden de 1000 asignaciones por render.
- **Revisión manual (22/10):** Equivalente: la clave es byte a byte la misma (ruta:modTime:tamaño[:t=offset]) y hex.EncodeToString(sum[:]) da el mismo texto que %x de [32]byte, así que las miniaturas ya cacheadas siguen valiendo.
- **Riesgos / a revisar:** Bajo: mismo hash de salida. El camino frío legacy (L246, fmt.Sprintf("%x", sha256.Sum256([]byte(videoPath)))) no se tocó porque solo corre ante un fallo de caché.
- **Evidencia del hallazgo:** Read de thumbnail.go L1-80 y L160-250: thumbnailHash llamado desde el handler (L162) antes de revisar ETag/LRU y desde EnsureThumbnailWithOffset (L226). Grep en handlers: no hay otro cálculo de la clave. strconv ya está en los imports (L12). No se ejecutaron benchmarks.
- Nota de aplicación: línea real 69 (desfase 1)

#### OP-17 · El escáner carga LibraryMedia completo solo para leer id/tmdb_id/type

- **Severidad:** Baja · **Tipo:** Optimización · **Verificación:** mecánica + revisión manual
- **Problema:** persistence.go hace `Find` de LibraryMedia completo (description, synonyms, tags, genres, audio/subtitle_tracks) en dos bucles por bloques de 500 tmdb_id, pero solo usa TmdbID, Type e ID; además cada pasada del escaneo los repite.

**OP-17.1 — Archivo:** `internal/library/scanner/persistence.go` · **Líneas:** 54–55 · **Acción:** replace

ANTES:

```go
			var persisted []*models.LibraryMedia
			scn.Database.Gorm().Where("tmdb_id IN ?", chunk).Find(&persisted)
```

DESPUÉS:

```go
			var persisted []*models.LibraryMedia
			scn.Database.Gorm().Select("tmdb_id", "type").Where("tmdb_id IN ?", chunk).Find(&persisted)
```

**OP-17.2 — Archivo:** `internal/library/scanner/persistence.go` · **Líneas:** 272–273 · **Acción:** replace

ANTES:

```go
			var chunkMedia []*models.LibraryMedia
			scn.Database.Gorm().Where("tmdb_id IN ?", chunk).Find(&chunkMedia)
```

DESPUÉS:

```go
			var chunkMedia []*models.LibraryMedia
			scn.Database.Gorm().Select("id", "tmdb_id", "type").Where("tmdb_id IN ?", chunk).Find(&chunkMedia)
```

- **Razón técnica:** En el primer sitio `persisted` solo alimenta el set alreadyPersisted con m.TmdbID y m.Type; en el segundo, `insertedMedia` solo se usa para m.TmdbID, m.Type y m.ID al armar libraryMediaIdMap. Limitar las columnas evita leer y copiar los campos de texto pesados de toda la biblioteca en cada escaneo (y deja la consulta cubrible por un índice (tmdb_id, type), ver hallazgo del índice).
- **Impacto esperado:** Menos E/S y asignaciones por escaneo: se omiten ~15 columnas por fila, incluidas las de varios KB (description, synonyms, tags). Beneficio proporcional al tamaño de la biblioteca.
- **Revisión manual (22/10):** Correcto: el bucle posterior solo usa ID, TmdbID y Type, que son las columnas seleccionadas.
- **Riesgos / a revisar:** El hook AfterFind de LibraryMedia (m.IDMal = m.MyanimelistId) queda con 0 en estas filas; no se lee en ninguno de los dos sitios. Los errores del Find siguen ignorados como antes (comportamiento sin cambios).
- **Evidencia del hallazgo:** Read persistence.go 30-100 y 255-311: `persisted` solo se recorre en `alreadyPersisted[fmt.Sprintf("%d_%s", m.TmdbID, m.Type)]`; `insertedMedia` solo en el bucle 279-286 (m.TmdbID, m.Type, m.ID) y en un Debug de len(). Grep de consultas por tmdb_id en internal/ confirmó estos dos sitios.

#### OP-18 · RunScan resuelve nombres de archivo (parser + regex) dentro del lock de escritura de drive.Service

- **Severidad:** Media · **Tipo:** Optimización · **Verificación:** mecánica + revisión manual
- **Problema:** El callback de ListVideoFiles llama ResolveDriveFile (parser.Parse, 5 regex y ResolveDragonBallPath) por cada archivo de la carpeta dentro de la closure pasada a updateProgress, que corre con s.mu.Lock() tomado; el mismo mutex lo toman en lectura GetClient/IsEnabled/GetFolderID en cada reproduccion de Drive.

**OP-18.1 — Archivo:** `internal/drive/scan.go` · **Líneas:** 87–118 · **Acción:** replace

ANTES:

```go
	files, err := client.ListVideoFiles(ctx, folderID, func(folderPath string, found []DriveFile, pending int) {
		update(func(p *ScanProgress) {
			p.FoldersScanned++
			p.FoldersPending = pending
			p.FilesFound += len(found)
			if folderPath == "" {
				p.CurrentFolder = "/"
			} else {
				p.CurrentFolder = folderPath
			}
			for _, df := range found {
				r := ResolveDriveFile(df, 0)
				group := r.SeriesTitle
				if r.IsMovie {
					group = scanMoviesGroupName
				}
				if i, ok := seriesIdx[group]; ok {
					p.Series[i].Count++
				} else {
					seriesIdx[group] = len(p.Series)
					p.Series = append(p.Series, ScanSeriesCount{Title: group, Count: 1})
				}
				p.Items = pushItem(p.Items, ScanItem{
					Name:    df.Name,
					Folder:  folderPath,
					Series:  r.SeriesTitle,
					Episode: r.EpisodeNumber,
					IsMovie: r.IsMovie,
				})
			}
		})
	})
```

DESPUÉS:

```go
	files, err := client.ListVideoFiles(ctx, folderID, func(folderPath string, found []DriveFile, pending int) {
		// Resolver nombres (parser + regex) es CPU por archivo: se hace ANTES de tomar el lock
		// del Service, que GetClient/IsEnabled/GetFolderID toman en cada reproduccion. Dentro
		// de update solo se mutan contadores.
		type foundItem struct {
			group string
			item  ScanItem
		}
		resolved := make([]foundItem, 0, len(found))
		for _, df := range found {
			r := ResolveDriveFile(df, 0)
			group := r.SeriesTitle
			if r.IsMovie {
				group = scanMoviesGroupName
			}
			resolved = append(resolved, foundItem{group: group, item: ScanItem{
				Name:    df.Name,
				Folder:  folderPath,
				Series:  r.SeriesTitle,
				Episode: r.EpisodeNumber,
				IsMovie: r.IsMovie,
			}})
		}
		update(func(p *ScanProgress) {
			p.FoldersScanned++
			p.FoldersPending = pending
			p.FilesFound += len(found)
			if folderPath == "" {
				p.CurrentFolder = "/"
			} else {
				p.CurrentFolder = folderPath
			}
			for _, f := range resolved {
				if i, ok := seriesIdx[f.group]; ok {
					p.Series[i].Count++
				} else {
					seriesIdx[f.group] = len(p.Series)
					p.Series = append(p.Series, ScanSeriesCount{Title: f.group, Count: 1})
				}
				p.Items = pushItem(p.Items, f.item)
			}
		})
	})
```

- **Razón técnica:** update() llama s.updateProgress(fn), que ejecuta fn bajo s.mu.Lock() (service.go:147-153). Hoy fn contiene el bucle `for _, df := range found { ResolveDriveFile(df, 0) ... }`, o sea parsear hasta 1000 nombres (pageSize=1000 en client.go:232, y una carpeta puede traer varias paginas) mientras se sostiene el lock de escritura. El mismo s.mu es un RWMutex que el camino de reproduccion toma en cada pedido (StreamMedia -> GetClient en service.go:245-251, IsEnabled y AuthExpired en handlers/drive_mediastream.go:189-199) y Go bloquea a los nuevos lectores mientras hay un escritor pendiente. Sacar el calculo fuera de la closure deja bajo el lock solo contadores y appends. seriesIdx sigue accediendose unicamente desde este callback, que ListVideoFiles documenta como serializado (client.go:121-124, invocado bajo su mu en 187-189), asi que no hace falta sincronizacion adicional.
- **Impacto esperado:** Mientras se escanea Drive, los pedidos de reproduccion/HEAD/miniatura ya no quedan detenidos tras el lock de escritura el tiempo que tarda parsear una carpeta grande; el estado de progreso emitido es identico (mismas series, orden y items).
- **Revisión manual (22/10):** Correcto: ResolveDriveFile (parser + regexp) se calcula antes de tomar el lock del Service; dentro de update solo se mutan contadores.
- **Riesgos / a revisar:** Mantiene un asignacion extra por carpeta (slice `resolved`), irrelevante frente al coste de parsear. El callback sigue ejecutandose bajo el mu interno de ListVideoFiles (frena a los otros workers de listado, no a la reproduccion); sacarlo de ahi exigiria un segundo mutex y un cambio de contrato mayor.
- **Evidencia del hallazgo:** scan.go:87-118 (ResolveDriveFile dentro de update); service.go:147-153 (updateProgress bajo s.mu.Lock) y 97-105/108-112/115-119/245-251 (GetClient, IsEnabled, GetFolderID, StreamMedia toman s.mu.RLock); indexer.go:89-104 (ResolveDriveFile invoca parser.Parse, ExtractEpisodeNumber con 5 regex y scanner.ResolveDragonBallPath por archivo).

#### OP-19 · Cabezas especulativas de prefetch: esperan slot del governor en cola FIFO y se lanzan duplicadas

- **Severidad:** Media · **Tipo:** Optimización · **Verificación:** mecánica + revisión manual
- **Problema:** prefetch() lanza `go p.runHead(p.ctx, i, true)` en cada pedido de segmento (incluso los ya listos) y runHead bloquea en governor.Acquire sin límite; como la cabeza aún no reclamó su slot en p.heads, minHeadDistance (que ignora cabezas con cmd==nil) no la ve y cada pedido siguiente deja otra goroutine parada para el mismo segmento. Al liberarse slots, las especulativas viejas pasan antes que la cabeza real del seek, y varias terminan lanzando ffmpeg duplicados para el mismo rango.

**OP-19.1 — Archivo:** `internal/mediastream/cassette/pipeline.go` · **Líneas:** 626–633 · **Acción:** replace

ANTES:

```go
	p.headsMu.Lock()
	// Checked under headsMu: Kill() cancels p.ctx before taking the lock, so either
	// we see the cancellation here or our wg.Add happens before Kill's Wait.
	if p.ctx.Err() != nil {
		p.headsMu.Unlock()
		combinedRelease()
		return fmt.Errorf("cassette: pipeline cancelled")
	}
```

DESPUÉS:

```go
	p.headsMu.Lock()
	// Checked under headsMu: Kill() cancels p.ctx before taking the lock, so either
	// we see the cancellation here or our wg.Add happens before Kill's Wait.
	if p.ctx.Err() != nil {
		p.headsMu.Unlock()
		combinedRelease()
		return fmt.Errorf("cassette: pipeline cancelled")
	}
	// Another prefetch (they fire once per ready segment) may have claimed this range, or even
	// finished its first segment, while this one was launching: a second ffmpeg would only
	// encode the same segments until readSegments tells it to quit.
	if speculative && (p.segments.IsReady(start) || p.headNearLocked(start)) {
		p.headsMu.Unlock()
		combinedRelease()
		return nil
	}
```

**OP-19.2 — Archivo:** `internal/mediastream/cassette/pipeline.go` · **Líneas:** 559–563 · **Acción:** replace

ANTES:

```go
	// acquire a slot from the governor
	release, err := p.governor.Acquire(ctx)
	if err != nil {
		return fmt.Errorf("cassette: governor denied slot: %w", err)
	}
```

DESPUÉS:

```go
	// acquire a slot from the governor. A speculative head never waits for one: parked in the
	// FIFO channel queue it would be served before the head a player requests right after a seek
	// (killAllHeads frees slots first), and prefetch fires once per ready segment, so every
	// request would leave one more goroutine parked here for the same segment.
	var release func()
	if speculative {
		var ok bool
		if release, ok = p.governor.TryAcquire(); !ok {
			return nil
		}
	} else {
		var err error
		if release, err = p.governor.Acquire(ctx); err != nil {
			return fmt.Errorf("cassette: governor denied slot: %w", err)
		}
	}
```

**OP-19.3 — Archivo:** `internal/mediastream/cassette/pipeline.go` · **Líneas:** 462–469 · **Acción:** replace

ANTES:

```go
func (p *Pipeline) isScheduled(seg int32) bool {
	for _, h := range p.heads {
		if h.segment >= 0 && h.cmd != nil && h.segment <= seg && seg < h.end {
			return true
		}
	}
	return false
}
```

DESPUÉS:

```go
func (p *Pipeline) isScheduled(seg int32) bool {
	for _, h := range p.heads {
		if h.segment >= 0 && h.cmd != nil && h.segment <= seg && seg < h.end {
			return true
		}
	}
	return false
}

// headNearLocked reports whether a live head already covers start and sits at most one segment
// behind it. Unlike isScheduled and minHeadDistance it also counts heads that are still
// launching (cmd not set yet). Caller holds headsMu.
func (p *Pipeline) headNearLocked(start int32) bool {
	for _, h := range p.heads {
		if h.segment >= 0 && h.segment <= start && start < h.end && start-h.segment <= 1 {
			return true
		}
	}
	return false
}
```

**OP-19.4 — Archivo:** `internal/mediastream/cassette/governor.go` · **Líneas:** 154–154 · **Acción:** replace

ANTES:

```go
	}, nil
```

DESPUÉS:

```go
	}
```

**OP-19.5 — Archivo:** `internal/mediastream/cassette/governor.go` · **Líneas:** 124–127 · **Acción:** replace

ANTES:

```go
	}

	waited := time.Since(start)
	n := g.active.Add(1)
```

DESPUÉS:

```go
	}

	return g.granted(time.Since(start)), nil
}

// TryAcquire takes a slot only if one is free right now. Speculative work uses it so it never
// queues in front of the heads a player is actually waiting for.
func (g *Governor) TryAcquire() (release func(), ok bool) {
	select {
	case g.sem <- struct{}{}:
		return g.granted(0), true
	default:
		return nil, false
	}
}

// granted records a slot that was just taken and returns its (idempotent) release function.
func (g *Governor) granted(waited time.Duration) func() {
	n := g.active.Add(1)
```

- **Razón técnica:** El propio comentario de GetSegment (pipeline.go:244-251) asume que tras un seek el governor.Acquire de la cabeza real no espera. Pero las goroutines especulativas viejas siguen paradas en g.sem (usan p.ctx, que no se cancela con killAllHeads) y la cola de envíos de un canal Go es FIFO: los slots liberados por KillAllPipelineHeads van primero a ellas, que además lanzan ffmpeg para rangos previos al seek. Una cabeza especulativa por definición puede descartarse: prefetch vuelve a intentarlo en el siguiente pedido. TryAcquire (no bloqueante) más la re-verificación bajo headsMu al reclamar el slot elimina tanto la cola como el lanzamiento doble de la ventana entre el chequeo de prefetch (cmd==nil no cuenta) y el claim.
- **Impacto esperado:** Con el governor saturado (en CPU puro son max(NumCPU-1,1) slots: 3 en un 4 núcleos, que ocupan video+audio+1 especulativa) cada segmento servido deja una goroutine más parada, y tras un seek la cabeza que el reproductor espera queda detrás de ellas: más latencia de arranque tras seek y ffmpeg duplicados quemando CPU/GPU. Con slots libres, una ráfaga de pedidos de segmentos ya listos lanza N ffmpeg idénticos que solo se detienen cuando readSegments ve el primer segmento listo.
- **Revisión manual (22/10):** Cambio de política del governor, revisado solo por lectura: una cabeza especulativa de prefetch ya no espera slot (usa TryAcquire) y se descarta si ya hay una cabeza cercana. Reduce goroutinas paradas e inversiones de prioridad, pero conviene verificarlo con reproducción HLS real (seek, saltos largos, governor lleno).
- **Riesgos / a revisar:** Si el governor está lleno, la cabeza especulativa se descarta en vez de esperar; con un solo slot el prefetch solo arranca cuando queda libre en un pedido posterior. headNearLocked usa tolerancia de 1 segmento: una cabeza propia ya en `start` o 1 atrás evita el duplicado, una más lejana no (se conserva el criterio de distancia de prefetch). Acquire conserva firma y semántica, sin cambios en otros callers.
- **Evidencia del hallazgo:** pipeline.go:277 y :311 llaman p.prefetch en cada pedido; :503-511 chequea minHeadDistance (ignora h.cmd==nil, :476) y lanza `go func(s int32){ _ = p.runHead(p.ctx, s, true) }`; :560 `p.governor.Acquire(ctx)` sin distinguir speculative; :626-638 el claim del slot no vuelve a mirar si otra cabeza cubre `start`. governor.go:117-124 es un envío bloqueante a g.sem (cola FIFO). Único caller de runHead: pipeline.go:299 y :510; Acquire solo se usa en pipeline.go:560 (Grep).
- Nota de aplicación: línea real 625 (desfase -1); línea real 558 (desfase -1); línea real 461 (desfase -1)

#### OP-20 · Contenedor cacheado como transcode en vivo no se invalida cuando termina la pre-transcodificación

- **Severidad:** Media · **Tipo:** Optimización · **Verificación:** mecánica + revisión manual
- **Problema:** newMediaContainer reutiliza un MediaContainer cacheado si coincide el tipo pedido, y buildMediaContainer es el único lugar que consulta PreTranscoder.Ready. Un archivo reproducido en vivo antes de terminar su pre-transcode (que PreloadPlayback encola justamente para el próximo play) sigue sirviéndose por transcode en vivo en cada reproducción posterior hasta reiniciar el módulo.

**OP-20.1 — Archivo:** `internal/mediastream/playback.go` · **Líneas:** 276–277 · **Acción:** replace

ANTES:

```go
	return v.(*MediaContainer), nil
}
```

DESPUÉS:

```go
	return v.(*MediaContainer), nil
}

// preTranscodeFinished reports whether a container cached as a live transcode is outdated
// because the file has been pre-transcoded since. Containers live in the cache until the
// transcoder module is re-initialized and buildMediaContainer only looks for the pre-transcoded
// output when it builds one, so without this check a file played before its pre-transcode
// finished keeps being transcoded live on every later play.
func (p *PlaybackManager) preTranscodeFinished(mc *MediaContainer) bool {
	if mc.StreamType != StreamTypeTranscode || mc.MediaInfo == nil {
		return false
	}
	ptm, ok := p.repository.PreTranscoder()
	return ok && ptm.Ready(mc.Hash, len(mc.MediaInfo.Audios))
}
```

**OP-20.2 — Archivo:** `internal/mediastream/playback.go` · **Líneas:** 267–267 · **Acción:** replace

ANTES:

```go
		if mc, ok := p.mediaContainers.Get(cacheKey); ok && mc.StreamType == streamType {
```

DESPUÉS:

```go
		if mc, ok := p.mediaContainers.Get(cacheKey); ok && mc.StreamType == streamType && !p.preTranscodeFinished(mc) {
```

**OP-20.3 — Archivo:** `internal/mediastream/playback.go` · **Líneas:** 254–255 · **Acción:** replace

ANTES:

```go
	// Fast path: cache hit (lock-free read). Only reuse if the stream type matches.
	if mc, ok := p.mediaContainers.Get(cacheKey); ok && mc.StreamType == streamType {
```

DESPUÉS:

```go
	// Fast path: cache hit (lock-free read). Only reuse if the stream type matches and a
	// live-transcode container has not been outdated by a finished pre-transcode.
	if mc, ok := p.mediaContainers.Get(cacheKey); ok && mc.StreamType == streamType && !p.preTranscodeFinished(mc) {
```

- **Razón técnica:** La decisión "si existe la salida pre-transcodificada, servir HLS optimizado" (playback.go:340-355) se toma una sola vez al construir y se guarda en mediaContainers con la clave hash|caps. Esa caché solo se escribe en :387 y solo se vacía al reinicializar los módulos (repository.go:333 y :698); no hay invalidación al terminar un trabajo de pretranscode. Si el contenedor se cacheó como Transcode (pre-transcode aún no listo) y luego Ready pasa a true, `ok && mc.StreamType == streamType` sigue acertando y devuelve el contenedor viejo. Comprobar Ready (un os.Stat de master/audio, ya usado en el build) solo para contenedores Transcode obliga a reconstruirlo, y buildMediaContainer ya lo convierte a Optimized. La comprobación debe estar también en el re-check dentro del singleflight o este devolvería el mismo contenedor viejo.
- **Impacto esperado:** El usuario que ya tiene el episodio pre-transcodificado en disco (la función de precarga/pretranscode existe para eso) sigue pagando transcode en vivo (CPU/GPU, latencia de arranque, slots del governor) mientras el servidor no se reinicie.
- **Revisión manual (22/10):** Coherente: un contenedor cacheado como transcode en vivo se reconstruye cuando el pre-transcode ya terminó (un os.Stat extra por petición de contenedores Transcode cacheados).
- **Riesgos / a revisar:** Un os.Stat adicional por RequestPlayback/PreloadPlayback de contenedores Transcode cacheados. Tras la reconstrucción el contenedor pasa a Optimized y, como antes, un pedido posterior de tipo Transcode no acierta la caché por diferencia de tipo (comportamiento ya existente, no empeora).
- **Evidencia del hallazgo:** playback.go:255 y :267 (hit por tipo), :340-355 (única consulta a ptm.Ready), :387 (único Set), repository.go:333 y :698 (únicos Clear), :210-214 (PreTranscoder), pretranscode.go:160-169 (Ready), playback.go:173-179 (PreloadPlayback encola el pre-transcode para el siguiente play).

#### OP-21 · Extracción de adjuntos: el episodio en reproducción no pasa por delante de una precarga encolada

- **Severidad:** Media · **Tipo:** Optimización · **Verificación:** mecánica + revisión manual
- **Problema:** startAttachmentExtraction usa LoadOrStore por hash: si una precarga (priority=false) ya registró el trabajo y espera cupo en attachmentSemaphore (2 plazas), la llamada de RequestPlayback con priority=true devuelve sin hacer nada, y los endpoints de subtítulos/PGS esperan en WaitForExtraction detrás de la cola de otros archivos.

**OP-21.1 — Archivo:** `internal/mediastream/playback.go` · **Líneas:** 454–457 · **Acción:** replace

ANTES:

```go
	ch := v.(chan struct{})
	select {
	case <-ch:
		return nil
```

DESPUÉS:

```go
	job := v.(*extractionJob)
	select {
	case <-job.done:
		return nil
```

**OP-21.2 — Archivo:** `internal/mediastream/playback.go` · **Líneas:** 404–418 · **Acción:** replace

ANTES:

```go
	ch := make(chan struct{})
	actual, loaded := p.extractionJobs.LoadOrStore(hash, ch)
	if loaded {
		// Another request already started (or finished) extraction for this hash.
		_ = actual
		return
	}

	go func() {
		defer close(ch)

		if !priority {
			attachmentSemaphore <- struct{}{}
			defer func() { <-attachmentSemaphore }()
		}
```

DESPUÉS:

```go
	job := &extractionJob{done: make(chan struct{}), promote: make(chan struct{})}
	actual, loaded := p.extractionJobs.LoadOrStore(hash, job)
	if loaded {
		// Another request already started (or finished) extraction for this hash. If it is
		// still queued behind the preload semaphore and the episode is now being played, let
		// it start at once: the subtitle/PGS endpoints are waiting on it.
		if priority {
			actual.(*extractionJob).promoteNow()
		}
		return
	}

	go func() {
		defer close(job.done)

		if !priority {
			select {
			case attachmentSemaphore <- struct{}{}:
				defer func() { <-attachmentSemaphore }()
			case <-job.promote:
			}
		}
```

**OP-21.3 — Archivo:** `internal/mediastream/playback.go` · **Líneas:** 392–396 · **Acción:** replace

ANTES:

```go
// startAttachmentExtraction launches (at most once per hash) the ffmpeg demux that
// writes embedded subtitles and fonts to the cache. The registered channel is closed
// when extraction succeeds so waiters can proceed; on failure the entry is removed so
// a subsequent request can retry. priority=false routes the work through the global
// attachmentSemaphore (preloads), priority=true bypasses it (the episode being played).
```

DESPUÉS:

```go
// extractionJob is one attachment extraction in flight for a file hash.
type extractionJob struct {
	// done is closed when the job ends.
	done chan struct{}

	// promote is closed when the episode being played needs a job that is still queued behind
	// the preload semaphore, so it starts at once instead of waiting for other files' jobs.
	promote     chan struct{}
	promoteOnce sync.Once
}

func (j *extractionJob) promoteNow() {
	j.promoteOnce.Do(func() { close(j.promote) })
}

// startAttachmentExtraction launches (at most once per hash) the ffmpeg demux that
// writes embedded subtitles and fonts to the cache. The job's done channel is closed
// when it ends so waiters can proceed; on failure the entry is removed so
// a subsequent request can retry. priority=false routes the work through the global
// attachmentSemaphore (preloads), priority=true bypasses it (the episode being played),
// including a job a preload registered first that is still waiting for a slot.
```

**OP-21.4 — Archivo:** `internal/mediastream/playback.go` · **Líneas:** 64–68 · **Acción:** replace

ANTES:

```go
		// Tracks in-flight attachment/subtitle extractions keyed by file hash. The value
		// is a chan struct{} that is closed when extraction finishes successfully; on
		// failure the entry is deleted so a later request can retry. The subtitles/PGS
		// endpoints block on this (WaitForExtraction) instead of racing an empty dir.
		extractionJobs sync.Map // hash -> chan struct{}
```

DESPUÉS:

```go
		// Tracks in-flight attachment/subtitle extractions keyed by file hash. The value
		// is an *extractionJob whose done channel is closed when the job ends; on
		// failure the entry is deleted so a later request can retry. The subtitles/PGS
		// endpoints block on this (WaitForExtraction) instead of racing an empty dir.
		extractionJobs sync.Map // hash -> *extractionJob
```

- **Razón técnica:** La prioridad solo se aplica al crear el trabajo. El flujo normal (pasar el mouse por un episodio y luego reproducirlo) registra primero el trabajo con priority=false; cuando llega RequestPlayback (priority=true) el LoadOrStore ya cargó y la función retorna ignorando `priority`. El trabajo sigue esperando `attachmentSemaphore <- struct{}{}` detrás de las extracciones de otros archivos (cada una es un ffmpeg que demuxa el MKV entero). Con un canal `promote` que la goroutine escucha junto al semáforo, el trabajo encolado arranca de inmediato cuando se reproduce. extractionJobs solo lo usan playback.go y WaitForExtraction (Grep), así que el cambio de tipo del valor es local.
- **Impacto esperado:** Subtítulos y fuentes del episodio que se está viendo (endpoints de attachments.go) quedan bloqueados detrás de hasta N extracciones de archivos que el usuario solo sobrevoló; el comentario de diseño ("priority=true bypasses it") no se cumple en el caso más común.
- **Revisión manual (22/10):** Coherente: el episodio en reproducción promueve un trabajo de extracción que esperaba en el semáforo de precargas; puede haber una extracción más en paralelo que el tope de 2, solo para ese episodio. Conviene probarlo con precarga + reproducción simultáneas.
- **Riesgos / a revisar:** Un trabajo promovido corre sin tomar plaza del semáforo, así que puede haber una extracción más en paralelo que el tope de 2 (solo del episodio en reproducción, como ya ocurre con los creados con priority=true). No hay otros usuarios de extractionJobs ni pruebas que lo toquen.
- **Evidencia del hallazgo:** playback.go:20 (attachmentSemaphore cap 2), :136 (RequestPlayback priority=true), :162 (PreloadPlayback priority=false), :405-410 (LoadOrStore loaded -> `_ = actual; return`), :415-418 (espera bloqueante en el semáforo), :447-460 (WaitForExtraction); attachments.go:46,94,165 esperan en ese canal. Grep de extractionJobs: solo playback.go.
- Nota de aplicación: línea real 468 (desfase 14); línea real 418 (desfase 14); línea real 406 (desfase 14)

#### OP-22 · Metodo A (AnimeThemes): los episodios se huellan en serie mientras el Metodo B usa un pool de workers

- **Severidad:** Media · **Tipo:** Optimización · **Verificación:** mecánica + revisión manual
- **Problema:** animeThemesScan recorre `need` en un bucle secuencial, y por episodio lanza dos pipelines ffmpeg|fpcalc (390 s de OP y 480 s de ED); crossEpisodeScan, en cambio, reparte el mismo tipo de trabajo entre min(NumCPU,4) workers. Al ser el metodo primario, una serie larga tarda ~N veces mas de lo necesario.

**OP-22.1 — Archivo:** `internal/skipdetect/animethemes_match.go` · **Líneas:** 3–8 · **Acción:** replace

ANTES:

```go
import (
	"context"
	"path/filepath"
	"strconv"
	"strings"
)
```

DESPUÉS:

```go
import (
	"context"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"sync"
)
```

**OP-22.2 — Archivo:** `internal/skipdetect/animethemes_match.go` · **Líneas:** 71–74 · **Acción:** replace

ANTES:

```go
	// Cache de fingerprints de themes por URL de audio (dedupe de descargas).
	fpCache := make(map[string]*themeFingerprint)
	themeFP := func(t Theme) *themeFingerprint {
		if tf, ok := fpCache[t.AudioURL]; ok {
```

DESPUÉS:

```go
	// Cache de fingerprints de themes por URL de audio (dedupe de descargas). Los workers
	// de mas abajo la comparten: fpCacheMu serializa la descarga/huella de cada theme para
	// que el mismo audio no se baje dos veces en paralelo.
	var fpCacheMu sync.Mutex
	fpCache := make(map[string]*themeFingerprint)
	themeFP := func(t Theme) *themeFingerprint {
		fpCacheMu.Lock()
		defer fpCacheMu.Unlock()
		if tf, ok := fpCache[t.AudioURL]; ok {
```

**OP-22.3 — Archivo:** `internal/skipdetect/animethemes_match.go` · **Líneas:** 94–139 · **Acción:** replace

ANTES:

```go
	results := make(map[int]detResult)
	for epNum := range need {
		select {
		case <-ctx.Done():
			return results
		default:
		}
		ep, ok := byNum[epNum]
		if !ok {
			continue
		}

		var r detResult

		// ── OP ──
		// Vía ffmpeg (no fpcalc directo) porque fpcalc no sabe elegir track de
		// audio y en archivos multi-audio hay que huellar el japonés.
		if epFP, _, err := FingerprintRangeCached(ctx, d.cacheDir, fpcalcBin, d.ffmpegPath, ep.Path, ep.inputPath(), 0, athEpisodeProbeSec, ep.AudioIdx); err == nil {
			if start, end, score, ok := bestThemeMatch(epFP, 0, opThemes, epNum, themeFP); ok && ValidOpWindow(start, end) {
				r.OpStart = start
				r.OpEnd = end
				r.Confidence = athConfidence(score)
				r.Source = "animethemes"
			}
		}

		// ── ED ──
		if athMatchED && len(edThemes) > 0 {
			windowStart := ep.Duration - athOutroProbeSec
			if edFP, _, err := FingerprintRangeCached(ctx, d.cacheDir, fpcalcBin, d.ffmpegPath, ep.Path, ep.inputPath(), windowStart, athOutroProbeSec, ep.AudioIdx); err == nil {
				if start, end, score, ok := bestThemeMatch(edFP, windowStart, edThemes, epNum, themeFP); ok && ValidEdWindow(start, end, ep.Duration) {
					r.EdOffset = start
					r.EdEnd = end
					if r.Source == "" {
						r.Confidence = athConfidence(score)
						r.Source = "animethemes"
					}
				}
			}
		}

		if r.OpEnd > 0 || r.EdOffset > 0 {
			results[epNum] = r
		}
	}
	return results
```

DESPUÉS:

```go
	results := make(map[int]detResult)
	var resultsMu sync.Mutex

	// scanEpisode huella la ventana de OP y la de ED de un episodio y las correlaciona
	// contra los themes. Es la unidad de trabajo de cada worker.
	scanEpisode := func(ep episodeFile) {
		epNum := ep.EpisodeNumber
		var r detResult

		// ── OP ──
		// Vía ffmpeg (no fpcalc directo) porque fpcalc no sabe elegir track de
		// audio y en archivos multi-audio hay que huellar el japonés.
		if epFP, _, err := FingerprintRangeCached(ctx, d.cacheDir, fpcalcBin, d.ffmpegPath, ep.Path, ep.inputPath(), 0, athEpisodeProbeSec, ep.AudioIdx); err == nil {
			if start, end, score, ok := bestThemeMatch(epFP, 0, opThemes, epNum, themeFP); ok && ValidOpWindow(start, end) {
				r.OpStart = start
				r.OpEnd = end
				r.Confidence = athConfidence(score)
				r.Source = "animethemes"
			}
		}

		// ── ED ──
		if athMatchED && len(edThemes) > 0 {
			windowStart := ep.Duration - athOutroProbeSec
			if edFP, _, err := FingerprintRangeCached(ctx, d.cacheDir, fpcalcBin, d.ffmpegPath, ep.Path, ep.inputPath(), windowStart, athOutroProbeSec, ep.AudioIdx); err == nil {
				if start, end, score, ok := bestThemeMatch(edFP, windowStart, edThemes, epNum, themeFP); ok && ValidEdWindow(start, end, ep.Duration) {
					r.EdOffset = start
					r.EdEnd = end
					if r.Source == "" {
						r.Confidence = athConfidence(score)
						r.Source = "animethemes"
					}
				}
			}
		}

		if r.OpEnd > 0 || r.EdOffset > 0 {
			resultsMu.Lock()
			results[epNum] = r
			resultsMu.Unlock()
		}
	}

	// Mismo tamano de pool que el Metodo B (crossEpisodeScan): cada episodio son dos
	// pipelines ffmpeg|fpcalc independientes de baja prioridad.
	epChan := make(chan episodeFile, len(need))
	for epNum := range need {
		if ep, ok := byNum[epNum]; ok {
			epChan <- ep
		}
	}
	close(epChan)

	numWorkers := runtime.NumCPU()
	if numWorkers > 4 {
		numWorkers = 4
	}
	if numWorkers < 2 {
		numWorkers = 2
	}
	if len(epChan) < numWorkers {
		numWorkers = len(epChan)
	}

	var wg sync.WaitGroup
	for i := 0; i < numWorkers; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for ep := range epChan {
				select {
				case <-ctx.Done():
					return
				default:
				}
				scanEpisode(ep)
			}
		}()
	}
	wg.Wait()
	return results
```

- **Razón técnica:** El bucle original (animethemes_match.go:95-138) procesa un episodio por vez; cada iteracion decodifica 390 s + 480 s de audio por ffmpeg y los pasa por fpcalc, y es el camino primario de ScanSeries (detector.go:287-301). crossEpisodeScan (crossepisode.go:62-116) ya reparte exactamente este tipo de trabajo entre un pool acotado a 4, de modo que paralelizar aqui no introduce un perfil de carga nuevo (los procesos ya corren con NewCmdCtxLowPriority). Cada episodio es independiente: lee solo su archivo, escribe su propia entrada de results y consulta el mapa fpCache de themes, que pasa a estar protegido con fpCacheMu. Se mantiene la semantica de cancelacion (al cancelarse el contexto se devuelve lo acumulado) y el dedupe de descargas de themes (la descarga/huella queda serializada bajo el mutex y los demas workers reutilizan el resultado cacheado, incluida la entrada nil de fallo).
- **Impacto esperado:** Para una serie de N episodios pendientes el tiempo del Metodo A pasa de N*(t_OP+t_ED) a ~N/k*(t_OP+t_ED) con k=min(NumCPU,4); en un scan de biblioteca completa (ScanLibrary, hasta 30 min por serie, perSeriesScanTimeout) es la diferencia entre acercarse al tope o no, y en Drive solapa la latencia de red de las lecturas de rango. Los resultados son los mismos.
- **Revisión manual (22/10):** Correcto salvo una recomendación: los workers paralelos comparten fpCache bajo un mutex; envolver scanEpisode con util.HandlePanicInModuleThen para conservar el blindaje contra pánicos que tenía el bucle serie. Sube la carga de CPU durante el escaneo al nivel del Método B.
- **Riesgos / a revisar:** Una panic dentro de un worker ya no la atrapa el recover del goroutine que llama (igual que en crossEpisodeScan, cuyos workers tampoco tienen recover): conviene envolver scanEpisode con util.HandlePanicInModuleThen si se quiere el mismo blindaje que el bucle original. Sube la carga de CPU durante el scan al nivel del Metodo B (4 pipelines simultaneos, prioridad baja). Revisar que ningun fake de AnimeThemesClient en pruebas asuma llamadas no concurrentes: DownloadAudio queda serializado por fpCacheMu, GetThemesByMALID se llama una sola vez antes.
- **Evidencia del hallazgo:** animethemes_match.go:94-139 (bucle `for epNum := range need` secuencial) frente a crossepisode.go:62-116 (pool de workers con `runtime.NumCPU()` acotado 2..4); detector.go:296 es el unico caller de animeThemesScan; fpCache es un map plano capturado por el closure themeFP (animethemes_match.go:72-92) y bestThemeMatch lo invoca por tema (147-153).
- Nota de aplicación: línea real 73 (desfase 2); línea real 101 (desfase 7)

#### OP-23 · HydrateMetadata usa lop.GroupBy: una goroutine por archivo local solo para leer MediaID

- **Severidad:** Baja · **Tipo:** Optimización · **Verificación:** mecánica
- **Problema:** samber/lo/parallel.GroupBy (v1.53.0) delega en lop.Map, que lanza una goroutine por elemento; aquí la función iteratee es `localFile.MediaID`, por lo que el paralelismo solo agrega costo.

**OP-23.1 — Archivo:** `internal/library/scanner/hydrator.go` · **Líneas:** 65–65 · **Acción:** replace

ANTES:

```go
	groups := lop.GroupBy(fh.LocalFiles, func(localFile *dto.LocalFile) int {
```

DESPUÉS:

```go
	groups := lo.GroupBy(fh.LocalFiles, func(localFile *dto.LocalFile) int {
```

**OP-23.2 — Archivo:** `internal/library/scanner/hydrator.go` · **Líneas:** 22–22 · **Acción:** delete-lines

ANTES:

```go
	lop "github.com/samber/lo/parallel"
```

DESPUÉS: _(se elimina el bloque)_

- **Razón técnica:** En lo@v1.53.0 (go.mod del servidor), parallel/slice.go:73-85 implementa GroupBy como `keys := Map(collection, ...)` con Map paralelo (una goroutine y WaitGroup por elemento) y luego agrupa de forma secuencial. Con 10-20 mil archivos locales se crean esa cantidad de goroutines (con sus stacks) en cada escaneo solo para leer un campo entero. lo.GroupBy (ya importado en este archivo, y usado con la misma firma en media_fetcher.go) devuelve el mismo mapa con el mismo orden por grupo, porque la versión paralela ya agrupaba de forma secuencial en el orden de la colección.
- **Impacto esperado:** Evita decenas de miles de goroutines/estacks efímeros por escaneo (HydrateMetadata corre en cada escaneo, incluidos los disparados por el watcher); mismo resultado.
- **Riesgos / a revisar:** Tras quitar el import `lop`, `lo` sigue en uso (lo.Find en hydrator.go:124). Aplicar primero el edit de la línea 65 y luego borrar la 22 (numeración original).
- **Evidencia del hallazgo:** hydrator.go:65-67 (lop.GroupBy con iteratee trivial); único uso de `lop.` en el archivo (la mención de la línea 500 es un comentario); lo@v1.53.0/parallel/slice.go:73-85 leído desde el módulo local; media_fetcher.go:97 usa lo.GroupBy con la misma forma.

#### OP-24 · initLibraryWatcher/parseNfoEntries: hasta 4 stat por archivo para NFO, 3 de ellos idénticos para todos los episodios de la carpeta

- **Severidad:** Baja · **Tipo:** Optimización · **Verificación:** mecánica + revisión manual
- **Problema:** Para cada archivo aún sin matchear, cada worker hace FileExists sobre [archivo].nfo, tvshow.nfo, anime.nfo y movie.nfo, repitiendo los 3 de carpeta por cada episodio de la misma carpeta.

**OP-24.1 — Archivo:** `internal/library/scanner/scanner_phases.go` · **Líneas:** 192–192 · **Acción:** replace

ANTES:

```go
	var nfoFolderClaimed sync.Map // folder path → true
```

DESPUÉS:

```go
	var nfoFolderClaimed sync.Map // folder path → true

	// folderNfoCache memoriza qué NFO de carpeta existen en cada directorio (folder path →
	// []string): cientos de episodios comparten carpeta y cada uno repetía los mismos stat.
	var folderNfoCache sync.Map
```

**OP-24.2 — Archivo:** `internal/library/scanner/scanner_phases.go` · **Líneas:** 226–247 · **Acción:** replace

ANTES:

```go
				lfDir := filepath.Dir(lf.Path)

				// Typical Kodi NFO paths
				nfoPaths := []string{
					util.ReplaceExtension(lf.Path, ".nfo"), // [filename].nfo (Per-file NFO takes priority)
					filepath.Join(lfDir, "tvshow.nfo"),
					filepath.Join(lfDir, "anime.nfo"),
					filepath.Join(lfDir, "movie.nfo"),
				}

				for _, nfoPath := range nfoPaths {
					if !filesystem.FileExists(nfoPath) {
						continue
					}
					// NFO de carpeta ya reclamado por otro episodio: parsearlo de nuevo por cada
					// archivo (cientos por serie) solo para descartarlo después.
					if !strings.EqualFold(nfoPath, nfoPaths[0]) {
						if _, claimed := nfoFolderClaimed.Load(lfDir); claimed {
							break
						}
					}
					nfo, err := ParseNfoFile(nfoPath)
```

DESPUÉS:

```go
				lfDir := filepath.Dir(lf.Path)

				// [filename].nfo (el NFO por archivo tiene prioridad) y después los NFO de
				// carpeta típicos de Kodi que existan en este directorio.
				perFileNfo := util.ReplaceExtension(lf.Path, ".nfo")
				nfoPaths := make([]string, 0, 4)
				if filesystem.FileExists(perFileNfo) {
					nfoPaths = append(nfoPaths, perFileNfo)
				}
				nfoPaths = append(nfoPaths, folderNfoPaths(&folderNfoCache, lfDir)...)

				for _, nfoPath := range nfoPaths {
					// NFO de carpeta ya reclamado por otro episodio: parsearlo de nuevo por cada
					// archivo (cientos por serie) solo para descartarlo después.
					if !strings.EqualFold(nfoPath, perFileNfo) {
						if _, claimed := nfoFolderClaimed.Load(lfDir); claimed {
							break
						}
					}
					nfo, err := ParseNfoFile(nfoPath)
```

**OP-24.3 — Archivo:** `internal/library/scanner/scanner_phases.go` · **Líneas:** 297–298 · **Acción:** replace

ANTES:

```go
	return nfoEntries
}
```

DESPUÉS:

```go
	return nfoEntries
}

// folderNfoPaths devuelve los NFO de carpeta típicos de Kodi que existen en dir, en orden de
// prioridad. El resultado se memoriza en cache (por dir) durante una pasada de parseNfoEntries.
func folderNfoPaths(cache *sync.Map, dir string) []string {
	if v, ok := cache.Load(dir); ok {
		return v.([]string)
	}
	var found []string
	for _, name := range [...]string{"tvshow.nfo", "anime.nfo", "movie.nfo"} {
		p := filepath.Join(dir, name)
		if filesystem.FileExists(p) {
			found = append(found, p)
		}
	}
	cache.Store(dir, found)
	return found
}
```

- **Razón técnica:** La secuencia de NFO que se intenta parsear es idéntica (per-file primero, luego tvshow/anime/movie solo si existen, con el mismo `break` al estar la carpeta reclamada), pero la existencia de los tres NFO de carpeta se resuelve una vez por directorio dentro de la pasada en vez de una por archivo. En una biblioteca sin NFO (lo habitual en anime) cada archivo pasa de 4 a 1 syscall de stat y se agregan 3 por carpeta distinta. FileExists se sigue usando, así que la semántica ante errores distintos de NotExist no cambia. El cache vive solo durante una llamada a parseNfoEntries (variable local), por lo que no hay datos rancios entre escaneos.
- **Impacto esperado:** Reduce aproximadamente 3 de cada 4 syscalls de stat de la fase NFO en la primera pasada o con muchos archivos sin matchear (cientos de episodios por carpeta); más notorio sobre discos de red o FUSE donde cada stat cuesta ms.
- **Revisión manual (22/10):** Corregido al aplicarlo: el ancla del tercer edit era una llave '}' ambigua (115 coincidencias) y se eligió una equivocada; ahora es 'return nfoEntries' + llave de cierre, única en el archivo.
- **Riesgos / a revisar:** Aplicar los tres edits de abajo hacia arriba (298, 226-247, 192) porque la numeración es la del archivo original. Dos workers pueden calcular a la vez el mismo directorio (resultado idéntico, sin daño). El ancla del tercer edit es "return nfoEntries" + llave de cierre (una llave sola era ambigua).
- **Evidencia del hallazgo:** scanner_phases.go:222 (solo se procesan archivos con LibraryMediaId == 0 && MediaID == 0), :229-239 (4 rutas y FileExists por cada una, para cada archivo), :242-246 (el break por carpeta reclamada solo evita el parseo, no los stat previos). filesystem/mediapath.go:88-91 (FileExists = os.Stat). `util`, `filesystem`, `filepath`, `strings` y `sync` ya están importados en scanner_phases.go.
- Nota de aplicación: línea real 230 (desfase 4); línea real 299 (desfase 2)

#### OP-25 · loadEpisodes lanza dos ffprobe por archivo (duracion y pista de audio) sobre la misma entrada

- **Severidad:** Baja · **Tipo:** Optimización · **Verificación:** mecánica + revisión manual
- **Problema:** Cuando falta la duracion y no hay AudioStreams en TechnicalInfo, loadEpisodes ejecuta ffprobe.ProbeURL para la duracion y luego preferredAudioIndex vuelve a ejecutar ffprobe.ProbeURL sobre el mismo input; un solo ProbeData contiene Format y Streams. Ademas los archivos indexados desde Drive nunca traen AudioStreams (IndexDriveFiles solo rellena Size/Duration/VideoStream), por lo que siempre caen en la rama del segundo probe.

**OP-25.1 — Archivo:** `internal/skipdetect/detector.go` · **Líneas:** 78–98 · **Acción:** replace

ANTES:

```go
func preferredAudioIndex(ctx context.Context, path string) int {
	probeCtx, cancel := context.WithTimeout(ctx, 15*time.Second)
	defer cancel()

	data, err := ffprobe.ProbeURL(probeCtx, path)
	if err != nil {
		return -1
	}

	audioIdx := 0
	for _, s := range data.Streams {
		if s.CodecType != "audio" {
			continue
		}
		if japaneseLangTags[strings.ToLower(strings.TrimSpace(s.Tags.Language))] {
			return audioIdx
		}
		audioIdx++
	}
	return -1
}
```

DESPUÉS:

```go
func preferredAudioIndex(ctx context.Context, path string) int {
	probeCtx, cancel := context.WithTimeout(ctx, 15*time.Second)
	defer cancel()

	data, err := ffprobe.ProbeURL(probeCtx, path)
	if err != nil {
		return -1
	}
	return japaneseAudioIndex(data)
}

// japaneseAudioIndex devuelve el indice (relativo a los streams de audio) del primer
// track japones de un ffprobe ya hecho, o -1 si no hay ninguno. Permite reutilizar un
// unico ffprobe para la duracion y para elegir el track.
func japaneseAudioIndex(data *ffprobe.ProbeData) int {
	audioIdx := 0
	for _, s := range data.Streams {
		if s.CodecType != "audio" {
			continue
		}
		if japaneseLangTags[strings.ToLower(strings.TrimSpace(s.Tags.Language))] {
			return audioIdx
		}
		audioIdx++
	}
	return -1
}
```

**OP-25.2 — Archivo:** `internal/skipdetect/detector.go` · **Líneas:** 355–375 · **Acción:** replace

ANTES:

```go
		if duration == 0 {
			probeCtx, cancel := context.WithTimeout(ctx, 15*time.Second)
			if data, perr := ffprobe.ProbeURL(probeCtx, input); perr == nil {
				duration = data.Format.DurationSeconds
			}
			cancel()
		}
		if duration == 0 {
			duration = 1440.0 // default 24 min si el probe falla
		}
		audioIdx := -1
		if lf.TechnicalInfo != nil && len(lf.TechnicalInfo.AudioStreams) > 0 {
			for aIdx, as := range lf.TechnicalInfo.AudioStreams {
				if as != nil && japaneseLangTags[strings.ToLower(strings.TrimSpace(as.Language))] {
					audioIdx = aIdx
					break
				}
			}
		} else {
			audioIdx = preferredAudioIndex(ctx, input)
		}
```

DESPUÉS:

```go
		hasAudioInfo := lf.TechnicalInfo != nil && len(lf.TechnicalInfo.AudioStreams) > 0
		// Un unico ffprobe resuelve duracion y track de audio: antes eran dos por archivo
		// (en Drive, cada uno abre la URL de loopback y lee cabeceras por la red).
		var probed *ffprobe.ProbeData
		if duration == 0 || !hasAudioInfo {
			probeCtx, cancel := context.WithTimeout(ctx, 15*time.Second)
			if data, perr := ffprobe.ProbeURL(probeCtx, input); perr == nil {
				probed = data
			}
			cancel()
		}
		if duration == 0 && probed != nil {
			duration = probed.Format.DurationSeconds
		}
		if duration == 0 {
			duration = 1440.0 // default 24 min si el probe falla
		}
		audioIdx := -1
		if hasAudioInfo {
			for aIdx, as := range lf.TechnicalInfo.AudioStreams {
				if as != nil && japaneseLangTags[strings.ToLower(strings.TrimSpace(as.Language))] {
					audioIdx = aIdx
					break
				}
			}
		} else if probed != nil {
			audioIdx = japaneseAudioIndex(probed)
		}
```

- **Razón técnica:** ffprobe.ProbeURL devuelve Format y Streams en una sola ejecucion (go-ffprobe v2.3.0, ffprobe.go:23, y valida que Format != nil en 83, por lo que probed.Format.DurationSeconds es seguro como en el codigo original). El bucle de loadEpisodes es secuencial y cada probe tiene 15 s de timeout; con rutas gdrive:// el input es la URL de loopback del propio servidor, de modo que cada ffprobe dispara lecturas de rango contra Drive (cabecera/moov), consumiendo latencia y cuota. Fusionar los dos probes conserva los resultados: duracion desde Format, track japones desde Streams, -1 si el probe falla. preferredAudioIndex se mantiene (misma firma) porque lo usa fpcalc_test.go:124 y :143.
- **Impacto esperado:** Reduce a la mitad los ffprobe de la fase previa de cada scan para los archivos sin duracion ni pistas en TechnicalInfo (locales sin sondear y Drive sin videoMediaMetadata); en el resto mantiene un solo probe como hoy.
- **Revisión manual (22/10):** Correcto: un único ffprobe resuelve duración y pista japonesa. preferredAudioIndex queda solo con uso de pruebas; si el probe falla una vez ya no hay segundo intento para el audio.
- **Riesgos / a revisar:** Tras el cambio preferredAudioIndex queda con un uso solo de pruebas (el linter 'unused' en modo estricto de tests lo marcaria); si se prefiere, migrar fpcalc_test.go a japaneseAudioIndex o eliminar la funcion y ajustar esas dos pruebas. Si el unico probe fallara de forma transitoria ya no hay un segundo intento para el audio (antes un fallo del primero no impedia que el segundo acertara).
- **Evidencia del hallazgo:** detector.go:355-375 (ProbeURL de duracion y luego preferredAudioIndex -> ProbeURL en 78-98); indexer.go:364-377 (tech de Drive: Size, Duration y VideoStream, sin AudioStreams -> siempre rama else); Grep: preferredAudioIndex solo se llama en detector.go:374 y en fpcalc_test.go:124,143.
- Nota de aplicación: línea real 361 (desfase 6)

### Fase 3: Robustez, contextos y recursos

#### RB-01 · Cache de local files: lectura sin lock desde otro paquete y carga rancia tras invalidar

- **Severidad:** Media · **Tipo:** Robustez · **Verificación:** mecánica + revisión manual
- **Problema:** intelligence.go lee la variable global exportada db.CurrLocalFiles sin tomar localFilesMutex, mientras GetLocalFiles/InvalidateLocalFilesCache la escriben (carrera de datos sobre un mo.Option de dos campos). Ademas, una carga en vuelo puede publicar en la cache datos leidos antes de una escritura que ya invalido, dejando la cache rancia hasta la proxima invalidacion.

**RB-01.1 — Archivo:** `internal/database/db/localfiles.go` · **Líneas:** 1–49 · **Acción:** replace

ANTES:

```go
package db

import (
	"errors"

	"kamehouse/internal/database/models"
	"kamehouse/internal/database/models/dto"
	"sync"

	"github.com/goccy/go-json"
	"github.com/samber/mo"
	"golang.org/x/sync/singleflight"
	"gorm.io/gorm"
)

var localFilesMutex sync.RWMutex
var CurrLocalFiles mo.Option[[]*dto.LocalFile]
var localFilesSingleFlight singleflight.Group

// GetLocalFiles will return the latest local files.
// The second return value (ID) is now legacy and returns 0 as we use relational storage.
func GetLocalFiles(d *Database) ([]*dto.LocalFile, uint, error) {
	localFilesMutex.RLock()
	if cached, ok := CurrLocalFiles.Get(); ok {
		localFilesMutex.RUnlock()
		return cached, 0, nil
	}
	localFilesMutex.RUnlock()

	val, err, _ := localFilesSingleFlight.Do("get_local_files", func() (interface{}, error) {
		// Re-check cache inside singleflight to avoid racing
		localFilesMutex.RLock()
		if cached, ok := CurrLocalFiles.Get(); ok {
			localFilesMutex.RUnlock()
			return cached, nil
		}
		localFilesMutex.RUnlock()

		lfs, err := GetAllLocalFilesRelational(d)
		if err != nil {
			return nil, err
		}

		localFilesMutex.Lock()
		CurrLocalFiles = mo.Some(lfs)
		localFilesMutex.Unlock()

		return lfs, nil
	})
```

DESPUÉS:

```go
package db

import (
	"errors"

	"kamehouse/internal/database/models"
	"kamehouse/internal/database/models/dto"
	"sync"
	"sync/atomic"

	"github.com/goccy/go-json"
	"golang.org/x/sync/singleflight"
	"gorm.io/gorm"
)

// localFilesCache es la ultima lista cargada (nil = sin cache). Se lee sin lock.
var localFilesCache atomic.Pointer[[]*dto.LocalFile]

// localFilesMu ordena a quien publica la cache frente a quien la invalida.
var localFilesMu sync.Mutex

// localFilesGen sube en cada invalidacion (bajo localFilesMu). Una carga que empezo antes de una
// escritura no debe publicar su resultado: podria ser anterior a ella y quedaria rancio.
var localFilesGen uint64
var localFilesSingleFlight singleflight.Group

// CachedLocalFiles devuelve la lista en memoria, si la hay, sin tocar la base ni tomar locks.
func CachedLocalFiles() ([]*dto.LocalFile, bool) {
	if p := localFilesCache.Load(); p != nil {
		return *p, true
	}
	return nil, false
}

// GetLocalFiles will return the latest local files.
// The second return value (ID) is now legacy and returns 0 as we use relational storage.
func GetLocalFiles(d *Database) ([]*dto.LocalFile, uint, error) {
	if cached, ok := CachedLocalFiles(); ok {
		return cached, 0, nil
	}

	val, err, _ := localFilesSingleFlight.Do("get_local_files", func() (interface{}, error) {
		// Re-check cache inside singleflight to avoid racing
		if cached, ok := CachedLocalFiles(); ok {
			return cached, nil
		}

		localFilesMu.Lock()
		gen := localFilesGen
		localFilesMu.Unlock()

		lfs, err := GetAllLocalFilesRelational(d)
		if err != nil {
			return nil, err
		}

		// Si una escritura invalido la cache mientras se leia la base, se devuelve lo leido
		// pero no se publica.
		localFilesMu.Lock()
		if localFilesGen == gen {
			localFilesCache.Store(&lfs)
		}
		localFilesMu.Unlock()

		return lfs, nil
	})
```

**RB-01.2 — Archivo:** `internal/database/db/localfiles.go` · **Líneas:** 64–69 · **Acción:** replace

ANTES:

```go
// InvalidateLocalFilesCache clears the in-memory local files cache.
func InvalidateLocalFilesCache() {
	localFilesMutex.Lock()
	CurrLocalFiles = mo.None[[]*dto.LocalFile]()
	localFilesMutex.Unlock()
}
```

DESPUÉS:

```go
// InvalidateLocalFilesCache clears the in-memory local files cache.
func InvalidateLocalFilesCache() {
	localFilesMu.Lock()
	localFilesGen++
	localFilesCache.Store(nil)
	localFilesMu.Unlock()
}
```

**RB-01.3 — Archivo:** `internal/database/db/localfiles.go` · **Líneas:** 73–85 · **Acción:** replace

ANTES:

```go
	localFilesMutex.RLock()
	if cached, ok := CurrLocalFiles.Get(); ok && cached != nil {
		localFilesMutex.RUnlock()
		var matched []*dto.LocalFile
		for _, f := range cached {
			if f != nil && f.MediaID == mediaID {
				matched = append(matched, f)
			}
		}
		d.Logger.Debug().Int("mediaID", mediaID).Int("count", len(matched)).Msg("db: Local files retrieved from in-memory cache by media ID")
		return matched, nil
	}
	localFilesMutex.RUnlock()
```

DESPUÉS:

```go
	if cached, ok := CachedLocalFiles(); ok && cached != nil {
		var matched []*dto.LocalFile
		for _, f := range cached {
			if f != nil && f.MediaID == mediaID {
				matched = append(matched, f)
			}
		}
		d.Logger.Debug().Int("mediaID", mediaID).Int("count", len(matched)).Msg("db: Local files retrieved from in-memory cache by media ID")
		return matched, nil
	}
```

**RB-01.4 — Archivo:** `internal/library/anime/intelligence.go` · **Líneas:** 304–304 · **Acción:** replace

ANTES:

```go
	if cached, ok := db.CurrLocalFiles.Get(); ok {
```

DESPUÉS:

```go
	if cached, ok := db.CachedLocalFiles(); ok {
```

- **Razón técnica:** CurrLocalFiles es un mo.Option (flag + slice) exportado y protegido por localFilesMutex, pero intelligence.go:304 lo lee sin ese lock: el compilador y el detector de carreras lo marcan, y una lectura rota puede ver isPresent=true con un slice vacio y armar un fileMap vacio (Continuar viendo sin episodios). Sustituir el par RWMutex+Option por atomic.Pointer deja la ruta de lectura (GetLocalFiles, GetLocalFilesByMediaID, intelligence) sin locks. El contador de generacion cierra una carrera real: UpsertLocalFileRelationalBatch/SyncLocalFilesRelational escriben y luego invalidan; si un GetLocalFiles (por ejemplo el polling de la UI durante un escaneo) ya habia empezado a leer la base, al terminar publicaba la lista vieja despues de la invalidacion y la cache quedaba rancia hasta el proximo escaneo.
- **Impacto esperado:** Elimina una carrera de datos en la ruta de Continuar viendo, hace lock-free las lecturas de la cache de archivos locales (se usa en las grillas y en cada ficha) y evita que la biblioteca muestre datos viejos tras un escaneo hasta el siguiente.
- **Revisión manual (22/10):** Correcto. La generación se captura antes de leer la base y solo se publica si no cambió; Store(nil) invalida; el único consumidor externo de CurrLocalFiles era intelligence.go. Elimina una carrera real sobre un mo.Option de dos campos.
- **Riesgos / a revisar:** Se elimina la variable exportada db.CurrLocalFiles y localFilesMutex: unico consumidor externo es intelligence.go:304 (verificado con Grep sobre todo apps/server, tests incluidos). Una carga cuya generacion cambio devuelve su resultado a quienes esperaban en el singleflight pero no lo cachea; la siguiente lectura vuelve a la base (comportamiento correcto). GetLocalFiles sigue devolviendo (slice, 0, error) igual que antes.
- **Evidencia del hallazgo:** Grep 'InvalidateLocalFilesCache|CurrLocalFiles|CurrMediaFillers' en apps/server: CurrLocalFiles solo aparece en localfiles.go y en internal/library/anime/intelligence.go:304 (lectura sin lock). Read de local_file_relational.go:100-144: UpsertLocalFileRelationalBatch hace la transaccion y recien despues InvalidateLocalFilesCache() (lineas 142, 224, 287), por lo que una carga iniciada antes del commit puede escribir la cache despues de la invalidacion. 'mo' solo se usaba en las lineas 17, 45 y 67 de localfiles.go (Read del resto del archivo hasta el final), por eso se retira ese import.
- Nota de aplicación: línea real 81 (desfase 17); línea real 91 (desfase 18); línea real 332 (desfase 28)

#### RB-02 · RemoveConn por id cierra la conexion WebSocket nueva cuando un cliente reconecta con el mismo id

- **Severidad:** Media · **Tipo:** Robustez · **Verificación:** mecánica + revisión manual
- **Problema:** AddConn reemplaza y cierra la conexion anterior de un mismo id, pero el handler viejo, al fallar su ReadMessage, llama RemoveConn(id), que borra y cierra por id: termina sacando la conexion NUEVA que ya lleva ese id. Lo mismo pasa con los fallos de escritura en SendEvent y SendEventTo, que tambien eliminan por id.

**RB-02.1 — Archivo:** `internal/events/websocket.go` · **Líneas:** 187–203 · **Acción:** replace

ANTES:

```go
// RemoveConn removes a websocket connection by ID and cleans up its subscribers.
func (m *WSEventManager) RemoveConn(id string) {
	m.connsMu.Lock()
	var connToClose *WSConn
	for i, conn := range m.Conns {
		if conn.ID == id {
			connToClose = conn
			m.Conns = append(m.Conns[:i], m.Conns[i+1:]...)
			break
		}
	}
	m.connsMu.Unlock()

	if connToClose != nil {
		_ = connToClose.Conn.Close()
	}
}
```

DESPUÉS:

```go
// RemoveConnIfSame quita y cierra la conexion registrada bajo id solo si sigue siendo conn.
// Un cliente que reconecta con el mismo id reemplaza (y cierra) la anterior en AddConn: el
// handler viejo, al fallar su lectura, o un envio fallido sobre ella no deben sacar ni
// cerrar la conexion nueva que ahora lleva ese id.
func (m *WSEventManager) RemoveConnIfSame(id string, conn *websocket.Conn) {
	m.connsMu.Lock()
	var connToClose *WSConn
	for i, c := range m.Conns {
		if c.ID == id && c.Conn == conn {
			connToClose = c
			m.Conns = append(m.Conns[:i], m.Conns[i+1:]...)
			break
		}
	}
	m.connsMu.Unlock()

	if connToClose != nil {
		_ = connToClose.Conn.Close()
	}
}
```

**RB-02.2 — Archivo:** `internal/events/websocket.go` · **Líneas:** 259–279 · **Acción:** replace

ANTES:

```go
	var deadConnsMu sync.Mutex
	var deadConns []string

	writeConn := func(c *WSConn) {
		c.writeMu.Lock()
		defer c.writeMu.Unlock()
		defer func() {
			if r := recover(); r != nil {
				m.Logger.Error().Interface("panic", r).Msg("ws: Recovered from panic in SendEvent write (possibly closed websocket)")
				deadConnsMu.Lock()
				deadConns = append(deadConns, c.ID)
				deadConnsMu.Unlock()
			}
		}()
		_ = c.Conn.SetWriteDeadline(time.Now().Add(2 * time.Second))
		if err := c.Conn.WriteMessage(websocket.TextMessage, data); err != nil {
			deadConnsMu.Lock()
			deadConns = append(deadConns, c.ID)
			deadConnsMu.Unlock()
		}
	}
```

DESPUÉS:

```go
	var deadConnsMu sync.Mutex
	var deadConns []*WSConn

	writeConn := func(c *WSConn) {
		c.writeMu.Lock()
		defer c.writeMu.Unlock()
		defer func() {
			if r := recover(); r != nil {
				m.Logger.Error().Interface("panic", r).Msg("ws: Recovered from panic in SendEvent write (possibly closed websocket)")
				deadConnsMu.Lock()
				deadConns = append(deadConns, c)
				deadConnsMu.Unlock()
			}
		}()
		_ = c.Conn.SetWriteDeadline(time.Now().Add(2 * time.Second))
		if err := c.Conn.WriteMessage(websocket.TextMessage, data); err != nil {
			deadConnsMu.Lock()
			deadConns = append(deadConns, c)
			deadConnsMu.Unlock()
		}
	}
```

**RB-02.3 — Archivo:** `internal/events/websocket.go` · **Líneas:** 299–301 · **Acción:** replace

ANTES:

```go
	for _, id := range deadConns {
		m.RemoveConn(id)
	}
```

DESPUÉS:

```go
	for _, dead := range deadConns {
		m.RemoveConnIfSame(dead.ID, dead.Conn)
	}
```

**RB-02.4 — Archivo:** `internal/events/websocket.go` · **Líneas:** 344–344 · **Acción:** replace

ANTES:

```go
		go m.RemoveConn(clientID)
```

DESPUÉS:

```go
		go m.RemoveConnIfSame(clientID, targetConn.Conn)
```

**RB-02.5 — Archivo:** `internal/handlers/websocket.go` · **Líneas:** 120–120 · **Acción:** replace

ANTES:

```go
			h.App.WSEventManager.RemoveConn(id)
```

DESPUÉS:

```go
			h.App.WSEventManager.RemoveConnIfSame(id, ws)
```

- **Razón técnica:** Cierre de recursos por identidad: cada handler debe liberar solo la conexion que el abrio. AddConn ya contempla explicitamente el reemplazo por id (saca la vieja del slice y llama oldConn.Conn.Close()), lo que hace que el ReadMessage del handler viejo falle justo despues; ese handler ejecuta RemoveConn(id) y, como busca por id, encuentra la conexion nueva y la cierra. El cliente nuevo ve su socket cerrado, reconecta y pierde los eventos del intervalo. RemoveConnIfSame compara tambien el puntero *websocket.Conn, de modo que solo se quita la conexion propia. Los dos unicos callers restantes de RemoveConn (SendEvent y SendEventTo) pasan al mismo metodo; RemoveConn deja de existir porque no tiene mas usos.
- **Impacto esperado:** Evita el cierre espurio de la conexion recien reconectada (ciclo extra de desconexion y reconexion, eventos perdidos y rafagas de logs) cada vez que un cliente reconecta con el mismo id mientras el handler anterior aun no termino. No cambia el comportamiento en el caso normal, sin reemplazo.
- **Revisión manual (22/10):** Correcto. AddConn ya cierra la conexión vieja, y el handler viejo, al fallar su lectura, ya no encuentra la nueva (el puntero difiere) en RemoveConnIfSame. Los tres sitios (handler, SendEvent, SendEventTo) comparten la misma identidad.
- **Riesgos / a revisar:** El bloque de SendEvent (lineas 259-279) y el bucle (299-301) deben aplicarse juntos: deadConns pasa de []string a []*WSConn. Al borrar RemoveConn hay que aplicar tambien los edits de SendEventTo (events/websocket.go:344) y del handler (handlers/websocket.go:120); de lo contrario no compila. Tras aplicar, correr go build ./... y go vet ./... y las pruebas de internal/events y internal/handlers (websocket_limit_test.go).
- **Evidencia del hallazgo:** Grep RemoveConn\( en apps/server: solo 4 apariciones (events/websocket.go:188 definicion, :300 SendEvent, :344 SendEventTo y handlers/websocket.go:120); ninguna en tests ni en la interfaz WSEventManagerInterface, y core/app.go:52 tipa WSEventManager como *events.WSEventManager concreto, asi que no hay mocks que romper. Lectura de AddConn (events/websocket.go:165-185): reemplaza por id y cierra oldConn. Lectura de handlers/websocket.go:98-122: AddConn(id, ws) y, en el error de ReadMessage, RemoveConn(id). apps/web/src/api/client/server-url.ts:38 conecta con ?id=<clientId>, o sea que el cliente reutiliza un id. El campo WSConn.Conn es *websocket.Conn (AddConn recibe *websocket.Conn), por eso la comparacion de punteros compila.
- Nota de aplicación: línea real 262 (desfase 3); línea real 302 (desfase 3); línea real 347 (desfase 3)

#### RB-03 · VideoProxy: la peticion upstream no esta ligada al contexto del cliente

- **Severidad:** Media · **Tipo:** Robustez · **Verificación:** mecánica + revisión manual
- **Problema:** VideoProxy arma la peticion con videoProxyClient2.R() sin SetContext, asi que si el cliente (HLS.js, <video>) cancela o cambia de segmento mientras el upstream tarda en responder, la conexion saliente sigue abierta hasta el timeout del cliente (60 s).
- ⚠ **Condicional:** Aplicar SOLO si NO se ejecuta DM-03 (que borra internal/handlers/proxy.go). Si se ejecuta DM-03, omitir este paso.

**RB-03.1 — Archivo:** `internal/handlers/proxy.go` · **Líneas:** 46–46 · **Acción:** replace

ANTES:

```go
	r := videoProxyClient2.R()
```

DESPUÉS:

```go
	r := videoProxyClient2.R().SetContext(c.Request().Context())
```

- **Razón técnica:** El cliente imroc/req construye la http.Request saliente con r.ctx (client.go:1768 req.WithContext(ctx)); sin SetContext usa context.Background(). El unico punto en el que el handler se entera de que el cliente se fue es un fallo de escritura en c.Stream, y mientras el upstream no envie cabeceras o bytes (origen lento, stall) la goroutine del handler y la conexion saliente quedan esperando hasta el SetTimeout de 60 s. Con SetContext, r.Get(url) vuelve en cuanto el cliente corta y el defer resp.Body.Close() libera la conexion; durante el streaming de cuerpo la lectura del upstream tambien se aborta de inmediato en vez de al proximo Write fallido. Se mantiene el timeout de 60 s como tope superior.
- **Impacto esperado:** Al hacer seek, cambiar de episodio o cerrar el reproductor sobre un stream proxificado, las peticiones pendientes al origen se abortan al instante en lugar de acumularse hasta 60 s cada una (con HLS.js se disparan decenas de segmentos). Menos conexiones y goroutines colgadas, y menos ancho de banda gastado en bytes que nadie leera.
- **Revisión manual (22/10):** Correcto (condicional a no ejecutar DM-03): cuando el cliente aborta, el upstream se cancela; puede aparecer ruido de log por el error de contexto.
- **Riesgos / a revisar:** Cuando el cliente aborta, el error de r.Get ahora es context.Canceled y el handler registra 'proxy: Error sending request' y devuelve 500 a una conexion ya cerrada; es ruido de log, no un cambio de comportamiento observable. No afecta a los playlists HLS (se leen completos dentro del mismo request).
- **Evidencia del hallazgo:** Read de proxy.go completo: r := videoProxyClient2.R() (:46) y resp, err := r.Get(url) (:68) sin contexto, mientras que el resto del codigo con net/http usa NewRequestWithContext (Grep NewRequestWithContext en internal: 19 sitios). Verificado en el modulo github.com/imroc/req/v3 v3.57.0 (go.mod:19): request.go:983 define (*Request).SetContext y client.go:1708/1768 lo aplica con req.WithContext(ctx) a la peticion saliente. Grep de imroc/req: otro uso en util/proxies/image_proxy.go, descartado (ver 'discarded').

#### RB-04 · Informe de diagnostico: la goroutine del zip queda bloqueada y con el log abierto si el cliente corta la descarga

- **Severidad:** Media · **Tipo:** Robustez · **Verificación:** mecánica + revisión manual
- **Problema:** HandleGetDiagnosticsReport escribe el zip en un io.Pipe desde una goroutine y entrega el lector a c.Stream, que solo hace io.Copy y nunca cierra el lector. Si el cliente se desconecta, el copy termina con error, nadie lee mas el pipe y la goroutine queda bloqueada para siempre en pw.Write, manteniendo abierto el archivo de log.

**RB-04.1 — Archivo:** `internal/handlers/system.go` · **Líneas:** 189–189 · **Acción:** replace

ANTES:

```go
	return c.Stream(200, "application/zip", pr)
```

DESPUÉS:

```go
	// Si el cliente corta la descarga, c.Stream deja de leer pero no cierra el lector: sin esto
	// la goroutine del zip quedaria bloqueada en pw.Write con el log abierto.
	defer pr.Close()
	return c.Stream(200, "application/zip", pr)
```

- **Razón técnica:** io.Pipe es sincrono y sin buffer: cada Write del escritor espera a un Read. echo.Context.Stream hace io.Copy(c.response, r) y retorna sin cerrar r. Ante un error de escritura al cliente el lector deja de consumirse y el escritor (la goroutine que arma el zip, en medio de io.Copy(f, logFile)) nunca vuelve. Cerrar pr con defer hace que pw.Write devuelva io.ErrClosedPipe, el io.Copy del log termine, se ejecute logFile.Close() y la goroutine salga por su defer. En el camino normal, pr.Close() tras el EOF es inocuo.
- **Impacto esperado:** Elimina una fuga de goroutine y de descriptor de archivo por cada descarga del informe de diagnostico abortada o con cliente lento. En Windows, un archivo de log retenido abierto tambien puede impedir rotarlo o borrarlo.
- **Revisión manual (22/10):** Correcto: cerrar el lector del pipe hace que el pw.Write de la goroutine devuelva io.ErrClosedPipe y termine, liberando el log abierto.
- **Riesgos / a revisar:** Ninguno funcional. El error de escritura de la goroutine queda en writeErr y se cierra el pipe con CloseWithError, como antes.
- **Evidencia del hallazgo:** Lectura de internal/handlers/system.go:81-190: pr, pw := io.Pipe(); la goroutine abre logs/latest.log (os.Open en la linea 112) y hace io.Copy(f, logFile) (linea 114); el handler hace return c.Stream(200, "application/zip", pr) sin ningun pr.Close(). Grep de io.Pipe( en internal: solo videofile/extract.go (cierra pwr con defer), skipdetect/fpcalc.go (cierra pr y pw en todas las ramas) y este handler, el unico que no cierra el lector. Echo v4 Stream = WriteHeader + io.Copy, sin Close del reader.

#### RB-05 · pretranscode: los ffprobe previos al ffmpeg ignoran la cancelacion del job

- **Severidad:** Media · **Tipo:** Robustez · **Verificación:** mecánica + revisión manual
- **Problema:** Manager.transcode(ctx, job) recibe el contexto que Cancel/Delete/Stop cancelan, pero probeDuration, probeStreams y probeDurationWithFfprobe cuelgan de context.Background() (30 s cada uno, mas 40 s del GetInfo cacheado). Cancelar o parar el manager durante la fase de sondeo no corta esos procesos.

**RB-05.1 — Archivo:** `internal/mediastream/pretranscode/pretranscode.go` · **Líneas:** 198–198 · **Acción:** replace

ANTES:

```go
		streams, probeErr := probeStreams(m.opts.FfprobePath, filePath)
```

DESPUÉS:

```go
		streams, probeErr := probeStreams(context.Background(), m.opts.FfprobePath, filePath)
```

**RB-05.2 — Archivo:** `internal/mediastream/pretranscode/pretranscode.go` · **Líneas:** 365–367 · **Acción:** replace

ANTES:

```go
	totalDuration := m.probeDuration(job.FilePath)

	src, err := probeStreams(m.opts.FfprobePath, job.FilePath)
```

DESPUÉS:

```go
	totalDuration := m.probeDuration(ctx, job.FilePath)

	src, err := probeStreams(ctx, m.opts.FfprobePath, job.FilePath)
```

**RB-05.3 — Archivo:** `internal/mediastream/pretranscode/pretranscode.go` · **Líneas:** 495–501 · **Acción:** replace

ANTES:

```go
func probeStreams(ffprobePath, filePath string) (sourceStreams, error) {
	if ffprobePath == "" {
		ffprobePath = "ffprobe"
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
```

DESPUÉS:

```go
func probeStreams(ctx context.Context, ffprobePath, filePath string) (sourceStreams, error) {
	if ffprobePath == "" {
		ffprobePath = "ffprobe"
	}

	ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()
```

**RB-05.4 — Archivo:** `internal/mediastream/pretranscode/pretranscode.go` · **Líneas:** 666–673 · **Acción:** replace

ANTES:

```go
func (m *Manager) probeDuration(filePath string) float64 {
	if m.opts.Extractor != nil && m.opts.FfprobePath != "" {
		if info, err := m.opts.Extractor.GetInfo(m.opts.FfprobePath, filePath); err == nil && info != nil && info.Duration > 0 {
			return float64(info.Duration)
		}
	}

	d, err := probeDurationWithFfprobe(m.opts.FfprobePath, filePath)
```

DESPUÉS:

```go
func (m *Manager) probeDuration(ctx context.Context, filePath string) float64 {
	if m.opts.Extractor != nil && m.opts.FfprobePath != "" {
		if info, err := m.opts.Extractor.GetInfoContext(ctx, m.opts.FfprobePath, filePath); err == nil && info != nil && info.Duration > 0 {
			return float64(info.Duration)
		}
	}

	d, err := probeDurationWithFfprobe(ctx, m.opts.FfprobePath, filePath)
```

**RB-05.5 — Archivo:** `internal/mediastream/pretranscode/pretranscode.go` · **Líneas:** 682–688 · **Acción:** replace

ANTES:

```go
func probeDurationWithFfprobe(ffprobePath string, filePath string) (float64, error) {
	if ffprobePath == "" {
		ffprobePath = "ffprobe"
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
```

DESPUÉS:

```go
func probeDurationWithFfprobe(ctx context.Context, ffprobePath string, filePath string) (float64, error) {
	if ffprobePath == "" {
		ffprobePath = "ffprobe"
	}

	ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()
```

**RB-05.6 — Archivo:** `internal/mediastream/pretranscode/pretranscode_integration_test.go` · **Líneas:** 167–167 · **Acción:** replace

ANTES:

```go
	got := m.probeDuration(src)
```

DESPUÉS:

```go
	got := m.probeDuration(t.Context(), src)
```

- **Razón técnica:** El resto del job ya respeta ctx (exec.CommandContext del ffmpeg, check de ctx.Err() al inicio, run() distingue cancelacion de fallo), pero los sondeos que lo preceden no. Con una ruta lenta (recurso de red, disco dormido) un Cancel/Delete/Stop espera hasta ~70 s de ffprobe (GetInfo 40 s + probeDuration 30 s + probeStreams 30 s) mientras el worker del pool sigue ocupado, y en Stop (cambio de ajustes o cierre) quedan procesos ffprobe huerfanos. Heredar ctx hace que esos procesos mueran con el job: exec.CommandContext mata el ffprobe en cuanto ctx se cancela. El tope de 30 s se mantiene con WithTimeout(ctx, ...). Enqueue (que corre bajo m.mu y no tiene ctx de job) conserva el comportamiento exacto con context.Background(). Si ctx ya esta cancelado, probeDuration cae a 0 (como ya hacia ante cualquier falla) y probeStreams devuelve error; run() ya clasifica ese caso como cancelacion por ctx.Err() != nil, no como fallo.
- **Impacto esperado:** Cancelar, borrar o parar un pre-transcode durante el sondeo libera el worker y los ffprobe de inmediato en lugar de tras 30-70 s. Evita ffprobe huerfanos al cambiar ajustes o apagar. Sin cambio de comportamiento en el camino feliz.
- **Revisión manual (22/10):** Correcto en probeStreams y probeDurationWithFfprobe (cancelan el proceso). Ver la salvedad de OP-11: GetInfoContext deja de esperar pero el ffprobe compartido sigue hasta 40 s.
- **Riesgos / a revisar:** Cambia las firmas de tres funciones privadas del paquete pretranscode; sus unicos callers estan listados en los edits (mas el test). Enqueue sigue usando context.Background() a proposito: se invoca desde PreloadPlayback bajo m.mu sin contexto de job, y se deja igual para no alterar su semantica. El debug 'Could not probe duration' puede aparecer una vez mas al cancelar durante el sondeo; es inocuo.
- **Evidencia del hallazgo:** Grep 'probeDuration\(|probeStreams\(|probeDurationWithFfprobe' en apps/server: unicos callers de produccion en pretranscode.go:198 (Enqueue), :365/:367 (transcode, con ctx en scope), :673; un caller de test en pretranscode_integration_test.go:167. Read de pretranscode.go 290-430 y 495-706: transcode(ctx, job) usa exec.CommandContext(ctx,...) en :380 pero los sondeos usan context.WithTimeout(context.Background(), 30*time.Second) en :500 y :687, y Extractor.GetInfo (Background, info.go:175) en :668. MediaInfoExtractor.GetInfoContext ya existe (info.go:181). go.mod go 1.26.6, asi que t.Context() esta disponible en el test. lint.txt (contextcheck) marcaba pretranscode.go:365/367 como 'should pass the context parameter'.

#### RB-06 · skipdetect: la extraccion de subtitulos on-demand no hereda el contexto del scan

- **Severidad:** Media · **Tipo:** Robustez · **Verificación:** mecánica + revisión manual
- **Problema:** Detector.subtitleHints(ctx, ...) comprueba ctx solo entre episodios, pero extractSubsOnDemand lanza GetInfo (ffprobe, hasta 40 s) y ExtractAttachment(context.Background()) (ffmpeg, hasta 2 min) sin ligarlos al scan; hasta subMaxOnDemand=8 episodios por scan.

**RB-06.1 — Archivo:** `internal/skipdetect/subtitle_hints.go` · **Líneas:** 82–82 · **Acción:** replace

ANTES:

```go
			if d.extractSubsOnDemand(ep.Path) {
```

DESPUÉS:

```go
			if d.extractSubsOnDemand(ctx, ep.Path) {
```

**RB-06.2 — Archivo:** `internal/skipdetect/subtitle_hints.go` · **Líneas:** 123–123 · **Acción:** replace

ANTES:

```go
func (d *Detector) extractSubsOnDemand(videoPath string) bool {
```

DESPUÉS:

```go
func (d *Detector) extractSubsOnDemand(ctx context.Context, videoPath string) bool {
```

**RB-06.3 — Archivo:** `internal/skipdetect/subtitle_hints.go` · **Líneas:** 135–135 · **Acción:** replace

ANTES:

```go
	mi, err := extractor.GetInfo(d.ffprobePath, videoPath)
```

DESPUÉS:

```go
	mi, err := extractor.GetInfoContext(ctx, d.ffprobePath, videoPath)
```

**RB-06.4 — Archivo:** `internal/skipdetect/subtitle_hints.go` · **Líneas:** 139–139 · **Acción:** replace

ANTES:

```go
	if err := videofile.ExtractAttachment(context.Background(), d.ffmpegPath, videoPath, hash, mi, d.cacheDir, d.logger); err != nil {
```

DESPUÉS:

```go
	if err := videofile.ExtractAttachment(ctx, d.ffmpegPath, videoPath, hash, mi, d.cacheDir, d.logger); err != nil {
```

**RB-06.5 — Archivo:** `internal/skipdetect/subtitle_drive_test.go` · **Líneas:** 37–37 · **Acción:** replace

ANTES:

```go
	if d.extractSubsOnDemand("gdrive://FILE123/Serie/ep01.mkv") {
```

DESPUÉS:

```go
	if d.extractSubsOnDemand(t.Context(), "gdrive://FILE123/Serie/ep01.mkv") {
```

- **Razón técnica:** ScanSeries corre con un ctx que se cancela al apagar el servidor (ShutdownCtx) o por el timeout de 30 min / perSeriesScanTimeout del escaneo de biblioteca. Los metodos A/B ya propagan ese ctx a ffmpeg/fpcalc, pero el Metodo C (subtitulos) cortaba la cadena: ExtractAttachment demuxa el MKV completo con ffmpeg (tope por defecto 2 min) y no se entera de que el scan fue cancelado o vencio. ExtractAttachment(ctx, ...) ya acepta ctx y aplica su propio WithTimeout(ctx, 2min) y util.NewCmdCtx, asi que basta pasarle el ctx del scan; GetInfoContext hace lo mismo con ffprobe. Si ctx se cancela, ExtractAttachment devuelve error, extractSubsOnDemand devuelve false (ya contado en onDemandUsed) y el siguiente ciclo de subtitleHints sale por ctx.Done().
- **Impacto esperado:** Un scan cancelado, vencido o un apagado del servidor deja de dejar hasta 8 ffmpeg/ffprobe en vuelo (cada uno hasta 2 min / 40 s) leyendo MKV grandes; en Windows esos hijos sobreviven al proceso padre. Menos IO y CPU residual compitiendo con la reproduccion.
- **Revisión manual (22/10):** Correcto para ExtractAttachment (ffmpeg, hasta 2 min), que ahora sí se corta con el scan. Ver la salvedad de OP-11 para GetInfoContext.
- **Riesgos / a revisar:** Firma privada del paquete skipdetect; callers cubiertos (produccion y el test). El test usa t.Context() (Go 1.26). Un scan cancelado a mitad de una extraccion deja el directorio de subs parcial, igual que ya ocurria con el timeout de 2 min de ExtractAttachment.
- **Evidencia del hallazgo:** Read de subtitle_hints.go 1-144: subtitleHints(ctx) llama d.extractSubsOnDemand(ep.Path) sin ctx (:82) y esta usa extractor.GetInfo (Background) y videofile.ExtractAttachment(context.Background(), ...) (:139). Read de extract.go 100-204: ExtractAttachment toma ctx, aplica WithTimeout(ctx, 2min) y lanza util.NewCmdCtx(ctx,...). Read de mediastream.go:435 y library_scan.go:80: el ctx de ScanSeries se deriva de ShutdownCtx() con timeout. Grep de extractSubsOnDemand: un unico caller de produccion (:82) y uno de test (subtitle_drive_test.go:37). lint.txt: contextcheck subtitle_hints.go:82 'extractSubsOnDemand->GetInfo should pass the context parameter'.

#### RB-07 · filecache.saveToFile codifica punteros compartidos fuera del lock mientras Get/Range los mutan

- **Severidad:** Media · **Tipo:** Robustez · **Verificación:** mecánica + revisión manual
- **Problema:** El snapshot de saveToFile copia solo los punteros *cacheItem bajo RLock y luego los codifica a JSON sin lock, pero Get (hidratacion perezosa) y Range escriben item.Value en el lugar bajo cs.mu.Lock. Es una carrera de datos sobre un campo interface{} (lectura rota posible) que ocurre en el flujo normal: guardado diferido por un heartbeat mientras otra request lee el historial por primera vez.

**RB-07.1 — Archivo:** `internal/util/filecache/filecache.go` · **Líneas:** 353–359 · **Acción:** replace

ANTES:

```go
	// Fast snapshot of the map under read lock; releases cs.mu immediately so readers/writers aren't blocked by disk I/O
	cs.mu.RLock()
	snapshot := make(map[string]*cacheItem, len(cs.data))
	for k, v := range cs.data {
		snapshot[k] = v
	}
	cs.mu.RUnlock()
```

DESPUÉS:

```go
	// Fast snapshot of the map under read lock; releases cs.mu immediately so readers/writers aren't blocked by disk I/O.
	// Cada cacheItem se copia por valor: Get y Range hidratan item.Value en el lugar (con cs.mu para escritura),
	// asi que codificar los punteros compartidos despues del RUnlock seria una carrera de datos.
	cs.mu.RLock()
	snapshot := make(map[string]cacheItem, len(cs.data))
	for k, v := range cs.data {
		if v != nil {
			snapshot[k] = *v
		}
	}
	cs.mu.RUnlock()
```

- **Razón técnica:** cacheItem.Value es un interface{} (dos palabras). Get hace 'cur.Value = hydratedVal' (linea 264) y Range hace 'item.Value = out' (linea 196), ambos bajo cs.mu.Lock, pero saveToFile suelta cs.mu.RUnlock antes de llamar json.NewEncoder(file).Encode(snapshot), que lee item.Value de los mismos objetos. Copiar el struct por valor mientras se tiene el RLock da un snapshot coherente (Expiration y UpdatedAt son punteros que nunca se mutan, solo se reemplazan junto con el item completo) y mantiene la E/S fuera del lock. goccy/go-json codifica map[string]cacheItem igual que map[string]*cacheItem, asi que el archivo en disco no cambia.
- **Impacto esperado:** Quita una carrera de datos que puede corromper el archivo de cache o hacer entrar en panico al codificador al escribir el historial de reproduccion (continuity) y las demas cubetas persistentes; no agrega bloqueo a lectores ni escritores.
- **Revisión manual (22/10):** Correcto. Copiar cada cacheItem por valor bajo el RLock da un snapshot coherente; el JSON resultante es idéntico (salvo que una entrada nil ya no se escribe como null). Value sigue compartiendo punteros si guarda objetos mutables: contrato previo.
- **Riesgos / a revisar:** Costo: una copia de struct (3 palabras + interface) por entrada en cada guardado, despreciable frente a la codificacion JSON. Una entrada nil (JSON null en un archivo corrupto) ahora se omite en vez de escribirse como null. Value sigue siendo compartido si guarda un puntero a un objeto mutable por los llamadores; eso es contrato previo y no se toca.
- **Evidencia del hallazgo:** Read de internal/util/filecache/filecache.go: Get lineas 259-267 (hidratacion con cs.mu.Lock), Range lineas 184-199 (item.Value = out), saveToFile lineas 349-384 (snapshot de punteros, luego Encode fuera del lock). Grep 'saveToFile|snapshot\[': solo se usa dentro de este archivo (158, 346, 349, 357), sin tests que dependan del tipo del snapshot.
- Nota de aplicación: línea real 324 (desfase -29)

#### RB-08 · animethemes.fetchThemes duerme 2 s con time.Sleep ignorando la cancelacion del contexto en reintentos por 429

- **Severidad:** Baja · **Tipo:** Robustez · **Verificación:** LLM + mecánica
- **Problema:** Ante un HTTP 429 el bucle de reintentos de fetchThemes hace time.Sleep(2 * time.Second) sin observar ctx.Done(). Una cancelacion (apagado del servidor o cierre del escaneo) debe esperar hasta 2 s por intento (hasta 6 s con 3 intentos) antes de que la goroutine salga.

**RB-08.1 — Archivo:** `internal/api/animethemes/client.go` · **Líneas:** 143–147 · **Acción:** replace

ANTES:

```go
		if resp.StatusCode == http.StatusTooManyRequests {
			resp.Body.Close()
			time.Sleep(2 * time.Second)
			continue
		}
```

DESPUÉS:

```go
		if resp.StatusCode == http.StatusTooManyRequests {
			resp.Body.Close()
			select {
			case <-ctx.Done():
				return nil, ctx.Err()
			case <-time.After(2 * time.Second):
			}
			continue
		}
```

- **Razón técnica:** El resto del bucle ya es sensible al contexto (limiter.Wait(ctx) y http.NewRequestWithContext(ctx, ...)); el unico punto que bloquea sin contexto es este sleep. Con go 1.26.6 (go.mod:3) un time.After no cancelado no deja el timer retenido tras la cancelacion, asi que el select es seguro sin necesidad de NewTimer/Stop. El error devuelto (ctx.Err()) coincide con el que ya devolveria limiter.Wait(ctx) al cancelarse, y GetThemesByMALID (client.go:103-106) lo propaga sin cachear nada, por lo que no se persiste ningun resultado parcial.
- **Impacto esperado:** Apagado y cancelacion mas responsivos durante un rate limit de AnimeThemes: la goroutine del escaneo sale de inmediato en vez de retener la tarea hasta 2 s por intento. Sin cambio de comportamiento cuando el contexto no se cancela: tras el ultimo intento con 429 se sigue saliendo del bucle y devolviendo el error de status 429.
- **Riesgos / a revisar:** Ninguno. El import time sigue en uso (time.After, time.Second, constantes de TTL). No cambian firmas ni callers.
- **Evidencia del hallazgo:** Read de internal/api/animethemes/client.go:119-168: bucle de 3 intentos con c.limiter.Wait(ctx), NewRequestWithContext(ctx) y time.Sleep(2 * time.Second) en la rama 429 (linea 145). Grep de GetThemesByMALID/fetchThemes/animethemes. en apps/server: unico llamante de fetchThemes es GetThemesByMALID (client.go:103), que retorna el error antes de llamar a UpsertMetadataCache. go.mod:3 declara go 1.26.6. No existe otro time.Sleep en este archivo.

#### RB-09 · animethemes.DownloadAudio ignora el error de Close y no limpia el .tmp si falla el Rename

- **Severidad:** Baja · **Tipo:** Robustez · **Verificación:** LLM + mecánica
- **Problema:** Tras copiar el audio, f.Close() no se comprueba y, si os.Rename falla (por ejemplo, destino bloqueado en Windows por otro proceso), el .tmp queda en disco. Un fallo del flush final dejaria un .ogg truncado promovido como definitivo, que la comprobacion de idempotencia inicial (info.Size() > 0, linea 246) daria por bueno para siempre.

**RB-09.1 — Archivo:** `internal/api/animethemes/client.go` · **Líneas:** 276–282 · **Acción:** replace

ANTES:

```go
	if _, err := io.Copy(f, resp.Body); err != nil {
		f.Close()
		os.Remove(tmp)
		return err
	}
	f.Close()
	return os.Rename(tmp, destPath)
```

DESPUÉS:

```go
	if _, err := io.Copy(f, resp.Body); err != nil {
		f.Close()
		os.Remove(tmp)
		return err
	}
	if err := f.Close(); err != nil {
		os.Remove(tmp)
		return err
	}
	if err := os.Rename(tmp, destPath); err != nil {
		os.Remove(tmp)
		return err
	}
	return nil
```

- **Razón técnica:** Close es el ultimo punto en que el sistema operativo puede informar un fallo de escritura diferida; ignorarlo rompe la garantia de atomicidad que documenta la propia funcion. Limpiar el .tmp cuando el rename falla evita archivos huerfanos. Se conserva el nombre fijo destPath+".tmp" para no alterar el comportamiento observable. Los ifs con err := son locales y no sombrean nada problematico (el err externo del scope ya existe y no se usa despues).
- **Impacto esperado:** Evita persistir un audio de tema corrupto que haria fallar de forma permanente la deteccion de intro/outro de ese episodio (la idempotencia lo daria por bueno), y evita acumular .tmp huerfanos. Frecuencia baja; es una mejora de robustez, no un fallo frecuente.
- **Riesgos / a revisar:** Ninguno. os.Remove sobre un temporal inexistente es inocuo y su error se ignora igual que en la rama previa. El unico llamante (internal/skipdetect/animethemes_match.go:78) ya trata cualquier error de DownloadAudio como fallo de descarga de ese theme, asi que la semantica hacia arriba no cambia. Firma sin cambios (la interfaz en internal/skipdetect/detector.go:149 sigue cumpliendose).
- **Evidencia del hallazgo:** Read de internal/api/animethemes/client.go:243-283: f.Close() de la linea 281 sin comprobar y return os.Rename(tmp, destPath) sin limpieza del tmp. Grep de DownloadAudio en apps/server: definicion en client.go:245, interfaz en skipdetect/detector.go:149 y unico llamante en skipdetect/animethemes_match.go:78. No hay tests que cubran DownloadAudio, por lo que no hay que tocar tests.
- Nota de aplicación: línea real 280 (desfase 4)

#### RB-10 · health.go: el mutex de la cache de /api/health se toma sin defer y la respuesta se escribe dentro de la ruta critica

- **Severidad:** Baja · **Tipo:** Robustez · **Verificación:** mecánica + revisión manual
- **Problema:** HandleHealth toma healthCache.mu y solo lo suelta con Unlock explicito al final de una funcion que ejecuta cinco chequeos (DB, cache, TMDB, migraciones, ffmpeg). Si cualquiera entra en panico (Echo Recover lo atrapa), el mutex queda tomado para siempre y todos los pedidos posteriores a /api/health (anonimo y sin rate limit) quedan colgados.

**RB-10.1 — Archivo:** `internal/handlers/health.go` · **Líneas:** 56–62 · **Acción:** replace

ANTES:

```go
	healthCache.mu.Lock()
	if healthCache.body != nil && time.Now().Before(healthCache.expiresAt) {
		status := healthCache.status
		body := healthCache.body
		healthCache.mu.Unlock()
		return c.JSONBlob(status, body)
	}
```

DESPUÉS:

```go
	status, body := h.healthSnapshot()
	return c.JSONBlob(status, body)
}

// healthSnapshot devuelve el ultimo resultado cacheado o lo recalcula. El mutex se suelta con
// defer: si un chequeo entra en panico (el Recover de Echo lo atrapa), no queda tomado para
// siempre ni cuelga a los pedidos siguientes de /api/health. La respuesta se escribe fuera del
// lock para que un cliente lento no frene a los demas.
func (h *Handler) healthSnapshot() (int, []byte) {
	healthCache.mu.Lock()
	defer healthCache.mu.Unlock()
	if healthCache.body != nil && time.Now().Before(healthCache.expiresAt) {
		return healthCache.status, healthCache.body
	}
```

**RB-10.2 — Archivo:** `internal/handlers/health.go` · **Líneas:** 132–134 · **Acción:** replace

ANTES:

```go
	healthCache.body, healthCache.status, healthCache.expiresAt = body, statusCode, time.Now().Add(ttl)
	healthCache.mu.Unlock()
	return c.JSONBlob(statusCode, body)
```

DESPUÉS:

```go
	healthCache.body, healthCache.status, healthCache.expiresAt = body, statusCode, time.Now().Add(ttl)
	return statusCode, body
```

- **Razón técnica:** El patron Lock ... Unlock manual alrededor de codigo que llama a la base, a TMDB y a ffmpeg no es seguro ante panics: Recover de Echo (routes.go:212) evita que caiga el proceso pero no libera el mutex. /api/health es lo que consulta el sidecar de escritorio, de modo que un solo panic (por ejemplo un TMDBClient nil durante un hot-reload de config, que reemplaza a.Metadata.TMDBClient) convierte el endpoint en un agujero negro. Moverlo a una funcion con defer lo hace seguro y, de paso, la escritura de la respuesta al cliente deja de ocurrir mientras se tiene el mutex global.
- **Impacto esperado:** Defensa ante un fallo permanente del endpoint de salud (goroutines acumuladas esperando un mutex que nunca se libera); sin cambio observable en el camino normal.
- **Revisión manual (22/10):** Equivalente: la lógica intermedia es la misma; el mutex ahora se libera con defer aunque un chequeo entre en pánico, y la respuesta se escribe fuera del lock.
- **Riesgos / a revisar:** La logica intermedia (lineas 63-131) queda intacta: ahora se ejecuta dentro de healthSnapshot, que devuelve (statusCode, body). 'status' pasa a ser variable local del handler; no hay otra variable con ese nombre en el cuerpo movido (las demas son statusCode/overallStatus). Se mantiene la serializacion de calculos concurrentes (un solo recalculo en curso, el resto espera y luego lee la cache).
- **Evidencia del hallazgo:** Read de internal/handlers/health.go lineas 1-135: Lock en 56, Unlock manual en 60 y 133 sin defer; los chequeos (73-115) corren con el lock tomado. routes.go:212 usa middleware.Recover() (atrapa el panic pero no libera mutex ajenos). Grep 'healthCache' confirma que solo este handler lo usa.
- Nota de aplicación: línea real 139 (desfase 7)

#### RB-11 · Lanes de episodios: LIMIT global ordenado por episode_number puede dejar lanes vacías

- **Severidad:** Baja · **Tipo:** Robustez · **Verificación:** mecánica + revisión manual
- **Problema:** buildEpisodeSwimlanesBatch trae `Order(episode_number ASC).Limit(len(laneNames)*50)` sobre TODAS las lanes juntas y luego recorta a 20 por lane en Go: si unas lanes acaparan los 50*N números de episodio más bajos, otras lanes reciben 0 episodios y desaparecen de la portada.

**RB-11.1 — Archivo:** `internal/library/anime/swimlanes.go` · **Líneas:** 142–150 · **Acción:** replace

ANTES:

```go
	var allEpisodes []models.LibraryEpisode
	if err := s.db.Gorm().
		Select("id, library_media_id, episode_number, title, suggested_swimlane").
		Where("suggested_swimlane IN (?)", laneNames).
		Order("episode_number ASC").
		Limit(len(laneNames) * 50).
		Find(&allEpisodes).Error; err != nil || len(allEpisodes) == 0 {
		return nil
	}
```

DESPUÉS:

```go
	// Tope de 20 episodios POR lane resuelto en SQL (ventana por suggested_swimlane):
	// un LIMIT global ordenado por episode_number dejaba sin episodios a las lanes
	// cuyos números de episodio son más altos.
	const laneEpisodesSQL = `
		SELECT id, library_media_id, episode_number, title, suggested_swimlane
		FROM (
			SELECT id, library_media_id, episode_number, title, suggested_swimlane,
				ROW_NUMBER() OVER (PARTITION BY suggested_swimlane ORDER BY episode_number ASC) AS rn
			FROM library_episodes
			WHERE suggested_swimlane IN ?
		)
		WHERE rn <= 20
		ORDER BY episode_number ASC`
	var allEpisodes []models.LibraryEpisode
	if err := s.db.Gorm().Raw(laneEpisodesSQL, laneNames).Scan(&allEpisodes).Error; err != nil || len(allEpisodes) == 0 {
		return nil
	}
```

- **Razón técnica:** El tope por lane (20) ya se aplica en el bucle de agrupación (líneas 156-162), pero el LIMIT SQL es global: con N lanes toma las 50*N filas de menor episode_number de cualquier lane (empates en orden indefinido). Con ROW_NUMBER() OVER (PARTITION BY suggested_swimlane) cada lane aporta sus 20 primeros episodios. Para lanes que no superan el tope el resultado es idéntico al actual; el índice de suggested_swimlane (tag `index` del modelo) sigue sirviendo al WHERE.
- **Impacto esperado:** Corrige lanes que desaparecen o salen incompletas cuando varias lanes tienen más de 50*N episodios entre todas; además acota las filas devueltas a 20 por lane en vez de 50*N.
- **Revisión manual (22/10):** Verificado en ejecución: el SQL con ROW_NUMBER() OVER (PARTITION BY suggested_swimlane) corre sobre SQLite en memoria con la expansión de IN ? de GORM y limita a 20 episodios por lane (prueba temporal en la copia: A=20, B=20, C=4). La frecuencia del defecto original no se midió contra la base real.
- **Riesgos / a revisar:** Depende de la distribución de datos: no se midió contra la base real (el defecto es demostrable por lectura del código, su frecuencia no). Requiere SQLite con funciones de ventana (>=3.25; el driver glebarez/modernc usado lo cumple). El scan a []models.LibraryEpisode mapea por nombre de columna (sin DeletedAt en BaseModel). El resto de la función no cambia.
- **Evidencia del hallazgo:** Read swimlanes.go 132-233: Limit(len(laneNames) * 50) con Order("episode_number ASC") sin partición y agrupación posterior `len(list) < 20`. Grep del nombre de tabla: tag_lanes.go usa Table("library_episodes"). Índice de suggested_swimlane: models/library.go:131 (`index`).

#### RB-12 · IsValidMediaFile se evalúa sobre la ruta completa, nunca descarta los ._ de AppleDouble

- **Severidad:** Baja · **Tipo:** Robustez · **Verificación:** mecánica + revisión manual
- **Problema:** El filtro util.IsValidMediaFile comprueba strings.HasPrefix(path, "._"), pero discoverFilePaths le pasa la ruta completa (siempre absoluta, p. ej. D:\Anime\._Ep01.mkv), de modo que la condición nunca se cumple y los archivos de metadatos AppleDouble de macOS (._*.mkv, ~4 KB) entran al escaneo como si fueran videos.

**RB-12.1 — Archivo:** `internal/library/scanner/discovery.go` · **Líneas:** 71–71 · **Acción:** replace

ANTES:

```go
				if util.IsValidMediaFile(path) && util.IsValidVideoExtension(ext) {
```

DESPUÉS:

```go
				if util.IsValidMediaFile(d.Name()) && util.IsValidVideoExtension(ext) {
```

- **Razón técnica:** IsValidMediaFile está pensada para el nombre del archivo (prefijo ._). Con la ruta completa el prefijo nunca coincide. d.Name() es el nombre base del DirEntry y ya está disponible en el callback de WalkDir (se usa d.IsDir() justo arriba). Además de corregir el filtro, cada archivo ._ descartado evita una pasada completa por createLocalFiles (os.Stat, parseo habari, ffprobe posterior) que terminaría como archivo irreconocible.
- **Impacto esperado:** Evita que bibliotecas copiadas desde macOS/NAS/SMB con basura AppleDouble generen LocalFiles falsos, intentos de ffprobe fallidos y entradas 'sin reconocer'. Cambio de comportamiento intencional y acotado a nombres que empiezan con ._.
- **Revisión manual (22/10):** Correcto: IsValidMediaFile solo comprueba el prefijo '._' y recibía la ruta completa, así que nunca filtraba; con d.Name() los metadatos AppleDouble dejan de entrar al escaneo. Un video legítimo cuyo nombre empiece por '._' dejaría de indexarse.
- **Riesgos / a revisar:** Si algún usuario tuviera un video legítimo cuyo nombre empiece por '._' dejará de indexarse (intención original de la función). IsValidMediaFile solo tiene este llamador (Grep).
- **Evidencia del hallazgo:** Grep IsValidMediaFile( en apps/server: definición en internal/util/fs.go:46 (return !strings.HasPrefix(path, "._")) y único uso en discovery.go:71 con la ruta completa 'path' del WalkDir; libraryPaths son rutas absolutas configuradas por el usuario, por lo que HasPrefix(path, "._") es siempre falso.
- Nota de aplicación: línea real 63 (desfase -8)

#### RB-13 · Lectura de repository.settings sin settingsMu en buildMediaContainer (carrera con InitializeModules)

- **Severidad:** Baja · **Tipo:** Robustez · **Verificación:** mecánica + revisión manual
- **Problema:** PlaybackManager.buildMediaContainer lee directamente el campo p.repository.settings (un mo.Option, struct de dos palabras: bool + puntero) con IsPresent()+MustGet() sin tomar settingsMu, mientras Repository.InitializeModules lo reemplaza bajo settingsMu.Lock(). Es una carrera de datos sobre el Option y MustGet() de un Option que el lector vio como presente se evalua en una segunda lectura no atomica.

**RB-13.1 — Archivo:** `internal/mediastream/playback.go` · **Líneas:** 297–301 · **Acción:** replace

ANTES:

```go
	if p.repository.settings.IsPresent() {
		if s := p.repository.settings.MustGet(); s != nil && s.FfprobePath != "" {
			ffprobePath = s.FfprobePath
		}
	}
```

DESPUÉS:

```go
	if s, ok := p.repository.GetSettings().Get(); ok && s != nil && s.FfprobePath != "" {
		ffprobePath = s.FfprobePath
	}
```

**RB-13.2 — Archivo:** `internal/mediastream/playback.go` · **Líneas:** 320–325 · **Acción:** replace

ANTES:

```go
	if p.repository.settings.IsPresent() {
		if s := p.repository.settings.MustGet(); s != nil {
			policy.directPlayOnly = s.DirectPlayOnly
			policy.disableAutoSwitchToDirect = s.DisableAutoSwitchToDirectPlay
		}
	}
```

DESPUÉS:

```go
	if s, ok := p.repository.GetSettings().Get(); ok && s != nil {
		policy.directPlayOnly = s.DirectPlayOnly
		policy.disableAutoSwitchToDirect = s.DisableAutoSwitchToDirectPlay
	}
```

- **Razón técnica:** El resto del paquete respeta la regla: Repository.GetSettings() toma settingsMu.RLock (repository.go:80-84) y startAttachmentExtraction lee settings bajo RLock con el comentario 'InitializeModules may be swapping them concurrently' (playback.go:420-425). Solo estos dos bloques de buildMediaContainer (294-325) accedian al campo crudo. Usar el accesor da una unica lectura consistente (Get() devuelve valor+presencia de una vez, sin el par IsPresent()/MustGet() separado) y elimina la carrera que reportaria go test -race si InitializeModules corre durante una peticion de reproduccion. El resultado funcional es identico: mismos valores por defecto (ffprobe / directPlayOnly=true fail-closed) cuando no hay ajustes.
- **Impacto esperado:** Elimina una carrera de datos en la ruta caliente de reproduccion (buildMediaContainer corre dentro de singleflight, concurrente por archivo/cliente). InitializeModules se invoca en vivo desde: la goroutine de auto-descarga de FFmpeg (core/modules.go:95-97), HandleInstallFFmpeg (handlers/mediastream.go:922-923), InitOrRefreshMediastreamSettings (core/modules.go:326) y el guardado de ajustes. Con lectura rota podria verse isPresent=true con value aun nil (el guard s != nil lo evita) o presente=false transitorio que caeria a ffprobe/directPlayOnly por defecto en esa peticion. Severidad baja: no hay nil-deref demostrable porque los guards s != nil ya existen.
- **Revisión manual (22/10):** Correcto: GetSettings() toma settingsMu.RLock y devuelve una copia del Option. Hallazgo adicional NO incluido en el plan: InitializeModules muta en sitio settings.FfmpegPath/FfprobePath sobre el puntero cacheado compartido (internal/mediastream/repository.go ~131-132), otra carrera de datos; pendiente para el barrido por paquete.
- **Riesgos / a revisar:** Ninguno de comportamiento. Quedan fuera de alcance dos cosas relacionadas: (1) InitializeModules muta en sitio settings.FfmpegPath/FfprobePath (repository.go:131-132) sobre el puntero cacheado compartido de db.GetMediastreamSettings, otra carrera sobre los campos que se leen despues de soltar el lock; (2) repository.go:237-241 y 257-261 usan r.settings tras comprobar IsPresent bajo RLock, esos si estan correctamente protegidos. No hace falta tocar callers ni imports (GetSettings ya existe y devuelve mo.Option; no se quita ninguna referencia a mo).
- **Evidencia del hallazgo:** Grep 'repository\.settings\b|r\.settings\b' en internal/mediastream (sin tests): accesos sin lock en playback.go:297,298,320,321; playback.go:423 SI esta bajo p.repository.settingsMu.RLock (lineas 422-425); escritura en repository.go:135 bajo settingsMu.Lock. Read de playback.go 290-335 confirma que ambos bloques estan en buildMediaContainer, llamado desde containerGroup.Do (playback.go:265-272) sin ningun lock del repositorio. Confirmado que Repository.GetSettings (repository.go:80-84) toma RLock y devuelve la copia del Option.
- Nota de aplicación: línea real 311 (desfase 14); línea real 332 (desfase 12)

#### RB-14 · skipdetect: la descarga de fpcalc no respeta el contexto del scan (noctx)

- **Severidad:** Baja · **Tipo:** Robustez · **Verificación:** mecánica + revisión manual
- **Problema:** EnsureFpcalcBinary descarga el release con client.Get(release.url) (timeout fijo de 2 min, sin contexto) aunque su unico caller, ScanSeries, tiene un ctx cancelable; cancelar el scan o apagar el servidor espera a que termine la descarga.

**RB-14.1 — Archivo:** `internal/skipdetect/fpcalc.go` · **Líneas:** 90–90 · **Acción:** replace

ANTES:

```go
func EnsureFpcalcBinary(cacheDir string, logger *zerolog.Logger) (string, error) {
```

DESPUÉS:

```go
func EnsureFpcalcBinary(ctx context.Context, cacheDir string, logger *zerolog.Logger) (string, error) {
```

**RB-14.2 — Archivo:** `internal/skipdetect/detector.go` · **Líneas:** 235–235 · **Acción:** replace

ANTES:

```go
	fpcalcBin, err := EnsureFpcalcBinary(d.cacheDir, d.logger)
```

DESPUÉS:

```go
	fpcalcBin, err := EnsureFpcalcBinary(ctx, d.cacheDir, d.logger)
```

**RB-14.3 — Archivo:** `internal/skipdetect/fpcalc_test.go` · **Líneas:** 21–21 · **Acción:** replace

ANTES:

```go
	bin, err := EnsureFpcalcBinary(cacheDir, logger)
```

DESPUÉS:

```go
	bin, err := EnsureFpcalcBinary(context.Background(), cacheDir, logger)
```

**RB-14.4 — Archivo:** `internal/skipdetect/fpcalc.go` · **Líneas:** 120–121 · **Acción:** replace

ANTES:

```go
	client := &http.Client{Timeout: 2 * time.Minute}
	resp, err := client.Get(release.url)
```

DESPUÉS:

```go
	client := &http.Client{Timeout: 2 * time.Minute}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, release.url, nil)
	if err != nil {
		return "", fmt.Errorf("no se pudo preparar la descarga de fpcalc: %w", err)
	}
	resp, err := client.Do(req)
```

- **Razón técnica:** Es la unica llamada HTTP de produccion sin contexto en todo el servidor (noctx la marca en fpcalc.go:121). El io.Copy posterior lee resp.Body, que con NewRequestWithContext tambien se aborta al cancelar ctx, de modo que la descarga completa (hasta 2 min en una red lenta) respeta la cancelacion. El timeout de 2 min y el SHA256 pinneado quedan intactos. `req, err :=` y `resp, err :=` son redeclaraciones validas porque req y resp son nuevas.
- **Impacto esperado:** Un apagado del servidor o un scan cancelado durante la primera descarga de fpcalc retorna de inmediato en lugar de bloquear hasta 2 min; elimina el unico hallazgo noctx de produccion.
- **Revisión manual (22/10):** Correcto: solo cambia la firma de EnsureFpcalcBinary, sin otros llamadores.
- **Riesgos / a revisar:** Cambia la firma exportada de EnsureFpcalcBinary; sin otros callers en el modulo (Grep completo). Si ctx llega cancelado el error devuelto es el de la descarga abortada y ScanSeries lo reporta como 'Error al descargar fpcalc', igual que cualquier otro fallo de red.
- **Evidencia del hallazgo:** Grep 'http.NewRequest\(|http.Get\(|client.Get\(' (sin tests) en apps/server: unico resultado fpcalc.go:121. Grep 'EnsureFpcalcBinary': callers detector.go:235 (dentro de ScanSeries(ctx), ctx en scope) y fpcalc_test.go:21 (el test ya importa context). lint.txt: 'internal\skipdetect\fpcalc.go:121:25: (*net/http.Client).Get must not be called (noctx)'.
- Nota de aplicación: línea real 241 (desfase 6)

#### RB-15 · Miniaturas locales: el temporal termina en .tmp y ffmpeg no puede elegir el muxer

- **Severidad:** Alta · **Tipo:** Robustez · **Verificación:** mecánica + revisión manual
- **Problema:** ensureThumbnailFile le pasa a ffmpeg un archivo de salida llamado <hash>.jpg.<nanos>.tmp. ffmpeg decide el formato por la extension final y .tmp no corresponde a ningun muxer, asi que toda extraccion en frio de un video local falla.

**RB-15.1 — Archivo:** `internal/handlers/thumbnail.go` · **Líneas:** 299–299 · **Acción:** replace

ANTES:

```go
		tmpCacheFile := fmt.Sprintf("%s.%d.tmp", cacheFile, time.Now().UnixNano())
```

DESPUÉS:

```go
		// Debe terminar en .jpg: ffmpeg elige el muxer por la extension y con ".tmp" falla
		// ("Unable to choose an output format"). ".tmp" sigue en el nombre para PruneDirectory.
		tmpCacheFile := fmt.Sprintf("%s.%d.tmp.jpg", cacheFile, time.Now().UnixNano())
```

- **Razón técnica:** Con un nombre terminado en .jpg ffmpeg usa el muxer image2 (mjpeg) y escribe el frame. El nombre sigue conteniendo ".tmp", asi que PruneDirectory (strings.Contains(name, ".tmp")) sigue limpiando los temporales huerfanos con mas de 1 hora, y el os.Rename final al cacheFile no cambia. La ruta de error sigue haciendo os.Remove(tmpCacheFile) sobre la misma variable.
- **Impacto esperado:** Hoy cada miniatura de archivo local sin cache falla: cmd.CombinedOutput devuelve error, se registra thumbnailFailed.Store(hash) y HandleGetVideoThumbnail responde 404 (errThumbnailUnavailable) durante 30 minutos. Ademas se gasta un ffprobe y un ffmpeg por archivo, y el precalentado tras escaneo (warmOneThumbnail -> EnsureThumbnailWithContext) los repite y los cuenta como skipped en cada arranque. Con el cambio la generacion funciona y el calentamiento deja de ser trabajo perdido.
- **Revisión manual (22/10):** Correcto y de alto valor: el comando ffmpeg no pasa -f y elige el muxer por la extensión final; con '.tmp' falla con 'Unable to choose an output format' (el agente lo reprodujo con ffmpeg y con '.tmp.jpg' genera un JPEG válido). Toda miniatura local en frío fallaba; las de Drive no pasan por ffmpeg.
- **Riesgos / a revisar:** Casi nulo. Un archivo <hash>.jpg.<n>.tmp.jpg a medio escribir acaba en .jpg, por lo que cualquier contador de archivos .jpg del directorio podria incluirlo unos segundos; no encontre ningun consumidor que filtre por HasSuffix(.tmp). Solo cubre la ruta local: las miniaturas de Drive escriben con os.WriteFile y no pasan por ffmpeg.
- **Evidencia del hallazgo:** Read internal/handlers/thumbnail.go:296-310: tmpCacheFile = fmt.Sprintf("%s.%d.tmp", cacheFile, ...) se pasa como ultimo argumento de ffmpeg junto con -vframes 1 -y y sin -f. Reproduccion en esta maquina con ffmpeg (chocolatey): al escribir a probe.jpg.123456789.tmp sale "Unable to choose an output format for '...probe.jpg.123456789.tmp'; use a standard extension" y "Error opening output files: Invalid argument" (no se crea archivo). Con probe.jpg.123456789.tmp.jpg el mismo comando termina con exit=0 y el archivo empieza por ff d8 (JPEG valido). git log -S'.%d.tmp' sobre thumbnail.go apunta al commit inicial 1c97b85, y thumbnail_test.go no referencia ffmpeg, por lo que ninguna prueba cubre la extraccion real.
- Nota de aplicación: línea real 307 (desfase 8)

#### RB-16 · SeparateFilePathS ordena in situ el slice compartido desde N goroutines (carrera de datos)

- **Severidad:** Alta · **Tipo:** Robustez · **Verificación:** mecánica + revisión manual
- **Problema:** createLocalFiles lanza 2*NumCPU workers que llaman a dto.NewLocalFileS(path, libraryPaths) con el MISMO slice, y SeparateFilePathS hace sort.Slice(potentialPrefixes, ...) sobre él en cada llamada.

**RB-16.1 — Archivo:** `internal/library/filesystem/mediapath.go` · **Líneas:** 8–8 · **Acción:** delete-lines

ANTES:

```go
	"sort"
```

DESPUÉS: _(se elimina el bloque)_

**RB-16.2 — Archivo:** `internal/library/filesystem/mediapath.go` · **Líneas:** 51–67 · **Acción:** replace

ANTES:

```go
func SeparateFilePathS(path string, potentialPrefixes []string) *SeparatedFilePath {
	// Sort prefix paths by length in descending order
	sort.Slice(potentialPrefixes, func(i, j int) bool {
		return len(potentialPrefixes[i]) > len(potentialPrefixes[j])
	})

	// Check each prefix path, and remove the first match from the path
	prefixPath := ""
	for _, p := range potentialPrefixes {
		// Normalize the paths for comparison only
		if strings.HasPrefix(util.NormalizePath(path), util.NormalizePath(p)) {
			// Remove the prefix from the path
			path = path[len(p):]
			prefixPath = p
			break
		}
	}
```

DESPUÉS:

```go
func SeparateFilePathS(path string, potentialPrefixes []string) *SeparatedFilePath {
	// Se elige el prefijo coincidente más largo sin reordenar potentialPrefixes: los workers
	// del escáner comparten ese slice y ordenarlo in situ desde varias goroutines a la vez
	// era una carrera de datos.
	normalizedPath := util.NormalizePath(path)
	prefixPath := ""
	bestLen := -1
	for _, p := range potentialPrefixes {
		// Normalize the paths for comparison only
		if len(p) > bestLen && strings.HasPrefix(normalizedPath, util.NormalizePath(p)) {
			bestLen = len(p)
			prefixPath = p
		}
	}
	if bestLen >= 0 {
		// Remove the prefix from the path
		path = path[len(prefixPath):]
	}
```

**RB-16.3 — Archivo:** `internal/library/scanner/discovery.go` · **Líneas:** 110–110 · **Acción:** replace

ANTES:

```go
	jobs := make(chan string, len(paths))
```

DESPUÉS:

```go
	// El prefijo más largo gana en SeparateFilePathS; dejar libraryPaths ordenado de mayor a
	// menor longitud, una sola vez y antes de lanzar los workers, conserva el orden que luego
	// usa ParseFolderStructure con raíces anidadas sin que N goroutines reordenen el mismo slice.
	sort.SliceStable(libraryPaths, func(i, j int) bool {
		return len(libraryPaths[i]) > len(libraryPaths[j])
	})

	jobs := make(chan string, len(paths))
```

- **Razón técnica:** sort.Slice intercambia elementos del slice (cabeceras de string de 16 bytes). Con varias raíces de biblioteca donde DirPath es más corto que alguna de OtherDirPaths, libraryPaths (construido en discoverFilePaths como append([]string{scn.DirPath}, scn.OtherDirPaths...)) llega desordenado, el primer worker lo reordena y los demás leen/escriben a la vez: carrera de datos sobre valores multipalabra. Una lectura rota puede ver el mismo string dos veces y no ver el otro (prefijo equivocado o ninguno, por lo que Dirnames incluye carpetas de la raíz y ParsedFolderData sale mal) y, en el peor caso, cabeceras de string inconsistentes. La nueva versión es de solo lectura: elige el prefijo coincidente más largo (mismo resultado que ordenar de mayor a menor y tomar el primero) y además calcula NormalizePath(path) una sola vez en vez de una por prefijo. El ordenamiento que antes ocurría como efecto lateral (y que ParseFolderStructure/collectMatchedMedia aprovechan después al recorrer libraryPaths en orden y cortar en el primer match) pasa a hacerse de forma determinista y única antes de lanzar los workers.
- **Impacto esperado:** Elimina una carrera de datos reproducible con `go test -race` o con dos o más raíces de biblioteca no ordenadas por longitud; resultados de parseo de rutas deterministas en el escaneo; menos asignaciones/normalizaciones por archivo.
- **Revisión manual (22/10):** Correcto: sort.Slice sobre el slice compartido desde 2×NumCPU workers es una carrera real. El nuevo cálculo elige el prefijo coincidente más largo sin reordenar; discoverFilePaths/createLocalFiles ordena libraryPaths una sola vez antes de lanzar los workers (en un escaneo parcial eso reordena scn.TargetPaths en el sitio, como ya hacía el efecto lateral del sort original).
- **Riesgos / a revisar:** Los edits de un mismo archivo usan numeración del original: aplicar de abajo hacia arriba (mediapath.go: primero 51-67, luego línea 8). Con prefijos del mismo largo el desempate era indefinido (sort.Slice no es estable); ahora gana el primero de la lista.
- **Evidencia del hallazgo:** discovery.go:27 (libraryPaths sin ordenar), discovery.go:105-125 y :177 (workers concurrentes llaman dto.NewLocalFileS(path, libraryPaths)); dto/localfile.go:160-162 (NewLocalFileS -> filesystem.SeparateFilePathS(opath, dirPaths)); mediapath.go:53-55 (sort.Slice sobre el parámetro). Grep de SeparateFilePathS: único caller de producción es NewLocalFileS; mediapath_test.go (4 casos con prefijos literales, incl. '/mnt/Anime', '/mnt/Anime/', '/mnt') da el mismo resultado con el prefijo más largo. Tras el cambio `sort` deja de usarse en mediapath.go (por eso el edit del import); discovery.go ya importa sort.
- Nota de aplicación: línea real 50 (desfase -1); línea real 102 (desfase -8)

#### RB-17 · InitLibraryFileWatcher aborta ante el primer Add fallido y deja sin vigilancia (y con handle abierto) a toda la biblioteca

- **Severidad:** Media · **Tipo:** Robustez · **Verificación:** mecánica + revisión manual
- **Problema:** El callback de WalkDir devuelve el error de Watcher.Add; un solo directorio no vigilable corta el recorrido, Init devuelve error y core.initLibraryWatcher retorna sin iniciar StartWatching ni cerrar el fsnotify.Watcher.

**RB-17.1 — Archivo:** `internal/library/scanner/watcher.go` · **Líneas:** 58–78 · **Acción:** replace

ANTES:

```go
func (w *Watcher) InitLibraryFileWatcher(opts *WatchLibraryFilesOptions) error {
	// Define a function to add directories and their subdirectories to the watcher
	watchDir := func(dir string) error {
		err := filepath.WalkDir(dir, func(path string, d os.DirEntry, err error) error {
			if err != nil {
				return nil
			}
			if d.IsDir() {
				return w.Watcher.Add(path)
			}
			return nil
		})
		return err
	}

	// Add the initial directory and its subdirectories to the watcher
	for _, path := range opts.LibraryPaths {
		if err := watchDir(path); err != nil {
			return err
		}
	}
```

DESPUÉS:

```go
func (w *Watcher) InitLibraryFileWatcher(opts *WatchLibraryFilesOptions) error {
	var watched int
	var firstErr error

	// Define a function to add directories and their subdirectories to the watcher
	watchDir := func(dir string) {
		_ = filepath.WalkDir(dir, func(path string, d os.DirEntry, err error) error {
			if err != nil {
				return nil
			}
			if d.IsDir() {
				// Un directorio que no se puede vigilar (permisos, límite de watches del SO) no debe
				// impedir vigilar el resto de la biblioteca ni dejar sin arrancar el watcher completo.
				if addErr := w.Watcher.Add(path); addErr != nil {
					w.Logger.Warn().Err(addErr).Str("path", path).Msg("watcher: Failed to watch directory, skipping")
					if firstErr == nil {
						firstErr = addErr
					}
				} else {
					watched++
				}
			}
			return nil
		})
	}

	// Add the initial directory and its subdirectories to the watcher
	for _, path := range opts.LibraryPaths {
		watchDir(path)
	}
	// Solo es un error fatal si no se pudo vigilar ni un directorio.
	if watched == 0 && firstErr != nil {
		return firstErr
	}
```

**RB-17.2 — Archivo:** `internal/core/watcher.go` · **Líneas:** 26–29 · **Acción:** replace

ANTES:

```go
	if err != nil {
		a.Logger.Error().Err(err).Msg("app: Failed to watch library files")
		return
	}
```

DESPUÉS:

```go
	if err != nil {
		a.Logger.Error().Err(err).Msg("app: Failed to watch library files")
		watcher.StopWatching()
		return
	}
```

- **Razón técnica:** Hoy `return w.Watcher.Add(path)` dentro de WalkDir hace que el primer error (límite de inotify/handles, acceso denegado a una subcarpeta como 'System Volume Information' o '$RECYCLE.BIN' si la biblioteca es la raíz de una unidad, carpeta con ACL restringida) detenga el recorrido: las carpetas restantes y las demás LibraryPaths nunca se registran. Además Init devuelve ese error y core.initLibraryWatcher hace `return` antes de asignar a.Watcher y de llamar a StartWatching: el auto-escaneo queda desactivado por completo, con una sola línea de log de error, y el fsnotify.Watcher creado en NewWatcher (con su goroutine/handle del SO) queda sin cerrar. La nueva versión registra una advertencia por directorio problemático, sigue con el resto y solo devuelve error si no se logró vigilar ningún directorio; en ese caso core ahora cierra el watcher antes de salir. Es consistente con StartWatching, que ya trata los fallos de Add de carpetas nuevas como advertencias no fatales.
- **Impacto esperado:** Un directorio inaccesible deja de desactivar el auto-escaneo de toda la biblioteca; se evita la fuga de un fsnotify.Watcher por cada intento fallido de inicialización.
- **Revisión manual (22/10):** Correcto: un directorio no vigilable ya no aborta el recorrido ni deja el fsnotify.Watcher abierto; si todos fallan se sigue devolviendo error. Sin objeciones.
- **Riesgos / a revisar:** Los edits de watcher.go (58-78) y de core/watcher.go son archivos distintos; los números de línea de watcher.go corresponden al original y este hallazgo es independiente del edit 119-123 del hallazgo anterior (aplicar el de abajo primero). Si todo falla seguirá devolviendo error como antes.
- **Evidencia del hallazgo:** watcher.go:60-71 (walk que devuelve el error de Add) y :74-78 (Init corta en el primer error); core/watcher.go:23-29 (en error: log y `return` antes de `a.Watcher = watcher` en :50 y de `StartWatching` en :53, sin Stop/Close); watcher.go:133-139 (el mismo Add en StartWatching ya se trata como warning no fatal).

#### RB-18 · Watcher descarta carpetas nuevas con puntos en el nombre y nunca las vigila

- **Severidad:** Media · **Tipo:** Robustez · **Verificación:** mecánica + revisión manual
- **Problema:** El filtro de extensión trata como archivo no válido cualquier Create cuyo nombre tenga punto (filepath.Ext), de modo que carpetas como 'Show.S01.1080p.WEB-DL-GRP' o 'Mob Psycho 100 S2.5' no se registran en fsnotify.

**RB-18.1 — Archivo:** `internal/library/scanner/watcher.go` · **Líneas:** 119–123 · **Acción:** replace

ANTES:

```go
				ext := strings.ToLower(filepath.Ext(event.Name))
				isDirCreate := event.Op&fsnotify.Create != 0 && ext == ""
				if event.Op&(fsnotify.Create|fsnotify.Write) != 0 && !util.IsValidVideoExtension(ext) && !isDirCreate {
					continue
				}
```

DESPUÉS:

```go
				ext := strings.ToLower(filepath.Ext(event.Name))
				// Una carpeta nueva puede llevar puntos en el nombre ("Show.S01.1080p.WEB-DL-GRP"):
				// filepath.Ext devuelve ".web-dl-grp" y la carpeta se descartaba sin registrar su
				// watch, así que los archivos que llegaran después nunca disparaban eventos.
				isDirCreate := false
				if event.Op&fsnotify.Create != 0 && !util.IsValidVideoExtension(ext) {
					isDirCreate = ext == ""
					if !isDirCreate {
						if info, statErr := os.Stat(event.Name); statErr == nil && info.IsDir() {
							isDirCreate = true
						}
					}
				}
				if event.Op&(fsnotify.Create|fsnotify.Write) != 0 && !util.IsValidVideoExtension(ext) && !isDirCreate {
					continue
				}
```

- **Razón técnica:** fsnotify no es recursivo: cada carpeta nueva debe añadirse con Watcher.Add (lo hace el bloque `if event.Op&fsnotify.Create` más abajo, que además dispara el escaneo diferido de la carpeta). Pero ese bloque solo se alcanza si el evento supera el filtro de la línea 121, y el único caso de 'directorio' que el filtro reconoce es `ext == ""`. Los nombres de release de anime/series llevan puntos con mucha frecuencia ('Show.S01.1080p.WEB-DL-GRP' tiene Ext = '.web-dl-grp'; 'Vol.1' = '.1'), así que el Create de la carpeta se descarta con `continue`: no se registra el watch ni se programa el escaneo. Los videos que se copian/descargan dentro (que es justo lo que se quiere detectar) no generan ningún evento. La corrección hace un único os.Stat solo para los Create cuya extensión no es de video y conserva el comportamiento anterior para `ext == ""` (sigue sin stat).
- **Impacto esperado:** El auto-escaneo deja de ser ciego para las carpetas de descarga nuevas con puntos en el nombre; costo: un os.Stat por cada Create de archivo no-video (nfo, jpg, srt...).
- **Revisión manual (22/10):** Correcto: carpetas con puntos en el nombre ('Show.S01.1080p.WEB-DL-GRP') se registran ahora comprobando con os.Stat que sean directorios; el coste es un stat por evento Create de nombre con extensión no de video.
- **Riesgos / a revisar:** Un directorio cuyo nombre termine en una extensión de video (p. ej. 'Pelicula.mkv/') sigue sin tratarse como carpeta; es un caso ya existente y poco realista.
- **Evidencia del hallazgo:** watcher.go:119-123 (filtro), :125-158 (registro de la carpeta nueva con WalkDir+Add y Debouncer.Add), :61-67 (el watch inicial también agrega una carpeta a la vez, confirmando que no hay recursividad). util/fs.go:49-61: IsValidVideoExtension solo acepta extensiones de video, por lo que '.web-dl-grp' o '.s01' devuelven false.
- Nota de aplicación: línea real 132 (desfase 13)

#### RB-19 · reclaimExistingSegments marca como listo el último archivo de cada tramo, que puede estar truncado

- **Severidad:** Media · **Tipo:** Robustez · **Verificación:** mecánica + revisión manual
- **Problema:** Al crear un Pipeline, una goroutine escanea el directorio y marca como listos todos los segmentos `...-0-N.ts` presentes, sin comprobar que estén completos. El archivo más nuevo de un tramo puede ser el que ffmpeg estaba escribiendo cuando lo mataron (SIGKILL/taskkill), o el que una cabeza lanzada en ese momento escribe ahora (el escaneo corre concurrente con el primer runHead), y se serviría truncado.

**RB-19.1 — Archivo:** `internal/mediastream/cassette/pipeline.go` · **Líneas:** 196–215 · **Acción:** replace

ANTES:

```go
	pattern := filepath.Base(p.outPathFmt(0))
	reclaimed := 0

	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		var seg int32
		if _, err := fmt.Sscanf(entry.Name(), pattern, &seg); err != nil {
			continue
		}
		if seg < 0 || seg >= int32(p.segments.Len()) {
			continue
		}
		// File exists on disk — mark as ready with encoder ID 0.
		if !p.segments.IsReady(seg) {
			p.segments.MarkReady(seg, 0)
			reclaimed++
		}
	}
```

DESPUÉS:

```go
	pattern := filepath.Base(p.outPathFmt(0))
	var found []int32

	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		var seg int32
		if _, err := fmt.Sscanf(entry.Name(), pattern, &seg); err != nil {
			continue
		}
		if seg < 0 || seg >= int32(p.segments.Len()) {
			continue
		}
		found = append(found, seg)
	}

	// A file on disk counts as a finished segment only when the next one exists: ffmpeg opens
	// segment N+1 after closing N. The newest file of each run of consecutive segments may be
	// the one a killed ffmpeg was writing (or one a head launched meanwhile is writing right
	// now, since this scan runs concurrently with the first runHead); marking it ready would
	// serve a truncated segment.
	slices.Sort(found)
	reclaimed := 0
	for i, seg := range found {
		if i+1 == len(found) || found[i+1] != seg+1 {
			continue
		}
		// File exists on disk — mark as ready with encoder ID 0.
		if !p.segments.IsReady(seg) {
			p.segments.MarkReady(seg, 0)
			reclaimed++
		}
	}
```

**RB-19.2 — Archivo:** `internal/mediastream/cassette/pipeline.go` · **Líneas:** 15–16 · **Acción:** replace

ANTES:

```go
	"runtime"
	"strconv"
```

DESPUÉS:

```go
	"runtime"
	"slices"
	"strconv"
```

- **Razón técnica:** El segment muxer de ffmpeg crea el archivo N+1 recién después de cerrar el N, así que "existe el siguiente" es una prueba barata de que N está completo. Las cabezas se matan con util.KillCmd (SIGKILL / taskkill /F) o exec.CommandContext, sin finalizar el archivo en curso, y el directorio de la sesión se conserva (cooldown de 5 min en el tracker, 60 s de inactividad por pipeline) para reutilizarlo cuando el cliente vuelve o hls.js cambia de calidad y regresa. Hoy ese archivo parcial se marca listo con encoder 0 y c.File lo sirve tal cual. Saltar el último de cada tramo cuesta, como mucho, recodificar un segmento por tramo.
- **Impacto esperado:** Al volver a una calidad/sesión recién reapeada, el segmento justo donde se cortó la codificación anterior (o el que está escribiendo la cabeza nueva, si el ReadDir se demora, p. ej. antivirus en Windows) se entrega truncado: salto o congelación de audio/video en ese punto fijo de la reproducción, con Cache-Control immutable de un año para esa URL.
- **Revisión manual (22/10):** Correcto y conservador: solo se reclama un segmento si existe el siguiente consecutivo; se pierde la reutilización del último de cada tramo, que se recodifica bajo demanda.
- **Riesgos / a revisar:** Pierde la reutilización de un segmento por tramo contiguo (incluido el último legítimo del archivo, que se recodifica bajo demanda). Requiere `slices`, ya disponible en Go 1.26. Solo se reclaman archivos del encoder 0, como antes.
- **Evidencia del hallazgo:** pipeline.go:183 (`go p.reclaimExistingSegments()` en NewPipeline, concurrente con el primer GetSegment), :199-215 (marca listo todo archivo que coincide con el patrón, sin comprobar completitud); :407-413 y util/cmd_win.go:37-45 / cmd_not_win.go:31-40 (kill sin finalizar el archivo); session.go:361-397 y tracker.go:226-253 (pipelines que se matan y luego se recrean sobre el mismo s.Out); pipeline.go:673-762 (outPath con encoderID, la cabeza 0 reutiliza el slot libre).
- Nota de aplicación: línea real 195 (desfase -1)

#### RB-20 · Precarga sin espera: el cliente fijo "preload-client" hace que dos precargas simultáneas se maten las sesiones

- **Severidad:** Media · **Tipo:** Robustez · **Verificación:** mecánica + revisión manual
- **Problema:** Todas las precargas de "zero latency" usan el mismo cliente del tracker (preloadClientID). Si se solapan dos (p. ej. pasar el mouse por dos episodios en 25 s), cada GetVideoSegment cambia la ruta de ese único cliente y ClientTracker.handleClientUpdate mata la sesión de la ruta anterior, de modo que ambas precargas se reinician mutuamente; además PreloadDone de una detiene las cabezas de la ruta del otro.

**RB-20.1 — Archivo:** `internal/mediastream/playback.go` · **Líneas:** 196–200 · **Acción:** replace

ANTES:

```go
			ctx, cancel := context.WithTimeout(context.Background(), 25*time.Second)
			defer cancel()
			// Stop the heads the preload spawned once it is done (each head
			// otherwise keeps encoding up to 100 segments of this episode).
			defer tc.PreloadDone(preloadClientID)
```

DESPUÉS:

```go
			ctx, cancel := context.WithTimeout(context.Background(), 25*time.Second)
			defer cancel()
			// One tracker client per preloaded file: with a shared id two overlapping preloads
			// kept moving the same client between paths, and ClientTracker killed the session of
			// the path it left on every move.
			preloadClient := preloadClientID + ":" + ret.Hash
			// Stop the heads the preload spawned once it is done (each head
			// otherwise keeps encoding up to 100 segments of this episode).
			defer tc.PreloadDone(preloadClient)
```

**RB-20.2 — Archivo:** `internal/mediastream/playback.go` · **Líneas:** 213–213 · **Acción:** replace

ANTES:

```go
				_, _ = tc.GetVideoSegment(ctx, ret.Filepath, ret.Hash, ret.MediaInfo, cassette.StartQuality(ret.MediaInfo), int32(i), preloadClientID)
```

DESPUÉS:

```go
				_, _ = tc.GetVideoSegment(ctx, ret.Filepath, ret.Hash, ret.MediaInfo, cassette.StartQuality(ret.MediaInfo), int32(i), preloadClient)
```

**RB-20.3 — Archivo:** `internal/mediastream/playback.go` · **Líneas:** 221–221 · **Acción:** replace

ANTES:

```go
					_, _ = tc.GetAudioSegment(ctx, ret.Filepath, ret.Hash, ret.MediaInfo, defaultAudioIdx, int32(i), preloadClientID)
```

DESPUÉS:

```go
					_, _ = tc.GetAudioSegment(ctx, ret.Filepath, ret.Hash, ret.MediaInfo, defaultAudioIdx, int32(i), preloadClient)
```

- **Razón técnica:** ClientTracker.clients es un mapa por id. Con un id único, la precarga B sobrescribe `clients["preload-client"]` con la ruta B; handleClientUpdate ve old.Path != info.Path y llama killSessionIfDead(A): como ningún otro cliente está en A, hace Session.Kill() sobre la sesión que la precarga A estaba calentando. La goroutine A sigue (el error de GetVideoSegment se ignora con `_, _ =`), crea pipelines nuevos y vuelve a mover el cliente a A, matando B: ping-pong de ffmpeg arrancados y muertos hasta el timeout de 25 s. Además handlePreloadDone usa info.Path del único registro, por lo que el PreloadDone de A para las cabezas de B y las de A nunca se detienen. Con un id por archivo cada precarga queda aislada y handlePreloadDone actúa sobre su propia ruta.
- **Impacto esperado:** Hovers solapados (repository.go:548 PreloadTranscode se dispara por episodio) dejan ambos episodios sin calentar y generan arranques/kills de ffmpeg en cascada que compiten con la reproducción activa por los slots del governor.
- **Revisión manual (22/10):** Lógica coherente con ClientTracker: un cliente por archivo precargado evita que dos precargas simultáneas se maten las sesiones. Efecto: cada precarga deja su registro en el tracker hasta la purga horaria. Conviene una prueba manual de precarga doble.
- **Riesgos / a revisar:** Cada archivo precargado deja su registro de cliente en el tracker (hoy solo queda el último) hasta purgeInactive (tick de 1 h): su sesión y segmentos calentados (3 de video y 3 de audio, sin cabezas vivas) persisten más tiempo en disco y memoria. Es el comportamiento ya previsto para la precarga más reciente (comentario de handlePreloadDone), solo que ahora para todas.
- **Evidencia del hallazgo:** playback.go:23 (const preloadClientID), :200/:213/:221 (único id compartido); cassette.go:291-294 y :310-313 (ClientInfo{Client, Path}); tracker.go:180 (`t.clients[info.Client] = info`), :201-204 (`old.Path != info.Path` -> killSessionIfDead(old.Path)), :257-281 (Session.Kill si ningún cliente tiene la ruta), :92-107 (handlePreloadDone usa info.Path). Grep: preloadClientID solo se usa en playback.go.
- Nota de aplicación: línea real 217 (desfase 4); línea real 225 (desfase 4)

#### RB-21 · ScanSeries: comprobacion IsScanning y marcado no son atomicos (dos scans simultaneos de la misma serie)

- **Severidad:** Media · **Tipo:** Robustez · **Verificación:** mecánica + revisión manual
- **Problema:** ScanSeries consulta IsScanning y luego llama setScanning(true) en dos secciones criticas distintas; dos llamadas concurrentes para el mismo mediaID pasan ambas la comprobacion y ejecutan el pipeline completo (ffmpeg|fpcalc, descargas de themes, upsert) en paralelo.

**RB-21.1 — Archivo:** `internal/skipdetect/detector.go` · **Líneas:** 176–180 · **Acción:** replace

ANTES:

```go
func (d *Detector) setScanning(mediaID int, scanning bool) {
	d.scanMu.Lock()
	defer d.scanMu.Unlock()
	d.isScanning[mediaID] = scanning
}
```

DESPUÉS:

```go
// tryStartScanning marca la serie como en escaneo de forma atomica (test-and-set bajo
// scanMu). Devuelve false si ya habia un scan en curso para ese mediaID.
func (d *Detector) tryStartScanning(mediaID int) bool {
	d.scanMu.Lock()
	defer d.scanMu.Unlock()
	if d.isScanning[mediaID] {
		return false
	}
	d.isScanning[mediaID] = true
	return true
}

func (d *Detector) setScanning(mediaID int, scanning bool) {
	d.scanMu.Lock()
	defer d.scanMu.Unlock()
	if scanning {
		d.isScanning[mediaID] = true
		return
	}
	delete(d.isScanning, mediaID)
}
```

**RB-21.2 — Archivo:** `internal/skipdetect/detector.go` · **Líneas:** 227–231 · **Acción:** replace

ANTES:

```go
	if d.IsScanning(mediaID) {
		return errors.New("a skip scan is already in progress for this series")
	}
	d.setScanning(mediaID, true)
	defer d.setScanning(mediaID, false)
```

DESPUÉS:

```go
	if !d.tryStartScanning(mediaID) {
		return errors.New("a skip scan is already in progress for this series")
	}
	defer d.setScanning(mediaID, false)
```

- **Razón técnica:** El patron check-then-act con dos locks separados deja una ventana TOCTOU. Los puntos de entrada son varios y no coordinados: handlers/mediastream.go:428 (trigger oportunista en goroutine) y 727-740 (scan manual en goroutine) solo hacen un IsScanning previo no vinculante, y skipdetect/library_scan.go:81 llama ScanSeries directamente sin ninguna comprobacion. Si el usuario lanza un scan manual de la serie X mientras ScanLibrary esta justo en X, ambos leen isScanning[X]==false y corren a la vez. Ademas, cuando el primero termina, su defer setScanning(false) hace que IsScanning(X) devuelva false aunque el segundo siga corriendo, de modo que un tercer disparador tambien entra. El test-and-set atomico cierra la ventana; borrar la entrada al terminar evita que el mapa conserve una clave por cada media escaneado. No hay otras referencias a isScanning/setScanning fuera de detector.go (Grep).
- **Impacto esperado:** Evita duplicar el trabajo mas caro del servidor (decodificar ~15 min de audio por episodio con ffmpeg+fpcalc, y en Drive leer esos rangos por la red consumiendo cuota de descarga) y evita que IsScanning mienta, que es lo que usa la UI y los triggers para no relanzar. Mantiene el contrato: la segunda llamada concurrente recibe el mismo error 'a skip scan is already in progress for this series'.
- **Revisión manual (22/10):** Correcto: tryStartScanning es un test-and-set bajo scanMu y setScanning(false) borra la clave; IsScanning sigue siendo equivalente.
- **Riesgos / a revisar:** Ninguno funcional: las pruebas existentes no tocan isScanning ni setScanning (Grep). Borrar la clave en lugar de guardar false es observablemente identico para IsScanning.
- **Evidencia del hallazgo:** detector.go:226-231 (IsScanning y setScanning por separado, cada uno con su Lock/Unlock de scanMu en 176-187); Grep de callers: handlers/mediastream.go:428, 727, 740 y skipdetect/library_scan.go:81; Grep de '.isScanning' y 'setScanning(' solo muestra detector.go (en drive/service.go isScanning es otro campo).
- Nota de aplicación: línea real 182 (desfase 6); línea real 249 (desfase 22)

#### RB-22 · ThumbnailCache.Set: dos Set simultaneos de la misma clave desincronizan currentBytes para siempre

- **Severidad:** Media · **Tipo:** Robustez · **Verificación:** mecánica + revisión manual
- **Problema:** Set hace Remove, ajusta currentBytes y luego Add sin exclusion mutua. Si dos goroutines guardan la misma clave a la vez, el segundo Add reemplaza el valor sin disparar el callback de eviccion y currentBytes queda inflado en len(data) de forma permanente.

**RB-22.1 — Archivo:** `internal/util/cache/image_cache.go` · **Líneas:** 4–4 · **Acción:** replace

ANTES:

```go
	"sync/atomic"
```

DESPUÉS:

```go
	"sync"
	"sync/atomic"
```

**RB-22.2 — Archivo:** `internal/util/cache/image_cache.go` · **Líneas:** 12–12 · **Acción:** replace

ANTES:

```go
	cache        *lru.Cache[string, []byte]
```

DESPUÉS:

```go
	cache        *lru.Cache[string, []byte]
	setMu        sync.Mutex // serializa Set y Purge: currentBytes debe igualar la suma de bytes guardados
```

**RB-22.3 — Archivo:** `internal/util/cache/image_cache.go` · **Líneas:** 66–68 · **Acción:** replace

ANTES:

```go
	// Add over an existing key does not fire the evict callback, so the old bytes would
	// never be discounted. Remove first (it does fire it) to keep currentBytes accurate.
	c.cache.Remove(key)
```

DESPUÉS:

```go
	// Remove + Add no pueden entrelazarse con otro Set de la misma clave: el segundo Add
	// pisaria el valor sin disparar el callback de eviccion y currentBytes seguiria contando
	// bytes que ya no estan en la cache. Get no toma este lock.
	c.setMu.Lock()
	defer c.setMu.Unlock()

	// Add over an existing key does not fire the evict callback, so the old bytes would
	// never be discounted. Remove first (it does fire it) to keep currentBytes accurate.
	c.cache.Remove(key)
```

**RB-22.4 — Archivo:** `internal/util/cache/image_cache.go` · **Líneas:** 83–84 · **Acción:** replace

ANTES:

```go
	c.cache.Purge()
	c.currentBytes.Store(0)
```

DESPUÉS:

```go
	c.setMu.Lock()
	defer c.setMu.Unlock()
	c.cache.Purge()
	c.currentBytes.Store(0)
```

- **Razón técnica:** El mutex solo serializa a los escritores (Set/Purge, ruta fria tras un miss); Get sigue sin lock. El callback de eviccion de lru solo hace un atomic.Add, no toma setMu, por lo que no hay reentrancia ni deadlock. Con la seccion Remove -> bucle de eviccion -> Add atomica respecto de otros Set, currentBytes coincide siempre con los bytes realmente almacenados; Purge bajo el mismo lock evita que un Set concurrente quede contado en cero tras el Store(0).
- **Impacto esperado:** Cada colision suma len(data) (30-60 KB por miniatura JPEG de 480 px) a currentBytes sin que haya nada que lo reste. Con el limite por defecto de 256 MB, tras unos miles de colisiones durante la vida del proceso, la guarda for c.currentBytes.Load()+dataSize > c.maxBytes && c.cache.Len() > 0 { RemoveOldest } vacia toda la LRU en cada Set: la tasa de aciertos en memoria cae a cero y cada tile vuelve a leerse del disco (os.ReadFile) hasta que alguien ejecute Purge. Las colisiones son habituales: una grilla fria o dos clientes piden el mismo hash, ambos fallan el Get y ambos terminan en Set (comparten el mismo vuelo de singleflight).
- **Revisión manual (22/10):** Correcto: el mutex setMu serializa Set y Purge, de modo que currentBytes iguala la suma de bytes guardados; Get no lo toma.
- **Riesgos / a revisar:** Bajo: el mutex solo agrega una seccion critica corta a Set, que ya hace trabajo de eviccion bajo el lock interno de lru. No cambia firmas ni ningun caller (thumbnail.go:205, drive_thumbnail.go:80 y :93, cache_handlers.go:192). El valor del campo en gofmt queda alineado porque la nueva linea usa la misma columna que currentBytes.
- **Evidencia del hallazgo:** Read internal/util/cache/image_cache.go:60-79: Remove(key) (linea 68), luego currentBytes.Add(dataSize) (77) y cache.Add (78) sin lock; el propio comentario de las lineas 66-67 reconoce que Add sobre una clave existente no dispara el callback. Interleaving: A.Remove (no-op), B.Remove (no-op), A.Add suma n, B.Add suma n y pisa el valor sin callback: currentBytes=2n con n real. internal/core/app.go:425-436 construye la cache con maxBytes>0 (256 MB por defecto). Callers sin exclusion: internal/handlers/thumbnail.go:183-205 y drive_thumbnail.go:71-93 hacen Get -> miss -> Set.
- Nota de aplicación: línea real 13 (desfase 1); línea real 68 (desfase 2); línea real 91 (desfase 8)

#### RB-23 · Proxy de imagenes: el tope de 25 MB no protege la memoria porque req ya leyo todo el cuerpo

- **Severidad:** Media · **Tipo:** Robustez · **Verificación:** mecánica + revisión manual
- **Problema:** imageProxyClient usa la lectura automatica de req v3: el cliente hace io.ReadAll del cuerpo completo antes de devolver la respuesta, de modo que el io.LimitReader(resp.Body, 25MB+1) de fetchImage opera sobre un buffer que ya esta entero en memoria y luego lo copia otra vez.

**RB-23.1 — Archivo:** `internal/util/proxies/image_proxy.go` · **Líneas:** 28–29 · **Acción:** replace

ANTES:

```go
	// El dialer rechaza IPs internas en cada conexión (redirects, DNS rebinding).
	imageProxyClient = req.C().SetTimeout(30 * time.Second).SetDial(util.ProxySafeDialContext)
```

DESPUÉS:

```go
	// El dialer rechaza IPs internas en cada conexión (redirects, DNS rebinding).
	// DisableAutoReadResponse: por defecto req lee el cuerpo entero en memoria antes de
	// devolver la respuesta, y el tope de 25 MB de fetchImage no protegería nada.
	imageProxyClient = req.C().SetTimeout(30 * time.Second).SetDial(util.ProxySafeDialContext).DisableAutoReadResponse()
```

- **Razón técnica:** Con DisableAutoReadResponse resp.Body es el stream real: io.LimitReader corta la lectura a 25 MB + 1 byte, fetchImage devuelve el error existente y el defer resp.Body.Close() cierra la conexion sin descargar el resto. El timeout de 30 s de req.C().SetTimeout sigue cubriendo la lectura del cuerpo. Para respuestas validas se elimina ademas una copia completa del cuerpo (resp.body del cliente y la de io.ReadAll). El resto del flujo (status, Content-Type, SafeImageContentType, escritura atomica) no cambia.
- **Impacto esperado:** Una URL que apunte a un origen que sirva cientos de MB o GB dentro de los 30 s (/image-proxy?url=... acepta cualquier URL publica que pase IsValidProxyURL, y sin password lo puede pedir cualquier cliente de la LAN) carga todo en el heap del servidor antes de ser rechazada; con varias peticiones en paralelo es un riesgo real de OOM. Las imagenes legitimas (TMDB, decenas de KB) dejan de duplicarse en memoria, y Prewarm (concurrencia 3 y 2 con miles de URLs) genera menos presion al GC.
- **Revisión manual (22/10):** Correcto: DisableAutoReadResponse hace que el límite de 25 MB proteja de verdad la memoria. fetchImage ya cierra resp.Body con defer, así que no hay fuga de conexiones.
- **Riesgos / a revisar:** Bajo: las pruebas que reemplacen imageProxyClient por otro req.C() seguiran leyendo en automatico, sin afectar el resultado. Si algun test dependiera de leer resp.String() despues de GetImage no aplica, porque fetchImage solo usa resp.Body, resp.StatusCode y resp.Header. Opcionalmente se podria rechazar antes con resp.ContentLength > maxImageSize, pero no lo inclui para no depender de la ambiguedad de campos embebidos de req.Response.
- **Evidencia del hallazgo:** Read internal/util/proxies/image_proxy.go:29 (cliente sin DisableAutoReadResponse) y :168-175 (io.LimitReader sobre resp.Body). Source de la dependencia (go.mod: github.com/imroc/req/v3 v3.57.0), client.go:1778-1783: "if resp.Err == nil && !c.disableAutoReadResponse && !r.isSaveResponse && !r.disableAutoReadResponse && resp.StatusCode > 199 { resp.ToBytes(); resp.Body = io.NopCloser(bytes.NewReader(resp.body)) }"; response.go:251 ToBytes hace io.ReadAll(r.Body) sin limite. client.go:801-803 documenta DisableAutoReadResponse() *Client.

#### RB-24 · Cliente Drive: el refresco del token OAuth usa context.Background() y http.DefaultClient, sin timeout ni cancelacion

- **Severidad:** Baja · **Tipo:** Robustez · **Verificación:** mecánica + revisión manual
- **Problema:** config.TokenSource(context.Background(), ...) hace que el refresco use http.DefaultClient (sin Timeout ni ResponseHeaderTimeout) y que ReuseTokenSource lo serialice con un mutex; si el endpoint OAuth acepta la conexion y no responde, todos los pedidos a Drive quedan bloqueados en oauth2.Transport sin que su contexto pueda cancelarlos.

**RB-24.1 — Archivo:** `internal/drive/client.go` · **Líneas:** 62–73 · **Acción:** replace

ANTES:

```go
	tokenSource := config.TokenSource(context.Background(), initialToken)
	reusingTokenSource := oauth2.ReuseTokenSource(initialToken, tokenSource)

	baseTransport := &http.Transport{
		Proxy:                 http.ProxyFromEnvironment,
		MaxIdleConns:          50,
		MaxIdleConnsPerHost:   20,
		IdleConnTimeout:       90 * time.Second,
		TLSHandshakeTimeout:   10 * time.Second,
		ResponseHeaderTimeout: 30 * time.Second,
		ExpectContinueTimeout: 1 * time.Second,
	}
```

DESPUÉS:

```go
	baseTransport := &http.Transport{
		Proxy:                 http.ProxyFromEnvironment,
		MaxIdleConns:          50,
		MaxIdleConnsPerHost:   20,
		IdleConnTimeout:       90 * time.Second,
		TLSHandshakeTimeout:   10 * time.Second,
		ResponseHeaderTimeout: 30 * time.Second,
		ExpectContinueTimeout: 1 * time.Second,
	}

	// El refresco del token corre fuera del contexto de cada pedido (ReuseTokenSource lo
	// serializa con un mutex) y, sin oauth2.HTTPClient, usa http.DefaultClient, que no tiene
	// timeout: un endpoint OAuth que acepta la conexion y no contesta dejaria colgados todos
	// los pedidos a Drive esperando ese lock. Se le da un cliente acotado.
	tokenCtx := context.WithValue(context.Background(), oauth2.HTTPClient, &http.Client{
		Transport: baseTransport,
		Timeout:   30 * time.Second,
	})
	tokenSource := config.TokenSource(tokenCtx, initialToken)
	reusingTokenSource := oauth2.ReuseTokenSource(initialToken, tokenSource)
```

- **Razón técnica:** En golang.org/x/oauth2, Config.TokenSource(ctx, t) guarda ese ctx en el tokenRefresher y retrieveToken resuelve el cliente HTTP con internal.ContextClient(ctx): sin el valor oauth2.HTTPClient cae a http.DefaultClient (Transport por defecto, sin ResponseHeaderTimeout y Timeout 0). La baseTransport con ResponseHeaderTimeout de 30 s que ya existe en NewClient solo protege las llamadas a la API, no el refresco. Como oauth2.Transport.RoundTrip pide el token antes de cada pedido y ReuseTokenSource lo protege con un mutex, un unico refresco colgado bloquea a todos los demas goroutines (listado, streaming, miniaturas, userinfo) sin que ctx.Done() del pedido los libere. Pasar baseTransport como Transport conserva el proxy de entorno y aplica el ResponseHeaderTimeout; Timeout cubre ademas el cuerpo. No hay recursion: el cliente de refresco no usa oauth2.Transport.
- **Impacto esperado:** Un cuelgue del endpoint de tokens se convierte en un error a los 30 s (el pedido siguiente reintenta el refresco) en lugar de bloquear indefinidamente toda la integracion de Drive, incluida la reproduccion en curso que necesita renovar el token.
- **Revisión manual (22/10):** Correcto: el refresco del token OAuth pasa a un http.Client con timeout de 30 s sobre el mismo transporte que Drive.
- **Riesgos / a revisar:** Reordena la declaracion de baseTransport antes del token source (el resto del constructor no cambia). El import de oauth2 y context ya existen. Client.Close() ya llama transport.CloseIdleConnections() sobre la misma baseTransport, ahora tambien cubre las conexiones de refresco.
- **Evidencia del hallazgo:** client.go:62-63 (context.Background() y ReuseTokenSource), 65-73 (baseTransport definido despues y solo usado para la API), 75-83 (oauth2.Transport + http.Client con Timeout 0); Grep de 'oauth2.HTTPClient' no encuentra ninguna otra configuracion en el paquete drive.
- Nota de aplicación: línea real 61 (desfase -1)

#### RB-25 · Hydrator: rateLimiter.Wait(context.Background()) ignora la cancelación del escaneo

- **Severidad:** Baja · **Tipo:** Robustez · **Verificación:** mecánica
- **Problema:** Las dos esperas del limitador antes de GetAnimeMetadata usan context.Background() aunque el ctx del errgroup (cancelado con el escaneo) está disponible en hydrateGroupMetadata.

**RB-25.1 — Archivo:** `internal/library/scanner/hydrator.go` · **Líneas:** 361–365 · **Acción:** replace

ANTES:

```go
				if !fetchedGroupMetadata && fh.MetadataProviderRef != nil {
					_ = rateLimiter.Wait(context.Background()) // solo falla si n > burst
					groupMetadata, _ = fh.MetadataProviderRef.GetAnimeMetadata(mID)
					fetchedGroupMetadata = true
				}
```

DESPUÉS:

```go
				if !fetchedGroupMetadata && fh.MetadataProviderRef != nil {
					// Con ctx el Wait vuelve en cuanto se cancela el escaneo (antes quedaba
					// bloqueado hasta que el limitador liberaba su turno).
					if rateLimiter.Wait(ctx) == nil {
						groupMetadata, _ = fh.MetadataProviderRef.GetAnimeMetadata(mID)
					}
					fetchedGroupMetadata = true
				}
```

**RB-25.2 — Archivo:** `internal/library/scanner/hydrator.go` · **Líneas:** 407–411 · **Acción:** replace

ANTES:

```go
				if !fetchedForcedMetadata && fh.MetadataProviderRef != nil {
					_ = rateLimiter.Wait(context.Background()) // solo falla si n > burst
					forcedMetadata, forcedMetadataErr = fh.MetadataProviderRef.GetAnimeMetadata(fh.ForceMediaId)
					fetchedForcedMetadata = true
				}
```

DESPUÉS:

```go
				if !fetchedForcedMetadata && fh.MetadataProviderRef != nil {
					if forcedMetadataErr = rateLimiter.Wait(ctx); forcedMetadataErr == nil {
						forcedMetadata, forcedMetadataErr = fh.MetadataProviderRef.GetAnimeMetadata(fh.ForceMediaId)
					}
					fetchedForcedMetadata = true
				}
```

- **Razón técnica:** limiter.NewLimiter(5s, 20) entrega un token cada 250 ms tras la ráfaga inicial de 20; con context.Background() cada worker bloqueado en Wait debe esperar su turno completo aunque el escaneo ya esté cancelado, y luego todavía dispara la petición al proveedor. Con ctx, Wait devuelve el error de contexto de inmediato y se omite la llamada de red. Si la espera falla, groupMetadata queda en nil, caso ya contemplado: tryPartRelativeNormalization devuelve (0, false) cuando animeMetadata == nil (hydrator_rules.go:42-44), y la rama forzada cae en el manejo existente de forcedMetadataErr != nil (líneas 413-425), sin desreferenciar forcedMetadata.
- **Impacto esperado:** La cancelación del escaneo (o el cierre del servidor) deja de quedar retenida por las esperas del limitador de hasta NumCPU workers y se evitan peticiones de metadata tras cancelar.
- **Riesgos / a revisar:** El comportamiento solo cambia con el contexto cancelado o vencido. Numeración original: aplicar de abajo hacia arriba.
- **Evidencia del hallazgo:** hydrator.go:83 (ctx del errgroup, derivado del ctx del escaneo), :113-117 (ctx recibido por hydrateGroupMetadata), :362 y :408 (context.Background()); limiter/limiter.go:35-45 (rate.Every(tick/burst) y Wait(ctx) delega en rate.Limiter.Wait); `context` sigue importado y usado en las firmas.
- Nota de aplicación: línea real 360 (desfase -1); línea real 409 (desfase 2)

## 3. Comandos de verificación

Desde `D:\Proyectos_personales\KameHouse-rio-grande\apps\server`:

```bash
gofmt -l ./internal ./codegen main.go          # solo deben salir watcher_test.go y boundedcache.go (ya venían así)
go build ./...                                  # compila todos los paquetes
go vet ./...                                    # análisis estático (incluye tests)
go test ./... -short -count=1                   # tests del servidor (39 paquetes tras el plan)
go test -race -short -count=1 ./internal/util/filecache ./internal/events ./internal/database/db ./internal/drive ./internal/util/proxies ./internal/handlers/... ./internal/mediastream/...
go build -o kamehouse-check.exe .               # binario completo (embebe web/); borrarlo después
```

Comprobaciones por fase:

```bash
# Fase 1: no deben aparecer funciones inalcanzables nuevas ni referencias rotas
go run golang.org/x/tools/cmd/deadcode@latest ./...
golangci-lint run --disable-all --enable unused,staticcheck ./...
# Si se eliminaron rutas: regenerar codegen y comprobar el frontend
go run ./codegen
pnpm -C ../web exec tsc --noEmit
# Fase 3: contexto, cierre de recursos y nil
golangci-lint run --disable-all --enable contextcheck,nilerr,bodyclose,noctx,sqlclosecheck ./...
```

## Apéndice A — Clasificación de endpoints (agentes E1 y E2)

_Sin datos._
## Apéndice B — Candidatos que los agentes descartaron

Falsos positivos o hallazgos sin evidencia suficiente. Se listan para no volver a investigarlos.

- **ab05b4bd24850616a:** 1) scanner/dragonball_resolver*.go, dragonball_path_resolver*.go, dragonball_sagas.go, database/db/db_dragonball_heal.go, metadata_provider/dragonball_filler.go: no importan el módulo, no aparecen en deadcode/zero-ref/unused-strict (ninguna entrada fuera de internal/api/dragonball), son parte del pipeline de escaneo/migración; se mantienen. 2) HandleGetDragonballLore (/api/v1/lore/dragonball): lo consume el frontend (GetDragonballLore en apps/web/src/api/generated/endpoints.ts y tipos DragonballLore*), se mantiene. 3) codegen/generated/public_structs.json: no propongo editar a mano el JSON generado (17 entradas obsoletas de ~1.000 líneas); se regenera con go run ./codegen, anotado en riesgos. 4) SA5011 de scanner/dragonball_resolver_test.go:286 (lint.txt): es un posible nil deref en un test, no código muerto, fuera de la lente. 5) Borrado parcial del módulo: descartado, porque no hay ninguna pieza que otro código use (ni domain, ni dto, ni los seeds); las 17 piezas son cerradas sobre sí mismas, por eso va en un único hallazgo. 6) Dependencias de go.mod: el módulo solo usa echo/v4, usado en todo el servidor; no hay dependencia que quede sin uso.
- **a3801241845a661ad:** Los avisos bodyclose de internal/drive/chunked.go:186 y :257 son FALSOS POSITIVOS: la respuesta se guarda en prefetched/r.cur y se cierra siempre. En Read al llegar a EOF (r.cur.Close), en Close() via r.cur.Close() y dropPrefetch (que drena el canal buffered en una goroutine y cierra p.resp.Body), y openNext cierra p.resp.Body cuando la respuesta prefetched no coincide o trae error. La goroutine de prefetch no se filtra porque ch tiene buffer 1. En OpenChunkedRange el resp inicial se cierra en las ramas total<0 y start>=total y en el resto pasa a r.cur. Los avisos bodyclose de tests (blockcache_test.go, chunked_test.go, websocket_limit_test.go) son solo de pruebas. blockcache.runDownload: defer resp.Body.Close(), ready se cierra una sola vez (select protege el doble cierre) e inflight se limpia en todas las ramas. intelligence/cache.go cleanupLoop (for range ticker.C sin salida) existe en una sola instancia creada por Selector en handlers/routes.go:257, de vida igual al proceso: no es una fuga acumulativa. ExitIfNoConnsAsDesktopSidecar tambien es una goroutine de vida de proceso (el mensaje de log dice 10 segundos pero el timeout es 60 s: cosmetico). skipdetect/fpcalc.go FingerprintFile/FingerprintRange: pipes cerrados y procesos matados en todas las ramas, errCh evita fuga. ensureFpcalc: defers en orden correcto (Close antes de Remove). ffmpegutil/downloader.go: Body, tmpFile y temporales se cierran/borran en todas las ramas de error y exito. pretranscode.transcode: StdoutPipe leido hasta EOF antes de Wait (orden correcto segun os/exec) y tmpDir con defer RemoveAll. cassette/keyframe.go: el defer hace cancel, Close y Wait. cassette/pipeline.go readSegments/reapProcess: el cierre doble de stdin/stdout es tolerado y cmd.Wait siempre se ejecuta en reapProcess. extract.go progressWriter: pwr.Close() con defer y el lector drena. tlsutil.go, health.go, anidb_provider.go, filecache.go: Close en todas las ramas. library/scanner/debouncer.go: puede ejecutar el callback dos veces si llega un Add durante el callback, pero no pierde ni filtra recursos. metadata_mapping.readBody usa io.ReadAll sin tope, pero no es un tema de cierre. noctx en skipdetect/fpcalc.go:121 (client.Get sin contexto): tiene Timeout de 2 min y es de arranque; no se reporta. config_watcher.go y background_queue.go: salen por ctx.Done() y se detienen limpiamente.
- **a4b58bf6a56f565e5:** Descartados por ya estar protegidos con singleflight/inflight y clave correcta: miniaturas locales (thumbnailSingleFlight.DoChan con context.WithoutCancel, semaforo thumbnailGenSem y ffprobe de seek dentro del vuelo; thumbnail_warm usa el mismo ensureThumbnailFile); miniaturas de Drive (thumbnailSingleFlight.Do con ctx desacoplado de 20 s y semaforo driveThumbSem; solo falta que el seguidor no abandona su espera al cancelar, impacto minimo); shelf_images (pasa por ImageProxy.GetImage, que usa imageProxyFlights con clave = hash de la URL; ignorar headers en la clave es aceptable); proxy de imagenes (descarga sin tope de concurrencia entre URLs distintas, pero eso no es deduplicacion); TMDB (tmdb.go ya tiene flights); Jikan (JikanProviderImpl deduplica por ID con inflight map, outage y failedUntil; HandleGetMalId usa jikanSingleFlight con ctx desacoplado); containerGroup de mediastream (correcto para su alcance, la brecha se cubre en el hallazgo de MediaInfoExtractor); BlockCache de Drive (inflight por bloque ya existente); GetCuratedHome, animeEntryGroup, localFilesSingleFlight y metadataFetchCache (ya con singleflight y double-check); chronology_frames (solo consultas SQLite indexadas, sin trabajo costoso duplicado); handlers/tmdb.go fallback a Jikan (ruta manual y poco concurrente); AniList SearchAnime (sin cache ni clave natural reutilizable, la deduplicacion aportaria poco); GetThemesByMALID (limitador 1 req/s + cache persistente en DB, riesgo de duplicado muy bajo)." 
- **a4d0df1ff652cf6c2:** Descartados como falsos positivos (ya protegidos o sin camino a nil): (1) h.App.Settings.GetLibrary() en handlers/scan.go y mediastream.go:690: Settings.GetLibrary() tiene receptor nil-safe (models_helper.go:3-8) y devuelve &LibrarySettings{}. (2) InitOrRefreshModules retorna pronto si settings==nil; performActionsOnce y handleConfigChange comprueban a.Settings == nil. (3) autoscanner.go:199 settings.Library: GetSettings garantiza err==nil implica puntero no nil (GetStoredSettings crea la fila por defecto en ErrRecordNotFound). (4) anime_enrichment.go:600 'settings, _ := GetSettings()': getActiveProvider comprueba settings != nil. (5) ContinuityManager.GetSettings devuelve nil solo con receptor nil y todos los handlers ya comprueban nil; NewManager siempre inicializa settings y TelemetryManager. (6) Drive: Service.GetClient devuelve error si esta deshabilitado y todos los callers (service.go, scan.go, subtitles.go, handlers/drive*.go) comprueban err; ScanProgress.Clone es nil-safe; NewService siempre recibe logger. (7) mediastream.Repository: transcoder/preTranscoder/settings son mo.Option con accesores bajo lock; initializeTranscoder llama settings.MustGet() solo tras directPlayOnlyOf(settings), que devuelve true (y corta) si no hay ajustes; InitializeModules rechaza settings nil. (8) metadata_cache.go:204: singleflight con 'return nil, nil' ya protegido por 'if v == nil'. (9) Otras type assertions sin comma-ok (playback.go:276, drive_thumbnail.go:151, image_proxy.go:145, tmdb.dedupe, dynamic.go:39, platform/dynamic.go:36, resolver.go:158, drivesubs.go): los closures devuelven siempre valores tipados o error; los atomic.Value se inicializan con wrapper no nil en el constructor; los sync.Map solo guardan un tipo. (10) DynamicProvider/DynamicPlatform: GetProvider/GetPlatform podrian devolver interfaz nil, pero NewProvider nunca devuelve nil y SetProvider/NewDynamicPlatform siempre reciben un valor no nil (simulatedPlatform comprobado). (11) Loggers inyectados tarde o nil: todos los constructores revisados (NewBackgroundQueue, skipdetect.New, NewIntelligenceService, NewMediaInfoExtractor, ffmpegutil.NewManager, scanner Matcher/FileHydrator/ScannerOptions, FileProber) reciben a.Logger/scn.Logger no nil; embedded_metadata.go ya usa loggerOrNop; notifier.Global() es seguro antes de Init (database==nil retorna) y comprueba logger/ws != nil. (12) crashlog.GlobalCrashLogger no tiene nil-deref: logDir es mo.Option y se consulta con Get(); hay carreras en SetLogDir/Close (sin mutex) pero no son nil-pointer ni objeto de este barrido. (13) handleConfigChange recrea tmdb.NewClient sin conservar idioma ni reconectar los providers: es un defecto funcional, no de nil, y arreglarlo exige tocar mas piezas sin evidencia suficiente. (14) NewMediaFetcher: opts.LocalFiles/opts.Logger se comprueban y la funcion esta bajo HandlePanicInModuleWithError. (15) Semillas de logger sin uso (jikan, anilist, jikan_platform, simulated_platform, providers de metadata, filler, feature_flags): son campos que nunca se desreferencian, no hay nil-deref posible; su eliminacion es codigo muerto, area de otros agentes. (16) Los SA5011 de lint.txt estan todos en tests (mediastream_skip_test, matroska_test, parser_test, pipeline_test, dragonball_resolver_test): fuera de alcance de produccion.
- **a3b02b16633719438:** - Procesos hijos (cmd.Cancel/WaitDelay): NewCmdCtx no fija Cancel ni WaitDelay, pero ffmpeg/ffprobe/fpcalc/nvidia-smi no crean nietos que hereden los pipes, asi que Process.Kill (default de CommandContext) cierra los pipes y Wait retorna; en cassette/pipeline.go ademas hay KillCmd/tree-kill propio y reapProcess. No hay bloqueo demostrable; endurecer con WaitDelay seria especulativo.\n- Descargas/trabajos desacoplados A PROPOSITO (comentados en el codigo): blockcache.runDownload (descarga compartida con fetchTimeout), drive_thumbnail.fetchDriveThumbnail y ensureThumbnailFile (singleflight, WithoutCancel), drivesubs_window apertura (octx), startAttachmentExtraction (comparte entre clientes), validateDriveCache, HandleResolveMAL (singleflight sobre ShutdownCtx), keyframe extraction (indice compartido y cacheado a disco, 20 min), PreloadPlayback (25 s acotado), WarmSession (solo espera). Cancelar al primer cliente los cancelaria a todos.\n- drive_subtitles.go:46 addDriveEmbeddedSubtitles con Background+20 s: la apertura de la sesion ya es desacoplada y ctx solo acortaria la espera de un waiter; ganancia marginal con 5 ediciones; descartado.\n- HandleUpdateAnimeEntryProgress / HandleTMDB...: RefreshAnimeCollection(context.Background()) tras la mutacion: la plataforma activa (simulated/jikan) devuelve vacio sin red y la actualizacion de cache debe completarse aunque el cliente se vaya.\n- core.App.GetAnimeCollection(context.Background()): solo existen plataformas simulated y jikan_platform, que no hacen red; sin impacto.\n- Consultas GORM sin WithContext en handlers: SQLite local en WAL con consultas cortas; admin.go y drive_mediastream.go ya usan WithContext donde hay riesgo; propagar ctx a todo el paquete db seria un refactor sin impacto medible.\n- metadata_provider jikan_impl/tmdb_impl/anilist_impl con Background+30 s: la interfaz Provider no recibe ctx y las llamadas van por inflight/singleflight compartido; cambiarlo exige tocar toda la interfaz.\n- image_proxy.fetchImage (req sin ctx): corre bajo imageProxyFlights.Do (compartido) y deja la imagen en cache de disco, que beneficia la siguiente visita.\n- health.checkFFmpeg -> GetStatus/GetBinaryVersion (Background 3 s): resultado cacheado por (ruta, tamano, mtime); ctx no aporta.\n- library/scanner/persistence.go:81 (TMDB on-demand con Background 5 s por media): el scan solo se cancela al apagar y solo afecta a medios sin hidratar; impacto bajo con edicion de 5 archivos; descartado.\n- bodyclose en drive/chunked.go y nilerr en handlers/status.go, system.go, directory_selector.go, watcher.go, filecache.go: son falsos positivos por diseno (el Body se cierra en blockReader/chunkReader.Close y los errores se ignoran a proposito para listar/degradar), ademas no son de propagacion de contexto.\n- main.go contextcheck (Shutdown/Cleanup con context.Background nuevo): es correcto, el apagado necesita un contexto que sobreviva a la cancelacion de la senal.\n- videofile.GetInfo/FfprobeGetInfo sin ctx: ya existe la variante *Context y los usos restantes (buildMediaContainer bajo singleflight, WarmMediaInfo, makeDummyKeyframes) son de fondo o compartidos.
- **ae9aef5555d592e7d:** Descartado: (1) collection_hydrate.go:61 `Find(&allLibraryMedia)` completo: se podría usar Omit(description, ...) como en swimlanes, pero esas entradas viajan al cliente y no pude verificar que el frontend no use description/synonyms en la colección; (2) PRAGMAs: la configuración es correcta (WAL, busy_timeout 5000, synchronous NORMAL, cache -32000, mmap 128 MB, temp_store MEMORY, journal_size_limit, foreign_keys ON); no propuse `_txlock=immediate` porque todas las Transaction() revisadas (UpsertBatch, SyncLocalFiles, cleanup, chronology overrides) empiezan con una escritura, sin patrón lectura-luego-escritura que dispare SQLITE_BUSY_SNAPSHOT; tampoco `PRAGMA optimize` (efecto especulativo con pool de conexiones); (3) UpsertGhostAssociation (SELECT + Save/Create por archivo sub-umbral): consulta indexada y volumen bajo, sin impacto demostrable; la carrera por path no unique es teórica; (4) settings.go/theme.go `Save(settings)`: escrituras raras de una sola fila; (5) tag_lanes.go: carga todos los tags y los deserializa en Go, pero está cacheado 30 min y la agregación SQL con json_each no es equivalente (filas con elementos no string se descartan hoy); (6) buildEpisodeSwimlaneByTag `tags LIKE '%\"x\"%'` recorre la tabla pero va cacheado 30 min; (7) local_file `path LIKE ? ESCAPE` en SyncPartial/indexer: no usa índice por el ESCAPE, pero es un Pluck de una columna sobre tabla de miles de filas, sin evidencia de costo; (8) cleanup_manager borrado por media_id en watch_histories/user_media_progress sin índice líder: operación rara y con pocas filas huérfanas; (9) HandleSaveEpisodeSkipTimes `Create(&skipTimes)` sin CreateInBatches: máx ~500 filas x 9 columnas, por debajo del límite de variables de SQLite; (10) skipdetect/library_scan.go:133 `Find(&rows)` completo de LibraryMedia: ejecutado una vez por escaneo y no pude ver los campos que usa más allá de la línea 152 para garantizar un Select seguro; (11) migrateSchema ejecuta en cada arranque los DELETE de deduplicación de library_media/watch_histories (no-ops por los índices únicos), costo de milisegundos; (12) CreateInBatches ya se usa en telemetría, indexer, library_media, local_file (lotes de 50-100 con menos de 32766 variables), sin inserciones fila a fila relevantes; (13) UpsertBatch no actualiza updated_at en conflicto: nadie lo lee hoy, queda anotado en el hallazgo del índice muerto."
- **a5d4f117504267325:** - internal/handlers/routes.go getLimiter: el costo real esta en el lock interno de lru.Get (no eliminable sin shardear); se reporta solo como limpieza (hallazgo Baja). - util/net.go GetLocalIPv4Addresses (RWMutex con RLock en el camino rapido): correcto; solo hay un thundering herd al expirar el TTL de 30 s y no se cachea el error, impacto despreciable. - util/cache/cache.go Get con RLock y TTL: correcto; BoundedCache.Get usa Lock completo porque mueve en la lista LRU (necesario); sus usos (clientInfoCache, skipTimesCache, animeEntryCache) son de bajo trafico. - events/websocket.go SendEvent: copia el slice Conns por evento bajo RLock (una asignacion pequena); pasar a copy-on-write con atomic.Pointer ahorraria muy poco y toca 6 funciones. Escritura secuencial con deadline de 2 s si hay <=4 conexiones es una decision de diseno, no un bug de lock. - events/dispatcher.go Publish: envios no bloqueantes bajo RLock y Unsubscribe bajo Lock; no hay riesgo de enviar a canal cerrado. - continuity/telemetry.go: el Lock solo cubre una escritura de mapa y la copia/intercambio del buffer en flush es O(n) pequeno; RWMutex sin RLock es solo estilo. - handlers/status.go cpuProfileMu+bool: ruta fria (perfil de CPU), sustituible por atomic.Bool.CompareAndSwap pero sin valor medible. - cassette Session.getVideoPipeline/getAudioPipeline: Mutex por request de segmento HLS (~1/s por cliente) con construccion del Pipeline dentro; contencion nula en la practica. Governor.TryAcquireNVENC tiene una carrera TOCTOU ya documentada en el codigo como aceptable. - cassette getOrExtractKeyframes: kfCacheMu necesario para check-then-add; solo corre al crear una sesion. - drive/service.go: GetClient/IsEnabled con RLock correctos; GetStatus sin singleflight alrededor de GetUserInfo es un stampede menor cada 10 min. - core/app.go handleConfigChange escribe a.Config.Server.AuthTokenTTL, CorsOrigins y a.Metadata.TMDBClient bajo moduleMu mientras GetServerPasswordHMACAuth y otros lectores no toman ese lock (carrera en hot-reload de config); no se incluye porque requiere un campo nuevo en App (app.go tiene cambios sin commitear) y la ventana es solo cuando se edita el archivo de config. Tambien CorsOrigins se captura una vez en InitRoutes, por lo que su hot-reload no tiene efecto. - database/db/media_filler.go: GetCachedMediaFillers mantiene el Lock de escritura durante la consulta a la base y el Unmarshal de todas las filas, y InsertMediaFiller invalida toda la cache (cada insercion fuerza una recarga completa via DeleteMediaFiller). Es una mejora real pero de baja prioridad; no hay carrera de invalidacion (la escritura bloquea tras el lock de carga). - handlers/drive_thumbnail.go driveThumbMissing y thumbnail.go thumbnailFailed (sync.Map): driveThumbMissing nunca borra entradas vencidas (crece por hash), crecimiento minimo y fuera del alcance de contencion de locks. - util/proxies/image_proxy.go Prewarm: mutex para un contador (atomic.Int64 seria equivalente), ruta fria. ImageProxy.ensureDir ya usa sync.Once. - api/metadata_provider/jikan_impl.go: mu protege solo mapas con secciones criticas cortas; I/O (DB, red) ocurre fuera del lock; singleflight por ID correcto. - mediastream/drivesubs.go driveSubJobsMu: hace un os.Stat dentro del lock, pero solo al pedir extraccion de subtitulos (frecuencia minima). - core/feature_flags.go FeatureManager.IsDisabled con RLock por request en FeaturesMiddleware: sustituible por atomic.Pointer pero el costo de un RLock sin escritores concurrentes es despreciable.
- **a3019dcd79e131c45:** - Campos de Theme (9: themeExpandSidebarOnHover, themeSmallerEpisodeCarouselSize, themeDisableSidebarTransparency, themeEnableSidebarGradient, themeDisableCarouselAutoScroll, themeEnableCinematicGrain, themeDisableLibraryScreenGenreSelector, themeShowEpisodeCardAnimeInfo, themeUnpinnedMenuItems): en Go solo se mapean por GORM/JSON y en el frontend solo aparecen como valores por defecto en web/src/lib/theme/theme-hooks.ts:60-89 (ningun consumidor real). Son candidatos a quitar, pero exigen editar theme-hooks.ts y regenerar types.ts, fuera de apps/server; no incluido. El resto de campos Theme/Platform/Notifications si los usa la web. - LibraryMedia.Characters/Relations/IDMal y LibraryMediaCharacter*: Characters y Relations nunca se asignan en Go, pero web/src/components/shared/character-detail-modal.tsx y otros leen characters.edges/idMal via el tipo generado; borrarlos rompe la compilacion TS tras regenerar. - GhostAssociatedMedia.Confidence, Settings.Updated, LibraryMedia.IsNsfw, MediaPlayerSettings{} vacia, CharacterDTO.RoleTag/AvatarURL (KeyCharacters siempre vacio en series_details.go:96), FileTechnicalInfo.ExternalSubtitles/ExternalAudioFiles/IsSDH/IsCC/Color*: sin referencias en Go pero forman parte del contrato JSON/TS generado; no se justifica el costo de regenerar por tan poco. - Constantes de dto/media_enums.go y media_metadata.go (MediaSeason*, MediaFormatTVShort/ONA, Role*, EpisodeType*): las consume codegen para emitir uniones TS (EpisodeType, MediaFormat en types.ts); no son muertas. - MarshalJSON/UnmarshalJSON (dto/localfile.go), AfterFind (LibraryMedia), TableName (LocalFile): exigidos por encoding/json y GORM. - CleanupManager.trimLocalFileEntries y models.LocalFiles: tras migrateLegacyLocalFiles la tabla local_files siempre se elimina, asi que la funcion retorna siempre en el primer if; pero el test database_cleanup_test.go la ejercita (exige min ID 9996) y el modelo lo usa la migracion de bases antiguas. Borrarlos implica reescribir ese test y tocar proteccion de bases existentes; descartado. - Migraciones de una sola vez (migrateDefaultSettings, defaultAutoDetectSkipTimes, migratePlaybackAndPerformanceDefaults, purgeStaleSkipTimes, purgeEdlessAnimeThemesSkipTimes, healDragonBall*, seedDragonBallMalIds, seedDaimaAudioProfile, migrateSkipTimesSemantics, migrateLegacyLocalFiles): estan gateadas por metadata_cache (migration_gate_test.go) y protegen bases de usuarios existentes; retirarlas solo seria seguro tras confirmar que todas las bases desplegadas ya tienen los gates. Riesgo explicito, no se propone borrarlas. Nota menor: el comentario de migrateLegacyLocalFiles quedo pegado encima de indexHasColumns (db_migrations.go:189-191), es solo estilo. - idx_library_media_type_format e idx_local_file_media_locked: sin uso no demostrado (SQLite no usa un compuesto sin su prefijo, pero tampoco hay prueba de lo contrario); fuera de la lista de indices a borrar. - Funciones con una sola referencia (Backup, GetThemeCopy, GetNotifications, NewLocalFile via alias anime.NewLocalFile, UpsertBatch, etc.): todas tienen llamador de produccion verificado. Alias anime.NewLocalFile (dto_aliases.go:22) solo lo usa un test del paquete anime: es ambito de otro agente. - unused-strict-tests.txt: el unico hit relacionado (mediastream/repository.go:39 campo database) es de otro ambito. - Dependencias go.mod: no detecte ninguna sin uso dentro del ambito de database/core/migrations.
- **ac2b9dac803f27c07:** - HEAD /drive/play: INCIERTA. Comparte handler con GET; no hay fetch HEAD en web/TV, pero los elementos <video> y proxys/cliente de descarga pueden emitirlo y streamTokenPathPrefixes/sensitive_endpoint_test.go:21 lo contemplan. Habria que confirmar con una captura de red en un reproductor Drive antes de quitarlo. - GET /drive/callback: se descarta (lo invoca Google como redirect del navegador; no es un fetch de la app). - /mediastream/direct/play, /transcode/*, /hls/*: aparecen sin consumidor literal en la web (solo en tests) pero son las streamUrl que emite el servidor (internal/mediastream/playback.go:361-375), por lo que estan en uso. - /library/anime-entry/:id/local-files: la web arma la URL por concatenacion (anime_entries.hooks.ts:20) y GetAnimeEntryLocalFiles no figura como constante usada; esta en uso. - /mediastream/subs/pgs vs /mediastream/subtitles/pgs: se conserva /subs/pgs porque es la que pide la web (player-orchestrator.tsx:128); se quita el otro alias. Alternativa (INCIERTA): unificar la web a /subtitles/pgs y quitar /subs/pgs, requiere tocar el frontend. - Entradas obsoletas de seguridad que quedarian tras los hallazgos 4 y 7 (sensitiveMethodRoutes: '/api/v1/mediastream/settings' PATCH y '/api/v1/drive/callback' POST; server_features_middleware.go:33, :39 y :50; sensitiveMethodRoutes '/api/v1/library/local-files' DELETE, ruta que ya no existe en ningun routes*.go) no se incluyen como edits porque estan cubiertas por tests path-only que habria que reescribir a la vez; son una depuracion posterior de bajo riesgo. - Grupo SCAN_SUMMARY.GetScanSummaries (/library/scan-summaries) en apps/web/src/api/generated/endpoints.ts: la ruta no esta registrada en ningun routes*.go; es un resto del generador que desaparecera al regenerar el codegen; fuera de las rutas auditadas. - Hooks sin importadores claros (useGetAudioProfiles, useGetSeriesSagas, useGetChronologyEpisodeFiles dieron 0 por nombre): falsos positivos; los hooks se llaman useMediaAudioProfiles/useSetMediaAudioProfile y las otras dos rutas se consumen por API_ENDPOINTS en routes/series/$seriesId/index.lazy.tsx y hooks/chronology; estan USADAS. - Todas las demas rutas de los cinco archivos tienen consumidor demostrado en la tabla de coverage; ninguna otra quedo clasificada como SIN CONSUMIDOR.
- **a1bd611f7a33c06f5:** - ThumbnailCache.Len (deadcode lo marcaba): lo usan thumbnail_disk_test.go:40 y cache_handlers_test.go:83; go vet sobre la copia editada lo detectó, se retiró del hallazgo 1. - Serialize/Deserialize en core/echo.go: implementan echo.JSONSerializer (CustomJSONSerializer), los invoca Echo por interfaz. - logger.go levelFilterWriter.WriteLevel: implementa zerolog.LevelWriter, la llama zerolog por interfaz. - Repository.DriveWindowSupport (8 usos en pruebas) y pretranscode.Manager.Get (2 pruebas): accesores de solo prueba, pero quitarlos obliga a reescribir muchas pruebas; no compensa. - BlockCache.WaitIdle: la usa el Cleanup de drivesubs_intermittent_test.go; es soporte de pruebas en código de producción pero útil para cerrar con orden. - Campos de clave de mapa marcados unused (episodeKey.season en enrichment.go, fileKey.mediaID en chronology_frames.go, tmdbTypeKey.tmdbID/mediaType en scanner_phases.go): forman parte de la clave del mapa, quitarlos cambiaría la identidad y fusionaría entradas; falsos positivos. - ScanLogger.mu (scan_logger.go): el literal es posicional y el mutex es el mismo que usa ThreadSafeWriteSyncer; riesgo sin valor. - Campos con tag json o decodificación de APIs externas (AniListMedia.MeanScore/SiteURL, AnimeMappings.*, TMDB MovieDetails/TMDBImage/ImagesResponse, NfoFile.*, mkvparser ChapterInfo/AttachmentInfo, PgsComposition.PTS/DTS, matroska TrackInfo/Chapter): estructuras de deserialización o salida JSON hacia el frontend, no son muertos. - events.RefreshedAnimeCollection: reflejado en apps/web/src/lib/server/ws-events.ts (REFRESHED_ANIME_COLLECTION). - Constantes ID*/Comp*/Target* de matroska/ebml.go y types.go, Platform* de util/useragent.go, MediaRelation*/MediaListStatus* de platforms/platform/models.go, EntityMovie/EntityTechnique: catálogos/enums de especificación o de dominio; cero referencias pero sin coste y con valor documental. - FeatureFlags (struct vacío y NewFeatureFlags): se serializa en handlers/status.go (featureFlags) y por tanto aparece en los tipos generados del frontend. - Funciones de handlers/response.go (SeaResponse, NewDataResponse, NewErrorResponse) etiquetadas 'legacy': las usa handlers/home.go de forma extensa. - scanner_engine.go MatchingThreshold ('only used by legacy'): se sigue pasando a scan_phases.go:252, está en uso. - Campos aún sin uso no incluidos para acotar el cambio: mkvparser.realLogger/contentEncodings/defaultDuration, notifier.appName, matroska parser.segmentTopPos/cuesTopPos/header y Demuxer.reader (escrituras dispersas en muchos sitios), wCluster.off. - kamehouse.exe y kamehouse.exe.bak (72 MB y 66 MB) en apps/server: ya están ignorados por git (.gitignore: kamehouse.exe, *.bak, *.exe), no son parte de las fuentes versionadas. - go.mod: todas las dependencias directas se importan al menos una vez; no hay candidatas a retirar. - Paquetes huérfanos: ninguno en internal/ salvo dragonball y mkvsubs/mkvtest (fuera de ámbito).
- **a842113c603203c3f:** INCIERTAS / NO REPORTADAS: - GET /home/curated: SIN CONSUMIDOR demostrado (0 hits en web, TV, desktop, scripts; la TV usa solo /home/continue-watching), pero su eliminacion arrastra una cascada grande fuera de routes: anime.GetCuratedHome y swimlanes.go (369 lineas), IntelligenceService.GetCuratedSwimlanes/CuratedHomeResponse en internal/library/anime/intelligence.go, y 4 llamadores de InvalidateCuratedHomeCache (core/modules.go:156, handlers/drive.go:531, handlers/home.go:218, handlers/scan.go:233). Candidato para una segunda pasada dedicada; no cabia con ANTES/DESPUES exactos en el presupuesto. - GET/OPTIONS /api/health: sin cliente en el repo, pero es la sonda anonima documentada (health.go, tests de CORS/nosniff, exencion de rate limit). Confirmar si existe un HEALTHCHECK de Docker/monitor externo antes de tocar. - GET /memory/stats, /memory/profile, /memory/goroutine, /memory/cpu y POST /memory/gc: sin cliente, pero son diagnosticos de uso manual (pprof/curl) protegidos a proposito (prefijo sensible /api/v1/memory/, regla de features core.UpdateSettings, security_p0_test.go:64-92 los prueba). Mantener. - POST /home/retag: disparo manual documentado en home.go:109 ('Trigger this via POST /api/v1/home/retag') y cubierto por honesty_test.go:93; sin cliente pero es herramienta administrativa. Confirmar con el dueno. - POST /drive/callback: mismo handler que el GET (rama programatica); el GET si lo usa Google OAuth. Sin cliente web para el POST; esta en sensitiveMethodRoutes. Confirmar si algun flujo externo lo usa. - GET /events vs GET /ws (alias al mismo handler webSocketEventHandler): ambos tienen consumidor distinto (TV usa /events, web usa /ws); no son duplicados eliminables. - authRateLimitMiddleware/authRateLimit/authRateBurst (routes.go:40-107) y rutas publicas /api/v1/auth/login|logout (server_auth_middleware.go:211-212): protegen un prefijo /api/v1/auth/ sin ninguna ruta registrada y sin cliente, pero rate_limit_test.go:27-50 prueba el middleware directamente y es defensa de un login futuro; requeriria editar tests y verificar con el dueno (INCIERTA). - Entradas obsoletas en sensitiveMethodRoutes (/library/local-files DELETE, /library/empty-directories DELETE), sensitivePrefixes (/open-in-explorer, /library/local-files/dump, /library/local-files/import) y reglas de server_features_middleware.go (/library/scan-summaries): apuntan a rutas inexistentes pero son fail-closed y hay tests que las afirman (sensitive_endpoint_test.go:31,45,52,57); no se tocan. - urisToSkip de routes.go:183 lista '/api/v1/mediastream/video-thumbnail' (ruta inexistente; la real es /api/v1/video-thumbnail): provoca ruido de logs, no codigo muerto; fuera del lente de endpoints. - apps/server/web/static/** (bundle web embebido, p. ej. js/async/7922.9c23d36a.js): es salida de build, puede contener cadenas de rutas de versiones antiguas; solo se uso apps/web/src como fuente de consumidores. - Descartados por tener consumidor: /library/anime-entry/:id/local-files (parecia sin uso por la busqueda literal, pero anime_entries.hooks.ts:20 lo arma concatenando y lo consume random-play-button.tsx:136), /drive/play, /mediastream/direct/play|transcode|hls (URLs que genera el servidor en playback.go), /mediastream/att, /music/*, /lore/dragonball, /home/continue-watching. - HandleDriveCallback POST, HandleRetagEpisodes y las funciones memory/* no se proponen por riesgo funcional o de uso manual, no por falta de evidencia de consumidores en el repo.
- **a6484869a4ed0ef31:** Descartado: (1) skipdetect/compare.go CompareFingerprints: O(n x m) pero es un bucle ajustado de popcount sin asignaciones (2 slices por comparación frente a ~5.8M iteraciones); cambiar el algoritmo arriesga alterar resultados. (2) fingerprint_cache.go / fpcalc.go: Sprintf para claves y args una vez por ventana de episodio, dominado por ffmpeg/fpcalc; bytes.Buffer de stdout es adecuado. (3) drive/blockcache.go make([]byte, 16MB) por bloque: un sync.Pool NO es seguro porque blockReader.dl conserva el blockDownload (y su buf) tras terminar la descarga; reciclarlo corrompería lecturas en curso. (4) image_proxy.go io.ReadAll de imágenes: solo corre en descargas frías (red + escritura a disco dominan) y la caché en disco sirve el camino caliente con c.File sin copiar; presizing con ContentLength da poco. (5) Regexps: todas las revisadas en scanner/, mediastream/ y handlers/ son variables de paquete (no se compilan en caliente). (6) title_normalization.go: ya usa Builder con Grow, regexp precompiladas y tiene bench; sin mejora clara. (7) efficient_dice.go generateNgrams []rune: para cadenas de hasta 32 runas el compilador usa buffer en pila y el pool ya reutiliza los mapas; ganancia marginal. (8) util/cache PruneDirectory remainingFiles sin capacidad y filepath.Join por entrada: tarea periódica, no ruta caliente. (9) default_audio.go PreferAudioTrack (Sprintf + Split): solo sobre listas maestras de pocas líneas. (10) handlers/proxy.go bytes.NewBuffer + m3u8.Decode(*buffer): la API de la librería exige bytes.Buffer por valor. (11) discovery.go os.Stat por archivo en createLocalFiles en vez de reutilizar d.Info() de WalkDir: ahorraría syscalls en Windows pero obliga a cambiar la firma de discoverFilePaths y sus llamadores (fuera del presupuesto de este barrido). (12) drive/chunked.go fmt.Sprintf del header Range: una vez por solicitud de 16 MB, irrelevante. (13) watcher.go y shelf_images.go: sin patrones de asignación significativos (shelf_images ya preasigna con make(..., 0, n) y mapa con capacidad).
