---
name: design-review
description: Crítica de diseño y calidad técnica de interfaz (jerarquía, tokens, tipografía, espaciado, motion, contraste, a11y) clasificada por severidad (Blocking, Important, Polish).
---

# Design Review (KameHouse Rubric)

Crítica técnica y estética de alto nivel orientada al stack y estilo de KameHouse (Cinematic Dark-first + MD3 Glass).

Sin telemetría externa ni dependencias de servicios externos.

## Dimensiones de Evaluación

1. **Jerarquía y Layout**:
   - Shell adecuado: Cinematográfico (`relative min-h-screen`, `page-container`, sin fondos opacos) vs Estructurado (sidebar con blur).
   - Uso de `SectionBar` / `sectionbar-minimal` para agrupar contenido.
2. **Tokens y Color**:
   - Coherencia con `brand-accent`, `on-surface`, `on-surface-variant`, `surface-container*`.
   - Cero hex hardcodeados (salvo variables `--era-*-hex`).
3. **Tipografía**:
   - Escala `type-*`; títulos de sección en sans y sentence case. `font-display` según el componente canónico.
   - `font-mono` (Space Mono) solo para contadores y etiquetas técnicas cortas.
   - Escala fluida y `clamp`.
4. **Espaciado y Radios**:
   - Escala: `rounded-full` (pills/inputs), `rounded-xl` (filas), `rounded-2xl` (cards/SectionBar), `rounded-hero` (hero).
   - Espaciado según la superficie canónica: Home usa sagas panorámicas con `gap-4` y películas en acordeón/riel (§5.8); no forzar todas las vistas a la misma rejilla.
5. **Glass y Profundidad**:
   - Sombra `sectionbar-shadow` o `shadow-elevation-1..5`.
   - Solo una capa de blur por superficie: 24 px (`overlay-md`) en paneles; 64 px (`overlay-2xl`) solo para hero/overlays cinematográficos. Sin blur por badge repetido.
   - Borde rim resuelto por `.sectionbar` / tokens `--sectionbar-*`, sin copiar valores manuales.
6. **Motion**:
   - Springs canónicos: `380/30` en entrada, `480/34` con `layoutId` en selectores/tabs.
   - Micro-interacciones: `active:scale-95`, `whileHover={{scale:1.012}}`.
   - Respeto a `prefers-reduced-motion`.
7. **Accesibilidad y Touch**:
   - Touch target $\ge$ 44px.
   - `aria-label` en botones icono y contraste adecuado en textos atenuados.

## Clasificación de Severidad

- 🔴 **Blocking**: Ruptura visual grave, falla severa de a11y (control inalcanzable por teclado/touch), fondo opaco que destruye el `DynamicBackdrop`.
- 🟠 **Important**: Incumplimiento de tokens canónicos (ej. `shadow-lg` genérico, radio arbitrario, selector sin `layoutId`, fuentes no semánticas).
- 🟡 **Polish**: Refinamiento estético (alineación fina, `text-balance`, micro-interacciones hover/active, optimización de contraste).
