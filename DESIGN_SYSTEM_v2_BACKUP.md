# KameHouse Design System v2

Sistema visual premium para plataforma de streaming inspirado en Apple TV+, VisionOS, Plex, Arc Browser, Material 3 y Netflix.

## 🎨 Tokens Fundamentales

### Colores

#### Fondos Base (Más oscuros, inmersivos)
```css
--bg-primary:     #040404;  /* Background principal */
--bg-secondary:   #080808;  /* Surface 1 - panels, cards */
--bg-tertiary:    #0d0d0d;  /* Surface 2 - cards anidados, inputs */
--bg-quaternary:  #141414;  /* Surface 3 - tooltips, dropdowns */
```

#### Glassmorphism
```css
--glass-bg:       rgba(255,255,255,0.04);
--glass-border:   rgba(255,255,255,0.08);
--glass-hover:    rgba(255,255,255,0.10);
--glass-strong:   rgba(255,255,255,0.12);
```

#### Texto
```css
--text-primary:   #F5F5F5;
--text-secondary: rgba(255,255,255,0.72);
--text-muted:     rgba(255,255,255,0.48);
--text-disabled:  rgba(255,255,255,0.28);
```

#### Era Colors — Dragon Ball
```css
/* DB Clásico - Azul Kame */
--color-db:       #0096E6;
--glow-db:        rgba(0,150,230,0.40);

/* DBZ - Naranja Saiyajin */
--color-dbz:      #E85D2E;
--glow-dbz:       rgba(232,93,46,0.40);

/* DBGT - Rojo SSJ4 */
--color-dbgt:     #D32F2F;
--glow-dbgt:      rgba(211,47,47,0.40);

/* DBS - Celeste Ultra Instinto */
--color-dbs:      #00D4D4;
--glow-dbs:       rgba(0,212,212,0.40);

/* DB Daima - Violeta Reino Demonio */
--color-daima:    #9333EA;
--glow-daima:     rgba(147,51,234,0.40);
```

#### Alias Semánticos (usar en componentes)
```css
--brand-primary:      var(--color-db);       /* Primario: Azul DB */
--brand-secondary:    var(--color-dbz);      /* Secundario: Naranja DBZ */
--brand-destructive:  var(--color-dbgt);     /* Destructivo: Rojo GT */
--brand-success:      var(--color-dbs);      /* Éxito: Celeste DBS */
--brand-magic:        var(--color-daima);    /* Mágico/Nuevo: Violeta Daima */
```

#### Temas
```css
[data-theme="amoled"] { --bg-primary: #000000; --glass-bg: rgba(255,255,255,0.03); }
[data-theme="cyberpunk"] { --brand-primary: var(--color-dbs); --glass-border: var(--glow-dbs); }
```

---

### Espaciado (Base 4px)
```css
--space-0: 0; --space-1: 4px; --space-2: 8px; --space-3: 12px; --space-4: 16px;
--space-5: 20px; --space-6: 24px; --space-8: 32px; --space-10: 40px; --space-12: 48px;
--space-16: 64px; --space-20: 80px; --space-24: 96px; --space-32: 128px;
```

Alias semánticos: `--space-xs` (4px), `--space-sm` (8px), `--space-md` (16px), `--space-lg` (24px), `--space-xl` (32px), `--space-2xl` (48px), `--space-3xl` (64px).

---

### Radios (SOLO estos valores)
```css
--radius-xs: 4px;    /* badges, chips */
--radius-sm: 8px;    /* botones, inputs */
--radius-md: 12px;   /* cards pequeñas, dropdowns */
--radius-lg: 16px;   /* cards estándar, modales */
--radius-xl: 20px;   /* cards grandes, hero */
--radius-2xl: 24px;  /* panels, sidebars */
--radius-3xl: 32px;  /* hero banners */
--radius-full: 9999px; /* pills, avatars */
```

---

### Sombras (4 niveles semánticos)
```css
--shadow-card:      0 4px 16px -4px rgba(0,0,0,0.50), 0 0 0 1px rgba(255,255,255,0.04);
--shadow-elevated:  0 12px 32px -8px rgba(0,0,0,0.70), 0 0 0 1px rgba(255,255,255,0.06);
--shadow-modal:     0 24px 64px -12px rgba(0,0,0,0.85), 0 0 0 1px rgba(255,255,255,0.08);
--shadow-player:    0 32px 80px -16px rgba(0,0,0,0.95);
```

