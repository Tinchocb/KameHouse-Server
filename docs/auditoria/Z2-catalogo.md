# Auditoría Z2 — Catálogo y navegación

- **Zona:** `routes/home`, `routes/series`, `routes/movies`, `routes/chronology`, `components/shared`, `components/chronology`, `components/media-detail`, `routes/__root.tsx` (más `hooks/use-tv-dpad.ts` y `hooks/use-hero.ts`, porque los usa el shell de la zona).
- **Commit de lectura:** `a249c13` (rama `version-2.0`). **Ojo:** casi todos los archivos citados tienen cambios sin commitear de otras sesiones (`git status` los marca `M` o `??`). Los bloques ANTES y las líneas son del árbol de trabajo del 16/10, no del commit. Antes de cada paso, releé el símbolo.
- **Modo:** auditoría. No se modificó ningún archivo del repo salvo este. Las mediciones se hicieron con builds de producción en `scratch/z2-catalogo/`, que se borró al terminar.

---

## 1. Hallazgos

| ID | Sev. | Conf. | Archivo › símbolo | Tipo | Problema | Riesgo |
|----|------|-------|-------------------|------|----------|--------|
| CT-01 | MEDIA | ALTA | `routes/movies/index.lazy.tsx` › `MoviesPage` (L43; causa en L187)<br>`routes/movies/-components/movies-hero.tsx` › `MoviesHero` (L55; causas en L120, L150 y L188)<br>`routes/movies/-MovieCard.tsx` › `MovieCard` (L54; causa en L111) | rendimiento | **El React Compiler se saltea los tres componentes de Películas.** El build de producción los deja sin `compiler_runtime.c`. Los motivos, que da el compilador (1.0.0): (a) un `?.` dentro de una llamada que es la condición de un `\|\|` o `??` (*Unexpected terminal kind `optional` for logical test block*); (b) `?.`, `\|\|` o `??` dentro de un `try` (*Support value blocks … within a try/catch*); (c) un `useCallback` con deps que el compilador no puede preservar (falta `setShuffleQueue`). Medido A/B (A contra C; C también incluye CT-02 y CT-03, así que la atribución a CT-01 es directa solo para el hover): renders −66 % al hacer hover, −54 % al tipear y −12 % al entrar. | MEDIO |
| CT-02 | BAJA | ALTA | `routes/__root.tsx` › `RootComponent` (L107; causa en L242)<br>`components/shared/page-transition.tsx` › `PageTransition` (L93; causa en L214) | rendimiento | **El shell tampoco se compila.** `RootComponent` cae por el `import("@tauri-apps/api/event")` dentro de un efecto (*Handle Import expressions*), y `PageTransition` por `--remaining` sobre una variable capturada por un closure (*UpdateExpression to variables captured within lambdas*). Como `RootComponent` no memoiza su JSX, cada render suyo vuelve a renderizar unos 13 hijos del shell (`AppLayout`, `FloatingPillNav`, `AppTopNav`, `CommandPalette`, `PageTransition`, `AppBottomNav`…). Medido: pasa una vez por cada cambio de búsqueda en la URL. | MEDIO |
| CT-03 | BAJA | MEDIA | `routes/series/$seriesId/index.lazy.tsx` › `SeriesDetailClient` (L87; causa en L195–L202) | rendimiento | **La ficha de serie no se compila.** El motivo es el `try { … \|\| … }` del inicializador de `zVariant`. Es un componente de unas 570 líneas que envuelve la ficha completa. El salto está confirmado; el beneficio no se midió (ver Pendientes). | BAJO |
| CT-04 | BAJA | ALTA | `hooks/use-tv-dpad.ts` › `useTvDpad` (L14, llamado desde `__root.tsx` L111) | rendimiento | **`useLocation()` sin selector dentro del root** (la decisión previa marca esto como hallazgo válido). Solo lee `location.pathname`, pero se suscribe a toda la ubicación. Medido A/B: +1 render de `RootComponent` por cada cambio de búsqueda (`?q=`, filtros) y 7–8 contra 4 en el arranque. Con CT-02 sin resolver, cada uno arrastra unos 13 hijos del shell. | BAJO |
| CT-05 | MEDIA | ALTA | `routes/movies/$movieId.lazy.tsx` › `MovieDetailClient`, prop `posterUrl` (L302)<br>`components/media-detail/detail-hero.tsx` › `DetailHero`, `<img>` del póster (L182) | rendimiento / robustez | **El póster de la ficha de película es el LCP y se pide directo a TMDB en w780 para una caja de 240 px.** `getHighResImage` devuelve la URL cruda, sin `localImage`, así que saltea el proxy (`/api/v1/image-proxy`) y su caché en disco del servidor. Tampoco lleva `fetchpriority`. Medido: es el elemento LCP de `/movies/1039322`, con LCP de 1304 ms (natural 780 px, pintado a 238 px) y 1 pedido directo a `image.tmdb.org`. | BAJO |
| CT-06 | MEDIA | MEDIA | `components/ui/media-hero.tsx` › `MediaHero`, `<DeferredImage>` del póster (L324; lo usa `series-hero.tsx` L235) | rendimiento | **El póster de la ficha de serie es el LCP, pero va con `loading=lazy` y espera al IntersectionObserver** (no se le pasa `priority`). Además, el `sizes` por defecto de `DeferredImage` (`…, 500px`) baja w500 para una caja de 176 px. Medido: LCP de `/series/12971` = esa imagen, a 1048 ms (natural 500, pintada a 174). La ganancia no está medida, así que el paso queda condicionado. Medido con DPR 1; a DPR 2 el mismo `sizes` pide 1000 px y el beneficio es mayor en pantallas retina. | BAJO |
| CT-07 | MEDIA | ALTA | `lib/helpers/goku-panorama.ts` › `SPINE_ART_URLS` + `routes/__root.tsx` › precarga en idle (L138)<br>`public/icons/series-icons/*/*.png` | memoria / red | **Las 12 figuras que precarga `SPINE_ART_URLS` pesan 5,7 MB en PNG (≈5,4 MiB) y, decodificadas a tamaño natural, suman ≈46 MB (≈44 MiB). Los 16 PNG de `public/icons/series-icons` pesan 6,85 MB y suman ≈56 MB decodificados; 4 de ellos no los pide la app.** Los bytes decodificados son un cálculo w×h×4, no una medición de memoria. Se piden y se decodifican (`img.decode()`) en cada arranque, aunque no se entre a Series, y se pintan a 163–311 px de ancho. `pluginImageCompress` no toca `public/`. Ejemplos: `dbgt/combate-ssj4.png` mide 1409×2400 (12,9 MB decodificada) y `dbgt/reposo-anime.png` pesa 1,3 MB. Los PNG son trabajo **nuevo sin commitear** de otra sesión: reemplazaron a los `goku-raw-*.webp`. | BAJO (en espera) |
| CT-08 | BAJA | ALTA | `components/shared/dynamic-backdrop.tsx` › `DynamicBackdrop` (L95, L184) | red / robustez | **Las capas y la precarga del backdrop global usan `getLowResImage` sin `localImage`**, así que piden w185 directo a TMDB. Medido: 2 pedidos `css` directos a `image.tmdb.org` al cargar `/movies` (la capa aparece durante el fundido a `null` del hero rotativo). | BAJO |
| CT-09 | BAJA | ALTA | `routes/movies/-components/movies-rows.tsx` › `MoviesRowsProps.continueMovies` y `.recentMovies` (L106, L108)<br>`routes/movies/index.lazy.tsx` › `useMemo` de filas (L263–L281) | código muerto (CONFIRMADO) | `MoviesRows` declara `continueMovies` y `recentMovies` pero no los desestructura ni los usa: solo pinta "Para ver de nuevo". `MoviesPage` igual los calcula (filtro, `isNewlyAdded` y dos `sort`) en cada cambio de filtros. | BAJO |

