# Minimalista: coherencia de controles — 6 de noviembre de 2026

## Dirección y alcance

Se conserva el contrato actual: contenido protagonista, superficies planas, cromo monocromo, primario perla y secundario tenue. No se cambia la composición de las pantallas ni las excepciones de color existentes. La corrección se concentra en las recetas compartidas que consumen las distintas rutas.

El árbol ya contenía cambios extensos. Se trabaja sobre ese estado, sin restaurarlo ni crear commits. No se modifica backend, contratos generados, dependencias o la instancia real.

## Problemas corregidos

| Problema comprobado en el código | Corrección |
|---|---|
| La regla tipográfica común de Button fijaba también IconButton a 14 px, anulando su escala de glifos. | IconButton queda fuera de la talla de texto y conserva su escala propia; mantiene la transición, el filtro y el padding del tema. |
| IconButton emite la talla md del Button interno aunque su talla real sea xs/sm/lg/xl. | Expone `data-icon-size`, un hook semántico sin estilos propios. Minimalista aplica 8 px de radio a sus tallas pequeñas. |
| Button `icon-sm` heredaba 40 × 40 px y radio de 12 px. | Usa 36 × 36 px y radio de 8 px en escritorio; en táctil conserva al menos 44 × 44 px. |
| Las recetas antiguas tenían color de reposo equivalente pero faltaban estados de pulsación y selección; glass tampoco participaba de la selección persistente común. | Secundarios, discretos, contornos y sus alias comparten relleno al 16 % y texto claro para pulsación y `aria-pressed`. Esto incluye las acciones glass de las fichas. |
| Las acciones `.btn-ui` y `.ep-action-btn` no participaban del estado deshabilitado del tema. | Comparten opacidad del 45 % y ausencia de transform con Button. |
| El padding horizontal de la receta estaba repetido como valores sueltos. | Se crean `--minimal-control-padding-sm/md/lg` en tokens.css y los consumen las tallas y `.btn-ui`. |
| Los popovers compartidos conservaban una sombra genérica en lugar de la receta de menú de Minimalista. | `.UI-Popover__root` comparte con los selectores superficie, filete, radio y sombra de menú. |

La exclusión de IconButton usa `:where` para no aumentar la especificidad de la regla común ni desplazar los radios de ghost o el texto de episodio. Los cambios visuales se limitan al selector raíz del tema, con la exclusión de TV vigente. El único cambio de componente es el atributo de talla de IconButton.

## Archivos de producto y contrato

- `apps/web/src/styles/themes/classic-minimalist/tokens.css`
- `apps/web/src/styles/themes/classic-minimalist/buttons.css`
- `apps/web/src/styles/themes/classic-minimalist/components.css`
- `apps/web/src/components/ui/button/icon-button.tsx`
- `docs/TEMA-MINIMALISTA.md`

## Validación

- 17 pruebas únicas aprobadas en cinco archivos: `classic-minimalist.guard.test.ts`, `flat-reason.test.ts`, `backdrop-filter.guard.test.ts`, `button-recipes.guard.test.ts` y `glass-icon-button.test.tsx`.
- `pnpm exec tsc --noEmit` y ESLint del componente modificado aprobados.
- 72 comprobaciones aprobadas en Chrome headless con Button, IconButton y Popover reales y el CSS global actual compilado con Tailwind.
- Escritorio de 1440 px y móvil emulado de 390 px: tallas, botones cuadrados, escala de glifos, estados de los 15 secundarios/discretos/contornos y alias, superficie de Popover, foco simultáneo con hover, carga, deshabilitado, texto de episodio, ausencia de desbordamiento horizontal de la muestra y movimiento reducido. Los pseudoestados CSS se fuerzan mediante CDP; no representan un recorrido completo con teclado físico.
- Se comprueba que Neutro recupera su radio propio al retirar el atributo del tema y que TV queda excluido. Las guardas comprueban el aislamiento de todas las reglas.
- Revisión visual de las capturas de escritorio y móvil del montaje.
- Avisos del entorno: Browserslist desactualizado y advertencia experimental de localStorage de Node en Vitest. No impiden los checks.

## Evidencia y límites

Directorio externo reproducible:

`C:/Users/marti/.codex/visualizations/2026/11/06/01a1b329-7370-7c51-a611-a59229b79827/minimalista/`

`build.cjs` monta los componentes y compila CSS; `check.cjs` abre su propia instancia headless de Chrome y genera `results.json`, `minimalista-desktop.png` y `minimalista-mobile.png`. `baseline/` conserva las versiones iniciales de buttons.css, tokens.css, icon-button.tsx y TEMA-MINIMALISTA.md.

Las capturas muestran una muestra de controles, no rutas completas. No se verificaron biblioteca real, reproducción, Tauri/WebView2 ni dispositivos físicos. No se ejecutaron la suite global o un build de producción. No se afirma que toda inconsistencia visual posible de la app haya quedado resuelta: esta ejecución corrige y verifica los desvíos descritos en los componentes compartidos.
## Ampliación: tipografía, formularios y pantallas de Ajustes

La revisión continuó por la precisión del usuario: incluir letras, textos, switches y controles afines. Se mantiene la dirección existente, sin introducir una estética nueva.

### Cambios adicionales

