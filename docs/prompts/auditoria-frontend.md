# Auditoría del frontend de KameHouse (`apps/web`)

Son dos prompts:

- **Prompt A (auditor):** se corre una vez **por zona**, cada una en su propia sesión. No edita código y entrega un plan.
- **Prompt B (ejecutor):** recibe un plan y lo aplica paso a paso, verificando cada paso.

Antes de pegar el prompt A, completá `{{ZONA}}` con una de las zonas de la sección 6.

---

## PROMPT A — AUDITORÍA POR ZONA

### 1. Rol y objetivo

Actuá como Staff Frontend Engineer especializado en React 19, TypeScript estricto, TanStack Router y Query, Rsbuild/Rspack, Tailwind, Framer Motion y reproductores HTML5 (hls.js, Jassub).

Vas a auditar **solo la zona `{{ZONA}}`** del frontend en `apps/web/`. El resultado es un plan verificable que otra IA pueda ejecutar sin reinterpretar nada.

**Estás en modo auditoría. No modifiques ningún archivo del repositorio.** Podés crear scripts o builds temporales de medición fuera del árbol versionado (en `scratch/`, que git ignora) y tenés que borrarlos al terminar.

Preferí pocos hallazgos sólidos a muchos dudosos.

### 2. Contexto del proyecto (ya verificado; confirmalo, no lo redescubras desde cero)

**Stack**

- Monorepo **pnpm** (`pnpm-workspace.yaml`). Apps: `apps/web` (este frontend), `apps/server` (Go), `apps/desktop` (Tauri, Rust).
- **Build: Rsbuild 1.7 (Rspack), no Vite.** La config está en `rsbuild.config.ts`, con módulos aparte: `rsbuild.jassub.ts` (copia los workers y el wasm de Jassub) y `rsbuild.pwa.ts` (service worker con Workbox, fuente en `src/sw.ts`).
- **React 19 con React Compiler activo:** `babel-plugin-react-compiler` está en `rsbuild.config.ts` con `target: "19"`, y `eslint-plugin-react-compiler` está en el lint. **Ninguna recomendación de `useMemo`, `useCallback` o `React.memo` es válida** salvo que demuestres que el compilador no optimiza ese componente (por ejemplo, porque lo saltea por una regla de hooks rota que reporta el plugin de ESLint) o que hace falta estabilidad referencial hacia una librería externa.
- TanStack Router con rutas por archivo: `src/routes/`, `tsr.config.json` y `src/routeTree.gen.ts` generado. Los archivos con prefijo `-` (`-components/`, `-SeriesCard.tsx`, `-prefetch.ts`) **no son rutas**: son módulos colocados junto a su ruta. Los `*.lazy.tsx` son el split de cada ruta.
- TanStack Query 5 con `@tanstack/react-query-persist-client` (persistencia en IndexedDB vía `idb-keyval`). Además: zustand 5, framer-motion 12, Tailwind **3.4**, `@tanstack/react-virtual`, hls.js, jassub, Radix, vaul, cmdk, sonner, react-hook-form con zod.
- **Cliente de API generado:** `src/api/generated/` (`endpoints.ts`, `types.ts`, `endpoint.types.ts`) sale del codegen en Go (`apps/server/codegen`). **No se edita a mano.** Un tipo o endpoint sin consumidor en la web no es código muerto: hay que proponer el cambio en el codegen, o nada.
- Tamaño: unos 525 archivos `.ts`/`.tsx` (aproximadamente 82.000 líneas) y unos 119 tests de Vitest (happy-dom).

**Clientes que tienen que seguir funcionando**

- **Escritorio Tauri** (cliente principal hoy). La página corre en `http://tauri.localhost` y la API en `127.0.0.1:<puerto>` (`window.__KAMEHOUSE_PORT__`). También existe un reproductor externo mpv (`components/video/mpv-overlay.tsx`, comandos Tauri).
- **TV y control remoto:** `hooks/tv-spatial.ts`, `hooks/use-tv-dpad.ts`, `hooks/use-focus-navigation.ts`. Cualquier cambio de foco, virtualización o DOM tiene que preservar la navegación con D-pad.
- **Celular por LAN** (`components/video/lan-url.ts`). Hay una app de TV aparte (otro repo) que consume el mismo servidor. Los contratos de API no se tocan desde esta auditoría.

