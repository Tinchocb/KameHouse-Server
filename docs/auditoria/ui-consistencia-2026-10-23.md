# Auditoría de consistencia visual, movimiento y microinteracciones — KameHouse (`apps/web`)

- **Fecha:** 2026-10-23 · **Base:** `HEAD 446a13a` + cambios sin commitear de otras sesiones (≈ 800 archivos modificados). Las líneas citadas son las del árbol de trabajo en el momento de la lectura.
- **Alcance de esta etapa:** solo lectura. No se modificó código. Único archivo creado: este documento (misma carpeta que las auditorías anteriores).
- **Fuentes de diseño:** `docs/DESIGN-GUIDE.md`, `apps/web/src/styles/tokens/*.css`, `app/globals.css`, componentes canónicos (`Button`, `SectionBar`, `SegmentedControl`, `Modal`, `EraRail`, `kinetics/*`). No existe `AGENTS.md` en el repositorio; se aplicó `.agents/rules/communication.md` y `docs/prompts/auditoria-frontend.md` (decisiones previas y trampas del entorno).
- **Skills usadas por etapa:** `ui-skills-root` (enrutado) → `improve-ui` (prueba triple contrato / ejecución / corrección) → `transitions-polish` (duraciones, easings, asimetría abrir/cerrar, stagger) → `design-system` (tokens). No se cargaron `fixing-accessibility` ni `mobile-native`: lo táctil y lo accesible se revisó con la guía y con mediciones del DOM.

## Convenciones de evidencia

| Marca | Significado |
|---|---|
| **[código]** | Comprobado leyendo el archivo y confirmando que el componente participa en la vista. |
| **[ejecución]** | Medido en la aplicación funcionando (`getComputedStyle`, `getBoundingClientRect`, `elementFromPoint`, conteo de `backdrop-filter`). |
| **[pendiente]** | No hay evidencia suficiente; se indica qué falta. |

Entorno de ejecución: servidor Go en `:43212` (base de desarrollo real, solo lectura) + `rsbuild dev` en `:43210`; escritorio 1440×900 y móvil emulado 375×812 (`hover:none`, `pointer:coarse`). Se detuvieron ambos al terminar.

---

## 1. Checklist de apartados

| Apartado | Estado | Qué se revisó |
|---|---|---|
| Tokens y CSS global (`animation.css`, `blur.css`, `globals.css`, `tailwind.config.ts`) | **Revisado** | Duraciones, easings, foco global, reduced-motion, objetivos táctiles, `.sectionbar`, `.surface-content`. |
| Componentes base (`Button`, `IconButton`, `SectionBar`, `SegmentedControl`, `Modal`, `Popover`, `Toaster`, `Skeleton`, estados) | **Revisado** (código; `Modal`/`SegmentedControl` también en ejecución) | Recetas, estados, asimetría abrir/cerrar. |
| Navegación (pastilla flotante, barra superior, barra inferior móvil, buscador de la barra, paleta Ctrl+K) | **Revisado** (ejecución desktop y móvil; código parcial) | Alturas, foco, búsqueda, toggles. |
| Inicio (`/home`) | **Revisado** (ejecución desktop y móvil; código de `SpotlightHero`/hub parcial) | Hero, riel de eras, hub, controles. |
| Series · estantería y portadas | **Revisado** (ejecución desktop/móvil de la estantería; portadas solo en código) | Tarjetas, listbox, esqueletos. |
| Ficha de serie | **Revisado** (ejecución desktop/móvil; código de hero y lista de episodios) | Hero, CTA, lista, sagas, vidrio. |
| Películas · listado | **Revisado** (ejecución) | Hero, filtros, grilla, tarjetas. |
| Ficha de película (`/movies/$movieId`) | **Parcial** (solo código puntual) | No se ejecutó. |
| Cronología | **Parcial** (ejecución desktop/móvil; cabecera y tarjeta en código) | Modal inspector, marathon y tira de momentos sin abrir. |
| Ajustes | **Parcial** (ejecutadas Apariencia, Biblioteca y Sistema; Reproducción y Rendimiento solo por código) | Sidebar, filas, campos, barra de guardado (código). |
| Administración | **Parcial** (ejecución móvil + código de visor de registros) | Acciones destructivas no tocadas. |
| Reproductor y menús del reproductor | **Parcial — solo código** | No se ejecutó: el servidor de desarrollo usa la base real y abrirlo escribe progreso (decisión previa 4.1). |
| Diálogos y hojas (Modal ×7 usos, Vaul ×4, diálogos a mano ×6) | **Parcial** | Ejecutados: paleta y explorador de carpetas; el resto por código. |
| Mi Lista (cola), Sorpréndeme, ficha de personaje, inspector de lapso, maratón | **Pendiente** (código parcial) | No se llegaron a abrir en ejecución. |
| Onboarding (`GettingStarted`), 404, `AppErrorBoundary` | **Parcial — solo código** | |
| Modo TV / D-pad | **Pendiente** | Fuera de lo ejecutable aquí. |
| Tableta (768 px) | **Pendiente** | Solo se midió 1440 y 375. |

---

## 2. Hallazgos (por impacto, agrupados por causa compartida)

Leyenda de severidad: **Importante** / **Pulido** (no hay bloqueantes verificados).

### H-01 · Importante · Ficha de serie en móvil: el CTA principal queda tapado 12 px por la barra inferior

- **Apartado/componente:** Ficha de serie → `SeriesHero` (`PlayCta`) + barra inferior móvil.
- **Problema y condición:** en 375×812, sin desplazar, el botón «Reanudar/Reproducir» ocupa y=712–756 y la barra inferior (fija, z 700) ocupa y=744–800. Un punto 3 px por encima del borde inferior del botón resuelve a la barra, no al CTA.
- **Archivo y línea:** `routes/series/$seriesId/-components/series-hero.tsx:264` (`pb-[calc(3.5rem+env(safe-area-inset-bottom,0px))]`) frente a `routes/__root.tsx:321` (`pb-[calc(4.25rem+…)]`, que sí cuenta el `bottom: 0.75rem` de la barra).
- **Regla:** comentario del propio archivo (264–268: «el CTA quede por encima de la barra») y `docs/DESIGN-GUIDE.md` §6.3 (touch, safe areas).
- **Evidencia:** [ejecución] rects medidos + `elementFromPoint`; [código] diferencia 3,5 rem vs 4,25 rem = 12 px, igual al solape medido.
- **Impacto:** la parte baja del botón principal de la pantalla activa la pestaña de navegación; en iPhone con safe-area el solape se mantiene (misma resta).
- **Corrección mínima:** `pb-[calc(4.25rem+env(safe-area-inset-bottom,0px))]` (más aire si se quiere); no requiere token nuevo.
- **Confianza:** alta. **Pendiente:** repetir con altura 667 y con safe-area real.

### H-02 · Importante · Vidrio apilado (blur dentro de blur, uno por fila)

