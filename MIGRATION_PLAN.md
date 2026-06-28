# KameHouse — Migration Plan

> Exact sequence for migrating from legacy components to Design System v2. One component at a time, verify at each step.

---

## Principles

1. **Migrate first, delete last** — Never delete a component until all usages are migrated.
2. **One component per commit** — Each migration step is a single, revertable commit.
3. **Verify at each step** — Run `pnpm typecheck`, `pnpm lint`, manual check on desktop + TV.
4. **Token-first** — Every hardcoded value becomes a token reference.
5. **Tizen budget** — After each component migration, check `backdrop-filter` count stays ≤ 8.

---

## Phase 0: Foundation (Before Any Component)

### Step 0.1 — Fix Tailwind Config
**File**: `apps/web/tailwind.config.ts`

Replace HSL var() references with direct token values:

```ts
// BEFORE (broken — HSL vars don't exist)
background: "hsl(var(--background) / <alpha-value>)",
primary: "hsl(var(--primary) / <alpha-value>)",

// AFTER (match actual CSS variables)
background: "var(--bg-primary)",
primary: "var(--brand-primary)",
secondary: "var(--brand-secondary)",
destructive: "var(--brand-destructive)",
muted: "var(--bg-tertiary)",
border: "var(--glass-border)",
card: "var(--bg-secondary)",
popover: "var(--bg-quaternary)",
ring: "var(--brand-primary)",
```

Add missing Tailwind mappings:

```ts
extend: {
  backdropBlur: {
    xs: 'var(--blur-xs)',
    sm: 'var(--blur-sm)',
    md: 'var(--blur-md)',
    lg: 'var(--blur-lg)',
    xl: 'var(--blur-xl)',
  },
  boxShadow: {
    card: 'var(--shadow-card)',
    elevated: 'var(--shadow-elevated)',
    modal: 'var(--shadow-modal)',
    player: 'var(--shadow-player)',
    'brand-primary': 'var(--shadow-brand-primary)',
    'brand-secondary': 'var(--shadow-brand-secondary)',
  },
  borderRadius: {
    'token-xs': 'var(--radius-xs)',
    'token-sm': 'var(--radius-sm)',
    'token-md': 'var(--radius-md)',
    'token-lg': 'var(--radius-lg)',
    'token-xl': 'var(--radius-xl)',
    'token-2xl': 'var(--radius-2xl)',
    'token-3xl': 'var(--radius-3xl)',
    hero: 'var(--radius-hero)',
    card: 'var(--radius-card)',
    button: 'var(--radius-button)',
  },
  transitionDuration: {
    instant: 'var(--duration-instant)',
    fast: 'var(--duration-fast)',
    base: 'var(--duration-base)',
    slow: 'var(--duration-slow)',
    slower: 'var(--duration-slower)',
    slowest: 'var(--duration-slowest)',
  },
}
```

**Verify**: `pnpm typecheck` passes, no Tailwind build errors.

### Step 0.2 — Clean `styling.ts`
**File**: `apps/web/src/components/ui/core/styling.ts`

Delete `brutalistStyles`, `scrollStyles`, `cssUtils`. Keep only `cn()`, `defineStyleAnatomy()`, `ComponentAnatomy`.

**Verify**: Grep for imports of deleted objects. Fix any remaining imports.

### Step 0.3 — Clean `globals.css`
**File**: `apps/web/src/app/globals.css`

Remove all `liquid-glass-frosted*` classes. The `.glass-base`, `.glass-elevated`, `.glass-strong` utilities replace them.

**Verify**: Grep for `liquid-glass-frosted` in codebase. Fix any remaining references.

---

## Phase 1: Button Consolidation

### Step 1.1 — Migrate `Button` → `GlassButton`
**Files to change**: Every file importing `Button` from `@/components/ui/button`.

