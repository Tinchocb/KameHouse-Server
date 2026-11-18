# Tema Por era de KameHouse

Decisiones acordadas el 29 de octubre de 2026 y ejecución por fases. El diagnóstico inicial es histórico: las secciones marcadas como hechas describen el trabajo aplicado después.

Los estilos viven en [era.css](../apps/web/src/styles/themes/era.css); las sagas, en [era.theme.ts](../apps/web/src/lib/theme/era.theme.ts). Complementa la [guía de diseño](DESIGN-GUIDE.md) y el documento del [tema Minimalista](TEMA-MINIMALISTA.md).

## Consolidación: Por era con diseño Neutro — 11/11/2026

La aplicación consolida sus opciones de apariencia en dos temas visibles: **Minimalista** y **Por era**. Neutro deja de aparecer como tema independiente, integrando su estructura, controles, biseles y profundidad visual directamente en Por era:
- **Estructura y biseles:** reutiliza la jerarquía, tipografía, escala de elevación Black Cinema (`#08080A` a `#22222A`) y Double-Bezel Specular Border de Neutro, extrayendo las recetas compartidas en `neutral.css` y `cinematic-controls.css` para evitar duplicaciones o solapamiento de reglas.
- **Colores:** base oscura y grafito; la paleta de cada una de las 7 sagas se aplica a acciones principales, selección persistente e indicadores (barra flotante, barras de progreso de dos tonos, nodos de cronología, insignias). Textos y superficies de lectura predominantemente neutros (`#F5F5F7`, `#CCCCCC`, `#B8B8B8`) para máxima legibilidad.
- **Tinte ambiental suave:** fondos con firmas de saga (`--page-gradient`), viñetas en héroes y reflejos especulares de vidrio sutilmente entintados.
- **Liquid Glass:** integrado de forma adaptativa en navegación, selectores y superficies flotantes destacadas (`data-liquid="true"`), con materiales ligeros (0px blur) en tarjetas y catálogos, y alternativa plana (`data-flat="true"`) cuando la transparencia está reducida.
- **Compatibilidad:** las preferencias antiguas de Neutro (`classic`) se convierten automáticamente a Por era con Universo DB, conservando las preferencias de transparencia (`themeEnableBlurringEffects`) y efectos (`themeEnableLiquidGlass`). El valor `classic` se mantiene como entrada compatible.

## Refinamiento de controles — 6/11/2026

La capa [cinematic-controls.css](../apps/web/src/styles/themes/cinematic-controls.css) comparte tipografía y comportamiento con Neutro, preservando las siete paletas y sus firmas. La acción principal conserva el acento pleno; selección persistente y segmentados usan el acento al 12 % sobre la superficie y filete al 40 %. Los secundarios pierden biseles y sombras superpuestas; el vidrio conserva profundidad discreta. Las tarjetas de elección mantienen foco visible sin un segundo marco luminoso.

El texto pequeño tiene piso de 12 px; las ayudas usan 13 px y las etiquetas de fila/campo, 16 px / 600. Los switches independientes y embebidos mantienen la misma geometría, área táctil y atenuación. La reducción de transparencia conserva una receta sólida funcional para cada paleta. La identidad, el arte y el seguimiento de Universo DB no cambian; Minimalista queda excluido de esta capa.

## Identidad buscada

**Cada saga se siente distinta, sin tapar el arte.** Por era es el tema con más color de los tres: la interfaz toma la atmósfera de la saga y suma guiños de Dragon Ball discretos. El contenido sigue siendo el protagonista.

## Diagnóstico al 29/10

