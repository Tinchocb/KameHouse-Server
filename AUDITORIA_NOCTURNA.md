# Auditoría nocturna — KameHouse (24/09/2026)

Rama: `auditoria-nocturna-2026-09-24` (creada desde `rio-grande`). **Sin commits**: todo quedó como cambios sin commitear.
Horario de la sesión: 22:59 a 01:50 (corte por límite de uso) y 09:00 a 10:00 del 24/09, con tu extensión (−03:00). KameHouse TV quedó fuera de alcance y no se tocó.

## 1. Resumen

La base estaba sana: compilaban y pasaban Go, TypeScript, ESLint, Vitest y `cargo check`. Recorriendo la app en el navegador aparecieron **cinco bugs reales**, y los cinco quedaron corregidos y con tests:

1. **Abrir una serie tardaba ~10 s** en cada visita. Jikan está caído (504) y cada apertura hacía 3 reintentos con backoff. Además, el caché de TMDB nunca acertaba por una clave mal escrita.
2. **El guardado del historial en la base fallaba siempre** por un índice heredado, y un latido vacío (0/0) podía **resetear a 0 el progreso real** que ve la UI (el filecache de `continuity`) al abrir un episodio que no llega a cargar.
3. **Los botones del hero de Películas no respondían** ("Ver película", "Cola", "Detalles") por `pointer-events: none` heredado.
4. **Reproductor**: si el archivo no existe, esperaba 30 s y mostraba un mensaje engañoso ("verificá la conexión").
5. **Paleta del hero**: fallaba por CORS al reutilizar imágenes de TMDB cacheadas sin CORS.

A mitad de la noche pediste no hacer cambios bruscos en la estructura de Inicio, Series y Películas (estantería, hero, etc.), pero sí mejorar y optimizar lo existente. Eso fue lo que hice: ningún cambio de estructura ni de estilo; solo bugs, consistencia y optimizaciones (ver "Segunda tanda"). La estantería de Series quedó intacta.

## 2. Cambios hechos

### Funcionalidad (bugs)

| Archivo | Qué | Por qué |
|---|---|---|
| `apps/server/internal/api/metadata_provider/tmdb_impl.go` | La escritura del caché persistente usa `tmdbID`, la misma clave que la lectura (antes usaba el ID interno). | El caché en DB nunca acertaba y cada serie volvía a descargar todas sus temporadas de TMDB. |
| `apps/server/internal/api/metadata_provider/jikan_impl.go`, `anilist_impl.go` | Una sola instancia TMDB de fallback (`sync.Once`) en lugar de una nueva por llamada. | Crear una instancia por llamada tiraba el caché en memoria. |
| `apps/server/internal/api/jikan/client.go` | Nuevo `jikan.ErrUnavailable` cuando se agotan los reintentos. | Distingue "Jikan caído" de "no encontrado". |
| `apps/server/internal/api/metadata_provider/jikan_impl.go` | Caché de fallos: un ID que falló no se reintenta por 5 min, y si Jikan entero está caído se saltea para todos los IDs por 5 min. `ClearCache` lo resetea. | **Medido**: la apertura de series pasó de ~10,5 s a ~20 ms; solo la primera consulta cada 5 min paga la espera. El resultado es el mismo que antes (cuando Jikan falla, la entrada ya se armaba sin sus datos). |
| `apps/server/internal/database/db/db.go` | La migración verifica con `PRAGMA index_info` que `idx_media_episode` cubra `(account_id, media_id, episode_number)`; si no, lo borra y lo recrea. Se agregó el helper `indexHasColumns`. | Tu base tenía un `idx_media_episode` viejo sobre `library_media_id`. Con el mismo nombre, el `CREATE ... IF NOT EXISTS` no hacía nada y **cada volcado de telemetría a `watch_histories` fallaba** ("ON CONFLICT clause does not match…"). Aclaración: la UI ("continuar viendo", progreso por episodio) lee del filecache de `continuity`, que sí funcionaba; la tabla es una copia secundaria. Verificado en tu base: índice corregido y las 170 filas intactas. |
| `apps/server/internal/handlers/playback_sync.go` | `validPlaybackBeat` descarta el latido vacío (`currentTime=0` y `duration=0`). | Ese latido llegaba también a `continuity.Manager` (lo que ve la UI): **abrir un episodio que no llega a cargar reseteaba a 0 el progreso guardado** de ese episodio. `duration=0` con tiempo mayor a 0 se sigue aceptando (duración desconocida). |
| `apps/web/src/components/video/player-orchestrator.tsx`, `player-core.ts`, `player-core.types.ts`, `usePlayerHls.ts`, `apps/web/src/api/hooks/mediastream.hooks.ts` | El error HTTP de `mediastream/request` llega hasta el reproductor y se muestra al instante con un mensaje claro (404: "No encontramos el archivo de este episodio. Revisá que el disco o la carpeta de tu biblioteca estén conectados."; también cubre 403 y 503). Se silenció el toast genérico de esa query. | Antes, un 404 inmediato terminaba en un spinner de 30 s y "Transmisión caída (timeout 30s)". |
| `apps/web/src/routes/movies/-components/movies-hero.tsx` | `pointer-events-auto` en la fila de acciones del hero. | El contenedor tenía `pointer-events-none` y los botones lo heredaban: **no respondían a clics**. |
| `apps/web/src/lib/helpers/images.ts` (+ `use-image-palette.ts`, `use-dominant-colors.ts`) | Nuevo `getPixelSampleImage`: para leer píxeles pide w300 de TMDB con `?kh-cors=1`. | TMDB solo manda `Access-Control-Allow-Origin` si la petición trae `Origin`, y no manda `Vary`. El navegador reutilizaba la copia cacheada sin CORS y bloqueaba la paleta. Además, w300 descarga mucho menos que el w1280 que se usaba. |

