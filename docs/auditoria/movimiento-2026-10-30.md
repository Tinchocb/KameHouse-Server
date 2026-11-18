# Revisión de movimiento — 30 de octubre de 2026

## Alcance y cobertura

Revisión estática de los **218 archivos `.tsx`, `.jsx` y `.css` de `apps/web/src`**, excluyendo pruebas. El [inventario por archivo](movimiento-2026-10-30-cobertura.csv) registra composición, declaraciones y líneas de movimiento para reproducir la búsqueda. Incluye los ocho archivos del tema Minimalista extraídos durante esta revisión. Un componente estático no necesita una animación nueva.

También se revisaron los módulos auxiliares de movimiento: presets y variantes de kinetics, scroll-reveal, motion-tier, use-hero, shared-element, enter-stagger, navigation-transition, use-route-latency, helpers/transitions y variantes de getting-started. Los RAF de reproducción, subtítulos y seguimiento de posición tienen una función operativa; no se ralentizaron como si fueran efectos decorativos.

La cobertura estática incluye primitives, navegación, búsqueda, spotlight, tarjetas, cronología, fichas, ajustes, administración, overlays y reproductor. No significa que cada estado haya sido reproducido en navegador.

## Cambios aplicados

| Superficie | Problema comprobado | Corrección |
| --- | --- | --- |
| Spotlight y temas | Transiciones genéricas podían animar propiedades ajenas a la interacción | Propiedades explícitas en CTA y controles Minimalista |
| Ajustes | Animación de entrada duplicada en contenedor y contenido | Una entrada compartida; se retiró el fade adicional de cuatro pestañas |
| Grillas | Retrasos acumulados de hasta 480 ms y movimiento sin reducción explícita en posters | Stagger de 40 ms limitado a 240 ms; posters respetan movimiento reducido |
| Contenido intercambiable | Entradas cortas y curvas que concentraban el cambio al principio | Entrada de 350 ms con ease-in-out; hub sin opacidad duplicada |
| Búsqueda y popovers | Spring de indicador aplicado a contenido; escala demasiado visible | Fade de resultados 350 ms y zoom discreto .98 |
| Selector aleatorio | Entrada desde 100 px y escala .95 | Recorrido de 12 px, escala .98, entrada 350 ms; reducido 150 ms |
| Personajes | Entrada con escala .94 y recorrido 16 px | Escala .98, recorrido 8 px, entrada 350 ms; reducido 150 ms |
| Panel del reproductor | Spring de selector usado para una superficie grande | Apertura 400 ms y cierre 350 ms; reducido 150 ms |
| Overlays salientes | Contenido podía seguir interactivo durante el cierre | Capas inert y aria-hidden durante su salida |
| Hub de sagas | Hook de tema después de un retorno condicional | Hook ejecutado siempre antes del retorno |

Se conservaron las mejoras de las pasadas anteriores: continuidad de heroes, IconSwap discreto del reproductor, seek bar por transform, navegación y búsqueda, panel de episodios, cola, modal base y eliminación del stagger repetido en sagas. El ritmo por superficie quedó documentado en `docs/DESIGN-GUIDE.md`, sección 8.2.

## Validación

- TypeScript: `node ../../node_modules/typescript/bin/tsc --noEmit` pasó desde `apps/web` después del último cambio de producción.
- ESLint dirigido: pasó en los 14 archivos de producción modificados en esta pasada que contienen TypeScript/TSX.
- Suite completa: 175 archivos, 1321 pruebas; 1319 pasaron inicialmente. Un fallo era el guard que exigía un spring de selector en el modal aleatorio; se actualizó al contrato vigente. La repetición dirigida pasó (22 pruebas: variantes, hub, panel y guard).
- Se confirmó por separado **un fallo pendiente** en `media-hero.test.ts`: el contrato exige tokens `text-on-surface`, pero `media-hero.tsx` contiene `text-white/90` en un cambio concurrente ajeno a esta pasada. No se modificó ese diseño ni se debilitó su prueba. No se declara la suite completa verde.
- `git diff --check` global detecta whitespace final en `media-hero.tsx`, también fuera de esta pasada.
- No quedan usos activos de `transition-all` o `transition: all` en los componentes y CSS inspeccionados; la coincidencia restante es un comentario explicativo.

### Navegador con datos locales simulados

Chrome: 8 rutas × 4 perfiles = **32 recorridos**. Rutas: Home, Series, Películas, Cronología, Ajustes, Administración, ficha de serie y ficha de película. Perfiles: Neutro, Minimalista y Por era a 1440 px; Minimalista a 390 px con movimiento reducido. Todas cargaron sin error de página registrado ni desbordamiento horizontal. Administración se repitió tras corregir el formato simulado de logs (string, no array).

Búsqueda y Mi Lista: repetición con movimiento normal y reducido; foco dentro del panel, cierre correcto y capa saliente inert/aria-hidden. Las pasadas anteriores comprobaron además el modal de cronología y cambios de hero. Las capturas y resultados JSON están en `tmp/motion-full-review-20261029/`; los scripts de interacción, en `tmp/motion-review-20261029/`.

## Límites

### Seguimiento: interrupciones de salida

Se añadió una prueba con Framer Motion real que espera la apertura del panel del reproductor, inicia su cierre y lo reabre antes de desmontarse. Se comprobó que el mismo nodo recupera accesibilidad e interacción. Antes, al cancelar la salida, la propiedad animada `pointerEvents` regresaba a un valor indefinido; ahora se controla directamente con `useIsPresent`, fuera de la animación. Esto hace explícita su restauración, sin atribuir al navegador un bloqueo de clics no reproducido allí. Se revisaron también los patrones equivalentes del selector aleatorio, navegación flotante y limpieza del foco.

TypeScript y ESLint dirigidos pasan tras el cambio. Esta comprobación es automatizada en DOM de prueba; no sustituye una sesión de reproducción real.

La inspección estática es completa para el inventario señalado; los recorridos visuales son muestras de rutas y estados. No certifican reproducción real, Drive, codecs, Tauri, hardware, FPS bajo carga ni todos los estados de error, carga y gestos del reproductor. Las peticiones remotas se bloquearon y las mutaciones API se rechazaron en las pruebas de navegador. No se desplegó ni se modificó la biblioteca real.
