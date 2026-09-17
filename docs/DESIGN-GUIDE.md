# KameHouse — Guía de Diseño v5 (fuente: Home + Ajustes)

> Referencia canónica para mejorar el resto de apartados. Home (`routes/home/`) y Ajustes (`routes/settings/`) son el patrón oro. No reinventar: copiar estas recetas.

---

## 1. Filosofía

**Cinematic Minimalist dark-first + MD3**. Profundidad por glass + blur + scrims, no por fondos opacos. `body` siempre transparente (`globals.css`); el color base vive solo en `html` (`bg-[var(--bg-primary)]`) para no tapar el `DynamicBackdrop` (`-z-10`). Viñeta de página vía `--page-gradient` en `body::before`.

---

## 2. Tokens (no hardcodear)

Fuente: `apps/web/src/styles/tokens/*.css` + `app/globals.css`.

| Dominio | Regla |
|---|---|
| **Color** | Usar `brand-accent`, `on-surface`, `on-surface-variant`, `surface-container*`, `outline-variant`. Fondos glass: `bg-zinc-950/40` + **SectionBar border** `border-white/15 border-t-white/35 border-b-white/10`. Nunca hex fijo salvo `--era-*-hex`. |
| **Tipografía** | `font-display` (Outfit) para títulos, `font-sans` cuerpo, `font-mono` (Space Mono) para labels técnicos/contadores. Escala fluida con `clamp` (`--text-*`). |
| **Radio** | Solo escala: pill `rounded-full` (botones, inputs, selects, tabs), `rounded-xl` filas/botones sidebar, `rounded-2xl` cards (`SectionCard`), `rounded-3xl` heros (`--radius-hero`). Prohibidos valores arbitrarios (13px, 19px…). |
| **Sombra** | Solo tokens: `shadow-elevation-1..5`, `shadow-[var(--shadow-brand-primary)]` para CTA, **SectionBar shadow** `shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.3),0_12px_36px_-6px_rgba(0,0,0,0.85)]` para cards glass. Nunca `shadow-lg` genérico ni inline. |
| **Blur** | Solo overlays: `backdrop-blur-overlay-md/2xl`, clases `.glass-card` / `.glass-liquid`. Una sola capa de blur por panel; filas internas con `bg-white/[0.04]` sin blur. Respeta `[data-flat]` y `[data-liquid]`. |
| **Motion** | Springs framer-motion: entrada `stiffness:380 damping:30 mass:0.8`, tabs `stiffness:280 damping:28`. Clases CSS: `duration-base` (250ms), `ease-out/smooth-out`. `active:scale-95`, `hover-lift` en cards. Respetar `prefers-reduced-motion` / `useReducedMotion`. |
| **Layout** | Contenedor: `page-container` (`w-full max-w-content mx-auto px-4 sm:px-6 md:px-8 lg:px-10`, `--content-max:1800px`). Utilidades: `.scrim-hero-*`, `.text-edge-glow`, `.no-scrollbar`, `.gpu`. |

---

## 3. **NUEVO: SectionBar — Patrón Unificado de Sección**

El "Section Bar" es el contenedor visual base que une **SettingsSection (collapsible)**, **SettingsCard**, y se extiende a **Home sections**, **Movies/Series grids**, **Admin panels**.

### 3.1 Tokens CSS (añadir a `tokens/shadows.css` y `tokens/colors.css`)

```css
:root {
  /* ─── SectionBar Glass — borde blanco sutil (top/bottom rim) ───────────────── */
  --sectionbar-border:       rgba(255, 255, 255, 0.15);   /* lados */
  --sectionbar-border-top:   rgba(255, 255, 255, 0.35);   /* rim superior */
  --sectionbar-border-bottom:rgba(255, 255, 255, 0.10);   /* rim inferior */
  --sectionbar-bg:           rgba(20, 20, 25, 0.45);      /* zinc-950/40 aprox */
  --sectionbar-blur:         var(--blur-overlay-2xl);
  --sectionbar-saturate:     190%;

  --sectionbar-shadow:
    inset 0 1px 1px 0 rgba(255, 255, 255, 0.20),   /* highlight interno top */
    0 12px 36px -6px rgba(0, 0, 0, 0.75);          /* elevación MD3 level 3+ */

  /* ─── SectionBar Variantes ───────────────────────────────────────────────── */
  --sectionbar-border-strong:  rgba(255, 255, 255, 0.22);
  --sectionbar-border-top-strong:  rgba(255, 255, 255, 0.45);
  --sectionbar-bg-strong:  rgba(25, 25, 30, 0.55);      /* zinc-950/55 */
  --sectionbar-shadow-strong:
    inset 0 1px 1px 0 rgba(255, 255, 255, 0.25),
    0 16px 48px -8px rgba(0, 0, 0, 0.80);

  /* Flat mode overrides */
  [data-flat="true"] {
    --sectionbar-border:       rgba(255, 255, 255, 0.12);
    --sectionbar-border-top:   rgba(255, 255, 255, 0.20);
    --sectionbar-border-bottom:rgba(255, 255, 255, 0.08);
    --sectionbar-bg:           var(--bg-secondary);
    --sectionbar-blur:         0;
    --sectionbar-shadow:       0 2px 8px rgba(0, 0, 0, 0.30);
  }
}
```

