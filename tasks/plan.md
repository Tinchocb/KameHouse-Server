# Plan de implementación: optimización del frontend de KameHouse (`apps/web`)
 
**Estado:** aprobado por el usuario el 2026-11-17.
**Tareas detalladas:** [`tasks/todo.md`](todo.md).
**Origen:** plan de planificación en `C:\Users\marti\.claude\plans\fancy-imagining-swan.md`.

## Resumen

Cerrar lo que quedó abierto de las auditorías Z2 a Z5 (catálogo, datos, código muerto y bundle, calidad) y medir antes y después. Cada tarea es vertical: recorre una ruta o un flujo completo, con criterios medibles y verificación. No cambia diseño, contratos de API ni codegen.

## Decisiones de arquitectura

1. **Modo TV retirado.** Respuesta del usuario. Los hooks del D-pad (`tv-spatial`, `use-focus-navigation`, `use-tv-dpad`, `use-responsive`) están borrados en el índice de git, así que no hay restricciones de D-pad. Se mantienen teclado y lector de pantalla.
2. **Reproductor: auditar primero.** Respuesta del usuario. Z1 no tiene auditoría. La fase P es solo lectura, y ningún cambio en `components/video/` se hace sin revisar ese informe.
3. **Medición en build de producción.** Config temporal que escribe en `scratch/` (ignorado por git, `.gitignore` L36). No usar `pnpm --filter kamehouse-web build` para medir, porque escribe `out/`.
4. **Comparaciones A/B en la misma corrida.** Otras sesiones miden a la vez, así que los tiempos absolutos varían entre 20 y 30 %. Preferir conteos (pedidos, KB, renders, nodos).
5. **Datos reales en solo lectura.** Proxy de registro que reenvía `/api` a `43212`, bloquea todo lo que no sea GET y bloquea siempre `PATCH /api/v1/continuity/item`.
6. **Puertos.** No tocar `43211` (app real). `43210` (dev server, PID 17208) y `43212` (API, PID 19036) están activos: no se reinician ni se matan. Procesos propios se matan solo por PID o puerto.
7. **Git.** No commit ni push sin pedido explícito. Árbol sucio: antes de editar, `git diff -- <archivo>`. Si otra sesión modifica ese archivo, la tarea queda en espera.
8. **Decisiones previas que no se reabren** (`docs/prompts/auditoria-frontend.md` §3): `DeferredMount`, `PageTransition` con `enter-stagger`, `CommandPalette` lazy, episodios virtualizados, eras de Cronología, portada → ficha con `shared-element`, `useRouterState` con selector.
9. **Descartado en auditorías, no repetir:** virtualizar grillas (la biblioteca tiene 27 películas y 6 series), diferir eras de Cronología, quitar `useHeroBackdrop` sin decisión visual, `fetchPriority` en `TimelineVolumeCard`, deduplicar `localFile` en `anime-entry`.

## Grafo de dependencias

```
rsbuild.config.ts · rsbuild.pwa.ts · tailwind.config.ts          (T1.1, T1.3, T5.2)
 └─ main.tsx  (entrada; VITE_SCAN en T1.2)
     └─ app/client-providers.tsx  (QueryClient, persistencia, Motion, WS)   (T1.4, T3.2)
         ├─ lib/query-persister.ts                                          (T3.3, T3.4)
         ├─ api/client/requests.ts ── api/hooks/tmdb-episode, anilist-episode (T3.1, T3.2)
         ├─ lib/stores/index.ts ── lib/server/persist-settings.ts           (T3.5, T4.2)
         └─ routes/__root.tsx  (shell)                                      (T2.1)
              ├─ components/shared/page-transition.tsx                      (T2.1)
              ├─ components/ui/app-layout/expandable-search.tsx             (T4.3, T4.4)
              ├─ components/shared/dynamic-backdrop.tsx                     (T2.4)
              └─ routes/
                   ├─ home · series (ficha: T2.3, T2.5) · movies (T2.2) · chronology
                   └─ settings (T4.1, T4.6, T3.6)
```

Dependencias explícitas:
- T0.2 → todas las demás.
- T1.4 → T3.4.
- T3.1 → T3.2.
- T3.3 → T3.4.
- T4.1 → T4.2.
- T4.3 → T4.4.
- T4.5 → T4.6.
- T5.1 y T5.2 esperan a la otra sesión.
- TP.1 → checkpoint P → cualquier cambio de reproductor (plan aparte).

Archivos calientes, una tarea a la vez: `__root.tsx`, `client-providers.tsx`, `requests.ts`, `query-persister.ts`, `settings/index.lazy.tsx`, `expandable-search.tsx`, `rsbuild.config.ts`, `main.tsx`.

## Lista de tareas

### Fase 0: línea base (sin cambios de producto)

- [ ] T0.1 Preparar la medición (S)
- [ ] T0.2 Línea base registrada (M)
- [ ] **Checkpoint 0:** revisión humana de la línea base

### Fase 1: arranque en frío

