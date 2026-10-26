# Auditoría Z5 — Calidad, tipos y accesibilidad (`apps/web/src`)

- **Commit de lectura:** `a249c13` (rama `version-2.0`, checkout compartido con muchos cambios ajenos sin commitear). Las líneas son referencia; el ancla es archivo + símbolo.
- **Ojo:** las líneas y los bloques ANTES son del **árbol de trabajo** del 2026-10-16, no de `a249c13` puro. Varios archivos del plan ya tenían cambios ajenos sin commitear (por ejemplo `routes/settings/index.lazy.tsx`, `tabs/playback-tab.tsx` y `tabs/system-tab.tsx`). Antes de cada paso, comparar el bloque ANTES con el archivo actual (Prompt B, punto 4).
- **Fecha:** 2026-10-16.
- **Modo:** auditoría. Lo único creado en el repo es este archivo. Los temporales vivieron en `scratch/z5-calidad/` y se borraron.

## Resumen

El punto de partida es bueno: `lint` sin errores ni warnings, `typecheck` limpio, 1005 tests en verde, **0** `any`, **0** `@ts-ignore`/`@ts-expect-error`, **0** `!` (la regla `no-non-null-assertion` está activa y no reporta nada), todas las supresiones de ESLint justificadas y en uso, axe sin violaciones en 8 rutas y `prefers-reduced-motion` respetado. Por eso quedan pocos hallazgos, y casi todos son de **robustez del flujo de Ajustes** y de **foco en el buscador**:

- Si el GET de ajustes falla, Ajustes muestra valores de fábrica sin avisar (medido).
- Los sliders de volumen mandan un PATCH por paso y los errores se tragan (medido: 20 PATCH por arrastre).
- Al cerrar el buscador con Escape, el foco cae a `<body>` (medido).
- `lint:tokens` ya falla en el estado inicial por un token inexistente que anula transiciones (medido A/B).

---

## 1. Hallazgos

| ID | Sev. | Conf. | Archivo › símbolo | Tipo | Problema | Riesgo |
|----|------|-------|-------------------|------|----------|--------|
| QA-01 | MEDIA | ALTA | `routes/settings/index.lazy.tsx` › `SettingsPage` (L312-314, L509, L801) + `api/hooks/settings.hooks.ts` › `useGetSettings` (`muteError: true`, L34) | robustez | Si `GET /api/v1/settings` falla, la página renderiza el formulario completo con los **valores de respaldo de `getEffectiveSettings`** y ningún aviso. Algunos campos quedan sin valor y se muestran como falsos (p. ej. `themeEnableBlurringEffects`). Ocurre en carga en frío, solo si `GetStatus` responde OK. «Descartar» también escribe esos respaldos en los stores. El usuario ve "su" configuración cambiada (medido: la vista previa pasa de "con transparencia" a "transparencia reducida"). Solo se entera al pulsar Guardar (`onSubmit` corta con un toast). | BAJO |
| QA-02 | MEDIA | ALTA | `lib/server/persist-settings.ts` › `persistThemePatch`, `persistLibraryPatch` (L31-57); consumidores: `routes/settings/tabs/playback-tab.tsx` › `PlaybackTab` (Controllers `theme.uiSoundsVolume` L473 y `theme.bgMusicVolume` L543) | robustez / pedidos | `RangeSlider` llama a `onChange` en cada paso del `<input type="range">` y cada paso hace un `PATCH /api/v1/settings` sin agrupar. Medido: **20 PATCH** por arrastre completo y **1 PATCH por flecha** con teclado. Los pedidos concurrentes pueden aplicarse fuera de orden (plausible, no medido). Además, el error se traga con `.catch(() => {})` mientras la caché ya muestra el valor nuevo: si el servidor no guardó, el cambio se pierde al recargar la app o al volver a Ajustes pasados 5 min, y nadie avisó. Los sliders son campos del formulario: un «Guardar» posterior reenvía el valor. El propio repo ya trata este patrón como problema (`system-tab.tsx` › `flushTmdbKey`: "evita un PATCH por tecla"). | MEDIO |
| QA-03 | BAJA | ALTA | `routes/settings/index.lazy.tsx` › `SettingsPage` (`useForm`, L378-383; `handleSubmit`, L710) | tipos | `zodResolver(settingsSchema) as unknown as Resolver<…>` y `onSubmit as unknown as SubmitHandler<FieldValues>` existen porque el esquema tiene `.default()` (entrada ≠ salida). Con `@hookform/resolvers` 5 y RHF 7.71 se tipa sin casts: `useForm<SettingsFormInput, unknown, SettingsFormValues>`. **Verificado compilando** un modelo en scratch (resolver, `handleSubmit`, `Controller` y paso de `control` a un genérico `Control<T>`). | MEDIO |
| QA-04 | BAJA | ALTA | `lib/server/settings.ts` › `settingsSchema` (escrito a mano) frente a `api/generated/endpoint.types.ts` › `SaveSettings_Variables` | tipos / contrato | Hay 9 `as unknown as` entre el formulario y los tipos generados (`index.lazy.tsx` L379-380, L392, L406, L444, L710; `system-tab.tsx` › `handleConfirmReset` L186-187; `settings.hooks.ts` › `normalizeSettings` L23). Esconden cualquier deriva: si el codegen de Go renombra un campo, el formulario sigue enviando la clave vieja (`.passthrough()`), el servidor la ignora y `tsc` no dice nada. Hoy **no hay deriva de nombres** (verificado: todas las claves del esquema existen en el modelo, en las 6 secciones). Falta un guardián que lo mantenga así. | BAJO |
| QA-05 | MEDIA | ALTA | `components/ui/app-layout/expandable-search.tsx` › `ExpandableSearch` › `handleCollapse` (L79) / `handleEscape` (L93) / `handleKeyDown` (L189) | accesibilidad (foco) | Al cerrar con Escape, el `<input>` enfocado se desmonta; sin texto, la X también cierra y su botón enfocado se desmonta. En ambos casos el foco **cae a `<body>`** (medido con Escape). Con texto, la X limpia el campo y devuelve el foco al input. El usuario de teclado pierde su lugar en la barra flotante (WCAG 2.4.3). No afecta al Modo TV: ahí `FloatingPillNav` no se monta (`floating-pill-nav.tsx` L98). | BAJO |
| QA-06 | BAJA | MEDIA | `expandable-search.tsx` › `ExpandableSearch` (`<input>` L246, resultados L306-332) | accesibilidad (lector de pantalla) | ↑/↓ mueven una selección **solo visual** (`selectedIndex`) sin `role="combobox"`/`listbox`/`option` ni `aria-activedescendant`, así que el lector de pantalla no anuncia nada al moverse. El input solo tiene `placeholder` como nombre (axe lo acepta). La confianza es MEDIA porque no lo probé con un lector de pantalla real, solo por el DOM. | MEDIO |
| QA-07 | BAJA | ALTA | `routes/series/-series-shelf.css` (sin trackear; reglas `.series-shelf-progress > span` L41, `.series-shelf-character` L55, `.series-shelf-closed/.series-shelf-expanded` L73) | motion / tokens | Usa `var(--ease-out-strong)`, que no existe (el token es `--ease-out`; la utilidad Tailwind `ease-out-strong` apunta a `var(--ease-out)`). Una variable sin definir invalida la declaración `transition` completa. Medido: `transition-duration: 0s` en las tres clases, que vuelve a `0.25s` al definir el token. Es la causa de que `lint:tokens` falle en el estado inicial. **Archivo de trabajo en curso ajeno:** el paso queda en espera si sigue sin trackear o con cambios. | BAJO |
| QA-08 | BAJA | ALTA | `routes/series/$seriesId/-hooks/use-series-data.ts` › `useSeriesData` › `computedEpisodes` (L159-174) | tipos | El episodio sintético armado desde `localFiles` se fuerza con `as unknown as Anime_Episode`. Le faltan `localFile` y `fileMetadata` (requeridos) y lleva `episodeMetadata.episodeNumber`, que el tipo no tiene y nadie lee. Hoy no rompe porque `resolveLocalFileForEpisode` cae al buscador por número, pero el cast no deja que `tsc` lo vea. Verificado: el literal tipado compila sin cast. | BAJO |
| QA-09 | BAJA | ALTA | `apps/web/package.json` › script `lint` (L17) | mantenibilidad | El listón actual es 0 warnings, pero `eslint src/` no falla con warnings y no hay CI en el repo (`.github/workflows` no existe). Varias reglas de `jsx-a11y` y `@typescript-eslint/no-explicit-any` están en `warn`, así que una regresión de accesibilidad o un `any` nuevo pasarían sin cortar nada. | BAJO |
| QA-10 | BAJA | ALTA | `hooks/use-focus-trap.ts` › `useFocusTrap`; `hooks/use-tv-dpad.ts` › `useTvDpad` (`getActiveModalScope`) | tests | La infraestructura de foco que protege los diálogos propios y el D-pad no tiene tests (`grep` sin coincidencias en `*.test.*`). Sí los tiene `tv-spatial.ts`. Un test propuesto para `useFocusTrap` se validó en scratch y detecta la regresión de quitar la restauración de foco. | BAJO |

