# Revisión del backend — 2026-11-10

**Estado: los seis hallazgos se corrigieron localmente tras la autorización del usuario.** Las secciones de auditoría conservan el diagnóstico original; la sección final registra la implementación y su validación.

Revisión del árbol local actual. Se conservaron los cambios preexistentes. No se modificó código de producción ni se aplicaron correcciones. Se creó y retiró un archivo temporal de diagnóstico, ejecutado exclusivamente con bases y carpetas temporales.

## Resultado

Seis hallazgos reproducidos: cinco problemas funcionales y uno de cancelación/trabajo innecesario. Las pruebas generales pasan, pero no cubrían estos escenarios. Prioridad: resolver primero los dos contratos de identidad; después el asistente y las operaciones de limpieza; finalmente la cancelación y las optimizaciones.

Esta revisión se centró en proveedores de metadata, persistencia, cachés, configuración de streaming, continuidad y catálogo curado, con inspección adicional de rutas, miniaturas, storyboards y reproducción de Drive. No constituye cobertura exhaustiva de los 601 archivos encontrados bajo internal (incluidas pruebas).

## 1. P2 — Los proveedores confunden un ID público con una PK interna

Ubicaciones:

- `apps/server/internal/library/anime/entry.go:211`: envía `opts.MediaID`, resuelto antes como ID público.
- `apps/server/internal/api/metadata_provider/provider.go:102`: RoutingProvider busca ese número como PK.
- `apps/server/internal/api/metadata_provider/tmdb_impl.go:81`: vuelve a resolver primero por PK.
- `apps/server/internal/api/metadata_provider/jikan_impl.go:224`: también prioriza la PK antes del ID público.
- `apps/server/internal/library/anime/entry_simple.go:117`: otro consumidor envía explícitamente la PK, evidenciando que el contrato mezcla las dos identidades.

Reproducción con el proveedor TMDB real y caché persistente en SQLite temporal: una serie tiene PK 1 y TMDB 123; otra tiene PK 123 y TMDB 456. Se precarga metadata de 456. `GetAnimeMetadata(123)` devuelve la metadata de 456. No requiere acceso a Internet.

Impacto: una ficha puede recibir episodios de otra obra. El escáner también pasa IDs externos a este proveedor (`scanner/enrichment.go:131`) y utiliza el resultado para persistir metadata; la reproducción de diagnóstico comprobó la resolución equivocada, no ejecutó ese pipeline completo.

Propuesta: unificar el contrato del proveedor. Recibir una identidad explícita (proveedor/tipo/ID), o separar métodos de PK e ID público. Resolver una sola vez; una PK coincidente nunca debe ser un fallback de un ID público. Añadir regresiones de colisión y películas con offset.

## 2. P2 — La caché persistente de episodios TMDB mezcla series y películas

Ubicaciones: `apps/server/internal/api/metadata_provider/tmdb_impl.go:92` y `:284`.

La clave durable es únicamente `strconv.Itoa(tmdbID)` dentro de `tmdb-anime-episodes`. El tipo se calcula, pero no forma parte de la clave. Las tablas permiten un SHOW y un MOVIE con el mismo número TMDB.

Reproducción: SHOW y MOVIE con TMDB 123 y PK diferentes; caché persistente de 123 con 99 episodios de la serie. Se invoca al proveedor con cada PK, evitando la confusión del hallazgo anterior: ambos leen esos mismos 99 episodios.

Impacto: contaminación cruzada aun usando correctamente la PK. El valor puede durar siete días y sobrevivir reinicios.

Propuesta: claves con tipo y, cuando corresponda, idioma/configuración efectiva. Retirar solo las claves antiguas de este namespace que no puedan distinguirse con seguridad. No borrar marcadores de migración.

## 3. P2 — Habilitar transcodificación en el asistente no actualiza la caché ni el motor

Ubicación: `apps/server/internal/handlers/settings.go:148`.

