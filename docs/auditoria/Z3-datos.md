# Auditoría Z3 — Datos (`apps/web`)

- **Zona:** `src/api/client`, `src/api/hooks`, `-prefetch.ts`, providers de Query, `use-websocket.ts`, stores de zustand (sección 6 del prompt A).
- **Commit de lectura:** `a249c13` **más el árbol de trabajo del 16/10/2026** (checkout compartido con muchos cambios sin commitear). Las líneas citadas son de ese árbol; varios archivos del plan figuran como modificados por otras sesiones (`git status` al 16/10 21:38): `requests.ts`, `tmdb-episode.hooks.ts`, `anilist-episode.hooks.ts`, `query-persister.ts`, `lib/stores/index.ts`, `main.tsx`, `routes/series/$seriesId/index.tsx` e `index.lazy.tsx`. El ejecutor tiene que comparar cada bloque ANTES con el archivo antes de editar.
- **Modo:** solo auditoría. No se tocó código del repo. Las mediciones se hicieron con un build de producción temporal en `scratch/z3`, borrado al cerrar la verificación. Los scripts de medición tampoco están: no se encuentran en la carpeta de notas que se indicó en su momento, así que **las cifras M1–M9 no son reproducibles desde el repo**; solo se pueden repetir reescribiendo los scripts.

---

## 1. Hallazgos

| ID | Sev. | Conf. | Archivo › símbolo | Tipo | Problema | Riesgo |
|----|------|-------|-------------------|------|----------|--------|
| DT-01 | ALTA | ALTA | `app/client-providers.tsx` › `queryClient` (`defaultOptions.queries.retry`, L31-37) + `api/client/requests.ts` › `buildApiQuery` (L97-98, L125) + `api/hooks/tmdb-episode.hooks.ts` › `useGetTMDBEpisodeStill` + `api/hooks/anilist-episode.hooks.ts` › `useGetAniListEpisodeThumbnail` | rendimiento, robustez | Los reintentos se multiplican: el transporte reintenta los GET 2 veces ante 429, 502/503/504 y `TypeError`, y, encima, React Query reintenta `ApiError` 502/503/504 hasta 15 veces. **Medido: una sola query GET que recibe 503 genera 48 pedidos en 55 s. Con un POST son 16, porque el transporte no reintenta.** El servidor usa 503 **sin** `Retry-After` para estados permanentes: `HandleTMDBEpisodeStill` cuando no hay clave de TMDB (estado `tmdbDegraded`, previsto por el servidor), `HandleRequestMediastreamMediaContainer` (POST) con "library not available". En la cronología, cada miniatura sin imagen de biblioteca ni miniatura local curada dispara su propia query de still. Con TMDB sin clave serían unos 48 pedidos **por miniatura** según el código (estimado, no medido). El caso no se da en la base actual (`tmdbDegraded` es `false`). | MEDIO |
| DT-02 | MEDIA | ALTA | `app/client-providers.tsx` › `ClientProviders` (`PersistQueryClientProvider`, L59-68) + `main.tsx` › `init`/`router` | rendimiento | La caché de IndexedDB se restaura en un efecto **después** del primer render, pero los loaders del router corren antes. **Medido al arrancar:** en `/home`, `library/collection` sale a los 2160 ms y la lectura de IndexedDB arranca a los 2747 ms. En un enlace directo a `/series/12971`, los 5 pedidos de la ficha salen a los 1055 ms y la lectura arranca a los 1292 ms. En la medición la lectura de IndexedDB llegó después de la red, así que el dato persistido no se usó en la primera pantalla. Si IndexedDB respondiera antes, `hydrate()` de query-core (`hydration.js` L130-143) aplicaría el dato a la query en vuelo: el defecto es el orden de la restauración. Además, el loader de la ficha hace `await` del entry porque `getQueryData` todavía está vacío, aunque el entry está guardado en IndexedDB. | MEDIO |
| DT-03 | MEDIA | ALTA (tamaños) / BAJA (beneficio) | `lib/query-persister.ts` › `EXCLUDED_KEY_PATTERNS` (L12-25) / `shouldDehydrateQuery` (L30-45, `maxAge` L136) | almacenamiento, rendimiento | Las fichas `ANIME-ENTRIES-get-anime-entry` ocupan **89-91 % de la caché persistida** (mínimos de M2: 1,99 MB de 2,24 MB; no necesariamente de la misma corrida). Cada escritura a IndexedDB las vuelve a clonar (3-8 ms por escritura medidos) y el tamaño crece en forma lineal con las fichas en memoria de las últimas 24 h (`gcTime`/`maxAge`), incluidas las precargadas por hover y por cronología. El beneficio no está medido: la ficha persistida se pinta mientras revalida y, por DT-02, hoy no llega a la primera ruta. Depende de P2.5 paso 0. | BAJO (sin medir) |
| DT-04 | BAJA | ALTA | `routes/series/$seriesId/index.tsx` › `Route.loader` (`dehydrate(qc)`, L32) + `index.lazy.tsx` › `SeriesDetailPage` (`HydrationBoundary`, L75-85) | mantenibilidad, memoria | El loader deshidrata **toda** la caché y la ficha la vuelve a hidratar en el **mismo** `QueryClient`. `hydrate` ignora las queries que ya existen con `dataUpdatedAt` igual o más nuevo, así que es una operación sin efecto. Su costo de CPU es despreciable (9 µs medidos), pero cada snapshot queda guardado en el `loaderData` de cada match que cachea el router (cronología precarga 5 fichas) y retiene referencias a datos viejos. | BAJO |
| DT-05 | BAJA | ALTA | `lib/stores/index.ts` › `useAppStore` (`persist` "kamehouse-app-settings", L32-111) | robustez, mantenibilidad | El espejo `useAppStore` vuelve a persistir los mismos campos que ya guardan `ui-store`, `player-store` y `queue-store`. **Medido:** 22 escrituras de `kamehouse-app-settings` emparejadas 1:1 con 22 de `kamehouse-ui-settings` en un recorrido, todas con contenido idéntico (729 y 328 bytes). Las disparan campos que **no** se persisten (`activeSeriesContext`). Además, al hidratar, el `merge` del espejo (`{ ...currentState, ...p }`) hace que su copia vieja **gane** sobre los sub-stores, que son la fuente de verdad. | MEDIO |
| DT-06 | BAJA | ALTA | `hooks/use-websocket.ts` › `useWebSocket` | rendimiento | Los suscriptores que solo envían (`player-core.ts`, `use-mpv-player.ts`) o que procesan con `onMessage` (`PlaybackSettings.tsx`, `playback-tab.tsx`) re-renderizan su componente por **cada** mensaje del socket compartido, porque `react-use-websocket` hace `setLastMessage` en todos los suscriptores. **Reproducido:** 23 renders con una ráfaga de 20 mensajes. | BAJO |
| DT-07 | BAJA | ALTA | `lib/query-persister.ts` › `EXCLUDED_KEY_PATTERNS` (L12-25) | memoria, privacidad | La exclusión es por subcadena de la primera clave y no cubre `STATUS-get-log-content`, `STATUS-get-latest-log-content` y `STATUS-get-log-filenames`: los logs completos se persisten, porque el patrón `"diagnostics"` no coincide con ninguna clave real. Tampoco cubre `DIRECTORY-SELECTOR-directory-selector` (cada ruta tecleada) ni `INTELLIGENCE-semantic-search` (cada búsqueda): son datos efímeros que se guardan 24 h y viajan en cada escritura. | BAJO |