- [ ] T1.1 Ajustar `ui-primitives` (S, MEDIO)
- [ ] T1.2 Verificar y quitar `VITE_SCAN` (XS)
- [ ] T1.3 Comentario falso del precache (XS)
- [ ] T1.4 Caché antes que los loaders (M, MEDIO)
- [ ] **Checkpoint 1:** bundle A/B y pasada manual de Ajustes, paleta, popover y ficha

### Fase 2: navegación y catálogos

- [ ] T2.1 Shell compilable (M, MEDIO)
- [ ] T2.2 Películas compilable (M, MEDIO)
- [ ] T2.3 Ficha de serie compilable (XS)
- [ ] T2.4 Backdrop global por el proxy (S)
- [ ] T2.5 Póster de la ficha de serie como LCP (S)
- [ ] **Checkpoint 2:** renders y compilación contra T0.2, pasada manual con teclado

### Fase 3: datos bajo fallo y persistencia

- [ ] T3.1 Miniaturas de respaldo sin reintentos (S)
- [ ] T3.2 Reintentar 5xx solo con `Retry-After` (M, MEDIO)
- [ ] T3.3 Exclusiones de persistencia (XS)
- [ ] T3.4 Decidir si se persisten las fichas `anime-entry` (S, condicionado)
- [ ] T3.5 Ajustes persistidos una sola vez (M, MEDIO)
- [ ] T3.6 Suscriptores WS pasivos (S)
- [ ] **Checkpoint 3:** tormenta 503, restauración en frío, ráfaga WS, persistencia sin logs

### Fase 4: Ajustes y buscador

- [ ] T4.1 Ajustes con error de carga visible (S)
- [ ] T4.2 Sliders con un PATCH al soltar (M, MEDIO)
- [ ] T4.3 Foco al cerrar el buscador (XS)
- [ ] T4.4 Semántica de combobox en el buscador (M, MEDIO)
- [ ] T4.5 Guardián de tipos de Ajustes (S)
- [ ] T4.6 Quitar casts del formulario (M, MEDIO)
- [ ] T4.7 Episodio sintético tipado (XS)
- [ ] T4.8 Tests de foco de diálogos (S)
- [ ] **Checkpoint 4:** flujos de Ajustes, buscador por teclado, axe en cinco rutas

### Fase 5: arte, tokens y limpieza

- [ ] T5.1 Arte de la estantería (M, **en espera**)
- [ ] T5.2 Token inexistente en la estantería (XS, **en espera**)
- [ ] T5.3 Exports sin uso, parte A (S)
- [ ] T5.4 Exports sin uso, parte B (S)
- [ ] T5.5 Listón de `lint` (decisión, sin ejecutar)
- [ ] **Checkpoint 5 (final):** definición de hecho completa y comparativa frente a T0.2

### Fase P: reproductor (solo auditoría)

- [ ] TP.1 Auditoría Z1 (M, sin cambios de código)
- [ ] **Checkpoint P:** revisión humana del informe Z1 antes de tocar `components/video/`

## Riesgos y mitigaciones

| Riesgo | Impacto | Mitigación |
|---|---|---|
| Otras sesiones editan los mismos archivos | Alto | `git diff` antes de editar; en espera si hay cambios ajenos |
| Medición ruidosa (otras sesiones midiendo) | Medio | A/B en la misma corrida, medianas de 5 repeticiones, conteos |
| Chrome headless no es WebView2 (Tauri) | Medio | Pasada manual en Tauri, a cargo del usuario |
| Cambios que tocan el compilador alteran el comportamiento | Medio | Tests y pasada manual en cada checkpoint |
| Persistencia (T1.4, T3.5) afecta la rehidratación de Ajustes | Alto | Pruebas de restauración y recarga; medir antes |
| Reintentos: el servidor no envía `Retry-After` en estados permanentes | Bajo | El cliente reintenta solo con señal explícita; el cambio de servidor queda fuera |

## Preguntas abiertas

1. `apps/web/knip.json` está versionado, pero `knip` no está en `package.json`. ¿Se instala como devDependency al final, con aprobación explícita, o se borra?
2. QA-09: ¿`lint` debe fallar con warnings?
3. Medición en Tauri y en TV: requiere el equipo del usuario.

## Verificación final

- **Automática:** `pnpm --filter kamehouse-web typecheck`, `lint`, `lint:tokens` y `test:run`. `pnpm codegen:check` solo si se tocara codegen, cosa que no se prevé.
- **Build de medición** en `scratch/` con la misma config temporal de T0.2. `pnpm --filter kamehouse-web build` solo al cierre y con visto bueno del usuario, porque escribe `out/`.
- **Medición:** tabla de T0.2 frente al estado final (JS inicial, precache, compilación, renders, pedidos, LCP).
- **Manual:** Inicio, Series, ficha, Películas, Cronología, Ajustes, navegación por teclado y buscador.
- **Limpieza:** borrar las configs temporales `apps/web/rsbuild.*-*.config.ts` y `scratch/`. Matar procesos de preview solo por PID.