Brand glows: `--shadow-brand-primary`, `--shadow-brand-secondary`, etc.

---

### Blur (5 niveles)
```css
--blur-xs: 8px;   /* sutíl */
--blur-sm: 12px;  /* ligero */
--blur-md: 20px;  /* estándar */
--blur-lg: 30px;  /* fuerte */
--blur-xl: 40px;  /* máximo */
```

Alias: `--blur-card` (md), `--blur-navbar` (xl), `--blur-modal` (lg), `--blur-player` (xl).

---

### Tipografía

#### Font Stacks
```css
--font-sans: "Inter Variable", system-ui, sans-serif;
--font-display: "Bebas Neue", cursive;
--font-mono: "Space Mono", ui-monospace;
```

#### Escala Fluida (clamp)
```css
--text-xs: clamp(0.70rem, 0.65rem + 0.25vw, 0.75rem);
--text-sm: clamp(0.80rem, 0.75rem + 0.25vw, 0.875rem);
--text-base: clamp(0.95rem, 0.875rem + 0.375vw, 1rem);
--text-lg: clamp(1.05rem, 0.95rem + 0.5vw, 1.125rem);
--text-xl: clamp(1.2rem, 1.1rem + 0.5vw, 1.25rem);
--text-2xl: clamp(1.4rem, 1.25rem + 0.75vw, 1.5rem);
--text-3xl: clamp(1.7rem, 1.5rem + 1vw, 1.875rem);
--text-4xl: clamp(2rem, 1.75rem + 1.25vw, 2.25rem);
--text-5xl: clamp(2.5rem, 2rem + 1.5vw, 3rem);
--text-6xl: clamp(3rem, 2.5rem + 2vw, 3.75rem);
--text-7xl: clamp(3.75rem, 3rem + 2.5vw, 4.5rem);
--text-8xl: clamp(5rem, 4rem + 3vw, 6rem);
--text-9xl: clamp(6.5rem, 5rem + 4vw, 8rem);
```

#### Estilos Predefinidos
```css
--display-xl: var(--text-9xl) / var(--leading-none) var(--font-display) var(--weight-black);
--h1: var(--text-5xl) / var(--leading-tight) var(--font-display) var(--weight-extrabold);
--h2: var(--text-4xl) / var(--leading-tight) var(--font-display) var(--weight-extrabold);
--h3: var(--text-3xl) / var(--leading-snug) var(--font-display) var(--weight-bold);
--body-md: var(--text-base) / var(--leading-relaxed) var(--font-sans) var(--weight-normal);
--button-md: var(--text-sm) / var(--leading-none) var(--font-sans) var(--weight-semibold) var(--tracking-wider);
--badge: var(--text-xs) / var(--leading-none) var(--font-sans) var(--weight-bold) var(--tracking-widest);
```

---

### Animaciones

#### Duraciones
```css
--duration-instant: 50ms;
--duration-fast: 150ms;
--duration-base: 250ms;
--duration-slow: 400ms;
--duration-slower: 600ms;
--duration-slowest: 800ms;
```

#### Easings
```css
--ease-out: cubic-bezier(0, 0, 0.2, 1);
--ease-smooth: cubic-bezier(0.25, 0.1, 0.25, 1.0);
--ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
--ease-expo-out: cubic-bezier(0.16, 1, 0.3, 1);
```

#### Keyframes Reutilizables
```css
@keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
@keyframes slide-up { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
@keyframes scale-in { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
@keyframes shimmer { from { background-position: -200% 0; } to { background-position: 200% 0; } }
```

#### Clases Compuestas
```css
.animate-fade-in       { animation: fade-in var(--duration-base) var(--ease-out) both; }
.animate-slide-up      { animation: slide-up var(--duration-slow) var(--ease-smooth-out) both; }
.animate-scale-in      { animation: scale-in var(--duration-base) var(--ease-out) both; }
.animate-modal-enter   { animation: scale-in var(--duration-base) var(--ease-spring) both; }
.animate-page-enter    { animation: slide-up var(--duration-slower) var(--ease-expo-out) both; }
```

---

### Z-Index (Capas semánticas)
```css
--z-base: 0;
--z-dropdown: 100;
--z-sticky: 200;
--z-overlay: 300;
--z-modal: 400;
--z-popover: 500;
--z-toast: 600;
--z-tooltip: 700;
--z-navbar: 800;
--z-sidebar: 850;
--z-player: 10000;
--z-player-ui: 10010;
```

