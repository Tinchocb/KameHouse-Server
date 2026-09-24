# KameHouse — Cambios detallados de la auditoría

**Rama:** `auditoria-nocturna-2026-09-24` · **Fechas:** 23 y 24/09/2026 · **Estado:** todo sin commitear, para que lo revises.

Cada cambio tiene: **Antes** (cómo estaba), **Después** (cómo quedó) y **Beneficio** (qué gana la app). Los que se midieron o probaron lo dicen con el dato. KameHouse TV no se tocó. La estructura de Inicio, Series y Películas (estantería, hero, etc.) se respetó.

---

## Resumen en números

| Qué | Antes | Después |
|---|---|---|
| Abrir una serie (visitas siguientes) | ~10,5 s | ~20 ms |
| Abrir una serie (la primera tras arrancar el server) | ~10,6 s | 3,2 s |
| Títulos de episodios sin "¡" o "¿" de apertura | 18 | 0 (vigilado con un test) |
| Botones del hero de Películas | No respondían | Funcionan |
| Error "archivo no encontrado" en el reproductor | 30 s de espera, mensaje engañoso | Al instante, mensaje claro |
| Clases de estilo que no generaban nada | ~190 | 0 (vigilado con `npm run lint:tokens`) |
| Navegación con teclado (Tab) | Sin indicador de foco en ninguna pantalla | Anillo visible con el color de la era |
| Tests del web | 264 | 270 |
| Tests nuevos del server | — | 10 |

---

## 1. Rendimiento y backend (Go)

### 1.1 Caché de TMDB que nunca funcionaba
- **Archivo:** `apps/server/internal/api/metadata_provider/tmdb_impl.go`
- **Antes:** los episodios de TMDB se guardaban en la base con una clave (el ID interno, p. ej. `4`) y se buscaban con otra (el ID de TMDB, p. ej. `12609`). El caché nunca encontraba nada y cada apertura de una serie volvía a descargar todas sus temporadas.
- **Después:** se guarda y se busca con la misma clave (ID de TMDB).
- **Beneficio:** una sola descarga por serie cada 7 días. Menos tráfico, menos riesgo de que TMDB limite la app y páginas de serie más rápidas.

### 1.2 Una sola instancia del proveedor TMDB
- **Archivos:** `metadata_provider/jikan_impl.go`, `metadata_provider/anilist_impl.go`
- **Antes:** Jikan y AniList creaban un proveedor TMDB nuevo en cada llamada, así que su caché en memoria se perdía siempre.
- **Después:** se crea una vez y se reutiliza (`sync.Once`).
- **Beneficio:** el caché en memoria sirve de verdad y se evitan lecturas repetidas a la base.

### 1.3 Jikan caído ya no frena la app
- **Archivos:** `jikan/client.go`, `metadata_provider/jikan_impl.go`
- **Antes:** Jikan (la fuente de datos de MyAnimeList) está caído y responde 504. En **cada** apertura de una serie la app hacía 3 intentos con esperas de 1, 2 y 4 s. La de 4 s llegaba **después** del último intento, o sea que no servía para nada. Resultado: ~10 s de espera siempre.
- **Después:**
  - Si una consulta falla, no se reintenta por 5 minutos; si Jikan entero está caído, se saltea para todas las series por 5 minutos.
  - Ante errores del servidor (5xx) se hacen 2 intentos en lugar de 3 y ya no se espera después del último.
  - Los errores de red y el límite de tasa (429) mantienen sus 3 intentos.
- **Beneficio (medido):** apertura de series de ~10,5 s a **~20 ms**; la primera tras arrancar el server, de ~10,6 s a **3,2 s**. Se ve lo mismo que antes, porque cuando Jikan falla la página ya se armaba sin sus datos.

### 1.3 bis Menos reintentos cuando Jikan está caído
- **Archivo:** `apps/server/internal/api/jikan/client.go` (+ `client_retry_test.go`)
- **Antes:** ante un error del servidor de Jikan (5xx) se hacían 3 intentos, y después del último se esperaban 4 s más antes de rendirse.
- **Después:** ante 5xx, 2 intentos y sin espera final. Los errores de red y el límite de tasa (429) mantienen 3 intentos.
- **Beneficio (medido):** la primera apertura de una serie tras arrancar el server bajó de ~10,6 s a **3,2 s**. Tiene 3 tests con un servidor de prueba.

