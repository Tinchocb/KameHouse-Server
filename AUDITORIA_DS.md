# KameHouse — Design System Audit

> Complete inventory of every color, blur, radius, spacing, shadow, font, border, button, card, and animation currently in use. Each item is tagged: **KEEP** / **FIX** / **REMOVE** / **MIGRATE**.

---

## 1. Color Inventory

### Token Files (KEEP)
All defined in `apps/web/src/styles/tokens/colors.css`.

| Token | Value | Status |
|-------|-------|--------|
| `--bg-primary` | `#040404` | KEEP |
| `--bg-secondary` | `#080808` | KEEP |
| `--bg-tertiary` | `#0d0d0d` | KEEP |
| `--bg-quaternary` | `#141414` | KEEP |
| `--glass-bg` | `rgba(255,255,255,0.04)` | KEEP |
| `--glass-border` | `rgba(255,255,255,0.08)` | KEEP |
| `--glass-hover` | `rgba(255,255,255,0.10)` | KEEP |
| `--glass-strong` | `rgba(255,255,255,0.12)` | KEEP |
| `--text-primary` | `#F5F5F5` | KEEP |
| `--text-secondary` | `rgba(255,255,255,0.72)` | KEEP |
| `--text-muted` | `rgba(255,255,255,0.48)` | KEEP |
| `--text-disabled` | `rgba(255,255,255,0.28)` | KEEP |
| `--brand-primary` | `var(--color-db)` = `#0096E6` | KEEP |
| `--brand-secondary` | `var(--color-dbz)` = `#E85D2E` | KEEP |
| `--brand-destructive` | `var(--color-dbgt)` = `#D32F2F` | KEEP |
| `--brand-success` | `var(--color-dbs)` = `#00D4D4` | KEEP |
| `--brand-magic` | `var(--color-daima)` = `#9333EA` | KEEP |
| `--glow-db` | `rgba(0,150,230,0.40)` | KEEP |
| `--glow-dbz` | `rgba(232,93,46,0.40)` | KEEP |
| `--glow-dbgt` | `rgba(211,47,47,0.40)` | KEEP |
| `--glow-dbs` | `rgba(0,212,212,0.40)` | KEEP |
| `--glow-daima` | `rgba(147,51,234,0.40)` | KEEP |

### Hardcoded Colors in Components (FIX/MIGRATE)

| File | Line | Value | Should Be |
|------|------|-------|-----------|
| `media-card.tsx` | 109 | `bg-zinc-950/95` | `bg-[var(--bg-primary)]/95` |
| `media-card.tsx` | 115 | `bg-zinc-900/40` | `bg-[var(--glass-bg)]` |
| `media-card.tsx` | 157 | `bg-zinc-950/70` | `bg-[var(--bg-primary)]/70` |
| `media-card.tsx` | 167 | `bg-zinc-950/70` | `bg-[var(--bg-primary)]/70` |
| `media-card.tsx` | 176 | `bg-brand-orange` | `bg-[var(--brand-secondary)]` |
| `media-card.tsx` | 205 | `bg-zinc-950/90` | `bg-[var(--bg-primary)]/90` |
| `hero-banner.tsx` | 83 | `bg-zinc-950` | `bg-[var(--bg-primary)]` |
| `hero-banner.tsx` | 134-136 | `from-zinc-950`, `via-zinc-950/40` | `from-[var(--bg-primary)]`, `via-[var(--bg-primary)]/40` |
| `hero-banner.tsx` | 168 | `bg-gradient-to-r from-white via-zinc-100 to-zinc-400` | Token or keep (decorative) |
| `hero-banner.tsx` | 216 | `bg-zinc-900/40` | `bg-[var(--bg-secondary)]/40` |
| `app-sidebar.tsx` | 49 | `bg-zinc-950/60` | `bg-[var(--bg-primary)]/60` |
| `app-sidebar.tsx` | 221 | `bg-brand-orange/[0.06]` | `bg-[var(--brand-secondary)]/[0.06]` |
| `app-topnav.tsx` | 18 | `bg-zinc-950/60` | `bg-[var(--bg-primary)]/60` |
| `app-topnav.tsx` | 46 | `bg-zinc-950/80` | `bg-[var(--bg-primary)]/80` |
| `button.tsx` | 19 | `bg-white text-black` | `bg-[var(--text-primary)]` (legacy, remove) |
| `button.tsx` | 24 | `bg-zinc-800` | Legacy, remove |
| `card.tsx` | 11 | `liquid-glass-frosted` | Legacy class, remove |
| `styling.ts` | 35 | `#ff6e3a` | `var(--brand-secondary)` |
| `styling.ts` | 38 | `bg-surface-1/80` | Legacy, remove |