### Mediciones hechas (método)

**Build y servidor.** Builds de producción (`NODE_ENV=production`, React Compiler activo) con una config temporal que importaba `apps/web/rsbuild.config.ts` y cambiaba `output.distPath.root` a `scratch/z2-catalogo/out-<variante>` y `output.minify: false`, para leer nombres de componentes. Sigue siendo producción: no hay `jsxDEV`. Las variantes se armaron sin tocar el repo:

- **A:** base.
- **B:** alias `@/hooks/use-tv-dpad$` hacia una copia de `useTvDpad` con `useLocation({ select: l => l.pathname })`.
- **C:** pre-loader de Rspack (`enforce: "pre"`) que aplicaba en memoria los arreglos de CT-01, CT-02 y CT-03 (los mismos DESPUÉS de este plan).

Cada variante se sirvió con un servidor Node propio en 43291–43293 que proxeaba `/api` a 43212 y **bloqueaba todo lo que no fuera GET** (más el POST de lectura de `library/collection`). Hubo 0 pedidos bloqueados en las rutas medidas. Se verificó que el HTML trae scripts con hash.

**Navegador.** Chrome headless (`playwright-core` + `C:/Program Files/Google/Chrome/Application/chrome.exe`), 1440×900, `deviceScaleFactor 1`, `serviceWorkers: "block"`, navegador nuevo por corrida.

**Renders.** Gancho falso `__REACT_DEVTOOLS_GLOBAL_HOOK__` (en `addInitScript`). En cada `onCommitFiberRoot` recorre el árbol y cuenta las fibras compuestas (tags 0, 1, 11 y 15) cuyo `memoizedProps` o `memoizedState` cambió de identidad desde el último commit. Así se excluyen los *bailouts*. Los tiempos son deltas de CDP `Performance.getMetrics` (`ScriptDuration`, `RecalcStyleDuration`, `LayoutDuration`, `TaskDuration`).

**Compilación.** Se buscó `compiler_runtime.c)(N)` como primera sentencia de cada componente del bundle. Los motivos salen de correr `babel-plugin-react-compiler` 1.0.0 (`target: "19"`, `panicThreshold: "none"`, con `logger.logEvent`) sobre cada archivo de la zona.

**Imágenes.** Por ruta, en carga dura: `PerformanceObserver` de `largest-contentful-paint` y `layout-shift` en el init script, inventario de `document.images` (`loading`, `decoding`, `fetchpriority`, `srcset`, `sizes`, natural contra pintado) y `requestfinished` de imágenes con `responseBodySize`.

**Renders y tiempos, A contra C**, dos rondas alternadas A, C, A, C en la misma sesión. Hay otras sesiones activas, así que los tiempos se mueven ±20–30 % y los conteos son el dato firme.

| Escenario | Renders A (r1 / r2) | Renders C (r1 / r2) | JS ms A | JS ms C |
|---|---|---|---|---|
| Entrar a `/movies` (1.ª vez) | 1537 / 1539 | 1358 / 1358 | 141 / 151 | 142 / 153 |
| Entrar a `/movies` (2.ª vez) | 1445 / 1447 | 1279 / 1279 | 90 / 96 | 87 / 87 |
| Tipear "z" en el buscador de `/movies` (q a la URL) | 1191 / 1402 | 666 / 539 | 96 / 149 | 71 / 65 |
| Hover sobre 6 tarjetas de `/movies` (400 ms c/u) | 3033 / 3024 | 1032 / 1025 | 321 / 292 | 270 / 299 |
| Entrar a `/series`, `/chronology`, `/home` | 182 / 1180 / 289 | 172 / 1170 / 279 | ≈ | ≈ |

El hover y el tipeo ocupan además mucho recálculo de estilo (~540 ms el hover, igual en A y en C). Ese costo no lo resuelve el compilador; ver Pendientes.

**`useTvDpad`, A contra B** (misma corrida, conteos):

| | A | B |
|---|---|---|
| `RootComponent` en el arranque de `/home` | 8 | 4 |
| `RootComponent` al tipear en `/movies` | 1 (más 13 hijos del shell con 1 render cada uno) | 0 |
| Navegaciones | 1 por navegación | 1 por navegación |

En las navegaciones, ese render viene de `useIsFetching`, no de `useTvDpad`.

**Imágenes (variante A, carga dura):**

| Ruta | LCP | CLS | Notas |
|---|---|---|---|
| `/home` | `IMG /backdrops/db.webp`, 1508 ms (851 KB pintados) | 0,019 | El hero lleva `fetchpriority=high`, `loading=eager` y `sizes`. Correcto. |
| `/movies` | hero, proxy w1280, 1044 ms | 0,010 | 2 pedidos `css` w185 y 2 `img` w300 `?kh-cors=1` directos a TMDB. Los w300 son `getPixelSampleImage` para la paleta: son deliberados y no se tocan. Los w185 son CT-08. |
| `/series` | figura `dbz/normal.png`, 568 ms | 0,0005 | 13 imágenes pintadas a menos de la mitad de su tamaño natural (CT-07). |
| `/series?view=etapas` | póster w342, 980 ms | 0,0005 | Correcto. |
| `/chronology` | miniatura w780, 940 ms | 0,0005 | El LCP va con `loading=lazy` y `fetchpriority=high` (ver Descartado). |
| `/series/12971` | póster w500 pintado a 174 px, 1048 ms | 0,0005 | CT-06. |
| `/movies/1039322` | póster **directo a TMDB** w780 pintado a 238 px, 1304 ms | 0,0005 | CT-05. |

**Pedidos de imagen en un arranque en frío** de `/movies/1039322` (sin caché, sin SW): 75 imágenes y 8,8 MB.

- 12 PNG de `/icons/series-icons` (5,7 MB, CT-07).
- 39 pósters w342 por el proxy (2,4 MB). Salen de los loaders de `/movies` y `/series`, que se precargan en idle desde el root. Es decisión previa y no se reabre.
- El resto es menor.

### Pendiente de medir

