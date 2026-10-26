# Auditoría Z4: código muerto y bundle (`apps/web`)

- **Commit de lectura:** `a249c13` (rama `version-2.0`), con el árbol de trabajo **sucio**: muchos archivos de `apps/web` tienen cambios ajenos sin commitear (por ejemplo `package.json`, `src/main.tsx`, `tailwind.config.ts` y `src/routes/movies/index.lazy.tsx`). Los números de línea son del árbol de trabajo del 2026-10-16 y solo sirven de referencia. Hay que anclarse por archivo y símbolo.
- **Modo:** auditoría. Lo único que se creó en el repo es este archivo. Los builds de medición se hicieron con configs temporales que escribían en `scratch/` y después se borraron.
- **Fuera de alcance:** `src/api/generated/` y `src/routeTree.gen.ts`, que se excluyeron como pide el prompt.

**Resumen.** El código fuente está bastante limpio después de las fases de depuración 7 a 10:

- ningún archivo de `src/` queda inalcanzable en runtime;
- todos los assets de `public/` tienen referencia;
- todas las clases CSS propias se usan;
- solo hay un export sin ningún uso.

Las ganancias reales están en la **configuración del build**:

- Un `forceSplitting` mete en el JS inicial código de rutas lazy.
- Un chunk de `react-scan` de 466 KB se emite en producción y el service worker lo precachea.
- Hay un provider y una dependencia sin consumidores.
- Hay 267 variables CSS que nadie lee.

---

## 1. Hallazgos

| ID | Sev. | Conf. | Archivo › símbolo | Tipo | Problema | Riesgo |
|----|------|-------|-------------------|------|----------|--------|
| DC-01 | MEDIA | ALTA (medido A/B) | `rsbuild.config.ts` › `performance.chunkSplit.forceSplitting["ui-primitives"]` (l. 160) | bundle | La regex `(@radix-ui\|vaul\|cmdk)` junta en un solo chunk forzado a `vaul`/`@radix-ui/react-dialog` (los usa el shell: `vaul` lo importa `components/vaul/index.tsx`, y `react-dialog` llega por la dependencia de `vaul`) con `cmdk` (solo `CommandPalette`, que es lazy), `@radix-ui/react-select` (solo `routes/settings/components.tsx`), `react-scroll-area` (`directory-selector`, lazy) y `react-popover`/`popper` (cronología y el hero de `/movies`). Como el shell necesita el chunk, entra entero al entrypoint y **cmdk se carga de entrada**. Medido con la configuración B (que además quita `lucide` de `forceSplitting`, `rsbuild.config.ts` L155): el JS inicial baja de **900,7 a 848,6 KB min** (−52,1 KB) y de **276,5 a 262,0 KB gzip**. `lucide` explica unos −3,4 KB, así que la regex sola debería dar unos **−48,7 KB min (≈ −5,4 %)**; su gzip no está separado. `ui-primitives` pasa de 103,8 a 55,1 KB (B). | MEDIO |
| DC-02 | MEDIA | ALTA (medido) | `src/main.tsx` › `shouldEnableScan` + `import("react-scan")` (l. 67-79) | bundle / SW | La guarda `import.meta.env.DEV` está dentro de una `const`, así que Rspack no puede descartar el `import()` al parsear. Por eso **emite en producción** `vendors-node_modules_react-scan_dist_index_js.*.js`: **≈460–466 KB** (≈126–127 KB gzip; react-scan, react-grab y preact). Ese archivo nunca se ejecuta, pero **`sw.js` lo precachea** (91 entradas, es la segunda más pesada: 455 KiB). Un mini-build con el mismo patrón dentro de `if (import.meta.env.DEV) { … }` no emite el chunk (482 KB contra 0, medido en la sesión de auditoría; `scratch/` ya no existe para reproducirlo). | BAJO |
| DC-03 | BAJA | ALTA (medido) | `src/app/client-providers.tsx` › `ClientProviders` (`<CookiesProvider>`, l. 12 y 58-69) + `package.json` › `react-cookie` | dep. muerta | `CookiesProvider` no tiene ningún consumidor: hay 0 usos de `useCookies`, `withCookies`, `Cookies` o `document.cookie`. Igual mete react-cookie y universal-cookie en el chunk inicial (37,6 KB antes de minificar). Medido con un stub por alias: **−9,4 KB min y −2,9 KB gzip** de JS inicial. | BAJO |
| DC-04 | BAJA | ALTA | `package.json` › `@tauri-apps/plugin-updater` (l. 38) | dep. muerta | Hay 0 imports en `apps/web` (en `src`, los configs, `index.html` y `scripts`). No llega al bundle, pero se instala y figura en el lockfile. *Nota:* `apps/desktop/src-tauri/Cargo.toml` todavía declara `tauri-plugin-updater`, y otra sesión borró `updater.rs` sin commitear. Lo del lado Rust queda fuera de esta zona. | BAJO |
| DC-05 | BAJA | ALTA (medido) | `tailwind.config.ts` › `addVariablesForColors` (l. 449 y 458-472) | CSS muerto | El plugin declara en `:root` una custom property por cada color de la paleta: **267 variables** (`--slate-50`, …, `--brand-50`…`--brand-950`, `--ui-*`, `--audienceScore-*`). Ninguna se lee con `var()` en el CSS emitido ni aparece en el código; el único "uso" aparente, `--brand`, era un falso positivo de `var(--brand-accent…)`. Sacarlas ahorra **5,3 KB min y 2,0 KB gzip** de `index.css` (309,4 KB). Es el snippet de la plantilla inicial (`fc57ad7`). | BAJO |
| DC-06 | BAJA | ALTA (medido) | `rsbuild.pwa.ts` › `getPwaPlugin` (`exclude`, l. 10-17; `maximumFileSizeToCacheInBytes`, l. 9) | SW | El precache incluye **6 `.woff` heredados** de `@fontsource/space-mono` (60,7 KB). Chromium y WebView2 siempre eligen el `woff2`, que figura primero en `src`, así que esos archivos nunca se piden y solo se bajan al instalar el SW. Además, el comentario del límite de 15 MB ("backdrops y sagas en precache") es falso: `public/` no entra al precache, que es solo `static/**`, `index.html` y `workbox`, y lo más pesado es `hls` con 564 KiB. | BAJO |
| DC-07 | BAJA | ALTA | `src/api/hooks/scan.hooks.ts` › `scanQueryKeys` (l. 8) | export muerto | Es el único export sin ningún uso, ni siquiera dentro de su propio archivo. Las query keys de scan se arman inline con `API_ENDPOINTS.SCAN.*.key`. **Coordinar con Z3**, que audita las query keys. | BAJO |
| DC-08 | BAJA | ALTA | Varios › exports usados solo dentro de su archivo (ver la lista del paso 1.3) | export superfluo | Son 11 símbolos con `export` y 0 importadores, que sí se usan localmente. Hay que quitar `export`, no borrarlos. Incluye `MovieEntry`, **duplicado** de forma idéntica en `routes/movies/index.lazy.tsx` (l. 34) y `routes/movies/index.tsx` (l. 12): los importadores (`movies-grid`, `movies-hero`, `movies-rows`) usan el de `../index`. Dos de los exports están en archivos de ruta (`routes/settings/index.tsx`, `routes/movies/index.lazy.tsx`). | BAJO |