### 3.2 Clases Utilitarias Tailwind (añadir a `globals.css` o `app.css`)

```css
/* SectionBar base — usar en TODOS los contenedores de sección */
.sectionbar {
  @apply rounded-2xl;
  border: 1px solid var(--sectionbar-border);
  border-top-color: var(--sectionbar-border-top);
  border-bottom-color: var(--sectionbar-border-bottom);
  background-color: var(--sectionbar-bg);
  -webkit-backdrop-filter: saturate(var(--sectionbar-saturate)) blur(var(--sectionbar-blur));
  backdrop-filter: saturate(var(--sectionbar-saturate)) blur(var(--sectionbar-blur));
  box-shadow: var(--sectionbar-shadow);
  @apply transition-all duration-base;
}

/* Variante fuerte (hero sections, featured panels) */
.sectionbar-strong {
  border-color: var(--sectionbar-border-strong);
  border-top-color: var(--sectionbar-border-top-strong);
  background-color: var(--sectionbar-bg-strong);
  box-shadow: var(--sectionbar-shadow-strong);
}

/* Variante minimal (catálogos de pósteres / vistas cinematográficas edge-to-edge) */
.sectionbar-minimal {
  border-color: transparent;
  background-color: transparent;
  -webkit-backdrop-filter: none;
  backdrop-filter: none;
  box-shadow: none;
}

/* Divider interno entre filas */
.sectionbar-divide > * + * {
  border-top: 1px solid rgba(255, 255, 255, 0.06); /* divide-white/[0.06] */
}

/* Header de sección (título + icono + badge) */
.sectionbar-header {
  @apply flex items-center justify-between px-1;
}
.sectionbar-header-icon {
  @apply w-8 h-8 rounded-xl bg-brand-accent/10 border border-brand-accent/25 flex items-center justify-center text-brand-accent shrink-0 shadow-[0_0_12px_hsl(var(--brand-accent)/0.15)];
}
.sectionbar-header-title {
  @apply text-xs font-black uppercase tracking-wider text-on-surface font-mono;
}
.sectionbar-header-desc {
  @apply text-[11px] text-on-surface-variant/70 leading-normal font-medium mt-0.5;
}
.sectionbar-header-badge {
  @apply ml-2;
}
```

### 3.3 Componente Canónico: `SectionBar` (crear en `components/ui/sectionbar.tsx`)