### Mediciones hechas (método)

Base común: build de producción con config temporal (ya borrada; importaba la base y cambiaba `output.distPath.root` a `scratch/z3/out`), servido con `rsbuild preview --port 43280`. Se verificó que el HTML trae scripts con hash (`static/js/index.572ee644.js`). El proxy de `/api` del preview apunta a un **proxy de registro propio** en 43281 (`logproxy.cjs`), que reenvía al backend de desarrollo en 43212, registra cada pedido y **bloquea toda escritura** respondiendo 200 sin tocar la base. `PATCH /continuity/item` queda bloqueado siempre, incluso cuando se dejaron pasar los POST de `mediastream`. No se usó el puerto 43211. Las mediciones de navegador se hicieron con Chrome headless (`playwright-core` + `C:/Program Files/Google/Chrome/Application/chrome.exe`), con service worker bloqueado y, para las de recorrido, con perfil nuevo en cada corrida.

| # | Qué | Método | Resultado |
|---|-----|--------|-----------|
| M1 | Pedidos por pantalla y duplicados entre loader/prefetch y hooks | `measure.cjs`: /home → /series → 3 fichas (hover, abrir, atrás) → /chronology → /movies → /home → recarga. Conteo por tramo en el log del proxy (3 corridas). | **0 duplicados**: cada recurso (`anime-entry`, `sagas`, `source`, `continuity/item`, `lore`, `collection`) se pide una vez por visita. Las claves de `-prefetch.ts`, `usePrefetchAnimeEntry` y los loaders coinciden con las de los hooks. **No es hallazgo.** |
| M2 | Tamaño de la caché persistida | Lectura de `keyval-store/keyval` › `kamehouse_react_query_cache` al final del recorrido | 21-22 queries, **2,24-2,72 MB** de JSON. `ANIME-ENTRIES-get-anime-entry`: 5-6 queries, 1,99-2,47 MB. Le siguen `chronology-episode-files` (140 KB) y `library/collection` (65 KB). |
| M3 | Costo de cada escritura a IndexedDB | Envoltura de `IDBObjectStore.prototype.put` (clona en forma síncrona) con `performance.now()` | ~1 escritura por pantalla (el throttle de `createIDBPersister` funciona); **3-8 ms por escritura**, máximo 10,7 ms, con 2,2 MB. `structuredClone` del snapshot: 12-27 ms en página y 16 ms en Node. |
| M4 | Costo de `dehydrate` | `dehydrate-bench.cjs` (Node, `@tanstack/query-core` del repo, 22 queries con datos reales pedidos a 43212) | **0,009 ms por llamada**. El persister lo llama en cada evento de caché, pero es despreciable. Lo que cuesta es el clonado (M3). |
| M5 | Carrera entre restauración y loaders | `restore-race.cjs`: reusa el perfil con caché guardada; registra `IDBObjectStore.get` y cada `fetch` a `/api` | `/home`: fetch de `collection` a 2160 ms; `idb-get` a 2747 ms (ok a 2750). `/series/12971` directo: 5 fetch a 1055 ms; `idb-get` a 1292 ms. |
| M6 | Tormenta de reintentos ante 503 | Proxy con `FAIL503` (503 sin `Retry-After`, igual al del servidor) para `/library/anime-entry/:id/sagas`. `storm.cjs` abre `/series/12971` y espera 75 s. | **48 pedidos en 54,9 s** para una sola query (16 intentos de Query × 3 del transporte), en tríos separados 0,3 y 0,6 s, con backoff de hasta 3 s. |
| M7 | Re-render de suscriptores WS pasivos y pérdida de mensajes | `wslost.cjs`: React 19 + `react-use-websocket` 4.13 reales, happy-dom y servidor `ws` local que envía ráfagas de 1, 5 y 20 mensajes | Patrón efecto-sobre-`lastJsonMessage` (el de `WebsocketProvider`): **20/20 mensajes procesados**, así que **la hipótesis de pérdida de mensajes se descarta**. Suscriptor pasivo: 4, 8 y 23 renders (3 base + 1 por mensaje). |
| M8 | Escrituras a `localStorage` | Envoltura de `Storage.prototype.setItem` durante el recorrido M1 | `kamehouse-app-settings` y `kamehouse-ui-settings`: 22 escrituras cada una, siempre en pares y con el mismo tamaño (729 y 328 bytes); 4 por ficha visitada y 2 por volver. |
| M9 | Continuidad durante la reproducción | `play.cjs`: abre `/series/12971` y pulsa "Reproducir episodio" (con el PATCH de continuidad bloqueado y `mediastream` permitido); 50 s de video avanzando (0,7 → 45,8 s) | Cada 15 s: `PATCH /continuity/item` (bloqueado) seguido de `GET /continuity/item/12971`, porque `onSuccess` invalida con la ficha montada debajo del reproductor. **0 tareas largas (>50 ms).** Es un costo aceptado y **no es hallazgo**: quitar esa invalidación pondría en riesgo el punto de reanudación al cerrar el reproductor (ver `useSeriesPlayback` › `refetchContinuity`). |

### Pendiente de medir