**CONSERVAR** (se revisaron y no son código muerto):

- **Exports que solo usan los tests:** unos 70 símbolos, entre ellos los helpers de `hero-backdrop.tsx`, `shared-element.ts`, `scroll-reveal.ts`, `nav-compact.ts`, `track-selection.ts` y `aniskip.hooks.ts`. Todos se usan dentro de su archivo y se exportan para probarlos. Lo mismo vale para `__resetMotionFeaturesForTests`, y para `ENTER_STAGGER_TOTAL_MS` (`enter-stagger.ts`) y `TIMELINE_ORDERS` (`releaseOrder.ts`): son constantes que el código no lee, pero los tests las usan como guardianes de presupuesto y contrato.
- **`components/ui/swimlane.tsx`:** solo exporta tipos y se importa siempre con `import type`. El archivo es correcto; únicamente la extensión `.tsx` sobra.
- **Chunk forzado `lucide`:** el A/B muestra que casi todos los íconos ya los usa el shell. Sin forzarlo, el JS inicial se achica unos 3,4 KB y se pierde un chunk estable para caché, así que no conviene.
- **`zod` en el inicial (57,8 KB min):** lo arrastra `api/client/schemas.ts`, que valida DTO críticos (continuidad y `MediaContainer`) en hooks del shell. Moverlo exige rediseñar; se deja como observación sin medir su costo de evaluación.
- **Core de framer-motion y `motion-dom` en el inicial:** ya hay una decisión previa (`LazyMotion strict` + `motion-features`), y se verificó que nada importa `motion` en lugar de `m`.
- **`API_ENDPOINTS` (31,7 KB en `index`):** es código generado y queda fuera de alcance; cualquier cambio va por el codegen.
- **Dependencias:** se revisaron las 73 entradas de `package.json`. Además de las de DC-03 y DC-04, todas tienen consumidor en `src` o en la config:
  - `env-cmd` (script `dev`);
  - `esbuild` (`rsbuild.jassub.ts`);
  - `@vitest/coverage-v8` (`test:coverage`);
  - `react-scan` (dev);
  - `@types/*` y `postcss` (implícitas).
