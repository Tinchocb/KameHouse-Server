# Segunda pasada de fluidez — 2026-11-10

## Cambios implementados

- **Mi Lista del reproductor:** el foco busca el siguiente vecino vigente, después el anterior y finalmente la cabecera. Excluye filas salientes, inertes, con `aria-hidden`, `hidden`, `display:none` o visibilidad oculta. Vaciar durante una salida lleva el foco a la cabecera antes de retirar las filas.
- **Presencia:** `PresenceSurface` conserva los valores explícitos de `inert` y `aria-hidden` mientras está presente. Durante la salida impone ambos estados; reabrir restaura la configuración del consumidor.
- **Configuración del reproductor:** tanto el panel como los submenús usan esa protección. Se reprodujo que los controles de un submenú saliente seguían activos; la regresión comprueba cierre y reapertura inmediata.
- **View Transitions:** activar movimiento reducido durante una transición llama una sola vez a `skipTransition()`. La actualización se completa; el listener se retira al finalizar o rechazar `finished`. También se prueba el fallo durante la creación nativa.
- **Tarjetas:** cambiar la preferencia durante una presión ya no deja una escala de 0,97 al volver a movimiento normal. Los destinos neutros mantienen la finalización del gesto y restablecen inmediatamente escala y elevación. Pósters y tarjetas de saga neutralizan también la entrada heredada.
- **Panel lateral del reproductor:** la superficie mantiene su propia suscripción mientras sale. Al activar movimiento reducido neutraliza la transformación aunque `AnimatePresence` conserve los props del cierre anterior. La salida termina y desmonta; la reapertura recupera interacción y movimiento normal. No se habilita arrastre con movimiento reducido.
- **Paleta:** el fundido global pasa de 400 a 150 ms (`--duration-quick`), con limpieza de la marca a los 200 ms. Se conservan materiales, desenfoques y expansiones que redistribuyen contenido.

No se modificaron APIs públicas, dependencias, formatos persistidos ni ajustes de usuario. Se preservaron los cambios locales concurrentes. Sin commit, push, publicación, despliegue ni reinicio de la instancia real.

## Cascadas revisadas

| Superficie | Máxima demora real | Resultado |
| --- | ---: | --- |
| Grillas y hub | `min(i, 6) × 40 ms` = 240 ms | Se conserva; comentario del hub corregido |
| Bloques de entrada | Tres bloques, pasos de 40 ms = 80 ms | Se conserva |
| Hijos de MediaSpotlight | Tres entradas, pasos de 60 ms = 120 ms | Se conserva |
| Primeros pasos | Tres entradas, pasos de 40 ms + 20 ms iniciales = 100 ms | Se conserva |
| AlternatingTimeline | Una fila de entrada anticipada (`EAGER_ROWS = 1`), índice 0 | No hay cascada acumulada que recortar |

No se encontraron otras cascadas activas que excedieran 240 ms en las superficies revisadas.

## Rendimiento: procedimiento y alcance

Chrome local sin interfaz, servidor de desarrollo aislado en el puerto 43330, colección sintética de **100, 500 y 1000 elementos**. Las APIs se interceptan; peticiones externas y mutaciones reales se bloquean. Imagen local compartida, rotación automática y audio desactivados, perfil de rendimiento ultra y gobernador desactivado para comparar las mismas condiciones.

Por tamaño y escenario: una preparación sin registrar y **cinco mediciones** con caché. Cuatro escenarios: cambio de era del hero, expansión de Series, cambio de era de Cronología y navegación Inicio → Películas. Cada pasada contiene 60 mediciones y tres primeras cargas registradas aparte: **63 filas antes y 63 después**. Las trazas incluyen la acción y 700 ms posteriores, eventos de layout/estilos/pintura e intervalos entre callbacks de `requestAnimationFrame`.

La colección no equivale a esa cantidad de tarjetas visibles: a 1000 elementos hay aproximadamente 539 nodos en Inicio, 1135 en Cronología y 6931 en Series. La estantería sí aumenta su contenido montado; hero y Cronología conservan una superficie acotada.

### Comparación de la superficie modificada

Medianas de cinco repeticiones. El p95 es la mediana del percentil 95 de los intervalos rAF de cada repetición, en ms; **no es una medición de FPS del producto ni del equipo del usuario**. Estilos corresponde a la suma de `UpdateLayoutTree` en la ventana completa.

