# Cristal Apple líquido — 2026-11-13

Implementación del material aprobado en el mockup «opción 1, más líquido», mediante la preferencia existente `themeEnableLiquidGlass`. Se conserva la distribución actual de KameHouse: esta entrega adapta el material de navegación, paneles y controles, sin trasladar la navegación de escritorio al dock del mockup.

## Resultado

- Bisel más transparente, reflejos blancos direccionales y relieve interior más visible en superficies flotantes. El tinte de era del núcleo baja del 8 % al 3 %; acciones e indicadores del contenido conservan sus colores de era.
- Fondo oscuro localizado en la zona de lectura; los bordes dejan ver más fondo para hacer visible la refracción. Contenido y controles siguen sin asignar lentes ni blur adicionales.
- Selección de navegación translúcida con texto claro y sin una segunda lente.
- Navegación/paneles fuera de vídeo: escala SVG máxima 36, blur 3 px y saturación 1,25. Las lentes siguen limitadas a ocho y reutilizan el grafo existente.
- Reproductor: mantiene fondo neutro al 88 %, saturación 1 y perfil óptico anterior. Se corrigió la especificidad CSS del contexto de vídeo heredado desde un contenedor padre, señalado en la revisión anterior.
- Se conserva el interruptor «Refracción Liquid Glass», con descripción actualizada. Apagarlo recupera frosted; desactivar los efectos de vidrio activa superficies sólidas. Minimalista mantiene su acabado sólido y conserva la preferencia de Por era.

## Comprobaciones

- 35 pruebas aprobadas: `liquid-refraction.test.ts`, `theme-hooks.test.tsx`, `themes-registry.test.ts` y `flat-reason.test.ts`. La prueba del perfil óptico comprueba el nuevo material y la preservación de escala/blur/saturación del vídeo.
- ESLint de los archivos TS/TSX afectados y TypeScript (`tsc --noEmit`) aprobados.
- Compilación de producción aprobada. La comprobación final usó una salida independiente en `tmp/liquid-glass-build` para no depender del directorio `out` compartido con otras tareas.
- Chrome con la aplicación compilada y respuestas API sintéticas: interruptor de refracción on/off, retirada y recreación de lentes, ida y vuelta entre Minimalista y Por era, escritorio 1440 × 1000 y móvil 390 × 844 sin desbordamiento horizontal, colores forzados y movimiento reducido. Se revisaron capturas de Ajustes y del estado vacío de Inicio; no hubo excepciones JavaScript. Las escrituras API se bloquearon y las preferencias reales no se guardaron.
- Escena aislada con CSS de producción y controlador real: contexto de vídeo heredado usa el fondo neutro, controles sin blur, limpieza completa al desactivar y fallback sólido en modo plano/colores forzados.
- Muestras de lectura sobre fondo blanco, DPR 1, con colores y fondo renderizados: navegación secundaria `rgb(184,184,184)` sobre `rgb(70,68,67)`, **4,88:1**; panel secundario `rgb(204,204,204)` sobre `rgb(78,77,77)` cerca del margen superior izquierdo, **5,25:1**; muestras central superior e interior del panel, **6,44:1** y **7,74:1**. Son muestras acotadas; no una certificación de cada posición o paleta.

## Límites

No se verificaron una biblioteca conectada, reproducción real, FPS, Safari/Firefox ni la aplicación nativa WebView2. Las respuestas sintéticas no implementan un backend WebSocket y no sirven para validar conectividad. Esta entrega no modifica el registro de cambios dinámicos de clase/radio: esos dos casos límite de la revisión anterior quedan fuera del cambio de material.

Se preservaron los cambios locales existentes. No se creó un commit ni se modificaron preferencias personales.