- **Apartado/componente:** Ficha de serie (lista de episodios, «Continuar viendo»), Cronología (tarjetas de lapso), y cualquier `.surface-content` repetido.
- **Causa compartida:** `styles/tokens/blur.css:377-380` aplica `backdrop-filter: blur(var(--blur-overlay-sm)) saturate(…)` a **todo** `.surface-content` que no sea pastilla, y el botón `glass` (`Button`/`IconButton`/`GlassIconButton`) añade otro blur propio. El comentario de la propia cabecera de `.surface-content` (blur.css:357-358) dice «opaca… sin blur» y la guía §2 prohíbe apilar blur y poner uno por tarjeta/fila repetida.
- **Condición y evidencia [ejecución]** (modo con transparencia):
  - `/series/12971`: 53 elementos con `backdrop-filter`, **19 anidados** dentro de otro. 17 filas `ARTICLE.surface-content` (blur 16 px) con un `IconButton glass` anidado por fila (17 más), más el badge «EP 219» (8 px) y «Ver en lista» (8 px) dentro de `sectionbar-strong`.
  - `/chronology`: 41 `backdrop-filter`, **25 anidados**: 5 `ARTICLE.sectionbar` expandidas, cada una con 4 `IconButton glass` y un badge `backdrop-blur-md`.
- **Archivos y líneas:** `routes/series/$seriesId/-components/premium-episode-list.tsx:428-438` (fila) y `:554-555` (`IconButton intent="glass"`); `routes/series/$seriesId/-components/series-continue-watching.tsx:39,98,129`; `components/chronology/TimelineVolumeCard.tsx:202,214-216` (comentarios «sin .sectionbar… el vidrio se repetiría» y «única capa de vidrio») frente a `:397,417,428,509,525` (blur anidado).
- **Regla incumplida:** DESIGN-GUIDE §2 «Blur / Vidrio» («Prohibido apilar blur… tampoco un blur por tarjeta o badge repetido en una lista») y §9.
- **Impacto:** costo de composición no medido. Las pasadas anteriores descartaron el blur como causa del tirón de **navegación**; esto es otra pregunta (scroll con filas montadas). No se afirma caída de rendimiento.
- **Corrección mínima propuesta:**
  1. Decidir el contrato (ver §6, decisión D1): o `.surface-content` vuelve a ser sin blur en filas repetidas, o la guía admite el blur de `.surface-content` y fija un límite.
  2. Para botones sobre miniatura dentro de una tarjeta con blur: usar `intent="secondary"`/sólido (`--neutral-elev-2`) en lugar de `glass`, que ya existe y respeta Flat.
  3. En cronología, la expansión por visibilidad hace que varias tarjetas lleven `.sectionbar` a la vez: limitar el vidrio a la tarjeta resaltada (`isHighlighted`), como indica el comentario de `TimelineVolumeCard.tsx:214`.
- **Confianza:** alta en el hecho (medido); media en el impacto. **Pendiente:** A/B de FPS/scroll con `scratch/perf-nav` en build de producción antes de cambiar nada.

### H-03 · Importante · Cinco recetas distintas de campo de formulario

- **Apartado/componente:** Ajustes (Biblioteca, Sistema), Administración (registros), explorador de carpetas del servidor.
- **Problema:** campos con la misma función (texto/selección) con alto, radio y estados distintos:

| Campo | Alto × radio medido | Archivo:línea |
|---|---|---|
| `OsInput` (canónico de Ajustes) | 44 px · pastilla | `routes/settings/components.tsx:429-447` |
| `SecretField` (claves TMDB) | 44 px · pastilla | `components/settings/secret-field.tsx` |
| `DirectorySelector` | contenedor `surface-content rounded-full`, input h-9 | `components/shared/directory-selector.tsx:131-166` |
| Credenciales de Google Drive (3 `<input>` crudos) | **34 px · 16 px** (`rounded-lg`) | `routes/settings/components/-google-drive-card.tsx:274-322` |
| `<select>` nativos (TMDB manual, tipo; registros) | 36–44 px · `rounded-xl` (20 px), `font-mono` en registros, `min-h-[42px]` | `routes/settings/components/-tmdb-match-manual.tsx:139-158`, `components/settings/server-logs-viewer.tsx:61-67` |
| `TextInput` base (usado en el modal «Elegir una carpeta») | **48 px · 0 px (cuadrado)**, `text-white`, `backdrop-blur-overlay-sm`, borde `white/15` | `components/ui/input/input-parts.tsx:12` → `directory-selector.tsx:230-241` |

- **Regla:** DESIGN-GUIDE §2 Radio («pill `rounded-full` (botones, inputs, selects, tabs)»), §5.2 (filas `OsToggle/OsSelect/OsInput`), §2 Color («texto con `text-on-surface*`, no `text-white`»).
- **Evidencia:** [ejecución] medidas en Ajustes › Biblioteca (inputs 34 px/r16 junto a pastillas) y en el modal del explorador (582×48, radio 0, `color: rgb(255,255,255)`); [código] líneas arriba.
- **Alcance real:** el modal del explorador solo se abre en el cliente web (en Tauri se usa el diálogo nativo, `directory-selector.tsx:178`); el resto está activo también en escritorio.
- **Impacto:** formulario de Ajustes con campos que parecen de otra app; en el modal, un rectángulo de esquinas vivas entre botones en píldora.
- **Corrección mínima:** reutilizar `OsInput`/`OsSelect` (Ajustes) o aplicar la receta de pastilla de `OsInput` a los tres inputs de Drive; reemplazar los `<select>` nativos por `OsSelect` (o, si se quiere nativo en el visor de registros, igualar radio a pastilla y alto a 44/36); para `TextInput` base, o se migra el único consumidor a la receta de `DirectorySelector` o se corrige `InputAnatomy` (radio pastilla, sin `text-white`, sin blur propio).
- **Confianza:** alta. **Pendiente:** ver cómo se ve el `<select>` nativo desplegado en Tauri/WebView2 (el popup nativo no sigue el tema).

### H-04 · Importante · Buscadores: doble indicador de foco en el de la barra y siete variantes sin criterio común

- **Causa del doble foco [ejecución + código]:** `globals.css:170-175` fuerza `outline: 2px solid … !important` en todo `input:focus-visible` (excepto `[cmdk-input]`). El `<input>` del buscador de la barra vive dentro de una cápsula `h-8 rounded-full overflow-hidden` y declara `outline-none focus:outline-none` (`components/ui/app-layout/expandable-search.tsx:246-255`); el `!important` global gana. Medido: input 200×16, radio 0, `outline: solid 2px rgba(255,255,255,.9)` dentro de una cápsula de 260×32 → recuadro dentro del óvalo. En el buscador de Películas el input *es* la pastilla y el contorno la sigue (correcto).
- **Comparación [código + ejecución]:**

