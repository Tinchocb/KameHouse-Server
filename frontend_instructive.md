# KameHouse Frontend — Instructivo Completo

## Visión General

SPA React 18 que funciona como interfaz web de la plataforma KameHouse de streaming de anime/media. Diseño glassmorphism oscuro, tipografía Bebas Neue para headings.

## Stack Tecnológico

| Componente | Tecnología |
|---|---|
| Framework | React 18 |
| Bundler | Rsbuild (basado en Rspack/Webpack) |
| Router | TanStack Router (file-based) |
| Data Fetching | TanStack Query v5 |
| Styling | Tailwind CSS v3 + custom tokens |
| UI Primitives | Radix UI (~18 componentes) |
| Animaciones | Framer Motion + GSAP |
| Estado Global | Jotai (atoms) + React Hook Form |
| Video Player | HLS.js + JASSUB (subtítulos ASS) |
| Charts | Recharts |
| Carousel | Embla Carousel |
| Tables | TanStack Table + Virtual |
| Validación | Zod |
| Iconos | Lucide React + React Icons |

## Estructura del Proyecto

```
apps/web/src/
├── main.tsx                  # Entry point: QueryClient, RouterProvider
├── routeTree.gen.ts          # Auto-generado por TanStack Router
├── env.d.ts                  # Tipos para import.meta.env
├── sw.ts                     # Service Worker (Workbox)
├── app/                      # ⭐ Estructura core y global utilities
│   ├── globals.css           # ⭐ Design Tokens, estilos y config Tailwind (30KB)
│   ├── client-providers.tsx  # Montura de Jotai y TanStack Query
│   ├── websocket-provider.tsx# Manejador real-time server events context 
│   └── template.tsx          # Wrapper superior
├── api/
│   ├── client/
│   │   ├── requests.ts       # ⭐ useServerQuery, useServerMutation, buildSeaQuery
│   │   └── server-url.ts     # getServerBaseUrl() (desktop vs web)
│   ├── hooks/                # 38 archivos de hooks por dominio funcional
│   │   ├── (anime, continuity, debrid, docs, download, filecache, ...)
│   │   └── (local, mal, mediastream, settings, torrent, onlinestream, etc.)
│   ├── generated/            # Tipos autogenerados del backend
│   │   ├── types.ts          # 123KB — Todos los tipos Go → TS
│   │   ├── endpoints.ts      # 70KB — Endpoints tipados
│   │   └── ...
│   └── types/
│       └── unified.types.ts  # Tipos unificados custom
├── routes/
│   ├── __root.tsx            # Root layout: Sidebar + TopNav + PageTransition
│   ├── docs/                 # Documentación in-app
│   ├── home/                 # Página principal con swimlanes
│   ├── issue-report/         # Diagnóstico exportable
│   ├── scan-log-viewer/      # Logs detallados en terminal emulada
│   ├── library/              # Gestión de biblioteca local
│   ├── media/, movies/, series/
│   ├── settings/             # Configuración
│   ├── splashscreen/         # Pantalla de carga inicial
│   └── public/               # Contenido estático / links públicos sin log
├── components/
│   ├── ui/                   # 75+ componentes UI
│   │   ├── app-layout/       # AppLayout, AppSidebar, AppTopNav, AppBottomNav
│   │   ├── hero-banner.tsx   # Banner hero con imagen de fondo
│   │   ├── media-card.tsx    # Tarjeta de media principal
│   │   ├── swimlane.tsx      # Carouseles horizontales
│   │   ├── smart-swimlane.tsx
│   │   ├── episode-list.tsx  # Lista de episodios (23KB)
│   │   ├── source-selector.tsx # Selector de fuentes (29KB)
│   │   ├── video-player-modal.tsx # ⭐ Player modal (57KB!)
│   │   └── ...
│   ├── shared/               # 43 componentes reutilizables
│   │   ├── deferred-image.tsx
│   │   ├── source-picker.tsx
│   │   ├── glowing-effect.tsx
│   │   ├── particle-bg.tsx
│   │   └── ...
│   ├── video/                # Player y touch overlay
│   │   ├── player.tsx
│   │   └── player-touch-overlay.tsx
│   └── vaul/                 # Drawer component
├── lib/
│   ├── config/               # Constantes y config
│   ├── dbz-data.ts           # Datos pre-cargados Dragon Ball
│   ├── dbz-movies.ts         # Películas DB pre-cargadas
│   ├── home-catalog.ts       # Catálogos de la home
│   ├── navigation.ts         # Rutas de navegación
│   ├── store.ts              # Jotai atoms globales
│   ├── server/               # Server-related utils
│   ├── helpers/              # Helpers con tests
│   ├── theme/                # Sistema de temas
│   └── utils/                # Utilidades variadas
├── hooks/                    # React hooks reutilizables
├── edge/                     # Edge computing utilities
├── locales/                  # i18n (español)
└── types/
    ├── index.d.ts            # Tipos globales
    ├── constants.ts          # __isDesktop__, dev ports
    └── common.ts             # Tipos comunes
```

