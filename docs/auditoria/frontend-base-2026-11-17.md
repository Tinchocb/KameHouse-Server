# Línea base del frontend: 2026-11-17 (T0.2)

- **Commit:** `03e7985` (rama `version-2.0`). El árbol de trabajo tiene cambios sin commit de otras sesiones, sobre todo de movimiento y estilos (`kinetics/`, `styles/tokens/animation.css`, `tailwind.config.ts`, `lib/theme/`). Las cifras describen ese árbol, no el commit.
- **Entorno:** Node 26.13.0, pnpm 10.4.0, playwright-core 1.63.0, Chrome en `C:/Program Files/Google/Chrome/Application/chrome.exe`. Backend real en `127.0.0.1:43212` (`apps/server/kamehouse.exe`, arrancado por el usuario).
- **Estado:** medición completa. Calidad, bundle, precache, compilación, recorrido, renders, pedidos e imágenes medidos con datos reales de la biblioteca (28 películas y 6 series).

## 1. Calidad

| Comando | Resultado |
|---|---|
| `pnpm --filter kamehouse-web typecheck` | exit 0 |
| `pnpm --filter kamehouse-web lint` | exit 0, sin errores ni avisos. Solo el aviso de Browserslist: datos de caniuse-lite con seis meses |
| `pnpm --filter kamehouse-web lint:tokens` | exit 0: 1628 clases y 490 variables verificadas. **QA-07 no reproduce**: `routes/series/-series-shelf.css` ya no contiene `--ease-out-strong` |
| `pnpm --filter kamehouse-web test:run` | exit 1. 221 archivos (220 pasan) y 1637 pruebas (1636 pasan) |

**Fallo preexistente:** `src/components/chronology/design-series.guard.test.ts`, caso «la fila compacta de lapso no usa .sectionbar y queda sin backdrop-filter». Espera `bg-surface-container-lowest`. Es un guardián de diseño y no se relaja (regla de la auditoría). Ocurre en Cronología, que es zona de la fase 2: hay que resolverlo antes de tocar esa zona o revisar si lo cambió otra sesión.

## 2. Bundle y precache (build de producción minificado)

| Script inicial | KB min | KB gzip |
|---|---:|---:|
| `index` | 273.6 | 87.7 |
| `lib-react` | 185.5 | 58.5 |
| `7197` (chunk anónimo) | 179.0 | 57.8 |
| `tanstack-router` | 68.2 | 24.1 |
| `ui-primitives` | 64.5 | 19.4 |
| `tanstack-query` | 38.8 | 11.4 |
| `lucide` | 33.3 | 8.8 |
| `fontsource` | 0.1 | 0.1 |
| **Total inicial (8 scripts)** | **843.2** | **267.6** |

- Comparado con Z4 (16/10/2026: 9 scripts, 900.7 KB min, 276.5 KB gzip): −57.5 KB min. Los árboles no son iguales, así que la diferencia no se atribuye a un cambio concreto.
- `ui-primitives` pasa de 103.8 KB (Z4) a 64.5 KB: `cmdk` y `vaul` ya no van forzados al inicial. Select, scroll-area y popover siguen dentro del forzado (T1.1).
- **react-scan no se emite** en producción (DC-02 confirmado).
- **Precache:** 16 entradas, 1329 KB, ninguna `.woff` (0) y 3 `.woff2`. Z4 medía 91 entradas y 4.54 MB; la diferencia viene de las exclusiones de `rsbuild.pwa.ts` (async, hls, jassub, series-icons, fuentes no usadas).
- **`index.css`:** 401 464 bytes, frente a 309 408 de Z4 (+30 %). No es tarea del plan; queda como observación.

## 3. Compilación con React Compiler

Build legible (sin minificar). Método: buscar `compiler_runtime.c)(N)` al inicio del cuerpo de cada componente.

| Componente | Compilado | Tarea |
|---|---|---|
| `MoviesPage` | no | T2.2 (CT-01) |
| `MoviesHero` | no | T2.2 (CT-01) |
| `MovieCard` | no | T2.2 (CT-01) |
| `RootComponent` | **sí** | CT-02 parcial: el shell ya compila |
| `PageTransition` | no | T2.1 (CT-02) |
| `SeriesDetailClient` | no | T2.3 (CT-03) |

El método es heurístico. Antes de cada cambio hay que confirmar el resultado en el build afectado.

**Nota sobre `VITE_SCAN` (T1.2):** en la salida de producción la rama `if (import.meta.env.DEV)` de `main.tsx` desaparece. Solo queda su comentario. La verificación de T1.2 hay que hacerla en dev, no en build.

## 4. Medición con backend real

### 4.1 Recorrido (T0.1)

Inicio (`/home`) → Películas (clic en la navegación), a través del proxy de solo lectura:
- `/home`: 56 peticiones, 8 endpoints. Sin bloqueos.
- Tras el clic: 5 peticiones, 3 endpoints. La URL final es `/movies`.
- El único error es el handshake del WebSocket, que el proxy no reenvía a propósito.

Este recorrido se hizo antes de corregir el proxy (ver 4.5). En esas dos rutas no hubo bloqueos de lectura, así que la corrección no lo cambia.

### 4.2 Renders (build legible, 5 repeticiones, medianas)

