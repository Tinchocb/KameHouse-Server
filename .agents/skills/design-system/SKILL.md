---
name: design-system
description: Aplicar el sistema de diseño KameHouse (Home + Ajustes) al mejorar cualquier apartado. Usar cuando se retoque una vista existente o se cree una nueva.
---

# KameHouse Design System Skill

Fuente canónica: `docs/DESIGN-GUIDE.md`. Patrones oro: `apps/web/src/routes/home/` + `apps/web/src/routes/settings/`. Tokens: `apps/web/src/styles/tokens/*.css`.

## Workflow obligatorio

### 1. Diagnóstico (regla .agents/rules/communication.md)
Antes de tocar código: causa raíz técnica + plan de acción. Inspeccionar la vista objetivo y compararla contra la guía.

### 2. Elegir shell
- **Cinematográfico** (Home / Movies / Series / vistas inmersivas): `relative min-h-screen text-on-surface overflow-x-hidden` + `z-10 flex flex-col`. Hero: `w-full aspect-[16/9] sm:aspect-[2.2/1] lg:aspect-[2.5/1] max-h-[440px] rounded-3xl`. Grid catálogo: `grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3.5`, posters `aspect-[2/3] rounded-2xl`. Contenedor interno: `px-4 sm:px-6 md:px-8 lg:px-10 max-w-content mx-auto`.
- **Estructurado** (Ajustes / Admin / vistas con sidebar): `flex flex-col md:flex-row h-full w-full pt-16 md:pt-0 overflow-hidden bg-transparent`, sidebar `hidden md:flex md:w-60 lg:w-[280px] shrink-0 border-r border-white/20 bg-zinc-950/40 backdrop-blur-overlay-2xl`, header `px-6 sm:px-8 lg:px-10 pt-20 pb-5 border-b border-white/10`, contenido `page-container py-7 pb-32 space-y-9`.

### 3. Reglas Home (Cinematográfico) — continuar el diseño
**Estructura de página**
- Wrapper raíz: `<div className="relative min-h-screen text-on-surface overflow-x-hidden"><div className="relative z-10 flex flex-col">...</div></div>`
- Secciones en `space-y-4` (no `space-y-9` como en Ajustes)
- Padding superior: `pt-4 md:pt-20 pb-8` (hero alto en desktop)
- **Nunca** `bg` opaco en contenedores; el fondo vive en `html` + `DynamicBackdrop` en `-z-10`

**Hero cinematográfico**
- `aspect-[16/9] sm:aspect-[2.2/1] lg:aspect-[2.5/1] max-h-[440px] rounded-3xl overflow-hidden`
- Backdrop: `getLowResImage(url)` + `filter: blur(72px) saturate(140%)` + máscara radial `ellipse 90% 80% at 70% 40%` + `opacity: 0.28`
- Aura de color (era): `radial-gradient(ellipse, color-mix(in srgb, ${colors.accent} 50%, transparent) 0%, transparent 70%)` animado `scale [1,1.08,1] opacity [0.25,0.4,0.25]` 8s infinite
- Ken Burns / parallax: `useHeroParallax(0.15)` solo si `isHeavyAllowed && !reduceMotion`
- Transición de era: `AnimatePresence mode="wait"` + `motion.div key={eraId}` con `initial={{opacity:0,scale:0.96}} animate={{opacity:1,scale:1}} exit={{opacity:0}} transition={{duration:1,ease:"easeOut"}}`

**Navegación de eras (pills horizontal)**
- Contenedor: `flex items-center gap-2 bg-surface-container-high/75 border border-outline-variant/30 rounded-2xl p-2 overflow-hidden`
- Pill: `relative flex-1 px-3 py-1.5 rounded-xl text-xs font-semibold`, activo con `layoutId="activeEraIndicator"` + spring `480/34`, `bg-white/95 text-zinc-950`
- Hover: `scale:1.012 x:4`, stagger entrada `delay: 0.06*idx + 0.18`, spring `380/32`
- `prefers-reduced-motion` → tween 150ms

**Lower Hub (Sagas / Películas)**
- Segmented control: `flex items-center gap-1 bg-zinc-950/40 border border-white/20 border-t-white/40 border-b-white/10 p-1.5 rounded-full`
- Botón: `relative flex-1 px-4 py-2 rounded-full text-xs font-semibold`, activo con `layoutId` único + indicador `motion.div bg-white/95 rounded-full shadow-[0_2px_14px_rgba(255,255,255,0.4),inset_0_1px_1px_rgba(255,255,255,1)]`
- Grid sagas: `grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3.5`, cards `aspect-[2/3] rounded-2xl`
- Grid películas: mismo, badges `SPECIAL/OVA` filtrados por toggle