1. Run: `grep -r "from.*button/button\|from.*ui/button" apps/web/src --include="*.tsx"` — list all usages.
2. For each file:
   - Replace `import { Button } from "@/components/ui/button"` with `import { GlassButton } from "@/components/ui/glass-button"`
   - Map props:
     - `intent="primary"` → `variant="primary"` (or keep as default)
     - `intent="gray"` → `variant="ghost"` or `variant="glass"`
     - `intent="alert"` → `variant="destructive"`
     - `intent="primary-outline"` → `variant="outline"`
     - `intent="primary-glass"` → `variant="glass"`
     - `size="xs"` → `size="xs"`
     - `rounded` → remove (GlassButton uses `rounded-button` by default)
     - `leftIcon` → `leftIcon` (string key or ReactNode)
     - `hideTextOnSmallScreen` → `hideTextOnMobile`
3. After all migrations, delete `apps/web/src/components/ui/button/` directory.

**Verify**: `pnpm typecheck`, `pnpm lint`, manual check all forms/buttons render correctly.

### Step 1.2 — Verify Button in Settings Pages
**Files**: `settings/tabs/*.tsx`

Settings forms heavily use `Button`. Verify each tab renders correctly with `GlassButton`.

---

## Phase 2: Card Consolidation

### Step 2.1 — Migrate `Card` → `GlassCard`
**Files to change**: Every file importing `Card` from `@/components/ui/card`.

1. Run: `grep -r "from.*card/card\|from.*ui/card" apps/web/src --include="*.tsx"` — list all usages.
2. For each file:
   - Replace `import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card"` with `import { GlassCard, GlassCardHeader, GlassCardTitle, GlassCardContent, GlassCardFooter } from "@/components/ui/glass-card"`
   - Map props: `Card` → `GlassCard variant="default"`, `className` stays.
3. After all migrations, delete `apps/web/src/components/ui/card/` directory.

**Verify**: `pnpm typecheck`, manual check settings panels, admin cards.

### Step 2.2 — Migrate `MediaCard` → `PosterCard`
**Files to change**: Every file importing `MediaCard`.

1. Run: `grep -r "MediaCard" apps/web/src --include="*.tsx"` — list all usages.
2. For each file:
   - Replace `import { MediaCard } from "@/components/ui/media-card"` with `import { PosterCard } from "@/components/ui/poster-card"`
   - Map props:
     - `aspect="poster"` → `aspect="poster"` (same)
     - `aspect="landscape"` → `aspect="landscape"` (same)
     - `episodeNumber` → `episodeNumber` (same)
     - `progress` → `progress` (same)
     - `layoutId` → `layoutId` (same)
   - `MediaCard` has `onPopupOpenChange` — verify `PosterCard` supports it (it does).
3. After all migrations, delete `apps/web/src/components/ui/media-card.tsx`.

**Verify**: `pnpm typecheck`, check home carousels, series page, movies page.

---

## Phase 3: Layout Token Migration

### Step 3.1 — Migrate `AppSidebar`
**File**: `apps/web/src/components/ui/app-layout/app-sidebar.tsx`

Changes:
- Line 49: `bg-zinc-950/60 backdrop-blur-3xl rounded-r-[32px] shadow-[8px_0_32px_rgba(0,0,0,0.5)]`
  → `bg-[var(--bg-primary)]/60 backdrop-blur-[var(--blur-sidebar)] rounded-r-[var(--radius-hero)] shadow-[8px_0_32px_rgba(0,0,0,0.5)]`
- Line 59: `liquid-glass-frosted` → `glass-base`
- Line 199: `rounded-xl` → `rounded-[var(--radius-md)]`
- Line 221: `bg-brand-orange/[0.06] border-brand-orange/30 shadow-[0_8px_32px_rgba(255,110,58,0.15)]`
  → `bg-[var(--brand-secondary)]/[0.06] border-[var(--brand-secondary)]/30 shadow-brand-secondary`
- Line 235: `liquid-glass-frosted-subtle` → `glass-base`
- Line 285: `bg-brand-orange` → `bg-[var(--brand-secondary)]`
- Line 307: `liquid-glass-frosted-subtle` → `glass-base`