| Buscador | Alto | Radio / superficie | Icono | Placeholder | Limpiar | Foco propio |
|---|---|---|---|---|---|---|
| Barra (`expandable-search.tsx:201-283`) | 32 px | pastilla, `white/8` | 3,5 | «Buscar series, películas…» | X 22 px (limpia o cierra) | outline anidado (ver arriba) |
| Películas (`movies-filter-bar.tsx:197-230`) | 44 px | `glass-frosted-pill` | 4 | «Buscar película… (/)» | 44×44, anim. 150 ms | pastilla completa |
| Episodios (`premium-episode-list.tsx:206-232`) | 44 px | `glass-frosted-pill` | 4 | «Buscar episodio... (/)» (**tres puntos**) | 32×32, CSS `animate-scale-in` | pastilla + `shadow-elevation-2` |
| Paleta (`command-palette.tsx:331-342`) | 56 px | marco del diálogo | — | «Buscar series, películas… (> comandos, @ cronología)» | botón «Limpiar búsqueda» solo en vacío | exceptuado del outline global |
| Escáner (`scan-file-list.tsx:102-112`) | no medido (`py-1.5`, texto 11 px) | `rounded-lg` (16 px), `neutral-elev-2` | lucide directo | «Buscar archivo o serie» | no tiene | `focus-within:border` |
| TMDB manual (`-tmdb-match-manual.tsx:139-148`) | 44/36 px | `rounded-xl` (20 px) | no tiene | «Buscar título en TMDB…» | no tiene | outline global |
| Ajustes | — | — | — | — | — | **no hay buscador** (la guía §7 aún lo describe) |

- **Regla:** DESIGN-GUIDE §2 Radio (pastilla) y §5.5; mismo atajo `/` en Películas y Episodios pero no en el resto.
- **Impacto:** el buscador más usado (barra) muestra dos marcos al enfocarse; el resto difiere en alto, limpieza y puntuación sin razón funcional (el de la paleta y la barra sí difieren por función).
- **Corrección mínima:** (1) añadir al selector de `globals.css:170` la misma excepción que ya existe para cmdk (p. ej. `:not([data-embedded-field])`) y marcar el input de la barra, dejando el contorno en la cápsula con `focus-within`; (2) unificar «…» (un solo carácter) en los placeholders; (3) escáner y TMDB manual: pasar a pastilla y 44/36 px como Películas; (4) mantener la paleta y la barra como variantes justificadas.
- **Confianza:** alta (1), media (3). **Pendiente:** captura a resolución completa del recuadro (el zoom del panel era de baja resolución; la medición es concluyente).

### H-05 · Importante · Botón principal del hero: la ficha de serie usa un botón propio

- **Problema:** Inicio y Películas usan `Button intent="primary" size="lg"` (h 48, sentence-case, `bg-brand-accent`); la ficha de serie usa `PlayCta`: `bg-white text-black … uppercase tracking-wider`, `min-h-[44px]` (mide 46), sombra con `rgba(255,255,255,…)` inline y colores fijos (no `--selected-bg/fg` ni `bg-brand-accent`).
- **Archivos y líneas:** `components/ui/play-cta.tsx:31-38`; usado en `routes/series/$seriesId/-components/series-hero.tsx:210-217`; referencias canónicas: `components/ui/spotlight/spotlight-hero.tsx:266-268`, `routes/movies/-components/movies-hero.tsx:313` (`ButtonAnatomy.root({intent:"primary",size:"lg"})`).
- **Regla:** DESIGN-GUIDE §2 Color («nunca hex fijo… texto con `text-on-surface*`»), §2 Sombra («nunca rgba inline»), `design-system` («Acciones: `Button` con intención y tamaño canónicos; `primary` para CTA principal»). El guardián `button-recipes.guard.test.ts` no lo detecta (solo cuenta `<button>` crudos con `bg-white/NN` o `backdrop-blur`).
- **Evidencia:** [ejecución] «REANUDAR» mide 194×46, `text-transform: uppercase`; hero de Inicio 242×48 sentence-case. [pendiente] comportamiento en «Por era» (el `Button primary` toma el color de la era; `PlayCta` queda blanco).
- **Copy relacionado:** la misma acción se llama «Continuar Ep. N» (Inicio, tarjetas de película, «Continuar viendo») y «Reanudar» (ficha de serie, píldora contraída, `series-continue-watching`).
- **Corrección mínima:** aplicar `ButtonAnatomy.root({ intent: "primary", size: "lg" })` al `RippleFeedback` de `PlayCta` conservando `reserveLabels`; elegir un verbo único (decisión D3).
- **Confianza:** alta en la divergencia; media en el efecto en «Por era».

### H-06 · Importante · Estados vacío/error/no encontrado: cinco lenguajes visuales

| Estado | Contenedor | Título | Animación | Archivo:línea |
|---|---|---|---|---|
| `EmptyState` / `LibraryEmptyState` | `.glass-card px-12 py-16`, `max-w-2xl`, **`shadow-2xl`**, borde `white/5`, manchas `blur-3xl` | `text-2xl md:text-3xl font-black` | CSS `animate-scale-in` | `components/shared/empty-state.tsx:29-48` |
| `LibraryErrorState` | `EmptyState` dentro de `min-h-[60vh]` + `role="alert"` | h1 | (la del anterior) | `library-error-state.tsx:37-58` |
| `NotFound` | `.sectionbar`, `p-8 md:p-12`, `max-w-lg` | `font-display tracking-widest uppercase` («PÁGINA NO ENCONTRADA») | CSS `animate-slide-up` | `not-found.tsx:6-17` |
| `AppErrorBoundary` | `.sectionbar`, `min-h-[400px]`, `max-w-lg` | `type-title` sentence-case | ninguna | `app-error-boundary.tsx:84-108` |
| Caja de «Sin conexión» | `rounded-2xl bg-surface-container-high/80` + blur md + **`shadow-2xl shadow-black/80`** | texto `xs` | framer `scale .95` | `loading-overlay-with-logo.tsx:168-217` |

- **Patrón de la guía (§5.7):** `.glass-card rounded-3xl p-8`, spring `entrance`, CTA `bg-brand-accent rounded-full`; ninguno lo sigue al pie de la letra.
- **Defecto adicional [código]:** `NotFound` renderiza `<Link><Button …/></Link>` (`not-found.tsx:13-16`) → `<a><button>` anidado, doble parada de tabulación y rol ambiguo; además sobreescribe con clases la receta de `Button primary` (`px-8 py-3 … uppercase tracking-widest … h-auto`).
- **Impacto:** el usuario ve cuatro «caras» distintas para «algo falló / no hay nada»; el 404 además rompe la accesibilidad por teclado.
- **Corrección mínima:** `NotFound` → `Button` con `asChild`/`Link` + `ButtonAnatomy.root`, sentence-case, y reutilizar el contenedor de `EmptyState` (o de `AppErrorBoundary`) como única «tarjeta de estado»; quitar `shadow-2xl` (usar `shadow-elevation-4`).
- **Confianza:** alta. **Pendiente:** no se forzó ningún error en ejecución.

### H-07 · Importante (confianza media) · La caja de carga declara «Sin conexión» por tiempo, no por error

- **Problema [código]:** `LoadingOverlayWithLogo` calcula `timedOut = elapsedMs() >= 12000` medido **desde el arranque de la app** (`loading-overlay-with-logo.tsx:23-24,39`) y muestra la caja de fallo con solo `showFailure = timedOut` (`:111`), sin mirar `isError`. En Ajustes se monta sin `isError` (`routes/settings/index.lazy.tsx:509,801`) y en `GettingStarted` (`components/shared/getting-started.tsx:186`).
- **Condición:** abrir Ajustes después de 12 s de uso con la consulta de ajustes aún sin datos (caché vacía o vencida) → aparece «El servidor no responde» con el servidor sano.
- **Evidencia:** [código] cierta. [ejecución] observado dos veces al cargar `/settings` directo con la API respondiendo 200: el overlay quedó mostrando «Sin conexión». **Atenuante:** el panel del navegador estaba oculto (rAF pausado), lo que impide que `AnimatePresence mode="wait"` termine la salida del overlay; al forzar un dibujado el contenido apareció. El mensaje falso, en cambio, depende solo del código citado.
- **Corrección mínima:** pasar `isError` desde el consumidor y mostrar la caja solo con `isError && timedOut`; medir `timedOut` desde el montaje del overlay.
- **Pendiente:** reproducir en una ventana visible con la caché de Query vaciada.

