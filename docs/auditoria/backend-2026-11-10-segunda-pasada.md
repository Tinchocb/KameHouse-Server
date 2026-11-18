# Segunda pasada: exportaciones y tareas Drive

Implementación local del 10 de noviembre de 2026. Se preservaron los cambios anteriores. Esta pasada completa el plan de permisos de backups, cancelación de esperas, cierre de subtítulos Drive y generación de diagnósticos. No retira funciones activas ni cambia rutas o esquemas de respuesta.

## Hallazgos reproducidos y correcciones

### Permisos de backups

Las pruebas devolvían 200 y ejecutaban el handler aun con `ViewSettings` deshabilitado al descargar backups por GET/HEAD o crearlos por POST. Crear también ignoraba `UpdateSettings`.

El middleware ahora exige `ViewSettings` para acceder a backups y suma `UpdateSettings` para las operaciones de escritura. La autenticación existente se conserva. Los tests comprueban tanto el 403 como que no se ejecuta el handler; las combinaciones permitidas siguen llegando a él.

Prueba: `handlers/feature_access_test.go`.

### Espera cancelable para backups

Una prueba mantiene ocupado el mutex de backups, espera a que otra solicitud intente usarlo y cancela esa solicitud sin liberar el mutex. Antes la solicitud seguía bloqueada. Ahora regresa con `context.Canceled` y no crea archivos.

Se extrajo `util.LockContext` a partir de la adquisición cancelable que ya utilizaba filecache. Backups y eliminación de buckets comparten ese contrato: camino inmediato con `TryLock`, espera mediante ticker de 5 ms solo ante contención y salida por contexto, sin dejar una goroutine bloqueada en el mutex. Se conserva la serialización de publicación y rotación de backups.

Pruebas: `database/db/backup_lifecycle_test.go` y regresiones de cancelación de filecache.

### Propiedad de extracciones Drive

Se reprodujo que una extracción en cola continuaba registrada como `queued` después de cerrar el repositorio y que otro repositorio veía ese mismo trabajo global. También se aceptaba otro pedido después del cierre.

Los trabajos y su mutex ahora pertenecen a cada repositorio. Solo el semáforo que limita el consumo de ancho de banda sigue compartido. Cada extracción tiene cancelación individual derivada del contexto del repositorio y se admite mediante su registro de tareas. El cierre detiene primero nuevas admisiones, cancela y espera los trabajos antes de liberar los demás recursos.

La prueba inicia dos extracciones para la misma ruta en repositorios distintos: cerrar uno cancela su trabajo, mantiene el otro en cola y permite cancelarlo por separado. Se conserva el estado `error` y el mensaje `cancelled` para cancelaciones.

Prueba: `mediastream/drive_cleanup_test.go` y suite existente de extracción/reintentos.

### Aperturas y lectores de ventanas Drive

Las aperturas y lectores se incorporaron al mismo registro de tareas. Sus contextos de vida ya no parten de `context.Background` independiente. La cancelación de un request sigue sin cancelar una apertura compartida que necesita otro cliente; el cierre del repositorio sí la cancela.

El registro de ventanas tiene cierre explícito: rechaza solicitudes nuevas y no publica sesiones de aperturas tardías. El cierre no espera red manteniendo los mutexes del registro o de sesiones. Las sesiones se cancelan, los lectores liberan sus slots y se espera su terminación. Una admisión rechazada no deja el estado `running` reservado.

Las pruebas usan fuentes sintéticas controladas: una apertura que devuelve tarde pese a recibir cancelación y una lectura que retiene su slot hasta liberar expresamente el recurso. Verifican que el cierre espera, que no queda una sesión publicada y que los slots vuelven al nivel anterior.

Pruebas: `mediastream/drive_cleanup_test.go`, además de las suites existentes de ventanas, seeks y fallos intermitentes.

### Finalización de caché

