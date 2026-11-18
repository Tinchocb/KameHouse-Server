# Backend: espera de reproducción y arranque aislado — 2026-11-06

Segunda tanda, posterior a `backend-2026-11-06-rendimiento.md`. Trabajo sobre el estado local existente, preservando cambios previos y trabajo frontend concurrente. No hubo deploy, reinicio de instancia real, commit ni push.

## Cambio que elimina una espera perceptible

En el fallback de keyframes mediante ffprobe, `cassette/keyframe.go` acumulaba 100 timestamps antes de habilitar la sesión HLS. Un MP4 de 90 segundos con un keyframe cada dos segundos tiene 45: debía terminar el recorrido completo del archivo antes de iniciar la reproducción. Una fuente lenta con más de 100 keyframes también debía leer una parte extensa antes de entregar la primera lista.

Ahora publica los primeros tres timestamps, suficientes para dos intervalos completos y para el margen que usa el pipeline. Continúa analizando y publicando lotes en segundo plano; después de arrancar, cuando hay nuevos keyframes disponibles publica también al superar 250 ms desde el último lote. Conserva los lotes de 100/500 cuando la fuente llega rápidamente. No cambia codecs, calidad, timestamps, segmentación, formato del índice persistente ni el límite del proceso.

La mejora aplica al HLS dinámico cuando se usa el análisis de paquetes de ffprobe. Los MKV/WebM con Cues utilizables ya tienen otra ruta rápida; el directo y el HLS pretranscodificado no pasan por esta espera.

El escaneo completo sigue leyendo la fuente en segundo plano: se reduce la espera para comenzar, no el total de bytes de ese análisis. Sigue compartido entre clientes y conserva sus límites anteriores.

## Reproducción aislada con herramientas reales

`TestPlaybackStartOverThrottledHTTP` genera con FFmpeg un MP4 H.264/AAC de 90 s, 320×180, 24 fps, GOP de dos segundos y 7.866.450 bytes. Un servidor HTTP privado soporta rangos y retrasa 15 ms cada bloque de hasta 32 KiB (aproximadamente 2 MiB/s por conexión). No usa Google, archivos del usuario ni credenciales.

La medición comienza antes del probe de información. Recorre ffprobe real, creación de sesión, playlist HLS, primer segmento real y decodificación de un fotograma de ese segmento con FFmpeg. No incluye el build ni la generación de la fixture.

Tres corridas anteriores, antes de cambiar producción:

| Corrida | HLS listo | Primer segmento | Primer fotograma decodificable |
| --- | ---: | ---: | ---: |
| 1 | 3,952 s | 4,111 s | 4,157 s |
| 2 | 3,857 s | 4,013 s | 4,061 s |
| 3 | 3,863 s | 4,029 s | 4,083 s |

Últimas tres corridas con el cambio y comprobaciones ampliadas:

| Corrida | Probe | HLS listo | Primer segmento | Fotograma decodificable | Audio decodificado |
| --- | ---: | ---: | ---: | ---: | ---: |
| 1 | 134 ms | 376 ms | 542 ms | 584 ms | 769 ms |
| 2 | 69 ms | 312 ms | 461 ms | 508 ms | 700 ms |
| 3 | 72 ms | 315 ms | 467 ms | 512 ms | 704 ms |

Medianas de fotograma decodificable: **4,083 s → 0,512 s**, aproximadamente **8×** más rápido (−87%). Hubo además dos tandas intermedias de tres corridas, todas aprobadas, con el mismo orden de magnitud. No se compara audio anterior porque esa métrica no estaba en la primera versión de la prueba.

Regresiones verificadas en la prueba ampliada:

- HLS entrega `segment-0.ts` antes de completar el índice, sin `ENDLIST` prematuro.
- Se decodifican vídeo y audio de los segmentos 0 y 1, cruzando el límite de la primera cabeza de FFmpeg mientras el índice crece.
- El índice termina con los 45 keyframes esperados y la playlist termina con `ENDLIST`.
- Se busca el segmento 30 (alrededor del segundo 60) y se decodifican vídeo y audio.
- Reutilizar el primer segmento caliente tarda menos de 1 ms en estas corridas.
- El índice persistido coincide con el índice completo. Vaciar su caché en memoria y leerlo de disco tarda menos de 1 ms y no hace solicitudes HTTP a la fuente.

Los tiempos impresos como `0s` corresponden a operaciones menores que la resolución observada del reloj; no se interpretan como latencia física cero.

## Arranque de procesos y HTTP reales, con datos privados de prueba