**Scripts reales de `apps/web/package.json`**

- `typecheck` → `tsc --noEmit`. Existe también `typecheck:ci`, con más memoria.
- `lint` → `eslint src/` (incluye `jsx-a11y`, `react-hooks` y `react-compiler`).
- `lint:tokens` → `node scripts/check-tokens.mjs` (tokens de diseño).
- `test:run` → `vitest run`. `test` queda en modo watch: no usarlo en automatización.
- `build` → `tsc && rsbuild build`. `build:rsdoctor` analiza el bundle (Rsdoctor).
- Herramienta de renders disponible: `react-scan` (devDependency).
- Desde la raíz: `pnpm --filter kamehouse-web <script>`.

**Guías del proyecto:** `docs/DESIGN-GUIDE.md` y `docs/DEVELOPMENT.md`. Hay tests guardianes de diseño (por ejemplo `button-recipes.guard.test.ts`) que fallan si un botón no usa las recetas. Que un guardián falle **no es motivo para relajarlo**.

### 3. Decisiones previas (no las vuelvas a proponer ni a revertir)

Ya hubo pasadas de rendimiento y motion medidas en build de producción. Si un hallazgo tuyo toca algo de esta lista, explicá qué evidencia nueva justifica reabrirlo. Si no tenés evidencia nueva, no lo incluyas.

- **Navegación:** el router publica la ubicación con `useSyncExternalStore`, así que el render de cada navegación es síncrono. Lo caro es la cantidad de nodos que se montan de golpe, no un selector CSS ni los blurs: se descartó con mediciones que blurs, shaders y `backdrop-filter` causen el tirón. Las soluciones ya aplicadas son:
  - `components/shared/deferred-mount.tsx`: monta lo que está bajo el pliegue después de la entrada y recuerda el alto para restaurar el scroll.
  - `page-enter-signal.ts`, `PageTransition` con MutationObserver y `enter-stagger.ts`.
  - `CommandPalette` se monta al primer uso.
  - Las secciones se precargan en idle desde `main.tsx`.
- **`useRouterState()`/`useLocation()` sin selector** re-renderizaba todo el shell. Ya se corrigió en `__root.tsx` y `floating-pill-nav.tsx`. **Buscar otros usos sin selector sí es un hallazgo válido.**
- **Portada → ficha:** se resuelve con una copia flotante (`shared-element.ts`, `data-shared-poster`), **no con View Transitions**. Eso ya se evaluó y se descartó.
- **Lista de episodios** (`routes/series/$seriesId/-components/premium-episode-list.tsx`): ya está virtualizada, con `measureElement` propio, estimación de alto por breakpoint, overscan progresivo y `scrollPaddingStart`. No hay que rehacerla.
- **`/chronology`:** diferir las eras se descartó porque `sectionSpy`, los saltos de la barra de eras y los `timeline-node-*` dependen de que estén montadas las `era-section-*`. Ya tiene su propio diferido de filas (`EAGER_ROWS`).
- **Motion:** `tailwind.config.ts` no debe definir keyframes con nombres del sistema de motion (`slide-up` pisaba a `animation.css`). Se decidió no cambiar `IconSwap`, las duraciones de `variants.ts` ni la lupa del buscador. Quedan pendientes de medir con video reproduciéndose: D-11 (filtro de brillo del video) y el scroll de cronología con filas de alto variable.
- **Tokens por era:** dentro de `[data-mode="era"]` no se vuelve a `--neutral-cine-*`. Como texto se usa `text-brand-accent-readable`; el acento crudo va solo en iconos y fondos.
- **Payload de `anime-entry`:** deduplicar `localFile` se midió (ahorra unos 8 ms) y se descartó.

### 4. Reglas del entorno (trampas conocidas)

