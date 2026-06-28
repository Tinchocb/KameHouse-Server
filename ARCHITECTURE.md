# KameHouse — Architecture Reference

> Read this before touching any code. Covers data flow, routing, state, services, player, TV mode, lifecycle, and error handling across all three targets (web, desktop, Tizen).

---

## 1. Monorepo Structure

```
kamehouse/
├── apps/
│   ├── web/          React SPA (Vite, TanStack Router, Tailwind)
│   ├── desktop/      Electron shell + Go server sidecar
│   └── KameHouseTV/  Tizen launcher (HTML/CSS/JS, no React)
├── pnpm-workspace.yaml
└── package.json
```

| Target | Entry | Server | Notes |
|--------|-------|--------|-------|
| **Web** | `apps/web/index.html` → Vite dev server | External Go server on LAN | `?tvMode=true` activates TV layout |
| **Desktop** | Electron `main.js` | Go sidecar spawned at `127.0.0.1:43211` | Chromium flags for perf, auto-updater, tray |
| **Tizen** | `apps/KameHouseTV/index.html` | Redirects to Go server URL | Only a launcher — no React, no components |

---

## 2. Data Flow

```
┌─────────────────────────────────────────────────────────┐
│                    Go Server (HTTP + WS)                  │
│  /api/v1/status, /api/v1/library, /api/v1/stream, etc.  │
└──────────┬──────────────────────┬────────────────────────┘
           │ HTTP (REST)          │ WebSocket
           ▼                      ▼
┌──────────────────────┐  ┌──────────────────────┐
│  TanStack Query      │  │  WS Event System     │
│  useServerQuery()    │  │  ws-events.ts        │
│  useServerMutation() │  │  WebSocketProvider    │
│  + retry logic (3x)  │  │  Scanner/Player/     │
└──────────┬───────────┘  │  Sync/Toast events   │
           │              └──────────┬───────────┘
           ▼                         ▼
┌──────────────────────────────────────────────────────┐
│                   Zustand Store                       │
│  useAppStore (UI + Player + Scanner slices)           │
│  useProgressStore (watched episodes)                  │
│  useSkipTimesStore (per-series skip overrides)        │
└──────────┬───────────────────────┬────────────────────┘
           │                       │
           ▼                       ▼
┌──────────────────┐  ┌──────────────────────────┐
│  React Router    │  │  Components              │
│  TanStack Router │  │  pages, player, sidebar,  │
│  File-based      │  │  cards, modals, etc.      │
└──────────────────┘  └──────────────────────────┘
```

### API Client (`apps/web/src/api/client/`)

- **`server-url.ts`**: Resolves base URL. Desktop → `127.0.0.1:43211`, Web → `window.location.origin` or `SEA_PUBLIC_API_URL`, Tizen → reads from Tizen app settings.
- **`requests.ts`**: `buildSeaQuery<T>()` — fetch wrapper with 3 retries (exponential backoff on 429/502/503/504). Response format: `{ data: T, error?: string }`. `useServerQuery()` wraps TanStack Query `useQuery`. `useServerMutation()` wraps `useMutation` with auto-toast on error.
- **`endpoints.ts`**: Auto-generated from Go codegen — endpoint constants, HTTP methods, URL patterns.
- **`types.ts`**: Auto-generated TypeScript types from Go models.

### WebSocket System (`apps/web/src/lib/server/ws-events.ts`)

**Server → Client events** (enum `WSEvents`):

| Category | Events |
|----------|--------|
| Platform | `PLATFORM_DATA_LOADED` |
| Scanning | `SCAN_PROGRESS`, `SCAN_PROGRESS_DETAILED`, `SCAN_STATUS`, `LIBRARY_SCAN` |
| Playback | `PLAYBACK_HEARTBEAT_PROGRESS`, `NATIVE_PLAYER`, `VIDEOCORE`, `PLAYLIST` |
| MediaStream | `MEDIA_STREAM_STATE`, `BUFFERING_STATUS`, `NETWORK_SPEED`, `MEDIASTREAM_SHUTDOWN_STREAM` |
| Sync | `SYNC_LOCAL_QUEUE_STATE`, `SYNC_LOCAL_FINISHED`, `SYNC_PLATFORM_FINISHED` |
| System | `INVALIDATE_QUERIES`, `CHECK_FOR_UPDATES`, `ERROR_TOAST`, `SUCCESS_TOAST` |