### Consistencia

| Archivo | Qué |
|---|---|
| `apps/web/src/routes/movies/$movieId.lazy.tsx` | El título del detalle usa `getEntryTitle`, la misma regla que el hero y las tarjetas. Antes "100 Años Después" pasaba a "La Legendaria Esfera de Cuatro Estrellas" al abrir el detalle. |
| `apps/web/src/lib/helpers/media.ts` (+ `expandable-search.tsx`, `movies-hero.tsx`) | Nuevo `getFormatLabel`: los formatos MOVIE, TV, OVA… se muestran en español. Antes el hero de Películas y la búsqueda decían "MOVIE". |
| `apps/web/src/routes/series/index.lazy.tsx` | La grilla de portadas usa el mismo número "VOL. N" canónico que la estantería. Antes Super era VOL. 5 en la estantería y VOL. 4 en la grilla. |
| `apps/web/src/components/ui/app-layout/floating-pill-nav.tsx` | `aria-label` "Navegación Cinejoy flotante" pasa a "Navegación flotante de KameHouse" (marca equivocada). |
| 6 archivos (`floating-pill-nav`, `expandable-search`, `GlossaryDrawer`, `PosterCard`, `TimelineMasterView`, `-dragonball-scanner-live`) | La clase inválida `py-0.2` (Tailwind no la genera) pasa a `py-px`. |
| `apps/server/codegen/generated/*.json` | Regenerado. Solo había deriva en metadata interna; los tipos TS no cambian. |

### Refactor / calidad

| Archivo | Qué |
|---|---|
| `apps/server/internal/handlers/trace_middleware.go` | WebSocket, SSE y streaming de video ya no se loguean como "Slow request". Tapaban las lentitudes reales; de hecho escondían la de Jikan. |
| Archivos Go tocados | `gofmt` aplicado (tenían espacios y alineación fuera de formato). |

### Pulido visual (acotado, por tu pedido)

| Archivo | Qué |
|---|---|
| `apps/web/src/routes/series/$seriesId/-components/premium-episode-list.tsx` | La sinopsis de los episodios ahora se corta en 2 líneas con elipsis. Ya tenía `line-clamp-2`, pero `block` lo anulaba y las tarjetas quedaban de alturas dispares. |
| `apps/web/src/components/ui/app-layout/expandable-search.tsx` | El desplegable de búsqueda tiene fondo opaco (`bg-bg-secondary`). Antes se leía el texto de atrás a través de los resultados (ver pendiente 1). |
| `apps/web/src/routes/settings/components.tsx` | En Ajustes → Biblioteca, cada carpeta muestra "No encontrada" en ámbar si no existe en disco, y el botón de borrar tiene `aria-label`. |