`scripts/measure-backend-startup.mjs` compila un ejecutable aislado y crea tres directorios temporales de datos. Arranca cada uno una vez nuevo y otra con sus datos persistidos. Usa loopback y puertos libres, no descubre ni termina servidores existentes. Elimina las variables KAMEHOUSE/TMDB del entorno del hijo, coloca un `.env` vacío para detener la búsqueda ascendente y no muestra sus logs/configuración. Termina únicamente sus procesos propios y elimina sus temporales.

Se desactivan features opcionales para acotar la prueba. La biblioteca está vacía; no representa arranque con todos los servicios externos configurados o una biblioteca real grande. Los tiempos TCP no incluyen el chequeo de salud posterior.

| Muestra | Datos nuevos: escuchar TCP | Datos persistidos: escuchar TCP |
| --- | ---: | ---: |
| 1 | 2.808 ms | 117 ms |
| 2 | 163 ms | 133 ms |
| 3 | 144 ms | 143 ms |

La primera muestra es atípica y se conserva. No se determinó si su causa fue antivirus, carga inicial del ejecutable, filesystem u otra actividad; no se atribuye al DDL ni se declara solucionada. Las demás escucharon en 117–163 ms. El chequeo HTTP `/api/health` posterior tardó 103–173 ms. En esa biblioteca vacía, la primera colección HTTP tardó 4,59–9,99 ms y la segunda 1,27–3,17 ms.

Estas son mediciones del estado actual; no hubo un cambio de arranque en esta segunda tanda ni una comparación antes/después de startup.

## Biblioteca con tamaño representativo, aislada

`TestLibraryCollectionFixtureLatency` ejecuta el handler real y serializa su respuesta con SQLite privado: 50 series, 1.200 archivos y cinco series en curso. Verifica los totales y los cinco episodios de continuar viendo. No simula una biblioteca real del usuario ni un servicio externo real.

Tres corridas con proveedor de metadata que falla inmediatamente: primera colección **25,8–28,4 ms**. Con el mismo proveedor controlado demorando 300 ms antes de fallar: **312,0–312,9 ms**. La caché de colección y la respuesta condicional con ETag quedaron por debajo de 1 ms en el handler (sin transporte TCP). El cuerpo fue de unos 50 KB.

Esto identifica una espera restante cuando el proveedor de metadata tarda: los 300 ms dominan la colección fría. No se eliminó esa espera cambiando la semántica del enriquecimiento ni se infiere el tiempo de Jikan/TMDB real a partir del proveedor controlado.

## Verificación y reproducción

```powershell
Set-Location E:/Proyectos_personales/KameHouse/apps/server
& 'C:/Program Files/Go/bin/go.exe' test ./internal/mediastream/cassette -run '^TestPlaybackStartOverThrottledHTTP$' -v -count=3
& 'C:/Program Files/Go/bin/go.exe' test ./internal/handlers -run '^TestLibraryCollectionFixtureLatency$' -v -count=3
& 'C:/Program Files/Go/bin/go.exe' test ./internal/mediastream/cassette -count=1
& 'C:/Program Files/Go/bin/go.exe' test -short . ./internal/... ./codegen/...
& 'C:/Program Files/Go/bin/go.exe' vet ./...
& 'C:/Program Files/Go/bin/go.exe' build -buildvcs=false ./...
```

Todas esas verificaciones aprobaron; la prueba real de reproducción se ejecutó también fuera de la suite corta. La suite corta omite explícitamente esa integración con FFmpeg/HTTP limitado. `-race` continúa pendiente por falta de compilador C/CGO en este entorno, tal como documenta la primera tanda.

Para el script de procesos, desde la raíz: configurar `GO_BIN` con el ejecutable de Go y ejecutar `node scripts/measure-backend-startup.mjs`.

## Medición real todavía pendiente

No se localizó un proceso KameHouse activo ni logs de ejecución en las ubicaciones habituales de datos durante esta revisión. No se observaron una reproducción del usuario ni la presentación de un fotograma en navegador/Tauri. El fotograma decodificado de la fixture no acredita esos resultados.

Acción mínima para obtener una línea base real: abrir la instalación habitual, reproducir un episodio de Drive e indicar cuál y la hora aproximada del inicio. A partir de sus logs y estado se podrán correlacionar las etapas disponibles sin reiniciar ni interrumpir la reproducción. Validar este código nuevo en esa instalación requiere ejecutarlo allí en un paso posterior autorizado; aquí no se desplegó ni reemplazó el binario instalado.
