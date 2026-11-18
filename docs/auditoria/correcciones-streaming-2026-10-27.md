# Correcciones de reproducción — 27/10/2026

## Cambios

- `apps/server/internal/mediastream/cassette/pipeline.go`: una solicitud cancelada devuelve su error sin terminar los productores compartidos ni cerrar el canal de otras esperas. Se rechazan solicitudes ya canceladas antes de registrar velocidad o detectar un cambio de posición. El cierre de sesión, los cambios de posición y el tracker conservan su limpieza explícita; no se cambian los tiempos de espera HLS. Una cancelación aislada ya no fuerza limpieza inmediata del productor: este puede completar su rango acotado o terminar por la gestión de sesión.
- `apps/server/internal/drive/types.go`: se reconoce `video/matroska`, incluso sin extensión. Es el caso real de «La fusión de Goku y Vegeta», que existe y fue legible en Drive pero estaba fuera del índice.
- `apps/server/internal/drive/indexer.go`: ancho y alto de Drive no implican H.264. El códec queda desconocido hasta sondearlo. El upsert conserva datos marcados como verificados si hash, tamaño y fecha de modificación no cambiaron; la decisión se evalúa sobre la fila actual, para no pisar un sondeo completado durante el escaneo.
- `apps/server/internal/database/models/dto/localfile.go`: el JSON técnico admite `probeVerified` para distinguir resultados reales de FFprobe de metadatos parciales o supuestos antiguos. No requiere migración de columnas.
- `apps/server/internal/handlers/drive_mediastream.go`: se persisten video, audio, duración, tamaño y contenedor obtenidos por FFprobe, tanto en directo como en HLS; se invalida la caché de archivos tras actualizar. Se trabaja sobre copias. Si FFprobe falla, la selección automática informa HTTP 502 y permite reintentar, en vez de decidir con un H.264 supuesto. La preferencia explícita «Solo original» conserva la posibilidad de reproducir el archivo directamente sin pistas detectadas.

No se modificaron los registros locales históricos, las preferencias del usuario ni las correcciones previas de resolución de shims y diagnóstico HLS que ya estaban en el checkout.

## Regresiones

- `pipeline_cancellation_test.go`: una solicitud obsoleta no altera productores ni detección de cambios de posición; cancelar una espera en curso conserva la otra solicitud activa y el canal compartido. La limpieza explícita sigue terminando ambos productores simulados.
- `drive_test.go`: Matroska con el MIME real y sin extensión se considera video.
- `indexer_technical_info_test.go`: dimensiones sin códec supuesto; conservación de un sondeo verificado; descarte de datos antiguos no verificados; invalidación por hash, tamaño o fecha cambiados; tolerancia a JSON antiguo malformado.
- `drive_technical_info_test.go`: reemplazo de H.264 supuesto por el códec real, persistencia de pistas, duración y subtítulos externos, invalidación de caché y conservación de los snapshots anteriores. Los sondeos incompletos no se promueven a verificados.

Los dos defectos de cancelación y reconocimiento de Matroska se reprodujeron antes de aplicar los cambios mediante tests cargados por overlay fuera del repositorio. Las nuevas regresiones del repositorio pasan con la corrección.

## Validación

Go 1.26.6 local, `GOTOOLCHAIN=local`, `GOPROXY=off`, `GOSUMDB=off`, `GOFLAGS=-mod=readonly`:

```powershell
go test ./... -short -count=1 -timeout=5m
go vet ./...
go test -race ./internal/drive ./internal/mediastream/cassette ./internal/mediastream/videofile ./internal/mediastream ./internal/handlers ./internal/database/models/dto -short -count=1 -timeout=180s
go test -race ./internal/mediastream/cassette -run 'RepeatedSyntheticHLSReleasesResources|CancelledFragment|FragmentCancellation' -count=1 -timeout=90s -v
go build -trimpath -o <salida-externa>/kamehouse-fixed.exe .
git diff --check
```

La suite general, vet, compilación y pruebas de los paquetes afectados pasaron. La primera ejecución conjunta con detector de carreras agotó la memoria de Windows en `internal/mediastream` (`ThreadSanitizer failed to allocate`, error 1455); los demás paquetes pasaron. Se repitió ese paquete solo, con `GOMAXPROCS=2` y `-p=1`, y pasó en 42,858 s.

La integración con FFmpeg pasó seis ciclos sintéticos de video/audio, cierre, replay y liberación de procesos, slots, mapas y archivos. Es una fuente local pequeña: no certifica decodificación en WebView2/TV, rendimiento 4K ni reproducción sostenida desde Drive.

En el diagnóstico previo pasaron 84 lecturas de 1 KiB (inicio, mitad y final de los 28 archivos remotos). Eso verifica aquellos rangos en ese momento, no la reproducción completa con este ejecutable.

## Instalación preparada, aplazada por el usuario

El usuario eligió «Dejalo preparado para después». El servidor activo y su índice no se reemplazaron ni reiniciaron durante esta implementación.

- Binario compilado: `C:/Users/Tinchoo/.codex/visualizations/2026/10/27/01a17f52-0365-7071-9309-d48c0f52e7a8/backend-review/kamehouse-fixed.exe`.
- SHA-256: `e311cad1dc35b7f8ae1183e848f1912975babd6cd38044c1244c4f65ad35cb3a`.
- Copia SQLite consistente y ejecutable anterior: `C:/Users/Tinchoo/AppData/Roaming/kamehouse-dev/backups/streaming-20261027-190332/`.
- La copia de base contiene datos privados de la aplicación; permanece en la carpeta de datos del usuario.
- Informe del diagnóstico e inventario: carpeta externa `backend-review`, junto al binario.

La operación conjunta de apagar el servidor, reemplazar el ejecutable en uso y volver a iniciarlo fue rechazada antes de ejecutarse por el control automático de herramientas, sin un motivo más específico. Luego se propuso reemplazarlo con KameHouse cerrado y el usuario aplazó la instalación.

Para instalar posteriormente:

1. Si el código o los recursos web embebidos cambiaron desde esta compilación, volver a compilar desde el checkout actual para no reemplazar cambios posteriores.
2. Cerrar KameHouse por completo, incluida la bandeja; comprobar que su servidor terminó.
3. Conservar una copia actual del ejecutable y de la base. La copia existente corresponde al corte de las 19:03 del 27/10/2026; no restaurarla sobre progreso posterior sin revisarlo.
4. Sustituir `D:/Proyectos_personales/KameHouse-rio-grande/apps/server/kamehouse.exe` por el binario verificado y abrir KameHouse normalmente.
5. Ejecutar el escaneo de Google Drive desde la aplicación. Debe incorporar «La fusión de Goku y Vegeta» y retirar supuestos técnicos no verificados. Los códecs reales se guardan al preparar cada reproducción satisfactoriamente.
6. Verificar salud del servidor y Drive, y probar inicio, reproducción sostenida, cambios de posición y pista de audio en las películas afectadas.

No se afirma que el incidente de las 14:27 esté resuelto en ejecución: el defecto se corrigió y validó en código; falta instalar y probar ese comportamiento con la sesión real.