### Mediciones hechas (método)

Todas contra el dev server que ya corría en `127.0.0.1:43210` (node, PID 13816, de otra sesión; la API la sirve `kamehouse.exe` en 43212). Usé Chrome headless (`playwright-core` + `C:/Program Files/Google/Chrome/Application/chrome.exe`), viewport 1440×900. **Solo lectura:** todo pedido a `/api/**` que no fuera GET/HEAD/OPTIONS se abortó con `page.route`. No abrí el reproductor, así que la regla 4.1 (proxy para el PATCH de continuidad) no se activó: nada midió caché HTTP. El puerto 43211 no se usó. No medí tiempos: son conteos y lecturas de DOM, que la carga de otras sesiones no afecta. Los scripts están en el Apéndice.

| Medición | Resultado |
|---|---|
| axe-core (`axe.run`, solo violaciones) en `/home`, `/series`, `/movies`, `/chronology`, `/settings`, `/series/12609`, `/series/236994`, `/movies/1039322`, esperando 6-8 s | **0 violaciones** en las 8 rutas (489 a 2937 nodos). axe con el buscador abierto y la consulta "goku": 0. |
| QA-01: `/settings` con `GET /api/v1/settings` forzado a 500 | 3 GET en total (varios disparos de fetch, no reintentos). Después, formulario completo (7 controles), 0 `role="alert"` relacionados, sin texto de error. Vista previa: "Neutro · transparencia reducida" contra "Neutro · con transparencia" con el GET real. |
| QA-02: slider "Volumen de la música de fondo" (`/settings?tab=playback`) | 10 × ←: **5 PATCH** (llegó a 0 tras 5 pasos). Arrastre completo con el mouse: **20 PATCH** `{"theme":{"bgMusicVolume":…}}`, todos abortados (nada llegó a la base). |
| QA-05: foco con teclado | "Mi Lista": abre con foco adentro, 15 Tab sin escapar del diálogo, Escape devuelve el foco al disparador ✔. Ctrl+K: Escape devuelve el foco a donde estaba ✔. "Buscar": Enter → foco en el input; Escape → `activeElement = body` ✘. |
| QA-07: `getComputedStyle` de `.series-shelf-closed/expanded/character` en `/series` | `transition-duration: 0s` en las tres. Con `--ease-out-strong` definido en `:root` (A/B en la misma página): `opacity, transform / 0.25s, 0.25s`. |
| Movimiento reducido: `document.getAnimations()` en ejecución, contexto con `reducedMotion` | `no-preference`: 14 en `/home` y 2 infinitas en `/chronology`. `reduce`: **0** en `/home`, `/series`, `/chronology` y `/series/12609`. |
| Hipótesis descartada: con Modo TV, ↓ en el buscador movería la selección y también el foco del D-pad | Falsa: con `tvMode` el buscador no se monta (`FloatingPillNav` devuelve `null`). |
| Deriva de tipos de Ajustes (`tsc` sobre archivos de scratch con el tsconfig de la web) | Claves del esquema ⊆ claves del modelo: ✔ en 6 secciones. Diferencias reales: `library.lastScanAt` (`unknown` frente a `string`) y `mediastream` (`null` frente a `undefined`). `useForm<In, unknown, Out>` + `zodResolver` compila sin cast. |
| Supresiones de ESLint | `eslint --report-unused-disable-directives` sobre los 13 archivos con `eslint-disable`: 0 reportes (todas en uso). |
| Botones sin nombre accesible (escáner AST con `typescript` sobre `components`, `routes`, `app` y `hooks`) | 109 `<button>`/`m.button` crudos y **0** candidatos. `IconButton` exige `aria-label` por tipo (`icon-button.tsx` L38). |

### Pendiente de medir

- **Controles del reproductor en ejecución** (axe y foco dentro de `player-ui`): no abrí el reproductor. Para hacerlo hay que bloquear `PATCH /api/v1/continuity/item` en un proxy (regla 4.1). Estáticamente no hay botones sin nombre en `components/video/`.
- **Viewport móvil (375 px) y Modo TV** con axe: solo medí escritorio 1440×900.
- **Lector de pantalla real** para QA-06 (NVDA o Narrador): hoy la evidencia es solo del DOM.
- **QA-02 en Tauri:** que `pagehide` se dispare al cerrar la ventana de WebView2. Si no se dispara, el último cambio de los 300 ms previos al cierre puede perderse; hoy tampoco hay garantía.

### Dependencias entre pasos

- QA-04 (guardián de tipos) va **antes** que QA-03 (quitar casts del formulario): así se ve enseguida si el cambio de tipos rompe algo.
- QA-01 y QA-03 tocan `routes/settings/index.lazy.tsx`: en serie, primero QA-01.
- QA-05 va antes que QA-06 (mismo archivo; QA-06 reutiliza el `triggerRef`).
- QA-02 cambia un módulo que también usan `player-store.ts` y `player-core.ts` (zona Z1). Si otra sesión tiene esos archivos modificados no hay conflicto, porque solo cambia `persist-settings.ts`, pero conviene avisarle.
- QA-07 depende de que el dueño de `-series-shelf.css` termine (archivo sin trackear).

### Alcance real