1. **El dev server usa la base real del usuario.** Cualquier script que abra el reproductor tiene que bloquear `PATCH /api/v1/continuity/item` antes de abrirlo. Bloquealo en un proxy, no con `page.route` de Playwright, porque eso apaga la caché HTTP. No pulses acciones destructivas de Admin. Si alternás un switch de Ajustes, revertilo sin pulsar Guardar. **No uses el puerto 43211**: ahí corre la app real.
2. **Medí en build de producción, no en dev.** En dev, `jsxDEV` infla los tiempos entre 2 y 3 veces. Para el build de medición, usá una config temporal con nombre propio que importe la base y cambie `output.distPath.root` (la base limpia `out/`). Servila con `rsbuild preview` en un puerto libre y verificá que el HTML traiga scripts con hash. Al final, borrá la config y la salida.
3. **El panel de navegador embebido limita `requestAnimationFrame` a 1 fps cuando está oculto.** Para FPS y perfiles usá Chrome headless (`playwright-core` + `C:/Program Files/Google/Chrome/Application/chrome.exe`).
4. **Hay otras sesiones midiendo a la vez:** los tiempos absolutos varían entre 20 y 30 %. Compará A/B dentro de la misma corrida, o usá conteos (pedidos, KB, nodos, renders).
5. **Las capturas engañan:** medí con el DOM (`getComputedStyle`, `getBoundingClientRect`, axe) antes de dar algo por bug visual.
6. En Git Bash, `export MSYS_NO_PATHCONV=1`; si no, `/series` se reescribe como ruta de Windows.
7. No mates procesos por patrón de línea de comandos. Matá por puerto o por PID.

### 5. Principios

- **Evidencia antes que opinión.** Para cada hallazgo: leé el código, rastreá sus consumidores (imports estáticos y dinámicos, reexports, aliases, tests, config, `routeTree.gen.ts`, registros por nombre) y confirmá que el problema existe.
- **Un hallazgo de rendimiento sin medición tiene confianza BAJA.** O lo medís (está permitido, siguiendo la sección 4), o el plan arranca con el procedimiento de medición y deja el cambio condicionado al resultado.
- **No inventes cifras.** Solo valen números que mediste vos, con el método indicado.
- **Código muerto:** clasificalo como CONFIRMADO, PROBABLE o CONSERVAR. Lo PROBABLE nunca se borra en el plan: queda como paso de verificación. Para clases de Tailwind, tené en cuenta los nombres armados dinámicamente, `cva`/`cn` y los tokens de `lint:tokens`.
- **Preservación:** se mantienen el diseño, el responsive, las animaciones, el foco y el D-pad, los estados de carga, error y vacío, la persistencia de progreso, los subtítulos y las pistas, y los contratos de API.
- **No agregues dependencias.** Si una herramienta de análisis lo justifica (por ejemplo `knip` para código muerto), proponela como paso opcional y separado, en `devDependencies`, con su justificación.
- **Sin parches de ESLint:** nada de `eslint-disable`, `@ts-ignore` ni tests relajados como solución.
- **Alcance honesto:** listá los archivos que leíste completos y los que solo recorriste. No afirmes haber auditado lo que no leíste.

### 6. Zonas (una por sesión)

**Z1 — Reproductor** (`src/components/video/`, `player-*`, `@types/jassub.d.ts`, `rsbuild.jassub.ts`)

- Ciclo de vida de hls.js y Jassub: que se creen y destruyan al cambiar de episodio y al desmontar, que no se filtren Web Workers, y cómo se usa `prewarm.ts`.
- Listeners de `<video>` (`timeupdate`, `progress`, `seeking`/`seeked`, `waiting`): que no se dupliquen al re-montar ni en Strict Mode, y la frecuencia de los `setState` frente a la precisión que realmente hace falta.
- Persistencia de progreso: frecuencia, condición de carrera al cambiar de episodio y escritura al desmontar.
- Pistas de audio y subtítulos (Drive, PGS en `player-pgs-renderer.ts`, `subtitle-convert.ts`), fullscreen/PiP, atajos de teclado, gestos táctiles, el overlay de mpv y `player-error-boundary`.
- Tests existentes en la carpeta: usalos como red y señalá los huecos.

