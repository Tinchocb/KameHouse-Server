# Drive: lectura parcial y subtítulos concurrentes

Revisión local del 10 de noviembre de 2026. Conserva el árbol de trabajo previo, contratos y funciones activas; no modifica datos personales ni reinicia la instancia.

## Lectura dispersa de subtítulos

`driveSubtitleSource` compartía la caché de bloques con la reproducción usando también su política de precarga. El parser salta entre cabeceras, Cues y clusters de las ventanas solicitadas; precargar los bloques siguientes a cada salto consume bytes que ese recorrido no necesita.

Se cambia únicamente este consumidor a `FetcherWithoutReadAhead`, que ya existía para lecturas dispersas. Mantiene el mismo almacenamiento, claves/revisiones, deduplicación de bloques y reutilización por reproducción; las peticiones de vídeo conservan la precarga. El fixture de ventanas ahora utiliza la misma política que el consumidor real. No se cambiaron los umbrales ni las comprobaciones de contenido de los tests.

### Medición

- Mismo MKV sintético de 300 segundos y aproximadamente 112,4 MiB; mismas ventanas 0–90 y 140–290 segundos.
- Antes: 100,1 MiB descargados, aproximadamente 89% del archivo, en diez repeticiones.
- Después: 96,6 MiB, aproximadamente 86%, en diez repeticiones. Se conservan los subtítulos de ambas ventanas y se verifica que el tramo no solicitado no aparezca.
- En la pasada anterior se había observado un fallo puntual por superar el umbral del 90%. No se reprodujo en las diez corridas previas de esta pasada. El cambio elimina la precarga especulativa de ese recorrido y sus bytes ajenos a la ventana; no se afirma haber reproducido todas las causas posibles del fallo histórico.

Benchmark adicional con los mismos datos sintéticos en ambas políticas: cinco lecturas `ReadAt` de 256 bytes en bloques alejados de un archivo de 64 bloques de 64 KiB. Se espera a que finalicen todas las descargas antes de medir sus contadores, incluyendo las especulativas.

| Política | Solicitudes por operación | Bytes descargados por operación | Asignaciones de memoria |
| --- | ---: | ---: | ---: |
| Precarga de reproducción | 9 | 589824 | 646792–712112 B/op |
| Solo bloques solicitados | 5 | 327680 | 387818–409741 B/op |

Tres corridas de tres operaciones por política con `-benchmem`; los tiempos incluyen inicialización de caché, disco temporal y espera de descargas y no se interpretan como latencia real de Google. La reducción del 44,4% corresponde exclusivamente a este patrón disperso; el caso de dos ventanas del MKV tiene una reducción menor, de aproximadamente 3,5 MiB.

```text
go test ./internal/mediastream -run '^TestDriveWindowReadsOnlyTheRequestedPart$' -count=10 -timeout 90s -v
go test ./internal/drive -run '^TestSparseRangeSource' -count=1 -timeout 30s
go test ./internal/drive -run '^$' -bench '^BenchmarkSparseRangeSourcePolicy$' -benchmem -count=3 -benchtime=3x
```

La regresión de `RangeSource` valida datos de cinco lecturas separadas, ausencia de bloques especulativos y cero solicitudes adicionales al repetirlas con caché caliente.

## Solicitudes concurrentes

El subagente reprodujo que diez episodios distintos abiertos simultáneamente consultaban diez veces el mismo listado de una carpeta fría. Se comparte ahora una carga síncrona por cliente/carpeta, sin goroutines productoras desligadas. Cada solicitante puede cancelar su espera independientemente. Si cancela el dueño de la petición, un solicitante todavía activo reintenta con su propio contexto. Los errores se comparten con los que ya esperaban, pero no se cachean.

Se mantienen los clones de respuesta, límites LRU, expiración original, aislamiento entre clientes y rechazo tras desconexión. Las consultas de metadatos de episodios diferentes siguen siendo individuales.

Benchmark de diez episodios concurrentes con cliente frío, servidor HTTP local y demora sintética de 10 ms por listado, tres corridas de 300 ms:

- Antes: 19,90–20 solicitudes y 418705–447120 B/op.
- Después: 11 solicitudes y 302140–302632 B/op.
- El ahorro es de hasta nueve listados duplicados por ráfaga, no una predicción de latencia con Google real.

Las regresiones de ráfaga fría, cancelación del solicitante, relevo tras cancelación del dueño y reintento después de error pasaron diez veces. [Detalle del subagente y comandos](backend-2026-11-10-subtitulos-concurrentes.md).

## Validación conjunta y límites

- `go vet . ./internal/... ./codegen/...`: pasó.
- Compilaciones de raíz/internal/codegen para Windows y Linux: pasaron. El binario Linux no se ejecutó.
- Codegen ejecutado dos veces con hashes SHA-256 idénticos en los cinco archivos generados, también iguales a la pasada anterior; sin cambios de contratos, tipos ni endpoints. No se repitió typecheck del frontend.
- Inventario actualizado: 58 paquetes, 337 archivos de producción y 302 archivos de pruebas bajo `internal`.
- `go test -short . ./internal/... ./codegen/... -count=1 -timeout 180s`: pasó, incluida la suite completa de ventanas/subtítulos y sus comprobaciones de lectura parcial.
- Comprobación final de whitespace sobre los archivos de esta pasada: pasó.

Pruebas con HTTP local, archivos temporales y medios sintéticos. Google Drive/OAuth reales, reproducción en dispositivos y biblioteca personal no están validados. Sin detector de carreras: CGO está deshabilitado y no hay compilador C instalado. Sin cambios de dependencias, commit, push, despliegue o reinicio.