| Escenario | Elementos | p95 antes → después | Estilos antes → después |
| --- | ---: | ---: | ---: |
| Hero / era | 100 | 60,53 → 48,46 | 478,93 → 418,80 ms |
| Hero / era | 500 | 72,74 → 42,41 | 532,26 → 404,96 ms |
| Hero / era | 1000 | 72,77 → 48,48 | 503,14 → 417,36 ms |
| Cronología / era | 100 | 121,06 → 72,72 | 421,45 → 248,24 ms |
| Cronología / era | 500 | 121,22 → 60,62 | 433,68 → 233,60 ms |
| Cronología / era | 1000 | 133,32 → 66,66 | 415,65 → 260,93 ms |

El coste repetido de recalcular variables de color sobre la superficie completa se reduce al acortar el fundido. Persiste trabajo de estilos considerable: este cambio no demuestra fluidez constante a 60 Hz.

### Aislamiento y controles

Se probaron cinco variantes diagnósticas con 1000 elementos, hero y Cronología: retirar únicamente el blur; acortar únicamente la paleta; retirar únicamente la transición de paleta; combinar fundido corto y ausencia de blur; retirar ambos. Cada variante tiene una preparación y cinco repeticiones por escenario, más su primera carga aparte: 11 filas por variante, 55 en total.

| Variante diagnóstica | Estilos hero | Estilos Cronología |
| --- | ---: | ---: |
| Sin blur | 523,53 ms | 398,92 ms |
| Solo paleta a 150 ms | 408,32 ms | 232,96 ms |
| Sin transición de paleta | 340,54 ms | 202,51 ms |
| Paleta a 150 ms y sin blur | 404,98 ms | 239,44 ms |
| Sin transición ni blur | 354,77 ms | 196,21 ms |

Retirar el blur por sí solo no aporta evidencia suficiente para cambiar el material. Se eligió el fundido corto, conservando el diseño. Estas variantes son overrides de diagnóstico; las variantes sin blur o sin transición no se incorporaron al producto.

A 1000 elementos, los otros escenarios muestran variabilidad:

| Escenario | p95 antes → después | Layout acumulado | Estilos | Pintura |
| --- | ---: | ---: | ---: | ---: |
| Expansión de Series | 24,24 → 12,13 | 23,71 → 24,31 ms | 35,68 → 32,00 ms | 51,70 → 43,92 ms |
| Navegación a Películas | 18,23 → 24,22 | 7,74 → 7,81 ms | 398,86 → 436,09 ms | 56,46 → 56,04 ms |

La navegación empeoró en esa muestra. No se atribuye una mejora general a los componentes ni se retiraron sus animaciones de redistribución. El mayor evento individual de layout entre las 60 mediciones fue **15,455 ms antes y 7,385 ms después**; el evento previo de 22 ms no se repitió. Eso no garantiza que no pueda ocurrir con otra colección o carga del equipo.

Las trazas seleccionadas no registraron eventos de decodificación de imagen en la categoría capturada. Se usa el mismo recurso local y preparación con caché; no se midió por separado un ciclo completo de descarga/decodificación de imágenes distintas. La ausencia de esos eventos no prueba coste cero. Las primeras cargas fueron 12017/1997/1971 ms antes y 1633/1262/1370 ms después para 100/500/1000: incluyen calentamiento y compilación del servidor de desarrollo, por lo que **no sustentan una mejora de primera carga**.

## Validación

