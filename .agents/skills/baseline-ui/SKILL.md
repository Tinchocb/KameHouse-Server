---
name: baseline-ui
description: Limpieza rápida de interfaces eliminando inconsistencias en espaciado, jerarquía, tipografía y layout sin romper los tokens y estética de KameHouse.
---

# Baseline UI (KameHouse Edition)

Establece una línea base para evitar inconsistencias y "slop" visual en componentes y vistas de KameHouse, respetando estrictamente el sistema de diseño canónico (`docs/DESIGN-GUIDE.md`).

## Stack de KameHouse

- React 19 + TanStack Router + Tailwind 3.4 + Framer Motion 12 + Radix UI + Zustand.
- Utilidad de clases: `cn` (`clsx` + `tailwind-merge`) desde `@/components/ui/core/styling`.
- No introducir dependencias CSS externas adicionales si Tailwind y los tokens ya cubren el caso de uso.

## Componentes y Primitivas

- USAR primitivas accesibles existentes (`Radix UI`, `@/components/ui/*`).
- NUNCA reconstruir comportamiento de teclado o accesibilidad a mano si ya existe un componente base.
- SIEMPRE añadir `aria-label` descriptivo a botones que contengan únicamente iconos.
- USAR `AlertDialog` o confirmación modal para acciones destructivas o irreversibles.
- Diálogos y modales deben montarse con `Dialog` accesible de Radix y respetar el shell semántico.

## Contenedores y Tokens (Reglas KameHouse)

- **SectionBar**: El contenedor canónico de paneles y secciones es `.sectionbar` o `SectionBar` (`components/ui/sectionbar.tsx`).
- **Fondos**: NUNCA usar fondos opacos (`bg-black`, `bg-zinc-900`) en contenedores principales de vista cinematográfica; el fondo base reside en `html` (`bg-[var(--bg-primary)]`) y permite ver el `DynamicBackdrop` (`-z-10`).
- **Sombras**: NUNCA usar `shadow-lg` genérico ni sombras inline arbitrarias. Usar exclusivamente `shadow-elevation-1..5` o `--sectionbar-shadow`.
- **Bordes Glass**: Usar tokens de borde `border-white/15 border-t-white/35 border-b-white/10` o variables `--sectionbar-border*`.
- **Blur**: Máximo una capa de blur por panel con `backdrop-blur-overlay-md` o `2xl`. Sub-filas internas usan `bg-white/[0.04]` sin blur adicional.

## Tipografía y Espaciado

- **Títulos**: `font-display` (Outfit) y aplicar `text-balance`.
- **Cuerpo**: `font-sans` y aplicar `text-pretty` en párrafos descriptivos.
- **Labels técnicos y contadores**: `font-mono` (Space Mono) con `tabular-nums`.
- **Escala de radios**: Solo escala autorizada: `rounded-full` (pills, botones, inputs), `rounded-xl` (filas, botones sidebar), `rounded-2xl` (cards, SectionBar), `rounded-3xl` (heros). Prohibidos radios arbitrarios.

## Motion e Interacción

- **Animación**: Solo animar propiedades del compositor (`transform`, `opacity`).
- **Layout shift**: NUNCA animar `height` o `width` por CSS/JS sin reservar aspect-ratio (`aspect-[16/9]`, `aspect-[2/3]`) en colapsables.
- **Springs canónicos**:
  - Entrada / transición general: `stiffness:380 damping:30 mass:0.8`.
  - Tabs, segmented controls y pills: `stiffness:480 damping:34` con `layoutId` único.
  - Cards hover / active: `whileHover={{scale:1.012}}`, `active:scale-95`.
- **Accesibilidad**: Respetar siempre `prefers-reduced-motion` (`useReducedMotion`).
- **Touch**: Áreas de toque mínimas de 44px (`min-h-[44px] min-w-[44px]` o padding compensatorio) en controles móviles.
- NUNCA usar `h-screen`, usar `min-h-[100dvh]` o `h-dvh`.
