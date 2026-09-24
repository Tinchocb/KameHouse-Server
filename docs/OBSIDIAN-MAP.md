# Obsidian → KameHouse: Mapa de Adaptación de Componentes

Guía y arquitectura para adaptar componentes del registro Obsidian (compatible con shadcn / React / Tailwind) a la arquitectura de KameHouse (`apps/web`: `rsbuild`, `tailwind 3.4`, `framer-motion@12`, alias `@/*` y tokens de `docs/DESIGN-GUIDE.md`).

---

## 1. Doctrina de Adaptación

1. **No instalar CLI ni dependencias pesadas**: No se usa `npx shadcn@latest add` ni se instalan paquetes de canvas/WebGL (`three`, `@react-three/*`, etc.).
2. **Copiar y Refactorizar**: Se extrae el código del componente (`files[].content` del registry JSON), se normalizan los imports a `@/*` y se tokeniza contra `docs/DESIGN-GUIDE.md`.
3. **Ubicación de Componentes**:
   - **Primitivas físicas y micro-interacciones**: `@/components/ui/kinetics/` (`MagneticIndicator`, `RubberSlider`, `HoldConfirm`, `ElasticCounter`, `RippleFeedback`).
   - **Componentes compuestos y layouts de experiencia**: `@/components/ui/obsidian/` (ej. `scroll-stack`, `parallax-gallery`, `text-stream`).
4. **Respeto a la Licencia**: Todo archivo adaptado debe preservar en su cabecera la atribución y aviso de licencia MIT del autor original.

---

## 2. Mapeo de Componentes

| Componente Obsidian | Destino KameHouse | Spring / Easing | Rol en KameHouse |
| :--- | :--- | :--- | :--- |
| **`magnet-tabs`** | `@/components/ui/kinetics/index.tsx` (`MagneticIndicator`) | `stiffness: 480, damping: 34` | Navegación de eras (`SpotlightEraNav`), tabs de biblioteca |
| **`scroll-stack`** | `@/components/ui/obsidian/scroll-stack.tsx` | Spring `380/30` / CSS Sticky | Showcase de temporadas/arcos dentro de `<SectionBar variant="minimal">` |
| **`parallax-gallery`** | `@/components/ui/obsidian/parallax-gallery.tsx` | CSS `transform` / Hardware gate | Galería de fanarts / capturas en detalle de serie |
| **`flip-scroll`** | `@/components/ui/obsidian/flip-scroll.tsx` | FLIP `layoutId` / Spring `280/28` | Transición entre vistas lista / grid |
| **`text-fill-animation` / `text-stream`** | `@/components/ui/obsidian/text-stream.tsx` | `cubic-bezier(0.23, 1, 0.32, 1)` | Sinopsis animada / quotes icónicos de personajes |
| **`otp-input`** | `@/components/ui/forms/otp-input.tsx` | `scale 0.97` en active | Códigos de vinculación y confirmación |
| **`arrow-fill-button`** | `@/components/ui/buttons/arrow-fill-button.tsx` | Spring `380/30` | Botones de acción principal (CTA Play / Ver trailer) |
| **`masonry-grid`** | `@/components/ui/layout/masonry-grid.tsx` | CSS Grid nativo | Explorador de sagas y películas |

---

## 3. Blacklist para TV y Desktop (Vetados por Defecto)

Los siguientes componentes están **estrictamente vetados en el path crítico** debido a incompatibilidad con mandos D-pad/teclado, alto consumo de GPU integrada en Tauri/TV o violación de accesibilidad:

- ❌ `butterfly-trail-cursor` / `rope-cursor`: Cursores basados en puntero que no existen en TV/touch y confunden al usuario.
- ❌ `dither-canvas` / `curved-plane` / `fractal-glass`: Requieren Three.js / WebGL shaders pesados, impiden la aceleración fluida en GPUs integradas y rompen `prefers-reduced-motion`.

> [!CAUTION]
> Cualquier efecto visual decorativo adicional debe pasar obligatoriamente por el gate `isHeavyAllowed && !reduceMotion` (ver `apps/web/src/lib/hardware/performance-store.ts`).

---

## 4. Checklist de Adaptación (Protocolo Emil)

Al importar o adaptar cualquier componente de Obsidian:

- [ ] **Alias e Imports**:
  - Reemplazar `@ui/*`, `@components/*`, `@lib/*`, `@hooks/*` por `@/*`.
  - Usar `cn` desde `@/components/ui/core/styling`.
- [ ] **Tokenización**:
  - Reemplazar cualquier color hex (`#ff8a00`, `#111`) por variables del tema: `var(--brand-accent)`, `var(--sectionbar-border-top)`, `var(--md-sys-color-on-surface)`.
  - Unificar radios: `rounded-full` para pills, `rounded-xl` / `rounded-2xl` para cards y paneles.
  - Eliminar sombras no autorizadas (`shadow-2xl`); emplear tokens de elevación `shadow-elevation-1` o `shadow-elevation-2`.
- [ ] **Física & Tiempos**:
  - Duración máxima de transición interactiva: `< 300ms`.
  - Usar `useSpringPreset` (`tabIndicator 480/34`, `entrance 380/30`, `tabContent 280/28`).
  - Escala táctil en `:active`: `active:scale-95` o `scale(0.97)` (nunca < 0.95 ni `scale(0)`).
- [ ] **Aislamiento de Plataforma**:
  - Encapsular interacciones de ratón en `@media (hover: hover) and (pointer: fine)`.
  - Garantizar navegación por teclado (`onKeyDown`, `:focus-visible` con outline claro).
  - Asegurar área táctil mínima de 44x44px.
- [ ] **Reduced Motion**:
  - Integrar `useReducedMotion()` de `framer-motion` para conmutar a `tween` de 150ms o desactivar la animación.
- [ ] **Licencia**:
  - Incluir el aviso de copyright original en el encabezado del archivo.
