# Tema Minimalista de KameHouse

Descripción del tema y de las decisiones acordadas al 27 de octubre de 2026.

Este documento complementa la sección 12 de [DESIGN-GUIDE.md](DESIGN-GUIDE.md). Sirve como contexto para revisar y mejorar la interfaz; los estilos efectivos se definen en [classic-minimalist.css](../apps/web/src/styles/themes/classic-minimalist.css).

El [UI Kit interactivo](ui-kit/minimalista.html) permite probar componentes, estados y recetas de código. Su [documentación](ui-kit/README.md) distingue los componentes actuales de las composiciones de prueba y las variantes propuestas.

## Identidad

**El arte en primer plano. Controles discretos y navegación sencilla.**

Minimalista busca una experiencia cinematográfica tranquila, con pocos elementos compitiendo por la atención. Las ilustraciones, personajes y portadas de Dragon Ball aportan la identidad y el color. La interfaz los acompaña con fondos oscuros, controles blancos y grises y una jerarquía clara.

La sensación buscada es de orden, legibilidad y espacio. Cada bloque debe tener una prioridad reconocible y las acciones secundarias deben seguir siendo fáciles de encontrar.

## Decisiones que se conservan

- Mantener personajes, ilustraciones, portadas y encuadres existentes.
- Conservar las rutas y funciones de KameHouse.
- Mantener el orden del Home: selector de eras, hero y catálogo.
- Conservar Por era como segundo tema independiente, incluida su paleta Negro. Neutro aporta su base compartida a Por era.
- Tratar el movimiento como preferencia independiente de la identidad del tema. La transparencia dejó de serlo el 31 de octubre de 2026: Minimalista es plano por diseño.
- Agrupar las funciones ocasionales en menús con nombres claros y acceso por teclado.

La propuesta de dar prioridad a «Continuar viendo» en el Home quedó fuera del alcance aprobado. Una mejora del tema debe respetar esa decisión mientras no se acuerde cambiarla.

## Principios de diseño

1. **Contenido protagonista.** El arte debe conservar su presencia y su encuadre; los controles ocupan un segundo plano visual.
2. **Una acción dominante por bloque.** Reproducir o la acción principal recibe el mayor contraste. Filtros, navegación y utilidades usan selecciones más tenues.
3. **Información suficiente para decidir.** Título, episodio, duración y progreso se muestran cuando son relevantes y existen datos disponibles.
4. **Menos repetición.** Evitar duplicar rangos de episodios, conteos, nombres de saga o acciones de reproducción dentro de una misma tarjeta.
5. **Funciones fáciles de descubrir.** Los menús secundarios deben explicar qué contienen y conservar las funciones que agrupan.
6. **Legibilidad y feedback.** El foco, la selección, la carga y los estados deben poder distinguirse dentro de la estética sobria.

## Contrato

Qué significa «minimalista» en KameHouse, en reglas que se pueden medir. Lo acordado el 31 de octubre de 2026: quitar el desenfoque, ser más planos y llevar todos los botones al estilo de «Reproducir» y «Más información» del hero de Inicio. Cada regla dice cómo se comprueba; las marcadas con *guarda* hacen fallar `classic-minimalist.guard.test.ts` si se rompen.

| # | Regla | Cómo se cumple | Comprobación |
|---|---|---|---|
| 1 | **Plano.** Cero superficies con desenfoque en toda la app. | Minimalista es un motivo del modo plano (`resolveFlatReason` → `"theme"`): `<html data-flat="true">` anula todo `backdrop-filter` y cada componente usa su fondo sólido. El tema no declara `backdrop-filter`. | *Guarda* y `flat-reason.test.ts` |
| 2 | **Monocromo.** El cromo usa solo la rampa de grises y el blanco perla. | Blanco pleno reservado para la acción principal de cada bloque. Navegación, filtros y selección persistente usan rellenos tenues (`--minimal-fill-3`, hover `--minimal-fill-4`, borde `--minimal-line-4`) conservando texto claro (`--minimal-text-1`). Calificaciones, vistos y progreso van en blanco o gris. | *Guarda* (los `--minimal-*` no tienen saturación propia) y colores literales solo en `tokens.css` |
| 3 | **Excepciones de color**, y solo estas. | El selector de eras (su color lo pinta el componente), la estantería de Series (arte por era) y el rojo de error o acción destructiva, que es funcional. | Revisión |
| 4 | **Dos recetas de botón.** | Primaria: perla plano, texto oscuro, peso 600. Secundaria: blanco al 8 % (`--minimal-fill-3`), filete de 1 px al 12 %, canto superior y peso 500. Valen para Button, CTAs, `.btn-ui` y `.ep-action-btn`. Tallas de 46, 40 y 36 px. Ghost y outline derivan de la secundaria. | Tokens `--minimal-primary-*` y `--minimal-secondary-*` |
| 5 | **Cuatro tamaños de texto y dos pesos.** | 12 (piso), 13, 14 y 16 px; pesos 500 y 600; sin mayúsculas forzadas. | *Guarda* |
| 6 | **Radios concéntricos.** | 16 → 12 → 8 → 6 px; píldora solo para navegación e indicadores que ya tengan esa función. | *Guarda* |
| 7 | **Sombra solo en lo que flota.** | Navegación flotante, menús, diálogos, tooltips y avisos; además, el cursor de la línea de tiempo. Tarjetas y hero van sin sombras exteriores ni elevación. El único halo es el de «Reproducir» del hero. | Tokens `--minimal-shadow-float`, `-menu`, `-modal`, `-control` y `-cta` |
| 8 | **Movimiento breve y sin rebote.** | 160 ms para feedback y 180 ms para entradas o cambios, sin rebote. Pulsación `scale(0.98)` y elevación de 1 px reservada exclusivamente a las acciones del hero y la ficha; retirada la elevación de tarjetas. Con movimiento reducido: transiciones inmediatas (duración 0), sin desplazamientos ni escalas. | Tokens `--minimal-transition`, `--minimal-press` y capa de kinetics |