- **Leídos completos:** `docs/prompts/auditoria-frontend.md`, `hooks/use-focus-trap.ts`, `hooks/use-tv-dpad.ts`, `components/settings/range-slider.tsx`, `lib/server/persist-settings.ts`, `apps/web/eslint.config.js` (hasta las reglas), `apps/web/vitest.config.ts` y `apps/web/tsconfig.json`.
- **Leídos por tramos:** `routes/settings/index.lazy.tsx` (L1-42, L146, L299-450, L500-560, L795-804), `api/hooks/settings.hooks.ts` (L1-60 de 69), `lib/server/settings.ts` (L1-110 de 159), `components/ui/app-layout/expandable-search.tsx` (L40-384 de 485), `routes/settings/tabs/playback-tab.tsx` (L470-490, L540-558), `routes/settings/tabs/system-tab.tsx` (L150-192), `routes/series/$seriesId/-hooks/use-series-data.ts` (L110-185), `series-playback.helpers.ts` (L45-75), `components/shared/library-error-state.tsx` (L1-60), `api/client/server-url.ts` (L55-100), `lib/stores/index.ts` (L20-40, L85-100), `components/video/player-ui.tsx` (L195-225), `components/ui/PlayerSettingsMenu.tsx` (L500-540), `routes/series/-series-shelf.css` (L30-80) y los 7 diálogos propios (solo conteos de Escape, foco y trap).
- **Barridos con grep sobre todo `src/`** (sin `api/generated` ni `routeTree.gen.ts`): `any`, `@ts-*`, `eslint-disable`, `as unknown as`, `!`, `catch` vacíos (76 sitios, revisados uno por uno los de acciones de usuario), listeners/intervalos/observers sin pareja de limpieza (16 archivos candidatos, todos revisados: singletons de módulo o `once: true`), `setTimeout` sin `clearTimeout` en archivos con efectos, diálogos (`role="dialog"`/`aria-modal`), uso de reduced motion, tests `skip`/`only`/sin `expect`.
- **No auditado:** la lógica interna del reproductor (Z1), el rendimiento (Z2/Z4) y los datos o la caché (Z3), salvo el cruce de QA-02.

---

## 2. Plan

### Fase 1 — Código muerto

Sin pasos de Z5. El código muerto es de la zona Z4.

### Fase 2 — Rendimiento (pedidos)

#### Paso 2.1 — QA-02: agrupar los PATCH de `persist-settings` y avisar si fallan (riesgo MEDIO)

**A. Problema.** Cada paso de un slider de volumen hace un PATCH (20 por arrastre). Pueden llegar fuera de orden y los errores se tragan mientras la UI y la caché ya muestran el valor nuevo.

**B. Evidencia.** Medición del slider de arriba. `RangeSlider` (`components/settings/range-slider.tsx`) dispara `onChange={(e) => onChange(parseFloat(e.target.value))}` en cada `input`. Consumidores de `persistThemePatch`/`persistLibraryPatch`: `background-music.tsx` L293, `floating-pill-nav.tsx` L116, `player-core.ts` L604-613, `player-store.ts` L121 y `playback-tab.tsx` L455, L484, L508, L535, L554 (`grep -rn "persistLibraryPatch\|persistThemePatch" apps/web/src`). Todas esperan el contrato "fire-and-forget", que no cambia.

**C. Código ANTES** (`apps/web/src/lib/server/persist-settings.ts`, completo):

```ts
import { API_ENDPOINTS } from "@/api/generated/endpoints"
import { buildApiQuery } from "@/api/client/requests"

/**
 * Refleja el parche en la caché de GetSettings. La query tiene staleTime de 5 min:
 * sin esto, Ajustes montaba con la copia vieja, `syncStoresWithSettings` la volcaba
 * al store y el cambio recién hecho (p. ej. desde el reproductor) se revertía.
 * Import dinámico: client-providers importa los stores, que importan este módulo.
 */
function patchSettingsCache(section: "library" | "theme", patch: Record<string, unknown>): void {
    void import("@/app/client-providers")
        .then(({ queryClient }) => {
            queryClient.setQueryData<Record<string, unknown>>(
                [API_ENDPOINTS.SETTINGS.GetSettings.key],
                (old) => {
                    if (!old) return old
                    const prev = (old[section] ?? {}) as Record<string, unknown>
                    return { ...old, [section]: { ...prev, ...patch } }
                },
            )
        })
        .catch(() => {})
}

/**
 * Persiste flags de Biblioteca al servidor sin pasar por el form de Ajustes
 * (fire-and-forget). Los toggles fuera de Ajustes (Modo TV, maraton) solo
 * tocaban el store local y el servidor quedaba divergente: al visitar
 * Ajustes, el sync reseteaba el store y el modo se "perdia" solo.
 */
export function persistLibraryPatch(patch: Record<string, unknown>): void {
    patchSettingsCache("library", patch)
    try {
        void buildApiQuery({
            endpoint: API_ENDPOINTS.SETTINGS.SaveSettings.endpoint,
            method: API_ENDPOINTS.SETTINGS.SaveSettings.methods[0] as "PATCH",
            data: { library: patch },
        }).catch(() => {})
    } catch {}
}

/**
 * Persiste flags de Tema/Audio al servidor sin pasar por el form de Ajustes
 * (fire-and-forget). Los toggles fuera de Ajustes (audio master en navbar)
 * solo tocaban el store local y el servidor quedaba divergente: al visitar
 * Ajustes, el sync reseteaba el store y el sonido se reactivaba solo.
 */
export function persistThemePatch(patch: Record<string, unknown>): void {
    patchSettingsCache("theme", patch)
    try {
        void buildApiQuery({
            endpoint: API_ENDPOINTS.SETTINGS.SaveSettings.endpoint,
            method: API_ENDPOINTS.SETTINGS.SaveSettings.methods[0] as "PATCH",
            data: { theme: patch },
        }).catch(() => {})
    } catch {}
}
```

**D. Código DESPUÉS** (archivo completo; compilado con `tsc` y probado con el test de E en scratch):