---

## 🧩 Componentes Base

### GlassCard
```tsx
<GlassCard 
  variant="default" | "elevated" | "interactive" | "popup" | "strong"
  padding="none" | "sm" | "md" | "lg" | "xl"
  radius="xs" | "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "full"
  blur="xs" | "sm" | "md" | "lg" | "xl"
  hover={boolean}
  onClick={fn}
>
  <GlassCardHeader>
    <GlassCardTitle>Título</GlassCardTitle>
    <GlassCardDescription>Descripción</GlassCardDescription>
  </GlassCardHeader>
  <GlassCardContent>Contenido</GlassCardContent>
  <GlassCardFooter>Acciones</GlassCardFooter>
</GlassCard>
```

### GlassButton
```tsx
<GlassButton
  variant="primary" | "secondary" | "destructive" | "success" | "magic" | "ghost" | "outline" | "glass"
  size="xs" | "sm" | "md" | "lg" | "xl"
  loading={boolean}
  leftIcon="icon-name"
  rightIcon="icon-name"
  fullWidth={boolean}
  onClick={fn}
>
  Texto
</GlassButton>

<IconButton
  variant="ghost"
  size="md"
  icon="close"
  aria-label="Cerrar"
  onClick={fn}
/>
```

### PosterCard
```tsx
<PosterCard
  artwork="url"
  title="Título"
  subtitle="Subtítulo"
  aspect="poster" | "landscape" | "square" | "ultrawide"
  progress={0-100}
  rating={0-10}
  year="2024"
  episodeNumber={1}
  badge="Nuevo"
  variant="default" | "continue-watching" | "featured" | "compact"
  onClick={fn}
/>

<PosterCarousel items={items} />
<PosterGrid items={items} columns={{base:2, sm:3, md:4, lg:5, xl:6}} />
```

### Navbar / Sidebar
```tsx
<Navbar transparent={true} floating={true} />
<Sidebar />  // Expand/Collapse con GSAP
```

### Modal
```tsx
<Modal
  isOpen={boolean}
  onClose={fn}
  title="Título"
  description="Descripción"
  size="sm" | "md" | "lg" | "xl" | "full"
  footer={<GlassButton onClick={fn}>Confirmar</GlassButton>}
>
  Contenido
</Modal>

<ConfirmModal isOpen={boolean} onClose={fn} onConfirm={fn} variant="destructive" />
<AlertModal isOpen={boolean} onClose={fn} variant="success" | "error" | "warning" | "info" />
```

---

## 📱 Responsive

### Breakpoints con Container Queries
```css
@container (min-width: 320px)  { /* Mobile */ }
@container (min-width: 768px)  { /* Tablet */ }
@container (min-width: 1024px) { /* Desktop */ }
@container (min-width: 1440px) { /* Wide */ }
@container (min-width: 1920px) { /* TV */ }
```

### Grid Swimlane (Carousel)
```css
.grid-swimlane {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}
@media (min-width: 640px) { grid-template-columns: repeat(3, minmax(0, 1fr)); }
@media (min-width: 1024px) { grid-template-columns: repeat(4, minmax(0, 1fr)); }
@media (min-width: 1440px) { grid-template-columns: repeat(5, minmax(0, 1fr)); }
@media (min-width: 1920px) { grid-template-columns: repeat(6, minmax(0, 1fr)); }
```

### Scroll Snap Carousel
```css
.scroll-snap-carousel {
  scroll-snap-type: x proximity;
  scroll-padding-inline: var(--space-4);
}
.scroll-snap-carousel > * {
  scroll-snap-align: start;
}
```

### TV Mode
- Focus visible: `ring-3` brand, `scale-1.03`, `shadow-brand`
- Área mínima: `44x44px`
- Navegación D-pad nativa

---

## ♿ Accesibilidad

### Contraste WCAG AA
- Brand primary sobre bg-primary: **4.5:1** ✓
- Texto secundario: **3:1** (large text) ✓

### Reducción de Movimiento
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

### Focus Visible
```css
*:focus-visible {
  outline: none;
  ring: 2px solid var(--focus-ring);
  ring-offset: 2px;
  ring-offset-color: var(--bg-primary);
}
```