### 1.4 Índice viejo que rompía el guardado del historial
- **Archivo:** `apps/server/internal/database/db/db.go`
- **Antes:** tu base tenía un índice viejo con el mismo nombre pero sobre otras columnas. La migración no lo reemplazaba y **todo guardado de telemetría en `watch_histories` fallaba** (error "ON CONFLICT…").
- **Después:** la migración revisa las columnas del índice y, si no coinciden, lo recrea. Borrar un índice no toca datos.
- **Beneficio:** la copia del historial en la base vuelve a guardarse. Verificado en tu base: índice corregido y las 170 filas intactas.

### 1.5 Abrir un episodio que no carga ya no borra tu progreso
- **Archivo:** `apps/server/internal/handlers/playback_sync.go`
- **Antes:** si abrías un episodio que no llegaba a cargar, el reproductor mandaba "posición 0 de 0" y eso **pisaba el progreso guardado** de ese episodio (el que ve "continuar viendo").
- **Después:** se descartan esos latidos vacíos; si hay duración conocida o avance real, se guarda como siempre.
- **Beneficio:** tu progreso ya no se pierde por abrir un episodio que falla.

### 1.6 Logs más útiles
- **Archivo:** `apps/server/internal/handlers/trace_middleware.go`
- **Antes:** cada WebSocket, SSE o stream de video se registraba como "petición lenta" al cerrarse, y eso llenaba el log.
- **Después:** se excluyen las conexiones que duran por diseño.
- **Beneficio:** las lentitudes reales se ven. Esa limpieza fue la que dejó a la vista la demora de Jikan.

### 1.7 Codegen al día
- **Archivos:** `apps/server/codegen/generated/*.json`
- **Antes:** metadata desactualizada respecto del código Go.
- **Después:** regenerado; los tipos TypeScript no cambiaron.
- **Beneficio:** `codegen:check` pasa sin diferencias.

---

## 2. Reproductor

### 2.1 Error inmediato y claro cuando falta el archivo
- **Archivos:** `player-orchestrator.tsx`, `player-core.ts`, `player-core.types.ts`, `usePlayerHls.ts`, `api/hooks/mediastream.hooks.ts`
- **Antes:** el server respondía "archivo no encontrado" al instante, pero el reproductor lo ignoraba: spinner durante 30 s y después "Transmisión caída (timeout 30 s). Verificá la conexión", un mensaje engañoso.
- **Después:** el error aparece al instante (probado: menos de 3 s) con un mensaje por causa. Por ejemplo: *"No encontramos el archivo de este episodio. Revisá que el disco o la carpeta de tu biblioteca estén conectados."* También cubre los casos de archivo fuera de la biblioteca y biblioteca no disponible.
- **Beneficio:** el usuario entiende qué pasa y cómo arreglarlo, sin esperar medio minuto.

### 2.2 Título del error según la causa
- **Archivo:** `player-overlays.tsx` (con test)
- **Antes:** siempre decía "TRANSMISIÓN CAÍDA", aunque el problema fuera un archivo faltante.
- **Después:** si falta el archivo dice "ARCHIVO NO DISPONIBLE"; si no, sigue "TRANSMISIÓN CAÍDA".
- **Beneficio:** el título ya no sugiere un problema de red cuando no lo es.

---

## 3. Inicio, Series y Películas (sin cambiar la estructura)

### 3.1 Botones del hero de Películas que no respondían
- **Archivo:** `routes/movies/-components/movies-hero.tsx`
- **Antes:** "Ver película", "Cola" y "Detalles" **no respondían a clics**: heredaban `pointer-events: none` del contenedor.
- **Después:** la fila de botones recupera los clics.
- **Beneficio:** el hero de Películas vuelve a ser usable. Verificado: "Detalles" abre la película.

### 3.2 "Reproducir" tapado por los botones flotantes
- **Archivos:** `lib/config/hero-stage.ts`, `components/ui/shimmer-skeleton.tsx`
- **Antes:** en pantallas de laptop (~900 px de alto o menos), el hero medía más que la pantalla y "Reproducir" quedaba debajo de los botones flotantes de abajo a la izquierda (aleatorio, maratón, audio). A 1440×900 el botón estaba en y 834–876 y los botones flotantes empezaban en y 832.
- **Después:** en desktop, el alto del hero se adapta a la pantalla, con un mínimo de 540 px para no tapar al personaje. Desde 1080 px de alto se ve igual que antes. El skeleton de carga usa la misma medida.
- **Beneficio (medido):** a 1440×900 el botón queda en y 781–823, y a 1366×768 "Ver serie" queda en y 642–686: libres en ambos casos. Además, el skeleton ya no produce un salto al cargar.

