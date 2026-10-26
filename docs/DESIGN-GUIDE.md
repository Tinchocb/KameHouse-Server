# KameHouse — Guía de Diseño v6 (Sistema de Superficies & Cinematográfico)

> **Referencia canónica para KameHouse.** Evolución v6: Arquitectura en 3 familias de superficies, el contenido como protagonista (*poster-first*), jerarquía de efectos sin sobrecosto de GPU, y Kinetics pragmático. Documento único y centralizado.

---

## 1. Filosofía v6

1. **El contenido es el rey (*Poster-First*)**: Las portadas de anime, escenas y cronología de Dragon Ball deben destacar por encima de los contenedores. Los marcos pesados y el vidrio esmerilado no deben competir con el arte.
2. **Cinematic Minimalist dark-first + MD3**: Profundidad generada mediante viñetas cinemáticas, scrims progresivos, contraste y luz focalizada. `body` siempre transparente (`globals.css`); el color base vive solo en `html` (`bg-[var(--bg-primary)]`) para permitir que el `DynamicBackdrop` (`-z-10`) respire.
3. **Personalidad por pantalla (Anti-clones)**:
   - **Home**: Cinemática, espectacular, hero spotlight inmersivo con viñetas de la era Dragon Ball activa.
   - **Catálogo / Series / Películas**: Limpia y eficiente (*ContentSurface*), posters edge-to-edge sin contenedores que encajonen las tarjetas.
   - **Cronología**: Editorial y narrativa, eje temporal con tarjetas de lapso y tira contralateral de detalles.
   - **Ajustes / Formularios**: Sobria, técnica y estructurada (*UtilitySurface*), hábitat natural del componente canónico `SectionBar`.
   - **Reproductor**: Prácticamente invisible, chrome mínimo para inmersión total.

---

## 2. Tokens (Fuente Única de Verdad)

Fuente: `apps/web/src/styles/tokens/*.css` + `app/globals.css`.

| Dominio | Regla Canónica |
|---|---|
| **Color & MD3** | Usar `brand-accent`, `on-surface`, `on-surface-variant`, `surface-container*`, `outline-variant`. Fondos glass de utilidad: clase `.sectionbar` o tokens `--sectionbar-*`. Nunca valores hex inline salvo `--era-*-hex`. |
| **Tokens SectionBar** | **Fuente única: `tokens/shadows.css`**. Queda expresamente prohibido duplicar o redefinir `--sectionbar-border*` o `--sectionbar-bg*` en `colors.css` para evitar colisiones de cascada CSS. Los modos `[data-mode="classic"]` y `[data-flat="true"]` se sobreescriben en `shadows.css`. |
| **Tipografía** | `font-display` (Outfit) para títulos, `font-sans` para cuerpo, `font-mono` (Space Mono) para metadatos técnicos, contadores y tags de audio/era. Títulos de tarjetas, heroes y modales usan `text-balance` (`text-wrap: balance`) para evitar palabras huérfanas. Minimum font floor: `text-xs` (12px). |
| **Radio** | Solo la escala de tokens: `rounded-full` (pills, botones, inputs, tabs), `rounded-xl` (filas internas, botones secundarios), `rounded-2xl` (tarjetas, posters, `SectionBar`), `rounded-hero` (`--radius-hero: var(--radius-3xl)`). Prohibidos valores arbitrarios (13px, 17px, etc.). |
| **Sombras** | Solo tokens semánticos: `shadow-elevation-1..5`, `shadow-hero`, `shadow-[var(--shadow-brand-primary)]` para CTA, `shadow-[var(--sectionbar-shadow)]` para utilidad glass. Nunca `shadow-lg` genérico ni valores `rgba` inline. |
| **Motion** | Springs de Framer Motion: entrada `stiffness: 380, damping: 30, mass: 0.8`, tabs/indicadores `stiffness: 480, damping: 34`. Clases CSS: `duration-base` (250ms), `ease-smooth-out`. **Prohibido `transition-all`** (declarar siempre propiedades explícitas: `transition-[transform,opacity,colors]`). Respetar siempre `prefers-reduced-motion`. |
| **Layout** | Contenedor canónico: `page-container` (`w-full max-w-content mx-auto px-4 sm:px-6 md:px-8 lg:px-10`, `--content-max: 1800px`). |

---

## 3. Arquitectura de Superficies: Las 3 Familias v6

En v6 abandonamos la idea de forzar `SectionBar` en toda la aplicación. Las pantallas se construyen combinando 3 familias semánticas según el tipo de interacción:

```
                               ┌────────────────────────────────────────┐
                               │       KAMEHOUSE SURFACE SYSTEM         │
                               └────────────────────────────────────────┘
                                                    │
            ┌───────────────────────────────────────┼──────────────────────────────────────┐
            ▼                                       ▼                                      ▼
  ┌───────────────────┐                   ┌───────────────────┐                  ┌───────────────────┐
  │  ImmersiveSurface │                   │   ContentSurface  │                  │   UtilitySurface  │
  ├───────────────────┤                   ├───────────────────┤                  ├───────────────────┤
  │ · Hero Spotlight  │                   │ · Grids Catálogo  │                  │ · Pantalla Ajustes│
  │ · Dynamic Backdr. │                   │ · Sagas y Series  │                  │ · Formularios     │
  │ · Cronología Hero │                   │ · Lista Episodios │                  │ · SectionBar puro │
  │ · Scrim radial    │                   │ · 0px Blur (60fps)│                  │ · Filas & Dividers│
  └───────────────────┘                   └───────────────────┘                  └───────────────────┘
```

### 3.1 `ImmersiveSurface` (Impacto y Atmósfera)
- **Destino**: Home Hero (`MediaSpotlight`), encabezados de Saga, fondos de reproducción y nodos destacados de Cronología.
- **Efectos**: Máximo **1 backdrop activo** con degradados radiales de la era Dragon Ball activa, viñetas de fusión con `--bg-primary` y blur atmosférico moderado (12px a 20px).
- **Regla**: Nunca anidar dos `ImmersiveSurface` en la misma vista visible.

### 3.2 `ContentSurface` (Poster-First & Rendimiento Puro)
- **Destino**: Grids de series, carruseles de películas, fichas de episodios y tarjetas de exploración.
- **Efectos**: **0px Blur.** Las tarjetas individuales se renderizan sobre un fondo translúcido ligero (`bg-white/[0.04]` o `rgba(20, 20, 24, 0.35)`), con un borde sutil (`border border-white/5` a `white/10`).
- **Elevación al Hover**: `hover:-translate-y-1 hover:border-white/20 hover:shadow-elevation-2` con aceleración GPU (`will-change: transform`).
- **Beneficio**: Al no computar desenfoques en 50 pósteres simultáneos, el scroll en catálogos extensos se mantiene fijo a 60 FPS sin tirones.

### 3.3 `UtilitySurface` (Estructura y Formularios — Hogar Canónico de `SectionBar`)
- **Destino**: Pantalla de Ajustes, diálogos modales de configuración, formularios de administración y paneles de filtros.
- **Efectos**: Contenedor estructurado con borde luminoso de dos tonos (rim highlight superior), `backdrop-blur-overlay-md` (16px - 24px) y divisores internos discretos.
- **Aquí vive `SectionBar`**: Este es el componente canónico para agrupar controles con opción colapsable.

---

## 4. Jerarquía de Efectos & Presupuesto de Rendimiento

Para evitar que los efectos compitan por atención y degraden la tasa de refresco, se establece una jerarquía en 3 niveles:

| Nivel | Aplicación | Blur Permitido | Fondo | Regla de Oro |
|---|---|:---:|---|---|
| **Nivel Alto** | Hero Spotlight, Dynamic Backdrop, Scrim del Reproductor | 12px – 20px | Radial con acento de Era + Viñeta | Máximo 1 en pantalla simultáneamente |
| **Nivel Medio** | Navigation Bar superior, Modales flotantes, Dropdowns | 16px – 24px | `.sectionbar` o `.glass-frosted` | **Prohibido doble blur apilado** (si el modal tiene blur, el overlay es negro sólido al 60%) |
| **Nivel Bajo** | Tarjetas de catálogo, filas de ajustes, botones, inputs | **0px (Ninguno)** | `bg-white/[0.04]` o `bg-zinc-950/40` | Uso masivo ilimitado; elevación solo por sombra/escala |

---

## 5. Componente Canónico: `SectionBar` (UtilitySurface)

Ubicación: `apps/web/src/components/ui/sectionbar.tsx`.
Diseñado para la familia `UtilitySurface` (Ajustes, Filtros y Paneles estructurados).

### 5.1 Tokens en `tokens/shadows.css`
Fuente: `apps/web/src/styles/tokens/shadows.css:129-184`.