`HandleGettingStarted` lanza una goroutine que actualiza `transcode_enabled` con SQL directo. `GetMediastreamSettings` conserva un puntero cacheado; la escritura evita `UpsertMediastreamSettings`. Además, este flujo llama a `InitOrRefreshModules`, pero no a `InitOrRefreshMediastreamSettings`, que es quien actualiza el motor de streaming.

Reproducción del paso exacto de persistencia, no del asistente completo: con streaming desactivado y ajustes en caché, se ejecuta el mismo UPDATE del handler. SQLite queda en true y `GetMediastreamSettings()` sigue devolviendo false.

Impacto: el asistente puede guardar la activación sin que la instancia actual la refleje; una escritura posterior basada en la caché también puede revertirla.

Propuesta: operación de repositorio que actualice la columna y publique una nueva generación de ajustes; completar la actualización antes de responder y refrescar el motor por la ruta ya existente. Conservar los otros ajustes, incluido Solo original. Evitar una goroutine sin seguimiento para este paso.

## 4. P2 — La limpieza manual de metadata conserva las respuestas vigentes

Ubicación: `apps/server/internal/handlers/cache_handlers.go:242`.

El target metadata (incluido por all) ejecuta `DeleteExpiredMetadataCache`: solo elimina vencidos. Los ClearCache de proveedores y del cliente TMDB limpian memoria; sus siguientes lecturas pueden recuperar la misma respuesta persistente vigente.

Reproducción: se inserta una respuesta `tmdb-api` con TTL de una hora y se llama al handler real con target=all. Devuelve HTTP 200 y success=true; la respuesta permanece recuperable en SQLite.

La interfaz ofrece limpiar «Metadatos y consultas de TMDB» y describe respuestas guardadas y registros vencidos (`apps/web/src/routes/settings/tabs/system-tab.tsx:824`). Existe otra implementación de borrado durable en `handlers/metadata.go`, por lo que ambas entradas tienen semánticas distintas.

Propuesta: extraer una operación común de limpieza por namespaces permitidos, conservando marcadores y datos de usuario. Reutilizarla desde ambos handlers y coordinar publicaciones en curso. Devolver errores en lugar de informar siempre success=true.

## 5. P3 — Storyboards fuera de estadísticas y de «limpiar todo»

Ubicaciones: `apps/server/internal/handlers/cache_handlers.go:107` y `:173`; generación en `internal/mediastream/storyboard/storyboard.go:70` y `frame.go:49`.

Las vistas previas se guardan en cacheDir/storyboards. Esa carpeta no se contabiliza en TotalDiskSizeBytes ni se limpia con all. La generación tiene su propia poda con presupuesto de 256 MiB; el problema no es afirmar crecimiento ilimitado, sino omisión en la administración de caché.

Reproducción: archivo de preview en la carpeta temporal storyboards; el handler real responde success=true a target=all y el archivo permanece.

Propuesta: incluir estadísticas y target propio para storyboards, incorporándolo a all. Coordinar el borrado con generación activa para evitar que una escritura en curso repueble la caché inmediatamente.

## 6. P2 — El catálogo curado ignora el contexto y su timeout efectivo

Ubicación: `apps/server/internal/library/anime/intelligence.go:468`; consultas en `swimlanes.go` y `tag_lanes.go`.

`GetCuratedHome` crea un contexto compartido con límite de 20 segundos, pero `GetCuratedSwimlanes(_ context.Context)` lo descarta. Sus constructores consultan GORM sin WithContext y transforman errores en lanes ausentes. La llamada compartida usa singleflight.Do, que tampoco permite que un consumidor deje de esperar individualmente.

Reproducción: se llama directamente a GetCuratedSwimlanes con un contexto ya cancelado. Completa sin error y ejecuta nueve consultas ORM; el conteo no incluye la consulta Raw del batch de episodios.