### 3.3 Parpadeo negro en el carrusel del hero
- **Archivos:** `components/ui/spotlight/spotlight-hero.tsx` (Inicio), `movies-hero.tsx` (Películas)
- **Antes:** al cambiar de serie, la imagen vieja desaparecía mientras la nueva aparecía, y a mitad de camino se veía el fondo negro. En Películas eran ~0,4 s de negro en cada cambio.
- **Después:** la imagen nueva aparece por encima y la vieja queda debajo hasta el final. Mismos tiempos y mismo movimiento.
- **Beneficio:** una transición continua, sin parpadeo. *Verificado por código y por el estado de las capas; conviene mirarlo en vivo.*

### 3.4 Mismo título de película en todos lados
- **Archivo:** `routes/movies/$movieId.lazy.tsx`
- **Antes:** el hero mostraba "100 Años Después" y al abrir el detalle la misma película pasaba a llamarse "La Legendaria Esfera de Cuatro Estrellas".
- **Después:** el detalle usa la misma regla de título que el hero y las tarjetas.
- **Beneficio:** la película no cambia de nombre al hacer clic. Verificado.

### 3.5 Textos en español
- **Archivos:** `lib/helpers/media.ts` (nuevo `getFormatLabel`, con test), `movies-hero.tsx`, `expandable-search.tsx`
- **Antes:** el hero de Películas y la búsqueda mostraban "MOVIE".
- **Después:** "PELÍCULA", "SERIE", "ESPECIAL"… desde una sola función compartida.
- **Beneficio:** toda la interfaz queda en el mismo idioma.

### 3.6 Número de volumen coherente en Series
- **Archivo:** `routes/series/index.lazy.tsx`
- **Antes:** en la estantería Super era "VOL. 5" y en la vista de portadas "VOL. 4" (se contaba por posición y Kai no está en tu biblioteca).
- **Después:** las dos vistas usan el número oficial de cada serie.
- **Beneficio:** la misma serie tiene el mismo número en todas las vistas.

### 3.7 Sinopsis de episodios del mismo alto
- **Archivo:** `routes/series/$seriesId/-components/premium-episode-list.tsx`
- **Antes:** el código pedía cortar la sinopsis en 2 líneas, pero otra clase lo anulaba: tarjetas de 2, 3 o 4 líneas de alturas dispares.
- **Después:** todas cortan en 2 líneas con "…".
- **Beneficio:** una lista pareja y prolija. Verificado con captura.

### 3.8 Búsqueda legible
- **Archivo:** `components/ui/app-layout/expandable-search.tsx`
- **Antes:** el desplegable de resultados era transparente y el texto de atrás se mezclaba con los resultados.
- **Después:** fondo opaco del sistema de diseño.
- **Beneficio:** los resultados se leen bien. Verificado con captura.

### 3.9 Lupas visibles en los buscadores
- **Archivos:** `movies-filter-bar.tsx`, `components/chronology/Header.tsx`, `premium-episode-list.tsx`
- **Antes:** el campo con desenfoque se pintaba encima del ícono de lupa, que no se veía o quedaba desalineado.
- **Después:** el ícono va por encima y tiene su tamaño correcto.
- **Beneficio:** los buscadores se reconocen a simple vista.

### 3.10 Colores del hero sin errores
- **Archivos:** `lib/helpers/images.ts` (nuevo `getPixelSampleImage`, con test), `hooks/use-image-palette.ts`, `hooks/use-dominant-colors.ts`
- **Antes:** el navegador bloqueaba por CORS la lectura de colores de las imágenes de TMDB (queda un error en consola y el hero pierde su tono de color) y además descargaba otra vez la imagen grande.
- **Después:** para leer los colores se pide una versión chica (w300) con su propia entrada de caché.
- **Beneficio:** el hero recupera su tono, sin errores, y la descarga extra es mínima.

