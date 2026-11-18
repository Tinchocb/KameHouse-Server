# Microinteracciones adicionales — 2026-11-10

Se añadieron transiciones a controles frecuentes sobre la segunda pasada de fluidez, conservando diseño, materiales y cambios locales existentes.

## Cambios

- **Audio, calidad y subtítulos:** nueva marca compartida `kinetics/selection-mark.tsx`. Reserva una celda de 20 × 20 px para selección y carga. Cambiar de pista ya no añade o retira espacio de texto; el check cambia con opacidad y una escala corta de 150 ms. Con movimiento reducido solo se funde la opacidad. Los botones exponen su estado con `aria-pressed`.
- **Valores del menú del reproductor:** cambio mediante el fundido canónico `IconSwap subtle`, sin blur. El texto accesible contiene únicamente el valor vigente mientras salen las capas anteriores. No se remonta el botón ni se pierde el foco. El chevron y las etiquetas de calidad tienen un desplazamiento de 2 px con foco o puntero fino, desactivado con movimiento reducido.
- **Catálogo de películas:** contador de resultados con `ElasticCounter`, reutilizando el spring existente. La cifra que sale queda dentro de una región decorativa; una sola frase accesible expone el último total. Movimiento reducido sustituye la cifra directamente. La carga sigue sin presentar un total cero inventado.

Las marcas usan CSS con transformaciones y opacidad, sin mediciones de geometría ni listeners por opción. No se añadieron cascadas, animaciones de paleta ni bucles decorativos. El spinner de carga conserva su comportamiento previo. No se afirma una mejora de FPS: esta pasada añade feedback y verifica estabilidad de geometría, sin repetir el benchmark de la paleta.

## Comprobaciones

- **TypeScript, lint dirigido y build de producción:** aprobados. Permanece el aviso de Browserslist desactualizado; no se actualizaron dependencias.
- **Pruebas relacionadas:** 7 archivos, 44 pruebas aprobadas. La nueva regresión de `MenuButton` verifica cambios consecutivos, un solo nombre accesible con el último valor, permanencia del nodo y del foco, y acción vigente. La prueba de calidad consulta el estado accesible en lugar de contar SVG decorativos.
- **Escena de componentes reales:** cuatro perfiles, escritorio de 1440 px y móvil táctil de 390 px, con movimiento normal y reducido. Selecciones rápidas de audio/calidad/subtítulos, cambio consecutivo del valor del menú y cambio de preferencia en vivo. Los botones conservaron un ancho de aproximadamente 296 px y el texto de la primera opción no cambió su posición ni ancho. Marcas y desplazamiento de hover quedaron sin transformaciones con movimiento reducido. Sin errores JavaScript. Se inspeccionó visualmente la captura móvil con viewport real de 390 px.
- **Catálogo real con APIs sintéticas:** ocho perfiles, los tres temas con ambas preferencias en escritorio y Por era con ambas preferencias en móvil. Cambios rápidos de filtro y preferencia: `79 títulos → 4 de 79 títulos → 79 títulos`. Se comprobó el último recuento accesible, retirada de cifras salientes y ausencia de desbordamiento horizontal. Sin errores JavaScript.

### Resultado de la suite completa

Actualización posterior: la [revisión de Series](fluidez-2026-11-10-revision-series.md) verificó que el guard ya pasaba al retomar y obtuvo una nueva suite completa aprobada. Las cifras siguientes conservan el resultado histórico de esta pasada.

La suite del estado actual del workspace ejecutó **209 archivos y 1536 pruebas**: 208 archivos y 1535 pruebas pasaron; falló una prueba de `button-recipes.guard.test.ts`.

El guard detecta un `<button>` con receta propia `bg-white/…` en `routes/series/-SeriesSpineRow.tsx`, fuera del baseline permitido. Esta pasada no modificó ese archivo ni amplió la excepción del guard. El fallo queda pendiente; no se presenta la suite completa como aprobada. El build y todas las pruebas relacionadas con estos cambios sí pasan.

## Evidencia y límites

En `scratch/motion-second-pass-20261110/`: `more-scene.tsx`, `build-more.cjs`, `more-browser.cjs`, `more-browser-results.json`, capturas `more-*`, `more-catalog.cjs`, `more-catalog-results.json`, `more-motion-tests.log`, `more-full-tests.log` y `more-build.log`.

Las APIs usan fixtures de lectura y bloquean mutaciones reales y peticiones externas. Las comprobaciones de pistas se hicieron con componentes reales y pistas sintéticas; no validan una sesión conectada de Drive. No se modificaron dependencias ni formatos persistidos. Sin commit, push, despliegue ni reinicio de la instancia real. El servidor de desarrollo usado para la revisión es aislado.