- **Parece Neutro con otro color.** Superficies y vidrio se tiñen del 3 al 8 % con el acento (`era.css:241-331`). En Z, el panel queda `#121319` contra `#15151C` en Neutro.
- **Se perciben unas 4 atmósferas, no 7.** Daima y Universo tienen fondos casi iguales (`#100A18` contra `#100B17`), GT, Daima y Universo comparten el ciruela, y Z y Super el azul marino.
- **Universo DB no cumple lo que promete.** Solo cambia dentro de la ficha de serie o película, con un `data-theme` local (`series/$seriesId/index.lazy.tsx:437-443`, `movies/$movieId.lazy.tsx:179-181`). Ahí mezcla el acento de la saga con superficies violetas, porque las superficies derivadas se resuelven en `<html>`. El reproductor (portal a `body`), Inicio, Cronología y los modales siguen en violeta, y el cambio de color es instantáneo.
- **No tiene detalles propios de Dragon Ball.** Kanji, esferas y scouter son iguales en los 3 temas.
- **Pantallas que no cambian:** el indicador de la barra flotante (`bg-white/95`, `floating-pill-nav.tsx:301,330`), el EraRail, el hero de Películas y la Cronología, cuyos chips usan el acento global dentro de secciones pintadas con el color de su propia era (`AlternatingTimeline.tsx:517-539`).
- **Deuda técnica:**
  - El HSL y el hex de un mismo token no coinciden. Por ejemplo, el secundario de Z es `#315FBD` en hex y `#2463EB` en HSL (`era.css:56-57,72-86`).
  - A Kai le falta su lugar en la capa cónica de Universo (`era.css:345-353`). En la barra de la Cronología no corresponde: ordena eras dentro del universo, y Kai es una reedición de Z.
  - Un `!important` impide el fundido de la capa de Universo (`era.css:343-344`).
  - Hay tokens sin consumidor: `--glow-color-*`, `--sidebar-*` y `--glass-panel-bg*`.
  - El contraste del secundario como texto no llega a AA: Z 3,7:1, GT 3,2:1 y Super 3,6:1.
  - La descripción de DB habla de un verde Shenron, pero su secundario es azul.
- **Riesgo a verificar:** Por era fuerza `enableColorSettings=true`. Si queda guardado un `accentColor` o un `backgroundColor`, `apply-custom-theme.ts:144-158` los escribe inline en `<html>` y pisan todas las sagas.

## Decisiones

| Tema | Decisión |
| --- | --- |
| Orden del selector | Minimalista y Por era. Neutro se integra como base compartida. |
| Intensidad | **Atmósfera marcada.** Superficies y vidrio entre el 8 y el 14 %, fondo ambiental algo más presente. Los grises fríos sueltos (píldoras `glass-frosted`, botón Volver, carril del switch, `label-2`) también se tiñen. |
| Universo DB | **Sigue lo que ves.** Toda la app toma la era activa: hero de Inicio, sección visible de la Cronología, fichas, reproductor y modales. Fuera de contexto (Ajustes, búsqueda) vuelve al violeta multicolor. Entre paletas hay un fundido de unos 400 ms. |
| Alcance | **Navegación y pantallas clave.** El indicador de la barra flotante, el EraRail y el hero de Películas toman el color de la era. En la Cronología, chips y marcadores usan el color de su sección. El reproductor sigue grafito, pero la barra, el pulgar y los overlays usan la era correcta. |
| Detalles de Dragon Ball | **Guiños discretos.** El kanji de la saga como marca de agua tenue en el hero y los paneles, un aura de ki suave en el foco y el hover de las tarjetas, y las 7 esferas como hitos de progreso de la serie. Se apagan con movimiento reducido y en modo ahorro. |
| Diferenciar sagas | **Firma por saga.** Rampas de fondo separadas, una dupla de color reconocible por saga con el secundario a la vista, y un fondo con forma propia en cada una (ver la tabla siguiente). |
| Selector en Apariencia | **Carrusel.** Una saga grande por vez, con su paleta aplicada, y flechas para pasar a la siguiente. |
| Bug de Daima en Inicio | **Corregido.** `eraIdFromThemeEra` (`lib/config/eras.ts`) traduce `era-daima` a `dbdaima`; tiene tests en `eras.test.ts`. |

### Firma por saga