```tsx
import { cn } from "@/components/ui/core/styling";
import { motion, AnimatePresence } from "framer-motion";
import { ReactNode } from "react";

interface SectionBarProps {
  /** Título de la sección */
  label: string;
  /** Descripción opcional */
  description?: string;
  /** Icono opcional (lucide/react-icons) */
  icon?: React.ElementType;
  /** Badge opcional (contador, estado, etc.) */
  badge?: React.ReactNode;
  /** Contenido de la sección */
  children: ReactNode;
  /** Si es colapsable (estilo SettingsSection) */
  collapsible?: boolean;
  /** Estado inicial abierto */
  defaultOpen?: boolean;
  /** Query de búsqueda para auto-abrir */
  searchQuery?: string;
  /** Variante visual */
  variant?: "default" | "strong" | "minimal";
  /** Clases adicionales */
  className?: string;
  /** ID para scroll-margin */
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
  const [isOpen, setIsOpen] = React.useState(defaultOpen);
  const isSearching = !!searchQuery && searchQuery.trim().length > 0;

  const baseClasses = cn(
    "sectionbar",
    variant === "strong" && "sectionbar-strong",
    variant === "minimal" && "sectionbar-minimal",
    "scroll-mt-28",
    className
  );

  if (!collapsible) {
    return (
      <div id={id} className={cn(baseClasses, "space-y-3.5", "p-5 md:p-6")}>
        <div className="sectionbar-header">
          <div className="flex items-center gap-3">
            {Icon && <div className="sectionbar-header-icon"><Icon className="w-4 h-4" /></div>}
            <div>
              <div className="flex items-center gap-2">
                <h3 className="sectionbar-header-title">{label}</h3>
                {badge && <span className="sectionbar-header-badge">{badge}</span>}
              </div>
              {description && <p className="sectionbar-header-desc">{description}</p>}
            </div>
          </div>
        </div>
        <div className="sectionbar-divide">{children}</div>
      </div>
    );
  }

  const showContent = isOpen || isSearching;

  return (
    <div id={id} className={baseClasses}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 sm:px-5 py-3 flex items-center justify-between text-left hover:bg-white/[0.04] transition-colors group select-none"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-3.5 min-w-0 pr-4">
          {Icon ? (
            <div className="w-7 h-7 rounded-lg bg-white/[0.06] border border-white/15 border-t-white/30 flex items-center justify-center text-on-surface shrink-0 group-hover:scale-105 transition-all shadow-inner">
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
          "w-6.5 h-6.5 rounded-lg bg-white/[0.04] border border-white/10 flex items-center justify-center text-on-surface-variant group-hover:text-white group-hover:bg-white/[0.08] transition-all shrink-0",
          showContent && "rotate-180 text-white bg-white/10 border-white/20"
        )}>
          <Icons.navigation.chevronDown className="w-3.5 h-3.5 transition-transform duration-base" />
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

### 3.4 Prevención de Layout Shifts en Colapsables y Grids
Todo elemento multimedia o dinámico dentro de un `SectionBar` (en especial cuando `collapsible={true}`) **DEBE reservar su aspect-ratio o dimensión base en CSS**:
- Pósteres de catálogo / sagas / películas: `aspect-[2/3] rounded-2xl`
- Vistas previas de episodios / banners: `aspect-video` o `h-20 sm:h-24`
- Avatares de personajes / iconos: dimensiones fijas (`w-8 h-8`, `w-12 h-12`, etc.)

> [!WARNING]
> **Anti-Jank**: Nunca permitir que imágenes sin tamaño reservado carguen dentro de un contenedor animado con `height: "auto"`. Si la imagen carga asíncronamente sin dimensiones fijas, Framer Motion recalculará la altura a destiempo, generando tirones visuales (*layout shift*).

---

## 4. Shells de Página (actualizados con SectionBar)

### Home (contenido cinematográfico) — usa SectionBar para secciones inferiores

```tsx
<div className="relative min-h-screen text-on-surface overflow-x-hidden">
  <div className="relative z-10 flex flex-col">
    {/* MediaSpotlight (hero + eras + hub) — NO usa SectionBar, es inmersivo */}
    <MediaSpotlight items={spotlightItems} onNavigate={handleNavigate} />

    {/* Secciones de catálogo: Sagas, Películas, Próximamente — SÍ usan SectionBar */}
    <div className="page-container space-y-4 pt-4 pb-8">
      <SectionBar
        label="Sagas"
        description="Colecciones completas por universo"
        icon={FolderIcon}
        badge={<span className="text-xs font-mono px-2 py-0.5 rounded-full bg-white/10 text-on-surface-variant">{sagasCount}</span>}
        variant="default"
      >
        <SagasGrid items={sagas} />
      </SectionBar>

      <SectionBar
        label="Películas"
        description="Largometrajes, OVAs y Especiales"
        icon={FilmIcon}
        variant="default"
      >
        <MoviesGrid items={movies} />
      </SectionBar>
    </div>
  </div>