### Tailwind Config Colors (FIX)
`tailwind.config.ts` maps to HSL variables (`hsl(var(--primary))`), but the actual CSS variables are in HEX/RGBA format. This mismatch needs resolution.

| Config Key | Current | Fix |
|------------|---------|-----|
| `background` | `hsl(var(--background))` | Map to `var(--bg-primary)` |
| `foreground` | `hsl(var(--foreground))` | Map to `var(--text-primary)` |
| `primary` | `hsl(var(--primary))` | Map to `var(--brand-primary)` |
| `border` | `hsl(var(--border))` | Map to `var(--glass-border)` |
| `muted` | `hsl(var(--muted))` | Map to `var(--bg-tertiary)` |
| `card` | `hsl(var(--card))` | Map to `var(--bg-secondary)` |
| `surface-1` | `hsl(var(--surface-1))` | Map to `var(--bg-secondary)` |
| `surface-2` | `hsl(var(--surface-2))` | Map to `var(--bg-tertiary)` |

**Decision**: Replace HSL var() references in `tailwind.config.ts` with direct HEX/RGBA tokens, or migrate all tokens to HSL. Recommend: **keep HEX/RGBA tokens** (more readable) and update Tailwind config.

---

## 2. Blur Inventory

### Token Files (KEEP)
All defined in `apps/web/src/styles/tokens/blur.css`.

| Token | Value | Status |
|-------|-------|--------|
| `--blur-xs` | `8px` | KEEP |
| `--blur-sm` | `12px` | KEEP |
| `--blur-md` | `20px` | KEEP |
| `--blur-lg` | `30px` | KEEP |
| `--blur-xl` | `40px` | KEEP |

### Hardcoded Blur in Components (FIX)

| File | Line | Value | Should Be |
|------|------|-------|-----------|
| `app-sidebar.tsx` | 49 | `backdrop-blur-3xl` | `backdrop-blur-[var(--blur-sidebar)]` or `blur-lg` |
| `app-topnav.tsx` | 18 | `backdrop-blur-2xl` | `backdrop-blur-[var(--blur-navbar)]` or `blur-xl` |
| `app-topnav.tsx` | 46 | `backdrop-blur-3xl` | `blur-lg` |
| `app-topnav.tsx` | 24 | `backdrop-blur-xl` (mobile menu button) | `blur-md` |
| `hero-banner.tsx` | 216 | `backdrop-blur-md` | OK, matches `--blur-md` |
| `media-card.tsx` | 157 | `backdrop-blur-md` | OK |
| `media-card.tsx` | 167 | `backdrop-blur-md` | OK |
| `poster-card.tsx` | 152 | `backdrop-blur-xl` | OK, matches `--blur-xl` |
| `poster-card.tsx` | 195 | `backdrop-blur-sm` | OK |
| `glass-card.tsx` | 33-37 | `backdrop-blur-md`, `backdrop-blur-lg`, `backdrop-blur-xl` | OK (using blur prop) |
| `__root.tsx` | 88 | `backdrop-blur-xl` | Should use token |

**Note**: `glass-card.tsx` blur prop works correctly — it maps `xs/sm/md/lg/xl` to Tailwind classes. The issue is other components using arbitrary values instead of the token system.

---

## 3. Radius Inventory

### Token Files (KEEP)
All defined in `apps/web/src/styles/tokens/radius.css`.