**Client → Server** (via WS): Playback heartbeats with `{ type: "native-player", payload: { eventType, mediaId, episodeNumber, currentTime, duration, progress } }`.

---

## 3. State Management

### `useAppStore` — Main Store (Zustand + Persist)

**UI Slice** (persisted): `sidebarOpen`, `activeTheme`, `bgMusicEnabled/Volume`, `uiSoundsEnabled/Volume`, `globalQueueOpen`, `dynamicBackdropEnabled`, `dynamicBackdropMotionEnabled`

**Player Slice** (persisted): `playerVolume`, `isFullscreen`, `autoSkipIntro/Outro`, `playbackRate`, `preferredAudioLang/SubtitleLang`, `showHeatmap`, `aspectRatio`, `subtitleSize`, `loopEnabled`, `marathonMode`, `tvMode`, `playlistQueue[]`, `currentQueueIndex`, `activeQueuePlayItem`

**Scanner Slice** (ephemeral): `isScanning`, `scanProgress`, `currentScanningFile`, `events[]`, `activeStageIdx`, `lastFinish`, `pruneCount`

### `useProgressStore` — Watched Episodes (Persisted)
- `Record<string, true>` for O(1) `isWatched(episodeId)` lookups.
- Migrates old `string[]` format from localStorage.

### `useSkipTimesStore` — Skip Times (Persisted)
- `Record<string, { opStart, opEnd, edOffset, edEnd }>` per series key.
- Migrates from old `kamehouse-app-settings` localStorage entry.

---

## 4. Routing (TanStack Router)

File-based routing. Root (`/`) redirects to `/home`.

| Route | Component | Key Features |
|-------|-----------|--------------|
| `/home/` | `HomePage` | Hero section, carousels (Continue Watching, Featured, Movies, Recent) |
| `/series/` | `SeriesFullscreenPage` | Horizontal VHS-shelf browsing, CRT overlay, 3D perspective hover |
| `/series/$seriesId/` | `SeriesDetailPage` | `SeriesHero`, `SagaSelector`, `CharacterCarousel`, `PremiumEpisodeList` |
| `/series/$seriesId/$sagaId` | Saga sub-route | Saga parameter via search params |
| `/movies/` | `MoviesPage` | Filterable grid with era tabs, sort options, hero |
| `/movies/$movieId` | `MovieDetailPage` | Full-screen parallax hero, play/resume/watched/favorite/queue |
| `/collections/` | `CollectionsPage` | 3D cassette-shelf UI for TMDB collections |
| `/collections/$id` | `CollectionDetailPage` | Timeline/chronological view, GSAP staggered animations |
| `/profile/` | `ProfilePage` | Avatar, stats grid, Continue Watching, Favorites |
| `/settings/` | `SettingsPage` | 7 tabs (General, Library, Scanner, Player, Streaming, Integrations, Appearance), react-hook-form + Zod |
| `/admin/` | `AdminPage` | Stats grid, library management, external services, activity feed (placeholder data) |

### Root Layout (`__root.tsx`)

```
AppLayout
├── DynamicBackdrop          (animated background)
├── PerformanceMonitor       (lazy, optional)
├── AppSidebar               (desktop) | TvNavBar (TV)
├── CommandPalette           (lazy, Cmd+K)
├── GlobalQueueSidebar
├── AppLayoutContent
│   ├── MobileMenuButton
│   └── PageTransition
│       └── <Outlet />       (current route)
└── VideoPlayer              (conditional, when queue item active)
```

---

## 5. Player Architecture

All files in `apps/web/src/components/video/`.

