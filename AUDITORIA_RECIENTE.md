# Auditoría reciente — KameHouse

## 26/09/2026 — modo LOCAL, desde las 00:06 (−03:00)

Pedido de la noche: (1) rendimiento del backend, (2) rendimiento del frontend (cargas instantáneas), (3) microinteracciones, animaciones y transiciones; después, bucle de automejora. Primero se retomó la tarea que dejó a medias la sesión "Transcoding performance y audio track loading" (reproducción de películas pesadas desde Google Drive). Sin commits.

### Resumen ejecutivo

- Salud inicial: Go (`vet` + `test`) OK; web: `typecheck` OK, `lint` 0 errores y 4 advertencias previas, `lint:tokens` OK, Vitest 370/370.
- **Bug grave en el parser de MKV**: nunca leía bien el SeekHead. Todas las aperturas caían al modo "sin pistas", así que los keyframes salían de ffprobe (lento en archivos grandes) o, en Drive, de cientos de pedidos. Corregido: los Cues de la película de 12,6 GB en Drive ahora se leen con **2 pedidos en ~1,1 s** (antes eran más de 110 pedidos y ~28 MB, o fallaba).
- **Causa real de "El Poder Invencible"**: Google agotó la **cuota diaria de descarga** de ese archivo (403 `downloadQuotaExceeded`). No depende del tamaño del rango: Drive rechaza pedidos al azar (a las 00:15 pasaba 1 de cada 12). Se libera sola en horas. Ahora el proxy reintenta los bloques rechazados y el reproductor explica la causa en vez de quedarse en "Pasando a transcodificación…".

### Bugs corregidos

| Archivo | Causa raíz | Solución | Test |
|---|---|---|---|
| `apps/server/internal/matroska/parser.go` (`parseSeekHead`) | Leía de `mp.reader.r` salteando el `bufio`, que ya había adelantado 64 KB, así que decodificaba bytes de otra posición. `parseSegment` fallaba y la apertura caía al modo "solo clusters" (0 pistas, sin Cues). | Leer a través del `EBMLReader`. | `seekhead_buffer_test.go`: sin el arreglo da 0 pistas; con el arreglo, 1 pista y los Cues. |
| `apps/server/internal/mediastream/cassette/keyframe.go` | Usaba como keyframes los Cues de **todas** las pistas (en la película: 1081 de video y 1138 de subtítulos) y parseaba tags, capítulos y adjuntos que no necesita. | Solo Cues de la pista de video, ordenados y sin duplicados (`keyframesFromCues`). Se parsean solo info, pistas y Cues. | `keyframe_cues_test.go` |
| `apps/server/internal/util/httprange/reader.go` | Un solo 5xx, 429 o corte de red de Drive al leer un bloque mandaba el parser al camino lento. | Hasta 2 reintentos (250 ms y 750 ms). Los 4xx no se reintentan. | `TestReaderRetriesTransientErrors` |
| `apps/server/internal/drive/client.go`, `chunked.go` | Con la cuota agotada, un bloque rechazado cortaba el direct play o la entrada del transcoder a mitad de camino. | Error tipado `StreamStatusError` con `ErrDownloadQuotaExceeded`. El proxy por bloques reintenta 3 veces (150 ms, 400 ms y 1 s) ante cuota, 429 o 5xx. | `TestChunkedRangeRetriesQuotaRejections` |
| `apps/server/internal/handlers/drive.go` | Ante la cuota agotada respondía un 502 genérico. | 503 con `Retry-After` y un mensaje claro. | Tests de handlers |
| `apps/web/src/components/video/drive-quota.ts` (nuevo) y `usePlayerHls.ts` | El error nativo en Drive disparaba un fallback a transcode que lee la misma fuente, así que quedaba trabado o fallaba sin explicar por qué. | Consulta de 1 byte: si el servidor responde 503, se muestra "Google Drive limitó por hoy las descargas de este archivo…". Si no, el fallback sigue como antes. | `drive-quota.test.ts` |

Limpieza: se borraron los temporales de diagnóstico de la otra sesión (`apps/server/cmd_tmp_cues/`, `internal/matroska/zz_tmp_debug_test.go`).

### Optimizaciones aplicadas

- Keyframes de MKV desde los Cues (instantáneo) en lugar de ffprobe, que recorre el archivo entero. Aplica a **todas** las fuentes MKV, locales y de Drive.
- **Primera apertura de una serie tras arrancar el servidor**: de 2,8 s a 1,5 s; las siguientes, 21 ms (medido en `anime-entry/12609`). Jikan sigue caído (504) y cada arranque esperaba sus reintentos. Ahora `JikanProviderImpl.GetAnimeMetadata` espera como mucho `jikanInlineWait` (1,5 s) y sigue sin sus datos, que es lo que ya pasaba cuando Jikan fallaba. La consulta termina en segundo plano, se deduplica por ID y su resultado o su fallo queda en caché. Con Jikan sano no cambia nada. Test: `TestJikanProviderNoBloqueaConJikanLento`.
- **Primer render del frontend**:
  - La hoja de Google Fonts (Cormorant Garamond) ya no bloquea el render (`media="print"` + `onload`). En la app de escritorio sin red frenaba el primer pintado; además, la CSP de Tauri no la permite.
  - Se precargan 3 fuentes en lugar de 6: solo el subset `latin` (`rsbuild.config.ts`). `latin-ext` no hace falta para el español.
- **Tirón al navegar**: `lib/query-persister.ts` guardaba la caché entera de React Query en IndexedDB en cada evento (el `store.put` hace structured clone de todo). Al entrar a /chronology eran ~220 ms de hilo principal bloqueado. Ahora se guarda solo el último estado, como mucho una vez por segundo y en tiempo ocioso, y enseguida al ocultar o cerrar la ventana. **Medido** con Chrome headless y perfil de CPU: tareas largas en /chronology de 284 ms a ~128 ms (la más larga, de 217 a ~74 ms); el guardado en IndexedDB, de ~220 ms a 2,6 ms. Test: `query-persister.test.ts`.
- **Respuesta de `anime-entry` 40 % más liviana** (`handlers/anime_entries.go`, `entryForResponse`): cada episodio repetía `baseAnime`, igual al `media` de la entrada y que ningún cliente lee. Dragon Ball pasó de 757 KB a 454 KB de JSON: menos parseo y menos caché persistida. Se devuelve una copia, así que la entrada cacheada del servidor no se modifica. Test: `anime_entry_response_test.go`.
- Mediciones que salieron bien y no requieren cambios: el servidor arranca en 618 ms; `home/curated`, `library/collection` y `settings` responden en 2 a 17 ms en caliente; `image-proxy` cachea con `immutable` (0,87 s la primera vez, 8 ms después).

