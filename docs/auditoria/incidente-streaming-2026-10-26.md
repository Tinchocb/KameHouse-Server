# Streaming y cancelación de FFprobe — 26/10/2026

## Evidencia

En `KameHouse-2026-10-26_13-35-35.log` (horas de Buenos Aires):

- 13:41:54 y 13:45:41: timeout de segmentos 366 y 48.
- 13:46:17: `pipeline cancelled` de video/audio inmediatamente después de `Received shutdown transcode stream request`; no es evidencia de una caída independiente.
- 13:48:39 y 13:49:09: dos esperas agotadas del segmento 94.
- 13:51:37–13:53:49: extracción de información con FFprobe que termina con `exit status 1`. El request completo termina en 136,79 segundos, con fallback sin información de pistas.

El código configura un contexto de 40 segundos para FFprobe. El ejecutable registrado es `C:\ProgramData\chocolatey\bin\ffprobe.exe`, identificado localmente como `ShimGen generated shim - Chocolatey Shim`. Es un lanzador del binario real, no FFprobe mismo.

Una prueba con HTTP local bloqueado y salidas redirigidas reprodujo el problema: terminar el lanzador dejó la espera de sus pipes abierta durante 4,028 segundos, hasta que cerró el servidor sintético. Ejecutar y terminar el binario real devolvió en 0,004 segundos. Este mecanismo permite exceder el deadline; no demuestra qué bloqueó originalmente la lectura de Drive ni explica por sí solo los timeouts HLS.

## Corrección

- La resolución de FFmpeg y FFprobe conserva sus prioridades y validación de la ruta original. En Windows, reconoce el marcador de versión de ShimGen con una lectura acotada y consulta `--shimgen-help`, que no ejecuta el destino.
- Extrae el destino absoluto existente del mismo nombre, rechaza destinos que sean otro shim y no evita lanzadores con argumentos adicionales. Admite el código de salida no cero que ShimGen utiliza para su ayuda.
- Si no reconoce el formato o no puede resolverlo, conserva la ruta anterior; los binarios normales y otras plataformas mantienen su comportamiento.
- Los warnings de espera HLS incluyen hash de sesión, pipeline, tipo, duración y una copia protegida por lock del estado de los productores: identificador, PID, segmento actual, fin exclusivo, generación y estado de cierre. No agregan URLs ni credenciales.
- Los límites de espera y la política de reintentos no cambian.

## Validación

Go 1.26.6 local, `GOTOOLCHAIN=local`, `GOPROXY=off`, `GOSUMDB=off`, `GOFLAGS=-mod=readonly`.

- Suite de `internal/util/ffmpegutil`, incluida la prueba optativa con `KAMEHOUSE_TEST_CHOCOLATEY_BIN=C:\ProgramData\chocolatey\bin`: pasó. En la prueba HTTP local, cancelación de FFprobe en 4,7 ms y de FFmpeg en 3,2 ms.
- `go test -race ./internal/util/ffmpegutil ./internal/mediastream/cassette ./internal/mediastream/videofile -count=1`: pasó, incluida resolución real de ambos shims y snapshot concurrente de diagnóstico.
- `go vet ./internal/util/ffmpegutil ./internal/mediastream/cassette ./internal/mediastream/videofile`: pasó.
- `go build ./...` y `git diff --check`: pasaron.

Las pruebas no reproducen una sesión real de Drive ni certifican la resolución de los bloqueos HLS. No se reemplazó el ejecutable del servidor en uso ni se reinició la aplicación. El cambio necesita compilarse e iniciarse en la aplicación para observar los próximos incidentes con los nuevos diagnósticos.
