# Continuación: propiedad de las fichas cacheadas

## Problema y corrección

`GetLibraryMediaByID` y `GetLibraryMediaByTmdbIdAndType` devolvían una copia superficial de LibraryMedia. Los cinco buffers JSON persistidos (`Synonyms`, `Genres`, `Tags`, `AudioTracks`, `SubtitleTracks`) conservaban el mismo almacenamiento que la caché. Modificarlos desde una respuesta contaminaba otras lecturas, incluso desde la primera devolución posterior a SQL.

Se copian esos cinco buffers antes de devolver una ficha, tanto en lecturas SQL como en aciertos de caché. Se conservan las generaciones de caché y los resultados negativos existentes. Los campos Relations y Characters no requieren copia en este recorrido: están excluidos de GORM y los dos únicos puntos que publican estas entradas reciben exclusivamente resultados SQL sin esos campos.

Es una corrección de aislamiento y consistencia. No se atribuye una mejora de latencia; copiar los buffers agrega trabajo proporcional a su tamaño.

## Evidencia

La regresión `TestLibraryMediaCachedJSONOwnership` falló antes de la corrección en ambas vías de lectura: una mutación de la devolución SQL cambiaba otra respuesta. Después pasó junto con las regresiones de LibraryMedia, repetidas con `-count=20 -cpu=1,4,12`. Cubre los cinco buffers y devoluciones frías y calientes.

Verificación integrada posterior aprobada desde `apps/server`:

- `go test -short . ./internal/... ./codegen/...`.
- `go vet ./...`.
- `go build -buildvcs=false ./...`.
- `git diff --check` limitado a los archivos de esta continuación.

El detector de carreras sigue pendiente por las limitaciones del entorno documentadas en la revisión de siete frentes. Las repeticiones con distintas CPU no lo sustituyen.

## Límites

Esta tanda no modificó el cierre de proveedores retirados ni la resolución de conflictos entre enriquecimiento persistente y ediciones simultáneas. El primer punto se abordó después en la [continuación de ciclo de vida](backend-2026-11-07-retiro-proveedores.md), con sus propios límites y pruebas.

No se reinició la instalación real ni se reemplazó su ejecutable.
