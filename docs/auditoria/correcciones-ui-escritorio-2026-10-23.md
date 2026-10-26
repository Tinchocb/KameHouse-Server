# Correcciones de interfaz de escritorio — 23 de octubre de 2026

Se aplicaron P-01 a P-09 del informe aprobado `auditoria-ui-escritorio.md`. P-10 se ejecutó parcialmente con componentes reales y con el frontend completo conectado a una API ficticia aislada; sus límites figuran abajo. Móvil, touch y safe areas siguen diferidos.

Base al comenzar: HEAD `446a13ab00feeb619841114bb040abbd9e401660`, 816 entradas de `git status`. Se conservaron los cambios existentes. No se hicieron commits ni cambios de rama, dependencias, lockfiles, backend o runtime de escritorio. El ámbito de implementación fue `apps/web/src`; este informe es documentación propia del lote. Se conservaron personajes, imágenes y encuadres.

## Cambios y evidencia

| Paso | Cambio aplicado | Verificación |
|---|---|---|
| P-01 | La ficha de película conserva el visto anterior mientras espera; usa `isPending`, `disabled`, `aria-busy` y una guarda síncrona contra clic doble. Confirma estado, sonido y toast al resolver; recupera el override previo al fallar. | Dos pruebas con la mutación y la caché reales de React Query, transporte diferido: éxito, rechazo, reintento, doble clic y remontaje con la caché confirmada. En navegador, la API ficticia rechaza la escritura: no queda marcada como vista y aparece el error. |
| P-02 | Cada apertura/elección de Sorpréndeme tiene una generación. Cerrar o desmontar invalida respuestas y errores tardíos. El cierre tampoco permite iniciar otra elección desde los botones que AnimatePresence conserva durante la salida. Una respuesta vieja no libera el pending de una apertura nueva. | Seis pruebas: Escape, X, velo, desmontaje, reapertura y rechazo tardío. Cero cambios de cola/TV al resolver una elección cancelada. |
| P-03 | MoreActionsMenu enfoca su primera acción localmente. Se conserva Popover/Radix y su retorno al disparador. | Pruebas del componente y navegador en el hero real de Películas: primera acción enfocada, Tab a la segunda, Shift+Tab, Escape y retorno a Más opciones. Los filtros existentes siguen pasando sus pruebas. |
| P-04 | Un hook local registra el origen del inspector. Al cerrar restaura ese elemento; si desapareció, usa el artículo o nodo estable del lapso original. Los nodos estables de ambas vistas admiten foco programático, sin añadir paradas de Tab. | Cinco pruebas del inspector real con un contenedor de prueba: ambas estructuras de origen, disparador desmontado, cambio de lapso y selección rápida. En la ruta completa se confirmó retorno desde vista detallada y compacta, incluso tras avanzar a otro lapso. |
| P-05 | El buscador compacto expone combobox/listbox/opciones, IDs por instancia, opción activa, selección y estado de carga/resultados. Restablece el índice al cambiar consulta o resultados; el clic en una opción conserva el foco del campo. | Dos pruebas: flechas/Enter y destino coinciden; resultados nuevos, carga y vacío. En el shell real, ArrowDown mantiene foco en el input y `aria-activedescendant` apunta a la opción seleccionada. NVDA pendiente. |
| P-06 | OsToggle expone `aria-disabled` cuando corresponde; conserva sus handlers bloqueados. | Prueba de clic, Enter y Espacio deshabilitados y posterior habilitación. El navegador expone el componente real como switch deshabilitado. En Sistema se abrió el consumidor real; guardar el cambio se rechaza por diseño del fixture, por lo que no se acredita persistencia del estado dependiente allí. |
| P-07 | Las dos opciones de Sorpréndeme usan `surface-content-row`; se quita únicamente el blur de PosterChip y del badge del inspector. | `backdrop-filter: none` medido en las dos opciones y PosterChip en Moderno/Clásico/Flat, y en el badge del inspector. No se modificaron tokens globales ni imágenes; no se certifica contraste compuesto sobre todas las imágenes ni mejora de FPS. |
| P-08 | La barra del inspector usa `scaleX` y transición de transform. Las tarjetas enumeran fondo, borde y sombra. El halo usa `color-mix` válido con acentos hex. | Navegador: barra transformada, selección coherente tras avanzar/retroceder, `transitionProperty` explícita y sombra computada válida en las cinco eras. 45 combinaciones de tamaño/tema/era sin desbordamiento horizontal del diálogo. |
| P-09 | Se reprodujo primero el problema con el router real: `aria-current` ya lo aportaba Link, pero el cálculo manual podía omitir el resaltado. Se normaliza la barra final, se usa `/chronology` y se declara el estado actual explícitamente. | Dos pruebas del router con configuración predeterminada fallaron antes de corregir el resaltado y pasan después: entradas con/sin barra y navegación interna. En el frontend completo, `/chronology?tvMode=true` termina en `/chronology`, con fondo seleccionado y `aria-current=page`. ArrowRight desde ese enlace enfoca Ajustes mediante el manejador espacial real. |

Los cambios existentes se revisaron mediante copias del contenido inicial y un diff específico de este lote; el diff global contra HEAD contiene también trabajo anterior. Se corrigió el guardián de diseño del modal para exigir las dos combinaciones `surface-content surface-content-row`, en lugar de contar la subcadena dos veces.

## Validación final automatizada

