# Lista de tareas: optimización del frontend (`apps/web`)

Plan: [`tasks/plan.md`](plan.md). Convención: `[ ]` pendiente, `[x]` hecho, `[~]` en espera, `[!]` revertido o desactualizado.

**Estado (2026-11-17):**
- **T0.1:** completo. Recorrido Inicio → Películas con backend: 56 y 5 peticiones, sin bloqueos de lectura.
- **T0.2:** completo en `docs/auditoria/frontend-base-2026-11-17.md`. Calidad, bundle, compilación, renders, pedidos e imágenes medidos con datos reales.
- **Checkpoint 0:** aprobado por el usuario (2026-11-17).
- **Fase 1 aplicada (2026-11-18), encima de cambios ajenos sin commit:**
  - T1.1: `ui-primitives` estrecho en `rsbuild.config.ts`. JS inicial 843,2 → 814,1 KB min (−29,1 KB). El criterio de 40 KB de Z4 no se cumple.
  - T1.2: `VITE_SCAN` quitado de `main.tsx`. Era rama muerta en dev.
  - T1.3: comentario de `rsbuild.pwa.ts` corregido: el mayor asset precacheado es `index.css`, no `hls`.
  - T1.4: `whenCacheRestored` en `lib/query-persister.ts` y `onSuccess` en `app/client-providers.tsx`. Los loaders de `/home` y `/series/$seriesId` esperan la caché. La carrera queda corregida en 6 de 6 recargas.
  - Verificado: typecheck, lint de los archivos tocados, `test:run` (solo falla el guardián de Cronología que ya existía), humo de paleta y de Select, y consola sin errores en el servidor de desarrollo.
  - Sin commit. Las líneas tocadas están dentro de cambios sin commit de otra sesión: conviene revisarlas al integrarlas.
- **Checkpoint 1:** aprobado por el usuario (2026-11-18).
- **Fase 2 aplicada (2026-11-18), encima de cambios ajenos sin commit:**
  - Compilan 6 de 6 componentes (antes 1 de 6): `MoviesPage`, `MoviesHero`, `MovieCard`, `RootComponent`, `PageTransition`, `SeriesDetailClient`.
  - T2.1 `PageTransition`: contador en vez de `--remaining`. Comprobado: `data-page-entering` se retira al navegar.
  - T2.2 Películas: `?.` fuera de `||`/`??`, `try` convertido en `.then/.catch` y dependencias de `advanceShuffle`. Comprobado: «Añadir a Mi Lista» muestra el aviso de éxito.
  - T2.3 `zVariant` fuera del componente de la ficha.
  - T2.4 backdrop con `localImage`. **No reduce las peticiones externas a TMDB**: sigue habiendo 62 por carga en /movies, igual que antes. Vienen de otros componentes.
  - T2.5 descartada por medición: el LCP de las fichas es texto.
  - Renders (medianas): cambio de orden −34 %, hover −53 %, Inicio → Películas −36 %. La escritura no cambia porque es el buscador global, no Películas.
  - LCP: sin mejora. Sube entre 8 y 60 ms en seis de las siete rutas, probablemente ruido de medición; no se atribuye a estos cambios.
  - Pendiente: el shell no entra en el top 12 de renders, así que T2.1 sobre el shell no está verificado. Falta la pasada manual con teclado.
- **Checkpoint 2:** aprobado por el usuario (2026-11-18).
- **Fase 3 aplicada (2026-11-18):**
  - T3.1 + T3.2: `requests.ts` reintenta 502/503/504 solo con `Retry-After`. `ApiError` lleva `retryAfterMs` y `client-providers.tsx` reintenta a nivel de consulta solo con esa señal. Medido con inyección de 503: sagas de la ficha 48 → 2 peticiones; miniaturas de cronología 192 → 4 (una por miniatura).
  - T3.3: logs del servidor, selector de carpetas y búsquedas semánticas excluidos de la caché, con test.
  - T3.4: decisión pendiente de tu revisión. Las fichas de anime son el 88 % de la caché persistida (2,27 MB de 2,57 MB). Recomiendo mantenerlas: la ficha se muestra desde la caché restaurada sin ir a red.
  - T3.5: `useAppStore` ya no persiste nada propio. La versión 2 descarta el espejo antiguo. Las escrituras duplicadas eran 0 en el recorrido antes del cambio; lo que se elimina es el riesgo de que el espejo pise a los sub-stores.
  - T3.6: `filter: () => false` en el hook compartido. Test: 20 mensajes provocaban 20 renders; ahora no provocan ninguno. Afecta también al reproductor (`player-core`, `use-mpv-player`), que no lee `lastMessage`, así que no cambia su comportamiento.
  - Suite completa: solo falla el guardián de Cronología que ya existía.