### ARIA
- Modales: `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, `aria-describedby`
- Botones: `aria-label`, `aria-pressed`, `aria-disabled`
- Navegación: `aria-current="page"`
- Imágenes: `alt` descriptivo

### Navegación por Teclado
- Tab order lógico
- Focus trap en modales
- Skip links
- Escape para cerrar

---

## ⚡ Optimización

### CSS Variables Nativas
- Zero runtime: tokens como CSS custom properties
- Theming instantáneo sin recálculo
- Compatible con Tailwind via `hsl(var(--token))`

### Tree Shaking
- Iconos: wrapper tipado `Icons.navigation.home`
- Componentes: exports nombrados, sin barrel files innecesarios
- Tailwind: `safelist` solo para clases dinámicas

### Performance
```css
.gpu-accelerated { will-change: transform, opacity; transform: translateZ(0); }
.contain-layout { contain: layout style; }
```

### Eliminar Duplicados
- ❌ `liquid-glass-frosted*`, `brutalistStyles`, `cssUtils` (legacy)
- ❌ `MediaCard`, `SeriesCard`, `MovieCard`, `SpotlightMovieCard` → `PosterCard`
- ❌ Colores hardcoded en componentes → tokens semánticos

---

## 📝 Guía de Uso

### ✅ Hacer
- Usar tokens semánticos: `var(--brand-primary)`, `var(--space-md)`, `var(--radius-lg)`
- Componer con variantes: `variant="elevated"`, `size="lg"`
- Usar `GlassCard` + `GlassButton` + `PosterCard` como bloques base
- Animaciones con clases compuestas: `.animate-slide-up`, `.hover-lift`
- Container queries para layouts responsivos

### ❌ No Hacer
- **Negro puro** (`#000`) como background (excepto `data-theme="amoled"`)
- **Radios arbitrarios**: `13px`, `19px`, `27px` → usar escala `--radius-*`
- **Blur inventado**: `blur-[87px]` → usar escala `--blur-*`
- **Sombras inline** sin token: `box-shadow: 0 10px 30px...`
- **Duraciones mágicas**: `0.7s`, `350ms` → usar `--duration-*`
- **Colores hardcoded** en componentes: `bg-orange-500` → `bg-[var(--brand-secondary)]`
- **Múltiples variantes de botón** (usar 5 semánticas)
- **Valores magic** en `className`: `mt-14`, `gap-7`, `p-5.5`

---

## 🗂️ Estructura de Archivos

```
src/
├── styles/
│   ├── tokens/
│   │   ├── colors.css
│   │   ├── spacing.css
│   │   ├── radius.css
│   │   ├── shadows.css
│   │   ├── blur.css
│   │   ├── typography.css
│   │   ├── animation.css
│   │   └── z-index.css
│   ├── components/
│   │   ├── glass-card.css
│   │   ├── glass-button.css
│   │   ├── poster-card.css
│   │   ├── navbar.css
│   │   ├── sidebar.css
│   │   └── modal.css
│   └── pages/
│       ├── home.css
│       ├── series-detail.css
│       ├── player.css
│       ├── profile.css
│       └── admin.css
├── components/
│   ├── ui/
│   │   ├── glass-card/
│   │   ├── glass-button/
│   │   ├── poster-card/
│   │   ├── navbar/
│   │   ├── sidebar/
│   │   ├── modal/
│   │   └── icons/
│   └── video/
└── routes/
    ├── home/
    ├── series/
    ├── movies/
    ├── profile/
    └── admin/
```

---

## 🔄 Migración

### Rama de trabajo
```bash
git checkout -b feature/design-system-v2
```

### Orden
1. **Tokens** → `src/styles/tokens/`
2. **Componentes base** → `src/components/ui/`
3. **Home** → `src/routes/home/index.tsx`
4. **Detalles** → `src/routes/series/$seriesId/index.tsx`
5. **Player** → `src/components/video/player-*.tsx`
6. **Perfil/Admin** → `src/routes/profile/`, `src/routes/admin/`
7. **Limpieza** → Eliminar `globals.css` legacy, componentes obsoletos

### Verificación
```bash
# Lint
pnpm lint

# Typecheck
pnpm typecheck

# Build
pnpm build
```

---

## 📚 Referencias

- [Tailwind CSS v3](https://tailwindcss.com/docs)
- [Framer Motion](https://www.framer.com/motion/)
- [GSAP](https://gsap.com/docs/)
- [Radix UI](https://www.radix-ui.com/)
- [WCAG 2.1 AA](https://www.w3.org/WAI/WCAG21/quickref/)