| Escenario | Renders | Montajes | Commits | Peticiones | Componentes de la app más activos |
|---|---:|---:|---:|---:|---|
| Cambio de orden en la URL (5 cambios de `sort`) | 2111 | 726 | 68 | 9 | `CatchBoundary` 60, `Button` 49 |
| Hover en 6 tarjetas de Películas | 2653 | 193 | 59 | 17 | `Button` 38, `Popover` 38 |
| Escritura en el buscador («dragon», 150 ms entre teclas) | 180 | 12 | 10 | 1 | `ArrowRight` 24, `ExpandableSearch` 8, `X` 8, `SearchSurface` 8 |
| Inicio → Películas (clic en la navegación) | 484 | 384 | 21 | 4 | `DeferredImage` 25, `MoviePosterCard` 23, `Button` 16, `IconButton` 14 |

- **La mayoría de los renders son internals de framer-motion** (`PresenceChild`, `PopChild`, `motion.div`, `AnimatePresence`, `MeasureLayout`). En el hover llegan a 385 por componente. Son el sistema de movimiento que hoy tiene cambios sin commit.
- En los cambios de orden se remontan unas 145 piezas por cambio (726 montajes en 5 cambios). Conviene confirmar si es el grid entero.
- El hover en las tarjetas abre un `Popover` 38 veces. Hay que ver qué se abre y por qué.

### 4.3 Cargas en frío (3 repeticiones, LCP mediana)

DPR 1 y 1440×900. Service worker bloqueado. Cada carga se hace en un navegador nuevo.

| Ruta | LCP (ms) | Elemento LCP | Peticiones (última) | Imágenes visibles | `lazy` | `fetchpriority` alta | Más del doble de ancho natural | `<img>` a TMDB directo | Peticiones a TMDB (mediana) | URLs repetidas | Bloqueadas |
|---|---:|---|---:|---:|---:|---:|---:|---:|---:|---:|---|
| `/home` | 440 | texto (`text` SVG) | 54 | 3 | 0 | 1 | 1 | 0 | 54 | 0 | — |
| `/series` | 336 | texto (`text` SVG) | 55 | 8 | 0 | 0 | 7 | 7 | 51 | 1 | — |
| `/movies` | 776 | imagen (vía proxy) | 59 | 9 | 0 | 7 | 7 | 8 | 62 | 2 | — |
| `/chronology` | 320 | texto (`text` SVG) | 83 | 51 | 40 | 0 | 36 | 4 | 52 | 0 | — |
| `/settings` | 244 | texto (`text` SVG) | 52 | 1 | 0 | 0 | 1 | 0 | 48 | 0 | — |
| `/series/12609` | 328 | texto (`text` SVG) | 80 | 16 | 0 | 5 | 1 | 13 | 69 | 8 | `POST /api/v1/mediastream/preload` |
| `/movies/1018095` | 292 | texto (`text` SVG) | 58 | 3 | 0 | 1 | 1 | 2 | 50 | 0 | `POST /api/v1/mediastream/preload` |

Hallazgos de esta tabla:
1. **CT-06 no se confirma.** El LCP de las fichas es texto, no el póster (en la línea base de octubre era el póster).
2. **Peticiones directas a `image.tmdb.org`:** 48 a 69 por carga, también en `/settings`, que solo muestra una imagen. No son `<img>` del DOM al medir y no pasan por el proxy ni por su caché. El origen está por confirmar, y es candidato a tarea nueva.
3. **`<img>` del DOM con URL directa a TMDB:** 7 en `/series`, 8 en `/movies`, 13 en la ficha de serie y 4 en Cronología. CT-08 solo cubría el backdrop; el alcance es mayor.
4. **Imágenes repetidas en la misma carga:** `/movies` (2 URLs), `/series` (1) y `/series/12609` (8 URLs, cada una pedida dos veces).
5. **Imágenes sobredimensionadas** (ancho natural más del doble del pintado, a DPR 1): 36 en Cronología (estrellas de 128 px pintadas a 20 px), 7 en `/movies` y 7 en `/series`. A DPR 2 algunas dejan de serlo.
6. **Prioridad alta generalizada:** 7 de 9 imágenes de `/movies` tienen `fetchpriority="high"`, aunque el LCP no es una de ellas.

### 4.4 Qué no cubre esta medición

- Los renders del WebSocket no están: el proxy no reenvía el upgrade.
- Solo DPR 1 y una resolución de escritorio.
- Los escenarios son sintéticos (cambio de orden por `history.pushState`, escritura de 6 letras y 6 hovers). Son repetibles, pero no reproducen un uso real.

### 4.5 Corrección del proxy durante la medición

La primera medición de cargas bloqueó también los `GET` de `continuity/item`. La regla de escrituras se evaluaba antes que el método, y eso dejaba sin progreso de reproducción las páginas de Cronología, serie y película. Se corrigió y las cargas se repitieron (`results-loads.json`). El resultado anterior se conserva en `results-all.before-proxy-fix.json`. Los renders no se vieron afectados, porque en esos escenarios no hubo bloqueos.

El `POST /api/v1/mediastream/preload` se mantiene bloqueado a propósito: es una acción del servidor que prepara medios, no una lectura.

## 5. Método

- Scripts en la carpeta de trabajo, fuera del repo: `proxy.cjs`, `measure.cjs`, `analyze-bundle.cjs`, `compile-check.cjs`, `summarize.cjs`, `details.cjs` y `loads.cjs`.
- Resultados brutos: `results-all.json` (renders y primera carga), `results-loads.json` (cargas válidas) y los registros del proxy por carga.
- Build con una config temporal que solo cambia la carpeta de salida (y `minify: false` en la variante legible). La config temporal se borró al terminar.
- Salidas fuera de `apps/web/out/`.
- `apps/web/public/sw-custom.js` existía antes de la medición. El build lo reescribe, así que se restauró desde una copia (idéntico al respaldo).
- Los procesos de prueba (proxies) se cerraron al terminar. Los puertos 43390 y 43391 quedan libres.