- **Assets de `public/`:** los 91 archivos, sin contar `jassub/`, se referencian por nombre exacto. La única excepción es `icons/series-icons/SOURCES.md`, que es documentación. `public/intro/` está vacía y git no la versiona.
- **CSS propio:** las 133 clases que no son de Tailwind, en `src/**/*.css`, aparecen en el código. No hay keyframes huérfanos.
- **Barrels:** `components/ui/icons/index.ts`, `lib/stores/index.ts` y `components/ui/kinetics/index.tsx` no rompen el tree-shaking (`"sideEffects": ["*.css"]`). Los módulos de config del inicial (`hero-art.ts`, `eras.ts`, `series_soundtracks.ts`, `goku-panorama.ts`, `timelineSearch.ts`) llegan por cadenas legítimas del shell: `floating-pill-nav`, `use-global-search` y `eras.ts`.

**PROBABLE** (no se borra; queda como paso de verificación):

- `src/main.tsx` › `import.meta.env.VITE_SCAN`. `loadEnv` solo inyecta `KAMEHOUSE_PUBLIC_*`, así que `VITE_SCAN` sería siempre `undefined` y solo funcionaría el interruptor por `localStorage`. Es un resto de la época de Vite. Ver el paso 1.4.

### Mediciones y método

- **Build de medición.** Se hizo un build de producción (`NODE_ENV=production`, con React Compiler, compresión de imágenes y PWA activos) usando una config temporal que importaba `rsbuild.config.ts` y solo cambiaba esto:
  - `output.distPath.root` → `scratch/z4-bundle/out`;
  - `optimization.chunkIds: "named"`, en todas las variantes;
  - un plugin que volcaba `stats.toJson()` a `scratch/`.

  En la primera corrida se había usado también `moduleIds: "named"`, que infla los tamaños. Se descartó y se repitió con la misma config para A, B y C.
- **A (base):** 9 scripts iniciales, **900,7 KB min / 276,5 KB gzip** de JS inicial. `index.css` pesa 309,4 KB (44,7 KB gzip). En total el build emite 4.659 KB (1.638,7 KB gzip, según Rsbuild). El precache tiene 91 entradas y 4,54 MB.
- **B (DC-01):** se cambió la regex de `ui-primitives` para excluir `react-select`, `react-scroll-area`, `react-popover`, `react-popper` y `number`, y se quitó `cmdk`. También se sacó `lucide` de `forceSplitting`. El JS inicial queda en 8 scripts y **848,6 KB min / 262,0 KB gzip**. `cmdk` termina en un chunk async junto con `thinking-orbs` (los dos son de `CommandPalette`); `react-select` y `react-scroll-area` quedan en chunks async propios. Al sacar `lucide`, sus 35,0 KB pasaron al chunk de vendors (+31,4 KB): el efecto de `lucide` es de unos −3,4 KB y el resto corresponde a `ui-primitives`.
- **C (DC-03):** se aliasó `react-cookie` a un stub `CookiesProvider = ({children}) => children`. Resultado: **891,3 KB min / 273,6 KB gzip**.
- **DC-02:** se hizo un mini-proyecto en `scratch/` con dos entradas y la config de alias de `react-scan` de la base. El patrón actual (`a.js`) emitió `async/474.js` de 482.444 B. El patrón con `if (import.meta.env.DEV) { … }` (`b.js`) no emitió ningún chunk async.
- **DC-05:** se quitaron del `index.css` emitido las 266 declaraciones sin uso y se comparó (309.408 → 304.105 B; 44.713 → 42.721 B gzip). El chequeo de uso cubrió `var(--x)` en el CSS emitido y el texto de `src/**/*.{ts,tsx,css}`, sin `generated`. También se buscaron construcciones dinámicas como `` `--${…}` `` y `getPropertyValue`: el único caso, `apply-custom-theme.ts`, usa nombres literales que no son de la paleta.
- **Exports sin uso.** Se escribió un script con la API de TypeScript (sin dependencias nuevas) que recorre:
  - los imports nombrados, default y namespace, resueltos por alias;
  - los reexports;
  - el acceso a propiedades, incluido `import("x").then(m => m.Foo)`;
  - la desestructuración de `await import()`;
  - los `import type`.

  Como respaldo se buscó también la palabra completa en el resto de `src`. Salieron 87 candidatos y se clasificaron a mano. La evidencia de cada uno es `grep -rlw <Símbolo> src --include=*.ts --include=*.tsx`, que devuelve solo el archivo que lo define.
