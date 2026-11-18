# Apertura de episodios y miniaturas de la línea de tiempo

## Evidencia del intento de las 13:23 (Argentina)

Registro: `%APPDATA%/kamehouse-dev/logs/KameHouse-2026-10-30_13-13-47.log`, líneas 80–83.

- 13:23:08: la información multimedia se obtiene de caché (HIT).
- 13:23:10: abrir la ventana de subtítulos de Drive tarda 1873 ms; registra 15 adjuntos y 7530 cues.
- La petición POST `/api/v1/mediastream/request` responde 200 en 2916 ms.
- Esto mide la preparación del servidor, no el tiempo hasta el primer fotograma. No hay medición correlacionada de descarga inicial, decodificación o `playing` del navegador.
- Los procesos FFprobe observados después no prueban que el episodio estuviera esperando ese análisis. El intento registrado usa caché.
- El archivo estaba vacío durante la primera inspección y posteriormente apareció contenido. No se determinó la causa de esa demora en el registro.

## Miniaturas

`apps/web/src/components/video/player-preview.ts` crea un segundo elemento de video y un canvas. Cada posición sin caché requiere cargar metadata, buscar en el video y decodificar un fotograma. La cola es serial; conserva posiciones antiguas al recorrer rápidamente la línea. La caché es temporal y se revoca al cerrar el manager.

`apps/web/src/components/video/player-seek-preview.tsx` muestra un bloque gris cuando no tiene una URL del segmento actual. Los errores se absorben en el manager y el componente: la interfaz no distingue espera de fallo. No hay evidencia de navegador que permita atribuir el fallo concreto a codec, red o canvas.

Los ajustes locales previos (no usar velocidad cero, evitar espera innecesaria en la posición actual, reconocer URLs HLS y quitar precarga especulativa desde el hover) no sustituyen esta arquitectura ni certifican la reproducción real. El usuario sigue observando el fallo.

El endpoint `/api/v1/video-thumbnail` tampoco es una solución directa: para Drive devuelve la miniatura fija de Drive y no un fotograma correspondiente al tiempo solicitado.

## Propuesta de implementación

1. Incorporar storyboards persistentes por archivo y versión: mosaicos de fotogramas reducidos y un manifiesto temporal WebVTT o JSON. Usar identidad de biblioteca, tamaño/fecha de modificación y versión del generador; nunca tokens o puertos efímeros como identidad.
2. Generar con una cola acotada, deduplicación, cancelación, publicación atómica y límite de disco. La generación debe tener menor prioridad que la reproducción. Para Drive, medir el coste de lectura antes de activar preparación de toda la biblioteca: generar imágenes por primera vez no es instantáneo.
3. Servir únicamente recursos de archivos autorizados de la biblioteca, con caché HTTP. El frontend precarga el mosaico necesario y selecciona su recorte por tiempo, sin abrir un segundo video ni disparar búsquedas sobre el stream.
4. Distinguir preparando, listo y fallo; mientras no existe storyboard mostrar el tiempo sin prometer un fotograma. Probar cambio de episodio, movimientos rápidos, extremos, errores y caché fría/caliente.
5. Medir apertura con tiempos separados: solicitud de stream, subtítulos, primer byte, metadata, primer fotograma y reproducción. Evaluar diferir la preparación de subtítulos sin perder selección automática ni fuentes ASS; no eliminarla sin preservar ese contrato.

## Fuentes primarias consultadas

- Mux: https://www.mux.com/docs/guides/create-timeline-hover-previews
- Bitmovin: https://developer.bitmovin.com/playback/docs/thumbnail-preview-support

Ambas documentan imágenes/storyboards e índices temporales. No se infiere de ello una implementación interna específica de Netflix o YouTube.

## Implementación aplicada

- `internal/mediastream/storyboard`: mosaicos JPEG 4×3, celdas de 200×112, un fotograma cada 10 segundos; cada imagen cubre 120 segundos. Los encuadres se conservan con bandas, sin recortar.
- `GET /api/v1/video-storyboard?path=...` devuelve el índice JSON; `sheet=N&v=VERSION` devuelve la imagen correspondiente. La autorización comprueba que el archivo esté indexado y, para fuentes locales, siga dentro de las carpetas autorizadas. No acepta URLs arbitrarias.
- Caché persistente por identidad, tamaño, modificación y versión del generador; publicación desde un archivo temporal validado. Límite de 256 MiB y poda de archivos antiguos al generar. Caché HTTP privada para imágenes versionadas.
- Un único productor con un máximo de 45 segundos incluyendo espera; las solicitudes adicionales reciben 503 y reintentan de forma acotada. La generación usa el coordinador de recursos de fondo: cede ante la transcodificación y termina al cancelarse la petición. No hay una cola ilimitada ni procesos separados que sobrevivan al request.
- El frontend descarga el mosaico una vez para sus 12 posiciones, cancela el tramo obsoleto, retiene como máximo ocho imágenes y revoca sus blobs al cerrar. La precarga del tramo actual empieza cinco segundos después de `playing`, si el usuario no pidió antes otra miniatura. No bloquea el arranque.
- Estados de preparación y error con el tiempo siempre visible; se elimina la superficie gris sin información. Las imágenes se recortan en CSS usando el índice, sin segundo video ni canvas.

### Límites y validación

La preparación es incremental por tramos, no un precálculo de toda la biblioteca. Una imagen que aún no existe necesita leer y procesar ese tramo; bajo transcodificación activa puede diferirse. No se promete respuesta instantánea en caché fría. Las fuentes online ajenas a la biblioteca no tienen storyboard.

Pasaron 14 pruebas frontend, TypeScript, pruebas de autorización/versionado y caché/cancelación, race de los paquetes afectados, vet de los paquetes afectados, build Go y la suite completa `go test -p 1 ./... -short -count=1 -timeout=8m`. FFmpeg real se comprobó exclusivamente con videos sintéticos de 1, 25 y 125 segundos: mosaicos no vacíos, tramo siguiente y reutilización sin FFmpeg. Codegen dio resultados estables en dos ejecuciones aisladas; se usó staging porque Windows bloqueaba escrituras directas sobre archivos mapeados.

No se cambió la preparación de subtítulos ni se afirma una mejora medida del primer fotograma. Ese trabajo requiere correlacionar métricas del navegador con la solicitud del servidor y preservar selección y fuentes ASS. No se reinició ni desplegó la aplicación, y no se generaron imágenes de la biblioteca real. Queda pendiente la comprobación de reproducción y miniaturas en Tauri/Drive con los binarios actualizados.
