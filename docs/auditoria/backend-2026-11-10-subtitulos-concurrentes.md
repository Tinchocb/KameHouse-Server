# Listados concurrentes de subtítulos Drive — 2026-11-10

## Hallazgo y cambio

La caché por carpeta reutilizaba listados terminados, pero diez episodios concurrentes de una carpeta fría ejecutaban diez listados idénticos. La nueva regresión `TestConcurrentSubtitleEpisodesShareFolderListing` falló antes del cambio: esperado un listado, obtenidos diez.

Se añadió una carga compartida por carpeta y cliente. El primer solicitante ejecuta el HTTP de forma síncrona; los demás esperan su resultado con su propio contexto. No hay goroutines productoras desligadas ni un contexto de fondo. El mapa sólo conserva cargas activas y se limpia al terminarlas.

Cancelar un solicitante que espera no cancela al productor. Si se cancela el contexto del dueño, éste termina y un solicitante todavía activo puede hacerse dueño de un nuevo intento con su propio contexto. No hereda la cancelación del solicitante anterior. Los errores de proveedor se comparten con los solicitantes que ya esperaban esa carga; no se almacenan en las cachés, por lo que una petición posterior reintenta normalmente.

Se conservan cachés LRU por cliente, expiración original del listado, aislamiento entre clientes, rechazo tras desconexión, clones de respuesta y límite de paginación. No se deduplican consultas de metadatos de episodios diferentes: cada uno sigue verificando su carpeta.

## Medición antes/después

Benchmark con diez episodios distintos lanzados concurrentemente, cliente frío en cada iteración, servidor HTTP local y demora sintética de 10 ms por listado. AMD Ryzen 5 5600G, Windows amd64. Tres repeticiones de 300 ms, mismos fixtures:

| Métrica por grupo de diez episodios | Antes | Después |
| --- | --- | --- |
| Solicitudes HTTP | 19,90–20,00 | 11,00 |
| Tiempo | 12,09–17,41 ms/op | 11,38–11,62 ms/op |
| Asignaciones | 418705–447120 B/op | 302140–302632 B/op |
| Cantidad de asignaciones | 3040–3117 allocs/op | 1836–1866 allocs/op |

El resultado principal es evitar nueve listados duplicados en la ráfaga; siguen diez consultas de carpeta y un listado. La demora facilita solapamiento de misses y no representa la latencia real de Google. La variación anterior a 19,90 solicitudes refleja iteraciones donde algún episodio llegó después de llenarse la caché. Estos valores no describen el tiempo completo de iniciar reproducción.

```text
go test ./internal/drive -run '^$' -bench '^BenchmarkConcurrentSubtitleEpisodes$' -benchmem -count=3 -benchtime=300ms
```

## Validación

- Regresión inicial fallida con diez listados en vez de uno.
- Pruebas nuevas de cancelación independiente del waiter, cancelación del dueño con relevo de un solicitante activo y errores compartidos sólo en la carga actual.
- `go test ./internal/drive -run 'SubtitleWaiter|SubtitleOwner|SubtitleFolderFailure|ConcurrentSubtitle' -count=10 -timeout 60s`: pasó.
- Pruebas existentes de TTL, reintento tras error, aislamiento de cliente y clonación: pasaron con el cambio.
- `go test ./internal/drive -count=1 -timeout 90s`: pasó.

Cambios exclusivamente en `internal/drive/subtitles.go` y nuevo `subtitle_concurrency_test.go`; no hay contratos públicos nuevos, dependencias, codegen, acceso Drive real, reinicio o datos personales. Detector de carreras pendiente por falta de compilador compatible/CGO.