1. **Costo de estilo en el hover de Películas.** Medido: unos 540 ms de `RecalcStyle` y 2,6 s de `TaskDuration` en ~3,6 s de hover sobre 6 tarjetas, iguales en A y en C. Falta un perfil de CPU o un trace para atribuirlo (¿barra de progreso de `HeroCarouselDots`, fundido del hero, `whileHover` de framer?). No se propone cambio sin esa atribución.
2. **CT-03:** renders y JS de la ficha de serie al entrar y al cambiar de pestaña o saga, A contra C. No entró en el guion medido.
3. **CT-06:** LCP de `/series/:id` A/B con `priority` y `sizes` en `MediaHero`.
4. **CT-07:** bytes y memoria (`performance.measureUserAgentSpecificMemory` o el heap de la pestaña de GPU) con figuras re-exportadas, antes y después.

### Dependencias entre pasos

- P2.2 (CT-02) y P2.3 (CT-04) tocan el mismo camino de renders del root. Medí P2.3 **después** de P2.2: con el root compilado, el render extra de CT-04 ya no arrastra al shell. Igual conviene aplicarlo, porque es 1 línea.
- P2.1 (CT-01) y P1.1 (CT-09) tocan `routes/movies/index.lazy.tsx`. Aplicá P1.1 primero y releé el ANTES de P2.1.
- P2.7 (CT-07) espera a la sesión que está reemplazando las figuras (los PNG están `??` en git).
- P3.1 (guardián del compilador) va al final: si se agrega antes, falla por CT-01 a CT-03.

### Alcance real

**Leídos completos:** `routes/__root.tsx`, `routes/home/index.tsx`, `routes/series/index.lazy.tsx`, `routes/movies/index.lazy.tsx`, `routes/movies/-components/movies-grid.tsx`, `components/shared/app-error-boundary.tsx`, `components/shared/dynamic-backdrop.tsx`, `hooks/use-tv-dpad.ts`, `hooks/use-hero.ts` y `hooks/use-home-intelligence.ts`.

**Recorridos por tramos:**

- `routes/chronology/index.lazy.tsx` (L1–330)
- `routes/movies/-components/movies-hero.tsx` (L55–220)
- `routes/movies/-MovieCard.tsx` (L54–140, L280–310)
- `routes/movies/-components/movies-rows.tsx` (L100–150)
- `routes/movies/$movieId.lazy.tsx` (L120–140, L295–310)
- `routes/series/$seriesId/index.lazy.tsx` (L87–240)
- `routes/series/-SeriesCard.tsx` (L150–210)
- `components/shared/page-transition.tsx` (L93–230)
- `components/shared/deferred-image.tsx` (L1–140)
- `components/media-detail/detail-hero.tsx` (L170–215)
- `components/ui/media-hero.tsx` (L125–175, L315–340)
- `components/ui/media-spotlight.tsx` (L240–420)
- `components/chronology/TimelineVolumeCard.tsx` (L180–200)
- `lib/helpers/images.ts` (L36–160)
- `lib/theme/theme-hooks.ts` › `useThemeSettings`
- `hooks/use-sound.ts`

**Barridos con grep en toda la zona:** `useRouterState`, `useLocation`, `useMatch*`, contextos y `Provider`, stores sin selector, `<img>` y `DeferredImage` con sus atributos.

**Barrido con el compilador:** todos los `.tsx` de la zona (no-tests), salida en la sección 3.

**No auditados en detalle:** el resto de `components/chronology/*`, `premium-episode-list.tsx` (decisión previa), `routes/home/home.mappers.ts` y `components/shared/global-queue-sidebar.tsx` / `performance-monitor.tsx` (este último es solo de dev).

### Descartado (con motivo)

- **Virtualizar grillas de pósters.** La biblioteca real tiene 27 películas y 6 series. `MoviesGrid` ya virtualiza desde 150 títulos (`VIRTUALIZE_FROM`) y usa `content-visibility:auto`. `/series?view=etapas` monta 305–402 nodos. `/chronology` (2949 nodos, 1052 montajes) ya tiene `EAGER_ROWS` y diferir eras está descartado. Virtualizar con 6 a 27 ítems no compensa el riesgo para el D-pad (`useTvDpad` solo ve nodos montados), para la restauración de scroll ni para `DeferredMount`.
- **`app-error-boundary.tsx` › `useLocation()` sin selector.** Solo se monta cuando hay un error, para detectar el cambio de ruta y resetearse. No afecta los renders normales.
- **`TimelineVolumeCard` con `fetchPriority="high"` en todas las tarjetas.** Es un antipatrón, pero en la carga solo hay 16 imágenes montadas (7 visibles) y la LCP ya es una de ellas. No hay evidencia de daño.
- **`useHeroBackdrop` en Inicio y Películas.** `DynamicBackdrop` no pinta la imagen en páginas con hero propio (`hasLocalHeroAura`). Quitarlo cambiaría el fondo que hereda `/admin`, porque `useHeroBackdrop` no limpia al desmontar. Hace falta decidirlo visualmente y no hay evidencia de costo: solo ~2 renders de `DynamicBackdrop` por rotación.
- **Recetas de imágenes de `/home` y `/series?view=etapas`.** Ya son correctas.

---

## 2. Plan

### Procedimiento de medición (lo usan los pasos de la fase 2)

1. `export MSYS_NO_PATHCONV=1`.
2. Config temporal `scratch/z2-medir/rsbuild.medir.config.ts` (scratch está en `.gitignore`), con el cwd en `apps/web`:

   ```ts
   import path from "path"
   import base from "../../apps/web/rsbuild.config"
   const b = base as any
   export default { ...b, output: { ...b.output, minify: false, distPath: { ...b.output.distPath, root: path.resolve(__dirname, process.env.OUT || "out") } } }
   ```

3. Build: `cd apps/web && NODE_ENV=production OUT=out-antes npx rsbuild build -c ../../scratch/z2-medir/rsbuild.medir.config.ts`. Repetí con `OUT=out-despues` después del cambio. Para tener A y B en la misma corrida, construí `out-antes` antes de editar.
4. Servilo con un servidor estático que proxee `/api` a `127.0.0.1:43212` y responda 204 a todo lo que no sea GET (salvo `POST /api/v1/library/collection`), en un puerto libre que no sea 43211, 43210 ni 43212. Verificá que `index.html` trae `static/js/*.<hash>.js`.
5. Contador de renders (en `context.addInitScript`, antes de cargar la página):

   ```js
   const seen = new WeakMap(), stats = { total: 0, renders: {} }, COMP = new Set([0, 1, 11, 15])
   const name = (f) => typeof f.type === "function" ? (f.type.displayName || f.type.name) : f.type?.render?.name || f.type?.type?.name || "?"
   function walk(root) { const st = [root]; while (st.length) { const f = st.pop(); if (!f) continue
     if (COMP.has(f.tag)) { const r = seen.get(f) || (f.alternate && seen.get(f.alternate))
       if (!r || r.p !== f.memoizedProps || r.s !== f.memoizedState) { stats.total++; const n = name(f); stats.renders[n] = (stats.renders[n] || 0) + 1 }
       const rec = r || {}; rec.p = f.memoizedProps; rec.s = f.memoizedState; seen.set(f, rec); if (f.alternate) seen.set(f.alternate, rec) }
     if (f.sibling) st.push(f.sibling); if (f.child) st.push(f.child) } }
   window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = { isDisabled: false, supportsFiber: true, renderers: new Map(), inject(r) { this.renderers.set(1, r); return 1 },
     onCommitFiberRoot(_, root) { walk(root.current) }, onCommitFiberUnmount() {}, onPostCommitFiberRoot() {}, checkDCE() {}, onScheduleFiberRoot() {}, setStrictMode() {} }
   window.__z2 = { stats, reset() { stats.total = 0; stats.renders = {} } }
   ```