Impacto: trabajo y esperas innecesarios; el límite declarado no interrumpe estas consultas. Los errores de base también pueden terminar como una respuesta parcial que GetCuratedHome cachea durante 30 minutos.

Propuesta: propagar el contexto compartido a todas las consultas y devolver sus errores. Para la espera HTTP, usar DoChan más selección por el contexto individual, conservando el productor compartido con un timeout propio.

## Optimización y eliminación recomendadas

1. **Unificar las limpiezas de metadata**: eliminar la lógica duplicada y contradictoria de los dos handlers después de extraer el servicio común. Es una simplificación con efecto funcional comprobado.
2. **Reducir las consultas por tags**: BuildDynamicTagLanes carga todos los JSON de tags y hace dos consultas adicionales por tag elegible. Considerar agregación SQL con json_each (comprobar soporte) o un índice relacional de tags, y carga de episodios/media por lotes. Medir con una biblioteca representativa antes de elegir; esta revisión no atribuye un ahorro de milisegundos.
3. **Compartir un inventario de cachés**: estadísticas, limpieza y mantenimiento enumeran directorios por separado; la omisión de storyboards muestra el riesgo. Centralizar descriptores manteniendo la exclusión deliberada de bloques Drive en all.
4. **Retirar comentarios con implementaciones antiguas**: por ejemplo, bloques comentados en `internal/util/crashlog/crashlog.go`. Reduce ruido; no promete mejorar rendimiento.
5. **No eliminar proveedores o dependencias por antigüedad**: AniList conserva rutas de construcción y llamadas, habari se usa en el parser y go-spew en pruebas. La búsqueda léxica de funciones privadas sin otra mención no produjo candidatos; no equivale a un análisis formal de código muerto. No se identificó un módulo grande cuya eliminación completa esté justificada por esta revisión.

Pendiente de verificación adicional: storyboards y thumbnails Drive derivan su clave de FileModTime/FileSize guardados por el último escaneo, mientras la reproducción tiene un verificador de revisiones separado. Revisar coherencia al reemplazar un archivo en Drive; no se presenta como reproducción con Drive real.

## Validación y límites

- `go test -short . ./internal/... ./codegen/...`: pasó; parte de los paquetes usó caché.
- `go vet . ./internal/... ./codegen/...`: pasó.
- `go test ./internal/handlers -run TestAuditNov10 -count=1 -v`: cinco diagnósticos pasaron y comprobaron el comportamiento defectuoso descrito; el diagnóstico de limpieza cubrió dos hallazgos. No son pruebas de correcciones.
- Diagnósticos: colisión público/PK; colisión SHOW/MOVIE; limpieza manual de metadata/storyboards; contexto cancelado; desincronización caché/SQL de streaming. El archivo temporal de pruebas se retiró al terminar.
- Sin detector de carreras: `CGO_ENABLED=0` en este entorno.
- Sin benchmark de biblioteca personal, Drive real, OAuth real o reproducción extremo a extremo.
- Sin reinicio de instancia, borrado de datos personales, commit, push ni despliegue. Único entregable persistente: este informe.


## Correcciones implementadas — 2026-11-10