### Segunda tanda (tras tu pedido: mejorar sin tocar la estructura)

| Archivo | Qué | Por qué |
|---|---|---|
| `apps/web/src/lib/config/hero-stage.ts` | En desktop, el alto del stage de los heroes (Inicio, Películas, estantería de Series) se topa con lo que entra en pantalla: `lg:max-h-[max(682px,min(748px,calc(100dvh-218px)))]`. Nunca baja del `min-h` de 682 px, que el código pide respetar. | En pantallas de ~900 px de alto, el 1.85:1 daba 735 px y el botón "Reproducir" quedaba debajo del dock fijo (aleatorio/maratón/audio). **Medido a 1440×900**: el botón pasó de y 834–876 (tapado, el dock empieza en 832) a y 781–823. Desde ~1080 px de alto no cambia nada. |
| `apps/web/src/components/ui/shimmer-skeleton.tsx` | El skeleton del hero usa `HERO_STAGE_CLASS` en lugar de una copia de la cadena. | Así el skeleton no se desincroniza del hero real ni produce saltos de layout al cargar. |
| `apps/web/src/components/ui/spotlight/spotlight-hero.tsx` | Crossfade del carrusel "por encima": la capa entrante va arriba (`z-index 1`) y la saliente queda opaca debajo hasta que la nueva termina de entrar. Mismos tiempos y mismo desplazamiento lateral. | Antes las dos se desvanecían a la vez (0,35 s entrante y 0,25 s saliente) y a mitad de camino se veía el fondo negro: el "parpadeo" de cada rotación. **Verificado por código y por inspección del estado de las capas; no pude medir la animación en vivo** porque el panel del navegador quedaba en segundo plano (framer-motion no anima en documentos ocultos). |
| `apps/web/src/routes/movies/-components/movies-hero.tsx` | El mismo crossfade "por encima" en el hero de Películas. | Ahí era peor: 0,7 s entrante y 0,3 s saliente, o sea ~0,4 s de negro en cada cambio. |
| `apps/web/index.html` | Se mantiene el `preload` de `db.webp` (primer hero de Inicio); las otras 5 eras pasan a `prefetch`. | Eran ~1 MB precargado con prioridad en **todas** las rutas, que competía con la carga inicial y llenaba la consola de avisos "preload sin usar". Con `prefetch` se bajan igual cuando el navegador está libre y quedan en caché para el carrusel. Verificado: se descargan y no hay avisos nuevos. |
| `movies-filter-bar.tsx`, `components/chronology/Header.tsx`, `premium-episode-list.tsx` | `z-10` en la lupa de los buscadores (y tamaño explícito en la de episodios). | El input con `backdrop-blur` crea su propio contexto de apilamiento y se pintaba encima del ícono: la lupa no se veía o quedaba desalineada. |

### Tercera tanda: sistema de diseño (tokens)

Pediste seguir con los tokens de diseño. El foco fue una familia de bugs silenciosos: **clases y variables que el código usa pero que nunca generan estilo**, así que el diseño que se escribió no se ve. Para encontrarlas armé un verificador que ahora queda en el repo como **`npm run lint:tokens`** (`apps/web/scripts/check-tokens.mjs`). Compara las ~2.160 clases usadas en el código contra lo que Tailwind realmente genera y contra el CSS propio, busca `var(--x)` sin definir y detecta el patrón inválido `var(--x)HH`. Hoy pasa limpio ("✔ Tokens OK") y sale con código 1 si aparece un caso nuevo; lo probé metiendo clases rotas a propósito.