| Token | Value | Usage |
|-------|-------|-------|
| `--radius-xs` | `4px` | badges, chips |
| `--radius-sm` | `8px` | buttons, inputs |
| `--radius-md` | `12px` | cards small, dropdowns |
| `--radius-lg` | `16px` | cards standard |
| `--radius-xl` | `20px` | cards large |
| `--radius-2xl` | `24px` | panels, sidebars |
| `--radius-3xl` | `32px` | hero banners |
| `--radius-full` | `9999px` | pills, avatars |

### Hardcoded Radius in Components (FIX)

| File | Line | Value | Should Be |
|------|------|-------|-----------|
| `app-sidebar.tsx` | 49 | `rounded-r-[32px]` | `rounded-r-[var(--radius-hero)]` or use token class |
| `media-card.tsx` | 111 | `rounded-2xl` | `rounded-[var(--radius-card)]` |
| `media-card.tsx` | 116 | `rounded-xl` | `rounded-[var(--radius-lg)]` |
| `hero-banner.tsx` | 183 | `rounded-xl` | `rounded-[var(--radius-card)]` |
| `hero-banner.tsx` | 216 | `rounded-full` | OK |
| `poster-card.tsx` | 154-155 | `rounded-2xl` | `rounded-[var(--radius-card)]` |
| `poster-card.tsx` | 158-159 | `rounded-xl` | `rounded-[var(--radius-lg)]` |
| `glass-button.tsx` | 99 | `rounded-button` | Custom class, should map to `--radius-button` |

**Note**: The CSS utility classes (`rounded-xs`, `rounded-sm`, etc.) in `radius.css` already map to tokens. The issue is components using Tailwind defaults (`rounded-xl`, `rounded-2xl`) instead.

---

## 4. Spacing Inventory

### Token Files (KEEP)
All defined in `apps/web/src/styles/tokens/spacing.css`. Base 4px scale.

### Hardcoded Spacing in Components (FIX)

| File | Line | Value | Should Be |
|------|------|-------|-----------|
| `home/index.tsx` | 316 | `px-6 md:px-14 lg:px-20` | Use `container-fluid` or token-based responsive |
| `home/index.tsx` | 353 | `px-6 md:px-14 lg:px-20` | Same |
| `hero-banner.tsx` | 139 | `px-8 pb-48 md:px-16` | Token-based responsive |
| `hero-banner.tsx` | 183 | `px-10 py-4` | `px-[var(--space-10)] py-[var(--space-5)]` |
| `series-detail` | various | Mixed `px-*` values | Standardize to token scale |

**Note**: Most spacing in components uses Tailwind's default scale (`px-6`, `gap-4`, etc.) which aligns with the 4px base. The inconsistency is in **which** scale values are chosen, not that they're wrong. The fix is to use the semantic aliases (`--space-sm`, `--space-md`, `--space-lg`) consistently.

---

## 5. Shadow Inventory

### Token Files (KEEP)
All defined in `apps/web/src/styles/tokens/shadows.css`.

| Token | Usage | Status |
|-------|-------|--------|
| `--shadow-card` | Cards, base elements | KEEP |
| `--shadow-elevated` | Hover states, dropdowns | KEEP |
| `--shadow-modal` | Modals, popovers | KEEP |
| `--shadow-player` | Fullscreen overlays | KEEP |
| `--shadow-brand-primary` | Brand glow primary | KEEP |
| `--shadow-brand-secondary` | Brand glow secondary | KEEP |
| `--shadow-brand-destructive` | Brand glow destructive | KEEP |
| `--shadow-brand-success` | Brand glow success | KEEP |
| `--shadow-brand-magic` | Brand glow magic | KEEP |
| `--glass-inner` | Glass depth effect | KEEP |
| `--glass-inner-strong` | Glass depth strong | KEEP |

### Hardcoded Shadows in Components (FIX)