### Microinteracciones, animaciones y transiciones

Criterio: animar solo cuando hay un propósito concreto (feedback, estado, evitar un salto) y con poca frecuencia de uso. El relevamiento mostró que la app ya tiene un sistema de movimiento maduro: tokens en `animation.css`, framer-motion, `Button` con press de 0,97, modales, popovers, búsqueda, menú del reproductor, "Requiere Guardar" y "¡Guardado!" animados. Por eso los cambios son pocos y puntuales.

| Archivo | Qué | Propósito |
|---|---|---|
| `button.tsx`, `InterludeDivider.tsx`, `TimelineVolumeCard.tsx` | **Bug**: `duration-[160ms]`, `ease-[cubic-bezier(0.23,1,0.32,1)]` y `ease-[cubic-bezier(0.16,1,0.3,1)]` no generaban CSS, porque `tailwindcss-animate` también registra `duration-*` y `ease-*`: el valor arbitrario queda ambiguo y Tailwind lo descarta (solo avisa en el build). El press de **todos** los botones corría con el easing por defecto, no con el `ease-out` fuerte del sistema. Se pasaron a los tokens `duration-fast`, `ease-out-strong` y `ease-expo-out`. Verificado en el CSS generado; el build ya no avisa. | Feedback |
| `scripts/check-tokens.mjs` | Nueva regla: rechaza `duration-[…]`, `ease-[…]` y `delay-[…]` arbitrarios e indica el token. Probado con un caso a propósito. | Que no vuelva |
| `components/ui/select/select.tsx` | La lista del `Select` de formularios aparecía y desaparecía de golpe. Ahora usa la misma receta del popover: fade + `zoom-in-95`, `ease-out-strong`, 200 ms al abrir y 150 ms al cerrar. | Evitar un salto |
| `components/ui/kinetics/icon-swap.tsx` (nuevo) | `IconSwap`: cambio de ícono por estado (scale 0,25→1, opacidad y blur de 4 px, spring de 0,3 s sin rebote; con movimiento reducido, solo fade) y `useTransientFlag`. Test: `icon-swap.test.tsx`. | — |
| `series-hero.tsx`, `movies-hero.tsx` | "Añadir a la cola" confirma en el propio botón (ícono → ✓ durante 1,6 s y `aria-label` "Añadido a la cola"), además del toast. | Indicación de estado |
| `movie-poster-card.tsx`, `spotlight-saga-card.tsx`, `premium-episode-list.tsx` | El play (y el velo) de las tarjetas se veía solo con hover. Con Tab o el control remoto la tarjeta se enfocaba pero el play quedaba invisible. Se agregó `group-focus-visible:` con el mismo fade de 200 ms. **Verificado** en Chrome headless con teclado: opacidad de 0 a 1. | Feedback de foco |

Descartados a propósito:
- Paleta de comandos y atajos: se usan con teclado y muchas veces por día; nunca se animan.
- "Visto" en la paleta: mismo motivo.
- Barras de progreso y datos del reproductor: son información que se lee; moverlas estorba.
- ~~`hoverOnlyWhenSupported` global~~ → hecho en "Responsive móvil", después de revisar caso por caso que ningún control dependiera del hover.

### Responsive móvil

Relevado con Chrome headless emulando un celular táctil a 320, 375, 414 y 768 px en /home, /series, /series/12609, /movies, /chronology y /settings. **No hay scroll horizontal** en ninguna combinación. Cambios:

| Archivo | Síntoma | Arreglo |
|---|---|---|
| `tailwind.config.ts` | Hover pegado tras un toque (tarjetas agrandadas, botones iluminados). En iOS el primer toque solo aplicaba el hover. | `future.hoverOnlyWhenSupported`: las 227 reglas `hover:`/`group-hover:` quedan dentro de `@media (hover:hover) and (pointer:fine)` (verificado en el CSS). Antes se revisó que ningún control funcional dependiera de hover para aparecer: los 14 casos son decorativos o ya tienen `max-sm:opacity-100`. En desktop no cambia nada. |
| `app/globals.css` | Zoom al enfocar campos de 14 px en iOS, que no se deshace. | En `(pointer: coarse)`, inputs, `textarea` y `select` a `max(16px, 1em)`. Desktop no cambia. |
| `app/globals.css` | Demora de tap por el doble toque. | `touch-action: manipulation` en `button`, `a`, `[role=button]`, `summary` y `label`. |
| `app/globals.css` | Inflado de fuentes en horizontal. | `text-size-adjust: 100%`. |
| `index.html` | El teclado de Android no redimensionaba el viewport. | `interactive-widget=resizes-content`. |
| `app-layout.tsx` | El shell usaba `h-screen` (100vh): en el navegador del celular el contenido y la barra inferior quedaban cortados detrás de la barra de URL. | `h-dvh`. Verificado a 375×780: el shell mide 780 y la barra termina en 763. |
| `player-ui.tsx`, `player.tsx` | Mismo `100vh` en el reproductor: los controles podían quedar bajo la barra de Safari. | Solo la unidad, `h-dvh`; el diseño a pantalla completa no cambia. |
| `toaster.tsx` | Sonner no respeta las zonas seguras: con `viewport-fit=cover` el toast quedaba bajo la muesca o la barra de gestos. | `offset`/`mobileOffset` con los mismos márgenes (24/16 px) + `env(safe-area-inset-*)`. |
| `hero-carousel-dots.tsx` | Dots del carrusel de 24×32 px. | Área táctil de 44 px de alto con un `::after` invisible. El dibujo del hero no cambia. |

**Necesita un celular real**: hover pegado, zoom de inputs, demora de tap, `dvh` con la barra de URL, teclado de Android y zonas seguras (sobre todo como PWA). La emulación no reproduce ninguno de estos comportamientos; lo verificado acá es el CSS generado y la geometría.

Sin tocar a propósito: "Detalles" de la Cronología (108×38 px; esa zona está en desarrollo en tu rama) y el link del título del hero (301×25 px; el CTA principal ya cubre la acción).

### Lint en cero