```ts
import { API_ENDPOINTS } from "@/api/generated/endpoints"
import { buildApiQuery } from "@/api/client/requests"
import { errorText } from "@/api/client/error-messages"
import { toast } from "sonner"

type Section = "library" | "theme"

/**
 * Refleja el parche en la caché de GetSettings. La query tiene staleTime de 5 min:
 * sin esto, Ajustes montaba con la copia vieja, `syncStoresWithSettings` la volcaba
 * al store y el cambio recién hecho (p. ej. desde el reproductor) se revertía.
 * Import dinámico: client-providers importa los stores, que importan este módulo.
 */
function patchSettingsCache(section: Section, patch: Record<string, unknown>): void {
    void import("@/app/client-providers")
        .then(({ queryClient }) => {
            queryClient.setQueryData<Record<string, unknown>>(
                [API_ENDPOINTS.SETTINGS.GetSettings.key],
                (old) => {
                    if (!old) return old
                    const prev = (old[section] ?? {}) as Record<string, unknown>
                    return { ...old, [section]: { ...prev, ...patch } }
                },
            )
        })
        .catch(() => {})
}

// Cambios seguidos (un slider arrastrado, toggles repetidos) se agrupan en un solo PATCH por
// sección: antes salía uno por paso y podían llegar al servidor fuera de orden.
const FLUSH_DELAY_MS = 300
const pending: Record<Section, Record<string, unknown>> = { library: {}, theme: {} }
const timers: Partial<Record<Section, ReturnType<typeof setTimeout>>> = {}

function flush(section: Section, keepalive = false): void {
    const timer = timers[section]
    if (timer) clearTimeout(timer)
    delete timers[section]
    const patch = pending[section]
    if (Object.keys(patch).length === 0) return
    pending[section] = {}
    buildApiQuery({
        endpoint: API_ENDPOINTS.SETTINGS.SaveSettings.endpoint,
        method: API_ENDPOINTS.SETTINGS.SaveSettings.methods[0] as "PATCH",
        data: { [section]: patch },
        keepalive,
    }).catch((err) => {
        // La caché ya muestra el valor nuevo: si el servidor no lo guardó, se pierde al reabrir.
        toast.error("No se pudo guardar el cambio en el servidor", {
            id: `persist-settings-${section}`,
            description: errorText(err, "Se aplicó en esta sesión, pero puede perderse al reiniciar."),
        })
    })
}

function schedule(section: Section, patch: Record<string, unknown>): void {
    patchSettingsCache(section, patch)
    pending[section] = { ...pending[section], ...patch }
    const timer = timers[section]
    if (timer) clearTimeout(timer)
    timers[section] = setTimeout(() => flush(section), FLUSH_DELAY_MS)
}

if (typeof window !== "undefined") {
    // Cerrar la ventana durante la espera no debe perder el último cambio.
    window.addEventListener("pagehide", () => {
        flush("library", true)
        flush("theme", true)
    })
}

/**
 * Persiste flags de Biblioteca al servidor sin pasar por el form de Ajustes
 * (fire-and-forget). Los toggles fuera de Ajustes (Modo TV, maraton) solo
 * tocaban el store local y el servidor quedaba divergente: al visitar
 * Ajustes, el sync reseteaba el store y el modo se "perdia" solo.
 */
export function persistLibraryPatch(patch: Record<string, unknown>): void {
    schedule("library", patch)
}

/**
 * Persiste flags de Tema/Audio al servidor sin pasar por el form de Ajustes
 * (fire-and-forget). Los toggles fuera de Ajustes (audio master en navbar)
 * solo tocaban el store local y el servidor quedaba divergente: al visitar
 * Ajustes, el sync reseteaba el store y el sonido se reactivaba solo.
 */
export function persistThemePatch(patch: Record<string, unknown>): void {
    schedule("theme", patch)
}
```

**E. Cambios secundarios.** Ningún consumidor cambia: la firma es la misma. Test nuevo `apps/web/src/lib/server/persist-settings.test.ts` (validado: 4/4 contra el código D):

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const buildApiQuery = vi.fn()
const toastError = vi.fn()
vi.mock("@/api/client/requests", () => ({ buildApiQuery: (...args: unknown[]) => buildApiQuery(...args) }))
vi.mock("sonner", () => ({ toast: { error: (...args: unknown[]) => toastError(...args) } }))
vi.mock("@/app/client-providers", () => ({ queryClient: { setQueryData: vi.fn() } }))

import { persistLibraryPatch, persistThemePatch } from "@/lib/server/persist-settings"

describe("persist-settings", () => {
    beforeEach(() => {
        vi.useFakeTimers()
        buildApiQuery.mockReset().mockResolvedValue(undefined)
        toastError.mockReset()
    })
    afterEach(() => vi.useRealTimers())

    it("agrupa los pasos de un slider en un solo PATCH con el último valor", async () => {
        for (let i = 0; i <= 20; i++) persistThemePatch({ bgMusicVolume: i / 20 })
        expect(buildApiQuery).not.toHaveBeenCalled()
        await vi.advanceTimersByTimeAsync(300)
        expect(buildApiQuery).toHaveBeenCalledTimes(1)
        expect(buildApiQuery.mock.calls[0][0].data).toEqual({ theme: { bgMusicVolume: 1 } })
    })

    it("une claves distintas de la misma sección y no mezcla secciones", async () => {
        persistThemePatch({ bgMusicEnabled: false })
        persistThemePatch({ uiSoundsEnabled: false })
        persistLibraryPatch({ marathonMode: true })
        await vi.advanceTimersByTimeAsync(300)
        const bodies = buildApiQuery.mock.calls.map(c => c[0].data)
        expect(bodies).toContainEqual({ theme: { bgMusicEnabled: false, uiSoundsEnabled: false } })
        expect(bodies).toContainEqual({ library: { marathonMode: true } })
    })

    it("avisa si el servidor no guardó", async () => {
        buildApiQuery.mockRejectedValueOnce(new Error("Failed to fetch"))
        persistThemePatch({ uiSoundsVolume: 0.5 })
        await vi.advanceTimersByTimeAsync(300)
        expect(toastError).toHaveBeenCalledTimes(1)
    })

    it("envía lo pendiente con keepalive al cerrar la ventana", () => {
        persistLibraryPatch({ autoSkipIntro: true })
        window.dispatchEvent(new Event("pagehide"))
        expect(buildApiQuery).toHaveBeenCalledTimes(1)
        expect(buildApiQuery.mock.calls[0][0]).toMatchObject({ keepalive: true, data: { library: { autoSkipIntro: true } } })
    })
})
```

**F. Justificación y costo.** Es un solo archivo y no cambia las firmas. El valor local (store y caché) sigue siendo inmediato; lo único que se retrasa es la escritura en el servidor (300 ms desde el último cambio). Costo: un listener `pagehide` global (de módulo, como el resto de singletons). Riesgo residual: si WebView2 no dispara `pagehide` al cerrar Tauri, se pierden como mucho los últimos 300 ms; hoy un PATCH en vuelo también se pierde al cerrar.

**G. Validación.**
1. `pnpm --filter kamehouse-web typecheck` y `pnpm --filter kamehouse-web test:run -- src/lib/server/persist-settings.test.ts`.
2. Medición con el mismo método (script `slider.cjs` del Apéndice) en `/settings?tab=playback`. Antes: 20 PATCH por arrastre y 5 por 10 flechas. Esperado: 1 PATCH por arrastre (con el último valor) y 1 por la ráfaga de flechas.
3. Manual: en la barra flotante, alternar "Silenciar música" 3 veces rápido produce 1 PATCH con el valor final.

**H. Criterio de aceptación.** Como mucho 1 PATCH por sección por cada ráfaga de menos de 300 ms. Si falla, toast de error con `id` fijo (no se apila). Suite en verde.

**I. Reversión.** Restaurar `apps/web/src/lib/server/persist-settings.ts` y borrar `apps/web/src/lib/server/persist-settings.test.ts`.

### Fase 3 — Calidad y accesibilidad

#### Paso 3.1 — QA-01: estado de error en Ajustes cuando no cargan los ajustes (riesgo BAJO)

- **Símbolo:** `routes/settings/index.lazy.tsx` › `SettingsPage`.
- **Evidencia:** la medición QA-01 de arriba (GET forzado a 500: formulario con valores de fábrica y sin aviso).
- **ANTES** (L314 y L509, más el `return` final, L799-803):

```tsx
    const { data: serverSettings, isLoading } = useGetSettings()