| File | Line | Value | Should Be |
|------|------|-------|-----------|
| `media-card.tsx` | 109 | `shadow-[0_20px_50px_rgba(0,0,0,0.85)]` | `shadow-modal` |
| `media-card.tsx` | 115 | `shadow-md` | `shadow-card` |
| `media-card.tsx` | 157 | `shadow-md` | `shadow-card` |
| `media-card.tsx` | 176 | `shadow-lg` | `shadow-elevated` |
| `media-card.tsx` | 259 | `shadow-[0_0_8px_rgba(255,110,58,0.5)]` | `shadow-brand-secondary` |
| `hero-banner.tsx` | 183 | `shadow-[0_15px_30px_-5px_rgba(255,110,58,0.3)]` | `shadow-brand-secondary` |
| `hero-banner.tsx` | 216 | `shadow-2xl` | `shadow-modal` |
| `app-sidebar.tsx` | 49 | `shadow-[8px_0_32px_rgba(0,0,0,0.5)]` | Custom, add as `--shadow-sidebar` |
| `app-sidebar.tsx` | 221 | `shadow-[0_8px_32px_rgba(255,110,58,0.15)]` | `shadow-brand-secondary` |
| `glass-card.tsx` | 33-37 | `shadow-card`, `shadow-elevated`, `shadow-modal` | OK (using tokens) |

---

## 6. Typography Inventory

### Token Files (KEEP)
All defined in `apps/web/src/styles/tokens/typography.css`.

### Hardcoded Typography in Components (FIX)

| File | Line | Value | Should Be |
|------|------|-------|-----------|
| `media-card.tsx` | 189 | `font-bebas text-lg md:text-xl` | `text-h6` |
| `media-card.tsx` | 193 | `text-[9px] font-black uppercase tracking-[0.15em]` | `text-overline` or `text-badge` |
| `media-card.tsx` | 212 | `font-bebas text-xl md:text-2xl` | `text-h5` |
| `media-card.tsx` | 217 | `text-[10px] font-bold uppercase tracking-wider` | `text-label-md` |
| `media-card.tsx` | 248 | `text-[11px] leading-relaxed` | `text-body-xs` |
| `hero-banner.tsx` | 151 | `text-[10px] font-black uppercase tracking-[0.3em]` | `text-overline` |
| `hero-banner.tsx` | 168 | `text-[5.5rem] md:text-[8rem] lg:text-[10rem] xl:text-[11.5rem]` | `text-display-md` or `text-display-lg` |
| `hero-banner.tsx` | 173 | `text-lg leading-relaxed` | `text-body-lg` |
| `hero-banner.tsx` | 183 | `font-bebas text-xl uppercase tracking-wider` | `text-button-lg` |
| `app-sidebar.tsx` | 246 | `text-[10px] font-black uppercase tracking-[0.2em]` | `text-overline` |

---

## 7. Animation Inventory

### Token Files (KEEP)
All defined in `apps/web/src/styles/tokens/animation.css`.

### Animation Systems in Use

| System | Where Used | Status |
|--------|-----------|--------|
| **CSS classes** (`animate-fade-in`, `animate-slide-up`, etc.) | `globals.css` | KEEP |
| **Framer Motion** | `HeroBanner`, `HomePage`, `PageTransition`, modals | KEEP (for complex orchestration) |
| **GSAP** | `AppSidebar` (stagger, elastic), `SeriesDetail`, `CollectionDetail` | KEEP (for GPU-accelerated sequences) |
| **Inline transitions** | `transition-all duration-300`, `transition-transform duration-500` | FIX — use token durations |

### Inconsistent Durations (FIX)

| File | Line | Value | Should Be |
|------|------|-------|-----------|
| `media-card.tsx` | 107 | `duration-300` | `duration-base` (250ms) |
| `media-card.tsx` | 133 | `duration-1000` | Keep (image zoom, special case) |
| `media-card.tsx` | 174 | `duration-300` | `duration-base` |
| `hero-banner.tsx` | 95 | `duration: 1.4` | Keep (Framer Motion, cinematic) |
| `hero-banner.tsx` | 147 | `duration: 0.5` | Keep (Framer Motion) |
| `hero-banner.tsx` | 180 | `transition-all duration-300` | `duration-base` |
| `app-sidebar.tsx` | 49 | `duration-300` | `duration-slow` |
| `glass-button.tsx` | 92 | `duration-fast` | OK |

---

## 8. Component Inventory

### Components to KEEP (Final Set)