### H-08 · Pulido · `.sectionbar` impone 24 px de radio; la guía describe clases que no existen

- **[ejecución]** Elemento de prueba con `sectionbar rounded-full`, `sectionbar rounded-3xl`, `sectionbar sectionbar-pill`, `sectionbar rounded-xl`: **todos miden 24 px**. Causa: `globals.css:349` (`@apply rounded-2xl`) gana a las utilidades de radio.
- **Consecuencias:** el sidebar de Ajustes (`settings/index.lazy.tsx:559`, `rounded-3xl`) mide 24 px, no 28; la barra flotante de guardado (`:746`, `rounded-full`) no es una píldora; `.sectionbar-pill` (guía §3.3) **no existe** en ningún CSS.
- **Deriva de la guía (la guía dice «El código manda»):** §3.3 `.sectionbar-pill`; §4 «sidebar `sectionbar rounded-3xl`»; §2 «`rounded-xl` filas del sidebar» (el código usa `rounded-2xl`, `index.lazy.tsx:599`); §5.5/§7/§9 `SettingsFilter`, `matchesSettingsQuery`, `NoSettingsResults` (no existen en `src/`; Ajustes no tiene buscador); §5.7 «`.surface-content` para esqueletos con `animate-pulse`» (hoy lleva blur en modo con transparencia).
- **Corrección mínima:** o se actualiza la guía y se quitan las clases inertes, o se añade `.sectionbar-pill{border-radius:9999px}` después de `.sectionbar` y se usa en la barra de guardado. Es una decisión de contrato (D2).
- **Confianza:** alta.

### H-09 · Pulido · Menús, popovers y hojas: duplicados con diferencias accidentales

- **Menú de Películas (`ChoiceMenu`, `movies-filter-bar.tsx:29-138`):** menú propio con vidrio a mano (`bg-[color-mix…75%] backdrop-blur-overlay-md border-white/15 border-t-white/30 rounded-2xl`, línea 108), resolución propia de clic exterior/Esc, spring inline `{stiffness:380,damping:30}` (línea 107, sin `mass`; el preset `entrance` es 380/30/0,8) y `role="group"` con `aria-pressed` en lugar de menú. El `Popover` canónico (`ui/popover/popover.tsx:13`) usa otro look (`rounded-xl`, `border-white/[0.08]`, `bg-[var(--glass-bg)]`, `shadow-2xl`) y `OsSelect` otro más.
- **Hojas inferiores (Vaul):** `VaulContent` base no define vidrio (`vaul/index.tsx:50`, fondo opaco); cada consumidor pone su piel: `routes/movies/-MovieCard.tsx:290` (`/95 + blur-overlay-md + border-outline-variant/10`), `routes/series/$seriesId/index.lazy.tsx:543` (`/95 + blur-overlay-xl` = **48 px**, `border-white/[0.1]`), `components/ui/PlayerSettingsMenu.tsx:551` (opaca, `neutral-separator`), `app-layout/mobile-menu-sheet.tsx:52` (base).
- **Regla:** §2 Blur (24 px estándar; «overlay-xl» no está en la escala de la guía) y §9 («cajas glass a mano»).
- **Corrección mínima:** `ChoiceMenu` sobre `Popover` (Radix: foco, Esc, colisiones) con `glass-frosted`; una receta de hoja (`sheet`) en `VaulContent` y dos variantes (vidrio/sólida).
- **Confianza:** alta en la diferencia; media en que convenga unificar (ver D4).

### H-10 · Pulido · Objetivos pequeños y controles que cambian de tamaño

- **Puntos del hero y pausa:** en escritorio miden **14×28** (inactivos) y **20×20** (pausa); en móvil 44×28 (el mínimo global fuerza el ancho pero no el alto). `hero-carousel-dots.tsx:250` (pausa) y `:305` (`min-h-7 px-1`). WCAG 2.5.8 pide 24×24 salvo alternativa equivalente; aquí el riel de eras y las flechas ofrecen otra vía. [ejecución]
- **Toggles de la pastilla inferior:** al activarse, «Maratón» y «Música» pasan de 32×32 a 34×34 porque solo la rama activa lleva `border` (`floating-pill-nav.tsx:332-338`, `:364-370`) → salto de 2 px en la pastilla. [ejecución: `aria-pressed=true` ⇒ 34 px, `false` ⇒ 32 px]. Corrección: `border border-transparent` en la rama inactiva.
- **Impacto:** puntería en escritorio con ratón y micro-saltos al alternar.
- **Confianza:** alta (medido). El punto de los puntos es decisión de producto (D5).

### H-11 · Pulido · Semántica de encabezados y capitalización por ruta

- **Doble `h1`:** Inicio (`routes/home/index.tsx:93` + `spotlight-hero.tsx:227`) y Películas (`movies/index.lazy.tsx:361` + `movies-hero.tsx:385`) tienen un `h1` oculto y otro visible (título del hero). Series y Ajustes tienen uno. [ejecución: `h1` ×2 medido]
- **Títulos de página con tres estilos:** Cronología visible `font-display black uppercase` 30 px (`chronology/Header.tsx:119`), Ajustes/Admin `type-title` 24 px, resto `sr-only`.
- **`neutro-sentence` solo en 3 de 8 rutas** (`series/index.lazy.tsx:319`, `movies/index.lazy.tsx:342`, `chronology/index.lazy.tsx:590`): en Neutro, la ficha de serie conserva mayúsculas y mono (`PlayCta` `play-cta.tsx:33`, badge `series-hero.tsx:162,177`, chips de audio `labelStyle="caps"`). [ejecución: `text-transform: uppercase` en la ficha, no en el listado]
- **Regla:** DESIGN-GUIDE §2 Tipografía («títulos en sentence-case y sans; `font-mono` solo contadores y etiquetas técnicas cortas») y `globals.css:318-328`.
- **Confianza:** alta en el hecho; **requiere decisión** (D6): la ficha puede ser «cinematográfica» a propósito.

### H-12 · Pulido · Valores fuera de escala o de token (con línea)