`eslint src/` pasó de 0 errores y 4 advertencias a **0 problemas**:
- `routes/chronology/index.lazy.tsx`: el ref `highlightFromUrlRef` se escribía durante el render. Eso rompe las reglas de React, y **React Compiler (activo en el build de producción) dejaba toda la página de Cronología sin optimizar**. Ahora se marca en un efecto declarado antes del de scroll. Verificado en Chrome headless: `/chronology?highlight=db-daima-conspiracion` deja el volumen justo debajo de la barra (top 113 px).
- `use-series-playback.ts`: el `tSec!` se reemplazó por un chequeo explícito.
- `TimelineVolumeCard.tsx`: `onToggleRead` sin usar → `_onToggleRead`.
- `smart-lore-text.test.tsx`: se quitó el import `screen` sin usar.

### Resiliencia del backend

Las goroutines lanzadas fuera del request no pasan por el middleware `Recover` de Echo: un `panic` ahí **tira abajo el servidor entero**.

| Archivo | Qué |
|---|---|
| `metadata_provider/jikan_impl.go` | `runCall` (introducido esta noche para no bloquear con Jikan lento) convierte un panic de la consulta en error y libera a los que esperan. Test: `TestJikanProviderRecuperaPanicEnSegundoPlano`, con `-race`. |
| `handlers/anime_entries.go` | La carga de fillers en segundo plano, que parsea datos externos en cada apertura de serie, ahora tiene `recover`. |
| `handlers/cache_handlers.go` | Warm-up de miniaturas: `recover` **por archivo**. Así un archivo que hace fallar a ffmpeg no mata al worker; si caían todos, el productor quedaba bloqueado enviando al canal. |
| `handlers/system.go` | El ZIP de respaldo: un panic ahora cierra el pipe con error, así la descarga falla limpia en vez de colgarse, y el servidor sigue arriba. |

Revisado sin cambios: todos los clientes HTTP tienen timeout. El de Drive tiene `Timeout: 0` a propósito, porque transmite video, pero su transporte ya pone `ResponseHeaderTimeout: 30s`. El escaneo de Drive ya tenía `recover`.

Tipos backend↔frontend: el codegen no genera cambios en los `.ts`, así que no hay deriva. Tampoco hay ningún `any` fuera de los archivos generados.

### Caché de Google Drive en disco (a pedido: "no usar Drive a cada rato")

Antes, cada reproducción, salto, reanudación, lectura de los Cues y pasada del transcoder volvía a descargar de Drive. Eso gastaba la cuota diaria del archivo. Ahora hay una **caché de bloques en disco** (`internal/drive/blockcache.go`, en `<cache>/drive-blocks`):

- El archivo se divide en bloques alineados de 16 MB. Cada bloque se baja de Drive **una sola vez**, y lo siguiente sale del disco: volver a ver, retroceder, reanudar, los Cues y la cabecera en cada apertura, ffprobe y el transcoder.
- Un bloque que falta se transmite **mientras llega**, así que un salto no espera los 16 MB. Si varios pedidos piden el mismo bloque, se descarga una vez. Los lectores secuenciales adelantan 2 bloques.
- Tiene un tope de **20 GB**: se desalojan primero los bloques menos usados.
- Si el archivo cambia en Drive, se invalida. Una vez por archivo y arranque se compara el tamaño con la metadata de Drive, que no gasta cuota de descarga; además, un tamaño distinto en cualquier respuesta purga los bloques.
- Los reintentos por cuota siguen funcionando, sin duplicarse entre capas, y el mensaje de "cuota agotada" se mantiene.
- En **Ajustes → Sistema** hay una fila nueva, "Google Drive (bloques descargados)", con el tamaño y un botón para limpiar. **"Limpiar todo" no la borra** (se borra con `target=drive`), porque rellenarla gasta cuota.
- **Medido** contra Drive real: el mismo rango de 256 KB tardó 1,19 s la primera vez y **8 ms** la segunda, con contenido idéntico.
- Tests (`blockcache_test.go`, con `-race`, 3 corridas): segunda lectura con 0 pedidos a Drive, sobrevive a un reinicio, 8 lectores concurrentes hacen 1 solo pedido, invalidación por cambio de tamaño y por `Validate`, desalojo por tope, reintento de cuota sin reintento doble, e integración con el proxy por bloques.

### Segunda pasada de movimiento y diseño

**Calidad del movimiento que ya existe**: 0 `transition-all` reales, 0 entradas con `ease-in`, 0 entradas desde `scale(0)`, y las animaciones de `height: auto` son solo acordeones ocasionales. Las imágenes ya cargan con skeleton, LQIP y fade (`DeferredImage`). El switch usa spring; el estado vacío de la cola tiene entrada con spring. Conclusión: la capa de movimiento está completa, y sumar más sería sobreanimar.

**Revisión visual** (capturas a 1440×900 de todas las pantallas):
- **Arreglado**: en Inicio, el chip de saga decía "la Patrulla R…" en minúscula, porque el recorte de "Saga de…" no cubría "de la" ni "de las". Nuevo helper `shortSagaTitle` (`lib/helpers/series.ts`, con test): quita el prefijo y el artículo, así que queda "Patrulla Roja" (igual que "Emperador Pilaf"), con mayúscula inicial.
- Descartados tras verificar: "CLÂSICO" en Cronología (era la resolución de la captura; ampliado se ve "CLÁSICO"), el volumen de DB Daima (es VOL. 6, correcto) y el panel de Ajustes bajo el logo (es el diseño: panel de alto completo con `pt-20`).
- **Para decidir**: 3 de las 31 imágenes curadas del hero (`hero-art.ts`) miden menos de 1440 px de ancho: `DB_TRAFFIC` (1326), `DBZ_YO_GOKU` (1280) y `DBZ_GOKU_WORLD` (1280). En pantallas grandes o HiDPI se estiran. El fondo de "100 Años Después" (`DBGT_100`) mide 1440 px y se ve borroso por la calidad de origen, no por el tamaño. Cambiarlas es elegir otra imagen y otro encuadre; no lo hice.

### Tercera pasada: el movimiento medido cuadro a cuadro

Esta vez no se revisó el código sino el movimiento real: se grabaron las transiciones con el screencast de Chrome, se calculó el brillo de cada cuadro y se muestreó el DOM en cada `requestAnimationFrame`, con clics de mouse reales por CDP.