### 3.11 Carga inicial más liviana
- **Archivo:** `apps/web/index.html`
- **Antes:** los 6 fondos del carrusel (~1 MB) se descargaban con prioridad en **todas** las pantallas, compitiendo con la carga inicial y llenando la consola de avisos.
- **Después:** el primero sigue con prioridad y los otros 5 se descargan cuando el navegador está libre.
- **Beneficio:** la carga inicial es más rápida y la rotación del carrusel sigue teniendo las imágenes listas. Verificado.

---

### 3.12 Nombres de sagas corregidos
- **Archivos:** `web/src/lib/config/dragonball_sagas.ts`, `server/internal/library/scanner/dragonball_sagas.go` (y su test)
- **Antes:** "Saga La Batalla de los Dioses" y "Saga La Resurrección de 'F'", distinto del nombre oficial del propio backend.
- **Después:** "Saga de la Batalla de los Dioses" y "Saga de la Resurrección de 'F'", iguales en todos lados.
- **Beneficio:** nombres correctos y coherentes. En los episodios ya escaneados, el nombre se actualiza con el próximo escaneo.

### 3.13 Signos de apertura en los títulos de episodios
- **Archivos:** `web/src/lib/config/db_titles.json` (16 títulos), `server/internal/api/metadata_provider/latin_overrides.json` (2 títulos), nuevo `db_titles.test.ts`
- **Antes:** "Aparece un mini Gokū! Son Gohan!", "El camino a la destrucción!", etc.: 18 títulos sin "¡" o "¿", y algunos con signos sueltos ("?!?", "!!").
- **Después:** corregidos uno por uno a mano (por ejemplo, "¡Aparece un mini Gokū! ¡Son Gohan!"). Un test falla si vuelve a aparecer un título sin su signo de apertura.
- **Beneficio:** títulos bien escritos en español, y así se quedan.

### 3.14 Imágenes de las sagas de DB Super
- **Antes:** las 8 tarjetas de sagas de Super mostraban la misma imagen.
- **Después:** cada saga muestra su propia imagen (verificado: 8 imágenes distintas).
- **Beneficio:** no hizo falta cambiar código. La causa era la demora de ~10 s de Jikan: las tarjetas se pintaban antes de tener los episodios y todas caían al fondo de la serie. Se resolvió con 1.3.

## 4. Ajustes

### 4.1 Aviso de carpeta no encontrada
- **Archivo:** `routes/settings/components.tsx`
- **Antes:** la biblioteca apuntaba a `D:\KameHouseMedia\…`, que no existe en esta PC, sin ningún aviso. Por eso no se podía reproducir nada.
- **Después:** cada carpeta que no existe muestra "No encontrada" en ámbar, con una explicación al pasar el mouse.
- **Beneficio:** el usuario ve enseguida por qué no se reproduce. Verificado con captura.

---

## 5. Sistema de diseño (tokens)

Una familia de bugs silenciosos: estilos escritos en el código que **nunca se generaban**, así que el diseño previsto no se veía.

### 5.1 Fondos con opacidad que no existían
- **Archivos:** `tailwind.config.ts` (helper `withAlpha`), `styles/tokens/colors.css`
- **Antes:** clases como `bg-surface-container-high/60` no generaban nada: ~150 estilos perdidos. Sin barras de scroll visibles, sin efectos al pasar el mouse en botones y nav, sin fondo en los paneles móviles, sin el vidrio de las píldoras del nav y sin el riel de la barra de progreso de la estantería.
- **Después:** esos colores aceptan opacidad; sin opacidad, el color es idéntico al de antes.
- **Beneficio:** aparece el diseño que ya estaba escrito. *Conviene mirarlo en vivo; si querés más o menos intensidad, se ajusta en un solo lugar (`colors.css`).*

### 5.2 Tokens faltantes
- **Archivos:** `tailwind.config.ts`, `colors.css`, `blur.css`
- **Antes:** se usaban tamaños, colores y efectos que no estaban definidos: `h-6.5` (el ícono de "Sagas & Arcos" de Inicio no tenía tamaño), `animate-pulse-slow` (los estados vacíos no respiraban), `brand-warning` (9 usos con color inválido), `--blur-overlay-xs`, `font-kanji`…
- **Después:** definidos en el sistema de diseño.
- **Beneficio:** esos elementos se ven como fueron pensados.