```css
:root {
  /* ─── SectionBar Glass ──────────────────────────────────────────── */
  --sectionbar-border:        rgba(255, 255, 255, 0.15);
  --sectionbar-border-top:    rgba(255, 255, 255, 0.35);
  --sectionbar-border-bottom: rgba(255, 255, 255, 0.10);
  --sectionbar-bg:            rgba(20, 20, 25, 0.45);
  --sectionbar-blur:          var(--blur-overlay-md);
  --sectionbar-saturate:      190%;

  --sectionbar-shadow:
    var(--glass-highlight-md),
    0 12px 36px -6px rgba(0, 0, 0, 0.75);

  --sectionbar-border-strong:       rgba(255, 255, 255, 0.22);
  --sectionbar-border-top-strong:   rgba(255, 255, 255, 0.45);
  --sectionbar-bg-strong:           rgba(25, 25, 30, 0.55);
  --sectionbar-shadow-strong:
    var(--glass-highlight-lg),
    0 16px 48px -8px rgba(0, 0, 0, 0.80);
}

/* Modo Clásico (Neutro / Apple HIG) */
[data-mode="classic"] {
  --sectionbar-border:              rgba(255, 255, 255, 0.10);
  --sectionbar-border-top:          rgba(255, 255, 255, 0.20);
  --sectionbar-border-bottom:       rgba(255, 255, 255, 0.06);
  --sectionbar-bg:                  color-mix(in srgb, var(--neutral-elev-1) 60%, transparent);
}

/* Modo Flat (Bajo consumo): 0px blur, fondo sólido para GPU limitada */
[data-flat="true"] {
  --sectionbar-border:              rgba(255, 255, 255, 0.12);
  --sectionbar-border-top:          rgba(255, 255, 255, 0.20);
  --sectionbar-border-bottom:       rgba(255, 255, 255, 0.08);
  --sectionbar-bg:                  var(--bg-secondary);
  --sectionbar-blur:                0px;
  --sectionbar-shadow:              0 2px 8px rgba(0, 0, 0, 0.30);
}
```

### 5.2 Implementación React Canónica (Libre de Bugs)
```tsx
import React, { useState, type ReactNode, type ElementType } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/components/ui/core/styling";
import { ChevronDown } from "lucide-react";

interface SectionBarProps {
  label: string;
  description?: string;
  icon?: ElementType;
  badge?: ReactNode;
  children: ReactNode;
  collapsible?: boolean;
  defaultOpen?: boolean;
  searchQuery?: string;
  variant?: "default" | "strong" | "minimal";
  className?: string;
  id?: string;
}

export function SectionBar({
  label,
  description,
  icon: Icon,
  badge,
  children,
  collapsible = false,
  defaultOpen = true,
  searchQuery,
  variant = "default",
  className,
  id,
}: SectionBarProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const isSearching = !!searchQuery && searchQuery.trim().length > 0;
  const showContent = !collapsible || isOpen || isSearching;

  const baseClasses = cn(
    "sectionbar rounded-2xl scroll-mt-28",
    variant === "strong" && "sectionbar-strong",
    variant === "minimal" && "sectionbar-minimal",
    className
  );

  if (!collapsible) {
    return (
      <div id={id} className={cn(baseClasses, "p-5 md:p-6 space-y-4")}>
        <div className="sectionbar-header flex items-center justify-between px-1">
          <div className="flex items-center gap-3">
            {Icon && (
              <div className="w-8 h-8 rounded-xl bg-brand-accent/10 border border-brand-accent/25 flex items-center justify-center text-brand-accent shrink-0 shadow-[0_0_12px_hsl(var(--brand-accent)/0.15)]">
                <Icon className="w-4 h-4" />
              </div>
            )}
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-black uppercase tracking-wider text-on-surface font-mono">{label}</h3>
                {badge && <span className="ml-2">{badge}</span>}
              </div>
              {description && <p className="text-[11px] text-on-surface-variant/70 leading-normal font-medium mt-0.5">{description}</p>}
            </div>
          </div>
        </div>
        <div className="sectionbar-divide">{children}</div>
      </div>
    );
  }

  return (
    <div id={id} className={baseClasses}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 sm:px-5 py-3.5 flex items-center justify-between text-left hover:bg-white/[0.04] transition-[background-color,color] group select-none"
        aria-expanded={showContent}
      >
        <div className="flex items-center gap-3.5 min-w-0 pr-4">
          {Icon ? (
            <div className="w-7 h-7 rounded-lg bg-white/[0.06] border border-white/15 border-t-white/30 flex items-center justify-center text-on-surface shrink-0 group-hover:scale-105 transition-transform shadow-inner">
              <Icon className="w-3.5 h-3.5 text-on-surface" />
            </div>
          ) : (
            <div className="w-1.5 h-4.5 rounded-full bg-brand-accent shrink-0" />
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-black uppercase tracking-wider text-white font-mono group-hover:text-brand-accent transition-colors truncate">
                {label}
              </h3>
              {badge}
            </div>
            {description && (
              <p className="text-[11px] text-on-surface-variant/75 leading-normal font-medium line-clamp-1 mt-0.5">
                {description}
              </p>
            )}
          </div>
        </div>
        <div className={cn(
          "w-6.5 h-6.5 rounded-lg bg-white/[0.04] border border-white/10 flex items-center justify-center text-on-surface-variant group-hover:text-white group-hover:bg-white/[0.08] transition-[transform,background-color] shrink-0",
          showContent && "rotate-180 text-white bg-white/10 border-white/20"
        )}>
          <ChevronDown className="w-3.5 h-3.5 transition-transform duration-base" />
        </div>
      </button>

      <AnimatePresence initial={false}>
        {showContent && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="overflow-hidden border-t border-white/[0.08]"
          >
            <div className="p-4 sm:p-5 space-y-3.5 sectionbar-divide">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
```