| Archivo | Qué | Por qué |
|---|---|---|
| `tailwind.config.ts` | Helper `withAlpha()`: los tokens MD3 `surface`, `surface-container(-lowest/-low/-high/-highest)`, `surface-variant`, `outline` y `outline-variant` aceptan el modificador de opacidad vía `color-mix(... <alpha-value> ...)`. Sin modificador, el color es idéntico al de antes. | Con un `var()` pelado, Tailwind 3 **no genera** `bg-x/60`: había **~150 clases muertas** (29 de `surface-container-lowest` y 123 del resto). Entre ellas: el pulgar de las barras de scroll (`bg-outline-variant/40`, era invisible), los *hover* de botones y del nav, el fondo de los *drawers* móviles, el riel de la barra de progreso de la estantería y el vidrio de las píldoras del nav. |
| `src/styles/tokens/colors.css` | Nuevo `--md-sys-color-surface-container-lowest` (opaco, derivado de `--bg-primary`, así sigue a cada tema) y `--brand-warning` (`38 92% 50%`). | Se usaban sin estar definidos: `brand-warning` (9 usos) y `.badge-warning` resolvían a un color inválido. |
| `src/styles/tokens/blur.css` | `--blur-overlay-xs` (8 px, y 0 en modo plano). | Tenía utilidad en Tailwind pero no tenía valor. |
| `tailwind.config.ts` | Tokens que el código ya usaba y no existían: espaciados `4.5`, `6.5` y `34`; escalas `102` y `115`; `animate-pulse-slow`; `font-kanji` (mincho del sistema, sin descargas). | Por ejemplo, el ícono de la `sectionbar` ("Sagas & Arcos" en Inicio) usaba `h-6.5 w-6.5` y quedaba sin tamaño; los estados vacíos usaban `animate-pulse-slow` sin efecto. |
| `src/components/ui/button/button.tsx` | La variante `secondary` usa `surface-container-high` / `on-surface`. | Usaba `secondary-container`, que no existe: **todo botón "secondary" se veía sin fondo**. |
| `vaul/index.tsx`, `popover.tsx`, `GlossaryDrawer.tsx`, `-dragonball-scanner-live.tsx` | `z-50` pasa a los tokens de capa (`z-overlay`, `z-modal`, `z-popover`). | El nav está en `z-navbar` (500) y la barra móvil en 700: los *drawers* móviles, los popovers, el glosario y el modal del escáner **quedaban debajo del nav**. |
| `vaul/index.tsx`, `loading-overlay.tsx` | `bg-[var(--background)]` pasa a `bg-[hsl(var(--background))]`. | `--background` es un triplete HSL; usado crudo da un color inválido (fondo transparente). |
| 7 archivos de `components/chronology/` | `var(--acento)20` pasa a `color-mix(in srgb, var(--acento) 13%, transparent)` (17 casos). | Pegarle alfa hexadecimal a un `var()` es CSS inválido e invalidaba fondos, bordes y gradientes completos de la Cronología. Verificado en el navegador: ahora resuelven a colores válidos. |
| `VolumeInspectorModal.tsx` | `var(--surface-container-low(est))` pasa a `var(--md-sys-color-...)`. | Faltaba el prefijo del token. |
| `apps/web/scripts/check-tokens.mjs`, `apps/web/package.json` | Nuevo script `lint:tokens` (sin dependencias nuevas: usa el Tailwind ya instalado). | Para que esta familia de bugs no vuelva; conviene sumarlo a CI junto a `lint`. |
| Varios | Clases inexistentes pasan a su equivalente: `shadow-xs` → `shadow-sm`, `text-md` → `text-base`, `duration-quick` → `duration-fast`, `will-change-opacity` → `will-change-[opacity]`, `xs:` → `min-[480px]:`, `font-bebas` → `font-display`, `font-cinzel` → `font-serif`, `font-inherit` → `[font:inherit]`, `ease-bounce` → `ease-bounce-spring`, `text-on-success` → `text-white`, `bg-surface-dim` → `bg-bg-primary`; se quitaron `justify-auto` y `via-brand-tertiary`. | Ninguna generaba estilo. |

