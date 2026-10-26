# Super Hero — bloqueo de reproducción del 25/10/2026

Revisión de solo lectura del proceso de desarrollo activo y sus registros. Horas locales de Buenos Aires.

## Confirmado

- A las 20:08:21 el backend pasó la película de Drive a HLS, conservando el video y recodificando audio.
- A las 20:08:57 dos peticiones agotaron la espera de 30 segundos del segmento 82 y entraron al primer reintento.
- El índice de keyframes de esa sesión sitúa el comienzo del segmento 82 en 317,651 segundos (05:17,651).
- Los archivos de video y audio del intervalo se siguieron escribiendo hasta las 20:08:57–58; luego aparecieron los siguientes segmentos.
- `/api/health` respondió 200 con DB, migraciones, caché y FFmpeg en estado OK a las 20:10:37. Esa comprobación es posterior al incidente y no mide el desempeño durante el bloqueo.

## Registros relevantes

```text
2026-10-25 20:08:21 |INF| mediastream: Drive stream type switched from=direct reason="container or codecs not supported by this client" to=transcode
2026-10-25 20:08:21 |INF| mediastream: Client decodes source video, copying it (audio-only transcode) filepath=[ruta interna omitida]
2026-10-25 20:08:23 |INF| mediastream: Drive subtitle window opened attachments=2 cues=14391 durationMs=6002816 hash=1f33bd61d58ee88225b862ddd7a93b23 opens=1 size=15315967300 took=1733.7535 tracks="0=S_TEXT/UTF8/spa/text 1=S_TEXT/UTF8/spa/text 2=S_TEXT/ASS/spa/text 3=S_TEXT/ASS/spa/text 4=S_TEXT/UTF8/spa/text 5=S_TEXT/UTF8/spa/text 6=S_HDMV/PGS/jpn/skip 7=S_TEXT/ASS/spa/text 8=S_TEXT/ASS/und/text"
2026-10-25 20:08:24 |INF| cassette: keyframes extracted successfully using Go matroska parser elapsed=317.9883 keyframes=1682
2026-10-25 20:08:24 |DBG| cassette: audio needs re-encode audio=1 bitrate=192k channels=2 codec=aac
2026-10-25 20:08:24 |DBG| cassette: audio needs re-encode audio=6 bitrate=192k channels=2 codec=aac
2026-10-25 20:08:57 |WRN| cassette: segment wait timed out, retrying... error="context deadline exceeded" attempt=1 seg=82
2026-10-25 20:08:57 |WRN| cassette: segment wait timed out, retrying... error="context deadline exceeded" attempt=1 seg=82
```

## Archivos de la sesión observados

| Archivo | Creación | Última escritura | Bytes |
|---|---|---|---:|
| `segment-source-0-81.ts` | 20:08:27 | 20:08:57 | 15710972 |
| `segment-source-0-82.ts` | 20:08:27 | 20:08:57 | 1209592 |
| `segment-a6-0-81.ts` | 20:08:26 | 20:08:57 | 325428 |
| `segment-a6-0-82.ts` | 20:08:57 | 20:08:58 | 121824 |

La fecha de última escritura no prueba el momento exacto en que el segmento se marcó como listo en memoria; permite correlacionar la demora con actividad de los productores de video y audio.

## Diagnóstico y límites

La causa inmediata de la congelación es que HLS se quedó sin el segmento esperado durante más de 30 segundos. La combinación de copia de video, entrada remota y avance simultáneo detenido en audio/video apunta a una espera en la alimentación de FFmpeg/lectura de Drive, pero los registros disponibles no bastan para separar esa hipótesis de los reinicios o programación de encoders. No hay en el tramo revisado un error explícito de FFmpeg, cuota de Drive, SQLite ocupado o caída del proceso.

El archivo de origen mide 15.315.967.300 bytes y dura aproximadamente 6.002,816 segundos. La caché de bloques conservaba unos 2,08 GB de esa película. Se observaron archivos de salida de varios encoders; esto prueba trabajo de varias cabezas durante la sesión, pero por sí solo no prueba simultaneidad incorrecta ni cuál disparó el retraso.

## Siguiente comprobación técnica

1. Registrar pipeline y tipo (video/audio), encoder, rango asignado, tiempo de espera y si hay una cabeza cubriendo el segmento en el warning de timeout; actualmente solo informa `seg` y `attempt`.
2. Correlacionar apertura y lectura de bloques Drive con esos tiempos (offset/rango, bytes recibidos, reintentos y duración), evitando credenciales en las URLs registradas.
3. Verificar deduplicación de las solicitudes de la misma región y arranque de cabezas no especulativas antes de atribuir el incidente exclusivamente a la red.
4. No aumentar el timeout como sustituto de localizar la espera: ocultaría el síntoma y alargaría el bloqueo.

No se modificó código, configuración, caché ni archivos de la película; no se reinició el servidor. Se consultaron los endpoints de logs y salud existentes. Las URLs internas y sus credenciales se omitieron de esta evidencia.