| Qué | Dónde | Regla |
|---|---|---|
| `rounded-[11px]` ×3 (hoy el padre `rounded-xl` = 20 px; el 11 quedó de la escala vieja) | `routes/series/-SeriesSpineRow.tsx:76,82,153` | §2 Radio |
| `rounded-[10px]` | `components/chronology/Header.tsx:101` | §2 Radio |
| `shadow-[0_18px_40px_-20px_rgba(0,0,0,0.9)]` | `-SeriesSpineRow.tsx:67` | §2 Sombra |
| `shadow-2xl` ×3 | `empty-state.tsx:32`, `ui/popover/popover.tsx:13`, `loading-overlay-with-logo.tsx:174` | §2 Sombra («nunca genérico») |
| Escala Tailwind de color para insignias de era (`orange-950/80`, `amber-300`, `rose-400`…) y `rgba(255,255,255,0.85)` | `components/chronology/Header.tsx:31-73` | §2 Color / §10.2 («no escalas de Tailwind sueltas») |
| `var(--text-primary)` **no definida** | `routes/series/$seriesId/-components/series-hero.tsx:173`, `routes/movies/$movieId.lazy.tsx:197` | `pnpm lint:tokens` la reporta (único error); el `color` cae al heredado |
| 25 duraciones fuera de token (`duration-300`/`700`/`200`/`500`) | 18 archivos, p. ej. `-SeriesSpineRow.tsx:66,89,137,172` | §2 Motion / `transitions-polish` |
| `rgba(`/hex inline en `.tsx` | 103 líneas en 39 archivos (muchas en overlays sobre imagen, donde es esperable) | §2 Color |

- **Confianza:** alta (todos por grep + lectura). Cada uno se corrige con el token existente más cercano por *uso* (no por número).

### H-13 · Pulido · Movimiento y microinteracciones (según `transitions-polish`)

- **Springs fuera de `useSpringPreset`:** `components/ui/spotlight/spotlight-lower-hub.tsx:29` (280/28 = `tabContent`), `movies-filter-bar.tsx:107` (380/30), `components/shared/getting-started-steps/variants.ts:27` (`duration` + spring 200/25). *Descartado:* `performance-monitor.tsx:280` (solo DEV).
- **Stagger total 440–480 ms** en Series (12 × 40 ms, `series/index.lazy.tsx:30-35`) y Portadas (`-SeriesPosterGridItem.tsx:69`): supera los ≈ 300 ms de la regla genérica. **No proponer cambio** sin medición (decisión previa: `enter-stagger.ts`).
- **Escala al presionar:** 0,95 (`Button`, SegmentedControl, tarjetas de póster `group-active:scale-95`), 0,96, 0,98 (portadas), 0,985 (cintas móviles), 0,99 (global). La regla «más grande, menos escala» se cumple en portadas/cintas pero no en `MoviePosterCard` (0,95 sobre una tarjeta grande).
- **Hover sin condición de puntero fino:** 104 líneas en 36 archivos (`expandable-search.tsx`, `floating-pill-nav.tsx`, `TimelineVolumeCard.tsx`, `random-play-button.tsx`, `premium-episode-list.tsx`…). La guía §6.3 exige `[@media(hover:hover)_and_(pointer:fine)]`. [pendiente]: comprobar hover pegado en un dispositivo táctil real.
- **Clases inertes:** `globals.css:140-146` anula todos los `ring` de Tailwind en foco; hay 51 líneas con `focus(-visible):ring-*` en 39 archivos que no hacen nada (el foco visible real es el contorno global de 2 px, **verificado** al tabular: `solid 2px rgba(255,255,255,.9)`, offset 2 px, radio del elemento).
- **Foco:** `random-play-button.tsx:53-91` implementa su propia trampa de foco mientras `hooks/use-focus-trap` ya la ofrece (usado por la cola y la ficha de personaje).
- **Esqueletos:** `Skeleton` (shimmer) en catálogo/fichas; `animate-pulse` en Ajustes (`settings/index.lazy.tsx:299-306`, **sobre `.surface-content`, que hoy tiene backdrop-filter**: incumple la regla de la guía que él mismo cita), lista de episodios y cronología. La guía solo fija Inicio (shimmer) y Ajustes (pulse).
- **Reduced motion [código]:** correcto — `MotionConfig reducedMotion="user"` (`client-providers.tsx:54`), regla global de `animation.css:207-230`, `useSpringPreset` degrada a tween. **[pendiente]** comprobarlo en ejecución con `prefers-reduced-motion` emulado.
- **Asimetría abrir/cerrar [código]:** `Modal`/`Popover` abren en 250 ms y cierran en 150 ms (correcto); `transition-all` solo aparece en `VolumeInspectorModal.tsx:396,427`.

### H-14 · Información · Estado de las pruebas al empezar (no atribuible a esta auditoría)

- `pnpm lint:tokens` → 1 problema (`--text-primary`, ver H-12).
- `vitest run guard` → 17 archivos verdes, **1 en rojo**: `components/chronology/design-series.guard.test.ts:110` espera `<SegmentedControl` en `premium-episode-list.tsx`, pero esa lista ya no tiene filtro de episodios (archivo modificado sin commitear; el guard es un archivo nuevo sin seguimiento). Es desincronización entre dos cambios en curso; no se debe relajar el guardián.

---

## 3. Tabla comparativa de componentes equivalentes

| Familia | Instancias comparadas | Veredicto | Evidencia |
|---|---|---|---|
| Rejilla horizontal de catálogo | Inicio, Series, Películas, Cronología | **Consistente** | [ejecución] contenedor 64–1376 + padding 40 → hero/estantería/secciones en x=104–1336 @1440. |
| Rejilla de fichas de detalle | Serie/Película vs catálogo | **Difiere justificadamente** | Sin riel de eras: contenido 40–1400. |
| Shell Ajustes/Admin | Sidebar + cabecera `sectionbar-minimal` + contenedor 1600 | **Difiere justificadamente** | Guía §4. |
| Selector de modo/filtro | `SegmentedControl` (Películas estado, perfil de audio, origen, hub de Inicio, Ajustes móvil, vista de Cronología) | **Consistente** | [código] mismo componente; [ejecución] 44 px de alto. |
| Riel de eras | Inicio, Películas, Cronología, vistas de Series (`ViewModeTabs`) | **Consistente** (el uso para vistas de Series es una reutilización razonable) | [código]. |
| Buscadores | Barra, Películas, Episodios, Paleta, Escáner, TMDB manual | **Requiere corrección** (barra, Escáner, TMDB, puntuación) / paleta y barra **difieren justificadamente** | H-04. |
| Campos de formulario | OsInput, SecretField, DirectorySelector, Drive, `<select>` nativos, `TextInput` base | **Requiere corrección** | H-03. |
| Menús desplegables | `ChoiceMenu`, `Popover`, `OsSelect`, `<select>` nativo | **Requiere corrección** (duplicado sin motivo) | H-09. |
| Hojas inferiores | MovieCard, sagas, ajustes del reproductor, menú móvil | **Requiere corrección** (4 pieles, blur 24 vs 48 px) | H-09. |
| Diálogos | `Modal` (paleta, explorador, sistema, escáner, maratón, inspector) vs a mano (personaje, Sorpréndeme, cola, atajos) | **Difiere**; foco/Esc presentes en código | [código]; [pendiente] ejecución. |
| Botón principal del hero | Inicio, Películas, Serie | Inicio y Películas **consistentes**; Serie **requiere corrección** | H-05. |
| Botón de icono sobre imagen | `GlassIconButton`/`IconButton glass` | Receta **consistente**; tamaños 32/36/44 según puntero **justificado**; anidar vidrio **requiere corrección** | H-02. |
| Tarjeta de póster | `MoviePosterCard`, `SeriesPosterGridItem`, `SpotlightSagaCard` | **Difiere parcialmente**: estructura distinta (cajón técnico / progreso) justificada; token de borde (`--glass-border-side` vs `--surface-content-border`), escala al presionar (0,95/0,98) y hover (brillo + elevación vs borde) sin razón clara | [código]. Pulido. |
| Fila/tarjeta de lista | Fila de episodio, cinta móvil de Series, cola | **Difiere**; la cinta móvil tiene radios fuera de escala | H-12. |
| Contenedor de sección | `SectionBar` (Ajustes, Admin, Cronología) | **Consistente**, salvo el radio forzado | H-08. |
| Estados vacío/error | `EmptyState`, `LibraryErrorState`, `NotFound`, `AppErrorBoundary`, caja de conexión | **Requiere corrección** | H-06. |
| Esqueletos | `Skeleton` shimmer vs `animate-pulse` | **Difiere justificadamente** (guía) salvo el de Ajustes sobre `.surface-content` | H-13. |
| Encabezado de página | Cronología vs Ajustes/Admin vs sr-only | **Requiere decisión** | H-11. |
| Toasts | Sonner único (`ui/toaster`), importado en 39 archivos | **Consistente** | [código]. |
| Foco visible | Contorno global 2 px | **Consistente** (salvo H-04) | [ejecución]. |
| Controles del reproductor | `PLAYER_*` centralizados (`player-theme.ts`) | **Consistente en código** | [pendiente] ejecución. |