**Accesibilidad de teclado** (`src/app/globals.css`): una regla global con `!important` apagaba el outline y los rings también en `:focus-visible`, así que **navegar con Tab no mostraba en ninguna pantalla dónde estaba el foco** (y anulaba cada `focus-visible:ring-*` del código). Ahora:
- con mouse no cambia nada (`:focus:not(:focus-visible)` sigue sin contorno);
- con teclado hay un único anillo de 2 px con el acento de la era (`--focus-ring`), que sigue el `border-radius`;
- se excluyen los campos de texto (su feedback es el caret y el borde), los contenedores con `tabindex="-1"` que Radix enfoca por código y el modo TV, que ya tiene su propio estilo.

Verificado en el navegador: con Tab, el botón enfocado muestra `outline: 2px solid` naranja; con clic, sin contorno.

**Navegación por teclado** (Tab + Enter/Espacio) en elementos que solo respondían al mouse: tarjetas de saga de Inicio (`spotlight-saga-card.tsx`), tarjetas de película de Inicio y Películas (`movie-poster-card.tsx`, cuyo `onFocus` antes nunca se disparaba), volúmenes de la Cronología (`TimelineMasterView.tsx`) y fichas de serie del escáner. Llevan `role="button"`, `tabIndex`, `aria-label` y la tecla solo actúa si el foco está en la tarjeta misma (Enter sobre el botón "Reproducir" interno no navega). Verificado: Enter sobre una tarjeta de saga navega a `/series/12609?saga=pilaf`.

Verificado: `prefers-reduced-motion` ya estaba bien cubierto (regla global en `animation.css` y `MotionConfig reducedMotion="user"`).

### Cuarta tanda (09:00–10:00, con tu extensión)

| Archivo | Qué | Por qué |
|---|---|---|
| `player-overlays.tsx`, `player-orchestrator.tsx` | Nueva constante `STREAM_FILE_MISSING_MSG`; si el error es "archivo no encontrado", el overlay se titula **"Archivo no disponible"** en lugar de "Transmisión caída". Con test. | El título anterior sugería un problema de red cuando en realidad falta el archivo. |
| `rsbuild.config.ts` | Se quitó un `manualChunks` que Rsbuild no soporta (se ignoraba en silencio; la división por ruta ya la hace TanStack Router). `sourceMap` pasa al formato válido `{ js, css }` y `preload: false` a `undefined`. | Eran los errores de `tsconfig.node.json`. El valor `"hidden"` tampoco era válido: **producción nunca generó source maps**, y se mantiene así a propósito (no cambia lo que se publica); el modo `RSDOCTOR` recupera sus maps en línea. Verificado: mismo tamaño de build y sin `.map`. |
| `tailwind.config.ts` | Se quitó un `@ts-expect-error` que ya no hacía falta. | Ídem. |
| `TimelineMasterView.tsx` | Se quitaron dos `eslint-disable` que quedaron sobrando tras agregar soporte de teclado. | Eran las 2 advertencias de `eslint`. |
| `apps/server/internal/api/jikan/client.go` (+ `client_retry_test.go`) | Ante 5xx se hacen 2 intentos (antes 3) y ya no se duerme el backoff después del último intento (antes se esperaban 4 s de más). Red y 429 mantienen 3 intentos. URL base configurable para tests. | **Medido**: la primera apertura de una serie tras arrancar el server bajó de ~10,6 s a **3,2 s** con Jikan caído. 3 tests nuevos con servidor HTTP de prueba. |

### Quinta tanda: consistencia del diseño sin cambiar la estructura (09:35–10:00)

Criterio: pasar valores escritos a mano a los tokens del sistema **solo cuando el resultado es idéntico** (con una excepción que se descubrió después; ver `shadow-brand-primary` abajo). El objetivo es que la próxima vez que se ajuste un token, se ajuste en todos lados.