| Archivo | Problema medido | Arreglo | Resultado |
|---|---|---|---|
| `components/shared/page-transition.tsx` | **Parpadeo a negro en cada navegación.** La página nueva entraba desde opacidad 0 y el primer render de la ruta traba el hilo ~60–190 ms: esos cuadros mostraban solo el fondo vacío (brillo 69 → 12 → 36 en Inicio → Series). | La entrada arranca en opacidad 0,5 (con 6 px de ascenso, 200 ms): sigue sin ser un corte seco, pero nunca pasa por el vacío. | El primer cuadro ya muestra la estructura de la página nueva. |
| `floating-pill-nav.tsx`, `app-topnav.tsx` | **La pestaña activa respondía tarde**: la cápsula blanca seguía en la pestaña vieja ~180–255 ms después del clic, porque el render de la ruta trababa la animación del indicador. | Presión optimista: al `pointerdown` la pestaña se marca activa (render chico, solo la barra). Si el gesto se cancela o sale del botón, vuelve; al cambiar la ruta, el estado se descarta solo. | **Medido con mouse real**: empieza a moverse 14–23 ms después de presionar (antes 181–255 ms) y llega a Series en 171 ms (antes 435) y a Cronología en 410 ms (antes 621). Igual en la barra móvil. |
| `routes/__root.tsx`, `lib/helpers/goku-panorama.ts` | Las figuras de la estantería de Series se bajaban y decodificaban recién al entrar. | Se precalientan (`decode()`) en el mismo idle que ya precargaba la ruta `/series`. Nueva constante `SPINE_ART_URLS` (5 imágenes sin repetidos, con test). | La entrada escalonada de la estantería es su diseño y no se tocó. |

Revisado sin cambios: las duraciones de framer escritas a mano (0,15 s, 0,25 s…) ya coinciden con la escala de tokens (`--duration-quick`, `--duration-base`). Convertirlas no cambiaría nada visible.

### Revisión funcional de Ajustes (a pedido: "revisá los botones de ajustes, que todo funcione")

Se probó cada control de las 5 pestañas contra la instancia de prueba, que usa **una copia de los datos**, con Chrome headless, mouse y teclado reales. Para cada control: accionarlo, verificar el pedido al servidor, guardar si hace falta, recargar, comprobar que persiste y restaurar el valor original. No se accionaron "Desconectar Drive" (toca tu cuenta real) ni el restablecimiento de fábrica; de este último solo se verificó que un toque corto no lo dispara.

**Resultado final: 27/27 interruptores, 5/5 grupos de opciones, 4/4 selectores, 6/6 campos y sliders, y todos los botones de acción OK.**

Bugs encontrados y corregidos:

| Archivo | Bug | Arreglo | Test |
|---|---|---|---|
| `server/internal/database/db/settings.go` | **Apagar "Ocultar subtítulos si el audio está doblado" y "Gobernador térmico" no se guardaba**: al recargar volvían a estar encendidos. `UpsertSettings` y `UpsertMediastreamSettings` usaban `Create`+`OnConflict`, y GORM reemplaza un `false` por el `default:true` del tag (el mismo bug ya se había corregido en `UpsertTheme`). | `Save` (UPDATE de todas las columnas o INSERT), igual que `UpsertTheme`. | `settings_upsert_test.go`: falla sin el arreglo ("no se guardó") y pasa con él. |
| `web/src/routes/settings/components.tsx` (`OsSelect`) | **Ningún selector de Ajustes cambiaba de valor** (orden inicial, proveedor de metadatos, idioma de metadatos, preset de transcodificación). Dentro de un `<form>`, Radix usa un `<select>` nativo oculto cuyas `<option>` salen de `SelectPrimitive.ItemText`, y las opciones no lo usaban. Resultado: Radix llamaba `onValueChange("medium")` y enseguida `onValueChange("")`, y el valor volvía al default. Fallaba con mouse y con teclado. | Texto de cada opción envuelto en `SelectPrimitive.ItemText`. | `-os-select.test.tsx` (2 tests, fallan sin el arreglo). |
| `web/src/components/shared/directory-selector.tsx` | **No se podía escribir a mano la ruta de una carpeta** (Biblioteca y música): cada tecla se borraba. Un efecto con dependencia en `input` volvía a poner el valor de la prop, que se actualiza recién tras el debounce de 300 ms. | Se sincroniza desde la prop solo cuando la prop cambia (estado derivado del valor previo). | `directory-selector.test.tsx` (falla sin el arreglo: `'' ≠ 'C:/Users/Public'`). |
| `server/.../handlers/mediastream.go`, `playback-tab.tsx` | "ESCANEAR AHORA" (marcas de skip) mostraba "No se pudo iniciar el escaneo" cuando ya había uno corriendo: el servidor respondía **500**. | 409 Conflict (como el escaneo por serie). La interfaz lo muestra como "Ya hay un escaneo en curso" y sigue su progreso. | Tests de handlers. |
| `routes/settings/index.lazy.tsx`, `lib/server/settings.ts`, `performance-tab.tsx` | Las rutas de FFmpeg y FFprobe que no son "seguras" (fuera de la carpeta `bin` de KameHouse o del PATH) se descartan en el servidor, a propósito, pero **en silencio**: la interfaz decía "guardado". Además, el ejemplo del campo sugería una ruta que se rechaza. | Aviso tras guardar ("La ruta de FFmpeg no está permitida · se usa la detectada: …") y descripción corregida. La regla de seguridad no cambia. | `settings.test.ts` (`findIgnoredBinaryPaths`). Verificado en la interfaz. |

Accesibilidad (encontrada en el inventario):
- Las tarjetas de opción (tema Clásico/Era, idioma de doblaje, perfil de rendimiento, modo de streaming) no exponían cuál está elegida: ahora tienen `aria-pressed`.
- Los campos de carpeta, los de `OsInput` (Client ID y Client Secret de Drive) y los sliders de volumen no tenían nombre accesible: ahora tienen `aria-label`, y los sliders además `aria-valuetext` ("25 %").

Verificado sin cambios: la API key se muestra y oculta; el respaldo genera un SQLite válido de 9,4 MB y lo descarga; el explorador de carpetas, "Re-analizar", "Pre-generar", "Gestionar caché" e "Instrucciones de reinicio" funcionan. En la copia de prueba, todos los valores quedaron como estaban.

### Animaciones en scroll (primera tanda) e imágenes al instante

**Kit nuevo en `components/ui/kinetics/`:**
- `scroll-reveal.ts`: motor de revelado con **un único IntersectionObserver**.
  - Lo que está en pantalla al montar no se anima, así no hay doble fundido con la transición de página.
  - Lo que entra junto se escalona solo, en orden de lectura (45 ms entre elementos, tope de 360 ms).
  - Solo transform y opacity, por CSS; al terminar limpia los estilos en línea para que el hover de las tarjetas siga funcionando.
  - Respeta `useMotionTier`: `full` = fundido + ascenso de 18 px en 520 ms; `subtle` (Eco o TV) = solo fundido; `off` (movimiento reducido) = nada.
  - Con clave, cada ítem se revela **una sola vez por sesión**, aunque la lista virtualizada lo vuelva a montar.
  - Hooks: `useScrollReveal(ref)`, `useRevealChildren(ref, key)` (hijos sin envoltorios) y `useRevealRef(key?)` (ref callback con limpieza, React 19).