```
```tsx
    const showLoader = isLoading && !serverSettings
```
```tsx
    return (
        <AnimatePresence mode="wait" initial={false}>
            {showLoader ? <LoadingOverlayWithLogo key="loader" /> : content}
        </AnimatePresence>
    )
```

- **DESPUÉS** (agregar el import junto a `LoadingOverlayWithLogo`, L8):

```tsx
import { LibraryErrorState } from "@/components/shared/library-error-state"
```
```tsx
    const { data: serverSettings, isLoading, isError, error, refetch } = useGetSettings()
```
```tsx
    const showLoader = isLoading && !serverSettings
    // Sin los ajustes del servidor el formulario mostraría los valores de fábrica como si fueran
    // los del usuario: mejor decir que no cargaron y ofrecer reintentar.
    const showError = isError && !serverSettings
```
```tsx
    return (
        <AnimatePresence mode="wait" initial={false}>
            {showLoader ? (
                <LoadingOverlayWithLogo key="loader" />
            ) : showError ? (
                <LibraryErrorState
                    key="error"
                    title="No pudimos cargar tus ajustes"
                    error={error}
                    onRetry={() => { void refetch() }}
                />
            ) : content}
        </AnimatePresence>
    )
```

- **Secundarios:** ninguno. `LibraryErrorState` ya se usa así en `routes/home/index.tsx` L82. La guarda de `onSubmit` (`if (!serverSettings)`) queda como red.
- **Validación:** `typecheck`. Luego el script `settings-fail.cjs` del Apéndice: con el GET forzado a 500, esperar un `role="alert"` con "No pudimos cargar tus ajustes" y un botón "Reintentar", y 0 controles del formulario. Con `FAIL=0`, la página igual que antes. Correr axe sobre `/settings` en los dos estados (0 violaciones). Verificar con `getBoundingClientRect` que el bloque no quede debajo de la barra flotante (`pt-nav`).
- **Reversión:** restaurar `routes/settings/index.lazy.tsx`.

#### Paso 3.2 — QA-04: guardián de tipos esquema ↔ modelo generado (riesgo BAJO)

- **Símbolo:** `lib/server/settings.ts` › `settingsSchema`.
- **Acción:** crear `apps/web/src/lib/server/settings.types.test.ts`. `tsc --noEmit` lo chequea porque `tsconfig.json` incluye `src`. Validado en scratch: compila hoy y **falla** si se agrega una clave inexistente (`"campoQueNoExiste"` → `TS2554`).

```ts
import { describe, expectTypeOf, it } from "vitest"
import type { SaveSettings_Variables } from "@/api/generated/endpoint.types"
import { settingsSchema } from "@/lib/server/settings"

type Section = "library" | "mediastream" | "theme" | "notifications" | "platform" | "googleDrive"
/** Campos declarados en el esquema zod (sin lo que deja pasar `.passthrough()`). */
type SchemaKeys<S extends Section> = keyof (typeof settingsSchema.shape)[S]["_def"]["innerType"]["shape"]
/** Campos del modelo que genera el codegen de Go. */
type ModelKeys<S extends Section> = keyof NonNullable<SaveSettings_Variables[S]>
type Unknown<S extends Section> = Exclude<SchemaKeys<S>, ModelKeys<S>>

// Los `as unknown as` entre el formulario y los tipos generados no dejan que tsc vea una
// deriva: si el codegen renombra un campo, este test es el que avisa.
describe("settingsSchema y los tipos generados", () => {
    it("cada campo del formulario existe en el modelo del servidor", () => {
        expectTypeOf<Unknown<"library">>().toEqualTypeOf<never>()
        expectTypeOf<Unknown<"mediastream">>().toEqualTypeOf<never>()
        expectTypeOf<Unknown<"theme">>().toEqualTypeOf<never>()
        expectTypeOf<Unknown<"notifications">>().toEqualTypeOf<never>()
        expectTypeOf<Unknown<"platform">>().toEqualTypeOf<never>()
        expectTypeOf<Unknown<"googleDrive">>().toEqualTypeOf<never>()
    })
})
```

- **Validación:** `typecheck` y `test:run -- src/lib/server/settings.types.test.ts`. Prueba negativa manual: agregar `campoX: z.boolean().default(false)` a `library` en el esquema → `typecheck` falla; luego revertir esa línea.
- **Reversión:** borrar el archivo.

#### Paso 3.3 — QA-03: quitar los casts del resolver y del submit (riesgo MEDIO)

**A. Problema.** `zodResolver(settingsSchema) as unknown as Resolver<SettingsFormValues>` y `onSubmit as unknown as SubmitHandler<FieldValues>` apagan el chequeo de tipos de todo el formulario.

**B. Evidencia.** Un modelo en scratch compiló sin errores: `useForm<z.input<typeof settingsSchema>, unknown, z.output<typeof settingsSchema>>({ resolver: zodResolver(settingsSchema) })`, `handleSubmit(SubmitHandler<Out>)`, `Controller` con `name: "theme.uiSoundsVolume"` y paso de `Control<In, unknown, Out>` a un genérico `<T>(c: Control<T>)` (como `DirtyOsToggle`). **No** probé las 5 pestañas reales: por eso el riesgo es MEDIO.

**C. Código ANTES.**

`lib/server/settings.ts` L101:
```ts
export type SettingsFormValues = z.infer<typeof settingsSchema>
```
`routes/settings/index.lazy.tsx` L5 y L378-383:
```tsx
import { useForm, FormProvider, type SubmitHandler, type FieldValues, type Resolver } from "react-hook-form"
```
```tsx
    const form = useForm<SettingsFormValues>({
        resolver: zodResolver(settingsSchema) as unknown as Resolver<SettingsFormValues>,
        defaultValues: getEffectiveSettings(serverSettings as unknown as SettingsFormValues),
        mode: "onBlur",
        shouldUnregister: false,
    })
```
L710:
```tsx
                            onSubmit={handleSubmit(onSubmit as unknown as SubmitHandler<FieldValues>, onFormError)}
```
Pestañas (`appearance-tab.tsx` L314, `library-tab.tsx` L28, `performance-tab.tsx` L19 y L385, `playback-tab.tsx` L26, `system-tab.tsx` L31):
```tsx
    control: Control<SettingsFormValues>
```

**D. Código DESPUÉS.**

`lib/server/settings.ts` (debajo de L101):
```ts
export type SettingsFormValues = z.infer<typeof settingsSchema>
/** Lo que el formulario edita antes de pasar por zod (los `.default()` todavía pueden faltar). */
export type SettingsFormInput = z.input<typeof settingsSchema>
/** Control del formulario de Ajustes: edita la entrada y entrega la salida ya validada. */
export type SettingsFormControl = Control<SettingsFormInput, unknown, SettingsFormValues>
```
Agregar al principio de `lib/server/settings.ts`:
```ts
import type { Control } from "react-hook-form"
```
`routes/settings/index.lazy.tsx`:
```tsx
import { useForm, FormProvider, type SubmitHandler } from "react-hook-form"
import { findIgnoredBinaryPaths, settingsSchema, type SettingsFormInput, type SettingsFormValues } from "@/lib/server/settings"
```
```tsx
    const form = useForm<SettingsFormInput, unknown, SettingsFormValues>({
        resolver: zodResolver(settingsSchema),
        defaultValues: getEffectiveSettings(serverSettings as unknown as SettingsFormValues),
        mode: "onBlur",
        shouldUnregister: false,
    })
