# Revisión integral del backend — 10 de noviembre de 2026

Actualización: la segunda pasada se documenta en `backend-2026-11-10-segunda-pasada.md`. Resuelve la espera no cancelable del mutex de backups mencionada abajo y amplía permisos, cierre de tareas Drive y cancelación de diagnósticos. Las mediciones y reproducciones de esta primera pasada se conservan como registro histórico.

## Resultado y alcance real

Se implementaron correcciones locales de persistencia, identidad, permisos, lectura de medios y cierre de tareas, una optimización medida y dos eliminaciones de funciones sin referencias. Se conservaron los cambios preexistentes y las correcciones de la primera pasada. No se retiraron funciones activas del producto.

El inventario adjunto (`backend-2026-11-10-cobertura.csv`) cubre 58 paquetes y 334 archivos de producción bajo `internal`. La cobertura combina inventario y búsquedas estructurales sobre todo el código, inspección dirigida de los recorridos indicados abajo y ejecución de las comprobaciones de todos los paquetes. **No significa que cada línea haya recibido una revisión manual exhaustiva ni que no puedan existir otros defectos.** Los paquetes sin pruebas propias están identificados en el inventario y no adquieren cobertura funcional por el hecho de compilar.

También se inspeccionaron los registros de rutas, el arranque/cierre del servidor, codegen y los consumidores de contratos de Web/Desktop. No se modificó la interfaz del producto ni se ejecutó la instancia personal.

| Área | Inspección dirigida / resultado | Validación pendiente fuera de fixtures |
| --- | --- | --- |
| Persistencia y modelos | Identidad pública/FK, upserts, generaciones de caché, migraciones, backups; corregidos sondeo tardío y publicación de backups | Tamaño y contención de la base personal |
| Core y mantenimiento | Admisión de tareas, watchers, cleanup, configuración y scheduler; preservadas las correcciones previas | Inicio/cierre de la aplicación instalada |
| API y handlers | Auth, orígenes, restricciones por función, rutas y exportación de diagnósticos; corregidas omisiones de permisos y errores HTTP con credenciales | Navegadores/dispositivos remotos reales |
| Metadata y proveedores | Routing, identidad, publicación por generación, TTL, cancelación, cliente TMDB y fallbacks; retirada una entrada de escritura sin consumidores | TMDB/Jikan/AniList/AnimeThemes reales |
| Biblioteca y escaneo | Descubrimiento, matching, persistencia, autoscanner y cola de sondeo; corregida la escritura completa de DTOs obsoletos | Escaneo de biblioteca personal y unidades desconectadas |
| Continuidad e inteligencia | Buffer/reintentos de historial, cuentas y progreso de cronología; corregidas colisiones de identidad | Historial personal previo con identidades históricas ambiguas |
| Drive | Cliente, revisiones, bloques, escaneo y subtítulos; caché de listados separada por cliente y sin alias mutable | OAuth, permisos y reemplazos de archivos en Drive real |
| Reproducción | Directo, sesiones HLS, preload, pretranscode, extracción y cachés; tareas locales de preload/extracción ahora pertenecen al repositorio | Reproducción completa en TV/desktop y aceleración física |
| Parsers y subtítulos | Matroska, MKV por rangos, fuentes, subtítulos externos y PGS; límites uniformes para secciones de metadata y rechazo de rangos incoherentes | Releases personales y formatos no representados por fixtures |
| Utilidades, eventos y notificaciones | Bloqueos, cachés, procesos, proxy de imágenes, WebSocket, notificaciones y tipos de plataforma/usuario | Clientes lentos y consumo prolongado con biblioteca representativa |

## Correcciones implementadas

### Limpieza de cachés de archivos

Un temporizador pendiente podía recrear un bucket después de su eliminación. Ahora el borrado espera a la escritura en curso, retira el handle anterior y detiene sus guardados pendientes. Incluye buckets todavía no escritos. La espera puede cancelarse sin abandonar goroutines auxiliares; no retiene el bloqueo global mientras espera al escritor.