### Step 3.2 — Migrate `AppTopNav` / `AppBottomNav`
**File**: `apps/web/src/components/ui/app-layout/app-topnav.tsx`

Changes:
- Line 18: `bg-zinc-950/60 backdrop-blur-2xl` → `bg-[var(--bg-primary)]/60 backdrop-blur-[var(--blur-navbar)]`
- Line 24: `bg-white/5` → `bg-[var(--glass-bg)]`
- Line 46: `bg-zinc-950/80 backdrop-blur-3xl` → `bg-[var(--bg-primary)]/80 backdrop-blur-[var(--blur-navbar)]`

### Step 3.3 — Migrate `__root.tsx` Mobile Menu Button
**File**: `apps/web/src/routes/__root.tsx`

Changes:
- Line 88: `bg-black/40 backdrop-blur-xl border border-white/10`
  → `bg-[var(--bg-primary)]/40 backdrop-blur-[var(--blur-md)] border border-[var(--glass-border)]`

---

## Phase 4: Media Card Token Migration (If Not Deleted)

If `MediaCard` was deleted in Phase 2, skip this. If kept for specific use cases:

### Step 4.1 — Replace All Hardcoded Values in `media-card.tsx`

| Line | Before | After |
|------|--------|-------|
| 109 | `bg-zinc-950/95 ... shadow-[0_20px_50px...]` | `bg-[var(--bg-primary)]/95 ... shadow-modal` |
| 115 | `bg-zinc-900/40 border-white/5 hover:border-brand-orange/30` | `bg-[var(--glass-bg)] border-[var(--glass-border)] hover:border-[var(--brand-secondary)]/30` |
| 133 | `duration-1000` | Keep (intentional slow zoom) |
| 138 | `from-zinc-950 via-zinc-950/20` | `from-[var(--bg-primary)] via-[var(--bg-primary)]/20` |
| 157 | `bg-zinc-950/70 text-zinc-300 border-white/10` | `bg-[var(--bg-primary)]/70 text-[var(--text-secondary)] border-[var(--glass-border)]` |
| 159 | `text-brand-orange` | `text-[var(--brand-secondary)]` |
| 167 | `bg-zinc-950/70 text-zinc-400 border-white/10` | `bg-[var(--bg-primary)]/70 text-[var(--text-muted)] border-[var(--glass-border)]` |
| 176 | `bg-brand-orange` | `bg-[var(--brand-secondary)]` |
| 179 | `bg-zinc-900/60 text-zinc-300` | `bg-[var(--bg-secondary)]/60 text-[var(--text-secondary)]` |
| 189 | `font-bebas text-lg md:text-xl` | `text-h6` |
| 193 | `text-[9px] font-black uppercase tracking-[0.15em] text-white/40` | `text-overline text-[var(--text-disabled)]` |
| 205 | `bg-zinc-950/90` | `bg-[var(--bg-primary)]/90` |
| 212 | `font-bebas text-xl md:text-2xl` | `text-h5` |
| 217 | `text-[10px] font-bold uppercase tracking-wider text-zinc-400` | `text-label-md text-[var(--text-muted)]` |
| 225 | `border-white/10 bg-white/5 text-zinc-300` | `border-[var(--glass-border)] bg-[var(--glass-bg)] text-[var(--text-secondary)]` |
| 237 | `from-brand-orange/15 via-amber-500/15 to-brand-orange/15 border-brand-orange/30 text-brand-orange` | `from-[var(--brand-secondary)]/15 via-[var(--brand-secondary)]/10 to-[var(--brand-secondary)]/15 border-[var(--brand-secondary)]/30 text-[var(--brand-secondary)]` |
| 248 | `text-[11px] leading-relaxed text-zinc-400` | `text-body-xs text-[var(--text-muted)]` |
| 257 | `bg-white/10` | `bg-[var(--glass-border)]` |
| 259 | `bg-brand-orange shadow-[0_0_8px_rgba(255,110,58,0.5)]` | `bg-[var(--brand-secondary)] shadow-brand-secondary` |

---

## Phase 5: Hero Banner Token Migration

