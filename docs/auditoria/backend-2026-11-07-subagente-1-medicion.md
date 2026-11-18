# Frente 1: medición hasta primer fotograma — 2026-11-07

Revisión de solo lectura del estado/logs existentes y ejecución focalizada de una integración aislada. No se modificó código productivo, no se inició/reinició la instancia del usuario, no se autorizó Google ni se desplegó. Se preservó el árbol local compartido.

## Evidencia de la instalación existente

La lectura de procesos no encontró `kamehouse`, `kamehouse-desktop` ni `isolated-server` activos en ese momento. Esto no descarta una instancia remota o con otra identificación.

Se encontraron dos registros en el perfil de desarrollo `kamehouse-dev`, ambos del 6 de noviembre. Se analizaron internamente y solo se extrajeron conteos/campos numéricos para evitar mostrar URLs OAuth, credenciales, nombres de usuario o rutas de vídeos.

| Registro | Última modificación local | Bytes | Datos relevantes |
| --- | --- | ---: | --- |
| `KameHouse-2026-11-06_21-34-33.log` | 2026-11-06 23:06:17 | 8.952 | Un arranque, una mención Drive y un rechazo de state OAuth |
| `desktop.log` | 2026-11-06 23:01:43 | 3.365 | Sin las métricas de reproducción buscadas |

No aparecieron eventos `Media info extracted`, `segment wait timed out` ni `Slow request detected` en esos archivos. Esta ausencia no demuestra que nunca hubo reproducción o que las peticiones fueron rápidas: no aporta una sesión correlacionable de reproducción real. Los endpoints de streaming se excluyen además del aviso genérico de peticiones lentas por diseño.

El rechazo OAuth es evidencia histórica, no un diagnóstico del estado actual de la cuenta ni una prueba de que ese sea hoy el bloqueo. No se leyeron ni alteraron credenciales.

## Medición actual aislada

Se ejecutó el test existente `TestPlaybackStartOverThrottledHTTP` tres veces, sin editarlo. Usa FFmpeg/ffprobe reales, un MP4 sintético de 90 s, H.264/AAC, 320×180 y 7.866.450 bytes. La fuente es HTTP privado con rangos y 15 ms de demora por bloque de hasta 32 KiB, por conexión. No es Google Drive ni un modelo de ancho de banda agregado/quotas de Drive.

El reloj comienza antes del probe real. Las fases son acumuladas desde ese punto; no incluyen build ni generación del vídeo.

| Corrida | Probe | HLS listo | Primer segmento | Fotograma decodificable | Audio decodificado |
| --- | ---: | ---: | ---: | ---: | ---: |
| 1 | 192,683 ms | 454,175 ms | 609,279 ms | 666,069 ms | 870,418 ms |
| 2 | 71,914 ms | 323,716 ms | 478,820 ms | 533,357 ms | 740,790 ms |
| 3 | 81,138 ms | 333,319 ms | 495,271 ms | 544,527 ms | 740,605 ms |

Mediana observada: **333 ms hasta HLS listo**, **545 ms hasta un fotograma decodificable**, **741 ms hasta la comprobación de audio decodificado**. El audio se solicita después de la comprobación de vídeo en este test; no representa solicitudes simultáneas del navegador.

Los tres casos aprobaron además:

- HLS disponible antes de terminar el escaneo (`complete_at_ready=false`).
- Continuidad y decodificación de vídeo/audio de los segmentos 0 y 1.
- Búsqueda al segmento 30, cerca del segundo 60, con salidas decodificables.
- Índice final completo de 45 keyframes y `ENDLIST` al finalizar.
- Segmento reutilizado en caliente registrado como `0s`, por debajo de la resolución observada; no se interpreta como latencia física cero.
- Lectura del índice desde disco: 0–516 µs registrados, sin nuevas peticiones HTTP a la fuente y con el índice completo idéntico.

El probe se ejecuta en frío en cada corrida. Las métricas calientes son reutilización de sesión/segmento e índice de disco, no una segunda apertura completa de la aplicación con toda su caché caliente.

La prueba usa la calidad `Source`, con copia de vídeo H.264; no caracteriza una recodificación pesada 1080p/4K en CPU/GPU. Otros subagentes podían ejecutar comprobaciones concurrentemente: estos números son una observación actual, no una nueva estimación causal antes/después. No se recalculan las mejoras históricas documentadas en la tanda anterior.

## Brecha hasta el primer fotograma presentado

Un fotograma decodificado por FFmpeg acredita que el primer segmento contiene vídeo legible. No acredita que el navegador/Tauri ya lo haya presentado ni mide clic, petición del contenedor, autorización Drive, buffering HLS o composición de la interfaz.

La búsqueda focalizada del código encontró eventos `playing` usados para UI/precarga y `requestVideoFrameCallback` en el renderer PGS. No encontró un registro correlacionado de `firstFrame`/`startupMs` que una todo el recorrido. La telemetría del servidor revisada en `continuity/telemetry.go` almacena progreso de reproducción; no es una medición del primer fotograma.

Para cerrar esa brecha, la medición futura debería correlacionar un identificador de intento desde el clic hasta el primer `requestVideoFrameCallback` presentado, con fases separadas de API, probe/caché, obtención del primer segmento y buffering. No se añadió esa instrumentación en este frente para preservar su alcance de solo lectura.

Acción mínima del usuario para una línea base real: **abrir la instalación habitual, reproducir un episodio de Drive ya autorizado e indicar el episodio y la hora aproximada de inicio**. Si Drive todavía no conecta, primero hace falta completar esa autorización. Después se podrán observar logs/estado sin detener la reproducción; para medir el código local nuevo en esa instalación se requiere ejecutarlo allí en un paso posterior autorizado, sin atribuirle el resultado de un binario anterior.

## Comando y resultado

Desde `apps/server`:

```powershell
& 'C:/Program Files/Go/bin/go.exe' test ./internal/mediastream/cassette -run '^TestPlaybackStartOverThrottledHTTP$' -v -count=3
```

Resultado: **PASS**, tres corridas, paquete completado en 16,547 s. No se ejecutó la suite completa en paralelo desde este frente.