Un fallo de `os.Remove` se devuelve y conserva el bucket; ya no se informa éxito mientras se descarta su estado de memoria. Los buckets durables redirigidos fuera de la carpeta descartable se conservan, incluso si el filtro coincide con todos los nombres. La limpieza de mediastream usa esta misma operación y deja de necesitar un segundo barrido de stores que podía olvidar temporizadores. Propaga también errores al retirar los directorios de video.

Regresiones: `removal_lifecycle_test.go` cubre temporizadores pendientes, escrituras en curso, buckets sin archivo, cancelación durante la espera, fallos de borrado, conservación del historial y publicación de un bucket nuevo después de limpiar.

### Sondeo de archivos en segundo plano

La cola retenía el DTO del escaneo y, al terminar, hacía un upsert de todos sus campos. Se reprodujo que una asociación manual posterior `media_id=900` volvía a `100`, además de perder flags y tags.

La cola recibe ahora una copia independiente. `db.UpdateLocalFileProbe` escribe únicamente `technical_info` y, si se obtuvo, `embedded_metadata`; exige coincidencia de ruta, tamaño y fecha de modificación. No recrea filas eliminadas, no publica resultados de otra revisión, respeta cancelación y no notifica un guardado que no se aplicó. Invalida la caché local solo después de actualizar una fila.

Regresiones: `background_queue_ownership_test.go` y `localfile_probe_test.go`. Se verifican cambios manuales, independencia de DTOs, filas ausentes/reemplazadas y contexto cancelado, sin invocar un sondeo externo en estos diagnósticos.

### Identidad del progreso de cronología

Una PK de biblioteca podía sobrescribir el significado del ID público de otra serie; además, una película con el mismo número TMDB podía aportar estado de lista a una serie. Las reproducciones mostraban episodios vistos en la obra equivocada.

Las consultas de lista se limitan a tipos de serie. Los IDs públicos tienen precedencia; los alias históricos por PK se aceptan solo cuando no resuelven públicamente a otra obra ni son ambiguos. La comprobación se reutiliza por ID dentro de la respuesta. Se conserva la lectura de alias históricos no conflictivos y no se reescribe historial antiguo.

Regresiones: `chronology_identity_test.go`, además de la prueba existente de historial/lista/cuentas/overrides.

### Backups completos y distintos

El nombre anterior tenía precisión de segundos y podía colisionar entre dos solicitudes. Ahora cada backup tiene nombre único, se construye como `.tmp`, se verifica en solo lectura y se publica como `.db` al terminar. El endpoint de descarga y la rotación solo consideran `.db`, de modo que no seleccionan el archivo que todavía se está construyendo. La publicación y la rotación se serializan.

`BackupContext` propaga el contexto del request al checkpoint, VACUUM y comprobación de integridad. Se conserva `Backup` como wrapper interno compatible. Los temporales de una operación fallida se retiran. No se cambió el formato de respuesta ni el contenido de la base.

Regresiones: `backup_lifecycle_test.go` y los tests existentes de integridad y rotación. No se midió el costo de VACUUM sobre la biblioteca personal. La espera del mutex de backups conserva la semántica normal de `sync.Mutex`; una solicitud cancelada mientras espera comprueba su contexto al adquirirlo y no inicia otro backup.

### Lectura HTTP de medios por rangos

Un bloque truncado podía guardarse en memoria y no reintentarse; una respuesta `206` con otro offset o total también se aceptaba. Ahora se exige que `Content-Range` coincida con el bloque solicitado y el tamaño observado al abrir. Las lecturas cortas se reintentan dentro del presupuesto existente y nunca se publican como bloques completos. Se rechazan tamaños totales no positivos.

Regresiones: `httprange/integrity_test.go`, con servidor HTTP local, cortes de cuerpo y cabeceras incoherentes; suite existente de seeks, lectura completa y reintentos.

### Límites de metadata Matroska

Las secciones superiores de info, pistas, cues, capítulos, tags, seek head y attachments reservaban memoria a partir de su tamaño declarado, evitando el límite que ya tenía `ReadElement`. Se reprodujeron panics por tamaño fuera de rango sin intentar agotar la memoria de la máquina.