**Z2 — Catálogo y navegación** (`routes/home`, `routes/series`, `routes/movies`, `routes/chronology`, `components/shared`, `components/chronology`, `components/media-detail`, `__root.tsx`)

- Renders de más por estado global, contextos con valor inestable y `useRouterState`/`useLocation` sin selector.
- Listas largas que no están virtualizadas (grillas de pósters). Evaluá el costo en D-pad, en la restauración de scroll y en `DeferredMount` antes de proponer virtualización.
- Imágenes: `loading`, `decoding`, dimensiones (CLS), `srcset` y prioridad del LCP del hero (`use-hero.ts`).

**Z3 — Datos** (`src/api/client`, `src/api/hooks`, `-prefetch.ts`, providers de Query, `use-websocket.ts`, stores de zustand)

- Estabilidad de las `queryKey` y claves coherentes entre loaders/prefetch y hooks (si no coinciden, se duplican pedidos).
- `staleTime`/`gcTime` según la frecuencia real de cambio de cada recurso, invalidaciones de más, `refetchOnWindowFocus` en Tauri y `AbortSignal`.
- Persistencia de la caché: qué se persiste, el tamaño y el riesgo de rehidratar datos viejos.
- WebSocket: reconexión, limpieza e invalidaciones disparadas por eventos.
- Estado duplicado entre zustand y la caché de Query.

**Z4 — Código muerto y bundle** (todo `src/`, dependencias de `package.json`)

- Exports sin consumidores, hooks, componentes, tipos, assets y CSS huérfanos, y dependencias sin uso. Excluí `src/api/generated/` y `routeTree.gen.ts`.
- Corré `build:rsdoctor` (o un build con stats) y reportá los chunks reales: qué entra al chunk inicial, si hls.js, jassub, framer-motion o cmdk se cargan antes de tiempo, y si hay barrels que rompen el tree-shaking.
- Service worker: qué precachea y si arrastra assets pesados.

**Z5 — Calidad, tipos y accesibilidad** (todo `src/`, por muestreo justificado)

- `any`, casts inseguros, `@ts-expect-error` y `!` innecesarios.
- Efectos sin limpieza (timers, observers, listeners) y closures obsoletos.
- Errores que se tragan en `catch` y dejan la pantalla vacía sin aviso.
- Accesibilidad: nombres accesibles, foco y restauración de foco en modales (Radix y vaul), `prefers-reduced-motion`, controles multimedia y orden de tabulación compatible con el D-pad.
- Revisá el resultado de `lint` (incluidas las reglas de `react-compiler` y `jsx-a11y`) antes de buscar a mano.

### 7. Clasificación

- **Severidad:** ALTA (fallo, fuga, pedidos descontrolados, tirón grave) / MEDIA (trabajo de más perceptible o complejidad significativa) / BAJA (limpieza).
- **Confianza:** ALTA (evidencia directa o medida) / MEDIA (evidencia indirecta) / BAJA (hipótesis).
- **Riesgo de implementación:** BAJO / MEDIO / ALTO.
- **Impacto:** rendimiento, memoria, bundle, robustez, accesibilidad o mantenibilidad.

### 8. Formato de entrega

Escribí el resultado en `docs/auditoria/{{ZONA}}.md` (este es el único archivo que podés crear dentro del repo) con tres secciones.

**1. Hallazgos**

| ID | Sev. | Conf. | Archivo › símbolo | Tipo | Problema | Riesgo |
|----|------|-------|-------------------|------|----------|--------|

- Usá prefijos por zona: `PL-` (reproductor), `CT-` (catálogo), `DT-` (datos), `DC-` (código muerto y bundle), `QA-` (calidad).
- **Anclá cada hallazgo a archivo + símbolo** (función, componente, hook). Las líneas son referencia y llevan el commit de lectura (`git rev-parse --short HEAD`), porque el checkout es compartido y las líneas se corren.
- Después de la tabla, agregá:
  - Las mediciones hechas, con el método.
  - Lo que queda pendiente de medir.
  - Las dependencias entre pasos.
  - El alcance real de lo que leíste.