- **Checkpoint 3:** aprobado por el usuario (2026-11-18). T3.4 decidida: se mantienen las fichas de anime en la caché persistida.
- **Estado de commits (2026-11-18):** `HEAD` es `8ea2329`, un commit de otra sesión con 965 archivos. Incluye casi todo lo de las fases 1 a 3. Sin commitear quedan T3.5, T3.6 y los tests nuevos. Ese commit también incluye un temporal de verificación mío, `apps/web/rsbuild.fase3-build.config.ts`: está borrado del disco y su eliminación preparada en el índice, sin commitear. No he tocado el historial.
- **Hallazgos de la medición:** CT-06 no se confirma (el LCP de las fichas es texto). Hay 48 a 69 peticiones directas a `image.tmdb.org` por carga, también en `/settings` (origen por confirmar), y `<img>` a TMDB directo en cuatro rutas. Son candidatos a tareas nuevas.
- **Hallazgos nuevos frente al plan:** `lint:tokens` pasa, así que QA-07 no reproduce (T5.2 queda por confirmar). `RootComponent` ya compila (CT-02 parcial). Hay un fallo preexistente en `design-series.guard.test.ts` (Cronología), que no se relaja.
- **Fase 4 aplicada (2026-11-18), pendiente de navegador:** el backend (`43212`) y el dev server (`43210`) están apagados, así que no hay pasada en navegador ni axe.
  - T4.1: `SettingsLoadError` con «Reintentar». Con `GET /settings` fallido no se muestra el formulario, así que Guardar y Descartar no escriben valores de fábrica. Pendiente: GET 500 en navegador.
  - T4.2: los fallos de los toggles fuera de Ajustes (`persistLibraryPatch`, `persistThemePatch`) muestran aviso y revalidan la caché. Los sliders de volumen no llaman al servidor al arrastrar: solo cambian el formulario y el store local, y el PATCH sale al pulsar Guardar. No hay ráfaga por paso que agrupar. Pendiente: medir el arrastre con el proxy.
  - T4.3 y T4.4: ya están en el código comprometido. Escape devuelve el foco al botón Buscar; el input es `combobox` con `aria-activedescendant` y las opciones tienen `id`. Pendiente: teclado en navegador y axe.
  - T4.5: `settings.test.ts` incluye un guardián de tipos. Cada campo que declara `settingsSchema` debe existir en `SaveSettings_Variables`. Solo comprueba esa dirección: el modelo tiene campos que el formulario no edita (`tvMode`, `id`/`createdAt`/`updatedAt`, buena parte de `theme`) y `mediaPlayer` es un mapa libre. Mutación temporal (renombrar `scannerStrictStructure` en el esquema): `tsc` falla; revertida. Corre en `pnpm typecheck`, no en `vitest run`.
  - T4.6: sin casts en `index.lazy.tsx` del formulario. El formulario usa `SettingsFormInput` (entrada de zod); `changedSettings` devuelve `SettingsPatch`; `applySettingsPatch` sustituye al bucle de `setValue`. Quedan un `as` con motivo en el reinicio de fábrica de `system-tab.tsx` (`lastScanAt` es unknown) y casts de claves de pestañas, fuera del formulario. Pendiente: Guardar en navegador, editando durante el guardado.
  - T4.7: el episodio sintético lleva `localFile: null` y `fileMetadata: null`. No se adjunta el archivo: `resolveLocalFileForEpisode` y `lfMap` lo buscan con metadata primero y el episodio sale de `parsedInfo`, así que adjuntarlo podría cambiar el archivo elegido.
  - T4.8: `hooks/use-focus-trap.test.tsx` (`.tsx` porque renderiza). Mutación temporal (quitar la restauración del foco): falla; revertida.
  - Verificación: `typecheck` sin errores; `eslint src/` sin problemas; `lint:tokens` OK; `vitest` 227 de 228 archivos. El único fallo es el guardián de Cronología que ya existía.
  - Sin commit.

Cada tarea incluye criterios de aceptación y verificación. La verificación común, cuando aplica, es `pnpm --filter kamehouse-web typecheck`, `lint` de los archivos tocados y `test:run` de la carpeta afectada.

---

## Fase 0: línea base (sin cambios de producto)

## Tarea T0.1: Preparar la medición
**Tamaño:** S · **Riesgo:** BAJO · **Dependencias:** ninguna

**Descripción:** Dejar listo el harness de medición fuera del repo. Playwright (`node_modules/playwright-core`) y Chrome (`C:/Program Files/Google/Chrome/Application/chrome.exe`) ya existen. Los scripts de las auditorías ya no están, así que se reescriben en `scratch/frontend-base/`: un proxy de registro y un script de Playwright.