En Ajustes → Apariencia, se mantienen los controles de vidrio y refracción visibles y deshabilitados, con ayudas legibles que explican que Minimalista es plano por diseño (0 px de desenfoque), sin sobrescribir ni perder los valores guardados que utilizará el tema Por era.

### Controles

Los botones, chips, filas de ajuste y opciones en tarjeta siguen las mismas reglas de forma. [controls.css](../apps/web/src/styles/themes/classic-minimalist/controls.css) reasigna las clases de Tailwind a la escala del tema: en este proyecto `rounded-xl` vale 20 px y `rounded-2xl`, 24 px; el tema los lleva a 12 y 16 px. `font-bold` y `font-extrabold` pasan a 600, y `text-2xs` a 12 px como piso. Un control de texto sin clase de peso usa 500, y también las tarjetas que son `role="button"`. Las pastillas quedan solo en islas de navegación y en iconos circulares. El selector de orden (`combobox`) usa 12 px y los chips de búsqueda, 8 px. Las tarjetas no ganan sombra al pasar el cursor.

Excepciones: los encabezados de sección de Ajustes (24 px), los indicadores de paginación del carrusel (píldoras) y el selector de eras, que pinta el color de cada saga.

Medición del 31/10 (escritorio, doce rutas, tema forzado en cada carga, después del ajuste de `role="button"`): 502 controles únicos, de los cuales 26 tienen texto fuera del contrato. Los 26 son encabezados de sección de Ajustes a 24 px (excepción). Las siete píldoras que quedan son los indicadores de paginación del carrusel de Películas (excepción). El reproductor se midió en su estado de error («No se pudo reproducir»), porque la precarga del servidor quedó bloqueada en la auditoría: sus botones con texto cumplen el contrato, y los dos iconos de 32 px solo tienen una fuente de 20 px sin texto visible. La reproducción normal no se midió.

## Lenguaje visual

### Color y superficies

La base es oscura y el único acento es el blanco perla. Los colores de las ilustraciones permanecen intactos.

| Uso | Token | Valor |
|---|---|---|
| Fondo principal | `--minimal-canvas` | `#08080A` |
| Superficie: islas, menús, modales, avisos, campos | `--minimal-surface` | `#141418` |
| Superficie elevada: tooltip, campo en foco | `--minimal-surface-raised` | `#1A1A20` |
| Hover o selección sobre superficie | `--minimal-surface-hover` | `#24242A` |
| Acción principal | `--minimal-accent` / `--minimal-on-accent` | Blanco perla `#F5F5F7`, con texto `#08080A` |
| Texto principal | `--minimal-text-1` | `#F5F5F7` (hover y énfasis: `--minimal-text-hi`, `#FFFFFF`) |
| Texto secundario | `--minimal-text-2` | `#C0C0C7` |
| Texto atenuado | `--minimal-text-3` | `#9898A0` |
| Placeholder | `--minimal-text-4` | `#86868E` |

Los valores viven en [tokens.css](../apps/web/src/styles/themes/classic-minimalist/tokens.css), en cuatro capas: primitivas, semánticos `--minimal-*`, el contrato global de la app y los acentos de era. Además de la tabla, define rellenos (`--minimal-fill-1…5`, blanco del 4 al 16 %), líneas (`--minimal-line-1…5`, del 6 al 32 %), las recetas de botón, sombras por uso, radios, tamaños de texto y movimiento. El tema reasigna a esa rampa `--flat-*`, `--neutral-elev-*`, `--label-*` y los colores de shadcn, así que los componentes compartidos usan los mismos grises que los propios del tema.

Contraste medido sobre la rampa: el texto secundario supera 8,5:1 y el atenuado 5,3:1 en todas las superficies.

### Tipografía

La escala se aplica por función, no por cantidad de texto:

| Función | Tamaño / peso | Uso |
|---|---|---|
| Título de página o hero | Escala propia de la composición / 600 | Outfit, caja natural, líneas equilibradas; no se reduce a 16 px |
| Título de sección | Escala existente (habitualmente 24 px) / 600 | Separa bloques; sin sombra de texto |
| Título de fila | 16 px / 600 | `type-headline` |
| Cuerpo y botón estándar | 14 px / 500; primario 600 | `type-body`; cuerpo con interlineado 1,6 |
| Descripción y metadatos | 13 px / 500 | `type-caption`, descripción de SectionBar; metadatos con cifras tabulares |
| Etiqueta | 12 px / 500 | `type-label`, sin mayúsculas impuestas ni espaciado expandido |

Los colores funcionales de error se conservan. Los tamaños de título son excepciones explícitas a los cuatro tamaños de los controles.

En dispositivos táctiles, los campos de entrada usan al menos 16 px, aunque su talla de escritorio sea compacta. Esta excepción evita que la escala de etiquetas se aplique al texto editable.

- Outfit para títulos; el hero usa peso 600 y caja natural.
- Texto de cuerpo con la familia sans del sistema de diseño.
- Monoespaciada y cifras tabulares para contadores, tiempos y metadatos técnicos.
- Títulos equilibrados y sin palabras aisladas cuando el ancho lo permita.
- Tamaños del tema: `--minimal-font-xs` 12 px (piso), `-sm` 13, `-md` 14 y `-lg` 16. Pesos: `--minimal-weight-medium` 500 y `-semibold` 600.
- Sin mayúsculas forzadas; solo acrónimos (4K, HDR, DBZ).

La rampa heredada `--fs-2xs…5xs` también resuelve a 12 px en este tema. Los shorthands de caption y etiqueta, los pesos heredados y el título de página usan los mismos tokens; las utilidades de mayúsculas y tracking expandido quedan neutralizadas. Las etiquetas de fila de Ajustes, las opciones reutilizables y `BasicField` comparten 16 px / 600; las ayudas y errores usan 13 px / 500. Las ayudas leen `--minimal-text-2`, mientras los errores conservan su color funcional. El texto editable usa 14 px en escritorio y al menos 16 px en táctil.

### Geometría y espaciado

| Elemento | Referencia actual |
|---|---|
| Contenedores principales, hero, modales y avisos | Radio de 16 px |
| Botones, campos y tarjetas | Radio de 12 px |
| Elementos internos y botón chico | Radio de 8 px |
| Insignias y contadores | Radio de 6 px |
| Islas de navegación | Píldora |
| Acciones del hero y de la ficha | Altura de 46 px |
| Botones de sección y de fila | 40 px y 36 px |
| Área mínima de interacción | 44 px |
| Gap del contenedor principal del Home | 24 px en móvil; 32 px desde 768 px |
| Separación entre tarjetas de saga en escritorio | 20 px |

La separación visible entre bloques también incluye el padding de sus componentes. Los valores anteriores describen los ajustes del tema, no una distancia total única entre todos los elementos.

### Recetas de botones y estados

| Nivel | Cuándo usarlo | Tratamiento |
|---|---|---|
| Primario | Una acción dominante por bloque: reproducir, guardar, confirmar | Perla, texto oscuro, peso 600; blanco en hover y perla más oscuro al pulsar |
| Secundario | Acción que acompaña a la principal | Blanco al 8 %, filete al 12 %, peso 500; relleno al 12 % en hover y al 16 % al pulsar |
| Discreto (`ghost`) | Utilidades sobre superficie: detalles, restablecer, más opciones | Texto atenuado; relleno tenue en hover; no usar sobre arte sin una superficie legible |
| Contorno (`outline`) | Alternativa que necesita un límite visible | Filete secundario sin relleno de reposo |
| Destructivo | Eliminar o confirmar una acción irreversible | Conserva el rojo funcional; comparte forma, talla, texto y foco |

`Button`: `xs`/`sm` usan 36 px de alto, texto de 13 px y radio de 8 px; `md`, 40 px, texto de 14 px y radio de 12 px; `lg`/`xl`, 46 px, texto de 14 px y radio de 12 px. El padding horizontal usa `--minimal-control-padding-sm/md/lg`: 14, 18 y 22 px, respectivamente. Las tallas `icon-sm`, `icon` e `icon-lg` permanecen cuadradas a 36, 40 y 46 px, sin padding de texto. `IconButton` conserva sus tallas propias y su escala de glifos; `data-icon-size` identifica su talla real, independientemente de la talla base de `Button`. Sus tallas `xs`/`sm` usan radio de 8 px. En dispositivos táctiles, botones e indicadores segmentados tienen un mínimo de 44 px; los botones de icono también reservan ese ancho.