6. Chrome headless (`playwright-core`, `executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe"`), 1440×900, `serviceWorkers: "block"`. Usá CDP `Performance.getMetrics` para `ScriptDuration` y `RecalcStyleDuration`. Corré A, B, A, B y anotá conteos y tiempos.
7. Para confirmar que un componente se compila, buscá en el bundle `function <Nombre>(` seguido de `const $ = (0,compiler_runtime.c)(`. También sirve correr el compilador con logger (ver P3.1).
8. Al terminar, borrá `scratch/z2-medir/` y matá el servidor por PID o puerto.

### Fase 1 — Código muerto

**P1.1 · CT-09 · Riesgo BAJO.** Quitar las props muertas `continueMovies` y `recentMovies`.

- **Símbolos:** `MoviesRowsProps.continueMovies` y `MoviesRowsProps.recentMovies` (`routes/movies/-components/movies-rows.tsx` L106–L108), las props que pasa `MoviesPage` (`index.lazy.tsx` L388 y L390) y su cálculo (L263–L281).
- **Evidencia de cero consumidores:** `rg -n "continueMovies|recentMovies" apps/web/src` solo encuentra la interfaz, el `useMemo` y el JSX de `MoviesPage`. `MoviesRows` desestructura `{ watchHistory, watchedMovies, handleMovieClick, handleHoverCard }` (L118). `rg -n "MoviesRows" apps/web/src` muestra un único consumidor: `routes/movies/index.lazy.tsx`.
- **Acción en `movies-rows.tsx`:** borrar las líneas `continueMovies: MovieEntry[]` y `recentMovies: MovieEntry[]` de `MoviesRowsProps`.
- **Acción en `index.lazy.tsx`:** reemplazar el `useMemo` de L263–L281 por esto y borrar las dos props del JSX de `<MoviesRows>`:

  ```tsx
  const watchedMovies = useMemo(() => {
      if (!showRows) return []
      return scopedEntries.filter((m) => m.mediaId != null && movieStatuses.get(m.mediaId) === "watched")
  }, [showRows, scopedEntries, movieStatuses])
  ```

  Si el import de `isNewlyAdded` (L13) queda sin uso, dejá solo `getAddedBaseline`: `addedBaseline` sigue yendo a `MoviesGrid`.
- **Validación:** `pnpm --filter kamehouse-web typecheck`, `lint` y `vitest run src/routes/movies`. En `/movies` con historial, la fila "Para ver de nuevo" muestra los mismos títulos, en el mismo orden que antes (orden de `scopedEntries`).

### Fase 2 — Rendimiento

#### P2.1 · CT-01 · Riesgo MEDIO · Hacer compilables `MoviesPage`, `MoviesHero` y `MovieCard`

**A. Problema.** React Compiler 1.0.0 abandona los tres componentes por sintaxis que todavía no soporta. Cada hover o filtro re-renderiza el hero completo, las filas y las tarjetas sin memoización.

**B. Evidencia.** El compilador con logger da estos motivos:

- `MoviesPage`: *Unexpected terminal kind `optional` for logical test block* @190:33.
- `MoviesHero`: el mismo @152:16. Después, *Existing memoization could not be preserved* (inferido `setShuffleQueue`) @96. Después, *value blocks within try/catch* @190:30.
- `MovieCard`: *value blocks within try/catch* @113:30.

En el bundle de A, ninguno de los tres empieza con `compiler_runtime.c`. Con los cambios de abajo (variante C) los tres compilan, y se midió: renders del hover 3030 → 1030, del tipeo ~1300 → ~600 y al entrar a `/movies` 1538 → 1358. Ver la tabla de la sección 1.

**C. Código ANTES**

`routes/movies/index.lazy.tsx` (dentro del `useMemo` de `categorizedData`, L181–L196):

```tsx
            const swimlaneItem: SwimlaneItem = {
                id: `media-${m.mediaId}`,
                mediaId: m.mediaId ?? undefined,
                tmdbId: m.media?.tmdbId ?? undefined,
                title: getEntryTitle(m),
                image: m.media?.posterImage || "",
                backdropUrl: getMovieWidescreenBackdrop({
                    mediaId: m.mediaId,
                    tmdbId: m.media?.tmdbId,
                    bannerImage: m.media?.bannerImage,
                    posterImage: m.media?.posterImage,
                }) || undefined,
                year: m.media?.year,
                badge: m.media?.format || "MOVIE",
                onClick: () => {},
            }
```

`routes/movies/-components/movies-hero.tsx` (L120, L150–L155 y L185–L213):

```tsx
    }, [topFeatured.length, featuredIndex])
```

```tsx
    const heroArt = getMovieHeroArt({
        mediaId: currentMovie?.mediaId,
        tmdbId: displayMedia?.tmdbId,
        bannerImage: displayMedia?.bannerImage,
        posterImage: displayMedia?.posterImage,
    }) ?? (displayMedia?.bannerImage ? heroArtFromUrl(displayMedia.bannerImage, { focal: DEFAULT_MOVIE_FOCAL }) : null)
```

```tsx
    const handleAddToQueue = async (e: React.MouseEvent) => {
        e.stopPropagation()
        if (!currentMovie?.mediaId) return
        try {
            const fullEntry = await fetchAnimeEntry(String(currentMovie.mediaId))
            const localFile = fullEntry?.localFiles?.[0]
            if (localFile && localFile.path) {
                useQueueStore.getState().addToQueue({
                    id: currentMovie.mediaId,
                    title: movieTitle,
                    playableUrl: localFile.path,
                    thumbnail: getMediumResImage(displayMedia?.posterImage || ""),
                    mediaId: currentMovie.mediaId,
                    episodeNumber: 1,
                    malId: displayMedia?.idMal ?? null,
                    mediaFormat: displayMedia?.format ?? "MOVIE",
                })
                flashQueued()
                toast.success("Añadida a Mi Lista", {
                    description: movieTitle,
                })
            } else {
                toast.info("Esta película no tiene archivos locales para reproducir.")
            }
        } catch (err) {
            console.error(err)
            toast.error("No se pudo añadir a Mi Lista")
        }
    }
```

`routes/movies/-MovieCard.tsx` (L108–L138):

