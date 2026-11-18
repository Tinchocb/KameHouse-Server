# Minimalista: plan y ejecución del 4 de noviembre de 2026

## Alcance autorizado

Implementar los cuatro desvíos confirmados al revisar el informe adjunto: navegación global, selector de eras, acceso directo a Maratón y tarjeta de estado de transparencia. Preservar los cambios previos del árbol y el comportamiento de Neutro y Por era.

## Plan

1. **Navegación:** desde 768 px, integrar marca, destinos, búsqueda y ajustes en una franja propia de Minimalista; mantener nombres visibles; colocar las tres acciones existentes en un Popover con etiquetas, foco al abrir y cierre al navegar, entrar en pantalla completa o pasar a móvil. La búsqueda se superpone sin empujar los destinos. En móvil se conserva el montaje existente.
2. **Eras:** resolver la variante automática de Minimalista como barra también en escritorio; conservar todos los nombres, scroll horizontal, selección por flechas y estados sin contenido. El skeleton debe reservar el mismo espacio.
3. **Ajustes puntuales:** restituir el botón de Maratón con su callback existente; aplicar superficie sólida sin sombra/brillo a la tarjeta de estado de transparencia mediante un marcador semántico y tokens del tema.
4. **Verificación:** pruebas de comportamiento existentes y regresiones pertinentes, ESLint de archivos tocados y TypeScript; montaje real en Chrome a 390, 768, 1024 y 1440 px, teclado/foco, apertura/cierre del Popover, búsqueda, movimiento reducido y comparación con los otros temas. Documentar límites sin atribuir al montaje aislado cobertura de reproducción real.

## Resultado

Plan completado sobre el árbol actual, sin commit ni instalación de dependencias.

| Área | Cambio aplicado |
|---|---|
| Navegación | Franja única desde 768 px, nombres persistentes, selección tenue y objetivos de 44 px. Las islas internas reutilizan el mismo marcado con acabado definido solo por el CSS de Minimalista. Se actualizan `--chrome-top` y `--chrome-stick`, consumidos por el shell. |
| Acciones rápidas | Las tres acciones existentes pasan a un Popover de Radix desde 768 px en Minimalista. Sus etiquetas se muestran, el primer control recibe foco, Escape devuelve el foco al disparador y los cambios de ruta, tema, ancho o pantalla completa cierran el menú. Sorpréndeme cierra el Popover antes de abrir el diálogo, que conserva el foco. |
| Búsqueda | El contenedor reserva su ancho y el campo expandido se superpone. Minimalista admite expansión inline desde 768 px; los otros temas conservan el umbral de 1024 px y la paleta de comandos en anchos menores. |
| Eras | La variante automática consulta el tema; selector y skeleton reservan una barra en Minimalista. Todos los nombres permanecen visibles y el interior se desplaza cuando no caben. Se conserva el radiogroup, las flechas, los estados sin contenido y la línea de progreso que usa Cronología; el emblema queda oculto en la presentación tipográfica. |
| Reproductor | Se elimina exclusivamente la condición que ocultaba el botón de Maratón en Minimalista. Se reutilizan el callback, el nombre accesible, `aria-pressed` y los estilos existentes. |
| Ajustes | `TransparencyStatus` emite `data-transparency-status`. El tema aplica superficie sólida, elimina el brillo superior y las sombras de tarjeta/icono. Se conserva el contenido y la lógica del estado. |

Los cambios de CSS están limitados a `[data-ui-style="classic-minimalist"]:not([data-tv="true"])`. La navegación móvil conserva su montaje anterior y los otros temas conservan sus islas, compactación y selector por ancho.

## Archivos modificados en esta ejecución