**Criterios de aceptación:**
- [ ] El proxy reenvía `/api` a `127.0.0.1:43212` y registra método, URL, estado y tiempo de cada pedido.
- [ ] Bloquea toda escritura (no GET) respondiendo 200 sin tocar la base.
- [ ] Bloquea siempre `PATCH /api/v1/continuity/item`.
- [ ] Usa un puerto libre distinto de 43210, 43211 y 43212.

**Verificación:**
- [ ] Recorrido de prueba Inicio → Películas. El log del proxy muestra los pedidos y ninguna escritura llega al backend.

**Archivos probables:** `scratch/frontend-base/*` (fuera del repo, ignorado por git).

---

## Tarea T0.2: Línea base registrada
**Tamaño:** M · **Riesgo:** BAJO · **Dependencias:** T0.1

**Descripción:** Registrar el estado actual con el mismo método que se usará al final, para poder comparar.

**Criterios de aceptación:**
- [ ] Calidad: `typecheck`, `lint`, `lint:tokens` y `test:run` registrados. Los fallos previos quedan anotados como preexistentes (Z5 dice que `lint:tokens` falla por QA-07; se confirma).
- [ ] Build temporal a `scratch/`: scripts iniciales, JS inicial min y gzip, entradas de precache, presencia de react-scan, `.woff` en precache y tamaño de `index.css`.
- [ ] Compilación: `compiler_runtime` por componente en Películas, shell y ficha (método de Z2, con `output.minify: false` para leer nombres).
- [ ] Renders, con hook de DevTools falso (método de Z2): cambio de `?q=`, hover en Películas, tipeo en el buscador e Inicio → Películas.
- [ ] Pedidos por ruta y duplicados, desde el proxy.
- [ ] Imágenes: LCP por ruta, `loading`, `fetchpriority` y tamaño natural frente a pintado.
- [ ] Datos reales de la biblioteca por el proxy de solo lectura.

**Verificación:**
- [ ] Tabla base completa en `docs/auditoria/frontend-base-<fecha>.md`, con el método descrito.
- [ ] Ningún cambio de producto. La config temporal y `scratch/` se borran al terminar, y los procesos de preview se matan por PID.

**Archivos probables:** `docs/auditoria/frontend-base-<fecha>.md` (nuevo). Temporal: `apps/web/rsbuild.frontend-base.config.ts` (se borra).

---

## Checkpoint 0: línea base
- [ ] Tabla base completa y reproducible
- [ ] Revisión humana antes de la Fase 1

---

## Fase 1: arranque en frío

## Tarea T1.1: Ajustar `ui-primitives`
**Tamaño:** S · **Riesgo:** MEDIO · **Dependencias:** T0.2

**Descripción:** DC-01. `forceSplitting["ui-primitives"]` (`rsbuild.config.ts` L175) mete en el JS inicial todo `@radix-ui`. Select, scroll-area, popover y popper solo se usan en rutas o modales lazy. Excluirlos del forzado. Mantener `lucide` forzado: Z4 descartó quitarlo porque pierde un chunk estable.

**Criterios de aceptación:**
- [ ] El JS inicial baja en un A/B de la misma corrida (Z4 estimó unos 48 KB min; se confirma sobre la base actual).
- [ ] `cmdk` sale de los scripts iniciales.
- [ ] Ajustes (selects), selector de carpetas, popover de Cronología y paleta funcionan con mouse y teclado.

**Verificación:**
- [ ] A/B con la métrica de T0.2 en la misma corrida.
- [ ] Tests de la carpeta de Ajustes.

**Archivos probables:** `apps/web/rsbuild.config.ts`.

---

## Tarea T1.2: Verificar y quitar `VITE_SCAN`
**Tamaño:** XS · **Riesgo:** BAJO · **Dependencias:** ninguna

**Descripción:** `loadEnv` solo inyecta `KAMEHOUSE_PUBLIC_*`, así que `import.meta.env.VITE_SCAN` probablemente siempre es `undefined`. Confirmarlo en un dev server propio, en un puerto libre (no el 43210, que ya está en uso). Si no vale `"true"`, quitar esa condición y dejar la activación por `localStorage`.

**Criterios de aceptación:**
- [ ] React Scan sigue activable con `localStorage` `kamehouse:scan`.
- [ ] No quedan referencias a `VITE_SCAN` en `apps/web/src`.

**Verificación:**
- [ ] Dev server propio: el valor de `import.meta.env.VITE_SCAN` queda registrado.

**Archivos probables:** `apps/web/src/main.tsx` (L43-58).