- **Alcanzabilidad.** Se recorrió el grafo desde `main.tsx`, `sw.ts` y `routeTree.gen.ts`, con imports estáticos y dinámicos y `@import`/`url()` de CSS: 409 archivos alcanzables en runtime. Los 6 no alcanzables son 5 archivos que solo se importan como tipos más `button-recipes.baseline.json`, que es del test guardián.
- **Costo de generar el bundle.** Cada build tarda unos 2 minutos con otras sesiones activas. Los tamaños son conteos de bytes, así que no les afecta la carga de la máquina.

### Pendiente de medir

- **Costo real en tiempo de DC-01 y DC-03:** el tiempo de parseo y evaluación del JS inicial en Chrome headless, con el build servido por `rsbuild preview`. Solo se midieron bytes. En Tauri el JS se sirve en local, así que la ganancia está en parsear y compilar, no en la red.
- **Si el SW se registra dentro de Tauri** (`http://tauri.localhost`). Si no se registra, DC-02 y DC-06 solo afectan a los clientes por LAN (celular). `PwaRegistry` no distingue Tauri, solo `DEV`.
- **El costo de `zod` en el arranque** (ver CONSERVAR).

### Dependencias entre pasos

- 1.1 y 1.2 tocan `package.json` y `pnpm-lock.yaml`. Los dos tienen cambios ajenos sin commitear (otra sesión quitó `@radix-ui/react-checkbox`, `@radix-ui/react-radio-group`, `@radix-ui/react-switch` y `@total-typescript/ts-reset`), así que hay que hacerlos juntos y después de revisar `git diff`.
- 2.1 (DC-02) toca `src/main.tsx`, que también tiene cambios ajenos (`preloadMainSections`).
- 2.2 (DC-01) y 2.3 (DC-06) cambian el build: hay que medirlos juntos con el mismo método que la línea base.
- 1.3 (DC-07) toca query keys: conviene esperar el plan de Z3 (`docs/auditoria/Z3-*.md`) por si propone centralizarlas.

### Alcance leído

- **Leídos completos:**
  - `docs/prompts/auditoria-frontend.md`;
  - `apps/web/package.json`, `rsbuild.config.ts`, `rsbuild.pwa.ts` y `tsr.config.json`;
  - `src/app/client-providers.tsx`;
  - `src/lib/motion-features.ts` (cabecera);
  - `src/api/client/schemas.ts` (primeras 40 líneas de 51).
- **Leídos por partes:**
  - `src/main.tsx` (l. 1-120 y diff);
  - `tailwind.config.ts` (l. 1-40 y 440-472);
  - `src/components/pwa-registry.tsx` (l. 20-118);
  - `src/sw.ts` (cabecera);
  - `scripts/check-tokens.mjs` (grep);
  - `src/styles/tokens/animation.css` (l. 105-150);
  - `src/api/hooks/scan.hooks.ts` (l. 1-30).
- **Recorridos con herramientas, sin lectura humana:** todo `src/` (salvo los excluidos) con el script de exports y el grafo de imports, `public/` con búsquedas por nombre de archivo y los stats completos del build. Ningún componente se auditó línea por línea: esta zona no lo pide.

---

## 2. Plan

### Fase 1: código muerto

#### Paso 1.1 (riesgo BAJO): quitar `CookiesProvider` y `react-cookie` (DC-03)

- **Evidencia de cero consumidores:**
  - `grep -rn "useCookies\|withCookies\|Cookies\b\|document.cookie" apps/web/src | grep -v generated` → solo `client-providers.tsx` (el import y el JSX del provider).
  - `grep -rn "react-cookie" apps/web/src` → 1 archivo.
- **Acción:**
  1. En `src/app/client-providers.tsx`, borrar `import { CookiesProvider } from "react-cookie"` y el par `<CookiesProvider>` / `</CookiesProvider>`, sin tocar los hijos (`PersistQueryClientProvider`, etc.).
  2. Sacar `"react-cookie": "^8.0.1"` de `package.json`.
  3. Correr `pnpm install`, que actualiza `pnpm-lock.yaml` (lo comparten otras sesiones).
- **Validación:**
  - `pnpm --filter kamehouse-web typecheck`, `lint` y `test:run`;
  - build de medición (sección 3): el JS inicial baja unos 9,4 KB min respecto de la línea base del mismo día;
  - `grep -c "universal-cookie" <out>/static/js/*.js` → 0.