Todos estos recorridos comparten ahora la lectura acotada de metadata de `EBMLReader`, con límite de 64 MiB y rechazo de tamaños desconocidos. Segment/Cluster no se cargan enteros mediante este helper. Se eliminó la duplicación de siete bloques de reserva/lectura. Una sección legítima mayor de 64 MiB será rechazada por este parser; esa limitación es deliberada y no se validó sobre la colección personal.

Regresión: `metadata_limits_test.go`; suite completa de Matroska y consumidores MKV.

### Cachés de subtítulos y miniaturas

El listado de subtítulos de Drive se consultaba antes de comprobar el cliente activo y la clave era solo el file ID. Ahora se valida el servicio, la clave incluye la instancia de cliente y los resultados se copian al entrar/salir de la caché. Un consumidor no puede modificar el listado de otro; una desconexión o cambio de cuenta no reutiliza la autorización anterior.

Los registros negativos de miniaturas locales y Drive se cambiaron de mapas sin tope a cachés LRU con TTL y máximo de 2048 entradas cada una. Limpiar miniaturas olvida ambos tipos de fallo, permitiendo reintentar también previews de Drive. Los marcadores negativos durables de Drive conservan su TTL y su poda existentes.

Regresiones: `subtitle_cache_identity_test.go`, suite Drive y `thumbnail_failure_clear_test.go`, además de las pruebas existentes de calentamiento y prioridad. No se afirma una medición de memoria de toda la aplicación.

### Propiedad de tareas de reproducción

El precalentamiento de sesiones, la preparación de segmentos y la extracción local de fuentes/subtítulos se lanzaban como goroutines desligadas del cierre del repositorio. Ahora comparten un contexto de vida propio, registran su admisión antes de arrancar y el cierre las cancela y espera antes de liberar extractor/transcodificadores. La espera del semáforo de attachments responde al cierre. La espera de metadata de esas tareas usa el contexto del repositorio.

Regresiones: `mediastream/background_lifecycle_test.go`: cancelación de una extracción en cola sin liberar su slot, rechazo de trabajo posterior al cierre y espera a que una tarea cancelada termine de liberar recursos. Continúan pasando las pruebas de reintento de extracción y reproducción sintética. Esta corrección no equivale a validar todas las interacciones con Drive real.

### Permisos y credenciales

`ViewSettings` no bloqueaba las lecturas de ajustes; `ViewLogs` tampoco bloqueaba el ZIP de diagnóstico que incluía el log. Se añadieron reglas para GET/HEAD de ajustes, ajustes de streaming y el reporte correspondiente. Se mantienen separados los permisos de lectura y actualización.

Los errores de transporte HTTP de TMDB podían incluir la URL con `api_key`, también en la respuesta pública de health. Se retiran usuario/contraseña, query y fragmento del `url.Error` antes de publicarlo, conservando su causa para `errors.Is/As` y sin modificar el error compartido. Esto no constituye una sanitización universal de todos los mensajes de terceros.

Regresiones: `feature_access_test.go` y `util/http/error_test.go`; suites existentes de autenticación, orígenes y acceso.

## Optimización medida

`scheduleSave` detenía y creaba un timer y una closure en cada cambio del bucket. Ahora reutiliza el timer existente con `Reset`, protegido por el mismo mutex; el flush lo retira cuando corresponde.

Mismo equipo, Go, benchmark, estado de datos y comando, tres repeticiones por versión:

`go test ./internal/util/filecache -run '^$' -bench '^BenchmarkScheduleSave$' -benchmem -count=3 -benchtime=300ms`

| Versión | ns/op | B/op | allocs/op |
| --- | --- | --- | --- |
| Antes | 111.3 / 112.2 / 112.8 | 128 | 2 |
| Después | 17.68 / 17.49 / 17.57 | 0 | 0 |

Es una mejora del camino de programación del guardado en estado estable. No representa una aceleración equivalente de SQLite, la reproducción o la aplicación completa. Los arreglos de identidad pueden incorporar consultas adicionales para rechazar colisiones; se priorizó corrección y no se les atribuye reducción de latencia.

Se comparó también la publicación de un resultado de sondeo con un archivo sintético y SQLite temporal en WAL/NORMAL. El benchmark conserva ambos recorridos para hacer reproducible la comparación:

`go test ./internal/database/db -run '^$' -bench '^BenchmarkProbePublication$' -benchmem -count=3 -benchtime=300ms`

| Recorrido | ns/op | B/op | allocs/op |
| --- | --- | --- | --- |
| Upsert completo anterior | 266525 / 273918 / 248563 | 31575 / 21499 / 21521 | 226 / 224 / 224 |
| UPDATE de columnas del sondeo | 50701 / 54316 / 52432 | 7217 / 7211 / 7208 | 83 / 83 / 83 |

Ambos recorridos ejecutan una escritura SQL; el segundo evita la transacción explícita de un upsert completo y serializa únicamente las columnas que le pertenecen. La prueba usa una sola fila y cachés calientes; no mide el costo de ffprobe ni implica ese ahorro para un escaneo completo. No se midieron escrituras físicas del disco ni memoria residente global.

## Eliminaciones y candidatas activas

Se retiraron `tmdb.SetCached` y `db.DeleteMetadataCacheByProvider`. La búsqueda de símbolos en fuentes/pruebas no encontró consumidores, y la búsqueda ampliada solo encontró ejemplos históricos en documentación. Las publicaciones TMDB activas siguen usando el contrato con generación; la limpieza activa sigue usando sus operaciones coordinadas. La compilación Windows/Linux comprueba que no faltaban referencias en las variantes de plataforma. `go mod tidy -diff` no propone cambios: no se eliminaron dependencias por antigüedad.

Se conservaron estas funciones activas. Son opciones de simplificación de producto para decidir aparte, **no código muerto ni una recomendación de retirarlas sin datos de uso**:

| Función | Propósito y consumidores comprobados | Efecto de retirarla / alternativa |
| --- | --- | --- |
| Fallbacks de metadata Jikan/AniList | Construcción de proveedores, metadata anime y ruta de miniaturas AniList | Menor cobertura en obras/previews; alternativa: TMDB como único proveedor, decisión todavía no tomada |
| Pretranscodificación en segundo plano | Rutas de gestión y preload de reproducción | Menos ocupación anticipada de CPU/disco, pero más espera al reproducir; alternativa: HLS en tiempo real y reproducción original |
| Detección automática de openings/endings | Detector, disparo oportunista y rutas scan/scan-all | Menos análisis automático y pérdida de marcas detectadas futuras; alternativa: conservar únicamente marcas manuales y lectura de las existentes |

No se borraron historial, marcas, asociaciones ni opciones de configuración de estas funciones.

## Validación y límites operativos

- Suite general sin caché: `go test -short . ./internal/... ./codegen/... -count=1 -timeout 180s`: pasó. Las últimas modificaciones de filecache/miniaturas se verificaron además con sus suites sin caché.
- `go vet . ./internal/... ./codegen/...` y `go build . ./internal/... ./codegen/...`: pasaron.
- Compilación cruzada Linux de raíz/internal/codegen: pasó. No se ejecutó el binario Linux.
- Codegen ejecutado: no cambió los tres archivos TypeScript respecto del estado de entrada; sí actualizó los inventarios JSON de handlers/structs. Una segunda generación dio los mismos hashes SHA-256 en los cinco archivos generados.
- `pnpm --filter kamehouse-web typecheck`: pasó.
- `go mod tidy -diff`: pasó sin cambios. No se alteraron go.mod/go.sum por esta revisión.
- `git diff --check`: pasó en el código y documentos revisados.
- No se ejecutó race: `CGO_ENABLED=0` y no se encontró GCC/Clang en PATH ni en las ubicaciones habituales comprobadas. No se instaló un compilador.
- Sin reinicio, acceso a la base personal, borrado de datos personales, commit, push ni despliegue. Las pruebas usan bases, servidores y carpetas temporales.

Los fallos reproducidos antes de corregir se distinguen de los escenarios agregados como regresión. Las comprobaciones estáticas, las compilaciones y los tests sintéticos no sustituyen la validación con Drive/OAuth reales, biblioteca personal, TV/control remoto o sesiones prolongadas de reproducción.