La selección persistente (`aria-pressed`) usa relleno al 16 % y texto claro en secundarios, discretos y contornos. El foco de teclado conserva el anillo del tema. Deshabilitado usa opacidad del 45 %; durante la carga (`aria-busy`) el botón mantiene su contraste y permanece bloqueado por el componente. Los alias cromáticos antiguos se resuelven a las recetas monocromas; las acciones destructivas conservan su semántica.

Los alias de secundarios, discretos y contornos comparten también la pulsación y la selección persistente con su receta actual, incluido `glass` en las acciones de ficha. Las acciones de episodio deshabilitadas usan la misma opacidad que `Button`. Los popovers compartidos y los selectores usan la misma superficie, filete, radio y sombra de menú del tema.

El canto de hover de los secundarios no reemplaza el anillo de teclado. Los selectores segmentados usan la misma pulsación y reducción de movimiento; sus opciones deshabilitadas no responden al hover. Si las etiquetas no caben, se desplaza el interior del selector. Las opciones de menú mantienen al menos 44 px en táctil, y las ayudas largas se parten dentro del ancho de la ventana.

### Presupuesto de efectos

- Hover de botones, hero, tarjetas y acciones rápidas solo con ratón. En controles comunes cambia el contraste; la elevación de 1 px se reserva a las acciones del hero y la ficha.
- Pulsación al 98 %, sin rebote, con contraste propio; no se acumula elevación con compresión.
- Transiciones de 160–180 ms sobre propiedades explícitas. Movimiento reducido anula estas transiciones y transformaciones.
- Sin desenfoque, brillo por filtro ni sombras en tarjetas. El canto interior secundario describe el borde; no eleva el botón. Solo «Reproducir» del hero conserva su halo.
- Sombras de distancia únicamente en elementos flotantes. Foco, selección y carga tienen funciones distintas y no dependen de una animación para reconocerse.

El componente `Skeleton` se identifica mediante `data-skeleton`: en Minimalista queda estático y plano, conservando el radio de la superficie que representa. Los indicadores de actividad que usan `animate-pulse` no reciben los estilos de esqueleto. Los CTA del hero deshabilitados no se elevan ni intensifican su halo; durante la pulsación se comprimen sin sumar elevación.

### Respuesta de movimiento

Las microinteracciones CSS usan respuestas breves, habitualmente entre 160 y 180 ms. La pulsación se expresa con una compresión sutil y el hover principal puede elevar el control 1 px.

Las animaciones compartidas siguen el sistema de movimiento de KameHouse. Las preferencias de movimiento reducido deben respetarse; el menú de acciones rápidas se abre sin animación cuando esa preferencia está activa.

## Comportamiento por superficie

### Navegación

Desde 768 px, marca, destinos, búsqueda y ajustes se integran en una sola franja. Inicio, Series, Películas, Cronología y Mi lista mantienen sus nombres visibles. La marca puede compactarse a su logo.

Maratón, Sorpréndeme y Música de fondo se agrupan en **Acciones rápidas**. El menú lleva el foco a sus controles al abrirse y se cierra al cambiar de ruta, entrar en pantalla completa o pasar a móvil. Sorpréndeme cierra primero este menú y después abre su diálogo.

La búsqueda se expande sobre la franja sin desplazar los destinos. En móvil se mantiene la estructura existente de cabecera, menú y navegación inferior.

La selección de la navegación inferior usa el fondo secundario tenue y radio de 8 px. Los cinco destinos reparten el ancho según su contenido y conservan un área de interacción de al menos 44 px. Desde 768 px, el tema reserva el espacio superior mediante `--chrome-top`; Home, Administración y los consumidores sticky comparten ese contrato.

El selector de eras se presenta como una barra tipográfica subordinada a la navegación principal, también en escritorio. Todos sus nombres permanecen visibles; cuando no caben, la barra permite desplazamiento horizontal y lleva la era activa a la vista. Conserva sus nombres accesibles, selección por flechas y estados sin contenido. Neutro y Por era mantienen su presentación anterior.

### Campos y controles

Los campos estándar usan una superficie sólida `#141418` y radio de 12 px. `TextInput` ofrece además `appearance="line"`, con etiqueta persistente y una sola línea inferior. Las filas de entrada de Ajustes usan esa presentación en Minimalista. El foco se dibuja una sola vez: en el contenedor del buscador o en la línea del campo.

Los campos de línea reservan espacio para sus iconos. Los errores indicados con `aria-invalid="true"` conservan un borde rojo funcional al editar: filete interior en campos sólidos y subrayado en campos de línea. En `OsInput`, tanto el foco como el error pertenecen al contenedor; el input embebido no añade otro anillo. Los campos de solo lectura conservan la selección de texto y presentan una línea discontinua; los deshabilitados se atenúan una sola vez. El hover de los campos sólidos se limita a dispositivos con ratón y a campos editables.

Los interruptores de Ajustes conservan el fondo de su fila al activarse. El estado visual pertenece al control `SpringSwitch`, que usa `brand-accent` para el track y `on-primary` para el pulgar; el rol accesible de la fila no determina su fondo.

