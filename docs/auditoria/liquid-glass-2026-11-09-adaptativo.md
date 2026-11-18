# Liquid Glass adaptativo — 2026-11-09

## Resultado

Cuatro variantes del mismo material: navegación, panel, contenido y control. Las dos primeras admiten refracción del fondo real; las dos últimas conservan reflejos y relieve sin crear filtros por tarjeta, fila o botón. No se añadieron dependencias ni preferencias y se conservó el interruptor existente.

Cobertura: navegación y eras, búsquedas y menús compartidos, modales, personajes, reproducción aleatoria, cola, Ajustes —incluidos navegación lateral y guardado—, tarjetas de películas/series/sagas, bloques de contenido, cronología, avisos y paneles/cápsulas del reproductor. Los marcos de póster conservan su radio y encuadre; el material no pinta encima de las imágenes. Los colores de estado se conservan, con texto de error aclarado para mejorar contraste.

## Contrato y rendimiento

| Rol | Lente | Perfil |
| --- | --- | --- |
| `navigation` | Sí, si es visible y hay presupuesto | Escala SVG máxima 36, blur 1 px |
| `panel` | Sí, si es visible y hay presupuesto | Escala SVG máxima 24, blur 2 px |
| `content` | No | Fondo, reflejo y relieve estáticos; sin blur propio |
| `control` | No | Acabado ligero; sin blur propio |

El controlador limita a ocho lentes visibles, prioriza foco → paneles → navegación, retira los filtros fuera del viewport y reutiliza sus nodos al volver. Los cambios de contexto y tamaño actualizan parámetros del SVG. No hay seguimiento del puntero ni un bucle de animación del material. Los paneles sobre vídeo conservan la base oscura del reproductor y saturación 1.

## Validación

- Suite completa: **201 archivos y 1499 pruebas aprobadas**. Lint de los archivos afectados y compilación de producción aprobados.
- Pruebas del controlador: presupuesto, prioridades de foco, suspensión/reanudación, exclusión de controles/contenido, redimensionamiento sin reconstrucción, cambios de contexto de vídeo, cambio de rol a control y limpieza de portales.
- Chrome: ocho escenarios combinando Neutro y Por era (`era-db`), escritorio de 1280 px y móvil de 390 px, DPR 1 y 2. Se usaron componentes reales —Button, SectionBar, MoviePosterCard, Modal, Popover, SettingsLayout, Toaster y LiquidGlassDefs— con ajustes sintéticos y vídeo generado mediante canvas/captureStream.
- Texto normal sobre blanco, negro y vídeo: contraste mínimo medido **5,13:1**, por encima del objetivo de 4,5:1 en las posiciones comprobadas.
- Avisos individuales sobre blanco, en ambos temas: éxito, error, advertencia e información superan 4,5:1. El mínimo final fue **5,06:1**, en el aviso de error de Por era.
- Comparación de píxeles con anillos, desplazamiento activado frente a escala cero: diferencia media del borde de aproximadamente 5–6,27 niveles RGB; diferencia del centro inferior a 0,001 niveles. El borde curva el fondo y el centro conserva su alineación.
- Portales, clics, Escape, límite de ocho lentes y prioridad del foco comprobados. El material estático permanece con movimiento reducido; contraste alto, colores forzados, ahorro y desactivación del interruptor liberan las lentes. Sin errores JavaScript en las escenas.

## Cierre de pendientes — 2026-11-10

- Las superficies ópticas anidadas comparten el efecto del contenedor: sin lente ni blur adicional, conservando fondo y relieve. Al trasladarlas fuera recuperan su efecto; los portales siguen siendo independientes. La regla CSS y el registro usan la misma distinción entre roles explícitos y navegación implícita.
- Entrar o salir del foco recalcula la prioridad en el mismo frame agrupado. Se retira también el listener de salida y se cancela el frame pendiente al desmontar.
- La guía distingue la escala SVG máxima (36 para navegación, 24 para paneles) del desplazamiento absoluto.
- Validación: 13 pruebas específicas aprobadas; suite completa de 204 archivos y 1513 pruebas aprobadas. TypeScript, lint global del frontend y compilación de producción aprobados. Chrome con CSS de producción: ocho combinaciones de Neutro/Por era, 1280/390 px y DPR 1/2. Se comprobaron estilos computados, traslado dentro/fuera de un panel, cambios de rol, navegación implícita, fallback sin controlador, portales, nueve superficies compitiendo por ocho lentes, pérdida de foco hacia `body`, cambios rápidos y desmontaje con frame pendiente. En los ocho casos quedaron cero frames, filtros y marcas activas tras desmontar; sin errores JavaScript. Esta pasada usó superficies sintéticas con el controlador y material reales, sin medición de FPS.

## Límites de las mediciones

La escena de Chrome es aislada y usa datos sintéticos. Las cifras de contraste corresponden a sus fondos y posiciones muestreadas, no a cada combinación posible de biblioteca, imagen o paleta. No se midieron FPS en la biblioteca conectada ni se evaluaron Safari/Firefox ejecutándose; esos motores conservan el fallback según la selección actual de compatibilidad. Las reglas existentes de superficies sólidas y accesibilidad siguen vigentes.

Se preservaron cambios locales concurrentes. La revisión de la suite también detectó fixtures de `matchMedia` incompatibles con suscripciones reactivas; se comprobaron nuevamente tras su corrección sin alterar las preferencias reales del usuario.