- **WebSocket en escritorio emulado.** En el preview el servidor rechaza el origen `127.0.0.1:43280` (cierre 1006 a los 7 ms: el cliente `ws` de Node, sin `Origin`, sí conecta), así que los conteos de conexiones WS del recorrido **no valen**. Para medir reconexiones reales: `--host-resolver-rules=MAP tauri.localhost 127.0.0.1:<puertoPágina>` + `window.__KAMEHOUSE_PORT__` (ver la memoria `medir-cache-imagenes`).
- **Cantidad de queries de still TMDB en modo degradado** sobre la base real. Hoy el usuario tiene `tmdbDegraded=false`. Para contarlas: proxy con `FAIL503='/api/v1/tmdb/episode/'` y abrir `/chronology` 60 s.
- **Retención de memoria de DT-04:** heap snapshot tras visitar /chronology (5 precargas) y 5 fichas.
- **`useGetContinuityWatchHistoryItem` devuelve `{ ...query, data }`.** El spread lee todas las propiedades del resultado rastreado y desactiva el seguimiento de props de TanStack, así que sus consumidores re-renderizarían con cada cambio de `isFetching`. En M9 no hubo tareas largas. Haría falta un perfil de renders en build de producción para confirmarlo: queda como hipótesis y no se incluye en el plan.
- Hipótesis no medida: con la pestaña en segundo plano, Chrome espacia los `setInterval` a ≥1 min. El ping de la app cada 25 s podría quedar por encima del `SetReadDeadline` de 60 s del servidor (`handlers/websocket.go`) y provocar desconexiones periódicas. Para verificarlo hace falta una pestaña oculta más de 5 min.

### Dependencias entre pasos

- **P2.1 y P2.2** (DT-01) son independientes; conviene aplicar primero P2.1, que es de riesgo bajo.
- **P2.4 (DT-02) va antes que P2.5 (DT-03):** sin DT-02, las fichas persistidas casi no se usan, y medir DT-03 antes daría un beneficio falso.
- **P2.3 (DT-07) y P2.5 (DT-03)** editan el mismo array `EXCLUDED_KEY_PATTERNS` y su test: hay que hacerlos uno después del otro.
- **P1.1 (DT-04)** toca `routes/series/$seriesId/index.tsx`. Si se aplica P2.4 antes, el loader no cambia, pero hay que releer el bloque ANTES.
- **P3.1 (DT-05)** es independiente del resto.

### Alcance real de la lectura

**Leídos completos:** `api/client/requests.ts`, `api/client/server-url.ts`, `api/client/use-api-websocket-url.ts`, `app/client-providers.tsx`, `app/websocket-provider.tsx`, `hooks/use-websocket.ts`, `hooks/use-prefetch-anime-entry.ts`, `lib/query-persister.ts` y su test, `lib/query-keys.ts`, `lib/drive-status.ts`, `lib/store.ts`, `lib/stores/index.ts`, `ui-store.ts`, `player-store.ts`, `scanner-store.ts`, `skip-times-store.ts`, `main.tsx`, `routes/series/$seriesId/-prefetch.ts`, los loaders de `home/index.tsx`, `series/index.tsx`, `movies/index.tsx`, `chronology/index.tsx`, `movies/$movieId.tsx` y `series/$seriesId/index.tsx`. Hooks: `continuity.hooks.ts`, `continuity-local.ts`, `usePlayerProgressSync.ts`, `useAnimeTracking.ts`, `anime_entries.hooks.ts`, `anime_collection.hooks.ts`, `chronology.hooks.ts`, `settings.hooks.ts`, `system.hooks.ts`, `notifications.hooks.ts`, `scan.hooks.ts`, `mediastream.hooks.ts`, `pretranscode.hooks.ts`, `admin.hooks.ts`, `diagnostics.hooks.ts`, `library-episode.hooks.ts`, `tmdb-search.hooks.ts`, `tmdb-episode.hooks.ts`, `anilist-episode.hooks.ts`, `media_audio.hooks.ts`, `unlinked.hooks.ts` y `directory_selector.hooks.ts`. Librerías en `node_modules`: `query-persist-client-core/persist.js`, `PersistQueryClientProvider.js`, `query-core/hydration.js` (`dehydrate`) y `react-use-websocket/attach-shared-listeners.js`.

**Solo recorridos (por partes o con grep):** `continuity-pending.ts` (L1-94), `aniskip.hooks.ts` (claves y `useAniSkipTimes`), `queue-store.ts` (`persist`/`partialize`), `routes/series/$seriesId/index.lazy.tsx` (L1-200 y L590-625), `-hooks/use-series-playback.ts` (`refetchContinuity`), `routes/__root.tsx` (gating por `status` y contexto del router), `routes/chronology/index.lazy.tsx` (`preloadSeries`), `routes/series/-SeriesPosterGridItem.tsx`, `components/chronology/EpisodeThumbnailImg.tsx` (L55-130), `components/video/usePlayerSkip.ts` (prefetch de aniskip), `routes/settings/tabs/system-tab.tsx` (`resetStore`). Servidor Go: `handlers/tmdb.go`, `handlers/status.go`, `handlers/settings.go`, `handlers/websocket.go`, `handlers/routes.go` (CORS, `RespondWithCodeError`), `handlers/drive.go`, `handlers/mediastream.go` y `models/secrets.go`.

**No leídos:** `api/client/error-messages.ts`, `api/client/schemas.ts`, `hooks/use-home-intelligence.ts`, `lib/hardware/performance-store.ts`, `components/scan-live/views.ts` y los stores de `components/video/*`, que son de Z1.

### Notas (no son hallazgos)

- El comentario de `EXCLUDED_KEY_PATTERNS` sobre `"settings"` dice que `Models_Settings` trae secretos en claro. Ya no es así: el servidor los enmascara (`models/secrets.go` › `Settings.Redacted`, usado en `HandleGetSettings` y `NewStatus`). La exclusión no molesta y no se propone cambiarla.
- `refetchOnWindowFocus: false` y `refetchOnReconnect: false` en global, con `refetchOnReconnect: true` solo en continuidad: es correcto para Tauri.
- `useServerQuery` pasa el `AbortSignal` de Query y `-prefetch.ts` también. Los fetchers de los loaders (`fetchAnimeEntry`, `fetchLibraryCollection`…) no lo reciben, pero son prefetch que casi nunca se cancelan: no aporta.
- `POST /mediastream/preload` sale 2 veces por ficha en M1 (desde `player-core`/`usePlayerSkip`). Pertenece a Z1 y se deriva a esa zona.

---

## 2. Plan

### Fase 1 — Código muerto

#### P1.1 · DT-04 · Quitar `dehydrate` del loader y el `HydrationBoundary` de la ficha (riesgo BAJO)

- **Símbolos:** `routes/series/$seriesId/index.tsx` › `Route.loader` (valor de retorno `{ dehydrateState }`); `routes/series/$seriesId/index.lazy.tsx` › `SeriesDetailPage`.
- **Evidencia de que no se usa:** `grep -rn "dehydrateState\|HydrationBoundary\|dehydrate(" apps/web/src` → solo `index.tsx:32` (productor) e `index.lazy.tsx:78,81` (único consumidor); ningún test lo usa. La app tiene un solo `QueryClient` (`client-providers.tsx` › `queryClient`, pasado al router en `main.tsx`), y `hydrate` (`query-core/hydration.js`) solo escribe si `dataUpdatedAt` es más nuevo, cosa que no pasa con un snapshot del mismo cliente. Costo de CPU medido: 9 µs (M4).
- **ANTES** (`index.tsx`):