| Saga | Dupla | Fondo propuesto |
| --- | --- | --- |
| Dragon Ball | naranja y azul | Atardecer cálido desde el horizonte |
| Dragon Ball Z | dorado y azul cobalto | Aura dorada que sube desde abajo |
| Dragon Ball GT | rojo y violeta | Degradado rojo y violeta en diagonal |
| Dragon Ball Kai | verde y naranja | *A definir*: propuesta de bruma esmeralda lateral |
| Dragon Ball Super | azul y púrpura | Brillo divino desde arriba |
| Dragon Ball Daima | púrpura y dorado | *A definir*: propuesta de resplandor dorado en un fondo púrpura negro |
| Universo DB | multicolor | Capa cónica con las 6 sagas, Kai incluida |

## Preguntas abiertas

1. ~~**Carrusel:** ¿pasar de saga la aplica al instante, o hace falta un botón «Usar esta saga»?~~ Resuelta en la fase 6: se aplica al instante, como antes al tocar una saga.
2. ~~**Fondos de Kai y Daima:** confirmar las propuestas de la tabla o elegir otras.~~ Resuelta en la fase 4: se usaron las propuestas; el usuario puede pedir otras.

## Plan por fases

Cada fase se puede revisar y usar por separado. El orden reduce el riesgo: primero la base de tokens, después el comportamiento y al final la decoración.

### Fase 0 · Base — **hecha el 29/10**

- El HSL y el hex de cada saga son el mismo color: las clases de Tailwind y los `color-mix` ya no muestran dos secundarios distintos.
- Kai está en la capa cónica de Universo. En `ERA_KEYS` de la Cronología no se agregó (ver el diagnóstico).
- Las descripciones de `ERA_THEME_PRESETS` nombran la dupla y la atmósfera de cada saga.
- **El riesgo del color inline era real.** La base de la versión instalada tenía un acento `#ff6e3a` y un fondo `#070707`, restos de la UI vieja, y el reset de fábrica escribe `#C8102E` y `#050506`. Con Por era, todas las sagas se veían con ese acento. Ahora `apply-custom-theme.ts` ignora los colores personalizados en modo era.
- Se borraron de `era.css` los tokens sin consumidor (`--sidebar-*`, `--glow-color-*`, `--glass-panel-bg*`, `--glass-liquid-bg`), los bloques `amoled` y `cyberpunk` y el `--glass-bg` local de cada saga, que en modo plano dejaba un velo traslúcido dentro de las fichas. Los equivalentes en `colors.css` y `neutral.css` siguen ahí, también sin uso.

### Fase 1 · Intensidad y duplas (`era.css`) — **hecha el 29/10**

- Cada saga tiene su color de atmósfera, `--era-tint`, y su rampa `--bg-*`, diseñados en OKLCH con los tonos separados. Las superficies se tiñen con la atmósfera y no con el acento: en Z, el dorado mezclado con azul daba gris.
- Tinte de superficies: capas del 8 al 12 % con vidrio y del 8 al 14 % en plano; vidrio entre el 10 y el 14 %.
- Dupla visible: degradé de acento a secundario en las barras de progreso (Continuar viendo, episodios, hero contraído y saga activa), brillo del secundario en el fondo ambiental (del 10 al 14 %) y en la tarjeta de vidrio.
- Grises teñidos: `label-2`, `on-surface-variant`, `on-surface-rgb` (y con él `label-3`), vidrio esmerilado (modales, islas, botón Volver), interruptor apagado, bordes de contenido, SectionBar y vidrio, `outline` y las superficies MD3.
- Texto oscuro sobre el acento y el secundario en todas las sagas. En Universo pasó de blanco a oscuro, porque su acento se aclaró de `#805AC2` a `#9872DD` para llegar a AA como texto. El secundario se aclaró en DB, Z, GT, Super y Universo.
- **Medición** (Chrome headless sobre los CSS reales y, después, en la app):

  | | Antes | Ahora |
  | --- | --- | --- |
  | Par de sagas más parecido (ΔE OKLab de la capa 2) | 1,1 (Universo y Daima) | 2,8 (Universo y Super) |
  | Z frente a Neutro (capa 1) | 1,1 | 3,3 |
  | Acento como texto sobre las capas 1 y 2 | 3,2 a 4,4 en cuatro sagas | 4,5 o más en las 7 |
  | Secundario como texto sobre el fondo | 3,2 a 3,7 en Z, GT y Super | 5,3 o más |
  | `label-2` sobre la capa 2 | — | 7,9 a 8,1 |