| Archivo | Qué | Por qué |
|---|---|---|
| `tailwind.config.ts` | Nueva escala de micro-tipografía: `text-2xs` (11 px), `text-3xs` (10 px), `text-4xs` (9 px), `text-5xs` (8 px). Solo `font-size`, igual que los arbitrarios que reemplaza. | Era el valor suelto más repetido de la app: **454 usos** de `text-[8px]`…`text-[11px]` en 73 archivos (metadata, badges, overlines, chips). |
| 73 archivos de `src/` + `globals.css` (`.sectionbar-header-desc`) | `text-[11px]` → `text-2xs`, `text-[10px]` → `text-3xs`, `text-[9px]` → `text-4xs`, `text-[8px]` → `text-5xs`. | Ídem. Verificado con el CLI de Tailwind (mismo CSS generado) y en vivo en Inicio: los elementos dan 11 px / 10 px; los que dan 12 px son los que tienen `sm:text-xs`, como antes. |
| `src/components/ui/core/styling.ts` (+ `styling.test.ts` nuevo) | Los 4 tamaños se registran en tailwind-merge. | Sin esto, `cn()` los tomaba por **color de texto** y un `text-white` posterior los borraba en silencio (el mismo bug que ya había pasado con las tabs de /series). El test lo cubre. |
| 14 archivos | `shadow-[var(--shadow-brand-primary)]` → `shadow-brand-primary` (9) y `bg-[var(--bg-primary)]` → `bg-bg-primary` (8). | Existían los tokens. `bg-bg-primary` da el mismo CSS. **Corrección**: la sombra *no* era idéntica. Tailwind toma `shadow-[var(--x)]` por un color de sombra y no pintaba nada, así que esos 9 CTA (estados vacíos y de error, "Volver al inicio"…) **ahora muestran el glow** de la era que el código pedía ("pill canónico… shadow-brand-primary"). El caso con opacidad (`bg-[var(--bg-primary)]/70`) quedó como estaba porque el token no admite ese modificador. |
| `checkbox.tsx` | `rounded-[--radius-md]` → `rounded-md`. | Mismo radio, vía el token. |
| `scripts/check-tokens.mjs` | `lint:tokens` ahora también **rechaza** los arbitrarios que ya tienen token (`text-[10px]`, `tracking-[0.2em]`, `shadow-[var(--shadow-brand-primary)]`…) e indica el reemplazo. | Para que no vuelvan a aparecer. Probado con un archivo de prueba: los detecta y respeta el caso con `/70`. |

**Revisado y no tocado a propósito**:
- **~320 usos de la paleta cruda `zinc`/`neutral`** (`text-zinc-400`, `bg-zinc-950/40`…). En el **reproductor** está bien así: sobre un video conviene un gris neutro que no se tiña con la era. En la **Cronología** es una decisión de producto (¿identidad propia o igual al resto?); si se decide unificar, son ~150 usos a pasar a `on-surface-variant` / `surface-*`.
- `rounded-[10px]` en el header de la Cronología y `z-[9997]` de la pantalla de carga: casos únicos, no justifican tokens.

### Sexta tanda: brillo del vidrio (tokens de sombra)

| Archivo | Qué | Por qué |
|---|---|---|
| `src/styles/tokens/shadows.css`, `tailwind.config.ts` | Nuevos tokens `--glass-highlight-{sm,md,lg}` (borde de luz de 1 px con blanco al 10 %, 20 % y 30 %) y sus clases `shadow-glass-highlight-*`. El color va en su propia variable (`--glass-highlight-md-color`) para que Tailwind pueda teñirlo. | El mismo brillo estaba escrito a mano con **8 intensidades** (0.07, 0.08, 0.1, 0.12, 0.15, 0.2, 0.25, 0.3). |
| 43 archivos | **72 brillos** pasan al token: 0.07–0.12 → `sm`, 0.15–0.2 → `md`, 0.25–0.3 → `lg`. Si el brillo está solo, queda `shadow-glass-highlight-md`; si va junto a una sombra de caída, `shadow-[shadow:var(--glass-highlight-md),0_8px_24px_…]` (la sombra de caída no se tocó). `--sectionbar-shadow(-strong)` también usa el token. | **Es un cambio visual mínimo a propósito**: los que estaban en 0.07/0.08/0.12, 0.15 y 0.25 se mueven hasta 5 puntos de opacidad en una línea de 1 px. Verificado en vivo en Inicio (pills y CTA del hero): `rgba(255,255,255,0.3) 0 1px 1px inset` + la sombra de caída original. |
| (sin tocar) | Brillos de otro tipo: los fuertes de botones blancos (0.45–1), los de color (esmeralda, rojo), los oscuros, los de blur 0 y el de `expandable-search`, que framer-motion anima entre dos valores. | Cumplen otra función. |
| `src/components/ui/core/styling.ts` (+ test) | Los tokens de sombra (`elevation-*`, `brand-*`, `glass-highlight-*`, `modal`…) se registran en tailwind-merge. | **Bug previo**: `shadow-brand-primary` se llama igual que el color `brand-primary`. `cn()` lo tomaba por color y no descartaba el `shadow-sm` base de `Button`, así que el CTA mostraba una sombra de 1 px teñida en lugar del glow. Verificado en la página 404: antes `rgb(255,109,56) 0 1px 2px`, ahora `0 8px 24px -4px` naranja al 20 % (el token). Límite documentado en el código: dentro de un mismo `cn()`, `shadow-md shadow-brand-x/20` perdería el `shadow-md` (hoy no hay ningún caso). |
| `scripts/check-tokens.mjs` | Dos reglas nuevas: (1) rechaza el brillo escrito a mano e indica el token; (2) rechaza `shadow-[var(--x)…]` sin el hint `shadow:`. | La (2) es la familia de bug que dejó invisibles los 9 CTA: la clase **se genera** pero como color, por eso el chequeo de "clases muertas" no la veía. |