---

## Tarea T1.3: Comentario falso del precache
**Tamaño:** XS · **Riesgo:** BAJO · **Dependencias:** T0.2

**Descripción:** `rsbuild.pwa.ts` L9 dice "backdrops y sagas en precache", pero `public/` no entra al precache. Corregir solo el texto.

**Criterios de aceptación:**
- [ ] Solo cambia el comentario.
- [ ] El precache medido en T0.2 queda igual.

**Verificación:**
- [ ] Mismo número de entradas de precache que en T0.2.

**Archivos probables:** `apps/web/rsbuild.pwa.ts`.

---

## Tarea T1.4: Caché antes que los loaders
**Tamaño:** M · **Riesgo:** MEDIO · **Dependencias:** T0.2

**Descripción:** DT-02. La restauración de IndexedDB corre en un efecto, después del primer render. Los loaders piden red antes. Z3 M5 midió `library/collection` a 2160 ms y la lectura de IDB a 2747 ms. Medir de nuevo con el método M5. Si se confirma, que la restauración termine antes de los loaders, o que el loader no espere la red cuando ya hay un dato persistido.

**Criterios de aceptación:**
- [ ] En `/home` en frío, la lectura de IDB termina antes del primer `fetch` de `library/collection`, o el primer render usa el dato persistido.
- [ ] Tests de `query-persister` en verde.

**Verificación:**
- [ ] Medición antes y después con el mismo método de T0.2.

**Archivos probables:** `apps/web/src/app/client-providers.tsx`, `apps/web/src/main.tsx`, `apps/web/src/lib/query-persister.ts`.

---

## Checkpoint 1: arranque y bundle
- [ ] A/B del bundle de T1.1 registrado
- [ ] Pasada manual de Ajustes, paleta, popover de Cronología y ficha
- [ ] Revisión humana antes de la Fase 2

---

## Fase 2: navegación y catálogos

## Tarea T2.1: Shell compilable
**Tamaño:** M · **Riesgo:** MEDIO · **Dependencias:** T0.2

**Descripción:** CT-02. `RootComponent` tiene `import("@tauri-apps/api/event")` dentro de un efecto (`__root.tsx` L241). `PageTransition` decrementa `--remaining` sobre una variable capturada (`page-transition.tsx` L235). El compilador rechaza ambos. Sacar el import del efecto, a un helper de emisión o a un import estático que no rompa el split. Reemplazar el decremento por un contador en un objeto o en un ref.

**Criterios de aceptación:**
- [ ] `compiler_runtime` aparece en `RootComponent` y en `PageTransition`.
- [ ] Los renders del shell al cambiar `?q=` bajan frente a T0.2.
- [ ] Sin cambio visual. Los eventos a Tauri siguen llegando.

**Verificación:**
- [ ] Compile check y renders según T0.2.
- [ ] Tests de `page-transition` y del shell.

**Archivos probables:** `apps/web/src/routes/__root.tsx`, `apps/web/src/components/shared/page-transition.tsx`.

---

## Tarea T2.2: Películas compilable
**Tamaño:** M · **Riesgo:** MEDIO · **Dependencias:** T0.2

**Descripción:** CT-01. El compilador salta los tres componentes. Causas: `?.` dentro de condiciones lógicas, `?.`/`||`/`??` dentro de `try`, y un `useCallback` con dependencias que no puede preservar (`-MovieCard.tsx` L110, `handleQuickQueue`). Refactor sin cambio de comportamiento.

**Criterios de aceptación:**
- [ ] `compiler_runtime` en `MoviesPage`, `MoviesHero` y `MovieCard`.
- [ ] Renders al hover y al tipear bajan frente a T0.2. Z2 midió −66 % en hover; es referencia, no meta.
- [ ] Tests de Películas en verde.

**Verificación:**
- [ ] Compile check y renders según T0.2.

**Archivos probables:** `apps/web/src/routes/movies/index.lazy.tsx`, `apps/web/src/routes/movies/-components/movies-hero.tsx`, `apps/web/src/routes/movies/-MovieCard.tsx`.

---

## Tarea T2.3: Ficha de serie compilable
**Tamaño:** XS · **Riesgo:** BAJO · **Dependencias:** T0.2

**Descripción:** CT-03. El inicializador de `zVariant` (`series/$seriesId/index.lazy.tsx` L196-203) tiene `try` y `||`. Mover la lectura a un helper fuera del componente.

**Criterios de aceptación:**
- [ ] `compiler_runtime` en `SeriesDetailClient`.
- [ ] Mismo valor inicial: kai para las series nativas, `z` de fallback, y un localStorage ilegible no rompe.

