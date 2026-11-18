# Minimalista: revisión ampliada del 4 de noviembre de 2026

Se revisaron las hojas del tema y los componentes compartidos, incluyendo la combinación de estados de los cambios anteriores. Se corrigieron estos problemas comprobados:

| Problema | Causa | Corrección |
|---|---|---|
| Skeleton conserva brillo y sombra | Los selectores buscaban nombres que el componente no emite | `data-skeleton` en el componente; acabado estático y plano, conservando su geometría |
| Indicadores de actividad reciben cajas de skeleton | Se usaba `.animate-pulse` como identificador de esqueleto | Estilos limitados a marcadores de esqueleto |
| Foco desaparece al pasar el ratón | El canto del secundario y la supresión genérica de sombras competían con el anillo | Canto mediante token y supresión excluyendo controles con foco |
| Selector deshabilitado responde a hover | El estilo de respaldo compartido seguía aplicándose | Fondo y transformaciones desactivados explícitamente |
| Selector mantiene compresión en movimiento reducido | Usaba el `active:scale-95` compartido | Pulsación y transición mediante tokens del tema |
| Etiquetas extensas ensanchan el selector | El ancho intrínseco no tenía límite | Ancho máximo y desplazamiento horizontal interno |
| Campos compactos y menús táctiles demasiado pequeños | Texto de escritorio y filas de 38 px | Texto editable de 16 px y opciones de al menos 44 px en táctil |
| Ayudas largas desbordan | Texto sin ajuste y palabras sin espacios | Ancho limitado, ajuste de línea y corte de palabras largas |
| CTA del hero conserva efecto de hover en estados incompatibles | Hover sin excluir deshabilitado ni pulsación | Exclusión de ambos estados sin aumentar prioridad sobre la pulsación |

Las reglas de hover restantes de avisos y selector de sagas se limitaron a ratón. Las rutas, contenido y encuadres se conservaron.

## Verificación

- 27 pruebas en `classic-minimalist.guard.test.ts`, `segmented-control.test.tsx` y `button-recipes.guard.test.ts`.
- ESLint del componente Skeleton sin errores. La herramienta avisó que su base Browserslist está desactualizada; no se actualizaron dependencias.
- La suite de selectores pasó con avisos de React sobre actualizaciones fuera de `act`; no se modificaron esas pruebas.
- 20 comprobaciones en Chrome sobre una muestra con SSR de Button, Skeleton y SegmentedControl reales y CSS global compilado. Menú y tooltip usan marcado representativo.
- Comprobación de foco por teclado combinado con hover, hover deshabilitado, pulsación, reducción de movimiento, geometría de skeleton, aislamiento de indicadores, campos táctiles, filas de menú y texto largo.
- Capturas a 1440 y 320 px. La muestra no desbordó a 320 px; el selector conservó desplazamiento interno y el tooltip partió la cadena larga.

No se recorrieron las rutas completas de la aplicación, no se comprobó la apertura real de menús o tooltips ni se usaron dispositivos físicos. Los componentes renderizados mediante SSR no ejecutan sus callbacks React en esta muestra; la navegación por flechas del selector está cubierta por su suite de componentes. No se comprobó reproducción real ni se regeneró el UI Kit portable histórico.