---

## 4. Verificado y sin hallazgo

- Foco con teclado: contorno global visible y con el radio del elemento (barra de navegación, probado con Tab).
- `Button`: tamaños 44 px táctil / 32–36 px con puntero fino; `loading` conserva el ancho; `disabled` correcto.
- `SegmentedControl`: roving tabindex, `min-h-11`, píldora con `layoutId`, degradación sin animación.
- `Modal`/`Popover`: abren en `--duration-base` y cierran en `--duration-fast`; foco inicial en el campo en la paleta; botón de cierre a 16 px del borde.
- Estantería de Series: `listbox`/`option` con roving, `aria-posinset/setsize` y teclado (Flechas/Home/End/Enter) en código — coherente con su semántica.
- Móvil 375: sin desbordamiento horizontal en Inicio, Series, ficha, Películas, Cronología y Admin; objetivos ≥ 44 px salvo los de H-10.
- `transition-all` prácticamente ausente; iconos: `components/ui/icons` son alias de lucide (los 10 archivos que importan lucide directo no cambian el dibujo).

---

## 5. Plan de correcciones (pequeñas y verificables; esperan tu aprobación)

Orden sugerido, de menor a mayor riesgo. Ninguna depende de instalar paquetes. Cada paso se valida con el mismo método usado para medirlo.

| # | Cambio | Archivos | Validación | Riesgo | Depende de |
|---|---|---|---|---|---|
| P-01 | Reservar `4.25rem` en la franja del CTA del hero móvil | `series-hero.tsx:264` | 375×812: `cta.bottom ≤ nav.top` y `elementFromPoint` en el borde inferior = CTA | Bajo | — |
| P-02 | `border border-transparent` en la rama inactiva de los toggles | `floating-pill-nav.tsx:332-338,364-370` | `getBoundingClientRect` 32×32 en ambos estados | Bajo | — |
| P-03 | Definir `--text-primary` o usar `var(--label-1)` | `series-hero.tsx:173`, `$movieId.lazy.tsx:197` | `pnpm --filter kamehouse-web lint:tokens` sin errores | Bajo | — |
| P-04 | Excepción del contorno global para inputs embebidos + contorno en la cápsula (`focus-within`) | `globals.css:170-175`, `expandable-search.tsx:246-255` | Foco en la barra: un solo marco; el de Películas no cambia | Bajo | — |
| P-05 | `NotFound`: un solo control (`Link` con `ButtonAnatomy.root`), sentence-case; quitar `shadow-2xl` de `EmptyState`/`Popover`/overlay | `not-found.tsx`, `empty-state.tsx`, `popover.tsx`, `loading-overlay-with-logo.tsx` | Tab en 404 = 1 parada; sin `nested-interactive`; sombra por token | Bajo | — |
| P-06 | `LoadingOverlayWithLogo`: mostrar fallo solo con `isError && timedOut`; contar desde el montaje | `loading-overlay-with-logo.tsx`, consumidores en Ajustes/GettingStarted + test existente | Test unitario del overlay + Ajustes con caché vacía en ventana visible | Bajo | — |
| P-07 | Campos de Drive y `<select>` sueltos → receta de `OsInput`/`OsSelect`; corregir `TextInput` base | `-google-drive-card.tsx`, `-tmdb-match-manual.tsx`, `server-logs-viewer.tsx`, `input-parts.tsx` | Medir alto/radio en Ajustes › Biblioteca y modal del explorador; tests de `TextInput` | Medio | — |
| P-08 | Placeholders con «…»; escáner y TMDB a pastilla; unificar limpiar | `premium-episode-list.tsx:209`, `scan-file-list.tsx`, `-tmdb-match-manual.tsx` | Comparar alto/radio con Películas | Bajo | P-04 |
| P-09 | `PlayCta` con la receta de `Button primary lg`; verbo único | `play-cta.tsx`, `series-hero.tsx` | Medir 48 px y sentence-case; probar en Neutro y «Por era» | Medio | D3 |
| P-10 | Vidrio apilado: según D1 (contrato) → `intent="secondary"` para botones sobre miniatura en tarjetas con blur; acotar `.surface-content` en listas | `blur.css:377`, `premium-episode-list.tsx:554`, `TimelineVolumeCard.tsx` | **Primero medir** FPS/scroll antes/después en build de producción (`scratch/perf-nav`); luego contar `backdrop-filter` anidados = 0 | Medio-alto | D1, medición |
| P-11 | `ChoiceMenu` sobre `Popover`; receta única de hoja en `VaulContent` | `movies-filter-bar.tsx`, `vaul/index.tsx`, consumidores | Teclado (Esc, flechas, foco de retorno) + comparación de radios/blur | Medio | D4 |
| P-12 | Radios y sombras fuera de escala; duraciones a token por *uso* | `-SeriesSpineRow.tsx`, `chronology/Header.tsx`, los 18 archivos con `duration-*` | `lint:tokens`, `vitest run guard` y comparación visual a 375 | Bajo | — |
| P-13 | Sincronizar la guía con el código (`.sectionbar-pill`, §7 `SettingsFilter`, sidebar `rounded-2xl`, `.surface-content`) | `docs/DESIGN-GUIDE.md` (+ `.agents/skills/design-system`) | Revisión cruzada guía ↔ código | Bajo | D2 |
| P-14 | Resolver el guardián en rojo | `design-series.guard.test.ts` / `premium-episode-list.tsx` | `vitest run guard` verde sin relajar | Bajo | quien tenga el cambio en curso |

### Decisiones que necesito de ti