```tsx
import { createFileRoute } from "@tanstack/react-router"
import { dehydrate } from "@tanstack/react-query"
import { fetchAnimeEntry } from "@/api/hooks/anime_entries.hooks"
...
        // Con ficha en caché (aunque vencida) no se bloquea la navegación: el
        // prefetch la revalida en segundo plano y el cliente se monta ya.
        if (!qc.getQueryData(entryKey)) await entryPrefetch
        return { dehydrateState: dehydrate(qc) }
    },
```

- **DESPUÉS** (`index.tsx`): se borra la línea `import { dehydrate } from "@tanstack/react-query"` y el loader termina así:

```tsx
        // Con ficha en caché (aunque vencida) no se bloquea la navegación: el
        // prefetch la revalida en segundo plano y el cliente se monta ya.
        if (!qc.getQueryData(entryKey)) await entryPrefetch
    },
```

- **ANTES** (`index.lazy.tsx`, L2 y L75-85):

```tsx
import { HydrationBoundary } from "@tanstack/react-query"
...
function SeriesDetailPage() {
    const { seriesId } = Route.useParams()
    const loaderData = Route.useLoaderData()
    const dehydrateState = loaderData?.dehydrateState

    return (
        <HydrationBoundary state={dehydrateState}>
            <SeriesDetailClient key={seriesId} seriesId={seriesId} />
        </HydrationBoundary>
    )
}
```

- **DESPUÉS** (`index.lazy.tsx`): se borra el import de `HydrationBoundary` y la función queda así:

```tsx
function SeriesDetailPage() {
    const { seriesId } = Route.useParams()
    return <SeriesDetailClient key={seriesId} seriesId={seriesId} />
}
```

- **Validación:** `pnpm --filter kamehouse-web typecheck` (si `routeTree.gen.ts` infiere el tipo del loader, debe compilar sin `dehydrateState`), `lint`, y `vitest run "src/routes/series/$seriesId"`. Manual en build de producción: abrir ficha, volver, abrir otra y entrar desde /chronology. Con M1 (`measure.cjs`) se deben ver los mismos pedidos por tramo que antes (0 duplicados).
- **Reversión:** restaurar los dos archivos.

### Fase 2 — Rendimiento

#### P2.1 · DT-01a · Sin reintentos en las miniaturas de respaldo (riesgo BAJO)

- **Símbolos:** `api/hooks/tmdb-episode.hooks.ts` › `useGetTMDBEpisodeStill`; `api/hooks/anilist-episode.hooks.ts` › `useGetAniListEpisodeThumbnail`.
- **Evidencia:** su único consumidor es `components/chronology/EpisodeThumbnailImg.tsx` (L88 y L93), que ante un fallo pasa a la fuente siguiente (`needAniList` → `fallbackSrc`). Las dos queries son de respaldo, ya tienen `muteError: true` y hoy heredan los 15 reintentos globales (M6). `HandleTMDBEpisodeStill` responde 503 permanente sin clave de TMDB (`handlers/tmdb.go`).
- **Acción:** agregar `retry: false` en las opciones de las dos queries, después de `muteError: true`:

```ts
        muteError: true,
        // Fuente de respaldo: si falla, EpisodeThumbnailImg pasa a la siguiente.
        // Sin reintentos (un 503 de "TMDB sin clave" son 48 pedidos por miniatura).
        retry: false,
```

- **Validación:** `typecheck`, `lint`, `vitest run src/components/chronology`. Medición con el mismo método que M6, pero con `FAIL503='/api/v1/tmdb/episode/'`, abriendo `/chronology` 60 s: **1 pedido por URL distinta** (antes: hasta 48). Manual: /chronology sigue mostrando miniaturas con TMDB configurado.
- **Reversión:** restaurar los dos archivos.

#### P2.2 · DT-01b · Reintentar 503 solo si el servidor indica cuándo volver (riesgo MEDIO)

- **A. Problema:** el transporte reintenta 502/503/504 dos veces y Query vuelve a reintentar hasta 15. El servidor usa 503 **sin** `Retry-After` para estados permanentes (TMDB sin clave, "library not available" en `RequestMediastreamMediaContainer`, Drive inactivo) y 503 **con** `Retry-After` para lo temporal (proxy de desarrollo mientras el backend arranca: `Retry-After: 2` en `rsbuild.config.ts`). La cuota de Drive manda 3600, que no vale la pena reintentar.
- **B. Evidencia:** M6 (48 pedidos en 55 s por query). Con la app de escritorio, el sidecar caído llega como `TypeError` (conexión rechazada) y no como 503, y ese camino no cambia. `Retry-After` no está en `ExposeHeaders` (`handlers/routes.go` L154), así que en escritorio (cross-origin) no se puede leer y **ningún 503 del servidor se reintenta**, que es lo buscado. En desarrollo (mismo origen, vía proxy) sí se lee.
- **C. ANTES** (`api/client/requests.ts`, L10-24 y L115-135):

```ts
export class ApiError extends Error {
    constructor(
        public readonly message: string,
        public readonly status: number,
        public readonly data?: unknown
    ) {
        super(message);
        this.name = "ApiError";
    }
}

/** 502/503/504: backend arrancando o gateway caído. Transitorio, vale reintentar. */
export function isTransientStatus(status: number): boolean {
    return status === 502 || status === 503 || status === 504
}
```

```ts
            if (!res.ok) {
                let errorData: unknown;
                const text = await res.text();
                try {
                    errorData = JSON.parse(text);
                } catch {
                    errorData = text;
                }

                // If 502, 503, 504, 429 -> retry silenciosamente solo si es idempotente
                if (isIdempotent && (res.status === 429 || isTransientStatus(res.status)) && attempt < maxRetries) {
                    attempt++
                    const delay = 300 * attempt
                    await sleep(delay)
                    continue
                }

                const errorMessage = typeof errorData === "object" && errorData !== null && "error" in errorData && typeof (errorData as Record<string, unknown>).error === "string"
                    ? (errorData as Record<string, unknown>).error as string
                    : `HTTP Error ${res.status}`;
                throw new ApiError(errorMessage, res.status, errorData);
            }
```

`app/client-providers.tsx` (L1 y L31-37):

```ts
import { ApiError, isTransientStatus } from "@/api/client/requests"
...
            retry: (failureCount, error) => {
                if (error instanceof ApiError) {
                    return isTransientStatus(error.status) && failureCount < 15
                }
                return failureCount < 1
            },
```