1. **Contrato público de metadata:** RoutingProvider, TMDB, Jikan y AniList resuelven IDs públicos mediante el resolver de biblioteca. Se eliminó el fallback por PK y el consumidor SimpleEntry dejó de enviar una PK. El wrapper compartido ya no consulta una obra por una identidad innecesaria.
2. **Claves persistentes versionadas:** la caché TMDB de episodios separa tipo, TMDB ID e idioma; Jikan y AniList usan el namespace de claves public-v2. Las claves anteriores no se reutilizan porque pueden contener resultados de otra obra. No se borraron datos personales ni se intentó migrar valores ambiguos: las filas viejas vencen por su TTL y la siguiente consulta rellena la nueva clave. Los enriquecimientos de series no se aplican a películas con un TMDB ID coincidente.
3. **Activación de streaming:** el asistente guarda la columna de transcodificación de forma síncrona, publica un nuevo snapshot y llama al refresco del motor antes de responder. El repositorio serializa la publicación de ajustes y conserva las otras columnas, incluido Solo original. La cancelación de la escritura conserva el snapshot previo.
4. **Limpieza de metadata unificada:** los dos handlers comparten una operación con una lista explícita de namespaces. Elimina valores vigentes y vencidos de esos proveedores, mantiene migraciones/datos de usuario e informa errores de SQLite. Se retiran publicaciones pendientes de proveedores y del cliente TMDB; este último separa generaciones de singleflight y evita que una petición HTTP anterior vuelva a persistir su resultado después del borrado. Se invalida también la caché de fichas.
5. **Storyboards administrables:** las estadísticas y el total incluyen la carpeta storyboards. Los targets storyboards y all eliminan sus archivos; el borrado espera a los productores de hojas y frames y puede cancelarse durante la espera. Los bloques Drive siguen excluidos de all. Las estadísticas generadas de TypeScript se sincronizaron.
6. **Catálogo cancelable:** todas las consultas del catálogo curado reciben el contexto con límite de tiempo. Los errores SQL se devuelven y no se cachean como catálogos parciales. Cada consumidor puede abandonar la espera singleflight por separado. La caché queda ligada a la base y a una generación, evitando que un cálculo anterior repueble una invalidación.

Optimización y eliminación adicionales:

- Los tags válidos se agregan en SQLite y se recuperan episodios y obras en **dos consultas**, frente al barrido de JSON en Go y dos consultas por tag elegible. Se conserva el umbral de 50 episodios y el máximo de 20 por lane; se ignoran JSON inválidos y se deduplican tags repetidos dentro de un episodio. No se midió latencia con la biblioteca personal.
- Se retiraron el constructor de lane con LIKE por etiqueta, la caché anidada redundante y los bloques de implementación comentada en crashlog.
- No se retiraron proveedores activos ni dependencias utilizadas.

Pruebas permanentes:

- `internal/api/metadata_provider/public_identity_test.go`: colisión público/PK, SHOW/MOVIE, claves legacy, separación de idiomas y routing.
- `internal/api/tmdb/cache_clear_test.go`: una carga HTTP anterior al borrado no repuebla la caché.
- `internal/handlers/backend_nov10_regression_test.go`: limpieza por target, preservación de marcadores, estadísticas, fallo SQLite, ajustes/motor, cancelación, fallo SQL sin caché parcial, tags exactos/JSON inválido y cancelación de un consumidor sin cancelar el productor compartido.
- `internal/mediastream/storyboard/clear_test.go`: espera a productores, eliminación de su resultado confirmado y cancelación durante la espera.
- Se adaptaron fixtures de generación y recarga de metadata al contrato público y a las claves nuevas; se mantienen sus comprobaciones de ciclo de vida.

Validación final:

- `go test -short . ./internal/... ./codegen/... -timeout 180s`: pasó.
- Pruebas específicas nuevas de handlers con `-count=1`: pasaron.
- `go vet . ./internal/... ./codegen/...`: pasó.
- Codegen ejecutado y segunda regeneración comparada mediante hashes de todos los archivos generados: estable. El chequeo habitual contra Git no serviría para distinguir estos cambios de los generados que ya estaban modificados.
- `pnpm --filter kamehouse-web typecheck`: pasó.
- `git diff --check` en los archivos revisados: pasó.

Límites: no se ejecutó race con CGO deshabilitado; no hubo reproducción con Drive real ni biblioteca personal, reinicio, commit, push o despliegue. La coherencia de revisiones de thumbnails/storyboards Drive sigue siendo una observación para validación con el servicio real, fuera de los seis defectos reproducidos. La primera lectura de metadata tras aplicar el cambio puede requerir rellenar las nuevas claves.