- **Excepción aceptada:** el acento como texto sobre la capa 3 (hover y tarjeta activa) queda entre 3,9 y 4,07:1 en Universo, GT, Super y Daima. Para llegar a 4,5 habría que aclarar esos acentos de forma visible (ΔE de 3,6 a 12), lo que los alejaría de los colores de saga del contenido.
- Los scripts de medición y el generador de paletas estaban en el scratchpad de la sesión del 29/10; para volver a medir, seguir el método de la memoria `tonalidad-por-era-tokens`.

### Fase 2 · Universo sigue lo que ves — **hecha el 30/10**

- **Era en pantalla** (`lib/theme/screen-era.ts`): la publican la ficha de serie, la de película, el hero de Inicio (también su rotación automática, decisión del 30/10) y la sección visible de la Cronología, cuando el scroll lleva 250 ms quieto. Manda la última pantalla montada.
- **Con Universo DB elegido**, `<html>` toma esa era en `data-theme`. Se borraron los temas locales de las fichas, así que ya no hay mezcla de superficies, y el reproductor, los modales y la barra flotante siguen la saga. Sin era publicada (Ajustes, búsqueda, listados y la cabecera de la Cronología) queda el violeta de Universo con su capa cónica.
- **El reproductor** no publica nada: vive dentro de la ficha (o de la Cronología) y hereda la era de `<html>`.
- **Fundido de 400 ms solo dentro de una misma pantalla** (el hero que rota, el scroll que pasa de sección). Al entrar o salir de una pantalla, el cambio es instantáneo, porque la ruta ya trae su fundido de entrada.
  - Se hace con `@property`: los 8 colores base se registran y transicionan bajo `data-era-fade`.
  - Solo con el nivel de movimiento completo (ni movimiento reducido, ni ahorro, ni equipos modestos).
  - Un scroll lo corta en el acto.
- **Se descartaron las View Transitions.** Durante una, Chrome manda todos los clics a `<html>` aunque la capa tenga `pointer-events: none`; con la rotación cada 5 s se perdían clics en Inicio.
- **El hero de Inicio** pausa su rotación con un movimiento real del puntero (`pointermove`), no con `mouseenter`. Al terminar un fundido, Chrome recalcula el hover y disparaba un `mouseenter` con el puntero quieto, lo que dejaba la rotación pausada para siempre.
- **La capa cónica de Universo** ya no usa `!important`: aparece y desaparece con su transición de opacidad.
- **Medición** (Chrome headless, build de producción, cambio de paleta aislado):

  | Página | Cuadro mediano sin fundido | Cuadro mediano con fundido |
  | --- | --- | --- |
  | Inicio | 6 ms | 6 a 12 ms |
  | Cronología (~1.600 nodos) | 6 ms | 30 ms (cerca de 30 cuadros por segundo durante 400 ms) |

  El costo es el recálculo de estilos y el repintado de toda la página en cada cuadro. En la Cronología se acepta porque el fundido llega recién con el scroll quieto y se corta si se retoma.
- **Verificación.** Recorrido completo en Chrome headless (Inicio, ficha, listado, Cronología), clic durante el fundido, corte por scroll y rotación del hero con el puntero quieto y en movimiento. Registrar los colores con `@property` no cambia nada fuera de Por era: 285 comparaciones (19 modos, con y sin plano, de 15 tokens) dan cero diferencias con y sin las reglas.
- **La revisión adversarial con agentes no se completó** (se cortó por el límite de uso y después se detuvo a mano). No se revisó a fondo el ciclo de vida: cambios rápidos de ficha, volver atrás y el reproductor abierto durante un cambio de saga. La app no usa StrictMode y el hook retira su era al desmontarse.