La finalización de ventanas ahora devuelve errores en lugar de ignorarlos. Comprueba cancelación antes de persistir, entre pistas y al publicar marcadores. Los marcadores se escriben mediante reemplazo atómico, con comprobación de cancelación antes y después de la escritura. Su publicación y reversión se serializan por repositorio: si se observa cancelación durante la escritura, se restaura el marcador anterior o se retira el nuevo si no existía. Una finalización fallida no queda marcada como `complete` en memoria y puede reintentarse.

Se verifica que una finalización ya cancelada no modifica un marcador completo anterior, que una cancelación observada después de escribir restaura el marcador previo y que una lectura cancelada al cerrar no publica uno nuevo. Las cachés completas previas se conservan. Las escrituras individuales de sistema de archivos no se vuelven interruptibles: se comprueba el contexto entre operaciones.

### ZIP de diagnóstico

Se reprodujo que el handler generaba todo el reporte y devolvía éxito incluso con el contexto cancelado antes de empezar o durante el callback de flush.

La generación ahora ocurre en el propio handler mediante `writeDiagnosticsArchive`; se retiraron el pipe, la goroutine productora y la espera fija de 100 ms. El callback de flush conserva su ejecución síncrona. Los errores de creación de entradas, copia, escritura, flush y cierre del ZIP se propagan. No se intenta terminar el archivo después de un fallo de salida.

Un lector y escritor conscientes del contexto acotan las copias. Las estadísticas de filecache disponen de variantes con contexto y los recorridos de directorios comprueban cancelación en cada entrada. Los logs/estadísticas opcionales ausentes siguen siendo tolerados. El archivo de log se cierra incluso si la escritura falla o genera un panic.

El ZIP conserva `logs/latest.log` cuando hay log disponible, `settings.json` cuando se obtienen ajustes, `runtime.json` y `disk-usage.json`. Se mantiene la redacción de la API key y credenciales de Drive, sin modificar los ajustes cacheados. Las pruebas abren y leen el ZIP completo, comprueban headers HTTP y redacción, simulan un escritor desconectado antes del snapshot de ajustes y un error en la última escritura del cierre.

Pruebas: `handlers/diagnostics_lifecycle_test.go` y `util/filecache/stats_context_test.go`.

## Contratos y validación

- Sin cambios de rutas, nombres de campos o estados públicos. Los cambios de 200 a 403 corresponden a permisos deshabilitados que antes se omitían.
- Las APIs anteriores de estadísticas de caché se conservan como wrappers con contexto de fondo; el diagnóstico usa las variantes cancelables.
- `go test -short . ./internal/... ./codegen/... -count=1 -timeout 180s`: pasó. Tras el último ajuste del orden de cierre, las regresiones de Drive/diagnósticos/backups/filecache se ejecutaron otra vez sin caché y pasaron.
- `go vet . ./internal/... ./codegen/...` y compilación de raíz/internal/codegen para Windows: pasaron.
- Compilación cruzada de los mismos paquetes para Linux: pasó; no se ejecutó ese binario.
- Codegen ejecutado dos veces: hashes SHA-256 estables en sus cinco archivos. Los JSON de inventario se actualizaron; en TypeScript solo apareció la sección de comentarios vacía del nuevo archivo `diagnostics`, sin cambios de tipos/endpoints.
- `pnpm --filter kamehouse-web typecheck`: pasó.
- `git diff --check`: pasó. Inventario actualizado: 58 paquetes, 336 archivos de producción y 292 de pruebas bajo `internal`.
- No se ejecutó detector de carreras con `CGO_ENABLED=0`. No se instalaron compiladores ni dependencias nuevas.

No se reinició la aplicación, accedió a la base personal, borraron datos personales, hicieron commits, push ni despliegues. Las pruebas usan SQLite, archivos, escritores y fuentes de medios temporales/sintéticas. Drive/OAuth reales, la biblioteca personal y dispositivos físicos siguen fuera de esta validación.

La ausencia de nuevos datos tras el cierre se comprobó sobre las tareas propiedad del repositorio. Los timeouts de red y el ciclo de vida de las descargas compartidas de la caché de bloques conservan sus contratos anteriores. No se atribuye una mejora de rendimiento global sin medición.