## API Communication Pattern

### Core: `buildSeaQuery<T, D>()`

```typescript
// Todos los API calls pasan por esta función:
// 1. Construye URL con getServerBaseUrl()
// 2. Añade query params si los hay
// 3. Retry automático (3 intentos) para 429, 502-504, network errors
// 4. Exponential backoff (1s, 2s, 4s)
// 5. Parsea respuesta { data: T, error?: string }
// 6. Lanza ApiError si falla
```

### Hooks:
```typescript
// Queries (GET):
const { data, isLoading } = useServerQuery<ResponseType>({
    queryKey: ["unique-key"],
    endpoint: "/api/v1/library/collection",
    method: "GET",
})

// Mutations (POST/PATCH/DELETE):
const { mutate } = useServerMutation<ResponseType, VariablesType>({
    endpoint: "/api/v1/settings",
    method: "PATCH",
    onSuccess: () => queryClient.invalidateQueries(...)
})
```

## Routing Architecture

File-based routing via TanStack Router. Root layout ([__root.tsx](file:///d:/Proyectos%20personales/KameHouse/kamehouse/apps/web/src/routes/__root.tsx)):
```
AppLayout
  └── WebsocketProvider
       ├── AppTopNav         (mobile: top bar)
       ├── AppSidebar        (desktop: 96px sidebar izquierdo)
       ├── CommandPalette    (⌘+K search)
       ├── OfflineStatus     (banner offline)
       ├── AppLayoutContent  (pt-20 mobile, pl-24 desktop)
       │   └── AnimatePresence → PageTransition → Outlet
       └── AppBottomNav      (mobile: bottom nav)
```

## Key Components

| Componente | Archivo | Tamaño | Descripción |
|---|---|---|---|
| VideoPlayerModal | [video-player-modal.tsx](file:///d:/Proyectos%20personales/KameHouse/kamehouse/apps/web/src/components/ui/video-player-modal.tsx) | 57KB | Player completo con HLS, subtítulos, controles |
| SourceSelector | [source-selector.tsx](file:///d:/Proyectos%20personales/KameHouse/kamehouse/apps/web/src/components/ui/source-selector.tsx) | 29KB | Selector de fuentes de stream |
| EpisodeList | [episode-list.tsx](file:///d:/Proyectos%20personales/KameHouse/kamehouse/apps/web/src/components/ui/episode-list.tsx) | 23KB | Lista virtual de episodios |
| PlayerSettingsMenu | [PlayerSettingsMenu.tsx](file:///d:/Proyectos%20personales/KameHouse/kamehouse/apps/web/src/components/ui/PlayerSettingsMenu.tsx) | 20KB | Menú de ajustes del player |
| HeroBanner | [hero-banner.tsx](file:///d:/Proyectos%20personales/KameHouse/kamehouse/apps/web/src/components/ui/hero-banner.tsx) | 18KB | Banner hero animado |
| SourcePicker | [source-picker.tsx](file:///d:/Proyectos%20personales/KameHouse/kamehouse/apps/web/src/components/shared/source-picker.tsx) | 12KB | Picker de fuentes |
| MediaCard | [media-card.tsx](file:///d:/Proyectos%20personales/KameHouse/kamehouse/apps/web/src/components/ui/media-card.tsx) | 11KB | Tarjeta de media con hover |
| PwaRegistry | `components/pwa-registry.tsx` | - | Service worker client interop, cache UI registry |

## CSS y Design Tokens (¡Vital!)

El Frontend asienta toda su estética centralizada y tokenizada en `src/app/globals.css`. De 30KB, este archivo especifica el Glassmorphism, overrides de Tailwind, directivas animadas base, variables radiales y los custom root breakpoints oscuros, es fundamental para iteraciones UI.

## Build Flow, i18n y WebSockets

- **i18n**: Las traducciones se cargan de los mapeos escalables en `locales/`.
- **Build Dev Server**: Rsbuild ofrece Fast Refresh veloz en react y proxy nativo para CORS sin dolor de cabeza en desarrollo.
- **Componentes Real-Time**: Funciona un Context `websocket-provider.tsx` (directorio `app/`) que encapsula `react-use-websocket`. Ahi es donde el estado del parser, transcode, scanner y logs de Go1.24 son recibidos en broadcast de EventBus.
- **PWA Ready**: El empaquetado `sw.ts` funciona bajo Workbox de forma offline pre-cache.

## State Management

- **Server state**: TanStack Query (cache, revalidation, mutations)
- **UI state local**: Jotai atoms ([lib/store.ts](file:///d:/Proyectos%20personales/KameHouse/kamehouse/apps/web/src/lib/store.ts))
- **Forms**: React Hook Form + Zod resolvers
- **WebSocket**: `react-use-websocket` inyectado en Providers con listeners globales

## Tests Existentes

Solo 3 archivos de test:
- `lib/helpers/date.test.ts`
- `lib/helpers/filtering.test.ts`
- `lib/helpers/upath.test.ts`

Runner: Vitest (`npm run test`)