---

## 6. Shells de Página por Personalidad

### 6.1 Home (Cinemático Inmersivo)
Combina `ImmersiveSurface` en la parte superior y `ContentSurface` directa en el catálogo inferior. **No encierra las cuadrículas de pósteres en cajas pesadas de vidrio:**

```tsx
<div className="relative min-h-screen text-on-surface overflow-x-hidden">
  <div className="relative z-10 flex flex-col">
    {/* 1. ImmersiveSurface: Hero de Era, Parallax y Hub superior */}
    <MediaSpotlight items={spotlightItems} onNavigate={handleNavigate} />

    {/* 2. ContentSurface: Catálogo edge-to-edge poster-first */}
    <div className="page-container space-y-8 pt-6 pb-16">
      <section className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2.5">
            <div className="w-2 h-5 rounded-full bg-brand-accent" />
            <h2 className="text-base font-bold text-white tracking-tight">Sagas Canónicas</h2>
          </div>
          <Link to="/series" className="text-xs text-brand-accent hover:underline">Ver todas →</Link>
        </div>
        {/* ContentSurface puro: 0 blur, poster respira */}
        <SagasGrid items={sagas} />
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2.5">
            <div className="w-2 h-5 rounded-full bg-brand-secondary" />
            <h2 className="text-base font-bold text-white tracking-tight">Películas y Especiales</h2>
          </div>
        </div>
        <MoviesGrid items={movies} />
      </section>
    </div>
  </div>
</div>
```

### 6.2 Catálogo y Series (ContentSurface — Poster-First)
- Los pósteres usan `aspect-[2/3]` con radio `rounded-xl` o `rounded-2xl`.
- Tags flotantes (`AUDIO LATINO`, `CANON`, `OVA`) montados directamente sobre la carátula con fondo negro al 80% y tipografía mono.
- Sin contenedor `SectionBar` que rodee el grid. La cuadrícula respira sobre el fondo base de la página.

### 6.3 Ajustes / Admin (UtilitySurface — Hábitat de SectionBar)
- Shell estructurado con sidebar de navegación por pilares a la izquierda y panel de formulario a la derecha.
- Bloques de configuración agrupados en `<SectionBar collapsible>` con `.sectionbar-divide` entre filas.
- Filas de controles con `OsToggle`, `OsSelect`, `OsInput` manteniendo hover en `hover:bg-white/[0.04]`.

---

## 7. Prevención Estricta de Layout Shifts (Anti-Jank)

Todo elemento multimedia o dinámico **DEBE reservar su aspect-ratio o dimensión base en CSS**:
- Pósteres de catálogo / series: `aspect-[2/3] rounded-2xl`
- Banners y miniaturas de episodios: `aspect-video` o dimensiones explícitas (`h-24 sm:h-28`)
- Avatares / iconos: dimensiones fijas (`w-8 h-8`, `w-12 h-12`)

> [!WARNING]
> **Anti-Jank**: Nunca permitir que imágenes sin tamaño reservado carguen dentro de contenedores animados con `height: "auto"`. Si la imagen carga asíncronamente sin dimensiones fijas, Framer Motion recalculará la altura a destiempo provocando un salto brusco en la interfaz.

---

## 8. Kinetics Pragmático (Spring Physics)

En v6 simplificamos el sistema de movimiento para eliminar código muerto y ambigüedades con el hook `useSpring` nativo de Motion:

### 8.1 Presets Canónicos de Resorte (Spring Configs)
Centralizados como objetos de configuración reutilizables, sin wrappers complejos innecesarios:

```ts
export const SPRING_PRESETS = {
  /** Entrada de vistas y modales */
  enter: { stiffness: 380, damping: 30, mass: 0.8 },
  /** Deslizamiento magnético de tabs y selectores de era */
  tabIndicator: { stiffness: 480, damping: 34 },
  /** Contenido interno / transiciones suaves */
  content: { stiffness: 280, damping: 28 },
  /** Elevación sutil de tarjeta */
  lift: { stiffness: 400, damping: 25 },
} as const;
```

### 8.2 Componente Canónico: `SegmentedControl`
Ubicación: `components/ui/segmented-control.tsx`.
- Utiliza `layoutId={`tab-indicator-${scopedId}`}` con el preset `SPRING_PRESETS.tabIndicator`.
- Contenedor con `sectionbar-pill` (`rounded-full`).
- Si `prefers-reduced-motion` está activo, se sustituye automáticamente por una transición lineal rápida (`{ duration: 0.15 }`).

---

## 9. Patrón Canónico: Tarjeta de Lapso (Cronología)

Fuente canónica: `apps/web/src/components/chronology/TimelineVolumeCard.tsx`.

1. **Reproducción directa en la miniatura**: Miniatura 16:9 con trigger de play integrado, evitando botoneras redundantes.
2. **Sin botón invasivo "Marcar"**: Estado pasivo visualizado mediante badges en el encabezado (`Visto ✓` en `bg-emerald-500/15 text-emerald-300`).
3. **Detalles como Panel Lateral Contralateral**: El botón "Detalles" abre una card complementaria en el espacio libre del eje (columna contralateral en desktop), nunca un acordeón que empuje el contenido hacia abajo.
4. **Tira de Momentos Clave**: Escenas 16:9 con badge de tiempo en glassmorphism y salto directo al minuto exacto de la escena.

---

## 10. Checklist de Aceptación (v6)

Al crear o modificar cualquier apartado en KameHouse, validar:

1. [ ] **¿Familia correcta de superficie?**
   - Hero / Spotlight → `ImmersiveSurface`
   - Grids / Catálogos / Series → `ContentSurface` (sin SectionBar envolvente)
   - Ajustes / Formularios → `UtilitySurface` (`SectionBar`)
2. [ ] **¿Rendimiento de blur?** 0px blur en cuadrículas masivas de pósteres; máximo 1 blur de fondo activo.
3. [ ] **¿Tokens respetados?** Tokens `--sectionbar-*` consumidos desde `shadows.css` sin duplicar en `colors.css`. Colores de era dinámicos.
4. [ ] **¿Anti-Layout Shift?** Todas las imágenes tienen dimensiones o `aspect-[2/3]` / `aspect-video` reservado.
5. [ ] **¿Cero `transition-all`?** Todas las transiciones declaran propiedades explícitas (`transition-[transform,colors]`).
6. [ ] **¿Accesibilidad y Rótulos?** Foco visible con `:focus-visible`, targets mínimos de 44px en móviles táctiles, `aria-expanded` sincronizado.
7. [ ] **¿Modo Flat / Bajo consumo?** Respeta `[data-flat="true"]` desactivando blur a 0px.

---

## 11. Anti-patrones Estrictos (Rechazar en Code Review)

- ❌ **Encajonar cuadrículas de catálogo con `SectionBar` rígido**: El póster debe respirar en `ContentSurface`.
- ❌ **Aplicar blur en elementos repetitivos masivos**: Prohibido `backdrop-filter` en cada tarjeta de un grid de 50 ítems.
- ❌ **Doble blur apilado**: Overlay desenfocado + modal con desenfoque simultáneo.
- ❌ **Uso de `transition-all`**: Degrada el rendimiento al animar propiedades no aceleradas por hardware.
- ❌ **Imágenes sin aspect-ratio fijo**: Provocan saltos de altura (*layout shifts*) en acordeones o cargas asíncronas.
- ❌ **Hardcodear colores hex**: Prohibido usar `#FF8A00` o `#141418` directos; usar siempre `hsl(var(--brand-accent))` o clases de tokens.
- ❌ **Reescribir `--sectionbar-*` en `colors.css`**: La fuente única de verdad es `shadows.css`.

---

*Documento canónico v6 de KameHouse — Fuente de verdad para desarrollo de interfaz y prompts de IA.*