- `scroll-progress.tsx`: barra fina de progreso (scaleX con rAF, aparece al bajar).
- Tests: `scroll-reveal.test.ts` (9): no anima lo visible, escalona en orden de lectura, respeta el tope, limpia, respeta el nivel de movimiento, no repite por clave, y el cálculo del progreso.

**Aplicado en:**
- Grilla de Películas: tarjetas que montan al bajar, con clave por película.
- Lista de episodios de la ficha de serie: en el div interno, porque el contenedor se posiciona con `translate3d`.
- Portadas de Series.
- **Todas las `SectionBar`**: secciones de Ajustes y de las fichas; no se aplica con `layoutId`, donde framer controla el transform.
- Barra de progreso en Cronología (sus tarjetas ya tenían su propio revelado y no se duplicó).

**Verificado en Chrome headless:**
- Películas: 27 tarjetas arrancan ocultas y se revelan por tandas al scrollear (6, 6, 11, 13…).
- Episodios: 12 filas.
- Ajustes: 3 de 8 y 6 de 10 secciones.
- En todas, **0 tareas largas** durante el scroll. La barra de Cronología llega a `scaleX(0.20)` tras bajar un tramo.
- Grabación cuadro a cuadro del scroll en Películas: entrada en ola, sin tirones.

**Imágenes que tardaban en cargar (a pedido: "las imágenes están cargando lento"):**
- Las figuras de la estantería son locales y cargan en ~20 ms. Lo lento eran los **pósters de TMDB**: 150–400 ms cada uno por internet, pedidos recién al entrar a la página.
- Ahora los **loaders de las rutas** `/series` y `/movies` los descargan en idle. Esos loaders ya se ejecutaban al arrancar la app (`preloadRoute`) y al apuntar el link.
- Helpers `shelfImageUrls` y `moviePosterUrls` en `lib/helpers/series-images.ts` (con tests), con las mismas URLs que dibujan la estantería y las tarjetas.
- **Medido**: antes de entrar a Series ya estaban los 25 pósters y banners; **al entrar, 0 pedidos nuevos** y todas las imágenes listas. En Películas quedan solo 3 pedidos, los del arte curado del hero, que no se precargan porque pesan más y rotan.

### App más liviana (a pedido: "qué agregar, sumar y quitar para que se sienta más liviana")

Se midió antes de tocar nada.

**Costo en ejecución** (Chrome headless, 15 s en reposo por pantalla): la app ya es liviana. El hilo principal está ocupado 59 ms en Inicio con el carrusel rotando (0,4 %), 36 ms en Series, 21 ms en Películas, 107 ms en Cronología y 10 ms en Ajustes. No hay tareas largas en reposo. El hover de la estantería da p50 de 6 ms y p95 de 12 ms por cuadro. El splash dura ~130 ms y la interfaz aparece a los 180–235 ms. (Una primera medición daba 11 % ocupado, pero era el propio medidor; se descartó.)

**Quitado del arranque:**
- **−292 KB de JavaScript inicial (1066 → 774 KB, −27 %)**. `hooks/use-global-search.ts` importaba los volúmenes de la Cronología (`dragonball_story_spans.json` 117 KB, `detailedStories` 57 KB, `volumes` 47 KB, `spanLore` 46 KB, `spanDetailedStories` 22 KB, `spansToVolumes` 8 KB). Como el buscador vive en la barra, viajaban en **todas** las pantallas. Ahora se cargan con `import()` recién cuando se abre el buscador, y quedan cacheados. **Verificado**: al abrir el buscador baja 1 chunk, y "freezer" sigue devolviendo 7 resultados, 4 de la Cronología. Medido atribuyendo cada byte del JS inicial a su fuente con los source maps.

**Quitado del hilo principal:**
- `hooks/use-image-palette.ts`: la paleta del hero se calcula con `img.decode()` antes de `drawImage`. Antes, `onload` llegaba sin decodificar y `drawImage` decodificaba de golpe en el hilo principal (~20 ms con los fondos de 1920 px, en cada rotación del carrusel).

**Sumado (ya descrito arriba):** precarga en idle de los pósters de Series y Películas, figuras de la estantería precalentadas y revelado de scroll sin re-renders.

**Evaluado y no aplicado:**
- ~~`LazyMotion` asíncrono~~ → **aplicado y verificado** (ver abajo).
- Sombras `drop-shadow` de las figuras de la estantería (26 en pantalla): el hover mide bien, no hace falta tocarlas.
- `prefetch` de los 6 fondos de era (~1 MB): es en idle y local en la app de escritorio.

### Librería de animaciones fuera del arranque (a pedido: "lo de librerías verificalo bien, hacé un plan y solucionalo")

Plan: separar las funciones de framer-motion (`domMax`) en un chunk diferido **sin que se vea nada invisible**. El riesgo era que los `m.*` con `initial={{ opacity: 0 }}` quedaran ocultos hasta que llegara el chunk.

**Verificación previa:**
- La app usa solo `m` bajo `<LazyMotion strict>`; ningún `motion.*` completo (que traería todo igual).
- El splash es HTML estático (`#global-loader`, sin framer) y tapa la app hasta `isInterfaceReady`.
- Obstáculo encontrado: `forceSplitting` en `rsbuild.config.ts` metía **todo** framer-motion en un chunk inicial forzado; sin cambiarlo, la separación no servía.

**Cambios:**
- `lib/motion-features.ts` (exporta `domMax`).
- `lib/motion-features-loader.ts`: carga con reintento, estado "listo" con `useSyncExternalStore` y test.
- `app/client-providers.tsx`: `LazyMotion features={loadMotionFeatures}`.
- `main.tsx`: pide el chunk al arrancar.
- `routes/__root.tsx`: el splash espera `useMotionFeaturesReady()`. Si falla, sigue el tope de seguridad de 1,5 s.
- `rsbuild.config.ts`: sin forzar framer-motion; el chunk `motion-features` (nombre estable) se **precarga desde el HTML** (`<link rel="preload">`) junto al JS inicial.