**Auto-rotación de eras**
- Cadencia fija 8000ms, pausa en: `hover/focus`, `document.visibilityState === hidden`, `!document.hasFocus()`, `reduceMotion`, `availableEras.length <= 1`
- Dirección del slide calculada por índice (`delta >= 0 ? 1 : -1`)

**Motion / Springs**
- Entrada global: `stiffness:380 damping:30 mass:0.8` (useSpring)
- Tabs/eras: `stiffness:480 damping:34` (indicador), `stiffness:280 damping:28` (contenido)
- Hover cards: `whileHover={{scale:1.012}}`, `active:scale-95`
- Stagger: `0.06 * index`

**Estados (Home)**
- Skeleton: espeja `MediaSpotlight` exacto — `page-container space-y-4 animate-pulse`, hero `aspect-[16/9]...rounded-3xl bg-surface-container`, barra eras `h-9 w-24`, grid `aspect-[2/3] rounded-2xl`
- Error/Empty: `flex min-h-[100dvh] items-center justify-center -mt-20 px-4` + `motion.div initial={{opacity:0,scale:0.95,y:20}} animate={{opacity:1,scale:1,y:0}} transition={useSpring(320,28,0.8)}` + `glass-card rounded-3xl p-8 border border-[var(--glass-border-side)]` + CTA `bg-brand-accent rounded-full font-display tracking-widest active:scale-95 hover:brightness-110 shadow-[var(--shadow-brand-primary)]`

### 4. Mapear a componentes canónicos
Reutilizar `SectionBar` (`components/ui/sectionbar`): contenedor unificado canónico para secciones colapsables y estáticas (`variant="default" | "strong" | "minimal"`, `.sectionbar-divide` para hijos, header `w-8 h-8 rounded-xl bg-brand-accent/10`, título `text-xs font-black uppercase font-mono`). Filas de formulario reutilizables: `OsToggle` / `OsSelect` / `OsInput` (`px-5 py-4`, label `text-xs font-bold`, desc `text-[11px]`, controles pill `rounded-full bg-zinc-950/40 border-white/20`), `SettingsFilter` + keywords para búsqueda, segmentados con `layoutId` + spring `480/34`, SaveBar flotante `fixed bottom-20 md:bottom-8 shadow-elevation-3`. Todo elemento dentro de un `SectionBar` colapsable DEBE tener aspect-ratio reservado para evitar layout shift durante el cálculo de altura.

Componentes Home reutilizables (`components/ui/media-spotlight.tsx` + `components/ui/spotlight/*`):
- `MediaSpotlight` (orquesta eras, hero, hub)
- `SpotlightEraNav` (pills horizontales con layoutId)
- `SpotlightHero` (backdrop, parallax, Ken Burns, acciones)
- `SpotlightLowerHub` (segmented + grids sagas/películas)
- Helpers: `useHeroParallax`, `useHeroBackdrop`, `useSpring`, `getEraFromItem`, `ERA_COLOR_MAP`

### 5. Tokens y motion
Nada hardcodeado: colores `on-surface*`/`brand-accent`/`--era-*-hex`, radios solo de escala (pill / xl / 2xl / 3xl), sombras `elevation-*` o `shadow-[var(--shadow-brand-primary)]` / `shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.3),0_12px_36px_-6px_rgba(0,0,0,0.85)]`, un blur por panel (`backdrop-blur-overlay-2xl` / `md`). Transición de tabs: `AnimatePresence mode="wait"` + `motion.div key` (`opacity 0→1, y 16→0, blur 8px→0`, spring `280/28`). `active:scale-95`, `whileHover 1.012`, stagger `0.06*idx`.

### 6. Estados y verificación
Skeleton espeja layout (`animate-pulse`, `bg-surface-container`). Error/Vacío: `min-h-[100dvh] -mt-20` + `SharedEmptyState` con CTA `bg-brand-accent rounded-full font-display tracking-widest`. Verificar: `page-container`, `no-scrollbar` en scroll interno, `scroll-mt-28`, touch 44px, `aria-pressed`/`role=switch`, `prefers-reduced-motion`, sin radios/sombras arbitrarias, sin `bg` opaco en body, `layoutId` en todos los indicadores animados.

## Anti-patrones (rechazar)
Hex fijos · `shadow-lg` genérico · blur por fila · animar width por JS (usar `animate-hero-progress` CSS) · tabs sin `layoutId` · texto fuera de `on-surface*` · buscador sin keywords · `bg-black`/`bg-zinc-900` opaco en contenedores (tapa DynamicBackdrop) · múltiples blurs apilados · skeleton que no espeja layout real · CTA sin `active:scale-95` · spring genérico sin `useReducedMotion`.