### Fase 3 · Pantallas clave — **hecha el 30/10**

- **Barra flotante:** el indicador de la pastilla activa toma el acento de la saga (antes `bg-white/95` fijo), con un brillo suave que se apaga en modo plano. El texto del ítem activo sigue negro.
- **EraRail** (riel de escritorio y barra móvil): el ítem activo se tiñe con el acento de su propia era al 16 % (`--era-item-accent`, que pone el componente), con vidrio y en plano. El kanji y el filete ya usaban ese acento.
- **Cronología:** los nodos de la línea central (activos e inactivos) y el reloj y el porcentaje del encabezado de cada era usan el color de su sección (`--era` y `--era-text`, que ahora pone cada fila y cada encabezado) y no el acento del tema. Con la saga DB fija, la sección de Z se ve amarilla y no naranja. Solo en Por era: Neutro y Minimalista no cambian.
- **Reproductor:** no necesitó cambios. La barra, el pulgar y los overlays usan `bg-brand-accent` y `hsl(var(--brand-accent))`, que se resuelven en `<html>`; con Universo, la fase 2 ya hace que `<html>` tome la era de la ficha. Con una saga fija, el reproductor usa la saga elegida, por diseño.
- **Hero de Películas:** sin cambios. Ya pinta con el color de la era de cada película (`ERA_COLOR_MAP`) en Neutro y en Por era; el diagnóstico inicial lo daba por idéntico entre temas, pero lo que no cambia es el color del contenido, no una omisión.
- **Pendiente menor:** la barrita de avance del inspector de lapsos (`volume-scrubber-fill`) sigue yendo del acento global a ámbar. Con Universo sigue la era visible; con una saga fija usa la saga.
- **Medido en la app** (saga DB fija): indicador de la barra `rgb(249, 115, 22)` (el naranja de DB); ítem activo del riel con el acento de su era al 16 %; nodos de la Cronología `rgb(242, 118, 46)` en Dragon Ball y `rgb(245, 194, 66)` en Z; reloj del encabezado en el color de cada era.

### Fase 4 · Firma por saga — **hecha el 30/10**

- **Cada saga tiene su forma de fondo** (`--page-gradient` en `era.css`, pintado por `body::before`), hecha solo con los tokens de su paleta:

  | Saga | Forma |
  | --- | --- |
  | Dragon Ball | Atardecer: horizonte naranja abajo y cielo azul tenue arriba |
  | Dragon Ball Z | Aura dorada que sube desde abajo al centro, con el cobalto en las esquinas de arriba |
  | Dragon Ball GT | Diagonal: rojo arriba a la izquierda, violeta abajo a la derecha, un toque de dorado al centro |
  | Dragon Ball Kai | Bruma esmeralda que entra por el costado izquierdo y naranja tenue al otro lado |
  | Dragon Ball Super | Brillo divino desde arriba con un haz más claro al centro, y púrpura abajo |
  | Dragon Ball Daima | Resplandor dorado al centro, con el violeta en dos esquinas |
  | Universo DB | Sin cambios: su nebulosa de tres tonos y la capa cónica |

- **Kai y Daima** quedaron con las propuestas del documento (bruma lateral y resplandor central). Si preferís otra forma, es cambiar un bloque.
- **En modo plano y en ahorro** (`data-flat`) el fondo queda sin forma: se usa la fórmula base (acento arriba a la izquierda, secundario abajo a la derecha). Medido: en los 7 temas con plano, el degradé resuelto es la fórmula base.
- **Contraste medido** (Chrome headless, CSS reales, píxel más claro del fondo sin tarjetas): `label-2` queda entre 5,66:1 (Z) y 7,74:1 (Daima), todas por encima de 4,5. Z necesitó bajar la intensidad del aura (de 28 y 22 % a 20 y 14 %): con la primera versión llegaba a 4,15.
- El dorado de Z sobre el negro azulado se ve algo oliva al mezclarse; es lo que da el 20 % de oro sobre cobalto oscuro.