```
```tsx
                            onSubmit={handleSubmit(onSubmit, onFormError)}
```
En las 5 pestañas, reemplazar el tipo de la prop (y el import `type Control` si queda sin uso):
```tsx
import { type SettingsFormControl } from "@/lib/server/settings"
```
```tsx
    control: SettingsFormControl
```
El cast de `defaultValues` (`Models_Settings` → formulario) **se queda** en este paso: sus diferencias reales (`null` frente a `undefined`, `lastScanAt`) las cubre QA-04 y no se tapan con otro cast.

**E. Cambios secundarios.** `onFormError` recibe `FieldErrors<SettingsFormInput>`: ajustar su anotación (L449, `import("react-hook-form").FieldErrors<SettingsFormValues>` → `FieldErrors<SettingsFormInput>`). Donde una pestaña lea `field.value` de un campo con `.default()` o `.transform()` (por ejemplo `library.seriesPaths`), el tipo pasa a ser el de entrada (`string[] | null | undefined`): agregar `?? []` en esa lectura, sin casts. Los 7 `useFormContext<SettingsFormValues>()` (5 pestañas, `-google-drive-card.tsx` L30 y `-dragonball-scanner-live.tsx` L48) pueden quedar como están: el contexto de RHF no está tipado y el genérico solo anota. Pasarlos a `<SettingsFormInput, unknown, SettingsFormValues>` es opcional; conviene hacerlo en este mismo paso solo si `typecheck` no protesta.

**F. Justificación y costo.** Recupera el chequeo de tipos de todo el formulario (resolver, envío y nombres de campo) sin tocar la ejecución. Costo: unas 10 líneas de tipos repartidas en 7 archivos.

**G. Validación.** `pnpm --filter kamehouse-web typecheck` (0 errores), `lint` y `test:run` (incluye `routes/settings/-os-select.test.tsx` y el guardián de 3.2). Manual en `/settings`: cambiar un toggle de cada pestaña, Guardar (con el servidor de pruebas, **nunca** el 43211), Descartar, y "Restablecer" desde Sistema sin confirmar. Comportamiento idéntico.

**H. Criterio de aceptación.** Desaparecen los casts del resolver y del `onSubmit` (`grep -n "as unknown as Resolver\|SubmitHandler<FieldValues>" apps/web/src` sin resultados), sin `@ts-*` nuevos ni casts nuevos, y la suite en verde.

**I. Reversión.** Restaurar `lib/server/settings.ts`, `routes/settings/index.lazy.tsx` y `routes/settings/tabs/{appearance,library,performance,playback,system}-tab.tsx`. Si `typecheck` muestra más de unos pocos errores en las pestañas, revertir y marcar el paso como "en espera".

#### Paso 3.4 — QA-05: devolver el foco al botón Buscar al cerrar (riesgo BAJO)

- **Símbolo:** `components/ui/app-layout/expandable-search.tsx` › `ExpandableSearch` › `handleCollapse`.
- **Evidencia:** medición QA-05 (`activeElement = body` tras Escape).
- **ANTES** (L55-56 y L79-83):

```tsx
    const containerRef = React.useRef<HTMLDivElement>(null)
    const inputRef = React.useRef<HTMLInputElement>(null)
```
```tsx
    const handleCollapse = React.useCallback(() => {
        setIsExpanded(false)
        setQuery("")
        setSelectedIndex(-1)
    }, [setQuery])
```
Y el `<m.button>` disparador (L211-215):
```tsx
                <m.button
                    type="button"
                    onClick={handleExpand}
                    aria-label="Buscar"
```

- **DESPUÉS:**

```tsx
    const containerRef = React.useRef<HTMLDivElement>(null)
    const inputRef = React.useRef<HTMLInputElement>(null)
    const triggerRef = React.useRef<HTMLButtonElement>(null)
```
```tsx
    const handleCollapse = React.useCallback(() => {
        // El input se desmonta al cerrar: si tenía el foco, caería a <body> y el teclado perdería
        // su lugar en la barra. Se devuelve al botón que abrió el buscador.
        if (containerRef.current?.contains(document.activeElement)) {
            triggerRef.current?.focus({ preventScroll: true })
        }
        setIsExpanded(false)
        setQuery("")
        setSelectedIndex(-1)
    }, [setQuery])
```
```tsx
                <m.button
                    ref={triggerRef}
                    type="button"
                    onClick={handleExpand}
                    aria-label="Buscar"
```

- **Secundarios:** ninguno. Los caminos que navegan (`handleSelectResult`) también pasan por `handleCollapse`: el foco va al disparador y después la navegación hace lo suyo, igual que hoy. El clic afuera (`mousedown`) enfoca el disparador y luego el navegador enfoca el elemento cliqueado, si es enfocable.
- **Validación:** `typecheck` y `lint`. Luego el script `search.cjs` del Apéndice: `afterEscape` debe ser `BUTTON[Buscar]` (antes `body`). Repetir con la X ("Cerrar búsqueda") por teclado: el foco queda en "Buscar". En el panel de navegador, clic afuera con el buscador abierto: el foco no salta al botón si se cliqueó otro control.
- **Reversión:** restaurar `expandable-search.tsx`.

#### Paso 3.5 — QA-06: semántica de combobox en el buscador (riesgo MEDIO)

**A. Problema.** ↑/↓ solo cambian `selectedIndex` (estilo `bg-brand-accent/20`); el lector de pantalla no se entera.

**B. Evidencia.** El DOM del input abierto: `aria-label`, `role`, `aria-expanded` y `aria-controls` en `null`; solo `placeholder`. Los resultados son `<button>` sueltos, sin lista.

**C. Código ANTES** (L246-254 y L306-332):

```tsx
                            <input
                                ref={inputRef}
                                type="text"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="Buscar series, películas…"
                                className="w-full bg-transparent border-none outline-none text-xs text-on-surface placeholder:text-label-3 font-sans focus:ring-0 focus:outline-none p-0 pr-1"
                            />