| Component | File | Status |
|-----------|------|--------|
| `GlassButton` | `glass-button/glass-button.tsx` | **KEEP** — Primary button system |
| `IconButton` | `glass-button/glass-button.tsx` | **KEEP** — Icon-only variant |
| `GlassCard` | `glass-card/glass-card.tsx` | **KEEP** — Panel/modal/card base |
| `GlassCardHeader` | `glass-card/glass-card.tsx` | **KEEP** |
| `GlassCardContent` | `glass-card/glass-card.tsx` | **KEEP** |
| `GlassCardFooter` | `glass-card/glass-card.tsx` | **KEEP** |
| `PosterCard` | `poster-card/poster-card.tsx` | **KEEP** — Catalog card |
| `PosterCarousel` | `poster-card/poster-card.tsx` | **KEEP** |
| `PosterGrid` | `poster-card/poster-card.tsx` | **KEEP** |

### Components to REMOVE (After Migration)

| Component | File | Replace With |
|-----------|------|-------------|
| `Button` | `button/button.tsx` | `GlassButton` |
| `Card` | `card/card.tsx` | `GlassCard` |
| `MediaCard` | `media-card.tsx` | `PosterCard` |
| `brutalistStyles` | `styling.ts` | Delete |
| `scrollStyles` | `styling.ts` | Delete (use `.custom-scrollbar`) |
| `cssUtils` | `styling.ts` | Delete (use tokens) |

### Components Needing Token Migration

| Component | Issues |
|-----------|--------|
| `media-card.tsx` | 15+ hardcoded colors, shadows, blur values |
| `hero-banner.tsx` | 10+ hardcoded colors, shadows, typography |
| `app-sidebar.tsx` | Hardcoded blur, radius, shadows, colors |
| `app-topnav.tsx` | Hardcoded blur, colors |
| `button.tsx` (legacy) | Entirely hardcoded zinc/white/black palette |
| `card.tsx` (legacy) | Uses `liquid-glass-frosted` class |
| `__root.tsx` | Hardcoded blur on mobile menu button |

---

## 9. Legacy Code to Remove

### `styling.ts` — Cleanup

```ts
// REMOVE these:
brutalistStyles    // { border, bg, text, card, interactive }
scrollStyles       // { hide, thin, custom }
cssUtils           // { focusRing, glass, glassInteractive, tab, pill, slider, card, field, label, description, error, helper, transition, glow }

// KEEP only:
cn()               // Class merging utility
defineStyleAnatomy() // Component anatomy helper
ComponentAnatomy type
```

### `globals.css` — Cleanup

```css
// REMOVE these legacy classes:
.liquid-glass-frosted        // Use .glass-base
.liquid-glass-frosted-*      // Use .glass-elevated, .glass-strong
.brutalist-*                 // Delete entirely

// KEEP these:
.glass-base
.glass-elevated
.glass-strong
.gradient-fade-*
.text-gradient-brand
.grid-swimlane
.scroll-snap-carousel
.skeleton
.badge-*
.container-fluid
.line-clamp-*
.gpu-accelerated
.touch-target
.custom-scrollbar
```

---

## 10. Summary — Priority Fixes

### Critical (Blocks Everything Else)
1. **Tailwind config**: Remap HSL var() references to match actual CSS variable format
2. **`styling.ts`**: Remove `brutalistStyles`, `scrollStyles`, `cssUtils`
3. **`globals.css`**: Remove `liquid-glass-frosted*` classes, add to `.glass-*` utilities

### High (Component Token Migration)
4. **`media-card.tsx`**: Replace 15+ hardcoded values with tokens
5. **`hero-banner.tsx`**: Replace 10+ hardcoded values with tokens
6. **`app-sidebar.tsx`**: Replace blur, radius, shadow, color hardcoded values
7. **`app-topnav.tsx`**: Replace blur, color hardcoded values

### Medium (Consolidation)
8. **Delete `button.tsx`** after migrating all `Button` usage to `GlassButton`
9. **Delete `card.tsx`** after migrating all `Card` usage to `GlassCard`
10. **Delete `media-card.tsx`** after migrating all `MediaCard` usage to `PosterCard`

### Low (Polish)
11. Standardize spacing across all page routes
12. Add missing `--shadow-sidebar` token
13. Verify all typography uses `text-h*`, `text-body-*`, `text-label-*`, `text-overline` classes
