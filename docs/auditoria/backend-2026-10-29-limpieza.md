# Revisión de archivos prescindibles del backend

Fecha: 2026-10-29. Revisión complementaria a `backend-2026-10-29-revision.md`.

## Resultado

No se identificaron archivos completos que puedan eliminarse con evidencia suficiente. No se eliminaron fuentes, pruebas, datos, ejecutables ni recursos embebidos.

## Evidencia

- No se encontraron archivos de tamaño cero dentro de `apps/server`.
- Se comparó `go list ./...` con `go list -deps . ./codegen`: el único paquete fuera del grafo productivo es `internal/mkvsubs/mkvtest`, utilizado como generador de fixtures para pruebas.
- Un barrido de declaraciones de funciones libres y referencias en los archivos Go no encontró nombres presentes únicamente en su declaración. Es una comprobación textual orientativa, no una demostración de ausencia de código muerto.
- `internal/database/models/models_helper.go` tiene consumidores en core y handlers.
- `internal/library/anime/episode_helper.go` tiene consumidores en `entry_helper.go`.
- `internal/util/map.go` sostiene las estructuras `result.Cache` y `result.Map`, usadas por handlers y reproducción.
- `internal/util/useragent.go` se usa en `internal/handlers/status.go`.
- `internal/icon/logo.png` está embebido desde `main.go`.
- Se conservaron los cambios previos y las correcciones concurrentes de la sesión de auditoría principal.

## Candidato de simplificación, no de borrado de archivo

La etiqueta `nosystray` del Makefile no tiene restricciones de compilación Go asociadas y el target no tiene consumidores encontrados en los archivos versionados. Sin embargo, sus flags de enlace difieren del target normal en Windows: eliminarlo como si fuera un duplicado exacto perdería esa variante. Conviene definir primero qué variantes de compilación se mantienen. El Makefile completo sigue teniendo usos y no corresponde borrarlo.

La opción de configuración `Systray` y el contrato `TvMode` requieren tratar compatibilidad y generación de contratos por separado; no justifican eliminar sus archivos contenedores.

## Alcance

Validación local: `go build -p 1 ./...` pasó con Go 1.26.6, `GOMAXPROCS=2`, módulos readonly y resolución offline. La compilación incluye el estado compartido del checkout; no atribuye a esta revisión las correcciones de la otra sesión.

Esta revisión cubre referencias estáticas y dependencias del checkout actual. No valida reproducción real ni demuestra que todos los métodos y ramas sean alcanzables. No se borran archivos para cumplir una cuota de limpieza cuando la evidencia muestra usos activos.