**Medido:**
- **JS inicial 774 → 688 KB (−86 KB)**; `motion-dom` en el arranque pasó de 97 a 33 KB. En total, en esta sesión, el JS inicial bajó de 1066 a 688 KB (**−35 %**).
- El chunk llega a los 40–49 ms, antes que `/status` (~92–103 ms); el splash se retira a los **200 ms en frío** (antes 263 ms).
- Grabación cuadro a cuadro del arranque en frío, 7 corridas: la transición splash → interfaz promedia ~1390 ms, igual que el build anterior (~1393 ms). **Sin cuadros vacíos ni contenido invisible.** (Sin el preload promediaba ~80 ms más; por eso se agregó.)
- Animaciones en funcionamiento: el indicador de la barra (`layoutId`) se mueve 13–17 ms después de presionar; la salida del buscador (`AnimatePresence`) se ve durante el cierre y después desmonta; el plegado de secciones anima la altura (251 → 141 → 61 px).
- Tests: `motion-features-loader.test.ts` (3): una sola descarga y aviso de listo, reintento, y sin "listo" si falla dos veces. Suite: 55 archivos, 399 tests OK.

### Fondos de Series al instante (a pedido: "los fondos de series tardan demasiado en cargar")

**Causa:** cada imagen venía de TMDB por internet (0,6–0,7 s cada una). Además, los fondos de los lomos eran `lazy` con prioridad baja y quedaban al final de la cola. En la primera apertura terminaban entre 1,27 y 1,88 s.

**Cambios:**
- **Servidor**:
  - `ImageProxy.Prewarm` (`util/proxies/image_proxy.go`) baja al disco las imágenes que falten, de a 3 en paralelo y con `recover`.
  - El proxy ya no guarda en caché respuestas de error (un 404 quedaba guardado como imagen).
  - `handlers/shelf_images.go` arma la lista:
    - Series: póster y banner en w342 y w185, más el póster vertical de Daima.
    - Películas: póster w342.
  - El precalentamiento corre 8 s después de arrancar y después de cada escaneo, local o de Drive.
- **Front**:
  - `localImage()` (`lib/helpers/images.ts`) pide las imágenes de TMDB a través de `/api/v1/image-proxy`. Se aplica en la estantería y la grilla de Series, el aura, las precargas, `MovieCard`, la tarjeta de película del Home, `shelfImageUrls` y `moviePosterUrls`.
  - Los 7 primeros lomos piden su fondo sin esperar al lazy.
  - `prewarmImages` decodifica la imagen de antemano (`decode()`).
- **Tests**:
  - Go: las URLs coinciden byte a byte con las del front (la URL exacta es la clave de la caché), solo películas no suma Daima, y `Prewarm` baja cada imagen una sola vez, saltea las ya guardadas y no guarda un 404. Pasa con `-race`.
  - Front: `localImage` y las URLs locales de `shelfImageUrls`.

**Medido (perfil nuevo, apertura directa de `/series`):**

| Caso | Antes | Ahora |
|---|---|---|
| Primera apertura | 1,27–1,88 s | 0,12–0,23 s (19 de 19 imágenes visibles) |
| Segunda apertura | 358–400 ms | 262–383 ms |

- El servidor responde cada imagen en 3–5 ms.
- La estantería no hace ningún pedido directo a TMDB. **Con TMDB bloqueado**, Series carga sus 19 imágenes y Películas los 12 pósters visibles.
- El precalentamiento bajó 54 imágenes en 3,8 s.

**Defecto encontrado de paso: la app se recargaba sola en la primera apertura.** Grabación en frío:
- Antes: splash, interfaz (~1,4 s), **otra vez el splash** y la interfaz recién a los ~2,1 s. Todo se bajaba dos veces.
- Causa: el service worker usa `clientsClaim`. En la primera instalación toma control de la página, dispara `controllerchange`, y `pwa-registry.tsx` recargaba aunque la versión fuera la misma.
- Ahora solo recarga si ya había un SW controlando la página (una actualización real). Test nuevo: `pwa-registry.test.tsx`.
- Después: una sola navegación, y la interfaz queda estable ~0,57 s antes, con los fondos ya puestos en el primer cuadro completo.
- En la app de escritorio esto pasaba en el primer arranque y cada vez que se limpian los datos del WebView.

**Otros:**
- Los archivos editados con Python habían quedado con fin de línea CRLF, y el repo usa LF (`.gitattributes`). Se volvieron a LF; el contenido no cambió.
- El hero de Películas sigue pidiendo su fondo directo a TMDB: necesita CORS de TMDB para la paleta, así que no se tocó.

### Hero de Películas: imagen a la derecha y blur a la izquierda (a pedido)

- **Antes**: el stage ocupa todo el ancho con un alto máximo de 748 px. En ventanas anchas `cover` agrandaba la imagen y la recortaba arriba y abajo, así que se veía con zoom y los personajes cortados.
- **Ahora**: `heroRightRect` y la prop `wide="right"` en `HeroBackdrop` (solo la usa Películas; el Home no cambia).
  - Cuando el stage es más ancho que el arte, la imagen queda entera, a la altura del stage y pegada a la derecha.
  - El borde izquierdo se funde con las máscaras de siempre y lo que sobra lo cubre la capa desenfocada que ya tenía `MoviesHero`.
  - `sizes` usa el ancho real de la caja, así que el navegador ya no pide `original` sin necesidad (a 1440 ahora baja w1280).
- **Medido en 5 tamaños**:

  | Ventana | Stage | Resultado |
  |---|---|---|
  | 1920 | 1824×748 | imagen de 1326×746 a partir de x=497 |
  | 2560 | 2464×748 | imagen de 1326×746 a partir de x=1137 |
  | 1440 | 1344×587 | imagen de 1040×585 a la derecha |
  | 1024 | 944×616 | alto completo; recorta los costados según el foco |
  | 500 | 468×528 | alto completo (ya no se achica con blur arriba y abajo) |

- **Regla (pedida)**: la imagen siempre tiene el alto de la tarjeta; lo que sobre de ancho se rellena con blur. Con `wide="right"` no se usa el modo relleno de celular.

- Test: `hero-backdrop.test.ts` (4).
- **Difuminado corregido** (captura del usuario con "Seguridad Vial de Goku", donde se veía un corte).
  - **Corte vertical**: `hero-art-mask-soft` arrancaba con 55 % de opacidad en el borde izquierdo de la imagen, que ahora queda en medio del stage.
    - Nueva máscara `.hero-art-mask-edge` (`globals.css`): arranca en 0 y sube con 8 paradas hasta el 54 %.
    - Se usa siempre que la imagen va a la derecha; en `cover` siguen las máscaras de antes.
  - **Relleno con manchas**: era la miniatura w185 estirada con un blur de 12 px.
    - Ahora usa `--filter-blur-hero-bg` (32 px), `brightness(0.72) saturate(140%)` y `scale(1.2)`, anclado a la derecha.
    - Queda un fondo de color, sin formas de personajes.
  - **Medido**: el salto máximo de luminancia entre píxeles vecinos en la costura es 2,4 niveles a 1920 y 2,8 a 2560. A 1440 y 1024 sigue bien.
