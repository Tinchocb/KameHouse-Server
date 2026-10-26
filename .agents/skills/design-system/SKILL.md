---
name: design-system
description: Aplicar el sistema de diseño KameHouse (Home + Ajustes) al mejorar cualquier apartado. Usar cuando se retoque una vista existente o se cree una nueva.
---

# KameHouse Design System Skill

Fuente canónica: `docs/DESIGN-GUIDE.md`. Patrones oro: `apps/web/src/routes/home/` + `apps/web/src/routes/settings/`. Tokens: `apps/web/src/styles/tokens/*.css`.

## Workflow

1. Leer la guía y el componente activo antes de modificarlo. Explicar causa técnica y plan según `.agents/rules/communication.md`.
2. Reutilizar el shell y los componentes de la superficie; preservar identidad, personajes y encuadres.
3. Aplicar los tokens actuales. No copiar recetas visuales que dupliquen los valores de CSS.
4. Verificar estados, teclado, móvil y movimiento reducido. Distinguir pruebas de código de comprobaciones visuales.
5. Si guía y código canónico difieren, documentar la diferencia y sincronizar la guía; no rediseñar una composición existente para ajustarla a un ejemplo antiguo.

## Shells

- **Home cinematográfico**: `routes/home/index.tsx` + `MediaSpotlight`; fondo transparente para `DynamicBackdrop`, contenido en `page-container`, separación `space-y-4`, padding superior `pt-nav`.
- **Hero**: reutilizar `HERO_STAGE_CLASS` (`lib/config/hero-stage.ts`), `rounded-hero`, `shadow-hero` y variantes de `kinetics/variants.ts`. No copiar dimensiones.
- **Ajustes estructurado**: `routes/settings/index.lazy.tsx`; sidebar flotante `.sectionbar rounded-3xl`, barra móvil `.sectionbar .sectionbar-strong`, cabecera mínima y bloques `SectionBar`.
- Administración, Películas y detalle: seguir su shell vigente y las referencias de la guía, sin imponer el mismo grid a todas las superficies.

## Componentes canónicos

- `SectionBar`: variantes `default | strong | minimal | content`. Catálogos edge-to-edge: `minimal`; bloques de contenido: `content`. Títulos de sección en sans y sentence case. `font-mono` solo para contadores y etiquetas técnicas cortas.
- Filas de Ajustes: `OsToggle`, `OsSelect`, `OsInput`; navegación por cinco pilares, sin buscador montado. `SectionBar.searchQuery` es una API opcional, no implica un `SettingsFilter` existente.
- `SegmentedControl`: `layoutId` único y `aria-label`; `radiogroup` para filtros, `tablist` para paneles. Con pestañas, opciones con `id`/`panelId` y panel asociado mediante `role="tabpanel"` / `aria-labelledby`. `surface="inset"` dentro de una superficie que ya tiene glass.
- Eras: `SpotlightEraNav` delega en `EraRail`; no reimplementar pills.
- Acciones: `Button` con intención y tamaño canónicos; `primary` para CTA principal, `glass` sobre imagen cuando corresponda, `secondary`/`ghost`/`outline` sobre superficie. Radio pill y feedback de pulsación del componente.
- SaveBar: seguir la implementación de Ajustes y sus estados Guardando/Guardado.

## Home y estados

- `SpotlightLowerHub`: `SectionBar variant="minimal"` y `SegmentedControl` cuando hay sagas y películas.
- Sagas: tarjetas panorámicas 16:9; grid `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4`.
- Películas: acordeón desde `sm` hasta seis ítems (columna en móvil); con más ítems, riel horizontal con scroll y snap. Expansiones solo para puntero fino con hover.
- Auto-rotación: `HERO_ROTATION_MS` / `--hero-rotation-duration` = **5000 ms**. Pausa con hover/foco, pestaña oculta, ventana sin foco, movimiento reducido o una sola era.
- Skeleton: reutilizar `HomeSkeleton` o espejar el layout real; dimensiones/aspect-ratio reservados. No aplicar `animate-pulse` a un elemento con backdrop-filter.
- Biblioteca vacía/error: reutilizar `LibraryEmptyState` / `LibraryErrorState` / `EmptyState`; texto comprensible, jerarquía de títulos y CTA contextual. Vacíos internos en el flujo de la sección.

## Tokens y motion

- Colores: `brand-accent`, `on-surface*`, `label-*`, `surface-container*`, paletas de era existentes. Sin hex fijos ni `text-white` en chrome temático.
- Glass: `.sectionbar`, `.glass-frosted`, `.glass-frosted-pill`, `.glass-card` o tokens `--sectionbar-*`. No reescribir bordes/fondos manuales: deben seguir Clásico, Flat y Liquid.
- Blur: **24 px (`overlay-md`) en paneles**; **64 px (`overlay-2xl`) solo en hero y overlays cinematográficos**. Un blur por superficie; ninguno por badge o fila repetida.
- Radios: pill en botones/inputs/selectores, `rounded-xl` en filas, `rounded-2xl` en cards, `rounded-hero` en hero; `rounded-3xl` para superficies flotantes grandes según guía.
- Sombras: tokens `elevation-*`, `shadow-hero`, sombras de CTA o `--sectionbar-shadow`. El type hint `shadow-[shadow:var(--token)]` es válido. No sombras genéricas ni rgba inline.
- Springs: `useSpringPreset` / `useSpring` desde `kinetics/hooks.ts`; `entrance` 380/30/0.8, `tabIndicator` 480/34, `tabContent` 280/28. No inventar presets.
- Respetar `prefers-reduced-motion` y `selectIsHeavyEffectsAllowed`. Clases de duración/easing desde tokens.
- Hover solo bajo `[@media(hover:hover)_and_(pointer:fine)]`; feedback active del componente y limpieza de transforms en handlers manuales.

## Verificación

Teclado y foco visible; nombres accesibles; roles y estados; touch 44 px; inputs móviles 16 px; safe areas en barras fijas; sin desbordamientos; estados carga/error/vacío; variantes Moderno/Clásico/Flat; movimiento reducido. No afirmar contraste, rendimiento o comportamiento visual sin medirlo en ejecución.
