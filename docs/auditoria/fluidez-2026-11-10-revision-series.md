# Revisión de interacción en Series — 2026-11-10

Continuación de las microinteracciones adicionales. Se revisaron los cambios consecutivos de los controles recientes y se siguió el fallo del guard de botones hasta su estado actual.

## Hallazgos y correcciones

1. **Activación de teclado cruzada.** La cabecera era un `div role="button"` con un manejador de Enter/Espacio y contenía la acción rápida de reproducción. Las teclas del botón interior alcanzaban al manejador de la cabecera, que podía desplegarla e impedir la activación nativa del botón. Ahora el despliegue usa un botón nativo sobre la cabecera y la reproducción es un control independiente. Ratón, tacto, Enter y Espacio mantienen sus acciones respectivas.
2. **Foco en contenido cerrado.** Si el panel se cerraba mientras un botón interior tenía foco, podía quedar en contenido inerte. Un efecto de layout devuelve el foco al disparador cuando detecta ese caso. No mueve el foco si ya está fuera de la región. El panel cerrado expone además `aria-hidden`; reabrir conserva sus nodos y recupera interacción.
3. **Movimiento reducido incompleto.** La portada todavía usaba zoom de hover sin compuerta y el progreso transicionaba durante 500 ms. El zoom ahora exige movimiento normal y puntero fino. El progreso usa el tiempo base y se actualiza directamente con movimiento reducido; el chevron conserva su orientación final sin interpolación. La expansión que redistribuye el contenido se conserva.
4. **Botón rápido con receta local.** Se migró a `Button secondary`, usando `leftIcon` para mantener icono y texto alineados. Conserva la visibilidad por hover/foco en escritorio y las acciones desplegadas en móvil. Reutiliza foco y feedback del sistema.

La regla `button-recipes.guard.test.ts` que había fallado en la pasada anterior **ya pasaba al retomar**, después de una actualización local del estilo de la acción rápida. Se verificó antes de editar; no se atribuye su corrección inicial a esta revisión. La migración actual mantiene el guard aprobado sin ampliar el baseline.

## Validación

- Regresiones de Series: controles nativos independientes, teclas de la acción rápida sin despliegue, foco al cerrar y reapertura del mismo contenido. Con las pruebas de `MenuButton` y el guard: **3 archivos y 9 pruebas aprobadas**.
- Suite completa: **210 archivos y 1541 pruebas aprobadas** sobre el workspace disponible durante esta revisión.
- TypeScript y lint dirigido aprobados. Build de producción aprobado. El primer intento de build observó una variable temporalmente sin uso en `spotlight-hero.tsx`, que ya se utilizaba al volver a inspeccionar el archivo; se repitió sobre el estado posterior sin editar ese componente. Persiste el aviso de Browserslist desactualizado.
- Navegador: **8 perfiles aprobados**, tres temas con ambas preferencias en escritorio de 1440 px y Por era con ambas preferencias en móvil táctil de 390 px. Se verificaron Enter/Espacio en despliegue y reproducción, apertura táctil, cierre con foco dentro, cuatro inversiones rápidas, preferencia cambiada en vivo, portada sin zoom con movimiento reducido y reapertura. Sin errores JavaScript ni desbordamiento horizontal.
- La comprobación CSS valida que la cabecera tenga realmente posición absoluta antes de probarla, para evitar aceptar una escena sin estilos. Con movimiento reducido, las transiciones quedan por debajo de 1 ms debido a la regla global; la portada no conserva transformaciones decorativas. Se inspeccionaron capturas móvil y escritorio.

Las escenas usan el componente real con datos sintéticos y callbacks de reproducción contados localmente. No abren contenido de Drive ni prueban reproducción conectada o mando físico. No se midió una mejora de FPS en esta revisión.

## Evidencia y límites

Directorio `scratch/motion-second-pass-20261110/`: `review-series.tsx`, `review-series.cjs`, `review-series-results.json`, capturas `review-series-*`, `review-related.log`, `review-full-tests.log` y `review-build.log`.

Se conservaron los cambios locales y el diseño existente. Sin cambios de dependencias, API o persistencia. Sin commit, push, despliegue ni reinicio de la instancia real; solo se utilizó un servidor de desarrollo aislado.