- `apps/web/src/components/ui/app-layout/floating-pill-nav.tsx`
- `apps/web/src/components/ui/app-layout/expandable-search.tsx`
- `apps/web/src/components/ui/era-rail/era-rail.tsx`
- `apps/web/src/components/ui/era-rail/era-rail.test.tsx`: se actualizan las dos expectativas del comportamiento anterior, manteniendo la comprobación de regreso al riel y de reserva del skeleton.
- `apps/web/src/components/video/player-bottombar.tsx`
- `apps/web/src/routes/settings/tabs/appearance-tab.tsx`
- `apps/web/src/styles/themes/classic-minimalist/navigation.css`
- `apps/web/src/styles/themes/classic-minimalist/components.css`

El árbol ya tenía cambios amplios sin commit, incluidos varios de estos archivos. Se guardó una copia previa de cada archivo tocado fuera del repositorio; el diff completo contra Git incluye trabajo anterior y no representa exclusivamente esta ejecución. No se modifica la auditoría previa `minimalista-2026-11-04.md`.

## Verificación

- **69 pruebas aprobadas, seis archivos:** `classic-minimalist.guard.test.ts`, `flat-reason.test.ts`, `backdrop-filter.guard.test.ts`, `floating-pill-nav.guard.test.ts`, `era-rail.test.tsx` y `PlayerSettingsMenu.test.tsx`.
- **TypeScript:** `tsc --noEmit` aprobado.
- **ESLint:** aprobado en los seis archivos TypeScript/TSX tocados. Solo aparece el aviso de Browserslist desactualizado; no se cambian dependencias.
- **Chrome:** 70 comprobaciones aprobadas, sin errores JavaScript sin capturar. Montaje React con componentes reales, CSS global actual compilado, fuente Outfit local y datos sintéticos.
- **Anchos medidos:** 390, 768, 1024 y 1440 px. Sin desbordamiento horizontal de la muestra; franja y herramientas sin colisión desde 768 px; todos los nombres de era con ancho positivo y opacidad 1, incluidos los estados deshabilitados. Se comprueba la reserva `data-era-rail="bar"` y la presencia del progreso.
- **Interacciones:** apertura por Enter, foco inicial, activación de Maratón en menú y botón directo, Escape, clic exterior, cambio de ruta, paso a móvil y regreso, entrada/salida de pantalla completa mediante el estado de la aplicación, diálogo Sorpréndeme y foco dentro de este, búsqueda sin desplazar destinos desde 768 px, flechas saltando eras sin contenido, End y desplazamiento de la era activa.
- **Movimiento reducido:** Popover sin animación.
- **Otros temas:** al cambiar a Neutro y Por era a 1440 px desaparece el menú nuevo y se recuperan riel e islas.
- **Espacios del diff:** revisión de los archivos tocados y comparación con su copia previa. La comprobación global de Git detecta espacios anteriores en `timelinePrefs.ts`, `kinetics/hooks.ts` y `media-hero.tsx`, ajenos a esta ejecución; no se corrigen aquí.

## Evidencia reproducible

Directorio externo:

`C:/Users/Tinchoo/.codex/visualizations/2026/11/04/01a1a88a-138b-7ea0-a32b-5a56b4fc3a84/implementacion-minimalista/`

- `build.cjs` genera el montaje de componentes desde el código actual; `check.cjs` ejecuta las comprobaciones.
- `results.json` conserva las medidas y el resultado de cada comprobación.
- `minimalista-390.png`, `minimalista-768.png`, `minimalista-1024.png`, `minimalista-1440.png` y `minimalista-menu.png` muestran el montaje aislado.
- `baseline/` conserva las versiones previas de los ocho archivos tocados.

`TransparencyStatus` es privado: el bundler de la muestra añade un export en memoria para montarlo sin toda la pantalla de Ajustes. El archivo del producto no recibe ese export.

## Límites

No se recorrieron rutas completas con una biblioteca real ni se verificó reproducción, Drive, Tauri/WebView2, pantalla completa nativa o dispositivos físicos. Los cambios de ruta y los callbacks se ejercitaron en un router de memoria dentro del montaje; la barra del reproductor recibió datos sintéticos sin vídeo. No se ejecutó un build de producción ni la suite global. Las capturas muestran el montaje de validación, no las pantallas finales de la aplicación en ejecución.