### Step 5.1 — Replace All Hardcoded Values in `hero-banner.tsx`

| Line | Before | After |
|------|--------|-------|
| 83 | `bg-zinc-950` | `bg-[var(--bg-primary)]` |
| 134 | `from-zinc-950 via-zinc-950/40 to-transparent` | `from-[var(--bg-primary)] via-[var(--bg-primary)]/40 to-transparent` |
| 135 | `from-zinc-950/90 via-transparent to-transparent` | `from-[var(--bg-primary)]/90 via-transparent to-transparent` |
| 136 | `from-zinc-950/80 via-zinc-950/30 to-transparent` | `from-[var(--bg-primary)]/80 via-[var(--bg-primary)]/30 to-transparent` |
| 151 | `text-[10px] font-black uppercase tracking-[0.3em] text-white/50` | `text-overline text-[var(--text-muted)]` |
| 162 | `text-emerald-400` | `text-[var(--brand-success)]` |
| 168 | `text-[5.5rem] md:text-[8rem] lg:text-[10rem] xl:text-[11.5rem]` | `text-display-lg` (or keep for responsive sizing) |
| 173 | `text-lg leading-relaxed text-zinc-300` | `text-body-lg text-[var(--text-secondary)]` |
| 183 | `bg-brand-orange text-white px-10 py-4 rounded-xl font-bebas text-xl uppercase tracking-wider shadow-[...]` | `bg-[var(--brand-secondary)] text-white px-10 py-4 rounded-[var(--radius-card)] text-button-lg shadow-brand-secondary` |
| 193 | `bg-white/[0.03] backdrop-blur-md text-white px-10 py-4 rounded-xl border border-white/10 font-bebas text-xl uppercase tracking-wider` | `bg-[var(--glass-bg)] backdrop-blur-[var(--blur-md)] text-[var(--text-primary)] px-10 py-4 rounded-[var(--radius-card)] border border-[var(--glass-border)] text-button-lg` |
| 216 | `bg-zinc-900/40 backdrop-blur-md border border-white/5 rounded-full shadow-2xl` | `bg-[var(--bg-secondary)]/40 backdrop-blur-[var(--blur-md)] border border-[var(--glass-border)] rounded-full shadow-modal` |
| 243 | `text-[9px] tracking-[0.3em] text-white/50` | `text-overline text-[var(--text-muted)]` |
| 248 | `bg-brand-orange shadow-[0_0_6px_#ff6e3a]` | `bg-[var(--brand-secondary)] shadow-brand-secondary` |
| 263 | `bg-brand-orange shadow-[0_0_12px_rgba(255,110,58,0.4)]` | `bg-[var(--brand-secondary)] shadow-brand-secondary` |

---

## Phase 6: Home Page Token Migration

### Step 6.1 — Migrate `HomeClient` (`routes/home/index.tsx`)

| Line | Before | After |
|------|--------|-------|
| 175 | `bg-[var(--brand-primary)]/10` | OK (already using token) |
| 243 | `bg-[var(--brand-primary)]/10` | OK |
| 255 | `bg-[var(--brand-primary)] shadow-[0_0_15px_rgba(0,150,230,0.5)]` | `bg-[var(--brand-primary)] shadow-brand-primary` |
| 316 | `px-6 md:px-14 lg:px-20` | `container-fluid` or `px-[var(--space-6)] md:px-[var(--space-14)] lg:px-[var(--space-20)]` |
| 319 | `text-h3 font-display text-primary uppercase tracking-wide` | OK (already using token class) |

---

## Phase 7: Series Detail Token Migration

### Step 7.1 — Migrate `SeriesHero`
**File**: `apps/web/src/routes/series/$seriesId/-components/series-hero.tsx`

Replace all `bg-zinc-*`, `text-zinc-*`, `border-white/*`, `shadow-*` hardcoded values with tokens.

### Step 7.2 — Migrate `PremiumEpisodeList`
**File**: `apps/web/src/routes/series/$seriesId/-components/premium-episode-list.tsx`

Replace hardcoded colors, shadows, typography with tokens.