### 5.3 Botón "secondary" sin fondo
- **Archivo:** `components/ui/button/button.tsx`
- **Antes:** usaba colores inexistentes, así que todo botón "secondary" se veía transparente.
- **Después:** usa los tokens de superficie del sistema.
- **Beneficio:** botones secundarios visibles y consistentes.

### 5.4 Menús y paneles debajo del nav
- **Archivos:** `vaul/index.tsx`, `popover.tsx`, `GlossaryDrawer.tsx`, `-dragonball-scanner-live.tsx`, `loading-overlay.tsx`
- **Antes:** los paneles móviles, los popovers, el glosario de Cronología y el modal del escáner quedaban **debajo** del nav (capa 50 contra 500). El panel móvil, además, tenía un fondo inválido.
- **Después:** usan las capas del sistema (overlay, modal, popover) y un fondo válido.
- **Beneficio:** ya no quedan tapados ni transparentes.

### 5.5 Colores inválidos en Cronología
- **Archivos:** 7 archivos de `components/chronology/`
- **Antes:** 17 estilos como `var(--acento)20` (CSS inválido) anulaban fondos, bordes y gradientes enteros.
- **Después:** `color-mix(...)` con la misma transparencia.
- **Beneficio:** las tarjetas y paneles de Cronología muestran sus colores de era. Verificado en el navegador.

### 5.6 Clases con nombres que no existen
- **Archivos:** varios
- **Antes:** `shadow-xs`, `text-md`, `duration-quick`, `xs:`, `font-bebas`, `font-cinzel`, etc., sin efecto.
- **Después:** reemplazadas por su equivalente del sistema.
- **Beneficio:** estilos consistentes y sin nada "fantasma".

### 5.7 Verificador para que no vuelva a pasar
- **Archivos:** `apps/web/scripts/check-tokens.mjs` (nuevo), `apps/web/package.json` (`npm run lint:tokens`)
- **Antes:** estos errores pasaban sin aviso por el typecheck, el lint y los tests.
- **Después:** un comando revisa ~2.160 clases y ~280 variables CSS y falla si aparece alguna rota. Probado metiendo errores a propósito.
- **Beneficio:** esta familia de bugs queda vigilada. Conviene sumarlo a CI.

---

## 6. Accesibilidad y teclado

### 6.1 Foco visible al navegar con Tab
- **Archivo:** `src/app/globals.css`
- **Antes:** una regla global borraba todo indicador de foco: navegando con Tab **no se veía dónde se estaba**, en ninguna pantalla.
- **Después:** con mouse todo sigue igual; con teclado aparece un anillo de 2 px con el color de la era. Se excluyen los campos de texto, los modales y el modo TV, que ya tiene su propio estilo.
- **Beneficio:** la app se puede usar con teclado. Verificado: con Tab aparece el anillo, con clic no.

### 6.2 Tarjetas que solo respondían al mouse
- **Archivos:** `spotlight-saga-card.tsx`, `movie-poster-card.tsx`, `TimelineMasterView.tsx`, `-dragonball-scanner-live.tsx`
- **Antes:** las tarjetas de saga y de película (Inicio y Películas), los volúmenes de Cronología y las fichas del escáner no se podían enfocar ni abrir con teclado.
- **Después:** se enfocan con Tab y se abren con Enter o Espacio, y los lectores de pantalla las anuncian con nombre. Enter sobre el botón "Reproducir" interno no dispara también la navegación.
- **Beneficio:** navegación completa con teclado o control remoto. Verificado: Enter sobre una saga la abre.

### 6.3 Detalles de accesibilidad
- **Archivos:** `floating-pill-nav.tsx`, `routes/settings/components.tsx`, 6 archivos con `py-0.2`
- **Antes:** el nav se anunciaba como "Navegación Cinejoy" (otra marca), el botón de borrar carpeta no tenía nombre para lectores de pantalla y había una clase de espaciado inválida.
- **Después:** "Navegación flotante de KameHouse", botón con nombre y espaciado corregido.
- **Beneficio:** la app se anuncia correctamente y su marca es coherente.

---

## 7. Configuración y calidad

