# Seguimiento de rendimiento

Implementación del 20 de octubre de 2026 sobre el checkout con cambios locales existentes. Sin commit.

## Cambios de esta etapa

- **Cronología:** se completó el filtro de candidatos ya presente. La evaluación recorre directamente nodos cercanos, sin recorrer `volumes` ni buscar cada ID en el DOM. El observer avisa de nuevos candidatos para resolver saltos cuyo callback llega después del rAF de scroll. El listener está en el contenedor principal, sin capturar scrolls de carruseles internos. El último desmontaje desconecta el observer. Se conserva el criterio de foco y la composición de las filas.
- **Diagnóstico:** las pausas de 200 ms o más se cuentan en primer plano; se reinicia la ventana de muestras al cambiar visibilidad o foco. El panel muestra también el intervalo máximo entre cuadros y llama a esos intervalos «cuadros lentos», sin presentarlos como una cantidad exacta de frames perdidos. La navegación se mide desde `onBeforeNavigate` hasta dos rAF después de `onRendered`, descartando navegaciones interrumpidas. Es una estimación de presentación de la ruta, no INP ni una medida de imágenes/datos tardíos.
- **Gobernador existente:** al iniciar esta etapa ya estaba extraído y montado desde el root. Se conservó esa conexión y sus umbrales. Se corrigió el calentamiento para usar tiempo observable, porque a FPS extremadamente bajos la separación entre timestamps retenidos podía impedir su activación. Hay regresión específica a 2 FPS.
- **Ahorro de datos:** un único lector de la preferencia del navegador se usa en las precargas de secciones, raíz y reproductor. Se vuelve a consultar antes de ejecutar tareas encoladas. El reproductor mantiene sus dos turnos ociosos y no se le agregó un timeout forzado.

## Validación

- `pnpm exec vitest run src/components/chronology src/components/shared/use-route-latency.test.tsx src/lib/hardware/frame-window.test.ts src/lib/hardware/performance-governor.test.ts src/components/video/prewarm.test.ts`: **25 suites, 172 pruebas aprobadas**.
- La regresión de Cronología registra 10 filas, salta a la última y comprueba que se mida solo esa candidata. También verifica que el scroll anidado no vuelva a evaluarla y que se cancelen los rAF al desmontar. Es evidencia funcional del trabajo acotado, no una medición de FPS en navegador.
- Regresiones de navegación: incluye espera de carga, navegación interrumpida, pérdida de foco y limpieza al desmontar.
- Regresiones de precarga: ahorro de datos inicial y activado antes de cada turno; preparación escalonada sin timeout forzado.
- `pnpm --filter kamehouse-web typecheck`: aprobado.
- `pnpm --filter kamehouse-web build`: aprobado, incluida la compilación de producción con React Compiler.
- ESLint dirigido: sin errores. Persiste una advertencia previa de `setState` en el efecto de sincronización de `highlightedVolumeId` en `AlternatingTimeline.tsx`.
- El build conserva la advertencia previa de `home.helpers.test.ts` sin exportación `Route`.

## Pendientes de la auditoría

1. **Arte:** optimización de tamaño/formato y precarga selectiva de poses. En esta etapa solo se añadió el respeto por ahorro de datos; con esa preferencia desactivada continúa la precarga de las 12 poses.
2. **Service worker:** continúa el precache completo, incluida su cobertura offline. El nuevo control de ahorro de datos de la interfaz no modifica las descargas de instalación del SW.
3. **Coordinación global:** los productores de precarga siguen separados. Comparten la preferencia de red, pero todavía no una cola ni un presupuesto de evaluación/decodificación.
4. **Medición real:** no había frontend/backend escuchando en 43210/43211/43212 al comprobarlos. Falta una traza comparable de scroll, navegación fría/caliente y reproducción en el equipo objetivo. No se atribuye una mejora numérica de FPS a estos cambios.

## Segunda etapa — 21 de octubre de 2026

### Arte: 33,67 % menos bytes en las imágenes activas

| Métrica | Antes | Después |
| --- | ---: | ---: |
| Las 12 poses del registro | 5.352.303 bytes | 3.549.933 bytes |
| Tamaño equivalente | 5,10 MiB | 3,39 MiB |
| Dimensiones y alfa | Originales | Idénticos |

Se generaron once WebP sin pérdida; el reposo de Kai permanece como PNG porque ya era menor. El script `scripts/optimize-shelf-art.mjs` comprueba dimensiones, alfa y todos los RGB visibles antes de cambiar las URLs. Los valores RGB bajo alfa cero pueden cambiar sin cambiar el píxel visible; el informe lo registra. Se preservaron los PNG fuente y los encuadres CSS.

El ahorro medido corresponde a los archivos solicitados por el registro activo, no a memoria decodificada ni a tamaño del instalador. Conservar originales y derivados agrega aproximadamente 3,35 MiB de archivos a la distribución. Hashes, dimensiones y comparación por archivo: `docs/auditoria/shelf-art-optimization.json`.

### Cola compartida de precargas