### Step 7.3 — Migrate `SagaSelector`
**File**: `apps/web/src/routes/series/$seriesId/-components/saga-selector.tsx`

Replace hardcoded values.

---

## Phase 8: Movies Page Token Migration

### Step 8.1 — Migrate Movie Components
**Files**: `routes/movies/-components/*.tsx`

Replace hardcoded values in:
- `movies-hero.tsx`
- `movies-grid.tsx`
- `movies-filter-bar.tsx`
- `movie-hero-widescreen.tsx`
- `movie-bento-specs.tsx`
- `movie-audio-subs.tsx`

---

## Phase 9: Player Token Migration

### Step 9.1 — Migrate Player Top/Bottom Bars
**Files**:
- `components/video/player-topbar.tsx`
- `components/video/player-bottombar.tsx`

Replace `bg-zinc-950/60 backdrop-blur-2xl` → `bg-[var(--bg-primary)]/60 backdrop-blur-[var(--blur-player)]`

### Step 9.2 — Migrate Player Overlays
**File**: `components/video/player-overlays.tsx`

Replace hardcoded colors in skip intro/outro, loading, resume overlays.

### Step 9.3 — Migrate Player Sidebars
**Files**:
- `components/video/player-episodes-sidebar.tsx`
- `components/video/player-queue-sidebar.tsx`

Replace hardcoded glass values with tokens.

---

## Phase 10: Remaining Pages

### Step 10.1 — Settings Pages
**Files**: `routes/settings/tabs/*.tsx`

Replace `Button` → `GlassButton`, `Card` → `GlassCard`, hardcoded colors → tokens.

### Step 10.2 — Profile Page
**File**: `routes/profile/index.tsx`

Replace hardcoded values.

### Step 10.3 — Admin Page
**File**: `routes/admin/index.tsx`

Replace hardcoded values.

### Step 10.4 — Collections Pages
**Files**: `routes/collections/*.tsx`

Replace hardcoded values.

---

## Phase 11: Cleanup

### Step 11.1 — Delete Legacy Components
After ALL migrations are verified:
1. Delete `apps/web/src/components/ui/button/` directory
2. Delete `apps/web/src/components/ui/card/` directory
3. Delete `apps/web/src/components/ui/media-card.tsx`
4. Remove `brutalistStyles`, `scrollStyles`, `cssUtils` from `styling.ts`

### Step 11.2 — Delete Legacy CSS
1. Remove `liquid-glass-frosted*` classes from `globals.css`
2. Remove any unused utility classes

### Step 11.3 — Verify No Remaining Hardcoded Values
```bash
# Should return 0 results for each:
grep -r "bg-zinc-950\|bg-zinc-900\|bg-zinc-800\|bg-zinc-700" apps/web/src --include="*.tsx" | grep -v node_modules
grep -r "text-zinc-\|border-white/" apps/web/src --include="*.tsx" | grep -v node_modules
grep -r "backdrop-blur-3xl\|backdrop-blur-2xl" apps/web/src --include="*.tsx" | grep -v node_modules
grep -r "shadow-\[" apps/web/src --include="*.tsx" | grep -v "shadow-card\|shadow-elevated\|shadow-modal\|shadow-player\|shadow-brand"
grep -r "rounded-\[" apps/web/src --include="*.tsx" | grep -v "rounded-\[var("
grep -r "liquid-glass-frosted" apps/web/src --include="*.tsx" | grep -v node_modules
```

---

## Verification Checklist (After Each Phase)

- [ ] `pnpm typecheck` — 0 errors
- [ ] `pnpm lint` — 0 new warnings
- [ ] `pnpm build` — builds successfully
- [ ] Desktop browser — all pages render correctly
- [ ] TV mode (`?tvMode=true`) — navigation works with D-pad
- [ ] Focus visible — all interactive elements show focus ring
- [ ] `backdrop-filter` count — ≤ 8 simultaneous (check DevTools)
- [ ] No console errors or warnings
- [ ] Animations smooth (no jank on scroll/hover)