Desde `apps/web`:

- `pnpm exec vitest run --maxWorkers=4`: **167 archivos, 1284 pruebas verdes**. Se agregaron 21 pruebas respecto de la base 160/1263. Persisten avisos de pruebas existentes sobre act/RouterProvider; no equivalen a fallos.
- `pnpm exec eslint src/ --format json ...`: **0 errores y 4 advertencias**, las mismas de la base: efecto de reinicio del inspector y los tres símbolos sin uso de Cronología.
- `node scripts/check-tokens.mjs`: **1699 clases y 399 variables CSS**, correcto.
- `pnpm exec tsc --noEmit`: falla solo por los tres TS6133 preexistentes de `routes/chronology/index.lazy.tsx`: `YearScale`, `yearScaleAccents`, `handleJumpToScaleVolume`. Se conservaron. No se presenta un build de producción como aprobado.
- Rsbuild dev compiló el frontend completo correctamente. No sustituye el typecheck ni un build de producción.
- El diff global tiene whitespace previo en `app-error-boundary.tsx`, `player-seek-preview.tsx`, `player-theme.ts` y `use-sound.ts`. No se tocaron esos archivos para limpiar trabajo ajeno. El diff específico del lote se revisó por separado.

## P-10: ejecución de escritorio y límites

Se usaron dos entornos externos al repositorio:

1. **Banco aislado**: esbuild en producción, CSS/Tailwind y fuentes reales, QueryClient y router, componentes reales y datos ficticios. No representa las rutas completas. El inspector se midió a viewport CSS real **1440×900, 1360×800 y 1280×720**, en Moderno/Clásico/Flat, con un lapso de cada una de las cinco eras: 45 casos. Sin overflow horizontal y con sombra seleccionada válida. Se corrigió el override del navegador según `innerWidth/innerHeight`; no se confundieron píxeles solicitados con viewport CSS.
2. **Frontend completo con Rsbuild**: puerto 43922, proxy a una API ficticia en 43921. La API no abre una base de datos ni reenvía peticiones; todo método distinto de GET/HEAD responde 403. Se recorrieron `/home`, `/series`, `/series/223`, `/movies`, `/movies/7`, `/chronology`, `/settings` y `/admin`. Se midió el shell inicial de las ocho rutas en los tres tamaños anteriores: 24 casos sin desbordamiento horizontal de documento ni pantalla de error en esas capturas. Es una comprobación inicial de geometría, no una certificación de todas las interacciones y estados.

Se comprobaron además selección de estantería con teclado, ficha de serie sin episodios, ficha de película con rechazo de visto, ambas vistas de Cronología, cambios de lapso, menú del hero, búsqueda y navegación espacial de teclado en TV. Ajustes y Administración se abrieron sin ejecutar mantenimiento. Un fixture inicial de caché incompleto hizo fallar Sistema; se corrigió la forma de ese dato ficticio y la pantalla abrió. No se atribuye ese error de fixture al backend real ni se modificó el producto por él.

Pendientes concretos:

- Reproducción con vídeo, seek, subtítulos, fullscreen, continuidad, cola y maratón hasta el lanzamiento: el fixture no contiene archivos reproducibles. No se abrió un reproductor contra la biblioteca real ni se escribió progreso real.
- Saga larga con archivos, filtros y virtualización reales; guardado/descartado exitoso de Ajustes y servicios OAuth/red reales. Las respuestas de prueba no cubren esos contratos completos.
- NVDA, D-pad físico y Tauri/WebView2/mpv. La prueba espacial con flechas de teclado no acredita hardware físico.
- `prefers-contrast: more` y `prefers-reduced-motion` del sistema operativo. Las pruebas automatizadas cubren los caminos pertinentes y las recetas CSS existentes se conservaron; no se certifica emulación de esas preferencias en el navegador.
- Contraste AA de todas las composiciones con imágenes: las miniaturas del fixture sin backend no se cargan. La captura del inspector conserva ese espacio vacío; no es evidencia de un cambio del arte.
- FPS/LCP/INP y comparación de rendimiento antes/después. No se atribuye una mejora medida a retirar blur o usar transform.
- Móvil, touch, safe areas y las observaciones móviles originales: expresamente diferidos.

Los servidores y pestañas de validación son temporales y se cierran al terminar. No se utilizó el puerto 43211 ni se instalaron dependencias.

## Artefactos de esta ejecución

Directorio externo: `C:/Users/Tinchoo/.codex/visualizations/2026/10/23/01a169c9-d626-78f3-bbd3-cb8ea26843cd/desktop-fixes/`.

- `vitest-final.txt`, `eslint-final.json`, `typecheck-final.txt`.
- `browser-metrics.json`: los 45 casos aislados.
- `route-metrics.json`: las 24 capturas de geometría inicial de rutas completas con fixture.
- `surface-metrics.json`: blur computado de PosterChip y opciones de Sorpréndeme en los tres modos.
- `inspector-escritorio.png`: captura de la ruta completa con fixture, a 1440×900.
- `changes.patch` y `before/`: comparación de los archivos existentes antes y después de este lote.
- `bank.tsx`, scripts de compilación/servidor, fixture y registro de peticiones: reproducción del entorno aislado; no forman parte del producto.

El informe original, su JSON y el inventario siguen en el directorio de la auditoría `01a169a6-ba6a-7391-912a-c14b4182f75f`, sin modificarlos.