- Visto de paso, sin tocar: al cambiar de película con los dots, la tarjeta queda oscura un instante hasta que carga la nueva imagen. Se arregla precargando la siguiente.

### Pendientes o deuda

- **TAREA PENDIENTE (pedida el 26/09): animaciones en scroll, "algo muy completo"**. Propuesta: revelados de secciones y tarjetas al entrar en pantalla (fade más un leve ascenso, escalonado por grupo, una sola vez por sección); parallax sutil en los heroes y fondos de la ficha de serie; encabezados que se compactan y ganan vidrio al hacer scroll; barra de progreso de lectura en Cronología; animaciones vinculadas al scroll con `IntersectionObserver` y `useScroll` de framer-motion (con `animation-timeline: view()` donde el navegador lo soporte). Siempre solo transform y opacity, con `prefers-reduced-motion` y el perfil de rendimiento (Eco = sin parallax), sin tocar la estantería móvil ni el reproductor. Medir con el grabador cuadro a cuadro que no haya tirones.


- **Cuota de Drive (02:51)**: sigue a medias. Se alargaron los reintentos por bloque a 5 (150 ms, 400 ms, 1 s, 2 s y 3 s) en `drive/chunked.go`. Con la cuota a medias, 5 de 5 saltos de prueba a 2, 4, 6, 8 y 10 GB respondieron en 0,65–1 s. Si la cuota se agota del todo, el error llega a los ~6,5 s con el mensaje claro. La solución de fondo sigue siendo otra fuente (Cloudflare R2, como planeás) o una copia del archivo en Drive, que tiene cuota propia.
- **Cuota de Drive (antes)**: mientras dure, esa película no se puede ver desde Drive. Opciones: esperar a que se libere, usar una copia local o hacer una copia del archivo en Drive (tiene cuota propia). La copia no se hizo porque es una acción sobre tu cuenta.
- La instancia de prueba de la otra sesión sigue corriendo en `:43299` (PID 16064) con un binario viejo. Hay que recompilar y reiniciar la app de escritorio para tomar todos los cambios.
- `gofmt -l` marca muchos archivos de `cassette/` y `parser.go` por formato previo (no son cambios de esta noche).

### Archivos tocados esta noche (sin commits)

- **Nuevos (fondos de Series)**: `handlers/shelf_images.go` (+test), `proxies/image_proxy_prewarm_test.go`, `pwa-registry.test.tsx`. **Editados**: `image_proxy.go`, `routes.go`, `scan.go`, `drive.go`, `images.ts` (+test), `series-images.ts` (+test), `-SeriesCard.tsx`, `series/index.lazy.tsx`, `-MovieCard.tsx`, `spotlight-movie-card.tsx`, `pwa-registry.tsx`.
- **Nuevos**: `drive-quota.ts` (+test), `icon-swap.tsx` (+test), `query-persister.test.ts`, `seekhead_buffer_test.go`, `keyframe_cues_test.go`, `anime_entry_response_test.go`, `AUDITORIA_RECIENTE.md`.
- **Sin cambios previos** (se puede revertir con `git checkout -- <archivo>`): `matroska/parser.go`, `httprange/reader.go` (+test), `drive/client.go`, `handlers/anime_entries.go`, `metadata_provider/jikan_impl.go` (+test), `web/index.html`, `rsbuild.config.ts`, `check-tokens.mjs`, `button.tsx`, `kinetics/index.tsx`, `movie-poster-card.tsx`, `select.tsx`, `spotlight-saga-card.tsx`, `query-persister.ts`, `premium-episode-list.tsx`, `series-hero.tsx`.
- **Ya tenían cambios tuyos o de otra sesión** (editar a mano; `git checkout` borraría ese trabajo): `cassette/keyframe.go`, `handlers/drive.go`, `drive/chunked.go` (+test, archivo nuevo de la otra sesión), `usePlayerHls.ts`, `movies-hero.tsx`, `InterludeDivider.tsx`, `TimelineVolumeCard.tsx`.
- **Borrados**: `apps/server/cmd_tmp_cues/` y `internal/matroska/zz_tmp_debug_test.go` (diagnóstico temporal de la otra sesión).

Estado final verificado: `go vet` OK, `go test ./...` OK, `-race` OK en `mediastream`, `matroska`, `handlers`, `drive`, `httprange` y `metadata_provider`; web: `tsc` OK, `eslint` 0 errores (las 4 advertencias previas), `lint:tokens` OK, Vitest 49 archivos y 377 tests OK, `rsbuild build` OK sin avisos de clases ambiguas.

**Para probar en la app**: recompilá el servidor y reiniciá la app de escritorio.

## 28/09/2026 — revisión de diseño y accesibilidad (web)

Se recorrió la app con axe-core (WCAG 2 A/AA y buenas prácticas) sobre las pantallas principales, con teclado real y con una emulación de celular de 375 px. Resultado: **0 violaciones de axe en Inicio, Series, ficha de serie, Películas, Cronología, Ajustes (5 pestañas) y Admin**. Sin commits.

### Accesibilidad

| Archivo | Problema | Arreglo |
|---|---|---|
| `movie-poster-card.tsx`, `spotlight-saga-card.tsx`, `series-continue-watching.tsx`, `-SeriesCard.tsx` | Tarjetas `role="button"` con botones dentro (play, cola, "Ver en lista"): controles anidados (axe `nested-interactive`, grave). En el estante de Series, además, un botón invisible era enfocable. | Un `<button>` real e invisible bajo la tarjeta es el destino de teclado; el clic de mouse sigue en la tarjeta. Los play decorativos son `aria-hidden`. `article` → `div` donde iba `role="option"`. |
| `spotlight-hero.tsx`, `movies-hero.tsx` | `role="link"` sobre `h1`/`h2` anulaba el encabezado (Inicio sin `h1`). | El enlace va en un `span` dentro del encabezado. |
| `sectionbar.tsx` y varias rutas | `SectionBar` usaba siempre `h3`; `<main>` anidados; `aside` sin nombre; `alt` redundante del logo. | `headingLevel` (h2 por defecto), `h1` oculto en Series, `main` únicos, nombres y roles corregidos. |
| `player.tsx` | Con el reproductor abierto, 76 controles de la página de atrás seguían alcanzables con Tab. | `#root` pasa a `inert` mientras el player está montado; al cerrar, el foco vuelve al control de origen. |
| `PlayerSettingsMenu.tsx`, `player-bottombar.tsx` | Menú de configuración sin rol ni nombre, sin foco al abrir; `aria-expanded` engañoso en el botón de silencio. | `role="dialog"`, `aria-haspopup`/`aria-expanded`, el foco entra al abrir y vuelve al cerrar. |
| `modal.tsx`, `command.tsx` | Diálogos sin `title` dejaban `aria-labelledby` apuntando a nada (la paleta de comandos). | Título oculto con `srTitle` y un valor por defecto. |
| `admin/index.lazy.tsx` | `select` sin etiqueta. | `aria-label`. |