```
VideoPlayer (player.tsx — lazy, createPortal to document.body)
└── VideoPlayerOrchestrator (player-orchestrator.tsx)
    ├── useRequestMediastreamMediaContainer()    — fetches stream metadata from server
    ├── usePlayerCore (player-core.ts)           — ALL state + controls
    │   ├── usePlayerHls.ts                      — HLS.js lifecycle, native fallback, track extraction
    │   ├── usePlayerJassub.ts                   — WASM subtitle renderer (ASS/SSA)
    │   ├── usePlayerSkip.ts                     — AniSkip integration, skip intro/outro, chapters
    │   ├── usePlayerShortcuts.ts                — Keyboard shortcuts, Electron IPC fullscreen
    │   ├── useAnimeTracking.ts                  — WebSocket progress heartbeats
    │   └── usePlayerProgressSync.ts             — Continuity watch history sync
    └── PlayerUI (player-ui.tsx)                 — Visual layer
        ├── <video> element
        ├── <canvas> (JASSUB subtitles)
        ├── Gesture overlay (double-tap skip, hold 2x speed)
        ├── Stats overlay
        ├── PlayerTopBar          (title, episode, close)
        ├── PlayerBottomBar       (progress+heatmap, time, play/pause, volume, audio/subs, quality, settings, fullscreen, PiP, screenshot)
        ├── PlayerEpisodesSidebar (episodes panel)
        ├── PlayerQueueSidebar    (queue panel)
        └── Overlays: loading, center play flash, skip intro/outro, next episode, resume
```

### Key Props (`VideoPlayerProps`)

- `streamUrl`, `streamType` (local/online/direct/transcode/optimized)
- `title`, `episodeLabel`, `episodeNumber`, `mediaId`, `malId`, `mediaFormat`
- `onClose`, `onNextEpisode`, `hasNextEpisode`
- `nextStreamUrl`, `nextStreamType`, `nextEpisodeTitle`, `nextEpisodeNumber`, `nextEpisodeImage`

### Player States

- **Loading**: Fetching `MediaContainer` from backend → resolving URL → HLS.js attaching
- **Playing**: HLS.js or native video, JASSUB rendering subtitles, heartbeats every few seconds
- **Buffering**: HLS.js `FRAG_BUFFERED` / `ERROR` states
- **Error**: Stream failed → retry or show error overlay
- **Fullscreen**: Auto on TV, manual on desktop. Keyboard shortcuts yield to player when `isVideoActive`.

---

## 6. TV Mode

### Platform Detection (`types/constants.ts`)

```ts
__isTizenTV__  = /Tizen/.test(navigator.userAgent)
__isWebOS__    = /WebOS/.test(navigator.userAgent)
__isSmartTV__  = __isTizenTV__ || __isWebOS__ || /SmartTV/.test(navigator.userAgent)
__isTV__       = __isSmartTV__ || __isElectronDesktop__
```

### TV Mode Toggle

- Stored in Zustand: `tvMode` boolean.
- Activated by `?tvMode=true` query param (from Tizen launcher) or player settings.
- When active:
  - `data-tv="true"` on `<html>` for CSS hooks
  - `AppSidebar` hidden, `TvNavBar` rendered
  - D-pad navigation enabled
  - Auto-fullscreen on player

### Tizen Launcher (`apps/KameHouseTV/index.html`)

- Standalone HTML/JS — no React, no components.
- Checks server connectivity via XHR to `SERVER_URL + '/api/health'`.
- On success: `window.location.replace(SERVER_URL + '?tvMode=true')`.
- Handles D-pad navigation for retry/exit buttons.
- Registers Tizen media keys (Volume, Play, Pause, etc.).
- **Problem**: `SERVER_URL` is hardcoded (`http://192.168.100.2:43211`). Must be configurable per network.

### D-Pad Navigation (`useTvDpad.ts`)

- Global `keydown` listener for ArrowUp/Down/Left/Right.
- Finds all focusable elements (`a, button, [role="button"], input, select, [tabindex]`).
- Uses **euclidean distance scoring** with directional bias — penalizes candidates not in the pressed direction.
- Yields arrow keys to video player when `isVideoActive` is true.
- On Enter/OK: triggers `click()` on focused element.

### Focus Navigation (`useFocusNavigation.ts`)

- Container-scoped D-pad navigation (used inside player, modals).
- Same euclidean distance algorithm.
- Supports `four-way` (TV) and `two-way` (horizontal carousels) modes.
- Handles Escape (back) and Enter (select).
- Returns `focusElement()`, `getFocusedElement()`, `resetFocus()`.

---

## 7. Lifecycle & Cleanup

### Mount/Unmount