</div>
```

### Ajustes / Movies / Series / Admin (shell estructurado con sidebar)

```tsx
<div className="flex flex-col md:flex-row h-full w-full pt-16 md:pt-0 text-on-surface-variant selection:bg-brand-accent/30 overflow-hidden relative bg-transparent">
  <nav className="hidden md:flex md:w-60 lg:w-[280px] xl:w-[290px] shrink-0 h-full flex-col border-r border-white/20 backdrop-blur-overlay-2xl overflow-y-auto no-scrollbar bg-zinc-950/40">
    {/* Sidebar navegación pilares */}
  </nav>
  <main className="flex-1 flex flex-col h-full overflow-hidden">
    <header className="shrink-0 px-6 sm:px-8 lg:px-10 pt-20 pb-5 border-b border-white/10 bg-zinc-950/30 backdrop-blur-overlay-2xl">
      {/* Header con título, búsqueda, acciones */}
    </header>
    <div className="flex-1 overflow-y-auto no-scrollbar">
      <form className="w-full page-container py-7 pb-32 space-y-9 min-h-full">
        {/* SectionBar para cada bloque de ajustes */}
        <SectionBar
          id="library"
          label="Biblioteca"
          description="Rutas de escaneo, metadatos, sincronización"
          icon={DatabaseIcon}
          collapsible
        >
          <OsInput ... />
          <OsToggle ... />
        </SectionBar>

        <SectionBar
          id="playback"
          label="Reproducción"
          description="Calidad, subtítulos, buffer, codec"
          icon={PlayIcon}
          collapsible
        >
          <OsSelect ... />
          <OsToggle ... />
        </SectionBar>
      </form>
    </div>
  </main>
