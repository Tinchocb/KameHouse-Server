# Reparación de barra, saltos y arranque

## Defectos confirmados

- En la observación de la ventana del 31 de octubre, el botón de intro mostraba más de 1200 segundos. El frontend aceptaba cualquier duración de OP desde capítulos, servicios o caché. La barra dibujaba esas mismas marcas sin comprobar límites.
- Los inicios recientes de escritorio registran servidor listo aproximadamente dos segundos después del lanzamiento y revelación de ventana por el respaldo de 30 segundos, sin aviso de React. El paquete web declaraba únicamente CSS como archivos con efectos al cargarse. La importación lateral de `desktop-bridge.ts` quedaba eliminada: el bundle anterior `index.46fdf845.js` no contenía `startup_renderer_ready`.
- La precarga de miniaturas introducida anteriormente iniciaba extracción de video cinco segundos después de `playing`, aunque el usuario no hubiera pasado el mouse por la barra.

## Correcciones

- Se rechazan marcas de intro no finitas, negativas, invertidas o de más de cinco minutos antes de resolverlas, propagarlas o saltar capítulos. Al reproducir se exige además que el final esté dentro de la duración. El salto combinado intro/resumen aplica la misma validación.
- La barra descarta marcadores inválidos o fuera del archivo y recorta sus elementos al interior del track.
- La precarga solicita únicamente el índice JSON; la extracción espera al hover real.
- `package.json` conserva explícitamente `./src/lib/desktop-bridge.ts`. El bundle de producción nuevo contiene `startup_renderer_ready`.

## Validación

- 91 pruebas de ventanas de salto, hook del reproductor, navegación por capítulos, barra y miniaturas aprobadas.
- TypeScript sin errores y diff check de los archivos afectados limpio.
- Compilación de producción web aprobada y comprobación del puente dentro del bundle resultante.
- Compilación Go 1.26.6 aprobada con el frontend actualizado incluido. Se actualizó `apps/server/kamehouse.exe` sin proceso activo y se comprobó que su SHA-256 coincidiera con el ejecutable preparado.
- Fixture visual que importa el `SeekBar` real y usa el CSS de producción: marcas válidas dentro de la barra y marca corrupta descartada. No representa una reproducción de Drive.

## Logs y límites

Los logs del 1 de noviembre muestran FFprobe de aproximadamente dos segundos y errores de miniaturas de 112–606 ms. También registran una preparación de subtítulos de unos cinco segundos para una ventana desplazada. Estos datos no miden el primer fotograma actual ni permiten atribuir todos los tiempos de carga a una sola causa. Los logs recientes del 3 de noviembre no incluyen una nueva apertura de episodio con la que comparar.

Respaldo local de ejecutable y web anteriores: `tmp/player-repair-2026-11-04`. No se modificó la base de datos de la biblioteca ni se reindexó Drive. La verificación del nuevo aviso en un inicio real de Tauri y la reproducción real de Drive siguen siendo comprobaciones pendientes.