- **Zustand stores**: Created once, persist to localStorage. No cleanup needed.
- **WebSocket**: `WebSocketProvider` manages connection lifecycle. Auto-reconnect.
- **Player**: `VideoPlayer` creates via `createPortal` to `document.body`. On close: HLS.js `destroy()`, JASSUB `destroy()`, GSAP `killTweensOf()`, remove event listeners.
- **GSAP**: `useGSAP()` scope handles cleanup automatically via `@gsap/react`.
- **Intervals/Timeouts**: `useEffect` return functions clear them (e.g., auto-rotate in `HeroBanner`).

### Memory Leak Risks

| Area | Risk | Mitigation |
|------|------|------------|
| HLS.js instance | Not destroyed on unmount | `player-core.ts` calls `hls.destroy()` in cleanup |
| JASSUB WASM | Not freed | `usePlayerJassub.ts` calls `jassub.destroy()` |
| GSAP animations | Running after unmount | `useGSAP` scope auto-cleanup |
| WebSocket listeners | Not removed | `WebSocketProvider` removes on unmount |
| `addEventListener` | Global listeners leaked | All `useEffect` returns remove them |
| React Query cache | Stale data accumulating | `staleTime: 5min` on collection queries |

---

## 8. Error Handling

### React Error Boundaries

- `AppErrorBoundary` wraps root route — catches route-level errors.
- Each route can define its own `errorComponent`.

### API Error Handling

- `useServerQuery` / `useServerMutation`: Auto-toast on error via `toast.error()`.
- Retry logic: 3 attempts with exponential backoff on 429/502/503/504.
- `isError` + `error` returned for manual handling.

### Player Error Recovery

- HLS.js `ERROR` event → `hls.startLoad()` for network errors, `hls.recoverMediaError()` for media errors.
- Max 2 recovery attempts before showing error overlay.
- Resume detection: checks `useContinuityStore` for last position.

### Tizen Launcher Errors

- XHR timeout (10s) → shows "Tiempo agotado" screen.
- Max 2 retries → shows "Sin conexión" with retry/exit buttons.
- `tizen.application.exit()` for clean app close.

---

## 9. Build & Deploy

### Web (`apps/web/`)

- **Dev**: `pnpm dev` → Vite dev server with proxy to Go backend.
- **Build**: `pnpm build` → Vite production build → `dist/`.
- **Preview**: `pnpm preview` → serve production build locally.

### Desktop (`apps/desktop/`)

- **Dev**: Electron + Vite dev server.
- **Build**: `electron-builder` → Windows NSIS, macOS arm64, Linux AppImage.
- **Sidecar**: Go binary in `binaries/` → spawned as child process.
- **Auto-update**: GitHub releases feed, stable/nightly channels.

### Tizen (`apps/KameHouseTV/`)

- **Build**: Tizen Extension for VS Code → `.wgt` package.
- **Deploy**: Tizen Extension → install on TV via network.
- **Content**: Just `index.html` + `icon.png` — redirects to web app on server.

---

## 10. Key Dependencies

| Package | Purpose | Notes |
|---------|---------|-------|
| `@tanstack/react-router` | File-based routing | Generates `routeTree.gen.ts` |
| `@tanstack/react-query` | Server state caching | `staleTime: 5min`, auto-refetch |
| `zustand` | Client state + persist | 3 slices + 2 isolated stores |
| `framer-motion` | Page transitions, hover | `AnimatePresence` for route changes |
| `gsap` + `@gsap/react` | Sidebar animations, hero Ken Burns | GPU-accelerated, scoped cleanup |
| `hls.js` | HLS video streaming | Fallback to native `<video>` |
| `jassub` | ASS/SSA subtitle rendering | WASM, requires `<canvas>` |
| `lucide-react` | Icons | Tree-shakeable, consistent style |
| `class-variance-authority` | Component variants | Used by `Button`, `Card` (legacy) |
| `tailwind-merge` + `clsx` | Class composition | `cn()` utility |
| `sonner` | Toast notifications | Auto-dismiss, stacking |
| `react-hook-form` + `zod` | Settings forms | Validation + dirty state |
| `vaul` | Drawer/sidebar | Accessible, TV-compatible |