`SpringSwitch` expone `data-switch`, `data-checked`, `data-disabled` y `data-switch-thumb`: la pista comparte materia y geometría tanto independiente como embebida. Conserva la forma funcional de interruptor, a 36 × 20 o 46 × 26 px; un pseudo-elemento reserva al menos 44 × 44 px de interacción sin agrandar la pista. El pulgar es plano, sin sombra ni punto decorativo. Una fila deshabilitada se atenúa una sola vez. El foco pertenece a la fila cuando esta es el control accesible, con un solo anillo.

Las tarjetas de elección de Ajustes usan selección tenue y un filete, sin marco luminoso duplicado ni elevación. `RadioCardGroup` ofrece una sola entrada por Tab, flechas con retorno por los extremos y Home/End; selección y foco se desplazan juntos. Las descripciones de `RangeSlider` se asocian mediante `aria-describedby`.

En Minimalista, Apariencia oculta la comparación interactiva entre vidrio y plano y muestra «Reducir transparencia» activado y deshabilitado, con una explicación del tema. Las preferencias de transparencia de Neutro y Por era se conservan: no se reescriben al mostrar este estado.

`TextArea` forma parte de la librería compartida, con etiqueta, ayuda, error asociado y contador opcional en Space Mono (`showCount`, con `maxLength` nativo). Está disponible para las vistas que necesiten texto multilínea; no añade formularios nuevos al producto.

### Home y catálogo

El Home conserva su composición y su orden. El tema aporta más aire entre bloques, títulos más sobrios y metadatos continuos.

- Las sagas conservan sus miniaturas panorámicas.
- El rango de episodios aparece debajo del título y se elimina su insignia superior duplicada.
- Se conserva la indicación de relleno cuando corresponde.
- La duración de las películas permanece visible sin hover cuando está disponible.
- Las barras muestran el progreso disponible y usan el blanco del tema.
- Las sinopsis extensas se consultan en las fichas; las miniaturas priorizan arte, título y datos breves.

Los cambios visuales se aplican mediante clases semánticas en componentes compartidos. Los datos de duración o progreso se muestran únicamente cuando el componente los recibe.

### Reproductor

El reproductor conserva sus controles principales, audio, subtítulos, calidad, imagen y opciones de reproducción.

Las acciones secundarias se encuentran en **Más opciones**:

- Retroceder y adelantar 10 segundos.
- Mi lista, cuando contiene elementos.
- Abrir en mpv, cuando la aplicación ofrece esa función.

Abrir Mi lista o entregar la reproducción a mpv cierra primero el menú. Durante la apertura de mpv se impide repetir la acción. Los atajos de teclado se conservan.

Maratón mantiene su acceso directo en la barra inferior del reproductor. Cambia la continuidad de reproducción y los saltos automáticos; la experiencia para televisores corresponde a KameHouseTV.

La línea de tiempo conserva sus capítulos y marcadores de intro y créditos reales. El tema amplía el área de interacción a 44 px, mantiene la línea visual fina y usa separadores discretos sobre el progreso. Si no recibe capítulos, no agrega divisiones. El foco de teclado se muestra sobre la línea, sin superponer el control nativo.

### Otras vistas

Series, Películas, Cronología, Ajustes y los diálogos comparten los criterios de tipografía, controles discretos y superficies del tema. Sus composiciones siguen las necesidades de cada pantalla.

## Accesibilidad y preferencias

- Conservar nombres accesibles en controles de icono.
- Mostrar el foco de teclado con claridad.
- Mantener áreas pulsables amplias aunque el icono sea pequeño.
- Permitir encontrar las funciones mediante menús y teclado.
- Acompañar los estados importantes con texto o iconos cuando corresponda.
- Como el tema es plano, la legibilidad no depende del desenfoque: el texto sobre arte va sobre superficie sólida o sobre el scrim del hero.
- Como el cromo es monocromo, los estados no dependen solo del color: llevan texto, icono o posición.
- Respetar las preferencias de movimiento reducido y las safe areas del dispositivo.

## Contrato técnico

El nombre visible es **Minimalista**. Sus identificadores internos se conservan para mantener la compatibilidad de la configuración:

```text
themeMode = "classic-minimalist"

<html
  data-mode="classic"
  data-theme="classic"
  data-ui-style="classic-minimalist"
  data-flat="true"
>
```

El script previo al primer pintado de `index.html` aplica los mismos cuatro atributos, para que ni el primer cuadro muestre vidrio ni otro tema.

Se selecciona en **Ajustes → Apariencia → Tema**. La aplicación inmediata utiliza `themeVisual.themeMode` en el estado de interfaz, persistido localmente en `kamehouse-ui-settings`.

Los estilos se limitan al selector `[data-ui-style="classic-minimalist"]:not([data-tv="true"])`. La exclusión de `data-tv` es defensiva.