- **D. DESPUÉS** (`api/client/requests.ts`). `isTransientStatus` **no cambia**: lo usan la cola offline de continuidad (`isRecoverableSaveError`) y `isBackendUnavailableError`.

```ts
export class ApiError extends Error {
    constructor(
        public readonly message: string,
        public readonly status: number,
        public readonly data?: unknown,
        /** Segundos de `Retry-After`, si el servidor lo mandó y el navegador lo deja leer. */
        public readonly retryAfter?: number
    ) {
        super(message);
        this.name = "ApiError";
    }
}

/** 502/503/504: backend arrancando o gateway caído. Transitorio, vale reintentar. */
export function isTransientStatus(status: number): boolean {
    return status === 502 || status === 503 || status === 504
}

/** Más espera que esto (p. ej. la cuota de Drive, 3600 s) no es un arranque: no se reintenta. */
const MAX_RETRY_AFTER_S = 10

/**
 * ¿Vale reintentar este estado? 502/504 (gateway) sí. 503 solo con un `Retry-After` corto:
 * el proxy de desarrollo lo manda mientras el backend arranca, y el servidor responde 503
 * sin él para estados permanentes (TMDB sin clave, biblioteca no configurada, Drive
 * inactivo), donde reintentar solo multiplicaba pedidos (48 por query).
 */
export function shouldRetryStatus(status: number, retryAfter?: number): boolean {
    if (status === 502 || status === 504) return true
    return status === 503 && retryAfter != null && retryAfter <= MAX_RETRY_AFTER_S
}

function parseRetryAfter(res: Response): number | undefined {
    const raw = res.headers.get("Retry-After")
    if (raw == null) return undefined
    const seconds = Number(raw)
    return Number.isFinite(seconds) && seconds >= 0 ? seconds : undefined
}
```

```ts
            if (!res.ok) {
                let errorData: unknown;
                const text = await res.text();
                try {
                    errorData = JSON.parse(text);
                } catch {
                    errorData = text;
                }
                const retryAfter = parseRetryAfter(res)

                // 429 y fallos de gateway / arranque: reintento corto, solo si es idempotente
                if (isIdempotent && (res.status === 429 || shouldRetryStatus(res.status, retryAfter)) && attempt < maxRetries) {
                    attempt++
                    const delay = 300 * attempt
                    await sleep(delay)
                    continue
                }

                const errorMessage = typeof errorData === "object" && errorData !== null && "error" in errorData && typeof (errorData as Record<string, unknown>).error === "string"
                    ? (errorData as Record<string, unknown>).error as string
                    : `HTTP Error ${res.status}`;
                throw new ApiError(errorMessage, res.status, errorData, retryAfter);
            }
```

`app/client-providers.tsx`:

```ts
import { ApiError, shouldRetryStatus } from "@/api/client/requests"
...
            // Smart retry: requests.ts ya absorbe los reintentos idempotentes (GET) a nivel transporte.
            // Para ApiError no duplicar tormenta; para fallos de red inesperados permitir 1 reintento.
            // Excepción: 502/504 o 503 con Retry-After corto (backend arrancando detrás del proxy);
            // es transitorio, así que se reintenta con backoff (~30s en total). Un 503 sin
            // Retry-After es un estado del servidor (p. ej. TMDB sin clave) y no se reintenta.
            retry: (failureCount, error) => {
                if (error instanceof ApiError) {
                    return shouldRetryStatus(error.status, error.retryAfter) && failureCount < 15
                }
                return failureCount < 1
            },
```

- **E. Cambios secundarios:**
  - Comprobar con `grep -rn "isTransientStatus" apps/web/src` que los demás usos quedan igual: `continuity.hooks.ts` (retry de la mutación en segundo plano, PATCH) y `continuity-pending.ts`.
  - `new ApiError(` tiene otros 3 argumentos en `requests.ts` (respuesta no JSON, `json.error`); no necesitan `retryAfter`.
  - **Test nuevo** `src/api/client/requests.test.ts` (Vitest con happy-dom, `vi.stubGlobal("fetch", …)` y `vi.useFakeTimers()`):
    1. 503 sin `Retry-After` → `fetch` llamado **1** vez y `ApiError` con `status === 503`.
    2. 503 con `Retry-After: 2` → **3** llamadas (avanzar 300 + 600 ms).
    3. 502 → 3 llamadas.
    4. 429 → 3 llamadas.
    5. `TypeError` → 3 llamadas.
    6. Tabla de `shouldRetryStatus`: `(503, 3600)` → `false`.
  - Efecto visible en Z1: con "library not available", el reproductor muestra el error enseguida en lugar de tras 16 intentos (~40 s). Avisar a quien ejecute Z1.
- **F. Justificación y costo:** reintentar un 503 permanente no puede salir bien. El arranque del backend sigue cubierto por dos vías: `TypeError` en escritorio y `Retry-After` en desarrollo. El cambio toca 2 archivos y agrega un test, sin dependencias nuevas.
- **G. Validación:**
  - `typecheck`, `lint`, `vitest run src/api src/app`.
  - Rendimiento, con el mismo método que M6: `FAIL503` sobre `/sagas`, 75 s → **1 pedido** (antes 48).
  - Control: proxy que responda 503 **con** `Retry-After: 2` → los reintentos siguen (≥ 16 pedidos).
  - Manual en dev (`tauri dev`, backend que arranca después de la UI): la app sigue cargando sola cuando el backend responde.
- **H. Criterio de aceptación:** 1 pedido por query ante un 503 sin `Retry-After`; sin cambios ante 502/504/429/`TypeError` ni ante 503 con `Retry-After ≤ 10`; suite en verde.
- **I. Reversión:** restaurar `api/client/requests.ts` y `app/client-providers.tsx`, y borrar `requests.test.ts`.

#### P2.3 · DT-07 · No persistir logs, selector de carpetas ni búsquedas (riesgo BAJO)

- **Símbolo:** `lib/query-persister.ts` › `EXCLUDED_KEY_PATTERNS`.
- **Evidencia:** las claves reales salen de `api/generated/endpoints.ts`: `STATUS-get-log-content` (L678), `STATUS-get-log-filenames` (L683), `STATUS-get-latest-log-content` (L693), `DIRECTORY-SELECTOR-directory-selector` (L207) e `INTELLIGENCE-semantic-search` (L283). Ninguna contiene un patrón de la lista; `"diagnostics"` no coincide con ninguna clave.
- **Acción:** agregar al final del array, antes del comentario de `"settings"`:

```ts
    // Logs completos (Diagnóstico), rutas tecleadas en el selector de carpetas y
    // búsquedas: efímeros, y los logs pueden pesar MB en cada escritura.
    "get-log",
    "latest-log",
    "directory-selector",
    "semantic-search",
```

- **Test** (en `lib/query-persister.test.ts`, nuevo `describe`): usar `queryPersistOptions.dehydrateOptions.shouldDehydrateQuery` (ya exportado) con objetos `{ state: { status: "success", data: 1 }, queryKey: [clave] } as unknown as Query`. Debe devolver `false` para las 5 claves de arriba y `true` para `ANIME-COLLECTION-get-library-collection`.
- **Validación:** `vitest run src/lib/query-persister.test.ts`. Manual: abrir Ajustes › Diagnóstico › ver un log y comprobar en DevTools › IndexedDB que no hay ninguna `STATUS-get-log*` en `kamehouse_react_query_cache`.
- **Reversión:** restaurar los dos archivos.

#### P2.4 · DT-02 · Restaurar la caché antes de que corran los loaders (riesgo MEDIO; **primero medir**)

- **Paso 0, medición (condiciona el cambio).** En build de producción, con el método de M5 (`restore-race.cjs`) más una marca de "contenido listo": tiempo hasta que exista el `<h1 class="sr-only">Inicio</h1>` con `MediaSpotlight` montado en `/home`, y hasta que aparezca la lista de episodios en `/series/12971`. Correr 5 arranques en frío con caché guardada, **A** (actual) vs **B** (con el cambio), en la misma corrida. **Aplicar solo si** B no empeora la mediana de "contenido listo" en ninguna de las dos rutas **y** en B el `idb-get-ok` llega antes del primer `fetch` de loader.
- **A. Problema:** M5. `PersistQueryClientProvider` restaura en un `useEffect`, y el router (`RouterProvider` en `main.tsx` › `init`) ya lanzó los loaders. En `/series/:id` directo, el loader espera el entry de red (`if (!qc.getQueryData(entryKey)) await entryPrefetch`) aunque está persistido.
- **B. Evidencia:** M5; código de `PersistQueryClientProvider.js` (restaura en un efecto y se suscribe recién al terminar).
- **C. ANTES** (`app/client-providers.tsx`, completo en lo relevante):

```tsx
import { QueryClient } from "@tanstack/react-query"
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client"
import { queryPersistOptions } from "@/lib/query-persister"
...
                <CookiesProvider>
                    <PersistQueryClientProvider
                        client={queryClient}
                        persistOptions={queryPersistOptions}
                    >
                        <WebsocketProvider>
                            {children}
                            <Toaster />
                            <PwaRegistry />
                        </WebsocketProvider>
                    </PersistQueryClientProvider>
                </CookiesProvider>
```

`main.tsx` (L125-135):

```tsx
function init() {
    const rootElement = document.getElementById("root")
    if (!rootElement) {
        throw new Error("Root element '#root' not found in DOM")
    }
    // Renderizamos la UI de inmediato para que la pantalla de carga se muestre sin ningún retraso
    ReactDOM.createRoot(rootElement).render(
        <ClientProviders>
            <RouterProvider router={router} />
        </ClientProviders>,
    )
```

- **D. DESPUÉS** (`app/client-providers.tsx`). El bloque de `retry` queda como esté (con P2.2 o sin él); solo cambian los imports, la restauración y el provider.

```tsx
import { ApiError, isTransientStatus } from "@/api/client/requests"
import { WebsocketProvider } from "@/app/websocket-provider"
import { PwaRegistry } from "@/components/pwa-registry"
import { Toaster } from "@/components/ui/toaster"
import { IsRestoringProvider, QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { persistQueryClientRestore, persistQueryClientSubscribe } from "@tanstack/react-query-persist-client"
import { queryPersistOptions } from "@/lib/query-persister"
import { LazyMotion, MotionConfig } from "framer-motion"
import { loadMotionFeatures } from "@/lib/motion-features-loader"

import React, { useEffect, useState } from "react"
import { CookiesProvider } from "react-cookie"
import { usePlayerStore } from "@/lib/store"

// ...queryClient sin cambios...

// La caché persistida se restaura al cargar el módulo, no en un efecto tras el primer
// render: si no, los loaders del router ya pidieron todo a la red (medido: collection a
// 2160 ms, lectura de IndexedDB a 2747 ms). Mismo orden que PersistQueryClientProvider:
// restaurar y después suscribirse para guardar, aunque la restauración falle.
const persistOptions = { ...queryPersistOptions, queryClient }
/** Se resuelve (nunca rechaza) cuando terminó la restauración desde IndexedDB. */
export const cacheRestored: Promise<void> = persistQueryClientRestore(persistOptions)
    .catch(() => {})
    .then(() => {
        persistQueryClientSubscribe(persistOptions)
    })

export const ClientProviders: React.FC<ClientProvidersProps> = ({ children }) => {
    // Mientras restaura, useQuery no dispara pedidos (como hacía PersistQueryClientProvider).
    const [isRestoring, setIsRestoring] = useState(true)
    useEffect(() => {
        let alive = true
        void cacheRestored.then(() => {
            if (alive) setIsRestoring(false)
        })
        return () => {
            alive = false
        }
    }, [])

    // ...efecto de tvMode sin cambios...

    return (
        <MotionConfig reducedMotion="user">
            {/* Funciones de animación en un chunk aparte (ver motion-features-loader). */}
            <LazyMotion features={loadMotionFeatures} strict>
                <CookiesProvider>
                    <QueryClientProvider client={queryClient}>
                        <IsRestoringProvider value={isRestoring}>
                            <WebsocketProvider>
                                {children}
                                <Toaster />
                                <PwaRegistry />
                            </WebsocketProvider>
                        </IsRestoringProvider>
                    </QueryClientProvider>
                </CookiesProvider>
            </LazyMotion>
        </MotionConfig>
    )
}
```

`main.tsx`. El import cambia a `import { ClientProviders, cacheRestored, queryClient } from "@/app/client-providers"`, y en `init` el render espera a la restauración, con un tope de 400 ms (el splash de `index.html` sigue visible mientras tanto):

```tsx
async function init() {
    const rootElement = document.getElementById("root")
    if (!rootElement) {
        throw new Error("Root element '#root' not found in DOM")
    }
    // Los loaders del router corren al montar RouterProvider: esperar a que la caché
    // persistida esté en memoria (pocos ms; tope de 400 ms si IndexedDB tarda). El splash
    // de index.html sigue visible mientras tanto.
    await Promise.race([cacheRestored, new Promise((resolve) => setTimeout(resolve, 400))])
    ReactDOM.createRoot(rootElement).render(
        <ClientProviders>
            <RouterProvider router={router} />
        </ClientProviders>,
    )
```