```tsx
    const handleQuickQueue = useCallback(async (e: { stopPropagation: () => void }) => {
        e.stopPropagation()
        if (!mediaId) return
        try {
            const fullEntry = await fetchAnimeEntry(String(mediaId))
            const localFile = fullEntry?.localFiles?.[0]
            if (localFile && localFile.path) {
                const epNum = localFile.parsedInfo?.episode || localFile.metadata?.episode || 1
                useQueueStore.getState().addToQueue({
                    id: mediaId,
                    title: title,
                    playableUrl: localFile.path,
                    thumbnail: getMediumResImage(posterImage || ""),
                    mediaId: mediaId,
                    episodeNumber: Number(epNum),
                    malId: idMal ?? null,
                    mediaFormat: format ?? "MOVIE"
                }, { openSidebar: false })
                toast.success("Añadida a Mi Lista", {
                    description: title,
                })
                playSound("category", 0.35)
                triggerJustQueued()
            } else {
                toast.info("Esta película no tiene archivos locales para reproducir.")
            }
        } catch (err) {
            console.error(err)
            toast.error("No se pudo añadir a Mi Lista")
        }
    }, [mediaId, posterImage, idMal, format, title, playSound, triggerJustQueued])
```

**D. Código DESPUÉS**

Archivo nuevo `routes/movies/-components/movies-queue.ts` (con prefijo `-`, así que no es una ruta). Saca el `try` del componente y comparte la lógica entre la tarjeta y el hero:

```ts
import { fetchAnimeEntry } from "@/api/hooks/anime_entries.hooks"

export interface MovieLocalFile {
    path: string
    episode: number
}

/**
 * Primer archivo local de una película para Mi Lista: `null` si no tiene archivos, `undefined` si el
 * pedido falló. Vive fuera de los componentes porque React Compiler (1.0) no compila un `try` con
 * `?.`, `||` o `??` adentro y abandonaba la tarjeta y el hero enteros.
 */
export async function fetchMovieLocalFile(mediaId: number): Promise<MovieLocalFile | null | undefined> {
    try {
        const fullEntry = await fetchAnimeEntry(String(mediaId))
        const localFile = fullEntry?.localFiles?.[0]
        if (!localFile || !localFile.path) return null
        return { path: localFile.path, episode: Number(localFile.parsedInfo?.episode || localFile.metadata?.episode || 1) }
    } catch (err) {
        console.error(err)
        return undefined
    }
}
```

> Verificá la ruta real del import de `fetchAnimeEntry` con el import que ya tienen `-MovieCard.tsx` y `movies-hero.tsx`, y usá ese mismo.

`routes/movies/index.lazy.tsx`, el mismo bloque:

```tsx
            const widescreenBackdrop = getMovieWidescreenBackdrop({
                mediaId: m.mediaId,
                tmdbId: m.media?.tmdbId,
                bannerImage: m.media?.bannerImage,
                posterImage: m.media?.posterImage,
            })
            const swimlaneItem: SwimlaneItem = {
                id: `media-${m.mediaId}`,
                mediaId: m.mediaId ?? undefined,
                tmdbId: m.media?.tmdbId ?? undefined,
                title: getEntryTitle(m),
                image: m.media?.posterImage || "",
                backdropUrl: widescreenBackdrop || undefined,
                year: m.media?.year,
                badge: m.media?.format || "MOVIE",
                onClick: () => {},
            }
```

`routes/movies/-components/movies-hero.tsx`. Importá `fetchMovieLocalFile` desde `./movies-queue` y quitá el import de `fetchAnimeEntry` si queda sin uso:

```tsx
    }, [topFeatured.length, featuredIndex, setShuffleQueue])
```

```tsx
    const curatedHeroArt = getMovieHeroArt({
        mediaId: currentMovie?.mediaId,
        tmdbId: displayMedia?.tmdbId,
        bannerImage: displayMedia?.bannerImage,
        posterImage: displayMedia?.posterImage,
    })
    const bannerFallback = displayMedia?.bannerImage
    const heroArt = curatedHeroArt ?? (bannerFallback ? heroArtFromUrl(bannerFallback, { focal: DEFAULT_MOVIE_FOCAL }) : null)
```

```tsx
    const handleAddToQueue = async (e: React.MouseEvent) => {
        e.stopPropagation()
        if (!currentMovie?.mediaId) return
        const localFile = await fetchMovieLocalFile(currentMovie.mediaId)
        if (localFile === undefined) {
            toast.error("No se pudo añadir a Mi Lista")
            return
        }
        if (!localFile) {
            toast.info("Esta película no tiene archivos locales para reproducir.")
            return
        }
        useQueueStore.getState().addToQueue({
            id: currentMovie.mediaId,
            title: movieTitle,
            playableUrl: localFile.path,
            thumbnail: getMediumResImage(displayMedia?.posterImage || ""),
            mediaId: currentMovie.mediaId,
            episodeNumber: 1,
            malId: displayMedia?.idMal ?? null,
            mediaFormat: displayMedia?.format ?? "MOVIE",
        })
        flashQueued()
        toast.success("Añadida a Mi Lista", {
            description: movieTitle,
        })
    }
```

`routes/movies/-MovieCard.tsx`. Importá `fetchMovieLocalFile` desde `./-components/movies-queue` y quitá `fetchAnimeEntry` si queda sin uso:

```tsx
    const handleQuickQueue = useCallback(async (e: { stopPropagation: () => void }) => {
        e.stopPropagation()
        if (!mediaId) return
        const localFile = await fetchMovieLocalFile(mediaId)
        if (localFile === undefined) {
            toast.error("No se pudo añadir a Mi Lista")
            return
        }
        if (!localFile) {
            toast.info("Esta película no tiene archivos locales para reproducir.")
            return
        }
        useQueueStore.getState().addToQueue({
            id: mediaId,
            title: title,
            playableUrl: localFile.path,
            thumbnail: getMediumResImage(posterImage || ""),
            mediaId: mediaId,
            episodeNumber: localFile.episode,
            malId: idMal ?? null,
            mediaFormat: format ?? "MOVIE"
        }, { openSidebar: false })
        toast.success("Añadida a Mi Lista", {
            description: title,
        })
        playSound("category", 0.35)
        triggerJustQueued()
    }, [mediaId, posterImage, idMal, format, title, playSound, triggerJustQueued])
```

**E. Cambios secundarios.**

- `-MovieCard.test.tsx` (sin commitear): revisá si mockea `fetchAnimeEntry`. Si lo hace, seguirá funcionando, porque `movies-queue.ts` lo importa del mismo módulo.
- El hero de Películas usa `episodeNumber: 1` fijo. Se mantiene igual: no es parte de este paso.
- Cambio de comportamiento menor: antes, una excepción dentro de `addToQueue` o de `toast` caía en el `catch` y mostraba "No se pudo añadir". Ahora solo los fallos del pedido muestran ese aviso. `addToQueue` es síncrono sobre zustand.

**F. Justificación y costo.** Son unas 40 líneas movidas y ninguna API nueva. Habilita la memoización en la pantalla de Películas, que es la que más re-renderiza por interacción (hover, tipeo y filtros van a la URL). El beneficio medido está en renders. El JS baja poco (−7 a −30 %, dentro del ruido en el hover), porque ahí manda el recálculo de estilo (Pendiente 1).

