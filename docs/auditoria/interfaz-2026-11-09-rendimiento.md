# Interfaz: rendimiento de componentes compartidos — 2026-11-09

## Alcance

Optimización del trabajo compartido por Inicio, catálogos, fichas, navegación y Ajustes. Se conserva el diseño y el material Liquid Glass. No se modificaron backend ni datos de la biblioteca.

## Cambios

- `hooks/use-media-query.ts`: una suscripción nativa por consulta, compartida y estable entre renders. Navegación y preferencias de transparencia usan el mismo mecanismo; se elimina el listener al desmontar el último consumidor.
- `hooks/use-image-palette.ts`: deduplicación de solicitudes en curso. Varios consumidores de una URL comparten la imagen, su decodificación y la lectura de canvas; se conserva la caché de resultados y se permite reintentar errores. Desmontar un consumidor no cancela el resultado de los demás.
- `kinetics/scroll-reveal.ts`: preparación de transiciones por lote y una sola lectura de layout antes del revelado. Los paneles compartidos también usan el registro agrupado previo al pintado.
- `hooks/use-hero.ts`: resolución única del contenedor de página, escucha directa del scroll propietario, suspensión fuera del viewport y limpieza al activar movimiento reducido. Los carruseles internos no disparan mediciones del hero.
- `shared/dynamic-backdrop.tsx`: sin precargas ni timers de fundido para una imagen que queda oculta detrás del hero local o del modo plano.
- `hardware/performance-governor.ts`: suspensión de rAF sin foco o con la página oculta, reanudación por eventos y reinicio de la ventana de medición.
- `kinetics/scroll-edge-blur.tsx`: sin listener de scroll mientras el efecto está desactivado o el movimiento está reducido.

## Comprobaciones

La suite completa de frontend pasó: **198 archivos, 1478 pruebas**. Se añadieron comprobaciones de concurrencia, bajas de listeners, fallos/reintentos de imágenes, limpieza del parallax, suspensión del gobernador y agrupación de lecturas. El test de mutaciones de Liquid Glass usa entrega controlada de eventos para evitar la pérdida de registros reentrantes de happy-dom; la entrega nativa se comprueba por separado en Chrome.

Pruebas en Chrome con hooks y algoritmos reales, una escena de prueba y datos sintéticos:

| Escenario | Resultado |
| --- | --- |
| 40 consumidores del mismo breakpoint | 1 listener nativo; sin altas adicionales al resolver paletas |
| 12 consumidores simultáneos de una imagen | 1 decodificación; 1 extracción compartida |
| Scroll vertical y horizontal anidado | La lectura inicial de estilos del contenedor no se repite; el carrusel no mueve el hero |
| Activar movimiento reducido | Se limpia el transform del hero |
| Lote de 30 tarjetas, prueba unitaria | 1 lectura de `offsetWidth` para confirmar las transiciones |
| Rutas con hero local, prueba de componente | Sin precarga de la imagen global duplicada ni timer de fundido |

## Límites

Estas cifras miden operaciones y comportamiento, no una mejora porcentual de FPS. La prueba de Chrome no representa una biblioteca conectada ni mide la latencia de Drive o la reproducción real. No se afirma haber auditado exhaustivamente cada vista de la aplicación.

## Segunda pasada: búsqueda, fichas, diagnóstico y revelados

Validación final: **200 archivos y 1492 pruebas aprobadas**, compilación de producción y lint de los archivos afectados aprobados. Se conservaron los avisos existentes de Browserslist y del archivo de prueba de Drive que el generador de rutas omite; no bloquearon el build.

- Búsqueda: el estado `enabled` controla también las consultas semánticas, el estado de carga y las transformaciones de biblioteca/resultados. Cerrar cancela el debounce y conserva su texto actualizado; reabrir no dispara una consulta con un valor viejo. Se mantiene la caché de TanStack Query, sin cancelación global de peticiones. Las pruebas usan un QueryClient real y verifican dos consumidores compartiendo una petición.
- Fichas: se eliminó el efecto de parallax duplicado de `MediaHero`. El hook compartido acepta `scrollContainerRef` opcional y prioriza ese contenedor sobre la detección automática. Se mantiene la velocidad de `0.35` y se suspende cuando no se muestra arte o el movimiento está desactivado.
- Diagnóstico: el panel cancela sus frames al perder foco u ocultarse y reinicia la ventana de muestreo al volver. El cierre elimina los listeners de actividad; callbacks antiguos no pueden reactivar ni alterar un ciclo nuevo tras reabrir.
- Revelados: cada animación conserva una limpieza asociada a su registro. Se cancelan timer y listeners en `transitionend`, `transitioncancel`, desmontaje y reutilización. Las bajas antiguas no alteran el registro nuevo ni borran transiciones instaladas por otro propietario.

Comprobación adicional en Chrome con `MediaHero`, `PerformanceMonitor` y el motor de revelados reales, contexto de ajustes/ruta sintético y arte generado en canvas: 120 px de scroll produjeron 42 px de parallax; el contenedor automático y el carrusel no alteraron el desplazamiento del contenedor explícito. Activar movimiento reducido limpió el transform. Los pedidos de frames del diagnóstico se mantuvieron constantes durante la pérdida simulada de foco y después de cerrar; retomaron su avance al recuperar foco. El timer de respaldo del revelado pasó de uno a cero al recibir el final de la transición. No hubo errores JavaScript en la escena.

El foco se simuló mediante `document.hasFocus` y los eventos correspondientes en esa escena; la visibilidad oculta también tiene pruebas de componente. Esto verifica el ciclo de actividad, no constituye una medición de FPS de la biblioteca conectada.