#### Paso 1.2 (riesgo BAJO): quitar `@tauri-apps/plugin-updater` (DC-04)

- **Evidencia:**
  - `grep -rlE "plugin-updater" apps/web/src apps/web/*.ts apps/web/index.html apps/web/scripts` → nada;
  - `grep -rn "updater" apps/web/src` → nada.
- **Acción:** sacar la línea de `package.json` y correr `pnpm install`. Conviene hacerlo en la misma instalación que 1.1. No tocar `apps/desktop`, que queda fuera de la zona. Se puede avisar a quien lleve el desktop que `Cargo.toml` todavía declara `tauri-plugin-updater` aunque `updater.rs` ya no existe en el árbol.
- **Validación:** `typecheck` y `build`.

#### Paso 1.3 (riesgo BAJO): exports sin uso (DC-07 y DC-08)

Para todos, la evidencia es `grep -rlw <Símbolo> apps/web/src --include=*.ts --include=*.tsx`, que devuelve solo el archivo que lo define (la excepción `WATCHED_THRESHOLD` se explica abajo).

| Símbolo | Archivo | Acción |
|---|---|---|
| `scanQueryKeys` | `src/api/hooks/scan.hooks.ts` | **Borrar** la constante (l. 8-11). No tiene ningún uso. *En espera del plan de Z3.* |
| `SpineLayout`, `LAYOUT_DEFAULT` | `src/lib/helpers/goku-panorama.ts` | Quitar `export`. |
| `SettingsSearchParams` | `src/routes/settings/index.tsx` | Quitar `export`. Además, el archivo de ruta queda exportando solo `Route` y el `export type` reexportado. |
| `MissingSources` | `src/routes/series/$seriesId/-hooks/missing-sources.ts` | Quitar `export`. |
| `SeriesAudioSummary` | `src/routes/series/$seriesId/-components/series-audio-summary.ts` | Quitar `export`. |
| `WATCHED_THRESHOLD`, `NumberedTarget` | `src/routes/series/$seriesId/-hooks/series-playback.helpers.ts` | Quitar `export`. La aparición en `use-series-data.ts:157` es un comentario. |
| `AUDIO_PROFILE_LABELS`, `AudioProfileOption` | `src/routes/series/$seriesId/-components/series-audio-profile.ts` | Quitar `export`. |
| `SeriesContinueWatchingProps` | `src/routes/series/$seriesId/-components/series-continue-watching.tsx` | Quitar `export`. |
| `MovieEntry` (duplicado) | `src/routes/movies/index.lazy.tsx` l. 34 | Borrar la declaración y sumar `MovieEntry` al import de tipos que ya existe: `import type { MoviesSearch, MovieEntry } from "./index"`. Es `import type` y no rompe el split de la ruta. |

- **Validación:** `pnpm --filter kamehouse-web typecheck` (con `noUnusedLocals` activo, avisa si algo quedó sin usar), `lint` y `test:run`.

#### Paso 1.4 (verificación, sin borrar nada): `VITE_SCAN` (PROBABLE)

- **Qué hay que comprobar:** en `pnpm --filter kamehouse-web dev` con `VITE_SCAN=true` en `.env.web`, ver si `import.meta.env.VITE_SCAN` vale `"true"`. Se puede mirar con un `console.log` temporal que después se revierte, o desde las DevTools: React Scan aparece o no aparece.
- **Si no vale `"true"`:** proponer, en un paso aparte, borrar esa rama y actualizar el comentario de la l. 67 para que diga que el interruptor es solo por `localStorage`.
- **Si vale `"true"`:** CONSERVAR.

#### Paso opcional 1.5 (separado): `knip` como herramienta de mantenimiento

- **Justificación:** este análisis se hizo con scripts descartables. `knip` (devDependency) automatiza exports, archivos y dependencias sin uso, entiende TanStack Router y Vitest, y permite que esta auditoría se repita en CI.
- **Costo:** una devDependency y un `knip.json` con `ignore` para `src/api/generated/**` y `src/routeTree.gen.ts`, más `entry` para `src/main.tsx`, `src/sw.ts` y `src/routes/**`.
- Solo con aprobación del usuario. No es requisito de ningún otro paso.

### Fase 2: rendimiento (bundle y service worker)

#### Paso 2.1 (riesgo BAJO, formato completo porque cambia lo que se emite): que `react-scan` no se emita en producción (DC-02)

**A. Problema.** `shouldEnableScan` encierra `import.meta.env.DEV` en una `const`. Rspack no evalúa esa condición al armar el grafo, así que crea el chunk async de `react-scan`, react-grab y preact (≈460–466 KB) y Workbox lo agrega al precache.