| Responsabilidad | Archivo |
|---|---|
| Guía general y contrato del tema | [DESIGN-GUIDE.md](DESIGN-GUIDE.md) |
| Estilos y tokens específicos | [classic-minimalist.css](../apps/web/src/styles/themes/classic-minimalist.css) |
| Nombre, descripción y metadatos | [classic-minimalist.theme.ts](../apps/web/src/lib/theme/classic-minimalist.theme.ts) |
| Registro de los tres temas | [themes-registry.ts](../apps/web/src/lib/theme/themes-registry.ts) |
| Aplicación del tema | [apply-custom-theme.ts](../apps/web/src/lib/theme/apply-custom-theme.ts) |
| Navegación de escritorio | [floating-pill-nav.tsx](../apps/web/src/components/ui/app-layout/floating-pill-nav.tsx) |
| Tarjetas de saga | [spotlight-saga-card.tsx](../apps/web/src/components/ui/spotlight/spotlight-saga-card.tsx) |
| Tarjetas de películas | [movie-poster-card.tsx](../apps/web/src/components/ui/movie-poster-card.tsx) |
| Menú del reproductor | [PlayerSettingsMenu.tsx](../apps/web/src/components/ui/PlayerSettingsMenu.tsx) |

## Criterios para seguir mejorándolo

La próxima revisión debe evaluar la jerarquía del selector de eras frente a la navegación principal, la cantidad de información visible en las tarjetas y la consistencia entre pantallas. Estas son líneas de revisión, no cambios adicionales ya implementados.

Para cada propuesta conviene comprobar:

- Qué tarea del usuario hace más clara o más fácil.
- Qué elemento deja de competir innecesariamente con el contenido.
- Cómo se encuentra cualquier función que pasa a un menú.
- Si se conservan el arte, el encuadre, el foco y la legibilidad.
- Cómo se comporta con datos vacíos, títulos largos, móvil y preferencias de accesibilidad.

## Alcance de la validación existente

Tras integrar el UI Kit el 27 de octubre de 2026 pasaron TypeScript, ESLint sobre las fuentes afectadas y 87 pruebas focalizadas. Se revisó el Home con datos de prueba en Minimalista, Neutro y Por era a 320, 390, 768, 1024 y 1440 px, sin desbordamientos ni controles de navegación superpuestos. También se comprobaron búsqueda, foco, acciones rápidas, transparencia reducida y el cierre del menú al pasar a móvil.

Los campos reales de Ajustes conservaron fondo transparente, línea inferior, un único foco y 44 px de altura; su vista móvil no desbordó. El kit portable pasó 21 ejemplos y 50 combinaciones de estado sin errores de JavaScript ni solicitudes HTTP. Las muestras adicionales comprobaron el contador, la selección de eras por flechas, el seek por teclado y el foco único del buscador.

Esa comprobación no incluyó reproducción real ni el handoff real a mpv. La revisión del 28 de octubre detectó fallos de contraste, tipografía y adaptación móvil que esas pruebas no cubrían; los resultados anteriores no acreditan la corrección visual de todos los estados.

### Correcciones y comprobaciones del 28 de octubre de 2026

Se corrigieron los nueve hallazgos de esa revisión: filas de interruptores, sinopsis sobre arte claro, contraste de los nodos de Cronología, navegación inferior, jerarquía tipográfica, títulos compactos, nombre accesible del menú móvil, etiqueta de música y espacio de Administración.

Pasaron TypeScript y 54 pruebas focalizadas en siete suites. Las dos regresiones nuevas comprueban el nombre accesible de la hoja móvil y la devolución del foco. ESLint terminó sin errores; conserva una advertencia previa sobre el efecto que cierra las acciones rápidas al cambiar de contexto.

En el navegador se comprobaron las filas de Ajustes con fondo transparente y ayudas de 12 px, los heroes y fichas con peso 600, y la navegación móvil con cinco destinos de al menos 44 px y selección tenue. A 320 px, Cronología compacta usa dos líneas y un título de 12 px; el nombre completo permanece disponible. Se revisó el scrim sobre Dragon Ball y Daima sin cambiar los encuadres. Los puntos de cambio de navegación de 767/768 px no desbordaron, y Administración mantuvo separación bajo la barra a 768, 1280 y 1440 px.

Neutro y Por era conservaron sus estilos de navegación y ayudas; los nodos activos usaron el primer plano `on-primary` en los tres temas. La transparencia reducida dejó la navegación de Minimalista sólida y sin blur. El menú real, montado con estado ficticio, permitió elegir audio y subtítulos; al terminar el cierre desapareció la hoja, se liberaron los clics y volvió el foco al disparador.

El HTML portable del UI Kit se regeneró. Su interruptor real respondió al clic, Espacio y Enter, presentó el estado deshabilitado y mostró las reglas corregidas en el inspector. También se comprobaron los controles de ancho de 320 px, transparencia reducida y movimiento reducido del kit.