**G. Validación.**

1. `pnpm --filter kamehouse-web typecheck`, `lint`, `test:run` (o `vitest run src/routes/movies`) y `build`.
2. Corré el compilador con logger (P3.1, o el comando de la sección 3) sobre los 3 archivos: los tres sin `CompileError`.
3. Procedimiento de medición: hover sobre 6 tarjetas y tipeo de "z", antes y después, dos rondas alternadas. Esperado: renders del hover ≤ 1100 (antes ~3030) y del tipeo ≤ 700 (antes ~1200–1400).
4. A mano en `/movies`: el hero cambia con el hover, los filtros y la búsqueda actualizan la URL, el botón Mi Lista de la tarjeta y del hero agrega y muestra ✓ y el toast, y en un archivo sin locales aparece el aviso informativo. Navegación con flechas (D-pad, `tvMode`) por las tarjetas.

**H. Criterio de aceptación.** Los 3 componentes aparecen compilados en el bundle, los renders bajan al menos un 50 % en hover y tipeo, y no cambia ningún comportamiento visible.

**I. Reversión.** Restaurá `routes/movies/index.lazy.tsx`, `routes/movies/-components/movies-hero.tsx` y `routes/movies/-MovieCard.tsx`, y borrá `routes/movies/-components/movies-queue.ts`.

#### P2.2 · CT-02 · Riesgo MEDIO · Hacer compilables `RootComponent` y `PageTransition`

**A. Problema.** El root y la transición de página no se compilan. Cada render del root vuelve a renderizar unos 13 hijos del shell.

**B. Evidencia.**

- `RootComponent`: *(BuildHIR::lowerExpression) Handle Import expressions* @242:12.
- `PageTransition`: *Handle UpdateExpression to variables captured within lambdas* @214:16.

En la variante C, con los cambios de abajo, los dos compilan y el arranque y las navegaciones funcionan con los mismos renders (`RootComponent` 1 por navegación).

**C. Código ANTES**

`routes/__root.tsx` (L241–L252):

```tsx
        if (__isTauriDesktop__) {
            import("@tauri-apps/api/event")
                .then(({ listen }) =>
                    listen("splash-closed", () => {
```

`components/shared/page-transition.tsx` (L211–L217):

```tsx
        let remaining = all.length + (returning ? 1 : 0)
        const done = () => {
            if (!token.live) return
            if (--remaining > 0) return
            container?.removeAttribute(PAGE_ENTERING_ATTR)
            window.dispatchEvent(new Event(PAGE_ENTERED_EVENT))
        }
```

**D. Código DESPUÉS**

`routes/__root.tsx`. Agregá esto a nivel de módulo, justo antes de `function RootComponent()`:

```tsx
/** Fuera del componente: React Compiler (1.0) no compila un `import()` dentro de un componente
 *  y abandonaba el root entero (que envuelve todo el shell). */
const loadTauriEvent = () => import("@tauri-apps/api/event")
```

Y en el efecto:

```tsx
        if (__isTauriDesktop__) {
            loadTauriEvent()
                .then(({ listen }) =>
                    listen("splash-closed", () => {
```

El resto del encadenado queda igual.

`components/shared/page-transition.tsx`:

```tsx
        // Contador en un objeto: React Compiler (1.0) no compila `--x` sobre una variable capturada.
        const entryLeft = { count: all.length + (returning ? 1 : 0) }
        const done = () => {
            if (!token.live) return
            entryLeft.count -= 1
            if (entryLeft.count > 0) return
            container?.removeAttribute(PAGE_ENTERING_ATTR)
            window.dispatchEvent(new Event(PAGE_ENTERED_EVENT))
        }
```

**E. Cambios secundarios.** Ninguno de API. Tests: `page-enter-signal.test.ts`, `enter-stagger.test.ts`, `navigation-transition.test.ts` y `shared-element*.test.ts` (todos en `components/shared`).

**F. Justificación y costo.** Son 4 líneas. Con el root compilado, sus re-renders (`useIsFetching` en cada navegación, `useTvDpad` y los cambios de búsqueda) ya no se propagan al shell. Se verificó en el bundle de C que `queryClient.getQueryData(...)` dentro de `isReadyNow` **no** queda memoizado: se evalúa en cada render, así que no hay riesgo de que el splash quede colgado.

**G. Validación.**

1. `typecheck`, `lint`, `vitest run src/components/shared` y `build`.
2. Compilador con logger: los dos componentes compilados.
3. Medición: tipear "z" en `/movies` y contar renders de `AppLayout`, `FloatingPillNav`, `AppTopNav` y `CommandPalette`. Esperado: 0 (antes 1 cada uno por cambio de búsqueda).
4. A mano, en escritorio Tauri (`pnpm tauri dev` o el binario): el splash nativo se retira y la interfaz entra con su animación. En web: arranque, fundido de entrada en cada sección, vuelo de portada lista → ficha y volver atrás con el scroll restaurado.

**H. Criterio de aceptación.** Ambos compilados. El arranque, las transiciones y el vuelo de portada se ven igual. Los hijos del shell no se renderizan en cambios solo de búsqueda.

**I. Reversión.** Restaurá `routes/__root.tsx` y `components/shared/page-transition.tsx`.

#### P2.3 · CT-04 · Riesgo BAJO · Selector en `useTvDpad`

- **Símbolo:** `hooks/use-tv-dpad.ts` › `useTvDpad`.
- **Evidencia:** A/B medido (sección 1). El hook solo usa `location.pathname` (L35).
- **Acción:** reemplazá `const location = useLocation()` por `const pathname = useLocation({ select: (l) => l.pathname })` y la dependencia `[location.pathname]` por `[pathname]`.
- **Validación:** `typecheck` y `lint`. Medición: renders de `RootComponent` al tipear en `/movies`, esperado 0 (antes 1). Con `tvMode` activo (Ajustes), las flechas navegan entre tarjetas y, al cambiar de sección, el foco sigue funcionando: el caché se invalida por `pathname`.

#### P2.4 · CT-03 · Riesgo BAJO · Hacer compilable `SeriesDetailClient` (medir primero)

**A. Problema.** La ficha de serie completa no se compila por el `try` del inicializador de `zVariant`.

**B. Evidencia.** *Support value blocks … within a try/catch statement* @199:16. Con el cambio de abajo compila (variante C). El beneficio en renders no se midió.

**C. Código ANTES** (`routes/series/$seriesId/index.lazy.tsx` L195–L202):

```tsx
    const [zVariant, setZVariant] = useState<'z' | 'kai'>(() => {
        if (isNativeKai) return 'kai'
        try {
            const stored = localStorage.getItem('kamehouse:timeline:z-variant')
            if (stored === 'kai' || stored === 'z') return stored
        } catch {}
        return 'z'
    })
```

**D. Código DESPUÉS.** A nivel de módulo, antes de `export const Route = createLazyFileRoute(`:

```tsx
/** Variante de Z guardada en este dispositivo. Fuera del componente: React Compiler (1.0) no
 *  compila un `try` con `||` adentro y abandonaba la ficha entera. */
function readStoredZVariant(): 'z' | 'kai' {
    let stored: string | null = null
    try {
        stored = localStorage.getItem('kamehouse:timeline:z-variant')
    } catch {
        return 'z'
    }
    return stored === 'kai' ? 'kai' : 'z'
}
```

Y en el componente:

```tsx
    const [zVariant, setZVariant] = useState<'z' | 'kai'>(() => (isNativeKai ? 'kai' : readStoredZVariant()))
```

**E. Cambios secundarios.** Ninguno. Es la misma clave de `localStorage` y el mismo resultado (`'z'` por defecto).

**F. Justificación y costo.** Son 10 líneas. Es la pantalla con más estado de la zona (sagas, pestañas, reproductor, personajes).

**G. Validación.** **Primero medí** con el procedimiento: entrar a `/series/12971`, cambiar de pestaña Episodios ↔ Sagas y elegir otra saga, antes y después, dos rondas. **Aplicá el paso solo si los renders bajan al menos un 20 % en alguna interacción**. Si no, dejalo documentado como "compilable sin beneficio medido". Además: `typecheck`, `lint`, `vitest run 'src/routes/series'` y, a mano, el selector Z/Kai en una ficha de DBZ, que se recuerda al recargar.

**H. Criterio de aceptación.** Compila y cumple el umbral medido, sin cambios en la variante Z/Kai.

**I. Reversión.** Restaurá `routes/series/$seriesId/index.lazy.tsx`.

#### P2.5 · CT-05 · Riesgo BAJO · Póster de la ficha de película por el proxy, en su tamaño y con prioridad

**A. Problema.** El LCP de la ficha se pide a TMDB directo en w780 para 240 px, sin el proxy ni prioridad.

**B. Evidencia.**

- LCP de `/movies/1039322`: `IMG https://image.tmdb.org/t/p/w780/…` a 1304 ms, natural 780 → pintado 238 px.
- 1 pedido directo a TMDB.
- `getHighResImage` devuelve la URL cruda (`lib/helpers/images.ts` L66–L77). `localImage` es la que pasa por `/api/v1/image-proxy` (L110–L118).

**C. Código ANTES**

`routes/movies/$movieId.lazy.tsx` L302:

```tsx
                posterUrl={getHighResImage(media.posterImage || "")}
```

`components/media-detail/detail-hero.tsx` L182–L188:

```tsx
                        <img
                            src={posterUrl}
                            alt={title}
                            loading="eager"
                            decoding="async"
                            className="h-full w-full object-cover select-none"
                        />
```

**D. Código DESPUÉS**

`routes/movies/$movieId.lazy.tsx`. El import de `@/lib/helpers/images` pasa a ser `import { getHighResImage, getMediumResImage, localImage, withTmdbSize } from "@/lib/helpers/images"`, y la prop queda:

```tsx
                // w500 por el proxy local: la caja mide hasta 240 px (480 en 2x) y así entra en la caché de disco.
                posterUrl={localImage(withTmdbSize(media.posterImage || "", "w500"))}
```

`components/media-detail/detail-hero.tsx`:

```tsx
                        <img
                            src={posterUrl}
                            alt={title}
                            loading="eager"
                            decoding="async"
                            fetchPriority="high"
                            className="h-full w-full object-cover select-none"
                        />
```

**E. Cambios secundarios.**

- `getHighResImage` sigue en uso en el mismo archivo (L130, backdrop del store). No lo borres.
- `withTmdbSize` sobre una URL que no es de TMDB la devuelve igual (el regex no coincide) y `localImage` también, así que los pósters locales no cambian.
- `data-shared-poster`: el vuelo de portada usa la copia de la tarjeta, así que no lo afecta.

**F. Justificación y costo.** Son 2 líneas. Imagen más chica, cacheable en disco en el servidor, y priorizada.

**G. Validación.**

- `typecheck`, `lint`, `vitest run src/components/media-detail src/routes/movies`.
- Medición en carga dura de `/movies/1039322` (antes y después): `LCP.url` tiene que pasar por `/api/v1/image-proxy` con `w500`, 0 pedidos directos a `image.tmdb.org` salvo `?kh-cors=1` (paleta, deliberado), y LCP ≤ al de antes en 3 corridas alternadas.
- A mano: el póster se ve nítido en 1x y 2x.

**H. Criterio de aceptación.** Ningún pedido directo del póster y LCP sin empeorar.

**I. Reversión.** Restaurá los dos archivos.

#### P2.6 · CT-06 · Riesgo BAJO · Póster de `MediaHero` con prioridad y `sizes` (condicionado a medición)

- **Símbolo:** `components/ui/media-hero.tsx` › `MediaHero`, `<DeferredImage src={posterUrl} …>` (L324).
- **Medición previa:** carga dura de `/series/12971`, 3 corridas, LCP y `currentSrc` del póster.
- **Acción**, solo si la medición después mejora el LCP ≥ 10 % o baja la imagen a w185/w342 sin pérdida visible: agregá a ese `DeferredImage` las props `priority` y `sizes="(min-width: 1024px) 176px, (min-width: 768px) 144px, (min-width: 640px) 128px, 96px"`. Son los anchos de `w-24 sm:w-32 md:w-36 lg:w-44`.
- **Validación:** `vitest run src/routes/series/$seriesId` (incluye `series-hero.test.tsx`). El póster sigue teniendo la animación `animate-slide-up` y el vuelo de portada desde Series → ficha.

#### P2.7 · CT-07 · Riesgo BAJO · Re-exportar las figuras de la estantería (EN ESPERA)

- **Bloqueo:** `public/icons/series-icons/{db,dbz,dbgt,dbkai,dbs,daima}/` y `SOURCES.md` son `??` en git: otra sesión los está creando, con modificaciones del 16/10 a las 19:19. Coordiná con quien los creó. No los pises.
- **Evidencia:** la tabla de tamaños de la sección 1. 12 PNG referenciados que suman 5,7 MB, con bitmap decodificado de ~46 MB, y la precarga con `decode()` en `__root.tsx` en cada arranque.
- **Acción propuesta:** re-exportá cada figura a un máximo de 2× su tamaño pintado. Hoy el máximo medido es 311×400 px CSS, así que alcanza con ~640 px de ancho, o ~800 px de alto para las de combate. Usá WebP con alfa (calidad ~85) y mantené los nombres y las proporciones (`--shelf-character-ratio`) o actualizá `goku-panorama.ts`. Es un trabajo de assets: no requiere dependencias nuevas si se hace con la herramienta de la sesión que los generó.
- **Validación:** el inventario de bytes y dimensiones de los archivos (el mismo de la sección 1). Visual: la estantería de `/series` a 1440 y a 1920 px no se ve más borrosa (compará capturas en la misma corrida). Medición: los pedidos `/icons/series-icons` de un arranque en frío bajan de 5,7 MB a menos de 1,5 MB.