Al final del archivo, la llamada pasa a ser `void init()` (antes `init()`). El resto de `init` no cambia.

- **E. Cambios secundarios:**
  - `grep -rn "PersistQueryClientProvider" apps/web/src`: hoy solo `client-providers.tsx`.
  - Los tests que montan providers propios (`series-hero.test.tsx` y otros con `QueryClientProvider`) no usan `ClientProviders`, así que no cambian.
  - En `main.tsx`, `init` pasa a ser `async`: el `throw` del root ausente ahora rechaza una promesa en lugar de lanzar en forma síncrona, y lo registra el listener global `unhandledrejection`, que ya existe.
- **F. Justificación y costo:** la persistencia existe para pintar al instante al arrancar, y hoy en la primera pantalla no cumple esa función. El costo es esperar unos ms antes del primer render (con tope de 400 ms). El riesgo está en el orden de suscripción: se replica el del provider oficial.
- **G. Validación:**
  - `typecheck`, `lint`, `test:run`.
  - Rendimiento con `restore-race.cjs`: en B, `idb-get-ok` sale antes de cualquier `fetch` de loader. En `/home` con caché de menos de 5 min no se pide `library/collection` (staleTime de `useGetLibraryCollection`). En `/series/12971` directo, el loader no espera la red.
  - Repetir la medición del Paso 0 y comparar con A.
  - Manual: borrar IndexedDB (sin caché) → la app arranca igual. Navegar Inicio → Series → ficha → reproductor (con el PATCH bloqueado) → Ajustes.
- **H. Criterio de aceptación:** se cumple la condición del Paso 0, no hay pedidos extra al arrancar y la suite está en verde.
- **I. Reversión:** restaurar `app/client-providers.tsx` y `main.tsx`.

#### P2.5 · DT-03 · Decidir si se persisten las fichas `anime-entry` (riesgo BAJO; **primero medir**, después de P2.4)

- **Paso 0, medición.** Con P2.4 aplicado, en build de producción y misma corrida A/B:
  - (a) Costo de escritura: el recorrido de M1 + M3 (suma de ms de `put` y máximo), con 5 fichas y con 15 fichas.
  - (b) Beneficio: tiempo hasta que aparece la lista de episodios al abrir **desde Series** una ficha ya visitada, tras cerrar y reabrir la app (perfil persistente).
  - **Aplicar la exclusión solo si** (b) empeora menos de 50 ms de mediana (backend local) y (a) baja al menos un 50 %. Si (b) empeora más, no aplicar y registrar las cifras en este archivo.
- **Acción** (si corresponde), en `lib/query-persister.ts` › `EXCLUDED_KEY_PATTERNS`:

```ts
    // Fichas completas (~400 KB cada una, 89 % de la caché persistida medida): se
    // revalidan al montar (staleTime 30 s), así que persistirlas solo encarecía cada escritura.
    "anime-entries-get-anime-entry",
```

- Test: extender el de P2.3 con `ANIME-ENTRIES-get-anime-entry` → `false`.
- **Validación:** M2 → caché persistida de menos de 300 KB tras el recorrido. Manual: abrir una ficha tras reabrir la app sin el backend corriendo debe mostrar el estado de error de la ficha y no una ficha vieja. Es un cambio de comportamiento que hay que aceptar explícitamente.
- **Reversión:** restaurar `lib/query-persister.ts` y su test.

#### P2.6 · DT-06 · Suscriptores WS pasivos sin re-render por mensaje (riesgo BAJO)

- **Símbolo:** `hooks/use-websocket.ts` › `useWebSocket`.
- **Evidencia:** M7 (23 renders con 20 mensajes). En `react-use-websocket/dist/lib/attach-shared-listeners.js` › `bindMessageHandler`, `onMessage` se llama **antes** de `filter`, y `filter(message) !== true` corta antes de `setLastMessage`. El hook no expone `lastMessage` (solo devuelve `{ sendJsonMessage }`), así que ningún consumidor lo lee: `player-core.ts:224`, `use-mpv-player.ts:38`, `PlaybackSettings.tsx:48` y `playback-tab.tsx:40`.
- **ANTES:**

```ts
    const { sendJsonMessage } = useReactUseWebSocket(url, {
        share: true,
        shouldReconnect: () => true,
        retryOnError: true,
        reconnectAttempts: 20,
        reconnectInterval: 3000,
        onMessage: (event) => {
```

- **DESPUÉS:**

```ts
    const { sendJsonMessage } = useReactUseWebSocket(url, {
        share: true,
        shouldReconnect: () => true,
        retryOnError: true,
        reconnectAttempts: 20,
        reconnectInterval: 3000,
        // Nadie lee lastMessage: sin esto, cada mensaje del socket compartido re-renderizaba
        // el componente que usa el hook (el reproductor incluido). onMessage corre igual.
        filter: () => false,
        onMessage: (event) => {
```

- **Validación:** `typecheck`, `vitest run src/components/video src/routes/settings`. Repetir M7 con el patrón nuevo: el suscriptor pasivo queda en 3 renders (antes 23) y `onMessage` sigue en 20/20. Manual: en Ajustes › Reproducción, los cambios que llegan por WS siguen reflejándose (`playback-tab.tsx` usa `onMessage`).
- **Reversión:** restaurar el archivo.

### Fase 3 — Calidad

#### P3.1 · DT-05 · `useAppStore` deja de persistir (riesgo MEDIO)

- **A. Problema:** `useAppStore` es un espejo de solo lectura de `ui-store`, `player-store` y `queue-store` (comentario en L114-117), pero tiene su propio `persist`. Cada `set` de un sub-store escribe dos veces en `localStorage` (M8), incluso cuando solo cambia un campo efímero. Al hidratar, el `merge` del espejo aplica su copia guardada **encima** de los valores de los sub-stores, así que si alguna vez difieren (cuota llena en una clave, una versión vieja) los lectores del espejo (`__root.tsx`, `theme-hooks.ts`, `use-tv-dpad.ts`, `floating-pill-nav.tsx`…) ven un valor distinto del que escriben los sub-stores.
- **B. Evidencia:** M8. Cada campo de `partialize` del espejo ya está en el `partialize` de su sub-store: UI (`ui-store.ts` › `name: "kamehouse-ui-settings"`), reproductor (`player-store.ts` › `"kamehouse-player-settings"`, incluido `tvMode`) y cola (`queue-store.ts` L151-155 › `playlistQueue` limitado a 50, `currentQueueIndex`, `queueRepeatMode`). Los sub-stores hidratan en forma síncrona al crearse (zustand 5.0.13, `persist` › `hydrate` con `toThenable` sobre `localStorage`), y `index.ts` los importa antes de crear el espejo, así que `createCombinedSlice` ya lee valores hidratados. `grep -rn "kamehouse-app-settings" apps/web/src apps/desktop` → solo `lib/stores/index.ts:34`.
- **C. ANTES:** `lib/stores/index.ts` L1-111 (imports de `persist` y bloque `create<CombinedState>()(devtools(subscribeWithSelector(persist(…, { name: "kamehouse-app-settings", version, migrate, merge, partialize }))))`). Copiar del archivo al ejecutar: está modificado en el árbol y no se reproduce entero aquí para no desactualizarlo.
- **D. DESPUÉS** (imports y creación; el bloque `if (typeof window !== "undefined")` de sincronización y del audio de fondo queda igual):