**B. Evidencia.** Build A: existe `static/js/async/vendors-node_modules_react-scan_dist_index_js.*.js` de ≈460–466 KB y está en `sw.js` (`precacheAndRoute`). El mini-build de `scratch/` emitió 482.444 B con el patrón actual y 0 con el propuesto (medido en la sesión; `scratch/` ya no existe).

**C. Código ANTES** (`src/main.tsx`, l. 67-79):

```ts
// React Scan para profiling visual (activable con VITE_SCAN=true o localStorage.setItem("kamehouse:scan", "true"))
const shouldEnableScan = typeof window !== "undefined" && import.meta.env.DEV && (
    import.meta.env.VITE_SCAN === "true" ||
    window.localStorage?.getItem("kamehouse:scan") === "true"
)
if (shouldEnableScan) {
    import("react-scan").then(({ scan }) => {
        scan({
            enabled: true,
            log: false,
        })
    }).catch(() => {})
}
```

**D. Código DESPUÉS** (no cambian imports; el comportamiento en dev es el mismo):

```ts
// React Scan para profiling visual (activable con VITE_SCAN=true o localStorage.setItem("kamehouse:scan", "true")).
// La guarda va literal en el `if`: así Rspack descarta el import() en producción y no emite
// (ni precachea en el service worker) el chunk de react-scan.
if (import.meta.env.DEV) {
    const shouldEnableScan = typeof window !== "undefined" && (
        import.meta.env.VITE_SCAN === "true" ||
        window.localStorage?.getItem("kamehouse:scan") === "true"
    )
    if (shouldEnableScan) {
        import("react-scan").then(({ scan }) => {
            scan({
                enabled: true,
                log: false,
            })
        }).catch(() => {})
    }
}
```

**E. Cambios secundarios.** Ninguno: `shouldEnableScan` no se usa en otro lado. Si el paso 1.4 confirma que `VITE_SCAN` es una rama muerta, se limpia en ese paso, no en este.

**F. Justificación y costo.** Se ahorran 466 KB emitidos y 455 KiB que el SW baja y guarda en cada instalación o actualización. El costo es reacomodar 13 líneas.

**G. Validación.**

1. Build de medición (sección 3): `ls <out>/static/js/async | grep -c react-scan` → 0, y la medición de precache muestra `react-scan: false` con 90 entradas en lugar de 91.
2. En dev (`pnpm --filter kamehouse-web dev`, puerto 43210, **nunca 43211**), con `localStorage.setItem("kamehouse:scan","true")` y recarga, React Scan aparece igual que antes.

**H. Criterio de aceptación.** No hay chunk de react-scan en la salida de producción ni en `sw.js`, y React Scan sigue funcionando en dev.

**I. Reversión.** Restaurar `src/main.tsx` solo en ese bloque. El archivo tiene otros cambios ajenos (`preloadMainSections`): **no** usar `git checkout` del archivo entero.

#### Paso 2.2 (riesgo MEDIO): sacar del chunk inicial lo que solo usan las rutas lazy (DC-01)

**A. Problema.** `forceSplitting["ui-primitives"]` agrupa todos los `@radix-ui`, `vaul` y `cmdk`. Como `vaul` y `dialog` los usa el shell, el chunk entero entra al entrypoint y arrastra `cmdk` (solo `CommandPalette`, montada al primer uso), `react-select` (Ajustes), `react-scroll-area` (`directory-selector`) y `react-popover`/`popper` (cronología y ficha).

**B. Evidencia** (A/B en la misma corrida, conteo de bytes):

| | JS inicial min | JS inicial gzip | `ui-primitives` | Scripts iniciales |
|---|---|---|---|---|
| A (actual) | 900,7 KB | 276,5 KB | 103,8 KB | 9 |
| B (regex nueva, sin `lucide`) | 848,6 KB | 262,0 KB | 55,1 KB | 8 |

`lucide` explica unos −3,4 KB; el resto es `ui-primitives`. Por eso se propone **cambiar solo la regex y mantener `lucide`**, para conservar su chunk estable de caché. La cifra esperada es de alrededor de −48 KB min y −14 KB gzip, y se confirma en G.

**C. Código ANTES** (`rsbuild.config.ts`, l. 158-160):

```ts
                // framer-motion NO se fuerza a un chunk inicial: sus funciones
                // (domMax) se cargan aparte vía import() (lib/motion-features.ts).
                "ui-primitives": /[\\/]node_modules[\\/](@radix-ui|vaul|cmdk)[\\/]/,
```

**D. Código DESPUÉS** (sin imports nuevos):