**Verificación:**
- [ ] Compile check según T0.2.
- [ ] Tests de `series-hero` en verde.

**Archivos probables:** `apps/web/src/routes/series/$seriesId/index.lazy.tsx`.

---

## Tarea T2.4: Backdrop global por el proxy
**Tamaño:** S · **Riesgo:** BAJO · **Dependencias:** T0.2

**Descripción:** CT-08. `getLowResImage` (`dynamic-backdrop.tsx` L100-101 y L189) se llama sin `localImage` y pide w185 directo a TMDB.

**Criterios de aceptación:**
- [ ] Cero pedidos a `image.tmdb.org` al cargar `/movies`. Z2 midió 2.
- [ ] El fondo se ve igual.

**Verificación:**
- [ ] Pedidos desde el proxy según T0.2.

**Archivos probables:** `apps/web/src/components/shared/dynamic-backdrop.tsx`.

---

## Tarea T2.5: Póster de la ficha de serie como LCP
**Tamaño:** S · **Riesgo:** BAJO · **Dependencias:** T0.2

**Descripción:** CT-06. El póster es el LCP de `/series/:id`, con 1048 ms en Z2. Va con `loading=lazy` y sin `priority`. El `sizes` por defecto pide w500 para una caja de 174 px. Aplicar `priority` y ajustar `sizes` solo si la medición lo mejora.

**Criterios de aceptación:**
- [ ] El LCP de `/series/12971` queda igual o mejor que en T0.2.
- [ ] El póster no espera al IntersectionObserver en el primer pantallazo.

**Verificación:**
- [ ] LCP medido antes y después.

**Archivos probables:** `apps/web/src/components/ui/media-hero.tsx`.

---

## Checkpoint 2: navegación y catálogos
- [ ] Renders y compilación contra T0.2
- [ ] Pasada manual de Inicio, Series, ficha, Películas, Cronología y Ajustes, con teclado
- [ ] Revisión humana antes de la Fase 3

---

## Fase 3: datos bajo fallo y persistencia

## Tarea T3.1: Miniaturas de respaldo sin reintentos
**Tamaño:** S · **Riesgo:** BAJO · **Dependencias:** T0.2

**Descripción:** DT-01 (P2.1). Con TMDB en modo degradado, cada miniatura reintenta. Z3 estimó hasta 48 pedidos por miniatura (estimado, no medido).

**Criterios de aceptación:**
- [ ] Con 503 permanente, un máximo de un intento por miniatura.
- [ ] Las miniaturas con imagen local no cambian.

**Verificación:**
- [ ] Proxy `FAIL503` sobre el endpoint de still de TMDB.

**Archivos probables:** `apps/web/src/api/hooks/tmdb-episode.hooks.ts`, `apps/web/src/api/hooks/anilist-episode.hooks.ts`.

---

## Tarea T3.2: Reintentar 5xx solo con `Retry-After`
**Tamaño:** M · **Riesgo:** MEDIO · **Dependencias:** T3.1

**Descripción:** DT-01 (P2.2). `requests.ts` L129-130 y L168 reintentan 429, 502, 503, 504 y `TypeError`. `client-providers.tsx` L30-35 reintenta `ApiError` 502/503/504 hasta 15 veces. Reintentar solo cuando el servidor indique cuándo volver.

**Criterios de aceptación:**
- [ ] Un GET con 503 sin `Retry-After` hace como máximo 3 pedidos en 10 s. Hoy hace 48 en 55 s (Z3 M6).
- [ ] Con `Retry-After`, se respeta el tiempo indicado.
- [ ] Los POST no cambian.

**Verificación:**
- [ ] Proxy `FAIL503` sobre `sagas`, con el conteo de pedidos.

**Nota:** el servidor no envía `Retry-After` en estados permanentes. Ese cambio queda fuera de alcance.

**Archivos probables:** `apps/web/src/api/client/requests.ts`, `apps/web/src/app/client-providers.tsx`.

---

## Tarea T3.3: Exclusiones de persistencia
**Tamaño:** XS · **Riesgo:** BAJO · **Dependencias:** ninguna

**Descripción:** DT-07. `EXCLUDED_KEY_PATTERNS` (`query-persister.ts` L12-27) no cubre `STATUS-get-log-*`, `DIRECTORY-SELECTOR-*` ni `INTELLIGENCE-semantic-search`.

**Criterios de aceptación:**
- [ ] Un test comprueba que esas claves no se escriben en IndexedDB.

**Verificación:**
- [ ] `test:run` de `lib/query-persister`.

**Archivos probables:** `apps/web/src/lib/query-persister.ts`, `apps/web/src/lib/query-persister.test.ts`.

---