- Se eliminó el productor duplicado de secciones de `main.tsx`. El root inicia el calentamiento cuando la interfaz está lista.
- `idle-preload-queue.ts` coordina rutas (prioridad 0), las dos etapas del player (1) e imágenes (2). Mantiene una tarea especulativa en vuelo y pide un nuevo turno ocioso para iniciar la siguiente. La tarea debe terminar, incluida la decodificación de una imagen, antes de continuar.
- Sin un mínimo de 4 ms disponibles, la cola cede el turno. No fuerza `requestIdleCallback` con timeouts. Donde esa API falta utiliza un timer de respaldo de 200 ms; ese fallback no ofrece la misma garantía de tiempo ocioso.
- Pausa nuevos inicios con el documento oculto o ahorro de datos activo y puede despertar al recuperar visibilidad o cambiar la conexión. Deduplica claves en espera/en vuelo y continúa tras un rechazo.
- `prewarmImages` ya no mantiene cuatro imágenes en descarga/decodificación paralela ni marca como cargada una imagen antes de decodificarla. Un error permite reintento; una descarga colgada libera la tarea tras 15 s.
- Las cargas solicitadas directamente por componentes o por el usuario siguen sus recorridos habituales. Esta cola coordina trabajo especulativo de la interfaz; no serializa las consultas que los loaders disparan sin devolver su promesa, ni las descargas propias del service worker. Tampoco garantiza que la evaluación posterior de un módulo importado quepa en 4 ms: ese valor limita su inicio.

### Validación de esta etapa

- **31 suites, 219 pruebas aprobadas**: Cronología, cola, player prewarm, helpers de imágenes, arte, modelo de Series y regresiones del diagnóstico/gobernador.
- **Typecheck y build de producción aprobados**. ESLint dirigido sin errores ni advertencias en los archivos de esta etapa.
- Verificados los hashes de las **12 imágenes servidas en `out`** contra el informe de optimización.
- Confirmado que HLS sigue presente en el manifiesto de precache; no se redujo la cobertura offline.
- Las pruebas de cola cubren prioridad, espera de una tarea asíncrona, presupuesto insuficiente, pausa/reanudación, deduplicación, fallos y cancelación. Las de imágenes cubren espera de decode, errores, timeout y ahorro de datos.
- Continúa la advertencia previa de Rsbuild sobre `home.helpers.test.ts` sin exportación `Route`.
- Al volver a comprobar 43210/43211/43212 no había servicios activos. No se midieron FPS ni latencias de interacción reales.

### Pendientes actuales

La preparación selectiva de poses por intención y el perfil de rendimiento en la aplicación siguen pendientes. Se conserva el precache offline completo. La reducción de bytes y la coordinación de las precargas de interfaz de los puntos 1 y 3 anteriores ya están implementadas; ahora corresponde comprobar el equilibrio entre menor trabajo simultáneo y disponibilidad anticipada de recursos en el equipo objetivo.

## Tercera etapa — poses por intención

La preparación selectiva mencionada arriba queda implementada. La raíz precalienta las seis poses de reposo (1.689.989 bytes) en lugar de las doce poses (3.549.933 bytes). Se difieren 1.859.944 bytes de combate hasta interactuar con las tarjetas: 52,4 % del arte antes precargado globalmente. Son bytes de archivos elegibles para precarga, no una medición de tráfico ni de FPS; la caché y las tarjetas seleccionadas afectan las solicitudes reales.

`SeriesCard` monta combate al seleccionar, hacer clic, enfocar o pasar el mouse con soporte de hover. Con ahorro de datos, hover y foco no lo anticipan; la selección lo carga normalmente. Una pose ya cargada se conserva al cerrar la tarjeta. El reposo permanece visible hasta `onLoad`, incluido el caso de error. La intención se guarda por URL para no trasladarla accidentalmente a otra serie cuando se reutiliza el componente.

Validación: 34 pruebas en seis suites (tarjeta, registro de arte, modelo de Series, contrato de movimiento, imágenes y cola), ESLint dirigido sin advertencias y build de producción con TypeScript aprobados. Sigue la advertencia conocida de la ruta `home.helpers.test.ts`. `git diff --check` pasa en los archivos de esta etapa; el checkout completo contiene problemas de espacios en archivos de otros trabajos. No se alteraron los archivos de arte ni la política offline.

Queda medir navegación y scroll en navegador con datos reales. También se observó que el loader de Series prepara pósters y banners de distintas vistas; conviene medir su utilidad antes de restringirlos, porque la ruta admite tanto estantería como etapas.

## Cuarta etapa — programación del guardado de caché

Se corrigió la acumulación de callbacks ociosos en `createIDBPersister`: al terminar el timer, antes se dejaba de considerar el guardado como programado aunque todavía esperaba `requestIdleCallback`. Una nueva ráfaga podía crear otro timer y otro callback. Ahora timer y turno ocioso forman una sola espera, que consume el estado más reciente. Borrar la caché o guardar al salir cancela ambos tipos de espera; así un callback antiguo no adelanta un guardado nuevo después del borrado.

Validación: seis pruebas del persister aprobadas, incluidas tres regresiones nuevas (ráfaga sostenida durante la espera idle, borrado seguido de nuevo guardado, pagehide con turno pendiente). Typecheck y ESLint dirigido aprobados. `git diff --check` aprobado en los dos archivos modificados. No se repitió el build completo para este cambio interno de planificación.

Siguiente hallazgo confirmado por inspección del paquete instalado: `persistQueryClientSubscribe` llama a `persistQueryClientSave` ante eventos de caché, y este ejecuta `dehydrate` antes de `persister.persistClient`. El agrupamiento del persister reduce escrituras pero no esos recorridos previos. Una comprobación sintética en Node con 500 consultas y 100 llamadas a dehydrate produjo 50.000 evaluaciones del filtro (18 ms en esa ejecución). No representa una traza del navegador ni demuestra que sea el principal cuello de botella actual. El siguiente cambio posible es agrupar antes de dehydrate; exige conservar restauración, invalidación, consultas pausadas y limpieza de suscripciones del proveedor, y merece una medición y pruebas propias.