```ts
                // framer-motion NO se fuerza a un chunk inicial: sus funciones
                // (domMax) se cargan aparte vía import() (lib/motion-features.ts).
                // Solo las primitivas que usa el shell (vaul, dialog y sus internas). select,
                // scroll-area, popover/popper y cmdk se usan solo en rutas o modales lazy:
                // forzarlas acá las metía en el JS inicial (medido: ~48 KB min de más).
                "ui-primitives": /[\\/]node_modules[\\/](?:@radix-ui[\\/](?!react-select|react-scroll-area|react-popover|react-popper|number)|vaul[\\/])/,
```

**E. Cambios secundarios.** Ninguno en el código: los chunks async nuevos los arma el `splitChunks` por defecto. En B, `cmdk` quedó junto con `thinking-orbs` (los dos son de `CommandPalette`). Si mañana el shell empieza a usar `Popover` o `Select`, Rspack los vuelve a poner en el inicial sin romper nada.

**F. Justificación y costo.** Son unos 48 KB menos de JS que parsear y compilar en cada arranque, en Tauri, por LAN y en TV, y se mantiene diferido lo que ya se diseñó como diferido (`CommandPalette`). El costo es una regex más compleja, con el comentario que la explica.

**G. Validación.**

1. **Medición.** Corrida A con la config actual y B con el cambio, en el mismo momento, usando el comando de la sección 3. Esperado: el JS inicial de B queda unos 48 KB min por debajo de A y `cmdk` ya no está en ningún script de `index.html`, lo que se comprueba con `grep -l "cmdk-" <out>/static/js/*.js`, que solo debe listar archivos de `async/`.
2. **Interacción** sobre el build servido con `rsbuild preview` en un puerto libre que **no sea el 43211**, con el PATCH de continuidad bloqueado en un proxy (sección 4.1):
   - abrir la paleta con el atajo del buscador: carga y filtra;
   - en Ajustes, abrir cada `Select` y elegir con flechas (D-pad);
   - abrir un `Popover` en Cronología y otro en la ficha;
   - abrir el selector de carpetas (`directory-selector`) y hacer scroll;
   - en la consola, 0 errores de `ChunkLoadError`.
3. `pnpm --filter kamehouse-web test:run`.

**H. Criterio de aceptación.** El JS inicial baja al menos 40 KB min respecto de A en la misma corrida, no cambia nada visible, y la paleta, los selects, los popovers y el selector de carpetas funcionan con mouse y con teclado.

**I. Reversión.** Restaurar esa línea de `rsbuild.config.ts`. El archivo hoy no tiene cambios ajenos, pero igual hay que mirar `git diff -- apps/web/rsbuild.config.ts` antes.

#### Paso 2.3 (riesgo BAJO): no precachear los `.woff` heredados y corregir el comentario (DC-06)

- **Evidencia:** el precache de A tiene 6 `.woff` (`space-mono-*`), con un total de 60.680 B. Los `@font-face` de fontsource listan primero `woff2`, que Chromium y WebView2 soportan.
- **Acción** en `rsbuild.pwa.ts`:
  - agregar `/\.woff$/` al array `exclude`. No usar `/\.woff2?$/`: los `woff2` sí se usan;
  - cambiar el comentario de `maximumFileSizeToCacheInBytes` por uno verdadero, por ejemplo "límite holgado; el asset precacheado más grande es hls (~0,6 MB). `public/` no entra al precache".
  - El valor numérico no se toca en este paso.
- **Validación:** build de medición → `.woff: 0` y 85 entradas de precache (con 2.1 aplicado, 84). Las fuentes se siguen viendo: en el build servido, `document.fonts.check("700 16px 'Space Mono'")` da `true` después de cargar Ajustes, que usa Space Mono.

### Fase 3: calidad (CSS y config)

#### Paso 3.1 (riesgo BAJO): quitar `addVariablesForColors` (DC-05)

- **Evidencia:**
  - de las 267 custom properties que declara en `:root`, 0 se leen con `var()` en `index.css` y 0 aparecen en `src/**/*.{ts,tsx,css}`;
  - no hay nombres armados de forma dinámica: el único `getPropertyValue`/`setProperty` (`lib/theme/apply-custom-theme.ts`) usa literales como `--brand-accent` y `--bg-primary`, que se definen en `colors.css`.
- **Acción** en `tailwind.config.ts`:
  - borrar `addVariablesForColors,` del array `plugins`;
  - borrar la función `addVariablesForColors`;
  - borrar `import flattenColorPalette from "tailwindcss/lib/util/flattenColorPalette"`, que queda sin uso.

  ⚠ `tailwind.config.ts` tiene cambios ajenos sin commitear: aplicar con el editor, no reemplazar el archivo, y revisar `git diff` antes.