- **Escala tipográfica:** los tokens `--fs-2xs…5xs` tienen piso de 12 px. Los pesos heredados, captions, etiquetas y el título de página usan la escala de Minimalista. Se neutralizan las utilidades de mayúsculas y tracking expandido.
- **Jerarquía de formularios:** etiquetas de fila/campo a 16 px / 600; ayudas y errores a 13 px / 500; texto editable a 14 px en escritorio y 16 px en táctil. `BasicField` deja de usar el token de fondo `--muted` como color de ayuda. Se conserva el rojo de error.
- **Contraste:** los metadatos `text-zinc-500` de Ajustes usan el texto atenuado del tema. Los estados warning se reasignan a gris, coherente con la excepción cromática existente reservada al error; se conservan iconos, textos y bordes que comunican el estado.
- **Switches:** hooks `data-switch`, `data-checked`, `data-disabled` y `data-switch-thumb` identifican la pieza visual sin depender de su rol accesible. Las pistas independiente y embebida comparten borde cero, paleta y pulgar plano. Se elimina el punto decorativo y la sombra del pulgar. La desactivación se atenúa una sola vez.
- **Geometría táctil:** el mínimo genérico de los botones convertía el switch independiente en un círculo de 44 px de alto en móvil. El mínimo ahora pertenece al pseudo-elemento de interacción: la pista conserva 36 × 20 o 46 × 26 px y la zona de pulsación llega a 44 × 44 px. Se comprueba un clic fuera de la pista y dentro de esa zona.
- **Foco y pulsación:** la fila de switch conserva un solo anillo; cancelación de puntero y pérdida de foco limpian su estado de pulsación. El switch no nativo expone `aria-disabled`.
- **Tarjetas de elección:** selección tenue, sin elevación ni marco/halo duplicado. Se conservan las previews internas y el foco visible. `RadioCardGroup` recibe una sola entrada por Tab, flechas circulares, Home/End y sincronización de foco/selección; tres pruebas cubren esa navegación.
- **Sliders:** la ayuda se asocia al control mediante `aria-describedby` y comparte la tipografía de los demás campos.
- **Transparencia:** en Minimalista se oculta la comparación interactiva entre vidrio y plano; el switch se muestra activado, deshabilitado y con una explicación de por qué no puede cambiar el tema. No se modifica la preferencia guardada para Neutro o Por era. Se conserva la prioridad existente del motivo manual cuando el usuario ya lo había seleccionado.
- **Texto de cabecera:** «Tema, transparencia, efectos y orden del catálogo» incluye los tres temas sin dejar fuera Minimalista.

Se modifican adicionalmente `typography.css`, `controls.css`, `spring-switch.tsx`, `routes/settings/components.tsx`, `range-slider.tsx`, `radio-card-group.tsx`, `routes/settings/index.lazy.tsx` y `appearance-tab.tsx`; se añade `radio-card-group.test.tsx`. Se sincronizan TEMA-MINIMALISTA.md y DESIGN-GUIDE.md.

### Validación ampliada

- **27 pruebas únicas aprobadas en ocho archivos**, incluyendo las cinco suites de la primera parte y `radio-card-group.test.tsx`, `text-input.test.tsx` y `-design-ajustes.guard.test.ts`.
- **TypeScript y ESLint aprobados** sobre los componentes modificados.
- **72 comprobaciones de botones y popovers**, más **67 comprobaciones adicionales** de superficies, tipografía y controles en Chrome headless.
- Se monta la página completa `SettingsPage`, sus cinco pestañas reales, su router de memoria, React Query, formularios y componentes de movimiento. Se usan defaults sintéticos del esquema; fetch devuelve 503 y el hook de WebSocket se sustituye solo en el bundle de validación por un transporte inerte. El código del producto no recibe esos stubs.
- Las cinco pestañas se recorren a **1440 y 390 px**, sin desbordamiento horizontal de la muestra ni errores JavaScript sin capturar. Se comprueban etiquetas y ayudas renderizadas, estado de transparencia del tema, campos, clicks, Space/Enter, flechas de radio, un único Tab stop y movimiento reducido.
- Contrastes medidos sobre la superficie del tema: ayuda **10,15:1**, pulgar/pista apagada **8,53:1** y texto de error **4,88:1**. Son mediciones de esos pares concretos; no una certificación de toda la aplicación.
- Retirar Minimalista restaura el token pequeño de Neutro a 9 px y sus etiquetas de fila a 12 px. El navegador de la muestra computó 12 px para el párrafo pequeño pese al token de 9 px; no se atribuye a esta comprobación una medición visual del tamaño mínimo de Neutro.

La evidencia ampliada está en `build-surfaces.cjs`, `check-surfaces.cjs` y `surfaces/results.json` dentro del mismo directorio externo. `surfaces/` incluye capturas de viewport y `*-full.png` de las cinco pestañas a ambos anchos, además de controles encendidos/apagados. La revisión visual incluye capturas completas y muestras de los controles; las composiciones largas de móvil se reducen al mostrarlas.

**Límite de entorno:** no había una instancia local de KameHouse escuchando al revisar los puertos. Se validan pantallas completas con componentes reales y datos sintéticos; no la aplicación conectada a su backend, una biblioteca real, reproducción, guardado real, Tauri o dispositivos físicos. La cobertura de pantallas completas de esta ampliación corresponde a Ajustes; Home, fichas y reproductor reciben las recetas compartidas pero no se recorrieron completos con datos reales.

También se corrige el copy de materiales: se retiran «0% BLUR», el valor fijo «16PX BLUR» y la promesa «cero carga de GPU». Las etiquetas pasan a «Sin desenfoque», «Translúcido» y «Reflejos suaves», y la descripción de plano explica la superficie opaca sin prometer un consumo de hardware nulo. Estos textos compartidos se actualizan también en los otros temas; sus estilos no cambian.