## Tarea T3.4: Decidir si se persisten las fichas `anime-entry`
**Tamaño:** S · **Riesgo:** BAJO · **Dependencias:** T1.4, T3.3 · **Condicionado a medición**

**Descripción:** DT-03. Las fichas de anime ocupan 89–91 % de la caché persistida (Z3 M2). Decidir solo después de T1.4. Si la caché llega tarde, el beneficio de persistirlas es falso.

**Criterios de aceptación:**
- [ ] Decisión registrada con datos de T0.2 y T1.4: tamaño, coste de escritura y ahorro.
- [ ] Si se excluyen, hay test.

**Verificación:**
- [ ] Medición de la caché persistida antes y después.

**Archivos probables:** `apps/web/src/lib/query-persister.ts`.

---

## Tarea T3.5: Ajustes persistidos una sola vez
**Tamaño:** M · **Riesgo:** MEDIO · **Dependencias:** ninguna

**Descripción:** DT-05. `useAppStore` (`lib/stores/index.ts`, L87-126) persiste `kamehouse-app-settings`, con los mismos campos que `ui-store` (`kamehouse-ui-settings`). Z3 midió 22 pares de escrituras idénticas. Además, su `merge` deja ganar la copia vieja sobre los sub-stores.

**Criterios de aceptación:**
- [ ] En el recorrido, cero escrituras duplicadas.
- [ ] Tras recargar, tema y ajustes se mantienen.
- [ ] Tests de hidratación en verde.

**Verificación:**
- [ ] Conteo de `setItem` con el mismo método que Z3 M8.

**Antes de tocar:** comprobar quién lee `useAppStore`.

**Archivos probables:** `apps/web/src/lib/stores/index.ts` y su test.

---

## Tarea T3.6: Suscriptores WS pasivos
**Tamaño:** S · **Riesgo:** BAJO · **Dependencias:** ninguna

**Descripción:** DT-06 (P2.6). Los suscriptores pasivos re-renderizan por cada mensaje. Z3 M7 midió 23 renders por una ráfaga de 20. `player-core.ts` y `use-mpv-player.ts` quedan fuera de esta tarea (fase P).

**Criterios de aceptación:**
- [ ] Una ráfaga de 20 mensajes produce como máximo 4 renders en el suscriptor pasivo.
- [ ] Los 20 mensajes se siguen procesando.

**Verificación:**
- [ ] Test de renders con `react-use-websocket` real y servidor `ws` local, como en Z3 M7.

**Archivos probables:** `apps/web/src/hooks/use-websocket.ts`, `PlaybackSettings.tsx` (ruta por confirmar).

---

## Checkpoint 3: datos y persistencia
- [ ] Tormenta 503 con proxy `FAIL503`
- [ ] Restauración de caché en frío
- [ ] Ráfaga WS
- [ ] Persistencia sin logs
- [ ] Revisión humana antes de la Fase 4

---

## Fase 4: Ajustes y buscador

## Tarea T4.1: Ajustes con error de carga visible
**Tamaño:** S · **Riesgo:** BAJO · **Dependencias:** ninguna

**Descripción:** QA-01. Si `GET /settings` falla, la página muestra valores de fábrica como si fueran reales. «Descartar» los escribe en los stores.

**Criterios de aceptación:**
- [ ] Con GET 500, aparece un aviso con opción de reintentar.
- [ ] No se muestran valores de respaldo como reales.
- [ ] Ni «Guardar» ni «Descartar» escriben esos valores.

**Verificación:**
- [ ] Proxy que devuelve 500 en `GET /settings`, y pasada manual.

**Archivos probables:** `apps/web/src/routes/settings/index.lazy.tsx`.

---

## Tarea T4.2: Sliders con un PATCH al soltar
**Tamaño:** M · **Riesgo:** MEDIO · **Dependencias:** T4.1

**Descripción:** QA-02. `RangeSlider` manda un PATCH por paso: 20 por arrastre (Z5). Los errores se tragan con `.catch(() => {})`. Agrupar (flush al soltar o debounce corto) y mostrar el error, revirtiendo el valor en caché si falla. Reutilizar el patrón de `flushTmdbKey` (`system-tab.tsx`).

**Criterios de aceptación:**
- [ ] Un arrastre completo produce como máximo 2 PATCH. Hoy produce 20.
- [ ] Con un PATCH fallido aparece un aviso, y el valor en pantalla vuelve al del servidor.

**Verificación:**
- [ ] Conteo de PATCH con el proxy.

**Pendiente:** confirmar en WebView2 que `pagehide` se dispara al cerrar la ventana (QA-02 en Tauri).