### Fase 5 · Guiños de Dragon Ball — **hecha el 30/10**

- **Kanji de marca de agua:** un kanji enorme (`min(62vmin, 38rem)`), con el acento al 7 %, fijo abajo a la derecha, detrás de todo y por encima del fondo con forma. Se asoma entre los paneles de vidrio. Cada saga tiene el suyo: 龍 Universo, 亀 DB, 悟 Z, 星 GT, 改 Kai, 超 Super y 魔 Daima. Con Universo sigue a la saga en pantalla. Es una capa de página (`body::after`), no uno por panel. El encabezado de era de la Cronología ya tenía su propio kanji en todos los temas.
- **Aura de ki:** las filas de contenido (`.surface-content-row`, entre ellas las de episodio) y las tarjetas de arco inactivas ganan un brillo del acento al pasar el mouse y con el foco de teclado (`:has(:focus-visible)`, no con el clic). Las filas recomponen sus sombras de siempre más el brillo. Los pósters de película y las tarjetas de saga de Inicio ya tenían su propio halo con el color de la era, así que no se tocaron.
- **Esferas del Dragón:** en el encabezado de cada era de la Cronología, junto a la línea de progreso, 7 esferas (`DragonBallMeter`): una se enciende por cada séptimo completado, con el brillo del color de la era; las apagadas van en gris al 30 %. `litDragonBalls` redondea hacia abajo con tolerancia de punto flotante (100/7·k enciende exactamente k). Usa las imágenes `star-1..7.png` que ya tenía el loader.
- **Por qué solo en la Cronología:** en la ficha de serie, el avance cuenta como visto solo el último episodio reproducido (`use-series-data.ts`, que decide `watched` por la continuidad), así que unas esferas ahí marcarían casi siempre 0. El avance real por era está en la Cronología. Eso queda como hallazgo aparte.
- **Se apagan:** con movimiento reducido y en plano o ahorro (`data-flat`) no hay kanji ni aura (CSS); con movimiento reducido o equipos modestos las esferas no se muestran (el componente exige el nivel de movimiento completo).
- **Medido** (Chrome headless): el kanji pone `content: "悟"` con Z, `none` con movimiento reducido o plano; 5 encabezados con 7 esferas cada uno con movimiento normal y 0 con movimiento reducido desde el inicio; hover y foco de teclado agregan el brillo dorado al borde de las filas de la ficha de DBZ. El contraste de `label-2` sobre el punto más claro de cada fondo, ahora con el kanji, queda entre 5,66:1 (Z) y 7,74:1 (Daima).
- **Esferas encendidas:** en la base de desarrollo los avances son del 0 al 4 %, así que no se vio una era con esferas encendidas dentro de la app; se probó con tests y con una imagen del mismo marcado.

### Fase 6 · Selector en carrusel (`appearance-tab.tsx`)

- Una saga grande por vez, con su fondo, la dupla, el kanji, la descripción y la posición (por ejemplo, «3 de 7»).
- Se navega con flechas en pantalla, ← y → del teclado, deslizando en táctil y con el control de la TV, manteniendo el patrón de `radiogroup` accesible.
- Universo DB va primero.
- **Hecha el 31/10** (`routes/settings/tabs/saga-carousel.tsx`, reemplaza la grilla de siete tarjetas):
  - Una saga por vez, en una tarjeta con su paleta real (`data-theme` de la saga), su kanji, el año, el nombre, la descripción y su dupla de colores.
  - Flechas en pantalla («Saga anterior» y «siguiente», con vuelta al final), `←` `→` `Inicio` `Fin` con el foco en el carrusel (también el control de la TV), puntos para ir directo a una saga y un deslizamiento en táctil y lápiz (el arrastre del ratón no cambia de saga).
  - Posición «3 de 7» en una región en vivo, para lectores de pantalla. Universo DB va primero.
  - **Navegar aplica la saga al instante** (la recomendación de la pregunta abierta). «Guardar» la persiste, como antes.
  - Medido en Chrome: las flechas, el teclado, los puntos y la vuelta funcionan; cada paso cambia la paleta de `<html>`; sin errores de consola. En celular (375 px) no hay desbordamiento y la tarjeta se lee bien.
  - **Sin verificar en un dispositivo táctil real**: el deslizamiento está probado solo con sus funciones puras (`swipeStep`, `keyTargetIndex`) y no con un gesto real.

