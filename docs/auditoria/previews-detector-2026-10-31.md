# Miniaturas y detector: reducción de espera y actividad de disco

Esta revisión sustituye la generación de mosaicos bajo demanda descrita el 30 de octubre para el hover del reproductor.

## Cambios

- El hover solicita un JPEG de 200×112 cada 10 segundos, mediante `sheet` y `frame`. FFmpeg busca primero la posición y extrae un solo fotograma, en lugar de decodificar un mosaico de 120 segundos. Reutiliza mosaicos existentes y guarda los nuevos fotogramas en la caché persistente de 256 MiB.
- Solo se admite una extracción de miniatura simultánea, con un hilo y un plazo de 12 segundos. Puede ejecutarse durante reproducción; interrumpe el trabajo pesado de fondo y espera su limpieza, sin esperar a que termine la reproducción.
- Las lecturas de Drive para miniaturas reutilizan los bloques de caché, pero no descargan bloques anticipados. Los bloques efectivamente solicitados siguen almacenándose completos; esto no elimina toda escritura de Drive.
- Los métodos de detección de intros/outros usan un trabajador cada uno y un permiso global compartido para el análisis de audio. Los avisos de inicio y progreso de reproducción suspenden los análisis; estos retoman cuando cesa la demanda. No se guardan huellas parciales de trabajos cancelados o de FFmpeg fallido.
- El cliente conserva hasta 48 fotogramas, cancela peticiones obsoletas y reintenta ocupación transitoria cada 750 ms. Las películas con episodio cero también envían progreso.

## Evidencia local

- 14 pruebas frontend y TypeScript sin errores.
- Suite completa `go test -p 1 ./... -short -count=1 -timeout=8m`, `go vet -p 1 ./...` y `go build -p 1 ./...` aprobados con Go 1.26.6. Diff check de los archivos modificados para esta tarea limpio; el diff global conserva espacios finales ajenos en `detail-hero.tsx` y `media-hero.tsx`.
- Pruebas focalizadas de storyboard, detector, coordinador y handlers; pruebas de concurrencia con `-race`.
- Prueba de bloques Drive con `-race`: una lectura dentro de un bloque descarga uno, cruzar al siguiente descarga solo el segundo, repetir reutiliza caché.
- FFmpeg real con videos sintéticos de 1, 25 y 125 segundos: fotogramas válidos durante un permiso de reproducción activo y reutilización sin FFmpeg. Extracciones locales de aproximadamente 65–311 ms; no equivalen a tiempos de Drive real.

No se cambian las ventanas de detección ni los umbrales de coincidencia. No se limpia la biblioteca ni la caché de Drive. La validación sintética no acredita reproducción real en Tauri/Drive. El proceso que ya estaba abierto necesita cargar un servidor recompilado para aplicar los cambios del backend.