**Archivos probables:** `apps/web/src/lib/server/persist-settings.ts`, `apps/web/src/routes/settings/tabs/playback-tab.tsx`.

---

## Tarea T4.3: Foco al cerrar el buscador
**Tamaño:** XS · **Riesgo:** BAJO · **Dependencias:** ninguna

**Descripción:** QA-05. Escape (`handleEscape`, `expandable-search.tsx` L128-144) desmonta el input y el foco cae a `<body>`.

**Criterios de aceptación:**
- [ ] Tras Escape, `document.activeElement` es el botón Buscar.

**Verificación:**
- [ ] Prueba con Playwright.

**Archivos probables:** `apps/web/src/components/ui/app-layout/expandable-search.tsx`.

---

## Tarea T4.4: Semántica de combobox en el buscador
**Tamaño:** M · **Riesgo:** MEDIO · **Dependencias:** T4.3

**Descripción:** QA-06. ↑/↓ mueven una selección solo visual.

**Criterios de aceptación:**
- [ ] Input con `role="combobox"`. Lista con `role="listbox"`. Opciones con `role="option"` y `aria-activedescendant`.
- [ ] axe sin violaciones en `/home` con el buscador abierto.

**Verificación:**
- [ ] axe y DOM. Lector de pantalla real: pendiente.

**Archivos probables:** `apps/web/src/components/ui/app-layout/expandable-search.tsx`.

---

## Tarea T4.5: Guardián de tipos de Ajustes
**Tamaño:** S · **Riesgo:** BAJO · **Dependencias:** ninguna

**Descripción:** QA-04. El esquema escrito a mano (`lib/server/settings.ts`) no se compara con el modelo generado (`SaveSettings_Variables`).

**Criterios de aceptación:**
- [ ] El test pasa hoy.
- [ ] Falla si se renombra un campo del modelo. Se comprueba con una mutación temporal que se revierte.

**Verificación:**
- [ ] `test:run` de `lib/server/settings`.

**Archivos probables:** `apps/web/src/lib/server/settings.test.ts`, `apps/web/src/lib/server/settings.ts` si hace falta.

---

## Tarea T4.6: Quitar los casts del formulario
**Tamaño:** M · **Riesgo:** MEDIO · **Dependencias:** T4.1, T4.5

**Descripción:** QA-03. `zodResolver(...) as unknown as Resolver<…>` y `onSubmit as unknown as SubmitHandler<…>`. Z5 verificó que `useForm<In, unknown, Out>` compila sin casts.

**Criterios de aceptación:**
- [ ] Cero casts en el formulario.
- [ ] `typecheck` limpio.
- [ ] Ajustes guarda igual.

**Verificación:**
- [ ] `typecheck`, y flujo de guardado en la pasada manual.

**Archivos probables:** `apps/web/src/routes/settings/index.lazy.tsx`.

---

## Tarea T4.7: Episodio sintético tipado
**Tamaño:** XS · **Riesgo:** BAJO · **Dependencias:** ninguna

**Descripción:** QA-08. `as unknown as Anime_Episode` (`use-series-data.ts` L159-174) esconde campos requeridos (`localFile`, `fileMetadata`).

**Criterios de aceptación:**
- [ ] Sin cast, con los campos completos.
- [ ] Tests de `series-playback.helpers` en verde.

**Verificación:**
- [ ] `typecheck` y `test:run`.

**Archivos probables:** `apps/web/src/routes/series/$seriesId/-hooks/use-series-data.ts`.

---

## Tarea T4.8: Tests de foco de diálogos
**Tamaño:** S · **Riesgo:** BAJO · **Dependencias:** ninguna

**Descripción:** QA-10, con alcance reducido. `useTvDpad` ya no existe, así que solo se prueba `useFocusTrap`.

**Criterios de aceptación:**
- [ ] Un test que falla si se quita la restauración de foco al cerrar el diálogo.

**Verificación:**
- [ ] Mutación temporal que se revierte.

**Archivos probables:** `apps/web/src/hooks/use-focus-trap.test.ts` (nuevo).

---

## Checkpoint 4: Ajustes y buscador
- [ ] Flujos de Ajustes: error simulado, slider, guardado
- [ ] Buscador por teclado
- [ ] axe en `/home`, `/series`, `/movies`, `/chronology` y `/settings`
- [ ] Revisión humana antes de la Fase 5

---

## Fase 5: arte, tokens y limpieza

## Tarea T5.1: Arte de la estantería
**Tamaño:** M · **Riesgo:** MEDIO · **Dependencias:** otra sesión · **En espera**