```
```tsx
                                <div className="flex-1 overflow-y-auto overflow-x-hidden p-1 space-y-1 custom-scrollbar max-h-[360px]">
                                    {visibleResults.length > 0 ? (
                                        visibleResults.map((res, index) => {
```
```tsx
                                            return (
                                                <button
                                                    key={String(result?.mediaId ?? `idx-${index}`)}
                                                    type="button"
                                                    onClick={() => handleSelectResult(result)}
                                                    className={cn(
```

**D. Código DESPUÉS** (agregar `const listboxId = React.useId()` junto a los `useRef`):

```tsx
    const listboxId = React.useId()
```
```tsx
                            <input
                                ref={inputRef}
                                type="text"
                                role="combobox"
                                aria-label="Buscar series y películas"
                                aria-autocomplete="list"
                                aria-expanded={isSearchActive && visibleResults.length > 0}
                                aria-controls={listboxId}
                                aria-activedescendant={selectedIndex >= 0 && visibleResults[selectedIndex] ? `${listboxId}-${selectedIndex}` : undefined}
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="Buscar series, películas…"
                                className="w-full bg-transparent border-none outline-none text-xs text-on-surface placeholder:text-label-3 font-sans focus:ring-0 focus:outline-none p-0 pr-1"
                            />
```
```tsx
                                <div
                                    id={listboxId}
                                    role="listbox"
                                    aria-label="Resultados de búsqueda"
                                    className="flex-1 overflow-y-auto overflow-x-hidden p-1 space-y-1 custom-scrollbar max-h-[360px]"
                                >
                                    {visibleResults.length > 0 ? (
                                        visibleResults.map((res, index) => {
```
```tsx
                                            return (
                                                <button
                                                    key={String(result?.mediaId ?? `idx-${index}`)}
                                                    id={`${listboxId}-${index}`}
                                                    type="button"
                                                    role="option"
                                                    aria-selected={isSelected}
                                                    onClick={() => handleSelectResult(result)}
                                                    className={cn(
```

**E. Cambios secundarios.** El mensaje vacío ("No se encontró nada") queda dentro del `listbox` sin `role="option"`. axe puede marcar `aria-required-children` si la lista queda sin opciones. En ese caso, renderizar el `listbox` solo cuando `visibleResults.length > 0` y dejar el mensaje vacío fuera, como hermano. Las imágenes de los resultados tienen `alt={title}`, que repite el texto del título: pasar a `alt=""` (decorativas dentro de una opción con nombre).

**F. Justificación y costo.** Es el patrón ARIA 1.2 de combobox con lista. El foco se queda en el input, así que no cambian Tab ni el D-pad. Solo agrega atributos.

**G. Validación.** `typecheck` y `lint` (incluye `jsx-a11y`). Script `search.cjs` modificado para leer, después de 2 × ↓, `input.getAttribute("aria-activedescendant")` y que exista el elemento con ese `id` y `aria-selected="true"`. axe con resultados visibles y con "No se encontró nada": 0 violaciones en los dos estados. Manual con Narrador: ↓ anuncia el título del resultado.

**H. Criterio de aceptación.** 0 violaciones de axe en los dos estados, `aria-activedescendant` sincronizado con la selección visual, y el teclado y el mouse sin cambios.

**I. Reversión.** Restaurar `expandable-search.tsx`.

#### Paso 3.6 — QA-07: token inexistente en `-series-shelf.css` (riesgo BAJO, en espera del dueño)

- **Símbolo:** `routes/series/-series-shelf.css` (reglas de L41, L55 y L73).
- **Evidencia:** `pnpm --filter kamehouse-web lint:tokens` → `--ease-out-strong` usada sin definir. Medición A/B de `transition-duration`.
- **Antes de tocarlo:** `git status --short -- apps/web/src/routes/series/-series-shelf.css`. Si sigue `??` o cambia entre lecturas, es trabajo ajeno en curso: dejar el paso **en espera** y avisar.
- **Acción:** reemplazar las 3 apariciones de `var(--ease-out-strong)` por `var(--ease-out)`, el mismo valor que ya usa la utilidad Tailwind `ease-out-strong` (`tailwind.config.ts` L122). Editar con la herramienta de edición, no con `sed -i`.
- **Validación:** `lint:tokens` pasa. Script `shelf.cjs` del Apéndice: `transition-duration` distinto de `0s` en las tres clases, sin definir nada a mano.
- **Reversión:** restaurar el archivo.

#### Paso 3.7 — QA-08: episodio sintético tipado sin cast (riesgo BAJO)

- **Símbolo:** `routes/series/$seriesId/-hooks/use-series-data.ts` › `useSeriesData` › `computedEpisodes`.
- **Evidencia de que `episodeMetadata.episodeNumber` no tiene lectores:** `grep -rn "episodeMetadata?.episodeNumber\|episodeMetadata.episodeNumber" apps/web/src` sin resultados.
- **ANTES** (L159-174):

```ts
                    epMap.set(epNum, {
                        episodeNumber: epNum,
                        absoluteEpisodeNumber: epNum,
                        episodeTitle: lf.name,
                        displayTitle: lf.name,
                        watched,
                        sagaId,
                        type: "main",
                        progressNumber: epNum,
                        isDownloaded: true,
                        isInvalid: false,
                        episodeMetadata: {
                            episodeNumber: epNum,
                            image: entry.media?.posterImage || entry.media?.bannerImage || "",
                        },
                    } as unknown as Anime_Episode)
```

- **DESPUÉS** (compila sin cast, verificado):

```ts
                    // localFile queda en null a propósito: resolveLocalFileForEpisode lo busca por número.
                    epMap.set(epNum, {
                        episodeNumber: epNum,
                        absoluteEpisodeNumber: epNum,
                        episodeTitle: lf.name,
                        displayTitle: lf.name,
                        watched,
                        sagaId,
                        type: "main",
                        progressNumber: epNum,
                        isDownloaded: true,
                        isInvalid: false,
                        localFile: null,
                        fileMetadata: null,
                        episodeMetadata: {
                            image: entry.media?.posterImage || entry.media?.bannerImage || "",
                        },
                    })
```

- **Por qué `localFile: null` y no `lf`:** preserva el comportamiento exacto (hoy vale `undefined`, también falsy). Poner `lf` cambiaría qué archivo se reproduce si hay varios con el mismo número.
- **Validación:** `typecheck` y `test:run -- src/routes/series` (10 archivos de test). Manual: ficha de una serie cuyo proveedor no trae episodios descargados (rama de `localFiles`); la lista se ve y el play funciona, con el progreso bloqueado.
- **Reversión:** restaurar `use-series-data.ts`.

#### Paso 3.8 — QA-09: el lint falla con warnings (riesgo BAJO)

- **Símbolo:** `apps/web/package.json` › `scripts.lint`.
- **ANTES:** `"lint": "eslint src/",`
- **DESPUÉS:** `"lint": "eslint src/ --max-warnings=0",`
- **Evidencia:** el estado inicial es 0 warnings (ver Verificación). Esto endurece el listón, no lo relaja.
- **Validación:** `pnpm --filter kamehouse-web lint` → exit 0. Prueba negativa: agregar temporalmente `const x: any = 1` en un archivo → exit ≠ 0; luego revertir.
- **Reversión:** restaurar `package.json`.

#### Paso 3.9 — QA-10: tests de `useFocusTrap` (riesgo BAJO)

- **Acción:** crear `apps/web/src/hooks/use-focus-trap.test.tsx`. Validado en scratch: 2/2 en verde, y con una copia del hook sin `previouslyFocused.focus(...)` falla el primer test.

```tsx
import { act, render } from "@testing-library/react"
import { useRef } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { useFocusTrap } from "@/hooks/use-focus-trap"

function Dialog({ open }: { open: boolean }) {
    const ref = useRef<HTMLDivElement>(null)
    useFocusTrap(ref, open)
    if (!open) return null
    return (
        <div ref={ref} role="dialog" aria-label="Prueba">
            <button type="button">Primero</button>
            <button type="button">Último</button>
        </div>
    )
}

function Harness({ open }: { open: boolean }) {
    return (
        <>
            <button type="button">Abrir</button>
            <Dialog open={open} />
        </>
    )
}

// happy-dom no hace layout: getClientRects() queda vacío y el hook descartaría todo.
function fakeLayout() {
    vi.spyOn(HTMLElement.prototype, "getClientRects").mockReturnValue([{}] as unknown as DOMRectList)
}

async function nextFrame() {
    await act(async () => { await new Promise(r => requestAnimationFrame(() => r(null))) })
}

describe("useFocusTrap", () => {
    afterEach(() => vi.restoreAllMocks())

    it("lleva el foco adentro al abrir y lo devuelve al disparador al cerrar", async () => {
        fakeLayout()
        const view = render(<Harness open={false} />)
        const trigger = view.getByRole("button", { name: "Abrir" })
        trigger.focus()
        view.rerender(<Harness open />)
        await nextFrame()
        expect(document.activeElement).toBe(view.getByRole("button", { name: "Primero" }))
        view.rerender(<Harness open={false} />)
        expect(document.activeElement).toBe(trigger)
    })

    it("Tab en el último vuelve al primero y Shift+Tab en el primero va al último", async () => {
        fakeLayout()
        const view = render(<Harness open />)
        await nextFrame()
        const first = view.getByRole("button", { name: "Primero" })
        const last = view.getByRole("button", { name: "Último" })
        last.focus()
        act(() => { document.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true })) })
        expect(document.activeElement).toBe(first)
        act(() => { document.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", shiftKey: true, bubbles: true, cancelable: true })) })
        expect(document.activeElement).toBe(last)
    })
})
```

- **Nota:** el `as unknown as DOMRectList` vive solo en el doble de prueba. Es el único modo de simular layout en happy-dom; no es código de producción.
- **Opcional (no validado):** un test equivalente para `useTvDpad` que cubra que, con un `[aria-modal="true"]` visible, ↓ no saca el foco del diálogo. Requiere poner `tvMode` en el store y simular `getBoundingClientRect`.
- **Validación:** `test:run -- src/hooks/use-focus-trap.test.tsx`.
- **Reversión:** borrar el archivo.

---

## 3. Verificación

### Estado inicial (antes de tocar nada; commit `a249c13` + cambios ajenos del checkout)

| Comando (desde la raíz) | Resultado |
|---|---|
| `pnpm --filter kamehouse-web lint` | exit 0, **0 errores y 0 warnings** |
| `pnpm --filter kamehouse-web typecheck` | exit 0 |
| `pnpm --filter kamehouse-web test:run` | exit 0: **119 archivos, 1005 tests**, todos en verde (123 s con carga de otras sesiones) |
| `pnpm --filter kamehouse-web lint:tokens` | **exit 1 (ya fallaba):** `--ease-out-strong` sin definir en `src/routes/series/-series-shelf.css`, archivo sin trackear y ajeno. No atribuir al plan. |
| `cd apps/web && npx eslint --report-unused-disable-directives <13 archivos con eslint-disable>` | exit 0, sin directivas sobrantes |

Nota: la memoria del proyecto mencionaba un fallo conocido de `button-recipes.guard.test.ts`; **hoy pasa**.

### Comandos para validar el plan

```bash
pnpm --filter kamehouse-web typecheck
```
```bash
pnpm --filter kamehouse-web lint
```
```bash
pnpm --filter kamehouse-web lint:tokens
```
```bash
pnpm --filter kamehouse-web test:run
```

### Apéndice — scripts de medición usados (recrear en `scratch/`, borrar al terminar)

Requisitos: `node_modules/playwright-core` y `node_modules/axe-core` en la raíz del monorepo (ya están, sin agregar dependencias), Chrome en `C:/Program Files/Google/Chrome/Application/chrome.exe` y `export MSYS_NO_PATHCONV=1` en Git Bash. `BASE` es un servidor web **que no sea el 43211**. Todos abortan cualquier pedido a la API que no sea GET.

**`axe.cjs`** (QA-01 y regresiones de accesibilidad): `ROUTES=/,/series,... node axe.cjs`.
```js
const path = require("path"), fs = require("fs"), root = path.resolve(__dirname, "../..")
const { chromium } = require(path.join(root, "node_modules/playwright-core"))
const axeSrc = fs.readFileSync(path.join(root, "node_modules/axe-core/axe.min.js"), "utf8")
const BASE = process.env.BASE || "http://127.0.0.1:43210"
const routes = (process.env.ROUTES || "/,/series,/movies,/chronology,/settings").split(",")
;(async () => {
  const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true })
  const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage()
  await p.route("**/api/**", r => ["GET","HEAD","OPTIONS"].includes(r.request().method()) ? r.continue() : r.abort())
  for (const r of routes) {
    await p.goto(BASE + r, { waitUntil: "domcontentloaded" }); await p.waitForTimeout(Number(process.env.WAIT || 6000))
    await p.addScriptTag({ content: axeSrc })
    const v = await p.evaluate(async () => (await axe.run(document, { resultTypes: ["violations"] })).violations.map(v => `${v.id}(${v.impact}) x${v.nodes.length}`))
    console.log(r, v.join(", ") || "none")
  }
  await b.close() })()
```

**`settings-fail.cjs`** (QA-01): igual que el anterior, pero en `page.route` responder `route.fulfill({ status: 500, contentType: "application/json", body: "{}" })` cuando el GET coincide con `/\/api\/v1\/settings(\?|$)/` (salvo si `FAIL=0`). Navegar a `/settings`, esperar 12 s y leer `document.querySelectorAll('[role="alert"]')`, la cantidad de `input[type=checkbox],[role=switch],input[type=range],input[type=text]` y `document.body.innerText`.

**`slider.cjs`** (QA-02): registrar en `page.route` los métodos distintos de GET (y abortarlos). En `/settings?tab=playback`, enfocar `input[type=range][aria-label="Volumen de la música de fondo"]`, pulsar 10 × `ArrowLeft` cada 60 ms y contar los PATCH. Luego arrastrar con `page.mouse` de punta a punta en 30 pasos de 16 ms y volver a contar.

**`search.cjs`** (QA-05/06): en `/home`, `locator('button[aria-label="Buscar"]').focus()`, `Enter`, leer los atributos de `document.activeElement`, escribir "goku", correr axe, pulsar `Escape` dos veces y leer `document.activeElement` (esperado tras 3.4: `BUTTON[Buscar]`).

**`shelf.cjs`** (QA-07): en `/series`, leer `getComputedStyle(el).transitionProperty/transitionDuration` de `.series-shelf-closed`, `.series-shelf-expanded` y `.series-shelf-character`, y `getComputedStyle(document.documentElement).getPropertyValue("--ease-out-strong")`.

**Movimiento reducido:** `browser.newContext({ reducedMotion: "reduce" })` y contar `document.getAnimations().filter(a => a.playState === "running").length` en `/home`, `/series`, `/chronology` y una ficha (esperado: 0).

**Tests fuera de `src/` (solo para validar antes de crear archivos):** config de Vitest temporal con `root: apps/web`, el `setupFiles` de la web, `esbuild: { jsx: "automatic" }`, `include` apuntando al archivo de scratch y alias `@` → `apps/web/src`. Para probar un código DESPUÉS sin tocar el repo, agregar antes un alias del módulo concreto a la copia de scratch. Correr con `cd apps/web && npx vitest run --config <ruta>`.