- **D1** Contrato de `.surface-content`: ¿sin blur en filas repetidas (volver al comentario original de blur.css) o se admite el blur y se actualiza la guía? Afecta H-02.
- **D2** `.sectionbar`: ¿añadir `.sectionbar-pill` y respetar `rounded-3xl`, o actualizar la guía a 24 px?
- **D3** Verbo único para reanudar: ¿«Continuar» o «Reanudar»?
- **D4** ¿Unificar menús y hojas en una sola receta, o conservar el menú propio de Películas?
- **D5** Objetivos de los puntos del hero: ¿ampliar el área clicable o mantenerlos (hay alternativa en el riel)?
- **D6** ¿La ficha de serie conserva mayúsculas/mono en Neutro a propósito?

---

## 6. Limitaciones

- **Panel del navegador oculto** durante casi todo el recorrido: `requestAnimationFrame` pausado → transiciones de entrada/salida de framer se quedan a medias hasta forzar un dibujado (capturas); varias capturas fallaron por «no dibujó». Por eso **no se midieron tiempos, FPS ni curvas reales**; solo valores computados del DOM.
- **Gobernador automático:** tras unos segundos en el panel oculto la app pasó sola a modo plano (`data-flat="true"` por `autoThrottleActive`). Las mediciones de blur de Series, ficha y Cronología se tomaron **antes** de ese cambio (modo con transparencia); las de Ajustes y el modal del explorador, en plano (por eso allí `backdrop-filter` = none).
- Build de **desarrollo** (no producción) y base de datos real de desarrollo (solo lectura; no se tocó progreso ni acciones destructivas).
- Sin emulación de `prefers-reduced-motion`, sin axe ni medición de contraste, sin dispositivo táctil real (se usó emulación móvil con `hover:none`).
- **No ejecutado:** reproductor, modo TV/D-pad, onboarding, Mi Lista, Sorpréndeme, ficha de personaje, inspector de lapso, maratón, 404 y error boundary en vivo, ficha de película, tableta 768, pilares Reproducción y Rendimiento de Ajustes.
- El árbol de trabajo tiene ≈ 800 cambios sin commitear de otras sesiones; las líneas pueden moverse.
- No hay `AGENTS.md`; se usaron la guía y las reglas de `.agents/`.

---

## 7. Estado del plan (2026-10-23, tras la aprobación de P-01 a P-06 y P-12)

Aplicados sin commit. Validación: `lint:tokens` ✔ (1718 clases, 399 variables), `eslint` limpio en los archivos tocados, `vitest run` 158/159 archivos (el único rojo es el guardián previo de H-14), `tsc` con 3 errores previos en `routes/chronology/index.lazy.tsx` (variables sin usar de otro cambio en curso, no tocado).

| Paso | Resultado medido en ejecución |
|---|---|
| P-01 | 375×812: CTA y=700–744, barra y=744–800 → sin solape; `elementFromPoint` en el borde inferior = CTA. Queda pegado a la barra (0 px de aire). |
| P-02 | Los tres botones de la pastilla miden 34×34 en todos los estados (activo e inactivo probado con «Música», revertida) y la pastilla 136×48 no cambia. «Sorpréndeme» pasó de 32 a 34 para igualarlos. |
| P-03 | `lint:tokens` sin errores; el badge sin era usa `var(--label-1)`. |
| P-04 | Input con `outline: none`; la cápsula dibuja `solid 2px rgba(255,255,255,.9)` offset 2 px con radio completo. Un solo marco. |
| P-05 | 404: un solo elemento enfocable (`<a>` 141×48, pastilla), título «Página no encontrada», sin `<a><button>`. `shadow-2xl` ×3 → `shadow-elevation-3` (EmptyState, caja de conexión) y `shadow-elevation-4` (Popover). |
| P-06 | `showFailure = timedOut && Boolean(isError)`; test nuevo «no declara Sin conexión si no hay error». El overlay raíz sigue contando desde el arranque (necesario porque se remonta). |
| P-12 | Cintas móviles de Series: li, botón, velo y recorte a 20 px (`rounded-xl`); sombra abierta `shadow-elevation-3`; insignia del encabezado de Cronología 40/20 px exterior y 36/20 px interior (concéntricas). Duraciones a token: cintas de Series ×4 (`duration-base ease-smooth-out`), banner de Drive, pestaña del escáner, zoom de «Continuar viendo» (`duration-slow ease-smooth-out`). |

**No tocado dentro de P-12, a propósito** (sin token por uso o ya afinado en pasadas anteriores): barridos de brillo y fundidos de hero a 700 ms, expansiones de ancho por hover (hub de Inicio, filas y rejilla de Películas, tarjeta de arco), apertura del reproductor (300 ms), aparición de ítems del escáner y reveal de reproducir en la fila de episodios (200 ms), y la mezcla framer + CSS de `random-play-button.tsx`. Tampoco `transition-all` de `VolumeInspectorModal.tsx:396,427` ni la escala de color de las insignias de era en `chronology/Header.tsx` (necesitan un token).


## 8. Continuación P-07 y P-08 (2026-10-23)

Aplicados sin commit tras la indicación «seguí». Se conservaron las decisiones D1–D6 pendientes.

- **P-07:** `InputAnatomy` usa pastilla, altura base de 44 px, texto/superficie por tokens y sin blur propio. Los tres campos de Drive reutilizan esa receta; mantienen sus valores, tipos y handlers. Los addons conservan la unión recta junto al input y redondean el extremo exterior. Los selectores nativos de TMDB y registros conservan su comportamiento nativo y adoptan pastilla, tokens y altura de 44 px. Se eligió esta adaptación mínima porque `OsSelect` incluye una fila completa de Ajustes y no encaja directamente en estas barras de herramientas. La unificación del popup queda fuera de esta continuación.
- **Foco relacionado con P-04:** `OsInput` y el input embebido de `DirectorySelector` llevan `data-field-embedded`; la cápsula dibuja el contorno con `has-[input:focus-visible]`. Se elimina el padding/borde nativo del input interior de `OsInput` para mantener la cápsula a 44 px.
- **P-08:** placeholders de episodios con «…»; buscadores de escáner y TMDB con pastilla y limpieza accesible mediante `IconButton`, `type="button"` y retorno de foco al campo. Escáner conserva `type="search"`, con limpieza propia, altura fija de 44 px y sin salto al aparecer el botón.

### Validación de esta continuación

- ESLint limpio en los ocho archivos modificados; `git diff --check` sin errores.
- `lint:tokens`: 1712 clases y 399 variables, sin errores.
- 17 pruebas focalizadas verdes en 5 archivos: TextInput, ServerLogsViewer, OsToggle y guardianes de Ajustes (ruta y pestañas). No se volvió a ejecutar la suite completa.
- `typecheck` mantiene los tres errores previos TS6133 de Cronología: `YearScale`, `yearScaleAccents`, `handleJumpToScaleVolume`. No hubo otros errores.
- **Navegador, componentes reales en una página temporal aislada**, con CSS y tokens de la app: TextInput, receta compartida de Drive/select, DirtyOsInput, DirectorySelector y ScanFileList. No se levantó el backend ni se tocaron datos de la biblioteca.
- Medido: campo base, receta Drive y select a 44 px, radio 9999 px, sin backdrop-filter. Cápsula OsInput a 44 px tras retirar padding/borde del input interior. A 375×812, ancho del documento 375 px (sin desbordamiento) y fuentes de inputs a 16 px.
- Foco de teclado: en OsInput y DirectorySelector, input sin outline y una sola cápsula exterior con outline sólido de 2 px. Escáner: búsqueda «Dragon» reduce dos filas a una; limpiar vacía el campo, restaura dos filas tras el render diferido y devuelve el foco al input. Cápsula de 44 px con y sin botón.
- **Limitaciones:** verificación aislada, no las pantallas completas de Ajustes, Drive, TMDB y Administración. El ancho móvil no emula puntero grueso ni iOS; popup nativo en WebView2, temas completos y reduced-motion pendientes. No se midió rendimiento.
- Se cerró la página y se detuvo el servidor temporal en :43214; se eliminaron sus fuentes temporales.