## Revisión con agentes de las fases 2 a 5 (31/10)

Tres revisores (estado y ciclo de vida, CSS y accesibilidad, componentes y rendimiento) y un verificador escéptico por hallazgo. De 22 hallazgos, 17 se confirmaron y 5 se descartaron.

**Corregido:**
- **Esferas:** la era de 7 lapsos con 1, 4 o 5 leídos encendía una esfera de menos, porque el porcentaje se redondeaba antes de contar. Ahora el medidor recibe la fracción exacta y tiene un test de regresión (`EraHero.test.tsx`).
- **Re-render del shell:** cada cambio de era en pantalla re-renderizaba todo el shell (barra, islas, reproductor en cola). El hook de tema vive ahora en una hoja que no pinta nada, hermana del shell (`__root.tsx`).
- **Rotación del hero con reproductor abierto:** el hero seguía rotando debajo del overlay del reproductor y recoloreaba los controles del video cada 5 s. Ahora pausa mientras haya un video (`isVideoActive`).
- **Rotación en táctil:** un arrastre no pausaba el hero y la pausa no se liberaba; ahora solo cuenta el puntero de ratón y se libera al levantar el dedo.
- **Ficha de Kai Final Chapters (42705):** no publicaba era y quedaba en violeta. Ahora usa la paleta de Kai.
- **Scroll del selector de eras:** el scroll del riel cortaba el fundido de paleta. Ahora el scroll del selector no lo corta.
- **Espía de secciones:** devolvía una sección vieja cuando la lista quedaba vacía. Ahora devuelve nada.
- **Kanji de fondo:** lo leían los lectores de pantalla. Ahora tiene texto alternativo vacío, dentro de `@supports`.
- **Aura de ki:** se aplicaba también a paneles no interactivos y a las filas de la Cronología, donde el recorte de `content-visibility` la cortaba. Ahora solo va a las filas de episodio y a las tarjetas de arco inactivas, y no pisa la fila activa. Las tarjetas de arco conservan su brillo de borde.
- **Insignia de episodio:** el texto en el acento de cada saga quedaba por debajo de 4,5:1 en algunas. Ahora usa el tono claro calibrado de cada saga (Universo usa su acento aclarado).

**Pendiente, con razón:**
- **Cronología, de «sin era» a una era:** el cambio ocurre en seco en una página ya visible. Arreglarlo exige distinguir una página que entra de una que ya está visible, y eso cambia la semántica del store de eras; como es cosmético y el arreglo puede meter un fundido al entrar, quedó para más adelante.

**Descartados por la verificación:** el test faltante de `useScreenEra` (sin defecto de comportamiento), el peso de los PNG de las esferas (sin problema real), el modo de alto contraste sobre el kanji (no reproducible), el «tocar para leer» (la pausa en táctil es la intención del código) y la falta de tests en las fases 2, 3 y 5 (no es un defecto).

**Verificado solo por código y tests** (no en la app): la pausa del hero con reproductor abierto, el arreglo táctil y el re-render del shell. Tests de las zonas afectadas pasan (611), tipos sin errores y ESLint limpio. Hay un test de `goku-panorama.test.ts` que falla por un cambio ajeno en ese archivo, que no es parte de Por era.
