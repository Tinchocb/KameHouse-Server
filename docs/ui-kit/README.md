# UI Kit del tema Minimalista

Abrí [minimalista.html](minimalista.html) en un navegador. Es una biblioteca interactiva portable, con sus scripts, estilos, fuentes y arte incluidos. El archivo se genera desde el código del proyecto.

## Qué permite probar

- Botones primario, secundario, discreto e icono; estados deshabilitado y cargando.
- Simulación de entrega a mpv con bloqueo de clics repetidos, éxito, error y reintento.
- TextInput, campo técnico, buscador expandible y texto con contador.
- Filtros, OsSelect, selector nativo estilizado, OsToggle, RangeSlider y una línea de tiempo por segmentos.
- Tarjetas reales de saga y película con arte local.
- Composiciones de Acciones rápidas y Más opciones con Popover y MenuButton.
- Inspector plegable con recetas React, reglas extraídas del CSS del tema y tokens copiables.

El menú **Entorno** cambia el ancho real del iframe de la muestra, la transparencia y el movimiento. En el buscador, Ctrl/Cmd+K abre la muestra; el atajo `/` está desactivado inicialmente y puede habilitarse. Los atajos se limitan al ejemplo del buscador y `/` no intercepta campos editables.

Cada ejemplo indica su alcance: **Actual** reutiliza un componente compartido del producto; **Composición** combina componentes existentes con datos y callbacks de prueba. El campo de línea inferior, el selector de eras tipográfico y la línea de tiempo ya están integrados en el tema. `TextArea` está disponible en la librería compartida; su muestra no crea formularios nuevos en la aplicación.

## Datos y límites

La biblioteca funciona sin conexión al backend. La búsqueda recibe datos de prueba en un QueryClient sin conexión. La versión portable incluye una política que bloquea las conexiones de red. Ninguna acción abre mpv, reproduce medios o cambia ajustes del servidor.

Las recetas React muestran imports y puntos de conexión. Los valores y callbacks se deben proporcionar desde la vista que los use. El CSS del inspector se extrae de los archivos al generar el kit y depende del marcado del componente, de `globals.css` y de las utilidades del proyecto; no es una hoja autónoma para cualquier HTML.

## Regenerar

Desde la raíz del repositorio, con las dependencias del proyecto disponibles:

```powershell
node apps/web/scripts/build-minimalist-kit.mjs
```

Para trabajar con recarga de la muestra, desde `apps/web`:

```powershell
node ../../node_modules/@rsbuild/core/bin/rsbuild.js dev --config rsbuild.minimalist-kit.config.ts
```

El servidor de la muestra usa `127.0.0.1:43214`. Su configuración y punto de entrada son independientes de la aplicación.

## Fuentes

- [Contrato del tema](../TEMA-MINIMALISTA.md).
- [Ejemplos y recetas](../../apps/web/src/ui-kit/models.ts).
- [Biblioteca e inspector](../../apps/web/src/ui-kit/kit-app.tsx).
- [Muestras con componentes reales](../../apps/web/src/ui-kit/kit-preview.tsx).
- [Estilos de la biblioteca](../../apps/web/src/ui-kit/kit.css).
- [CSS del tema](../../apps/web/src/styles/themes/classic-minimalist.css).

Los cambios de componentes y tokens se reflejan al regenerar el HTML. La muestra no incorpora rutas nuevas a la navegación del producto.

## Validación de esta versión

El 27 de octubre de 2026 se comprobó la apertura directa del HTML en Chrome sin conexión: 21 ejemplos y 50 combinaciones de componente y estado, sin errores de JavaScript ni solicitudes HTTP. Se revisaron anchos de 320, 390, 736, 1024 y 1280 px, sin desbordamientos horizontales.

También se probaron selección, sliders por teclado, búsqueda con Ctrl/Cmd+K y `/`, copia de código, transparencia reducida, reducción de movimiento y simulación de mpv con error y reintento. Tras integrar las propuestas, se verificaron el campo de línea al recibir foco, TextArea y su contador, EraRail por flechas y SeekBar por teclado, con un solo foco visible por control.

TypeScript, ESLint y 87 pruebas focalizadas pasaron sobre la integración. La validación del producto con datos de prueba se detalla en [TEMA-MINIMALISTA.md](../TEMA-MINIMALISTA.md). Estos resultados no incluyen reproducción real ni entrega real a mpv.
