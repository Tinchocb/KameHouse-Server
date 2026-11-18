# Neutro y Por era: coherencia de controles — 6 de noviembre de 2026

## Dirección y resultado

Se conserva Neutro como grafito con acento blanco y vidrio moderado. Por era conserva sus siete paletas, las duplas de color y las firmas ambientales de cada saga. Comparten legibilidad, geometría y estados de controles; Minimalista y TV se excluyen explícitamente de la nueva capa.

Los cambios se implementan en `apps/web/src/styles/themes/cinematic-controls.css`, cargado después de las dos paletas desde `globals.css`. La comparación contra la copia inicial de globals.css confirma que en esta ejecución solo se añade ese import. Se preservan todos los cambios locales anteriores, incluidos los de Minimalista. No se modifica backend, componentes TSX, contratos generados, dependencias ni resolución del tema. No se reinicia la instancia real, ni se crea commit o push.

## Cambios concretos

| Área | Resultado |
|---|---|
| Texto pequeño | `--fs-2xs…5xs` tienen piso de 12 px; captions y ayudas usan 13 px. |
| Formularios | Etiquetas de campo/fila de 16 px / 600, ayudas de 13 px / 500 y texto editable de 14 px en escritorio / 16 px en táctil. La ayuda de BasicField usa texto secundario, en vez de un token de fondo. El error conserva su semántica. |
| Botones | Texto pequeño de 13 px y estándar de 14 px. `md` e `icon` miden 40 px en escritorio; icon es cuadrado. IconButton conserva sus medidas y escala de glifos. Se mantienen los radios pill de estos temas. |
| Superficie secundaria | Relleno de la paleta y un filete, sin el degradado con bisel y sombra de la receta anterior. Glass conserva su fondo translúcido y una sombra corta; no se añade ninguna capa de blur. |
| Selección | Botones secundarios y alias, tarjetas de elección y segmentados usan `--control-selected-bg` (acento al 12 % sobre superficie) y `--control-selected-border` (acento al 40 %). El primario conserva el acento pleno. |
| Segmentados | Riel sin sombra hundida; indicador tenue con relieve corto. Texto en caja natural, sin tracking expandido. Se conserva la semántica de filtros/pestañas y su navegación existente. |
| Tarjetas de elección | Sin marco luminoso duplicado, elevación o transform de Framer. Selección tenue y foco visible. Se conservan previews y arte. |
| Switches | Pistas de 36 × 20 o 46 × 26 px sin que el mínimo táctil las deforme; área de interacción mínima de 44 × 44 px. Pulgar con sombra corta, sin punto decorativo. |
| Estados | Deshabilitado al 45 %, una sola atenuación en filas y campos embebidos; carga con contraste completo. Foco con contorno independiente de la sombra, visible también con hover. Pulsación al 98 % en Button. |
| Plano y movimiento reducido | Plano usa las superficies sólidas existentes y elimina el relieve de botones, indicadores y pulgares. Movimiento reducido deja la propiedad de transición en none y anula la compresión de Button. La guarda global conserva su duración mínima de 0,01 ms. |

La navegación flotante, las composiciones, los fondos ambientales y el arte conservan su identidad. La nueva capa trabaja con los tokens de las paletas existentes, sin sustituirlos por colores estáticos compartidos.

## Verificación

- **45 pruebas aprobadas en ocho archivos:** `cinematic-controls.guard.test.ts`, `classic-minimalist.guard.test.ts`, `backdrop-filter.guard.test.ts`, `screen-era.test.ts`, `themes-registry.test.ts`, `radio-card-group.test.tsx`, `button-recipes.guard.test.ts` y `segmented-control.test.tsx`.
- La nueva guarda comprueba el aislamiento de Minimalista/TV y que no se agregue backdrop-filter.
- **TypeScript:** `tsc --noEmit` aprobado. **ESLint:** aprobado para la nueva guarda. Revisión de espacios del diff aprobada.
- **341 comprobaciones en Chrome:** 32 combinaciones de Neutro y las siete paletas, vidrio/plano y 1440/390 px. Se comprueban tamaños, tipografía, glyphs, selección, segmentados, contraste, switches encendidos/apagados, carga, deshabilitado, ausencia de overflow, foco con hover, movimiento reducido y exclusión de Minimalista/TV.
- Mínimos de contraste de las muestras en esas combinaciones: primario **5,39:1**, secundario **12,80:1**, ayudas sobre superficie **10,17:1** y pulgar/pista apagada **3,84:1**. Todos los pares de pulgar/pista encendidos superan 3:1. Son mediciones de esos pares; no certifican todo texto sobre todo tipo de imagen.
- **127 comprobaciones de pantallas:** las cinco pestañas completas de Ajustes con Neutro, Z y Daima a 1440 y 390 px; tema correcto, etiquetas/ayudas, transparencia disponible y ausencia de desbordamiento horizontal. Capturas de viewport y página completa. Sin errores JavaScript sin capturar en los montajes.
- Revisión visual de las muestras de controles y de capturas completas de Ajustes en escritorio y móvil.

El runner usa Node 26. Las pruebas de persistencia de SegmentedControl fallaron inicialmente porque el global experimental localStorage de Node ocultaba el del DOM simulado; se ejecutaron correctamente con `NODE_OPTIONS=--no-experimental-webstorage`, sin modificar tests o stores para sortear el problema. Persisten avisos anteriores de act en esos tests y de Browserslist desactualizado; no fallan los checks.

## Evidencia reproducible

Directorio externo:

`C:/Users/marti/.codex/visualizations/2026/11/06/01a1b329-7370-7c51-a611-a59229b79827/neutro-era/`

- `build-surfaces.cjs`: monta Button, IconButton, SpringSwitch, OsToggle, OsSelect, RangeSlider, RadioCardGroup, TextInput, SegmentedControl, Popover y SettingsPage reales; compila el CSS actual y carga Outfit/Space Mono locales.
- `check-matrix.cjs`: recorre las combinaciones de las ocho identidades, modos de superficie y anchos; produce `surfaces/matrix-results.json` y capturas de controles.
- `check-screens.cjs`: recorre las cinco pestañas en tres identidades y dos anchos; produce `surfaces/screen-results.json` y capturas `*-full.png`.
- `baseline/`: copias iniciales de globals.css, DESIGN-GUIDE.md, TEMA-POR-ERA.md y del CSS compilado anterior.

## Límites

Los montajes usan componentes y navegación reales con defaults sintéticos del esquema. Fetch devuelve 503 y el transporte WebSocket se sustituye solo en el bundle externo por un stub inerte. No hay escrituras al backend. Las capturas de Ajustes no incluyen el shell global completo.

No se valida la aplicación conectada a biblioteca real, guardado real, reproducción, Tauri/WebView2 o dispositivos físicos. La cobertura de pantallas completas corresponde a Ajustes; Home, fichas, Cronología y reproductor reciben las recetas compartidas pero no se recorrieron completos con datos reales. Las pruebas de screen-era y registro verifican el contrato existente de resolución; no se afirma una prueba integral del fundido de Universo DB dentro de la app. No se ejecutaron la suite global ni un build de producción.