Las ~120 sombras arbitrarias restantes son sombras de caída muy variadas (tamaño, desplazamiento, opacidad); unificarlas sí cambiaría el look de cada componente, así que no las toqué.

### Tests nuevos

- `metadata_provider/jikan_failure_cache_test.go`: caché de fallos y su reset.
- `database/db/watch_history_index_test.go`: base con el índice heredado → migración → upsert con conflicto funciona.
- `handlers/trace_middleware_test.go`: detección de conexiones de larga duración.
- `handlers/telemetry_validation_test.go`: caso "beat vacío descartado".
- `web/src/lib/helpers/images.test.ts` y `media.test.ts`: `getPixelSampleImage` y `getFormatLabel`.

## 3. Pendientes (con solución recomendada)

1. ~~`surface-container-lowest` no existía~~ → **resuelto en la tercera tanda** (con tu aprobación), junto con otras ~120 clases de opacidad muertas. Conviene mirarlo en vivo: no pude sacar capturas grandes porque el panel del navegador quedó muy chico.
2. ~~El dock tapaba "Reproducir" a 1440×900~~ → **resuelto en la segunda tanda** (tope de alto del hero). Sigue pasando solo en pantallas de menos de ~900 px de alto (p. ej. 1366×768): ahí el hero ya está en su mínimo de 682 px, que el código pide no bajar. Para cubrir ese caso habría que decidir si se permite un mínimo menor en pantallas bajas.
3. **Cuenta inconsistente en la tabla `watch_histories`**: `/continuity` guarda con `account_id=1` y `/playback/sync` con `account_id=0` cuando no hay cuenta. Además, **nadie asigna `user_id` en el contexto**, así que `/home/continue-watching` (que lee esa tabla) siempre devuelve una lista vacía; hoy el frontend no lo usa (lee `continuity`), así que no se nota. Recomendación: decidir una sola fuente de verdad para el historial (el filecache de `continuity` o la tabla), un helper `currentAccountID()` para los dos handlers y una migración que fusione las filas de la cuenta 0 en la 1.
4. **Restos de mis pruebas** (antes de agregar el filtro de latidos vacíos): una fila vacía en `watch_histories` (id 172, cuenta 0, DBZ ep. 1) y dos entradas en el filecache de `continuity` (DBZ ep. 1 y ep. 2 en 0/0, creadas a las 00:26 y 00:30). **No pisaron progreso real**: no existían antes y DBZ no tenía otro progreso guardado. No las borré porque la regla era no borrar datos; se pueden eliminar sin riesgo.
5. **Jikan caído**: su upstream devuelve 504; solo sirve una copia vieja de julio a peticiones sin `Accept-Encoding`. El caché de fallos evita la espera, pero mientras siga caído, las series cuyo caché en DB expiró quedan sin los metadatos de Jikan. Conviene mostrar en Ajustes → Sistema el estado de los proveedores.
6. **La carpeta de la biblioteca (`D:\KameHouseMedia\...`) no existe en esta máquina**, por eso ningún episodio se puede reproducir acá. Ahora Ajustes lo avisa, pero queda revisar si los archivos se movieron (¿Drive?) y re-escanear.
7. ~~Parpadeo negro en la transición del carrusel~~ → **resuelto en la segunda tanda** (crossfade "por encima" en Inicio y Películas). Falta verlo en vivo: no pude medir la animación con el panel en segundo plano.
8. **Datos**: las 8 sagas de DB Super usan la misma imagen de respaldo; una saga se llama "Saga La Batalla de los Dioses" (le falta "de"); algunos títulos de TMDB no tienen "¡" de apertura ("Aparece un mini Gokū! Son Gohan!").
9. ~~Título del overlay de error~~ → **resuelto en la cuarta tanda** ("Archivo no disponible" cuando falta el archivo).

