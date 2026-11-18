# Cachés de disco y descargas pendientes — 2026-11-10

## Corrección comprobada

`BlockCache.Clear` podía borrar el directorio y devolver el control, pero una descarga admitida anteriormente y bloqueada antes de recibir las cabeceras recreaba después `meta.json` y su bloque. La regresión `TestBlockCacheClearRetiresPendingDownloadWithoutInterruptingReader` falló antes del cambio con `retired download repopulated cleared cache: [d pending/]`.

Se añadió una generación por limpieza, compartida por las claves de descargas en curso y por la admisión de escrituras. `Clear` se serializa con escrituras ya iniciadas y retira las siguientes escrituras de generaciones anteriores. Las peticiones nuevas no se unen a esas descargas. Cada lector conserva la generación con que empezó; incluso sus descargas de bloques posteriores a la limpieza terminan sin persistir.

La descarga conserva sus propios metadatos y el lector conserva el primer bloque admitido, por lo que limpiar la caché durante la espera de cabeceras o durante el cuerpo no destruye la lectura activa ni la mezcla con un bloque nuevo del mismo tamaño. Una publicación tardía de metadatos cargados del disco también verifica la generación y conserva una actualización concurrente ya publicada.

El índice de bloque del lector se publica sólo después de abrir correctamente el archivo o la descarga; una apertura cancelada no deja un índice aparentemente abierto con recursos nulos.

## Cobertura y validación

- Nueva regresión de limpieza antes de recibir cabeceras: la lectura previa termina; al finalizar la descarga la caché permanece vacía; una petición posterior descarga y persiste normalmente.
- Nueva regresión de limpieza con cuerpo pendiente: una petición nueva obtiene contenido nuevo sin esperar al cuerpo antiguo; el lector anterior termina sus dos bloques con su propio contenido; el escritor antiguo no reemplaza los bloques nuevos.
- `go test ./internal/drive -run '^TestBlockCacheClear' -count=10 -timeout 60s`: pasó, incluyendo el caso de dos bloques.
- `go test ./internal/drive ./internal/util/filecache ./internal/util/cache -count=1 -timeout 90s`: pasó. La suite completa se ejecutó con el guard de publicación de metadatos; después sólo se amplió la regresión del cuerpo a dos bloques y se repitió diez veces.
- Revisados `filecache` (descarte de handles retirados, guardados y carga), `cache/thumbnail_disk.go` (pruning y temporales) y `drive/blockcache.go` (escrituras, eviction, lectores y limpieza). Esta pasada modifica únicamente el último módulo y añade sus regresiones.

No se hicieron optimizaciones ni se atribuyen mejoras de velocidad. Se conserva el límite de disco, la reserva y el funcionamiento de revisiones. No se eliminan funciones activas ni cambian rutas, configuración o contratos HTTP.

## Límites

Pruebas con directorios temporales y upstream sintético; ninguna cuenta Drive, base personal o proceso de la instancia real. Las descargas anteriores siguen con su timeout existente: la limpieza no las cancela. Lectores antiguos pueden continuar descargando bloques en memoria, pero no repueblan la caché. Las eliminaciones que fallen por archivos abiertos u otros errores del sistema conservan el comportamiento previo de `Clear`; no se cambió su firma para propagar errores. El detector de carreras continúa pendiente por ausencia de compilador compatible y CGO deshabilitado.
