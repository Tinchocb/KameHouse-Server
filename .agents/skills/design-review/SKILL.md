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
   - `font-display` (Outfit) para encabezados con `text-balance`.
   - `font-mono` (Space Mono) para badges, contadores y labels técnicos.
   - Escala fluida y `clamp`.
4. **Espaciado y Radios**:
   - Escala estricta: `rounded-full` (pills/inputs), `rounded-xl` (filas), `rounded-2xl` (cards/SectionBar), `rounded-3xl` (heros).
   - Espaciado consistente: grids con `gap-3.5`, padding responsivo `px-4 sm:px-6 md:px-8 lg:px-10`.
5. **Glass y Profundidad**:
   - Sombra `sectionbar-shadow` o `shadow-elevation-1..5`.
   - Solo 1 capa de blur por superficie (`backdrop-blur-overlay-2xl` / `md`).
   - Borde rim: `border-white/15 border-t-white/35 border-b-white/10`.
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