## 4. Próximas mejoras hacia el nivel premium (priorizadas)

1. Revisar en vivo el efecto visual de los tokens habilitados en la tercera tanda (nav, *hover*, *drawers*, barras de scroll) y ajustar la intensidad si hace falta. Se cambia en un solo lugar: los valores de `--md-sys-color-surface-*` en `colors.css`.
2. Fila "Continuar viendo" en Inicio, alimentada por el historial de `continuity` (ya se guarda bien y ahora no se resetea con latidos vacíos).
3. Estado de salud de los proveedores (TMDB, Jikan, Drive) en Ajustes, con reintento manual.
4. Un test e2e mínimo (Playwright) que recorra Inicio → Serie → Reproducir → Películas → Detalle y verifique que los CTA son clickeables. Hubiera atrapado el bug de `pointer-events`.
5. Revisión de la regla "backdrop-filter anidado": un elemento con blur dentro de otro con blur no ve la página (pasó en la búsqueda). Conviene documentarlo en el design system.
6. Microcopy: unificar títulos de estados de error por tipo y normalizar la puntuación de los títulos de TMDB en el backend.
7. Revisar el chunk inicial `8931.js` (~94 KB gzip) con `npm run build:rsdoctor` y ver si parte se puede diferir.
8. Decidir si producción debería generar *source maps* ocultos (`sourceMap.js: "hidden-source-map"` en `rsbuild.config.ts`). Hoy no genera ninguno; ojo: si se activa, los `.map` terminan en el directorio web que sirve el server.

## 5. Estado final de build y tests

| App | Resultado |
|---|---|
| Server (Go) | `go build ./...` OK · `go vet ./...` OK · `go test ./...` OK en los 37 paquetes con tests (re-verificado al final). |
| Web | `tsc --noEmit` OK · `tsc -p tsconfig.node.json` OK (antes con errores) · `eslint src/` OK sin advertencias · `lint:tokens` OK · Vitest **33 archivos, 274 tests OK** (antes 264) · `npm run build` OK · dev server arranca sin errores (re-verificado al final, 09:43). |
| Desktop (Tauri) | `cargo check` OK (sin cambios en esta sesión). |
| Codegen | Regenerado y sin deriva en los tipos TS. |

## 6. Cómo revisar y cómo descartar

Los cambios de esta noche conviven con otros cambios sin commitear que ya existían en la rama (de sesiones anteriores). Las tablas de arriba indican exactamente qué toqué.

```bash
git status
git diff -- apps/server/internal/api apps/server/internal/database/db/db.go apps/server/internal/handlers
git diff -- apps/web/src
```

Para descartar un cambio puntual, editá el archivo según la tabla. Si el archivo **no** tenía cambios previos, también podés usar `git checkout -- <archivo>`, pero **cuidado**: en archivos que ya venían modificados (por ejemplo `movies-hero.tsx`, `db.go` o `jikan_impl.go`), `git checkout` borraría también ese trabajo previo. Los tests nuevos son archivos sueltos y se pueden borrar directamente.