- **Validación:**
  - `pnpm --filter kamehouse-web lint:tokens`: tiene que seguir mostrando solo la falla previa de `--ease-out-strong` y nada nuevo;
  - `typecheck` y `test:run`, incluidos los guardianes de botones;
  - build de medición: `index.css` baja unos 5,3 KB min, y `grep -c -- "--slate-50:" <out>/static/css/index.*.css` → 0.
  - Una pasada visual por Inicio, Series, la ficha, Películas, Cronología y Ajustes no debería mostrar cambios.

---

## 3. Verificación

**Estado inicial**, corrido el 2026-10-16 sobre `a249c13` con el árbol sucio y antes de cualquier cambio. Desde la raíz del repo:

```bash
pnpm --filter kamehouse-web typecheck
```

→ sale con código 0.

```bash
pnpm --filter kamehouse-web lint
```

→ sale con código 0, sin errores.

```bash
pnpm --filter kamehouse-web lint:tokens
```

→ **ya falla, y no por este plan:** `✖ 1 variable(s) CSS usadas sin definir: --ease-out-strong  src/routes/series/-series-shelf.css`. El archivo es nuevo y no está versionado (`??`), lo agregó otra sesión. Además, la clase `ease-out-strong` se usa en `components/chronology/*` (zona Z2).

```bash
pnpm --filter kamehouse-web test:run
```

→ **119 archivos y 1005 tests, todos pasan.**

**Build de medición.** No usar `pnpm build`, porque limpia `out/`. Hay que crear una config temporal, por ejemplo `apps/web/rsbuild.z4-stats.config.ts`, que importe la base y cambie la salida:

```ts
// TEMPORAL: build de medición fuera de out/. Borrar al terminar.
import { defineConfig, mergeRsbuildConfig } from "@rsbuild/core"
import path from "node:path"
import base from "./rsbuild.config"

export default defineConfig(mergeRsbuildConfig(base as any, {
    output: { distPath: { root: path.resolve(__dirname, "../../scratch/z4-bundle/out") } },
    tools: { rspack: (cfg: any) => { cfg.optimization = { ...(cfg.optimization || {}), chunkIds: "named" }; return cfg } },
}))
```

En Git Bash, desde `apps/web`. Los binarios están hoisteados en la raíz (`node-linker=hoisted`):

```bash
export MSYS_NO_PATHCONV=1 && NODE_ENV=production ../../node_modules/.bin/rsbuild build -c rsbuild.z4-stats.config.ts
```

Tarda unos 2 minutos y escribe `public/sw-custom.js`, que git ignora.

**Medición del JS inicial, el precache y el CSS**, desde la raíz del repo, pasando la carpeta de salida:

```bash
node -e "const fs=require('fs'),z=require('zlib'),d=process.argv[1];const h=fs.readFileSync(d+'/index.html','utf8');const js=[...h.matchAll(/<script[^>]+src=\"\/?([^\"]+\.js)\"/g)].map(m=>m[1]);let r=0,g=0;for(const f of js){const b=fs.readFileSync(d+'/'+f);r+=b.length;g+=z.gzipSync(b,{level:9}).length}const sw=fs.readFileSync(d+'/sw.js','utf8');const pre=(sw.match(/url:\"[^\"]+\"/g)||[]);const css=fs.readdirSync(d+'/static/css').filter(f=>/^index\..*\.css$/.test(f)).map(f=>fs.statSync(d+'/static/css/'+f).size);console.log('scripts iniciales',js.length,'| JS inicial',(r/1024).toFixed(1)+'KB min',(g/1024).toFixed(1)+'KB gz','| precache',pre.length,'entradas, react-scan:',pre.some(u=>/react-scan/.test(u)),'| .woff:',pre.filter(u=>/\.woff\"/.test(u)).length,'| index.css',css.join(','))" scratch/z4-bundle/out
```

Línea base que dio:

```text
scripts iniciales 9 | JS inicial 900.7KB min 276.5KB gz | precache 91 entradas, react-scan: true | .woff: 6 | index.css 309408
```

Para el A/B de 2.2, repetir con una segunda config que cambie solo la regex y otra carpeta de salida (por ejemplo `scratch/z4-bundleB/out`), en la misma sesión de medición.

**Limpieza:** borrar la config temporal (`apps/web/rsbuild.z4-*.config.ts`) y `scratch/z4-bundle*`. Si se sirvió el build con `rsbuild preview`, matar ese proceso por puerto o PID, nunca por patrón de línea de comandos.