**Descripción:** CT-07. La precarga de arranque ya es solo de las 6 poses de reposo. Los 12 PNG de `public/icons/series-icons` son trabajo sin commit de otra sesión, y los WebP del informe de optimización no aparecen en el árbol. Cuando esa sesión cierre, medir la decodificación de las 6 poses al arrancar y decidir el formato (WebP sin pérdida si ahorra). Revisar si `scripts/optimize-shelf-art.mjs` sigue vigente.

**Criterios de aceptación:**
- [ ] Decode medido antes y después.
- [ ] Sin cambio visual.

**Archivos probables:** `apps/web/src/routes/__root.tsx` (precarga), `apps/web/src/lib/helpers/goku-panorama.ts`.

---

## Tarea T5.2: Token inexistente en la estantería
**Tamaño:** XS · **Riesgo:** BAJO · **Dependencias:** otra sesión · **En espera**

**Descripción:** QA-07. `var(--ease-out-strong)` no existe en `routes/series/-series-shelf.css`. Invalida la declaración `transition` y hace fallar `lint:tokens`. El archivo está sin trackear.

**Criterios de aceptación:**
- [ ] `lint:tokens` pasa.
- [ ] La transición dura lo esperado (0,25 s).

**Archivos probables:** `apps/web/src/routes/series/-series-shelf.css`.

---

## Tarea T5.3: Exports sin uso, parte A
**Tamaño:** S · **Riesgo:** BAJO · **Dependencias:** ninguna

**Descripción:** DC-08. Quitar `export` a `MissingSources`, `SeriesAudioSummary`, `WATCHED_THRESHOLD`, `NumberedTarget`, `AUDIO_PROFILE_LABELS`, `AudioProfileOption` y `SeriesContinueWatchingProps`. Solo se usan dentro de su archivo.

**Criterios de aceptación:**
- [ ] `typecheck` sin avisos de `noUnusedLocals`.

**Verificación:**
- [ ] `grep -rlw <símbolo> apps/web/src --include=*.ts --include=*.tsx` devuelve solo el archivo que lo define.

**Archivos probables:** `apps/web/src/routes/series/$seriesId/-components/*`, `apps/web/src/routes/series/$seriesId/-hooks/*`.

---

## Tarea T5.4: Exports sin uso, parte B
**Tamaño:** S · **Riesgo:** BAJO · **Dependencias:** ninguna

**Descripción:** DC-08. `MovieEntry` está duplicado (`routes/movies/index.lazy.tsx` L34): importarlo de `./index`. Quitar `export` a `SpineLayout`, `LAYOUT_DEFAULT` y `SettingsSearchParams`.

**Criterios de aceptación:**
- [ ] Sin duplicados.
- [ ] `typecheck` y tests en verde.

**Archivos probables:** `apps/web/src/routes/movies/index.lazy.tsx`, `apps/web/src/lib/helpers/goku-panorama.ts`, `apps/web/src/routes/settings/index.tsx`.

---

## Tarea T5.5: Listón de `lint`
**Tamaño:** XS · **Riesgo:** BAJO · **Decisión del usuario**

**Descripción:** QA-09. Decidir si `lint` falla con warnings (`--max-warnings 0`). No se cambia nada sin esa decisión.

---

## Checkpoint 5: final
- [ ] `typecheck`, `lint`, `lint:tokens` (pasa tras T5.2) y `test:run` (no menos que la base)
- [ ] Build de medición
- [ ] Comparativa final frente a T0.2
- [ ] Pasada manual de las rutas afectadas

---

## Fase P: reproductor (solo auditoría)

## Tarea TP.1: Auditoría Z1
**Tamaño:** M · **Riesgo:** BAJO · **Sin cambios de código**

**Descripción:** Auditoría de solo lectura del reproductor, con el formato del prompt A de `docs/auditoria-frontend.md`. Salida: `docs/auditoria/Z1-reproductor.md`.

**Entradas ya conocidas:**
- `POST /mediastream/preload` sale dos veces por ficha (Z3).
- `PATCH continuity` y `GET` cada 15 s durante la reproducción (Z3 M9).
- Suscriptores WS del reproductor (DT-06).
- `prewarm.ts`, `usePlayerHls.ts` (563 líneas), `usePlayerSkip.ts` (813) y `player-core.ts` (586).

**Criterios de aceptación:**
- [ ] Informe con hallazgos anclados a archivo y símbolo.
- [ ] Pedidos medidos durante una reproducción, con el PATCH bloqueado.
- [ ] Sin cambios de código.

**Archivos probables:** `docs/auditoria/Z1-reproductor.md` (nuevo).

---

## Checkpoint P: reproductor
- [ ] Revisión humana del informe Z1 antes de tocar `components/video/`
- [ ] Cualquier cambio de reproductor va en un plan aparte