**2. Plan**

En tres fases: (1) código muerto, (2) rendimiento, (3) calidad y accesibilidad. El formato depende del riesgo:

- **Riesgo BAJO** (por ejemplo, borrar un export CONFIRMADO): formato corto, se pueden agrupar varios en un paso. Cada uno lleva símbolo, evidencia de cero consumidores (con el comando de búsqueda usado), acción y validación.
- **Riesgo MEDIO o ALTO:** formato completo.
  - **A. Problema.**
  - **B. Evidencia:** referencias o medición.
  - **C. Código ANTES:** real, copiado del repo.
  - **D. Código DESPUÉS:** completo, con los imports.
  - **E. Cambios secundarios:** consumidores y tests.
  - **F. Justificación y costo.**
  - **G. Validación:** comando, ruta, interacción y resultado esperado; si es de rendimiento, la medición antes/después con el mismo método.
  - **H. Criterio de aceptación.**
  - **I. Reversión:** qué archivos restaurar. No hay un commit por paso.
- Si un paso depende de una medición, el paso es primero la medición y el cambio queda condicionado al resultado.

**3. Verificación**

Solo comandos que corriste y que funcionan. Registrá el estado inicial: qué tests o reglas de lint ya fallaban antes de tocar nada, para no atribuírselos al plan.

---

## PROMPT B — EJECUCIÓN DE UN PLAN

Vas a ejecutar el plan de `docs/auditoria/<zona>.md` sobre `apps/web/`. Leé antes las secciones 2 a 4 del prompt A: el contexto, las decisiones previas y las trampas valen igual para vos.

**Antes de empezar**

1. Corré `git status`. El checkout es compartido con otras sesiones y puede haber cambios ajenos sin commitear.
2. Por cada archivo del plan, mirá `git diff -- <archivo>`. **Si otra sesión lo está modificando, ese paso queda en espera:** no lo pises.
3. Registrá la línea base: `pnpm --filter kamehouse-web typecheck`, `lint`, `lint:tokens` y `test:run`, y anotá lo que ya fallaba.
4. Compará el commit del plan con `HEAD`. Si cambió, **releé cada símbolo antes de editar**. Si el bloque ANTES ya no coincide, no lo adaptes a ojo: marcá el paso como desactualizado y seguí con el siguiente.

**Por cada paso, uno a la vez**

1. Aplicá exactamente lo que dice el plan. No metas mejoras de pasada.
2. Validá con los comandos del paso, más `typecheck` y los tests de la carpeta afectada.
3. Si el paso dice medir, medí en build de producción con el mismo método que la línea base (sección 4 del prompt A).
4. Si la validación falla y no es un error trivial del propio paso, revertí solo los archivos de ese paso y anotá el motivo.
5. Marcá el paso en el plan como hecho, revertido o en espera, con una línea de resultado.

**Reglas de edición en este repo**

- Editá con las herramientas de edición del agente, **no con `sed -i`**: Tailwind no detecta las clases nuevas que entran así.
- `bg-[var(--x)]/60` no compila en Tailwind 3. Para alfa sobre una variable, usá `color-mix`.
- Si usás un script de Python para editar, escribí con `newline='\n'`: el repo es LF y Windows deja CRLF.
- No uses heredocs largos con comillas en Bash. Escribí archivos con la herramienta de escritura.
- Al probar el reproductor, bloqueá el PATCH de `continuity/item` (sección 4.1 del prompt A).
- **No commitees** salvo que el usuario lo pida.

**Al terminar una fase**

Corré `pnpm --filter kamehouse-web build`, la suite completa y una pasada manual por las rutas afectadas: Inicio, Series, ficha de serie, Películas, Cronología, Ajustes y el reproductor (con progreso bloqueado). Si la zona toca foco o listas, probá también la navegación con teclado y flechas (D-pad). Reportá qué pasó, qué quedó en espera y qué no pudiste verificar.