Pendientes: P-09 (D3), P-10 (D1 y medición), P-11 (D4), P-13 (D2) y P-14 (sincronización del cambio de episodios en curso); D5 y D6 tampoco se resolvieron.


## 9. Decisiones y cierre de implementación (2026-10-23)

El usuario delegó las decisiones restantes con «seguí vos». P-09, P-10, P-11, P-13 y P-14 están aplicados sin commit. Las secciones anteriores conservan la evidencia histórica; este apartado describe el estado actual.

| Decisión | Implementación elegida |
|---|---|
| D1 / P-10 | Filas repetidas sin blur mediante `.surface-content.surface-content-row`: episodios, skeleton de Ajustes y contenido interno repetido de Cronología. Se conserva el aspecto de los paneles individuales. Solo la tarjeta resaltada de Cronología lleva `.sectionbar`; las otras expandidas usan superficie de fila. Controles internos `secondary` y badges sin blur en Cronología y Continuar viendo. |
| D2 / P-13 | Radio por defecto de SectionBar: 24 px (`rounded-2xl`), con `.sectionbar-pill` explícita y `.sectionbar.rounded-3xl` que respeta el token de 28 px. SaveBar usa la variante pill. SegmentedControl ya usa `glass-frosted-pill`; se corrigió esa referencia en la guía. |
| D3 / P-09 | «Reproducir» inicia; «Continuar» retoma en la ficha de serie, su hero contraído y Continuar viendo. PlayCta usa `ButtonAnatomy.root({ intent: "primary", size: "lg" })`, conserva ripple y reserva de ancho, con brillo según `on-primary`. |
| D4 / P-11 | Menús de Películas sobre Popover compartido, selección enfocada al abrir, flechas/Home/End, Escape y retorno al disparador. VaulContent centraliza `surface="glass"` (24 px, tokens SectionBar, velo sin blur) y `surface="solid"` (reproductor), radio superior 24 px y padding inferior con safe area. Las hojas enfocan su contenido al abrir por defecto, con opción de override. |
| D5 | Áreas reales de 44×44 px para puntos y pausa del hero, sin pseudoelementos clicables que se superpongan entre vecinos; ventana móvil de cinco puntos. |
| D6 | Ficha de serie con `neutro-sentence`, siguiendo el comportamiento de los catálogos en Neutro. Arte y encuadres conservados. |
| P-14 | Guardián sincronizado con los selectores reales de audio y origen: exige SegmentedControl, radiogroup e inset en ambos, además de la búsqueda accesible de episodios. Conserva las prohibiciones de controles legacy; no reintroduce un filtro retirado ni omite pruebas. |

Guía y skill `design-system` actualizadas: Ajustes navega por cinco pilares y no monta `SettingsFilter`; la API opcional `SectionBar.searchQuery` sigue disponible.

### Evidencia de esta continuación

- **Suite completa:** 160 archivos y 1263 pruebas verdes (incluye dos pruebas nuevas del menú real: foco inicial, Home/flechas, selección, Escape y retorno de foco). El guardián antes rojo pasa. Se conservan avisos de tests existentes sobre RouterProvider y act; no son fallos.
- **ESLint:** limpio en los archivos de esta continuación. **Tokens:** 1700 clases y 399 variables verificadas, cero errores. `git diff --check` sin errores.
- **TypeScript:** únicamente los tres TS6133 previos de `routes/chronology/index.lazy.tsx`: YearScale, yearScaleAccents y handleJumpToScaleVolume. No se eliminó ese trabajo en curso. El build completo de la app mediante `pnpm build` sigue bloqueado por ellos.
- **Build de producción aislado:** Rsbuild compiló los componentes reales de CTA, hero, filtros, hojas y tarjetas de Cronología con CSS/tokens del proyecto. No se arrancó el backend ni se modificó la biblioteca.
- **CTA:** altura CSS de 48 px; ancho intrínseco estable de aproximadamente 146,3 px en ambos textos. Sentence-case. Con los atributos de tema reales: Neutro blanco con texto oscuro; era DBZ amarillo con texto oscuro. Esto verifica el consumo de tokens, no toda la aplicación de preferencias de la app.
- **Menú:** en navegador, Home → primera opción, ArrowDown → segunda; Enter selecciona «Alfabético Z – A», cierra y devuelve el foco al disparador. Escape/retorno también cubiertos por pruebas unitarias.
- **Hojas:** glass `blur(24px) saturate(1.9)`, radio superior de 24 px, padding inferior 32 px con inset cero y velo sin blur. Variante sólida: backdrop-filter none. Foco inicial en el botón interior «Cerrar hoja».
- **Cronología real:** dos tarjetas expandidas montadas con datos SPAN_VOLUMES; resaltada con blur de 24 px, otra sin blur; cero descendientes con backdrop-filter en ambas, incluyendo el panel de detalles. Flat deja ambas sin blur.
- **Radios:** SectionBar grande a 28 px y pill a 9999 px.
- **Ancho móvil:** documento y viewport CSS de aproximadamente 375 px, sin desbordamiento; seis controles visibles de carrusel (pausa y cinco puntos) de aproximadamente 44×44 px. La app del navegador tenía escala 0,9: se ajustó el viewport de la herramienta para medir el ancho CSS real, no solo el tamaño de la captura.

### Medición de vidrio y límites

Antes de cambiar P-10 se comparó un **banco sintético en producción** de 24 filas con la receta de contenido y botones reales. Scroll programado por requestAnimationFrame durante dos segundos, pestaña visible y con foco. Base: 326 intervalos, p50/p95 de 6,1/6,1 ms y 24 controles con blur anidado. Propuesta sólida: 331 intervalos, p50/p95 de 6,1/6,1 ms y cero blurs de fila/controles. **No se detectó mejora de cadencia**; esta corrección aplica el contrato de superficies y elimina capas anidadas, no demuestra una optimización de FPS en la app.

Quedan pendientes: A/B de scroll en las rutas completas con datos reales, composición completa de los heroes tras ampliar los indicadores, dispositivo táctil real, WebView2/Tauri, safe area no nula y emulación de reduced-motion. Se comprobaron geometría/estilos y teclado en componentes aislados; no se atribuye a eso una validación integral de las pantallas. Las capturas del navegador fallaron al final, por lo que las mediciones se apoyan en DOM/estilos computados, no en imágenes finales.

Se cerró la página y se detuvo el servidor temporal :43214; sus fuentes y build temporales se retiraron. No quedan decisiones D1–D6 esperando respuesta, ni cambios de este plan por implementar. La validación integral indicada arriba sigue pendiente.