#### P2.8 · CT-08 · Riesgo BAJO · `DynamicBackdrop` por el proxy

- **Símbolo:** `components/shared/dynamic-backdrop.tsx` › `DynamicBackdrop` (L95, L96 y L184).
- **Evidencia:** 2 pedidos `css` w185 directos a `image.tmdb.org` en `/movies` (sección 1). `getLowResImage` no envuelve con `localImage` (`lib/helpers/images.ts` L91–L101).
- **Acción:** importá `localImage` desde `@/lib/helpers/images` y envolvé las tres URL:
  - `displayedUrl ? localImage(getLowResImage(displayedUrl)) : null`
  - `nextUrl ? localImage(getLowResImage(nextUrl)) : null`
  - `const lowRes = localImage(getLowResImage(nextUrl))`
- **Validación:** `typecheck` y `lint`. Medición: carga dura de `/movies`, con 0 pedidos `css` directos a TMDB. En `/admin`, llegando desde Inicio, el fondo difuso sigue apareciendo.

### Fase 3 — Calidad

#### P3.1 · Riesgo BAJO · Guardián de compilación (opcional, sin dependencias nuevas)

**A. Problema.** `eslint-plugin-react-compiler` no reporta los errores "Todo" de sintaxis no soportada. El lint de la zona pasa limpio (sección 3) aunque 6 componentes no se compilan, así que estas regresiones vuelven a entrar sin aviso.

**B. Evidencia.** `npx eslint <zona>` da exit 0, mientras el compilador con logger da `CompileError` en 13 archivos de la zona (sección 3).

**C/D. Código.** Archivo nuevo `apps/web/scripts/check-compiler.mjs`. Usa `@babel/core` y `babel-plugin-react-compiler`, que ya están instalados:

```js
// Falla si React Compiler abandona algún componente fuera de la lista de exclusiones conocidas.
// El plugin de ESLint no reporta los errores "Todo" (sintaxis aún no soportada).
import { readFileSync, readdirSync, statSync } from "node:fs"
import { join, relative } from "node:path"
import { createRequire } from "node:module"

const require = createRequire(import.meta.url)
const babel = require("@babel/core")
const compiler = require.resolve("babel-plugin-react-compiler")

// Exclusiones deliberadas: useVirtualizer (incompatible por diseño) y "use no memo".
const ALLOWED = new Set([
    "src/routes/movies/-components/movies-grid.tsx",
    "src/routes/series/$seriesId/-components/premium-episode-list.tsx",
])
const ROOTS = ["src/routes", "src/components/shared", "src/components/chronology", "src/components/media-detail"]

function* walk(dir) {
    for (const name of readdirSync(dir)) {
        const p = join(dir, name)
        if (statSync(p).isDirectory()) yield* walk(p)
        else if (p.endsWith(".tsx") && !p.endsWith(".test.tsx")) yield p
    }
}

const failures = []
for (const root of ROOTS) {
    for (const file of walk(root)) {
        const rel = relative(process.cwd(), file).replaceAll("\\", "/")
        if (ALLOWED.has(rel)) continue
        const events = []
        babel.transformSync(readFileSync(file, "utf8"), {
            filename: file,
            babelrc: false,
            configFile: false,
            parserOpts: { plugins: ["typescript", "jsx"] },
            plugins: [[compiler, { target: "19", panicThreshold: "none", logger: { logEvent: (_f, e) => events.push(e) } }]],
        })
        for (const e of events.filter((ev) => ev.kind === "CompileError")) {
            const d = e.detail?.options ?? e.detail ?? {}
            failures.push(`${rel}:${e.fnLoc?.start?.line ?? "?"} ${d.reason ?? "CompileError"}`)
        }
    }
}
if (failures.length) {
    console.error(`React Compiler saltea ${failures.length} componente(s):\n  ${failures.join("\n  ")}`)
    process.exit(1)
}
console.log("React Compiler: todos los componentes de la zona compilan.")
```

**E. Cambios secundarios.** En `apps/web/package.json`, agregá el script `"lint:compiler": "node scripts/check-compiler.mjs"`. Al principio limitá `ROOTS` a esta zona. Hoy fallaría además por `getting-started.tsx`, `directory-selector.tsx`, `getting-started-steps/library-step.tsx`, `loading-overlay-with-logo.tsx`, `performance-monitor.tsx` (solo de dev) y los `*_temp` de `components/chronology` (ver sección 3). Esos van a `ALLOWED` con un comentario, o se arreglan en un paso aparte. **No relajes el guardián para que pase.**

**F. Justificación y costo.** Es un archivo de unas 50 líneas y corre en ~10 s. Protege la premisa del proyecto ("React Compiler activo") que hoy no se cumple en 6 componentes calientes.

**G. Validación.** `pnpm --filter kamehouse-web lint:compiler`: tiene que fallar antes de P2.1 a P2.4 y pasar después (con las exclusiones documentadas).

**H. Criterio de aceptación.** El script falla con un componente nuevo no compilable.

**I. Reversión.** Borrá el script y la entrada de `package.json`.

---

## 3. Verificación

Comandos corridos el 16/10 sobre el árbol de trabajo (`a249c13` + cambios ajenos sin commitear), desde `apps/web`.

| Comando | Resultado (estado inicial) |
|---|---|
| `npx tsc --noEmit` | exit 0 (sin errores de tipos). |
| `npx eslint src/routes/home src/routes/series src/routes/movies src/routes/chronology src/components/shared src/components/chronology src/components/media-detail src/routes/__root.tsx src/hooks/use-tv-dpad.ts src/hooks/use-hero.ts` | exit 0 (sin problemas). Ojo: no detecta los saltos del compilador. |
| `node scripts/check-tokens.mjs` (`lint:tokens`) | **exit 1, ya fallaba:** `--ease-out-strong` usada sin definir en `src/routes/series/-series-shelf.css`. Es ajeno a este plan. |
| `npx vitest run src/routes/home src/routes/series src/routes/movies src/routes/chronology src/components/shared src/components/chronology src/components/media-detail` | 43 archivos y 313 tests, todos pasan. |
| Compilador con logger sobre los `.tsx` de la zona (script en scratch, mismo método que P3.1) | `CompileError` en: `__root.tsx` (`RootComponent`), `page-transition.tsx`, `movies/index.lazy.tsx`, `movies-hero.tsx`, `-MovieCard.tsx`, `series/$seriesId/index.lazy.tsx` (`SeriesDetailClient`), `movies-grid.tsx` y `premium-episode-list.tsx` (deliberados), `getting-started.tsx`, `directory-selector.tsx`, `getting-started-steps/library-step.tsx`, `loading-overlay-with-logo.tsx` y `performance-monitor.tsx`. |

No se corrió la suite completa (`test:run`) ni el `build` oficial (`tsc && rsbuild build`) para no pisar `out/` ni competir con las otras sesiones. Los builds de medición usaron una salida propia en `scratch/`, ya borrada.