Estas verificaciones usan datos locales de prueba y no acreditan reproducción real, Drive, entrega a mpv, funcionamiento operativo de Administración ni comportamiento en dispositivos físicos.

### Definición de controles y texto del 4 de noviembre de 2026

Se unificaron las tallas de `Button`, la jerarquía de texto semántica, los alias cromáticos antiguos y los estados de pulsación, carga, selección y deshabilitado. Los efectos hover de botones, hero, tarjetas y acciones rápidas se limitan a ratón. El tema incluye `typography.css` como consumidor de sus tokens.

Pasaron 16 pruebas focalizadas de contrato CSS, recetas de botones y registro de temas. Una muestra renderizada con los componentes React reales `Button` e `IconButton` y el CSS global compilado pasó 22 comprobaciones en Chrome: tallas, pesos, estados, foco por teclado, pulsación, movimiento reducido y áreas táctiles. Se revisaron las capturas a 1440 y 390 px, sin desbordamientos en la muestra. Esta comprobación no recorre las rutas completas del producto ni valida dispositivos físicos. El HTML portable histórico del UI Kit no se regeneró en esta iteración.

La revisión ampliada del mismo día corrigió la identificación de Skeleton, la competencia entre foco y sombras de hover, los estados de los selectores, los tamaños táctiles y el ajuste de ayudas largas. Pasaron 27 pruebas focalizadas y ESLint de Skeleton; la suite de selectores emitió avisos de React sobre `act`. Otra muestra con Button, Skeleton y SegmentedControl reales pasó 20 comprobaciones en Chrome, incluyendo ancho de 320 px y aislamiento del Skeleton en Neutro. Los menús y tooltips de esa muestra usan marcado representativo; no se verificó su apertura real. El detalle y los límites están en [la revisión ampliada](auditoria/minimalista-2026-11-04.md).

### Extensión a pantallas completas del 7 de noviembre de 2026

Se extendió la coherencia visual y de controles canónicos a todas las superficies principales de la aplicación:

1. **Inicio y catálogos (`/`, `/series`, `/movies`):**
   - Navegación móvil anclada inferior con radios concéntricos (`--minimal-radius-md`), hit targets de 44 px y unificación de estados `aria-pressed`.
   - Clamping responsive dinámico de la estantería Kanzenban en Series (`334 px` a `390 px`), eliminando 37 px de recorte horizontal en móvil; CTA «Abrir serie» canónico.
   - En Películas, reemplazo de botones interactivos anidados por indicadores visuales no interactivos (`.movie-card-cta`), suprimiendo halos y desenfoques redundantes.
2. **Fichas de series y películas (`/series/$seriesId`, `/movies/$movieId`):**
   - Unificación de la acción primaria con `PrimaryPlayButton` (`.spotlight-play-cta`) y acciones secundarias con `RoundAction`, eliminando bifurcaciones de botones nativos.
   - Supresión de botones de reproducción redundantes (`.episode-row-redundant-play`) en filas compactas de episodios en Minimalista.
3. **Cronología y modales (`/chronology`, `VolumeInspectorModal`, `CharacterDetailModal`):**
   - Migración de la navegación entre lapsos e hitos en el inspector a `Button` canónico (`intent="ghost"`, `size="xs"`), sustituyendo recetas ad-hoc con opacidad deshabilitada del 30 % por `--minimal-disabled-opacity` / `--control-disabled-opacity`.
   - Botones de desplazamiento del riel filmstrip migrados a `IconButton` (`size="xs"`, 44 px táctil).
   - Radios concéntricos en `.volume-nav-group` (8 px contenedor, 6 px botones internos) y `.volume-scrubber-fill` monocromático.
   - `CharacterDetailModal` migrado a `IconButton` (`intent="glass"`), limpiando sombras y estilos inline.
4. **Reproductor de video (`SeekBar`, `PlayerBottomBar`, `Overlays`):**
   - Botones de salto y siguiente episodio (`.player-skip-btn`, `.player-next-ep-btn`) vinculados a `--minimal-radius-md` (12 px) y miniatura `.player-next-ep-thumb` a `--minimal-radius-sm` (8 px), garantizando la regla de radios concéntricos sin píldoras en rectángulos de acción.
   - Eliminación de opacidades ad-hoc `disabled:opacity-25` en el carrusel de episodios y `disabled:opacity-50` en menús de ajustes, enlazándolos a los tokens canónicos.
   - Supresión de sombras de texto inline en el cromo del reproductor en Minimalista (`.player-bar-fg span`).
