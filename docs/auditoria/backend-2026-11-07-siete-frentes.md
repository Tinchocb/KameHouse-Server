# Backend: cierre de los siete frentes — 2026-11-07

El usuario pidió dividir la revisión en siete subagentes. Se trabajó en tandas de hasta tres subagentes activos, conservando el árbol local y el trabajo concurrente de web/escritorio. Los frentes 4, 5 y 6 se retomaron tras un corte por límite de uso desde sus archivos ya modificados, sin reiniciar el trabajo.

No se desplegó, reinició la instancia real, cambió la configuración de Drive, expuso credenciales ni se hizo commit/push. La compilación de validación se realizó en un temporal separado; el ejecutable existente se verificó sin reemplazarlo.

## Resultados por frente

| Frente | Resultado | Evidencia y límites |
| --- | --- | --- |
| 1. Primer fotograma | Tres pruebas aisladas aprobadas: mediana de 545 ms hasta vídeo decodificable y 333 ms hasta HLS listo | MP4 sintético H.264/AAC servido por HTTP limitado, con copia de vídeo Source. No mide la presentación en navegador/Tauri, Drive real ni recodificación pesada. No se detectó instancia activa ni una reproducción histórica correlacionable. |
| 2. Fichas/enriquecimiento | El sondeo de metadata pendiente deja de reconstruir la ficha completa cada segundo; publicación/cooldown protegidos por época | En el caso de cuatro sondeos: dos construcciones frente a las cinco que requería el bucle anterior. Se conservan respuesta inicial y campos; el presupuesto de proveedor sigue siendo cooperativo. |
| 3. Prioridad de reproducción | Una sola extracción Preview global y miniaturas frías integradas al presupuesto; FFmpeg de miniatura con prioridad baja y un thread | Antes un burst de ocho Preview admitía ocho. Los hits de caché no esperan y Live no espera a una Preview activa. Puede aumentar la espera de imágenes frías; no se afirma que todas carguen más rápido. |
| 4. Coherencia de cachés | Generaciones y barreras de publicación Jikan/TMDB, cierre de productores y orden corregido del borrado SQL | Una carga retirada no publica sobre la generación nueva. El DELETE tiene barreras antes/después y ya no devuelve éxito falso ante fallo SQL. No congela todas las solicitudes ni obliga a refetch de las cachés HTTP inferiores. |
| 5. Cancelación/cierre | Enrichment, filler y warmers registran ownership; esperas/SQL de precarga cancelables; proveedor activo cerrado antes de cachés y SQLite | Se comprueban rechazo de admisión, liberación de reservas y orden de cierre. Las operaciones compartidas ya admitidas pueden demorar la unión; no es cierre instantáneo ni cobertura de todo worker posible. |
| 6. SQLite | Lecturas relacionales seleccionan identidad y quince campos del DTO, omitiendo timestamps/tags que no se usan | Fixture de 50.000 filas: 30,8 MB menos asignados (13%) y 1,2 millones menos objetos (23%). Medianas observadas 686,7→619,1 ms con rangos solapados/carga concurrente. Sin índices/PRAGMA/transacciones nuevas. |
| 7. Integración/binario | Suite corta global, vet, build e integraciones focales aprobados; build temporal separado | Go verificado en esta ejecución: 1.27.3 windows/amd64. SHA del ejecutable existente idéntico antes/después. No se ejecutó ni reemplazó ese binario. |

Los resultados de tiempo de frentes distintos no se suman ni se convierten en una mejora global de una pantalla. Los cambios se concentran en evitar trabajo repetido, reducir competencia y memoria temporal, impedir resultados retirados y ordenar el cierre.

## Verificación integrada

El frente 7 verificó después de estabilizar los cambios productivos:

- `go test -short . ./internal/... ./codegen/...`.
- `go vet ./...`.
- `go build -buildvcs=false ./...` y compilación de un ejecutable temporal propio.
- Integraciones reales locales de reproducción sobre HTTP limitado, miniaturas compartidas/caché y probe con aislamiento de metadata.
- Identidad/hash del ejecutable existente antes y después, sin sobrescribirlo.

Las regresiones de cada frente incluyen repeticiones con `-count=20 -cpu=1,4,12` donde corresponde. No equivalen al detector de carreras. Las pruebas con FFmpeg son fixtures locales; no son una sesión real del usuario.

La desigualdad entre el hash de un build temporal y el existente no identifica por sí sola los parches que contiene cada uno: también influyen flags, VCS y recursos embebidos. El checkout y el binario existente son de un árbol modificado, por lo que no se acredita trazabilidad exacta a partir de una revisión Git sola.

## Límites que siguen abiertos

- Falta medir un episodio real de Drive ya autorizado, desde el clic hasta el primer fotograma presentado. Para una línea base real hay que abrir la instalación habitual, reproducir un episodio e identificarlo junto con su hora aproximada. Validar el código local en esa instalación requiere un paso posterior de ejecución autorizado; esta tanda no desplegó.
- `CGO_ENABLED=0` y no se encontró GCC/Clang en PATH: `-race` queda pendiente.
- El retiro de proveedores por hot reload se resolvió en la [continuación de ciclo de vida](backend-2026-11-07-retiro-proveedores.md): las llamadas admitidas terminan antes del retiro normal, y el apagado cancela y une también las generaciones retiradas. Persisten los límites de cancelación de las implementaciones indicados allí.
- Filler conserva operaciones sin API de contexto. Algunas extracciones compartidas de miniaturas/cassette y consultas HTTP ya admitidas conservan sus límites existentes y pueden sobrevivir a la cancelación de un consumidor.
- La publicación de fichas se protege por época, pero no se rediseñó la resolución de conflictos de una escritura persistente de enriquecimiento frente a una edición simultánea de LibraryMedia. La copia superficial de los buffers JSON de su caché se corrigió en la [continuación sobre propiedad de fichas](backend-2026-11-07-propiedad-fichas.md).
- La proyección SQLite conserva el fallback de JSON corrupto BLOB; no corrige la limitación preexistente de ciertos payloads forzados a SQL TEXT que fallan antes del decoder.

## Informes de los subagentes

1. [Medición](backend-2026-11-07-subagente-1-medicion.md)
2. [Fichas](backend-2026-11-07-subagente-2-fichas.md)
3. [Prioridad](backend-2026-11-07-subagente-3-prioridad.md)
4. [Cachés](backend-2026-11-07-subagente-4-caches.md)
5. [Cierre](backend-2026-11-07-subagente-5-cierre.md)
6. [SQLite](backend-2026-11-07-subagente-6-sqlite.md)
7. [Validación y binario](backend-2026-11-07-subagente-7-validacion.md)

Los límites iniciales del informe 2 sobre unión de enrichment quedan parcialmente cubiertos por la integración posterior del frente 5; se conservan los otros límites explícitos de cada informe.