</div>
```

---

## 5. Componentes Canónicos (actualizados)

### 5.1 SectionBar → Reemplaza `SettingsSection` + `SettingsCard`

| Antes | Ahora |
|---|---|
| `SettingsSection` (collapsible) | `<SectionBar collapsible>` |
| `SettingsCard` (estático) | `<SectionBar>` (sin `collapsible`) |
| `divide-y divide-white/[0.08]` | `.sectionbar-divide` en children |

### 5.2 Filas: OsToggle / OsSelect / OsInput (sin cambios)

Fila base: `flex flex-col sm:flex-row sm:items-center justify-between px-5 py-4 gap-4 hover:bg-white/[0.04]`. Label `text-xs font-bold text-on-surface tracking-tight`, desc `text-[11px] text-on-surface-variant/70 font-medium`. Icono de fila `w-7 h-7 rounded-lg bg-white/[0.06] border border-white/20 border-t-white/30 text-on-surface-variant`.

### 5.3 Segmented Control (modos / presets / tabs inferiores Home)

Contenedor `flex items-center gap-1 bg-zinc-950/40 border border-white/20 border-t-white/40 border-b-white/10 p-1.5 rounded-full` (usa SectionBar border tokens). Botón `relative flex-1 px-4 py-2 rounded-full text-xs font-semibold`, activo `text-zinc-950 font-bold` + indicador `layoutId` único (`motion.div bg-white/95 rounded-full shadow-[0_2px_14px_rgba(255,255,255,0.4),inset_0_1px_1px_rgba(255,255,255,1)]`, spring `480/34`).

### 5.4 Navegación por Pilares (sidebar desktop + pills móvil)

Igual que v4, pero contenedor sidebar usa `.sectionbar` en lugar de estilos inline.

### 5.5 Header de Contenido + Búsqueda

Igual que v4.

### 5.6 Floating Save Bar

Igual que v4.

### 5.7 Estados: Error / Vacío / Skeleton / Carga Tab

- **Skeleton**: Debe espejar `SectionBar` y el layout exacto: `sectionbar rounded-2xl bg-surface-container animate-pulse`. En Home, espeja el hero `rounded-3xl bg-surface-container`, selector de eras `h-9 w-24` y pósteres `aspect-[2/3] rounded-2xl`.
- **Empty State y Error Banner**: Usar layout inmersivo `flex min-h-[100dvh] items-center justify-center -mt-20 px-4` con `motion.div` (`initial={{opacity:0,scale:0.95,y:20}} animate={{opacity:1,scale:1,y:0}}`, spring `320/28/0.8`), tarjeta `.glass-card rounded-3xl p-8 border border-[var(--glass-border-side)]` y botón CTA `bg-brand-accent rounded-full font-display tracking-widest active:scale-95 hover:brightness-110 shadow-[var(--shadow-brand-primary)]`.

### 5.8 Suite Cinematográfica MediaSpotlight (Patrón Oro Home)

Ubicación: `components/ui/media-spotlight.tsx` y `components/ui/spotlight/*`. Es la referencia canónica para vistas cinematográficas inmersivas (Home, Series detail, Películas destacadas).

#### 1. `MediaSpotlight` (Orquestador Inmersivo)
Orquesta dinámicamente la transición entre eras, sincronizando el hero superior, la barra de navegación magnética y el catálogo inferior.

#### 2. `SpotlightHero` (Hero Cinematográfico)
- **Dimensiones fluidas**: `w-full aspect-[16/9] sm:aspect-[2.2/1] lg:aspect-[2.5/1] max-h-[440px] rounded-3xl overflow-hidden`.
- **Backdrop multicapa con ultra-blur**: `getLowResImage(url)` con `filter: blur(72px) saturate(140%)`, máscara radial `ellipse 90% 80% at 70% 40%` y `opacity: 0.28`.
- **Aura reactiva de la Era**: Gradiente radial pulsante `radial-gradient(ellipse, color-mix(in srgb, ${colors.accent} 50%, transparent) 0%, transparent 70%)` animado con `scale [1, 1.08, 1]` y `opacity [0.25, 0.4, 0.25]` (ciclo continuo de 8s).
- **Efecto Ken Burns / Parallax**: Hook `useHeroParallax(0.15)` ejecutado condicionalmente solo si el hardware lo soporta (`isHeavyAllowed && !reduceMotion`).
- **Transición fluida de Era**: `AnimatePresence mode="wait"` con `motion.div key={eraId}`:
  `initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 1, ease: "easeOut" }}`.

#### 3. `SpotlightEraNav` (Pills de Navegación de Eras)
- **Contenedor**: `flex items-center gap-2 bg-surface-container-high/75 border border-outline-variant/30 rounded-2xl p-2 overflow-hidden`.
- **Indicador activo**: `layoutId="activeEraIndicator"` con spring de física `stiffness: 480, damping: 34` (o envoltorio `MagneticIndicator`), fondo `bg-white/95 text-zinc-950`.
- **Micro-interacción Hover**: `scale: 1.012, x: 4`, stagger de entrada `delay: 0.06 * idx + 0.18`, spring `380/32`.
- **Auto-rotación inteligente (8000ms)**: Cadencia fija que se suspende de forma reactiva ante:
  1. Hover o foco activo del usuario (`hover/focus`).
  2. Pestaña oculta en segundo plano (`document.visibilityState === "hidden"`).
  3. Pérdida de foco en ventana (`!document.hasFocus()`).
  4. Reducción de movimiento solicitada por el usuario (`prefers-reduced-motion`).
  5. Catálogo con solo 1 era disponible (`availableEras.length <= 1`).

#### 4. `SpotlightLowerHub` (Segmented Control y Grids)
- **Segmented Control de Modo**: Selector de vistas con `bg-zinc-950/40 border border-white/20 border-t-white/40 border-b-white/10 p-1.5 rounded-full`. Botón activo con `layoutId` único y resplandor sutil.
- **Grids de Catálogo**: `grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3.5`.
- **Cards y Pósteres**: `aspect-[2/3] rounded-2xl` con badge `SPECIAL / OVA / PELÍCULA`.
- **Integración con SectionBar**: Cuando se usan dentro de `SectionBar`, optar por `variant="minimal"` para mantener el aspecto edge-to-edge sin saturar con doble caja.

#### 5. Helpers y Hooks Canónicos
- `useHeroParallax(intensity)`: Manejo de inclinación e inercia óptica por cursor/scroll.
- `useHeroBackdrop(url)`: Carga progresiva y blur optimizado del póster de fondo.
- `useSpring(stiffness, damping, mass)`: Factoría de resortes física respetuosa con `prefers-reduced-motion`.
- `getEraFromItem(item)` y `ERA_COLOR_MAP`: Mapeo estricto del universo Dragon Ball / Z / GT / Super / Daima a paletas semánticas vivas.

---

## 6. Transiciones Entre Tabs

`AnimatePresence mode="wait" initial={false}` + `motion.div key={activeTab} initial{opacity:0,y:16,filter:blur(8px)} animate{1,0,0} exit{0,-14,blur(8px)} spring 280/28/0.9`. `Suspense` por tab + prewarm en `requestIdleCallback` (timeout 1500, fallback `setTimeout 200`).

---

## 7. Búsqueda Local (`SettingsFilter`)

Filtrar por `keywords` por sección; helper `matchesSettingsQuery` (tokens AND, case-insensitive). `NoSettingsResults`: `p-6 rounded-2xl border-dashed border-white/10`, título `text-xs font-bold`, subtítulo `text-[11px]`.

---

## 8. Checklist al Mejorar un Apartado

1. ¿Shell correcto (home cinematográfico vs. sidebar+header de ajustes)?
2. ¿Contenedor `page-container`, espaciados `py-7 pb-32 space-y-9` / `space-y-7`?
3. ¿**Todas las secciones usan `SectionBar`** (`variant="default" | "strong" | "minimal"`, `collapsible` si aplica)?
4. ¿Pósteres, banners y miniaturas tienen **aspect-ratio o dimensiones reservadas** (`aspect-[2/3]`, `aspect-video`, `min-h-*`) para evitar *layout shifts* con `height: "auto"`?
5. ¿Catálogos cinematográficos edge-to-edge usan `variant="minimal"` para evitar encajonamientos rígidos innecesarios?
6. ¿Pills/tabs con `layoutId` + spring, iconos `w-7/w-8`, tipografías `text-xs / text-[11px]`?
7. ¿Tokens SectionBar (nada hardcodeado), blur en una sola capa, `no-scrollbar` en scroll interno?
8. ¿Skeleton espeja SectionBar (`sectionbar rounded-2xl bg-surface-container animate-pulse`) o `MediaSpotlight`, Error/Empty con CTA, SaveBar flotante si hay formulario?
9. ¿`prefers-reduced-motion`, touch 44px, `aria-pressed`/`role=switch`, `scroll-mt-28`?
10. ¿Modo `[data-flat]` y `[data-liquid]` respetados en SectionBar?

---

## 9. Anti-patrones (rechazar)

- Radios arbitrarios · sombras inline · `bg-black` opaco en body · blur por fila · animar `width` por JS (usar `animate-hero-progress`) · tabs sin `layoutId` (parpadeo) · texto sin `text-on-surface*` (rompe eras) · buscador sin `SettingsFilter`+keywords · **SectionBar sin tokens** (usar clases inline) · **mezclar SettingsCard/SettingsSection sin migrar a SectionBar** · **imágenes sin aspect-ratio fijo en colapsables** (provocan tirones y saltos de altura) · **encajonar cuadrículas de pósteres con SectionBar default rígido** cuando se requiere un look inmersivo edge-to-edge (usar `variant="minimal"`).

---

## 10. Migración Plan (v4 → v5)

| Archivo | Acción |
|---|---|
| `tokens/shadows.css` | Añadir `--sectionbar-*` tokens y flat mode overrides |
| `tokens/colors.css` | Añadir `--sectionbar-border*` y `--sectionbar-bg*` |
| `globals.css` / `app.css` | Añadir `.sectionbar`, `.sectionbar-strong`, `.sectionbar-minimal`, `.sectionbar-divide`, `.sectionbar-header*` con `-webkit-backdrop-filter` |
| `components/ui/sectionbar/` | **Crear / Consolidar** componente canónico con variantes `default`, `strong`, `minimal` y prevención de layout shifts |
| `routes/settings/components.tsx` | **Deprecar** `SettingsSection` / `SettingsCard` → reexportar `SectionBar` |
| `routes/home/index.tsx` | Envolver grids catálogo en `<SectionBar variant="minimal">` o `variant="default"` |
| `components/ui/media-spotlight.tsx` | Suite inmersiva canónica (`SpotlightHero`, `SpotlightEraNav`, `SpotlightLowerHub`) |
| `routes/movies/*`, `routes/series/*`, `routes/admin/*` | Usar `SectionBar` en shell estructurado |
| `home.components.tsx` | `ErrorBanner` / `EmptyState` / `HomeSkeleton` → usar `.sectionbar` en skeleton |

---

## 11. Referencia Visual: SectionBar Anatomy

```
┌─────────────────────────────────────────────────────────────┐
│  ██████████████████████████████████████████████████████████  │  ← border-top: white/35 (rim highlight)
│  █  [Icon]  TÍTULO SECCIÓN        [Badge]        ▼/▲      █  │  ← .sectionbar-header (px-1)
│  █  Descripción opcional en 11px, on-surface-variant/70   █  │
├─────────────────────────────────────────────────────────────┤  ← divide-white/[0.06] (si collapsible abierto)
│  █  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐       █  │  ← Contenido (grid, filas, etc.)
│  █  │  Card   │ │  Card   │ │  Card   │ │  Card   │       █  │
│  █  └─────────┘ └─────────┘ └─────────┘ └─────────┘       █  │
│  ██████████████████████████████████████████████████████████  │  ← border-bottom: white/10 (rim sutil)
└─────────────────────────────────────────────────────────────┘
  ↑ rounded-2xl
  ↑ bg: zinc-950/40 + blur-overlay-2xl + saturate-190%
  ↑ shadow: inset 0 1px 1px white/20 + 0 12px 36px -6px black/75
  ↑ border-left/right: white/15
```

**Variante `strong`**: bordes +10% opacidad, bg zinc-950/55, sombra +4px blur +8px spread.

---

## 12. **Kinetics — Spring Physics Interactions (Extracción Curada)**

Fuente: [kinetics.colorion.co](https://kinetics.colorion.co) — 153 interacciones spring-driven (CSS/React/AI prompt), MIT, zero-deps.

> **Regla:** No instalar la librería. **Copiar el patrón**, tokenizar colores/tokens KameHouse, envolver en `components/ui/kinetics/`.

### 12.1 Mapeo Necesidad KameHouse → Componente Kinetics

| Necesidad KameHouse | Componente Kinetics | Spring Config | Wrapper Target |
|---------------------|---------------------|---------------|----------------|
| **Era pills (Home)** | `magnet(0.35)` Magnetic Button / `glide(0.4s)` Tab Pill Glide | `stiffness:480 damping:34` | `MagneticIndicator` |
| **Seek bar (Player)** | `rubber(0.32)` Rubber-band Slider / `drag·1px=1` Value Scrubber | `stiffness:380 damping:30` | `RubberSlider` |
| **Swipe actions (Episodios)** | `swipe(-96px)` Swipe to Reveal | `stiffness:340 damping:28` | `SwipeReveal` |
| **Reorder (Playlists/Colas)** | `reorder(y-axis)` Reorderable List | `stiffness:280 damping:28` (glide) | `ReorderList` |
| **Hold-to-confirm (Destructivo)** | `hold(800ms)` Hold to Confirm | Linear fill + spring release | `HoldConfirm` |
| **Ripple en CTA Play** | `decay(600ms)` Ripple Feedback | `cubic-bezier(0.18,1.25,0.4,1)` | `RippleFeedback` |
| **Magnetic hover (Sidebar)** | `magnet(0.35)` / `lerp(0.18)` Pointer Tooltip | `0.15s ease-out` | `MagneticHover` |
| **Number counter (Stats)** | `spring(280,18)` Number Counter | `stiffness:280 damping:18` | `ElasticCounter` |

### 12.2 Estructura de Wrappers

```
apps/web/src/components/ui/kinetics/
├── magnetic-indicator.tsx      # Era pills — indicator magnético con layoutId
├── rubber-slider.tsx           # Seek bar — rubber-band + snap-back
├── swipe-reveal.tsx            # Episode rows — swipe left actions
├── reorder-list.tsx            # Playlists/Queue — drag handle reorder
├── hold-confirm.tsx            # Destructive actions — SVG ring progress
├── ripple-feedback.tsx         # Play CTA — radial burst from click point
├── magnetic-hover.tsx          # Sidebar pills — subtle magnetic pull
├── elastic-counter.tsx         # Stats — bump spring on increment
├── index.ts
└── hooks/
    ├── use-spring.ts           # useSpring unificado (respeta reduced-motion)
    ├── use-magnetic.ts         # Magnetic pull calculation
    ├── use-rubber-band.ts      # Rubber-band clamp logic
    ├── use-swipe.ts            # Swipe threshold + spring back
    ├── use-reorder.ts          # Drag-to-reorder with glide
    ├── use-hold.ts             # Hold timer + ring progress
    ├── use-ripple.ts           # Ripple spawn/cleanup
    └── use-reduced-motion.ts   # Wrapper useReducedMotion
```

### 12.3 Reglas de Adaptación (Obligatorias)

```tsx
// ❌ NO: Hardcoded colors, GSAP, fixed durations
const spring = { stiffness: 320, damping: 24 }; // Kinetics default
style={{ background: '#FF8A00', transition: 'transform 0.5s cubic-bezier(0.34,1.56,0.64,1)' }}

// ✅ SÍ: Tokens KameHouse, framer-motion, useReducedMotion
import { useSpring, useReducedMotion } from '@/components/ui/kinetics/hooks';

function MagneticIndicator({ children, activeIndex, onChange }) {
  const prefersReduced = useReducedMotion();
  const spring = useSpring(480, 34); // Era pills: stiffness:480 damping:34
  
  return (
    <motion.div
      layoutId="activeEraIndicator"
      style={{
        background: 'var(--sectionbar-border-top)', // white/35 rim
        color: 'var(--md-sys-color-on-surface)',
      }}
      transition={prefersReduced ? { type: 'tween', duration: 0.15 } : spring}
    >
      {children}
    </motion.div>
  );
}
```

| Regla | Implementación |
|-------|----------------|
| **Colores** | Solo `var(--brand-accent)`, `var(--sectionbar-border-top)`, `var(--md-sys-color-on-surface)`, `var(--on-surface-variant-rgb)` |
| **Springs** | `useSpring(480,34)` tabs/indicator, `useSpring(380,30)` entrada, `useSpring(280,28)` contenido |
| **Reduced motion** | `useReducedMotion()` → devuelve `{ type: 'tween', duration: 0.15 }` |
| **Touch targets** | `min-height: 44px`, `min-width: 44px` (globals.css ya lo fuerza) |
| **Layout shift** | Zero-JS layout donde sea posible (CSS `grid-auto-flow: dense`, `transition: left/width`) |
| **Cleanup** | `onPointerUp`/`onMouseLeave` siempre resetean transforms |

### 12.4 Springs Canónicos KameHouse (Unificar con Kinetics)

| Uso | Spring Config | Kinetics Equivalente |
|-----|---------------|---------------------|
| **Entrada global** | `stiffness:380 damping:30 mass:0.8` | `spring(320,24)` → ajustar a 380/30 |
| **Tabs/Indicator** | `stiffness:480 damping:34` | `glide(0.4s)` → `cubic-bezier(0.65,0,0.35,1)` ≈ 480/34 |
| **Contenido tabs** | `stiffness:280 damping:28` | `spring(280,18)` → ajustar damping a 28 |
| **Hover cards** | `whileHover={{scale:1.012}}` | `magnet(0.35)` pull factor |
| **Active press** | `active:scale-95` | `press(60ms)` → `scale(0.88)` → ajustar a 0.95 |
| **Stagger** | `0.06 * index` | `stagger spring` → mismo delay |

### 12.5 Checklist por Wrapper

- [ ] Props tipadas (`onChange`, `onConfirm`, `threshold`, `springConfig?`)
- [ ] `useReducedMotion()` integrado → `tween` fallback
- [ ] Colores via CSS variables (ningún hex/rgba inline)
- [ ] `layoutId` en indicadores animados (FLIP)
- [ ] Keyboard support (Arrow keys, Home/End, Enter/Space)
- [ ] Touch/swipe support (pointer events)
- [ ] Tests: reduced-motion, keyboard, touch, RTL
- [ ] Storybook/preview en `routes/__preview__/kinetics-*`

---

## 13. Migración Plan Actualizado (v5 → v5.1 Kinetics)

| Archivo | Acción |
|---------|--------|
| `components/ui/kinetics/` | **Crear** wrappers + hooks (tabla 12.2) |
| `components/ui/spotlight/spotlight-era-nav.tsx` | Migrar a `MagneticIndicator` + `layoutId="activeEraIndicator"` |
| `components/ui/player/seek-bar.tsx` (crear) | Usar `RubberSlider` |
| `components/ui/episode/episode-row.tsx` (crear) | Usar `SwipeReveal` |
| `components/ui/playlist/reorder-list.tsx` (crear) | Usar `ReorderList` |
| `components/ui/dialogs/confirm-delete.tsx` | Usar `HoldConfirm` |
| `components/ui/media-spotlight.tsx` (Play CTA) | Usar `RippleFeedback` |
| `components/ui/app-layout/app-topnav.tsx` (sidebar pills) | Usar `MagneticHover` |
| `components/ui/stats/elastic-counter.tsx` (crear) | Usar `ElasticCounter` |

---

*Documento vivo — actualizar tras cada PR que toque UI. Fuente de verdad: `routes/home/` + `routes/settings/` + `components/ui/sectionbar.tsx` + `components/ui/kinetics/`.*