- TypeScript y lint dirigido de los componentes y pruebas modificados: sin errores; lint final sin advertencias propias. Se conserva el aviso de Browserslist desactualizado, sin actualizar dependencias.
- Suite completa final: **204 archivos, 1521 pruebas aprobadas**. Incluye eliminaciones consecutivas y foco entre filas ocultas/salientes, estados explícitos de accesibilidad, cancelación y limpieza de View Transitions, submenús salientes y preferencia durante el cierre lateral.
- Build de producción aprobado tras los cambios finales. El build incluye TypeScript.
- Escena de navegador: **14 resultados aprobados**, siete por preferencia. Eliminación consecutiva de cuatro filas, vaciado durante salida, presencia explícita, cambio de preferencia durante hover/presión, transición nativa interrumpida, controles del reproductor y ausencia de errores JavaScript.
- Transición nativa real: una suscripción adicional durante su ejecución; vuelve al valor inicial al terminar, también después de restaurar movimiento normal. La fixture prolonga la transición para aislar `skipTransition()` de la cancelación automática del CSS del navegador.
- Cierre lateral con preferencia activada en curso: 12 muestras posteriores a recibir la preferencia con `transform:none` e `inert`; desmontaje final y reapertura normal comprobados.
- Matriz final: **45 resultados aprobados**, cuatro recorridos y control de errores JavaScript en nueve perfiles. Tres temas de escritorio con ambas preferencias, móvil táctil con ambas preferencias y contrato TV. Comprueba última selección en Ajustes y filtros, navegación rápida siguiente/anterior del inspector, cierre/reapertura y foco de origen, cambio de preferencia durante navegación y liberación de la señal de entrada. Ningún desbordamiento horizontal en la comprobación final de Películas. Ver nota de investigación abajo.

### Reproducción local y límites

Se generó un clip local de 20 segundos con patrón de prueba y audio silencioso. La escena monta **`usePlayerCore` y `PlayerUI` reales**: reproducción y frames decodificados, pausa, arrastre de seek hasta aproximadamente 14,05 s, silencio/sonido, teclado de volumen, configuración Audio, cierre/reapertura y pantalla completa. Ambas preferencias registraron 176 frames decodificados durante el recorrido; capturas verificadas. La fixture de video admite rangos HTTP para que seek reproduzca el contrato de un recurso real.

Esto no valida Drive, OAuth, HLS remoto, subtítulos de una biblioteca personal ni reproducción conectada. El perfil móvil emula tacto a 390 px; TV activa el contrato `data-tv` a 1920 px. No sustituye un dispositivo móvil, Tauri o mando físico. Esas comprobaciones siguen pendientes sin una sesión disponible.

### Investigación de Ajustes y concurrencia

Las primeras dos matrices registraron un fallo intermitente al alternar rápidamente Ajustes, cada vez en un tema distinto: se mostró el límite de error de la aplicación. Una repetición específica de 15 cargas pasó; al permitir 45 ms entre acciones para que el panel Sistema alcanzara a cargar, se reprodujo el fallo y se capturó su causa: `Cannot read properties of undefined (reading 'diskItemCount')` en `SystemTab`.

La fixture devolvía el valor genérico `[]` para `/api/v1/system/cache/stats`, aunque el contrato requiere un objeto con `thumbnails` y `videofiles`. Se corrigió esa respuesta sintética con estadísticas vacías válidas. No se cambió el código de Sistema para tolerar datos inventados por el arnés. Se conservan las matrices previas y `settings-loaded-invalid-fixture-results.json`, que contiene la excepción capturada. Las **30 repeticiones específicas finales pasaron**, usando el contrato corregido y la misma pausa de 45 ms. Las peticiones externas abortadas deliberadamente aparecen como `ERR_FAILED` en sus registros de consola; no hubo nuevas excepciones de React en esas repeticiones.

La primera ejecución de la suite también encontró una prueba de Drive que desapareció del nombre original durante la ejecución; el archivo actual lleva prefijo `-`. La suite completa sobre el estado posterior pasó. No se restauraron ni editaron esos cambios concurrentes.

## Evidencia y reproducción

Directorio: `scratch/motion-second-pass-20261110/`.

- `fixtures.cjs`, `bench.cjs`, `baseline/results.json`, `after/results.json`, trazas individuales y variantes `diagnostic-*`.
- `scene.tsx`, `scene-context.cjs`, `build-scene.cjs`, `scene-tests.cjs`, `scene-results.json`, clip y capturas del reproductor.
- `panel-live.cjs`, `panel-live-results.json`, `matrix.cjs`, `matrix-results.json`, matrices previas conservadas, `settings-rapid-results.json` y `settings-loaded-rapid-results.json`.
- `full-tests-final.log`, `build-final.log` y `panel-tests.log`.

Los antiguos artefactos temporales de la pasada previa ya no estaban disponibles al retomar; esta evidencia se regeneró. Para repetir, iniciar un servidor de desarrollo aislado en 43330 y ejecutar los scripts con Chrome instalado y Playwright disponible en el workspace. Las trazas miden esa instalación local y no constituyen un benchmark de producción.