```ts
import { useUIStore } from "./ui-store"
import { usePlayerStore } from "./player-store"
import { useQueueStore } from "./queue-store"

import { create, StateCreator } from "zustand"
import { subscribeWithSelector } from "zustand/middleware"
import { devtools } from "zustand/middleware"

type CombinedState =
    ReturnType<typeof useUIStore.getState> &
    ReturnType<typeof usePlayerStore.getState> &
    ReturnType<typeof useQueueStore.getState>

const createCombinedSlice: StateCreator<
    CombinedState,
    [],
    [],
    CombinedState
> = () => ({
    ...useUIStore.getState(),
    ...usePlayerStore.getState(),
    ...useQueueStore.getState(),
})

// Espejo de solo lectura: nace de los sub-stores ya hidratados (persisten cada uno lo suyo)
// y se mantiene por las suscripciones de abajo. Sin persist propio: duplicaba cada
// escritura en localStorage y, al hidratar, su copia vieja podía pisar a los sub-stores.
export const useAppStore = create<CombinedState>()(
    devtools(
        subscribeWithSelector((set, get, store) => ({
            ...createCombinedSlice(set, get, store),
        }))
    )
)
```

Y dentro del bloque `if (typeof window !== "undefined") {`, como primera línea:

```ts
    // Clave del persist que tenía el espejo: ya no se lee.
    try { localStorage.removeItem("kamehouse-app-settings") } catch { /* storage bloqueado */ }
```

- **E. Cambios secundarios:**
  - `routes/settings/tabs/system-tab.tsx` › `resetStore(useAppStore)` sigue funcionando: `getInitialState` existe sin `persist`.
  - `motion-tier.test.ts` mockea `useAppStore`: no cambia.
  - **Test nuevo** `src/lib/stores/app-store.test.ts`: antes de importar el módulo (`vi.resetModules()` + import dinámico), escribir en `localStorage` `kamehouse-player-settings` = `{"state":{"playerVolume":0.3,"tvMode":true},"version":0}` y `kamehouse-app-settings` = `{"state":{"playerVolume":0.9},"version":1}`. Esperar `useAppStore.getState().playerVolume === 0.3` (gana el sub-store), `tvMode === true` y `localStorage.getItem("kamehouse-app-settings") === null`. Después de `usePlayerStore.getState().setPlayerVolume(0.5)`, esperar `useAppStore.getState().playerVolume === 0.5`.
- **F. Justificación y costo:** una sola fuente persistida por campo y la mitad de escrituras. Se borran unas 70 líneas.
- **G. Validación:**
  - `typecheck`, `lint`, `vitest run src/lib/stores src/components/ui/kinetics`.
  - Repetir M8: `kamehouse-app-settings` = 0 escrituras; `kamehouse-ui-settings` sin cambios.
  - Manual en build de producción: cambiar volumen del reproductor (con el PATCH bloqueado), modo TV y música de fondo; recargar; los valores se conservan. Navegar con D-pad en modo TV (`use-tv-dpad.ts` lee `tvMode` e `isVideoActive` del espejo).
- **H. Criterio de aceptación:** los ajustes sobreviven a la recarga, 0 escrituras a la clave vieja, el test nuevo y la suite en verde.
- **I. Reversión:** restaurar `lib/stores/index.ts` y borrar `app-store.test.ts`. La clave borrada de `localStorage` se regenera sola al revertir.

---

## 3. Verificación

Estado inicial registrado el 16/10/2026 sobre `a249c13` más el árbol de trabajo compartido. Solo comandos que se corrieron y funcionaron:

| Comando (desde `apps/web`) | Resultado inicial |
|---|---|
| `npx tsc --noEmit` | exit 0, sin errores |
| `npx eslint src/` | exit 0, sin advertencias |
| `npx eslint` sobre los archivos de la zona (`src/api/client`, `src/api/hooks`, `src/app`, `src/hooks/use-websocket.ts`, `src/hooks/use-prefetch-anime-entry.ts`, `routes/series/$seriesId/-prefetch.ts` e `index.tsx`, `src/lib/stores`, `src/lib/store.ts`, `query-persister.ts`, `query-keys.ts`, `drive-status.ts`) | exit 0 |
| `node scripts/check-tokens.mjs` (`lint:tokens`) | **exit 1, ya fallaba:** `--ease-out-strong` usada sin definir en `src/routes/series/-series-shelf.css`. Es ajeno a Z3: no atribuirlo al plan. |
| `npx vitest run src/api src/app src/lib/stores src/lib/query-persister.test.ts src/hooks` | 9 archivos, 64 tests, todos pasan |
| `npx vitest run` (suite completa) | **119 archivos, 1005 tests, todos pasan** |
| `NODE_ENV=production npx rsbuild build -c rsbuild.z3.config.ts` (config temporal, ya borrada) | exit 0; HTML con scripts con hash |

Para repetir las mediciones (M1-M9) hay que reescribir los scripts, porque los originales se borraron. Su estructura era: `logproxy.cjs`, `measure.cjs`, `restore-race.cjs`, `storm.cjs`, `play.cjs`, `wslost.cjs`, `dehydrate-bench.cjs` y `wsprobe.cjs`. Se usan así:

1. Crear una config temporal que importe `rsbuild.config.ts` y cambie `output.distPath.root`.
2. Compilar y correr `node logproxy.cjs <puertoProxy> 43212 <log.jsonl>`. Variables opcionales: `FAIL503=<regex>` y `ALLOW_POST=<regex>`, que nunca dejan pasar `/continuity/`.
3. Servir con `KAMEHOUSE_DEV_API_PORT=<puertoProxy> NODE_ENV=production npx rsbuild preview -c <config> --port <libre>`.
4. Correr el script con `MSYS_NO_PATHCONV=1`.
5. Al terminar, matar los procesos por PID (`netstat -ano | grep <puerto>`) y borrar la config y la salida.
