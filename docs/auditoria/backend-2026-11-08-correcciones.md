# Correcciones de la auditoría de backend — 2026-11-08

Alcance: corregir los 16 hallazgos consolidados de arquitectura, API, streaming,
seguridad, base de datos e integración. Se trabajó sobre el árbol local existente,
preservando cambios anteriores. No se abrió la base real, no se reinició la instancia,
ni se realizó commit, push o despliegue.

## Cambios

| Hallazgo | Corrección |
| --- | --- |
| 1. Limpieza confunde PK e ID público | Conserva historial, skip times y filler independientes de metadata; revalida asociaciones dentro de la transacción e invalida caché después de limpiar. |
| 2. Resolver devuelve otra obra por coincidencia de PK | Resolver compartido por asociación explícita y proveedor/tipo; nunca busca una PK usando un ID público. Las identidades ambiguas devuelven 409. |
| 3. Asignación pierde proveedor | Contrato `provider` + `externalId`; frontend transmite el origen seleccionado. El parámetro legacy `tmdbId` conserva significado exclusivamente TMDB. |
| 4. Tipo e identidad de película inconsistentes | Asignación TMDB guarda SHOW/MOVIE y aplica el offset público de películas. Jikan conserva identidad MAL y tipo ANIME. |
| 5. Marcar visto no persiste | Escritura local de MediaEntryListData, preservando puntuación y otros campos de usuario. |
| 6. Token streaming aceptado como estado OAuth | Estado aleatorio de un solo uso, con expiración, ligado a credenciales y redirect del inicio. Credenciales distintas de las configuradas se rechazan; un cambio durante el flujo obliga a reconectar. |
| 7. Falta autenticación del cliente | Acceso con contraseña, sesión por servidor en sessionStorage y transporte HTTP/WS; logout y renovación a mitad del TTL configurado, con máximo de una hora entre renovaciones. La contraseña no se persiste. Incluye descargas de respaldo/informe. |
| 8. HLS pierde autorización | Tokens de reproducción en todo el árbol de listas en vivo y estáticas, incluidos audio y segmentos. |
| 9. Refresco elimina restricciones CLI | Los ajustes no eliminan restricciones explícitas; lockdown conserva también las restricciones adicionales indicadas por flags. |
| 10. Extracción parcial aceptada como completa | Staging y manifiesto de finalización publicado tras éxito; validación de archivos y tamaños. |
| 11. Cache hit impide reintento | Reutilizar un contenedor vuelve a asegurar idempotentemente su extracción. |
| 12. Drive conserva otra revisión | Namespace de bloques, URLs y cachés de reproducción/subtítulos por revisión; aislamiento de descargas en vuelo. |
| 13. Asignación reescribe toda la biblioteca | Transacción actualiza solo rutas y columnas seleccionadas; valida rutas y revierte si faltan. |
| 14. Ajustes compartidos sin sincronización | Snapshots privados publicados atómicamente; cada operación conserva su generación. |
| 15. Música expone carpetas arbitrarias a LAN | Clientes remotos quedan limitados a la raíz musical guardada y sus subcarpetas; canonicalización de rutas y enlaces. La exploración local sigue disponible. Caché de tema aislada por base de datos. |
| 16. Migración parcial marcada como completa | Cambios y marcador en una transacción; propagación del fallo, rollback y reintento. |

## Validación

Las regresiones de identidad, progreso, asignación concurrente,
limpieza, migración fallida, OAuth, restricciones, snapshots, música, extracción
de subtítulos y revisión de Drive usan bases y archivos temporales.

Resultados finales:

- `go test -short . ./internal/... ./codegen/...`: pasó en todos los paquetes.
- `go vet . ./internal/... ./codegen/...`: pasó.
- `pnpm --filter kamehouse-web test:run`: 191 archivos y 1435 pruebas pasaron.
- `pnpm --filter kamehouse-web build`: pasó, incluyendo TypeScript y bundle de producción.
- Lint específico de los archivos de autenticación, transporte y recursos: pasó.
- `node --test scripts/backend-tooling.test.mjs scripts/prepare-desktop-dev.test.mjs`: 3 pruebas pasaron.
- Codegen ejecutado y repetido: los cinco contratos JSON/TypeScript mantuvieron
  los mismos hashes después de regenerar.
- `git diff --check` sobre las superficies modificadas de backend/integración:
  pasó. El árbol completo contiene espacios en blanco previos en otros archivos.

Los contratos de autenticación incluyen HTTP y WebSocket mediante un servidor
HTTP efímero real, reconexión, credencial inválida, presupuesto de intentos,
expiración y TTL API configurado de cinco minutos. Los tokens de recursos son
independientes y duran doce horas, restringidos a lecturas. Las pruebas HLS
siguen el árbol estático de video/audio y verifican las listas en vivo sin iniciar
un encoder ni descargar contenido real.

El build conserva avisos no bloqueantes sobre un archivo de prueba de Drive que
el generador de rutas descarta y sobre la antigüedad de Browserslist. Algunas
pruebas existentes emiten avisos React `act`; todas las aserciones pasaron.

## Límites

- No se reescribieron asignaciones históricas ambiguas: no es posible inferir con
  seguridad el proveedor correcto desde un entero heredado. Se rechazan con 409
  para que se vuelvan a identificar los archivos explícitamente.
- La consulta de revisión de Drive se deduplica y cachea por cinco segundos para
  evitar una petición de metadata por cada rango. Existe esa ventana de detección
  si el contenido cambia durante la reproducción.
- No se validó contra Google Drive real, hardware de TV ni la biblioteca personal.
- El acceso con contraseña se verificó con pruebas DOM; falta una comprobación
  visual y de reproducción en las aplicaciones Desktop/TV reales.
- El entorno tiene CGO desactivado y no se encontró compilador C; la verificación
  con detector de carreras requiere un entorno con esa herramienta disponible.
