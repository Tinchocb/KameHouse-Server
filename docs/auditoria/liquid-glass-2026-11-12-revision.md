# Revisión de Liquid Glass — 2026-11-12

Revisión del código actual contra `docs/DESIGN-GUIDE.md`, pruebas existentes y reproducciones aisladas en Chrome con el CSS y el controlador reales. No se modificó la implementación ni se guardaron preferencias del usuario.

## Hallazgos

### Important — El contexto de vídeo heredado pierde su fondo neutro

En `apps/web/src/styles/themes/liquid-glass.css:81`, la regla para un panel descendiente de `[data-liquid-context="video"]` tiene menor especificidad que la regla general de panel de la línea 74. Por eso sigue usando el fondo de panel teñido por la era en lugar de `--liquid-glass-video-bg`.

Reproducción: colocar un panel dentro de un contenedor con contexto `video` y activar Liquid Glass. El estilo computado conserva el gradiente cromático con opacidades 92/84/90 %, aunque el SVG sí usa saturación 1. Al mover el atributo de contexto al propio panel, se aplica correctamente el fondo neutro al 88 %.

Impacto acotado: los paneles de reproducción inspeccionados declaran actualmente el contexto en el propio panel, por lo que este hallazgo no demuestra un fallo en ellos. Sí falla el contrato de contexto heredable, contemplado por el controlador y por esa regla CSS.

Corrección sugerida: igualar las condiciones de raíz de la regla descendiente con las de la regla general de panel, conservando su posición posterior. Verificar ambos lugares posibles del atributo.

### Polish — La geometría no se actualiza al cambiar solo el radio

En `apps/web/src/lib/theme/liquid-refraction.ts:210`, el radio se lee únicamente cuando la superficie está marcada para actualización. El controlador observa tamaño y atributos de rol/contexto, pero no cambios de radio mediante clase, estilo o media query que mantengan las dimensiones.

Reproducción: con una superficie de 300 × 100 px y radio 24 px, cambiar únicamente `border-radius` a cero. Chrome muestra radio CSS 0 px, pero el filtro conserva `stdDeviation="15.600000000000001"` en la máscara redondeada. El efecto del borde deja de coincidir con el contorno hasta otro evento que fuerce la medición.

No se confirmó una pantalla actual que cambie únicamente el radio. Es una limitación reproducible del controlador. Conviene definir un mecanismo de invalidación geométrica para las superficies que admitan ese cambio y comprobar radios responsive sin cambio de tamaño.

### Polish — Retirar la clase óptica no libera inmediatamente la lente

En `apps/web/src/lib/theme/liquid-refraction.ts:274`, el observador no incluye `class`, aunque `.floating-nav-island` es un criterio de registro. La validación de elegibilidad ocurre durante `flush`, pero retirar solo esa clase no programa uno.

Reproducción: registrar una superficie implícita `.floating-nav-island` y retirar la clase sin cambiar su tamaño. Permanece `data-liquid-ready="true"` y el estilo computado conserva `backdrop-filter: url("#kh-liquid-…")`. El acabado de fondo desaparece al dejar de coincidir el selector de material, mientras sigue activa la refracción. Otro evento de foco, tamaño o mutación pertinente puede liberar el filtro.

No se confirmó este cambio de clase en una interacción actual. Conviene actualizar el registro ante cambios de elegibilidad por clase sin observar indiscriminadamente cada cambio de estilo generado por la propia lente.

## Verificación y límites

- Aprobadas 32 pruebas en tres archivos: `liquid-refraction.test.ts`, `theme-hooks.test.tsx` y `themes-registry.test.ts`.
- La suite existente cubre presupuesto de ocho lentes, prioridad de foco, visibilidad, reutilización del grafo, portales, tamaño, cambios de rol/contexto y limpieza. Los hallazgos anteriores no están cubiertos por esas pruebas.
- Las tres reproducciones se ejecutaron en Chrome headless con `liquid-glass.css` actual y `liquid-refraction.ts` compilado con esbuild. Las comprobaciones incluyeron estilos computados y atributos SVG.
- El código conserva lentes exclusivas para navegación/paneles y exclusiones por Minimalista, modo plano, rendimiento, TV y colores forzados.
- La instancia local abrió en Minimalista y permaneció así incluso con respuestas de ajustes/status interceptadas para solicitar Por era. Por ello no se afirma haber verificado Liquid Glass en la biblioteca real ni en WebView2. No se midieron FPS ni contraste global ni se ejecutaron Firefox/Safari.

Prioridad recomendada: corregir primero la cascada del contexto de vídeo; después resolver la invalidación del registro y la geometría si las superficies van a cambiar de clase/radio dinámicamente.