### 7.1 Configuración de build válida
- **Archivos:** `apps/web/rsbuild.config.ts`, `apps/web/tailwind.config.ts`
- **Antes:** opciones que Rsbuild no reconoce se ignoraban sin avisar: una división de código que nunca funcionó y *source maps* de producción que nunca se generaron. Además, `tsconfig.node.json` tenía errores de tipos.
- **Después:** configuración válida con el mismo resultado de build (mismo tamaño y, por decisión, sin *source maps* en producción: es una app local y activarlos publicaría el código desde el server). Sin errores de tipos.
- **Beneficio:** la configuración hace lo que dice y el typecheck completo pasa.

### 7.2 Lint limpio y formato
- **Archivos:** `TimelineMasterView.tsx` y los archivos Go tocados
- **Antes:** 2 advertencias de `eslint` y archivos Go fuera de formato.
- **Después:** `eslint` sin advertencias y `gofmt` aplicado.
- **Beneficio:** base de código más prolija.

---

## 8. Tests agregados

| Test | Qué protege |
|---|---|
| `jikan/client_retry_test.go` | 5xx: 2 intentos y falla rápido; no reintenta un 404; decodifica bien |
| `metadata_provider/jikan_failure_cache_test.go` | Caché de fallos de Jikan y su reinicio |
| `database/db/watch_history_index_test.go` | Base con índice viejo → migración → el guardado funciona |
| `handlers/trace_middleware_test.go` | Detección de conexiones largas |
| `handlers/telemetry_validation_test.go` | Descarte del latido vacío (caso nuevo) |
| `lib/helpers/images.test.ts` | `getPixelSampleImage` |
| `lib/helpers/media.test.ts` | `getFormatLabel` |
| `components/video/player-overlays.test.tsx` | Título "Archivo no disponible" |

---

## 9. Estado final

| App | Resultado |
|---|---|
| Server (Go) | `go build`, `go vet` y los 37 paquetes con tests OK |
| Web | `tsc` OK (app y config), `eslint` sin advertencias, `lint:tokens` OK, **268 tests OK**, build de producción OK, dev server arranca sin errores |
| Desktop (Tauri) | `cargo check` OK (sin cambios) |

## 10. Para revisar primero
1. **El vidrio oscuro nuevo del nav y los efectos al pasar el mouse** (5.1): se ajusta en un solo lugar si no te convence.
2. **Las transiciones del carrusel** (3.3): corregidas por código, no vistas en vivo.
3. **El anillo de foco con Tab** (6.1).
4. **Restos de mis pruebas:** 2 entradas vacías de DBZ en el historial y una fila vacía en `watch_histories`. No pisaron progreso tuyo y se pueden borrar.

## 11. Aviso: otra sesión trabajando en el repo
Mientras revisaba vi que **hay otra sesión corriendo sobre el mismo repo** ("Mejoras de consistencia en diseño"), y que durante la madrugada corrieron otras. Verifiqué que todos mis cambios siguen en su lugar y en esta rama, y dejé de editar para no pisarnos. Antes de commitear, conviene revisar `git diff` teniendo en cuenta que hay cambios de más de una sesión.

## 12. Drive
Me contaste que los episodios están en Drive. Hoy en esta instancia Drive figura **desconectado** (`connected: false`, 0 episodios indexados) y los 659 archivos de la biblioteca todavía apuntan a `D:\KameHouseMedia`. Para usar Drive hay que conectarlo desde Ajustes con tu cuenta de Google (eso lo tenés que hacer vos) y lanzar un escaneo de Drive. Revisé el código de reproducción desde Drive: soporta rangos (adelantar), `HEAD` con tamaño desde la base y streaming con buffer, sin problemas a la vista.

## 13. Pendientes que necesitan una decisión tuya
- **Historial en dos lugares:** hoy existe en el filecache y en la tabla de la base, con cuentas distintas (0 y 1). El endpoint `/home/continue-watching` siempre devuelve vacío (el frontend no lo usa). Hay que elegir una sola fuente de verdad.
- **Jikan sigue caído** (problema externo): convendría mostrar el estado de los proveedores en Ajustes.
- **Datos:** las sagas de DB Super comparten imagen, una se llama "Saga La Batalla de los Dioses" (le falta "de") y a algunos títulos de TMDB les falta el "¡" de apertura.

Detalle técnico completo en `AUDITORIA_NOCTURNA.md`. Para revisar: `git status` y `git diff` en la rama.