### Celular (375 px)

| Archivo | Problema | Arreglo |
|---|---|---|
| `spotlight-era-nav.tsx`, `ChronologyEraNav.tsx`, `series/index.lazy.tsx` | Las etiquetas de las pestañas se superponían: `flex-1` con `shrink-0` da `flex-basis: 0` y el botón medía solo el ícono. | `flex-[1_0_auto]`. |
| `spotlight-hero.tsx`, `movies-hero.tsx` | "Más información" se salía de la tarjeta y el ícono de play se aplastaba a un punto. | Fila con `flex-wrap`, `whitespace-nowrap` e íconos con `shrink-0`. |
| `premium-episode-list.tsx` | **Las filas de episodios se pisaban**: el virtualizador reservaba 106 px por fila y las reales medían 152–190 px. | `measureElement` + `getItemKey` por episodio. Medido: 0 superposiciones; en escritorio el paso pasa de 180 a 181 px. |
| `app-topnav.tsx`, `mobile-menu-sheet.tsx` (nuevo) | **El botón de hamburguesa no hacía nada**: guardaba `sidebarOpen` en el store de UI y nadie lo leía. En celular era la única vía a Ajustes (la barra inferior no lo incluye y la de escritorio no se ve). Tampoco había cómo abrir la cola ni el modo aleatorio. | Hoja inferior con Ajustes, Mi lista / Cola (con contador) y Reproducción aleatoria. Probado: abre, navega a `/settings`, abre la cola, 0 violaciones de axe. Test: `mobile-menu-sheet.test.tsx` (3). |
| `series/$seriesId/index.lazy.tsx` | "Contenido no encontrado" era un callejón sin salida (decía "vuelve al inicio" pero sin botón). | Botón "Volver a Series", como ya tenía la ficha de película. |
| `spotlight-hero.tsx` | Chips de sagas del hero cortados a 3 letras ("Emp…"). | Ancho natural (tope 160 px), fila con scroll y fundido lateral. |

Revisado sin cambios: la ruta inexistente muestra "Página no encontrada" con botón; Inicio ya tiene su estado de biblioteca vacía; los atajos del reproductor (espacio, →, `m`, `o`, `e`) responden; los recursos estáticos pesan menos de 260 KB (salvo audio y wasm de subtítulos, que cargan bajo demanda). Con el panel del navegador oculto react-query pausa los reintentos y la app queda en negro: es del entorno de prueba, no del producto (la ventana visible los retoma).

### Mensajes de error en español

Los toasts mostraban el error crudo del servidor en inglés ("media not found in library for ID 12", "Server Error: …", "Platform error"). Como los mensajes viven en decenas de handlers de Go y otras sesiones tocan el backend, se traduce en el cliente:

- `api/client/error-messages.ts` (nuevo): `translateServerError` (reglas: no encontrado, biblioteca no disponible, acceso denegado, Drive inactivo, solicitud inválida, demasiadas solicitudes; lo desconocido sale como "Error del servidor: …"), `errorText(err, fallback)` para los `catch`/`onError` (además "Failed to fetch" → "No se pudo conectar con el servidor de KameHouse."; `HTTP Error 500` → texto de respaldo) e `isFeatureDisabledError`.
- `requests.ts`: `_handleSeaError` usa lo anterior; "This feature is disabled" pasa a "Esta función está desactivada en la configuración."; "Unknown error" → "Error desconocido".
- 19 toasts con `err instanceof Error ? err.message : "…"` (ajustes, Drive, diagnóstico, pre-transcode, TMDB, respaldo) ahora usan `errorText`.
- Tests: `error-messages.test.ts` (13).

Un mensaje del servidor que no coincide con ninguna regla se sigue viendo en inglés dentro de los toasts de `errorText`: si aparece uno, basta sumar una regla.

### Legibilidad del hero

`hero-backdrop.tsx`: en el modo `right` el texto (hasta ~670 px) pasa el borde de la imagen y queda sobre personajes. Viñeta suave abajo a la izquierda (780×340 px), solo del tamaño del texto; el resto del arte no cambia. Comparado con y sin viñeta y en tres láminas del carrusel.

### Tests nuevos

`components/ui/a11y-cards.test.tsx` (7): sin controles anidados en `MoviePosterCard`, un solo `onClick` por activación, nivel de `SectionBar`, nombre accesible de `Modal`.

### Pendiente o decidido no tocar

- **Paleta de comandos** (`search/command-palette.tsx`): las filas eran una opción de `cmdk` con un `<Link>` y botones (Visto, Cola, Pre-TC, Match) dentro (axe: `nested-interactive`). Ahora la opción es el único destino principal (Enter y clic navegan o reproducen con `onSelect`; se quitaron los `<Link>` y la bandera `linkNavHandledRef`) y los botones son hermanos de la opción, posicionados a la derecha. Medido: 0 controles dentro de opciones, clic y Enter navegan, el botón no pisa el título. Queda una violación menor, `aria-required-children` en la lista (cmdk no admite botones dentro de su `listbox`); se probó y descartó esconderlos con `aria-hidden` (dejaría a los usuarios de teclado sin acceso) o moverlos a un pie (al bajar el mouse se cruzan otras filas y cambia el objetivo). Perdió `preload="intent"` de los enlaces. No se probó la fila de archivo huérfano (no hay en la biblioteca de prueba) ni pulsar "Visto" (modifica progreso).
- **Imágenes**: ver `docs/IMAGENES-PENDIENTES.md` (5 fondos del hero por debajo de 1440 px y una figura de Goku distinta para DB Kai).
- Sin verificar en un celular real: hover pegado, `dvh` con la barra de URL, teclado y zonas seguras.