5. **Erradicación de incoherencias cromáticas y residuales (Pacificación integral):**
   - Mapeo monocromo completo de `--brand-accent`, `--primary`, `--ring` y rampas semánticas (`--brand-accent-100...900`) en `tokens.css`, erradicando el resplandor carmesí heredado en más de 300 referencias de Tailwind en Minimalista.
   - Pacificación del cromo de Cronología (`/chronology`): `--era`, `--era-text` y `--tick` fijados en `var(--minimal-accent-rgb)` (`245 245 247`), neutralizando el eje vertical central, los vástagos conectores horizontales, los números de año, la franja kanji y el avance de lapso sin alterar los temas Por era y Neutro.
   - Pacificación de píldoras residuales: `.poster-chip`, `.series-shelf-era`, `.series-shelf-progress` e insignias de catálogo acotadas a `--minimal-radius-xs` (6 px) respetando la jerarquía concéntrica (píldoras solo en islas de navegación flotantes e iconos circulares).
   - Supresión de halos cromáticos y normalización de degradados de fallback sobre tarjetas de películas.

### Iteración histórica del 7 de noviembre de 2026 (Deprecada)

*(Nota histórica: En esta iteración se exploraron de forma preliminar `--minimal-card-edge` con sombras exteriores `0 8px 24px -6px rgba(0, 0, 0, 0.52)` y una pastilla activa en blanco perla con texto oscuro. Estas recetas quedaron superadas y deprecadas por el cierre definitivo del 11 de noviembre de 2026, que unifica el contrato en un acabado plano y discreto sin sombras exteriores en tarjetas ni hero, y con selección tenue de texto claro).*

### Cierre definitivo del tema Minimalista (11 de noviembre de 2026)

Se consolidó el acabado **plano y discreto**, coherente en toda la aplicación:

1. **Unificación de Contrato, Selección y Sombras:**
   - Supresión de sombras exteriores en hero y tarjetas (sagas, películas, portadas y estantería de series). Cero elevación en hover sobre tarjetas.
   - Conservación de sombras exclusivamente en elementos flotantes: franja/islas de navegación, menús emergentes, modales, tooltips y avisos (toasts).
   - Blanco pleno (`--minimal-accent`) reservado para la acción principal de cada bloque (como «Reproducir»). Navegación, filtros y selección persistente usan rellenos tenues (`--minimal-fill-3`, hover `--minimal-fill-4`, borde `--minimal-line-4`) manteniendo siempre texto claro (`--minimal-text-1`). Retiro definitivo del texto oscuro asociado a la antigua pastilla blanca.
2. **Navegación Unificada y Erradicación de Solapamientos:**
   - Desde 768 px, Minimalista adopta una **franja superior sólida con layout normal** (`header[role="banner"]`), eliminando la colisión y solapamiento que sufrían las tres islas flotantes a 768 y 820 px.
   - Entre 768 y 1023 px muestra el símbolo de KameHouse; desde 1024 px muestra símbolo + nombre. Todos los destinos (Inicio, Series, Películas, Cronología, Mi Lista) conservan sus nombres visibles a 768 y 820 px.
   - Controles con al menos 44 px de altura y área táctil accesible.
   - La búsqueda expandible se despliega sobre la franja ocultando temporalmente los destinos para teclado y lector de pantalla (`aria-hidden="true"`, `inert`), y al cerrarse restaura la navegación y devuelve el foco al botón de búsqueda.
   - Sincronización del espacio reservado mediante tokens de navegación (`--chrome-top` / `--chrome-stick`) para evitar que cabeceras sticky o filtros se tapen al hacer scroll.
   - Navegación inferior móvil conservada con hit targets de 44 px y respeto a las safe areas.
3. **Capa de Movimiento Centralizada:**
   - Perfil Minimalista en Framer Motion y CSS: 160 ms para feedback (`press`, `cardHover`, `elasticCounter`, `iconSwap`, `switch`) y 180 ms para entradas o cambios de estado (`entrance`, `tabIndicator`, `tabContent`, `railResize`, `island`, `selector`), ambos con curva sin rebote (`cubic-bezier(0.23, 1, 0.32, 1)`).
   - Pulsación ajustada a `scale(0.98)`. Elevación de 1 px reservada exclusivamente a las acciones del hero y la ficha.
   - Con preferencia de movimiento reducido: transiciones inmediatas (duración 0), sin desplazamientos ni escalas, asegurando respuesta instantánea si la preferencia cambia durante un gesto.
4. **Apariencia y Coexistencia con Por Era:**
   - En Apariencia, los controles de vidrio líquido y refracción se mantienen visibles y deshabilitados, acompañados por un banner explicativo accesible con icono de escudo, explicando que Minimalista utiliza superficies sólidas y 0 px de desenfoque por diseño.
   - Las preferencias guardadas de transparencia, Liquid Glass y la paleta Negro de Por era se conservan intactas, recuperándose al alternar entre temas sin sobrescrituras destructivas.


## Evidencia del cierre del 11 de noviembre de 2026

El [informe de cierre](auditoria/minimalista-2026-11-11-cierre.md) registra la implementación, matriz de navegador, reproducción real, comprobación de WebView2 y límites de validación. La regresión de geometría se puede repetir con `node scripts/check-minimalist-browser.cjs`; no guarda preferencias reales. Los resultados visuales complementan las pruebas de código.
