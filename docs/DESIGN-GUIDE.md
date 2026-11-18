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

Fuente: `apps/web/src/styles/tokens/*.css` + `apps/web/src/styles/themes/*.css` + `app/globals.css`.

| Dominio | Regla Canónica |
|---|---|
| **Color & MD3** | Usar `brand-accent`, `on-surface`, `on-surface-variant`, `surface-container*`, `outline-variant`. Fondos glass de utilidad: clase `.sectionbar` o tokens `--sectionbar-*`. Nunca valores hex inline salvo `--era-*-hex`. |
| **Los Diseños (`styles/themes/`)** | Dos diseños canónicos declarados en su par de archivos CSS + Manifiesto TS registrado en [`themes-registry.ts`](file:///e:/Proyectos_personales/KameHouse/apps/web/src/lib/theme/themes-registry.ts):<br>• **Minimalista (`classic-minimalist`)**: 100% plano y sólido, 0px blur, sin transparencias ni reflejos, el arte en primer plano.<br>• **Por Era (`era`)**: Estructura, controles, profundidad visual y bisel doble (Double-Bezel) de Neutro sobre base grafito Black Cinema (#08080A a #22222A), combinados con las 7 paletas OKLCH de Dragon Ball para acciones principales, selección e indicadores, tinte ambiental suave y Liquid Glass dinámico (`data-liquid="true"`).<br>*(Compatibilidad: el valor legacy `classic` se mantiene como entrada compatible y se resuelve a Por era con Universo DB).* |
| **Tokens SectionBar** | **Base en `tokens/shadows.css`**. Queda expresamente prohibido definir `--sectionbar-border*` o `--sectionbar-bg*` en `colors.css`. Los overrides por diseño viven en `themes/neutral.css` y `themes/era.css` (importados después de los tokens base), y el modo plano `:root[data-flat="true"]` desactiva el blur en `shadows.css` y `blur.css`. |
| **Tipografía** | `font-display` (Google Sans) para títulos, `font-sans` (Google Sans / Google Sans Flex) para cuerpo, `font-mono` (Space Mono) para metadatos técnicos, contadores y tags de audio/era. Títulos de tarjetas, heroes y modales usan `text-balance` (`text-wrap: balance`) para evitar palabras huérfanas. Minimum font floor: `text-xs` (12px). |
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

Trabajo compartido: usar `useMediaQuery` para breakpoints/preferencias con suscripción estable, compartir las extracciones de paleta en curso y registrar revelados con `observeRevealBatched`. Las lecturas de layout de un lote deben preceder a sus escrituras. El parallax escucha el contenedor propietario y se suspende fuera de pantalla; no precargar fondos globales que un hero local ya sustituye. El gobernador de rendimiento se suspende mientras la ventana no es observable. Validación y límites: `docs/auditoria/interfaz-2026-11-09-rendimiento.md`.

Los buscadores cerrados suspenden consultas semánticas y transformaciones de resultados, conservando texto y caché sin cancelar peticiones compartidas con otros consumidores abiertos. `MediaHero` reutiliza `useHeroParallax` a velocidad `0.35`, con prioridad para su `scrollContainerRef` explícito. El panel de diagnóstico suspende sus frames sin foco/visibilidad y reinicia el muestreo al volver. Cada revelado debe liberar su timer y listeners al terminar, desmontarse o reutilizarse el nodo; una limpieza anterior nunca debe borrar la animación vigente.

### Liquid Glass (Por era) & Modo Plano (Minimalista)

La aplicación ofrece dos temas canónicos en Ajustes → Apariencia:
- **Tema Por era (`era`)**: Reutiliza la jerarquía, tipografía, biseles (Double-Bezel Specular Border) y escala de superficies de Neutro sobre base grafito, incorporando **Liquid Glass dinámico** según la preferencia guardada (`data-liquid="true"`) con lentes de refracción óptica SVG en Chromium/WebView2 y adaptando las acciones principales, selección e indicadores a las 7 paletas de saga de Dragon Ball, con tinte ambiental suave en fondos y paneles, conservando textos y superficies de lectura predominantemente neutros.
- **Tema Minimalista (`classic-minimalist`)**: Desactiva todo efecto de vidrio (`data-flat="true"`, 0px blur) con superficies 100% sólidas y navegación simplificada.
*(Compatibilidad: las preferencias antiguas de Neutro se convierten automáticamente a Por era con Universo DB, conservando las preferencias de transparencia y efectos. El valor `classic` se mantiene como entrada compatible sin ofrecerse en la interfaz).*

El material Liquid Glass es adaptativo: `data-liquid-surface="navigation | panel | content | control"`. Navegación y paneles admiten lentes; contenido y controles comparten reflejos, relieve y fondo sin refracción ni desenfoque propios. Las recetas existentes `.surface-content`, `.glass-card`, `.glass-frosted-pill`, botones `glass` y cápsulas del reproductor tienen adaptación ligera. En tarjetas con póster, aplicar el material al marco redondeado existente, nunca a un contenedor transparente exterior ni sobre el arte. Los avisos conservan colores de estado y el texto de error usa una variante aclarada para contraste.

El acabado **Cristal Apple líquido** se aplica mediante el interruptor existente de refracción: bisel más transparente, reflejos blancos direccionales, tinte de era reducido al 3 % en el núcleo y una zona oscura de lectura dentro de cada superficie flotante. La selección de navegación usa un relieve translúcido con texto claro y comparte la lente de la isla. No modifica la distribución de las pantallas, los CTA de era ni las preferencias guardadas. Desactivar Liquid Glass recupera el material frosted; Minimalista conserva superficies sólidas.

Rendimiento: máximo **ocho lentes visibles simultáneas**; prioridad para la superficie enfocada, después paneles y finalmente navegación. Las superficies fuera del viewport retiran su filtro y lo reutilizan al volver. El resto conserva el material con desenfoque simple. Las superficies ópticas anidadas en el DOM no añaden lente ni blur propio; los paneles en portales independientes conservan sus efectos. Al entrar o salir el foco se recalcula la prioridad en un único frame agrupado. Descubrir superficies solo en subárboles añadidos y cambios de rol/contexto, ignorar las mutaciones del propio SVG y conservar sus nodos al cambiar dimensiones. Agrupar lecturas antes de escrituras. Las pasadas sobre el fondo usan un margen de tres desviaciones de blur; el padding amplio queda reservado para generar la máscara.

En **Ajustes → Apariencia → Vidrio líquido y superficies**, los usuarios pueden conmutar de forma directa los efectos de vidrio con desenfoque y la refracción óptica Liquid Glass para el tema Por era si desean un acabado frosted mate sin distorsión óptica o superficies completamente sólidas. La navegación lateral y la barra de guardado de Ajustes usan el mismo material. `styles/themes/liquid-glass.css` define las cuatro variantes y `lib/theme/liquid-refraction.ts` genera las lentes procedurales con bisel redondeado y centro neutro. `LiquidGlassDefs` libera filtros y observadores al desactivarse. Las lentes se actualizan por tamaño, contexto y densidad de pantalla, sin animación continua, seguimiento del puntero ni duplicación del contenido.

La refracción mediante `backdrop-filter: url(...)` se habilita en Chromium/WebView2; otros motores conservan el material con frosted. Se mantienen las exclusiones de diseños sólidos, modo plano, ahorro de energía, contraste alto y colores forzados. Solo `.floating-nav-island` y los roles `navigation`/`panel` registran lentes. No sumar blur por tarjeta, fila o botón. Navegación y paneles fuera de vídeo: escala SVG máxima de **36**, blur de **3 px** y saturación **1,25**. La escala de `feDisplacementMap` no equivale al desplazamiento absoluto en píxeles. El contexto `data-liquid-context="video"`, tanto en la superficie como en un contenedor padre, conserva el núcleo del reproductor al **88 %** y saturación **1**; sus paneles mantienen escala máxima **24** y blur de **2 px**, y su navegación escala máxima **36** y blur de **1 px**. Son excepciones explícitas al blur de 16–24 px de frosted. Comprobaciones y límites: `docs/auditoria/liquid-glass-2026-11-13-cristal-apple.md` y `docs/auditoria/liquid-glass-2026-11-09-adaptativo.md`.

La lente se genera con máscaras, desenfoque y derivadas SVG. No usar mapas `feImage` ni concatenar funciones CSS después de `url(...)`: la comprobación visual en Chrome detectó desplazamiento uniforme con la primera técnica. Ver también la [investigación del comportamiento de filtros de backdrop en Chromium](https://vantezzen.io/blog/liquid-glass). El bisel debe deformar el fondo mientras el centro conserva la misma alineación; comprobarlo con anillos y comparaciones de píxeles, además de revisar el estilo computado.

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
  /* ─── SectionBar Glass (Dark Glassmorphism + Soft UI / Opción A 64%) ────── */
  --sectionbar-border:        rgba(255, 255, 255, 0.12);
  --sectionbar-border-top:    rgba(255, 255, 255, 0.24);
  --sectionbar-border-bottom: rgba(255, 255, 255, 0.05);
  --sectionbar-bg:            rgba(22, 22, 22, 0.64);
  --sectionbar-blur:          var(--blur-overlay-md);
  --sectionbar-saturate:      165%;

  --sectionbar-shadow:
    var(--glass-highlight-md),
    inset 0 -1px 1px 0 rgba(0, 0, 0, 0.35),
    0 14px 36px -8px rgba(0, 0, 0, 0.72);

  --sectionbar-border-strong:       rgba(255, 255, 255, 0.16);
  --sectionbar-border-top-strong:   rgba(255, 255, 255, 0.30);
  --sectionbar-bg-strong:           rgba(30, 30, 30, 0.74);
  --sectionbar-shadow-strong:
    var(--glass-highlight-lg),
    inset 0 -1px 1px 0 rgba(0, 0, 0, 0.40),
    0 16px 48px -8px rgba(0, 0, 0, 0.80);

  /* ─── Soft UI / Neumorphism Táctil (Píldoras, Rieles Hundidos y Thumbs) ─── */
  --soft-pill-shadow:
    inset 0 1px 1px 0 rgba(255, 255, 255, 0.14),
    inset 0 -1px 2px 0 rgba(0, 0, 0, 0.42),
    0 4px 12px -2px rgba(0, 0, 0, 0.45);
  --soft-inset-shadow:
    inset 0 2px 5px 0 rgba(0, 0, 0, 0.62),
    0 1px 0 0 rgba(255, 255, 255, 0.05);
  --soft-thumb-shadow:
    inset 0 1px 1px 0 rgba(255, 255, 255, 0.22),
    0 2px 8px 0 rgba(0, 0, 0, 0.55);
}

/* Modo Clásico (Neutro / Graphite Glass + Soft UI — Opción A 64%) */
[data-mode="classic"] {
  --sectionbar-border:              rgba(255, 255, 255, 0.10);
  --sectionbar-border-top:          rgba(255, 255, 255, 0.24);
  --sectionbar-border-bottom:       rgba(255, 255, 255, 0.04);
  --sectionbar-bg:                  color-mix(in srgb, var(--neutral-elev-1) 64%, transparent);
}

/* Modo Flat (Bajo consumo): 0px blur, fondo sólido para GPU limitada */
[data-flat="true"] {
  --sectionbar-border:              rgba(255, 255, 255, 0.12);
  --sectionbar-border-top:          rgba(255, 255, 255, 0.20);
  --sectionbar-border-bottom:       rgba(255, 255, 255, 0.08);
  --sectionbar-bg:                  var(--bg-secondary);
  --sectionbar-blur:                0px;
  --sectionbar-shadow:              0 2px 8px rgba(0, 0, 0, 0.30);
  --soft-pill-shadow:               none;
  --soft-inset-shadow:              none;
  --soft-thumb-shadow:              none;
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
- Shell estructurado desde `lg`: sidebar de navegación por pilares a la izquierda y panel de formulario a la derecha. Por debajo de `lg`, navegación superior con pilares en un riel horizontal desplazable y formulario a ancho completo; se reutilizan los mismos controles y el acceso a Administración.
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

### Ritmo por superficie (revisión de movimiento, 2026-10-30)

- Feedback de presión, foco y color: 150 ms; no demora la acción.
- Navegación de páginas: entrada 250 ms y salida 110 ms. Desplazamientos pequeños, sin bloquear el montaje.
- Paneles de contenido y diálogos: entrada gradual 350 ms; cierres 150 ms. Modales desde escala 0.98.
- Paneles laterales: apertura 400 ms, cierre 350 ms; movimiento reducido sustituye el recorrido por un fundido de 150 ms.
- Heroes: imagen 500 ms, texto 350 ms; el contenedor no multiplica la opacidad de sus hijos.
- Grillas: stagger 40 ms con un máximo de 240 ms de espera; con movimiento reducido, sin cascada ni desplazamiento.
- Una sola entrada por superficie: el contenedor de Ajustes anima sus pestañas y el panel de sagas anima sus filas en conjunto.
- Los presets de springs se conservan para indicadores, gestos y continuidad de posición. Un indicador de pestaña no define el recorrido de un panel grande.
- Los elementos que salen deben dejar de recibir foco e interacción durante la transición. No se prolongan loaders ni esperas de datos para mostrar animación.

### Continuidad y preferencias en vivo (2026-11-09)

- La preferencia reactiva se obtiene de `hooks/use-reduced-motion.ts`, también reexportada por `kinetics/hooks.ts`. Comparte la suscripción de `useMediaQuery` y responde sin recargar; no importar el hook de Framer Motion directamente.
- `LoadSwap` monta contenido listo en el mismo cambio de estado. La salida queda absoluta, inerte y oculta para accesibilidad; no suma altura. `ownEntrance` evita sumar un fundido a una entrada propia. En perfiles `subtle` y `off`, sin recorrido vertical.
- En la estantería de Series el skeleton también sale superpuesto, sin demorar el montaje de las tarjetas. Las cascadas de Series y Mi Lista usan pasos de 40 ms y demora máxima de 240 ms; con movimiento reducido, sin demora.
- Los paneles intercambiables usan `PresenceSurface` cuando deben conservarse durante la salida. Admite ref para `popLayout` y retira interacción y accesibilidad desde el inicio del cierre. Los paneles que no pueden coexistir conservan su secuencia de salida/entrada.
- Escalas y elevaciones CSS de hover/presión se limitan con `motion-safe:` o una excepción local equivalente. No desactivar globalmente `transform`: puede usarse para centrar o posicionar controles. Los gestos Framer se condicionan a la preferencia y el hover a `(hover: hover) and (pointer: fine)`.
- Las transiciones manuales evitan capturas y fundidos de paleta con movimiento reducido. Activarlo durante una navegación cancela las animaciones y libera la señal de entrada de página.
- El cierre de búsqueda con Escape devuelve el foco al disparador. Al quitar un elemento de Mi Lista, enfocar un elemento restante o la cabecera; las filas salientes son inertes y quedan fuera de la navegación por teclado.

### Interrupciones y acciones consecutivas (2026-11-10)

- `PresenceSurface` conserva `inert` y `aria-hidden` explícitos del consumidor mientras está presente; durante la salida impone ambos. El menú de configuración del reproductor aplica esta protección tanto al panel como a sus submenús.
- Al quitar varias filas de Mi Lista, buscar el siguiente elemento vigente, luego el anterior y finalmente la cabecera. Excluir filas salientes, inertes u ocultas; vaciar la lista devuelve el foco a la cabecera.
- Activar movimiento reducido durante una View Transition nativa llama a `skipTransition()` sin cancelar la actualización de estado. La suscripción termina junto con la transición, incluso si falla o se interrumpe.
- Los gestos de tarjetas usan destinos neutros inmediatos con movimiento reducido para conservar la finalización de una presión iniciada antes del cambio. Al restaurar movimiento normal no deben retener la escala de presión.
- El fundido de paleta usa `--duration-quick` (150 ms); la marca temporal se limpia a los 200 ms o antes por scroll o movimiento reducido. Se conservan los materiales y desenfoques de cada tema.

### Feedback de selección y valores (2026-11-10)

- Las selecciones de audio, calidad y subtítulos reservan una celda de 20 px para `SelectionMark`: la marca aparece con opacidad/escala durante 150 ms, sin desplazar el texto. La carga de una pista ocupa la misma celda. Con movimiento reducido se conserva solo la transición de opacidad.
- `MenuButton` funde los cambios de valor con `IconSwap subtle`; el valor accesible permanece separado de las capas visuales para anunciar solo el estado actual. El chevron avanza 2 px al enfocar con teclado o pasar un puntero fino; con movimiento reducido queda estático.
- El recuento filtrado de Películas usa `ElasticCounter`, ocultando sus números salientes para accesibilidad y exponiendo una sola frase con el recuento vigente. Con movimiento reducido el número se sustituye directamente.
- Las tarjetas horizontales de Series separan el botón nativo de despliegue y la acción de reproducción rápida; nunca anidar acciones dentro de otro control interactivo. Al cerrar con foco dentro del contenido, devolverlo al disparador. El contenido cerrado es inerte y queda oculto para accesibilidad.
- En esas tarjetas, el zoom de portada requiere movimiento normal y puntero fino. Progreso y chevron cambian directamente con movimiento reducido; la expansión conserva su redistribución de contenido.

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

## 12. Arquitectura de los dos diseños de interfaz

Las opciones visibles son **Minimalista** (`classic-minimalist`) y **Por era** (`era`). El registro `themes-registry.ts` normaliza las entradas antiguas `classic` y `advanced` a Por era con Universo DB, conservando transparencia, efectos y valores personalizados. La normalización se aplica al cargar preferencias locales, resolver el tema y preparar/guardar Ajustes; el siguiente guardado persiste los valores canónicos.

| Diseño | Contrato DOM | Material |
|---|---|---|
| Minimalista | `data-mode="classic"`, `data-theme="classic"`, `data-ui-style="classic-minimalist"` | Sólido, plano por diseño |
| Por era | `data-mode="era"`, `data-theme="era-*"`, sin `data-ui-style` | Grafito, bisel doble y color por serie |

### 12.1 Base compartida procedente de Neutro

`neutral.css` contiene las recetas de superficies, escala de elevación (`#08080A` → `#101014` → `#18181E` → `#22222A`) y bisel doble que consume Por era. No constituye un tema seleccionable. Las recetas compartidas excluyen Minimalista. `cinematic-controls.css` aporta tipografía, controles, selección tenue, foco visible y áreas táctiles de 44 px; excluye también TV.

### 12.2 Por era: grafito, color y Liquid Glass

- Las siete paletas existentes colorean acciones principales, selección, indicadores y reflejos. Los fondos conservan su base grafito; paneles con vidrio incorporan un tinte de la atmósfera de la serie del 4–6 %, y fondos ambientales del 4–8 %. Los textos conservan su contraste neutro.
- Universo DB sigue la serie de la pantalla mediante `screen-era`; las paletas manuales permanecen fijas. Una paleta desconocida utiliza Universo DB.
- Liquid Glass respeta la preferencia guardada. Cambiar a Minimalista lo suspende sin modificarla; volver a Por era la recupera. Las lentes se reservan a superficies flotantes visibles, con presupuesto máximo de ocho, control de rendimiento y alternativa esmerilada en motores sin soporte.
- `data-flat="true"` prevalece sobre el vidrio por ajuste manual, contraste o ahorro. Minimalista lo activa siempre. Paneles usan el token `overlay-md` de 24 px; tarjetas y listas conservan los materiales ligeros del sistema adaptativo.
- Orden de estilos: tokens, base compartida Neutra, paletas Por era, controles compartidos, Minimalista y materiales Liquid Glass. Las paletas tienen prioridad equivalente a la base para que sus tintes no queden anulados.

### 12.3 Tema Minimalista (`classic-minimalist`): contenido primero

Inspirado en el minimalismo cinematográfico de Apple TV+, adaptado al universo de Dragon Ball. Ofrece una estética sobria, monocromática y limpia con un **acabado plano y discreto**, coherente en toda la aplicación, para usuarios que prefieren controles discretos y máxima concentración en el arte de la obra.

El nombre visible es **Minimalista**, con la descripción «El arte en primer plano. Controles discretos y navegación sencilla». Las referencias de diseño quedan unificadas en esta guía y en [TEMA-MINIMALISTA.md](TEMA-MINIMALISTA.md). Los identificadores persistidos `classic-minimalist` y `data-ui-style` conservan su contrato. *(Nota histórica: las recetas experimentales previas con pastilla activa blanca perla con texto oscuro y cantos de tarjeta con sombra exterior profunda quedan deprecadas y sustituidas por la definición plana y discreta definitiva).*

- **Definición de Estilos & CSS Tokens**: [`apps/web/src/styles/themes/classic-minimalist.css`](file:///d:/Proyectos_personales/KameHouse-rio-grande/apps/web/src/styles/themes/classic-minimalist.css)
- **Manifiesto TypeScript & Metadatos**: [`apps/web/src/lib/theme/classic-minimalist.theme.ts`](file:///d:/Proyectos_personales/KameHouse-rio-grande/apps/web/src/lib/theme/classic-minimalist.theme.ts)

Cualquier cambio de apariencia (color de botones primarios/secundarios, altura, bordes redondeados, opacidad de barras flotantes o controles del reproductor) se realiza directamente en este archivo sin necesidad de modificar múltiples componentes individuales.

#### Contrato DOM y Persistencia

- **Selector raíz**: todas las reglas se limitan a `[data-ui-style="classic-minimalist"]:not([data-tv="true"])`. La exclusión es defensiva: no activa ninguna experiencia TV. Los componentes solo exponen hooks semánticos; no contienen variantes arbitrarias del tema.
- **Plano por diseño**: Minimalista activa el modo plano (`resolveFlatReason` → `"theme"`, `data-flat="true"`): cero `backdrop-filter` en toda la app y superficies sólidas de la rampa del tema. El tema no declara `backdrop-filter`; si alguna vez lo hiciera, sin `-webkit-` detrás (Lightning CSS conserva solo la última y Chromium ignora la prefijada).
- **Tokens**: [`classic-minimalist/tokens.css`](../apps/web/src/styles/themes/classic-minimalist/tokens.css) es la única fuente de color, materia, geometría y movimiento del tema (`--minimal-*`) y reasigna la rampa global (`--neutral-elev-*`, `--label-*`, shadcn) para que los componentes compartidos usen los mismos grises. Las demás hojas del tema no llevan colores literales.
- **Modo maratón**: solo cambia la continuidad de reproducción. Conserva el tema, la navegación y los controles normales; la experiencia para televisores vive en KameHouseTV.
- **Contrato**: las ocho reglas medibles (plano, monocromo, excepciones de color, dos recetas de botón, cuatro tamaños de texto, radios, sombras solo en lo que flota y movimiento sin rebote) están en [TEMA-MINIMALISTA.md › Contrato](TEMA-MINIMALISTA.md#contrato).
- **Persistencia y Reactividad**: Se selecciona desde `Ajustes > Apariencia > Tema`, se sincroniza en `themeVisual.themeMode` dentro de `kamehouse-ui-settings` (Zustand + local storage) y se refleja instantáneamente sin recargar la página.

#### Variantes de Controles

Las reglas de uso, tallas y estados se detallan en [TEMA-MINIMALISTA.md](TEMA-MINIMALISTA.md#recetas-de-botones-y-estados). `Button` usa 36/40/46 px (`xs`–`sm`/`md`/`lg`–`xl`), con mínimo táctil de 44 px; texto de 13 px en pequeños y 14 px en el resto. Carga conserva contraste, deshabilitado usa opacidad del 45 % y la selección secundaria o persistente usa relleno tenue al 8 % (`--minimal-fill-3`) con borde `--minimal-line-4` y texto claro (`--minimal-text-1`). El blanco pleno se reserva para la acción dominante de cada bloque. El hover requiere ratón (`--minimal-fill-4`); la pulsación usa `scale(0.98)`. Los roles `type-*` heredan los tamaños y pesos del tema; los títulos conservan su escala de composición.

El foco se conserva al combinar teclado y hover. `Skeleton` lleva `data-skeleton` para recibir el acabado estático del tema sin afectar indicadores `animate-pulse`. Las opciones de menú son de al menos 44 px en táctil y el texto editable, de al menos 16 px en móvil. Los selectores segmentados desplazan su contenido cuando las etiquetas no caben, respetan movimiento reducido y no animan opciones deshabilitadas. Los tooltips largos ajustan su texto al ancho disponible.

Las etiquetas de fila y campo en Minimalista comparten 16 px / 600 y las ayudas, 13 px / 500. La escala heredada `text-2xs…5xs` tiene piso de 12 px; los pesos, captions y títulos usan la misma rampa del tema. `SpringSwitch` se identifica por hooks `data-switch` y `data-switch-thumb`, conserva su pista de 36 × 20 o 46 × 26 px y reserva 44 × 44 px de interacción sin deformarla. Las filas deshabilitadas se atenúan una vez y presentan un solo anillo de foco. Las tarjetas de elección tienen selección tenue sin halo ni marco duplicado; `RadioCardGroup` usa Tab, flechas y Home/End. En este tema, Apariencia mantiene los controles de vidrio visibles y deshabilitados, explicando con ayudas legibles que las superficies son fijas y sólidas por diseño, conservando intacta la preferencia guardada para el tema Por era.

| Variante | Apariencia | Altura / Radio | Hover / Active |
|---|---|---|---|
| **Primario** | Blanco perla plano (`--minimal-primary-bg`), texto `#08080A`, peso 600, sin borde ni sombra exterior. «Reproducir» del hero conserva el único halo del tema | 46 / 40 / 36 px · 12 px (8 px en la talla chica) | Hover `#FFFFFF`; en el hero, elevación de 1 px. Active `scale(0.98)` |
| **Secundario** | Blanco al 8 % (`--minimal-fill-3`), filete de 1 px al 12 %, canto superior al 14 %, peso 500: la receta de «Más información» | 46 / 40 / 36 px · 12 px (8 px en la talla chica) | Hover blanco al 12 % (`--minimal-fill-4`), filete al 20 %, texto `#FFFFFF`. Active `scale(0.98)` |
| **Outline** | Filete de la receta secundaria sin relleno | Según talla · 12 px | Hover relleno al 6 % |
| **Ghost** | Transparente, texto `#9898A0` | 36–44 px · 8 px | Hover `#FFFFFF` + relleno al 6 % |
| **Filter / SegmentedControl** | Riel transparente, selección tenue con `--minimal-fill-3`, borde `--minimal-line-4` y texto claro | 36 px (44 px de área) · 8 px | Activo: texto `#F5F5F7`, peso 600 |
| **Navegación y EraRail** | Desde 768 px, franja sólida `#141418` con layout normal (marca, destinos, búsqueda, acciones rápidas, ajustes). Selección tenue con `--minimal-fill-3`, texto claro y foco visible diferenciado. El selector de eras es la única pieza del cromo con color | 56 px · concéntrico (12 px / píldora solo en indicadores) | Destino activo: `--minimal-fill-3` y texto `#F5F5F7` |
| **Reproductor** | Cápsulas sólidas `#141418`; saltar intro y siguiente episodio usan la receta primaria | Nativo · 12 / 8 px | Encendido: relleno al 16 % |

### 12.4 Superficies y Componentes Integrados en Archivo Único

Todo vive controlado y editable desde [`apps/web/src/styles/themes/classic-minimalist.css`](file:///d:/Proyectos_personales/KameHouse-rio-grande/apps/web/src/styles/themes/classic-minimalist.css):

1. **Pestañas (`SegmentedControl`) & Riel de Eras (`EraRail`)**:
   - `UI-SegmentedControl_root`, `UI-SegmentedControl_option`, `UI-SegmentedControl_indicator`: Fondo transparente, sin borde grueso ni sombra exterior; selección tenue al 8% (`--minimal-fill-3`), borde `--minimal-line-4` y texto claro (`--minimal-text-1`).
   - `[data-era-selector="rail"]`, `[data-era-selector="bar"]`: Neutraliza acentos de saga; kanji y anillo de progreso en blanco puro `#FFFFFF`.
2. **Fichas Multimedia (`DetailHero` & `DetailActions`)**:
   - `detail-meta-chip`: Metadatos sin cajas ni blur individual; tipografía continua y legible separada por puntos.
   - `detail-round-action`: Controles obsidiana de 46×46 px con radio de 12 px.
3. **Listado de Episodios (`PremiumEpisodeList`)**:
   - `episode-row-redundant-play`: Ocultación del botón de Play duplicado de la derecha.
   - `episode-progress-bar-fill`: Barra de progreso flat en blanco `#FFFFFF` sin sombras ni resplandores neón.
   - `episode-badge-watched`, `episode-badge-ep`, `episode-badge-filler`: Insignias planas de 6 px, monocromas (también el estado visto).
   - `episode-active-subsaga-banner`, `episode-row-highlighted`: Banner de sub-arco activo con relleno tenue y filete; fila resaltada con filete blanco, sin halos.
4. **Cronología Editorial (`CompactTimeline`, `ContralateralDetailsCard`, `SpanProgressBar`, `VolumeInspectorModal`)**:
   - Override `--era: 245 245 247 !important; --era-text: 245 245 247 !important;`: Convierte filetes, anillos y segmentos de saga en monocromía editorial.
   - `chronology-compact-row`, `chronology-progress-segment`: Fila limpia y segmentos redondeados.
   - `volume-nav-group`: Contenedor con radio de 8 px e ítems internos con `Button` (`intent="ghost"`, `size="xs"`) a 6 px concéntricos, eliminando opacidades deshabilitadas ad-hoc.
   - `volume-scrubber-fill`: Barra de scrubber en blanco perla sin gradiente cálido.
   - Neutralización de `ring-brand-accent` a blanco especular y caja de impacto narrativo en escala de grises.
5. **Reproductor de Video (`SeekBar`, `PlayerBottomBar`, `PlayerTopBar` & `Overlays`)**:
   - `player-seek-fill`, `player-seek-thumb`: Barra y cursor en blanco puro sin glow naranja. Marcadores de opening (`data-marker="op"`) y ending (`data-marker="ed"`) destacados sutilmente.
   - `player-skip-btn`, `player-next-ep-btn`: Botones de salto y siguiente episodio en blanco `#F5F5F7` con radio suave `rounded-xl` (12 px), miniatura interna `.player-next-ep-thumb` a 8 px y llenado progresivo.
   - `[data-toast="auto-skip"]`: Toast monocromático de auto-skip con botón limpio de «Deshacer».
   - `player-marathon-btn`: Acceso directo en 1 clic a Modo Maratón en la barra inferior con estado activo en relleno al 16% (`--minimal-fill-5`).
   - **Acciones secundarias en Más opciones**: Retroceder/adelantar 10 s, Mi lista (cuando contiene elementos) y Abrir en mpv (cuando está disponible) se agrupan en el menú completo, que conserva audio, subtítulos, calidad, imagen y reproducción. Sus accesos directos en las barras se ocultan y se mantienen los atajos (`J`/`L`, `Q`, `←`/`→`, `Esc`). Abrir Mi lista o mpv cierra primero el menú; mpv no puede activarse de nuevo durante el handoff.
   - `player-eyebrow-text`: Sobreetiqueta en gris neutro `#A1A1AA`.
   - `player-icon-button`: Vinculado a `--control-disabled-opacity` y `--minimal-disabled-opacity` para estados deshabilitados canónicos.
6. **Formularios, Inputs y Popovers Universales**:
   - `.UI-Input__root`, `select.rounded-full`, `input.rounded-full`: Radio unificado de 12px con foco blanco accesible.
   - `[data-select-surface]`, `[data-select-option]`: superficie sólida `#141418`, radio exterior de 12px e interior de 8px.
7. **Modales y Diálogos**:
   - `CharacterDetailModal`, `VolumeInspectorModal`, `RandomPlayButton` ("Sorpréndeme"): Cristal obsidiana con borde sutil, fondo sólido en plano y badges de 6px. `.global-queue-panel` y `.player-settings-surface` comparten la receta.
8. **Navegación Global (`FloatingPillNav`) & Paneles (`SectionBar`)**:
   - Desde 768 px, marca, destinos, búsqueda, acciones rápidas y ajustes se integran en una **franja superior sólida con layout normal**, eliminando el solapamiento de islas flotantes. Entre 768 y 1023 px se muestra el símbolo de KameHouse y desde 1024 px también el nombre. Los nombres de los cinco destinos permanecen visibles a 768 y 820 px. La búsqueda se expande sobre la franja ocultando temporalmente los destinos para teclado (`inert`, `aria-hidden`) y restaurando la navegación y el foco al cerrarla. Maratón, Sorpréndeme y Sonidos viven en el menú **Acciones rápidas**, con etiquetas claras y foco al abrir. Controles de al menos 44 px de alto. En móvil se conserva el shell inferior de safe areas.
   - `.sectionbar-header-icon`: Íconos de cabecera con relleno tenue monocromo, sin cajas de color.

### 12.5 Las 5 Reglas Fundamentales del Diseño Classic-Minimalist

1. **Jerarquía Tipográfica y Tratamiento de Textos**:
   - `font-display` (Google Sans) para encabezados en `font-semibold` o `font-medium` con `tracking-tight` (`-0.02em`) y `text-balance`.
   - **Sentence case estricto**: Prohibido el uso de ALL CAPS en botones o títulos (`text-transform: none !important`). Solo acrónimos universales (4K, HDR, TV, DBZ, OVA) van en mayúsculas.
   - `font-mono` (Space Mono) con `tabular-nums` obligatorio en todos los valores numéricos dinámicos (duración, timecode, episodio). Piso mínimo tipográfico: `text-xs` (12px).
2. **Estructura de Bordes, Radios Concéntricos y Contraste Monocromático**:
   - Escala concéntrica: 16px para contenedores maestros/modales/islas $\to$ 12px para botones y tarjetas de acción $\to$ 8px para sub-items y chips.
   - Prohibido el uso de píldoras (`rounded-full`) en rectángulos de acción.
   - Filetes de 1 px (`--minimal-line-1…5`, del 6 al 32 %); el canto superior solo en la receta de botón secundaria. Cero marcos gruesos o auras en el cromo.
3. **Densidad de Información y Supresión de Ruido**:
   - Metadatos continuos separados por punto medio (`·`), eliminando cajas con fondo y blur individual por cada palabra.
   - Supresión de botones redundantes: el thumbnail es el trigger principal de reproducción.
4. **Motion y Micro-interacciones Sobrias**:
   - Tiempos de respuesta reducidos ($\le 180\text{ms}$), curva sin rebote ni overshoot `cubic-bezier(0.22, 1, 0.36, 1)`.
   - Active feedback sutil con `scale(0.98)`. Elevación óptica en hover de apenas `1px` (`translateY(-1px)`).
   - Prohibido el uso de `transition-all`.
5. **Reproductor y Paridad Sólida**:
   - Controles limpios directamente sobre degradado suave, eliminando cápsulas invasivas.
   - Acceso en 1 clic a **Modo Maratón** en la barra inferior.
   - Botón contextual dinámico para **Saltar Intro / Créditos** y toast con opción de **«Deshacer»**.
   - Los controles secundarios retroceder/adelantar 10 s, Mi lista y Abrir en mpv se encuentran en **Más opciones**, preservando los atajos de teclado (`J`/`L`, `Q`, `M`, `S`, `F`, `Esc`).
   - Plano por diseño: el reproductor no usa desenfoque; las cápsulas son sólidas (`#141418`).

- Solo la acción principal recibe el mayor contraste. La navegación y los filtros orientan con selecciones tenues; no compiten con Reproducir.
- `.hero-actions` unifica todos sus controles a 46 px / 12 px. `.hero-synopsis` limita la lectura a 56 caracteres aproximados por línea sin bloquear la expansión de la ficha. La reproducción dentro de `TimelineVolumeCard` conserva 32 px / 8 px.
- `.card-title` usa peso 600 y caja natural. `.card-detail-drawer`, `.card-hover-scrim` y `.card-hover-synopsis` ocultan información secundaria en miniaturas; `.card-quick-action` conserva acceso en hover y foco.
- La estantería de Series conserva íntegra su excepción cromática por era, incluido `.vhs-shelf`. El cromo es monocromo: estrellas, vistos, completados y progreso van en blanco. Solo el selector de eras y el rojo de error tienen color.
- Home conserva el orden de navegación por eras, hero y catálogo. La separación entre bloques es 24 px en móvil y 32 px en escritorio; el catálogo suma 16 px de aire antes de su cabecera y usa 20 px entre sagas en escritorio. Las tarjetas conservan el arte y muestran título, metadatos y progreso disponible; la duración de películas permanece visible sin hover y las sinopsis se consultan en la ficha.
- Los títulos del hero usan Google Sans con peso 600 y caja natural. Las sagas muestran el rango de episodios bajo el título, sin repetirlo en una insignia superior; se conserva el estado de relleno cuando corresponde.
- `.hero-title` extiende esa jerarquía al hero de Películas y las fichas compartidas. Las ayudas de Ajustes y las etiquetas móviles tienen un mínimo de 12 px; la navegación inferior reparte el ancho por contenido y usa selección tenue con radio de 8 px.
- Las filas `OsToggle` conservan su superficie en ambos estados. El control interno `SpringSwitch` resuelve el contraste con `brand-accent` / `on-primary`; los selectores de `role=switch` no pintan la fila entera. El símbolo de Cronología hereda el primer plano de su nodo, también cuando está activo.
- En móvil, la sinopsis del Home usa texto secundario y el scrim inferior existente protege la zona de lectura desde antes del título; se conservan el arte y el encuadre. Cronología compacta permite dos líneas de título en esa anchura.
- El nombre accesible del menú del reproductor se vincula al título visible de la vista actual, sin duplicar cabeceras. La hoja móvil devuelve el foco al disparador al cerrarse.
- Desde 768 px, `--chrome-top` y `--chrome-stick` reservan el espacio de la franja flotante en el tema; Home reutiliza ese espacio y Administración mantiene aire bajo la barra.
- El foco de teclado usa 1.5 px blanco al 72% y halo de 4 px al 12%. Con reducción de movimiento se desactivan el desplazamiento de hover y la compresión del tema.
- `EraRail` en modo automático usa una barra tipográfica en Minimalista, incluso en escritorio; conserva teclado, scroll horizontal y estados sin contenido. El esqueleto reserva el mismo espacio. Los otros temas conservan la decisión por ancho.
- Los campos estándar usan `#141418` y radio de 12 px. `TextInput appearance="line"` y las filas `OsInput` de Ajustes presentan una línea inferior. El foco de un campo embebido pertenece a su contenedor. El error `aria-invalid` conserva el filete o subrayado rojo durante la edición; solo lectura usa línea discontinua y los deshabilitados se atenúan una vez. Los iconos de campos de línea tienen espacio reservado. `TextArea` comparte etiqueta, ayuda y error de `BasicField`, con contador opcional tabular (`showCount`).
- `SeekBar` conserva los capítulos y los tiempos de intro/créditos recibidos del reproductor. Su área de interacción mide al menos 44 px; los separadores son discretos y el foco se dibuja sobre la línea. No se generan segmentos artificiales.

Referencias consultadas: [Linear: navegación más discreta y menos separadores](https://linear.app/now/behind-the-latest-design-refresh) y [Raycast: concentrar la atención con modo compacto](https://www.raycast.com/blog/a-fresh-look-and-feel). La adaptación conserva el arte y la identidad de KameHouse.

### 12.6 Referencias de Diseño Evaluadas (Investigación Comparativa)

| Plataforma / Referencia | Aporte de Valor a KameHouse | Decisión |
|---|---|---|
| **Apple TV+ Desktop** | Jerarquía visual cinematográfica, botones en blanco suave (`#F5F5F7`) sobre carbón, tipografía continua separada por puntos en metadatos, el contenido como protagonista. | **Eje Central** |
| **Linear** | Rigor métrico en inputs, elevaciones oscuras sólidas (`#141417`), foco sin glow estridente (`rgba(255,255,255,0.4)`), estados hover/active discretos con `scale(0.98)`. | **Eje Estructural** |
| **Raycast** | Paleta monocromática estricta para controles utilitarios, chips de atajos y badges de estado rectangulares (`6px`), sin desenfoques pesados innecesarios. | **Eje Utilitario** |
| **Plex** | Organización eficiente de bibliotecas y metadatos continuos. | **Adaptado** |
| **Apple Music** | Microinteracciones táctiles, sliders y ecualizadores monocromáticos. | **Adaptado** |
| **Netflix** | Rechazado su rojo saturado y sombras pesadas; adoptada su claridad en filas de episodios. | **Filtrado** |
| **Librerías de Efectos / Glass Excesivo** | Descartadas por penalización de GPU, falta de accesibilidad y distracción del arte de Dragon Ball. | **Descartadas** |

---

*Documento canónico v6 de KameHouse — Fuente de verdad para desarrollo de interfaz y prompts de IA.*


### Paleta Negro dentro de Por era (11/11/2026)

Por era ofrece además `era-black` (**Negro**): lienzo negro puro, superficies grafito, acentos blancos y Liquid Glass según la preferencia guardada. No muestra atmósfera cromática ni marca de agua y no sigue la serie en pantalla. Se guarda mediante `themeEra`, sin introducir un tercer tema. El selector contiene ocho paletas: Universo DB, seis series y Negro; los colores propios de las imágenes y las insignias del contenido se conservan.
