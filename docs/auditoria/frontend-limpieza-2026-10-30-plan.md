# Plan corregido de limpieza del frontend

## Actualización verificada el 2026-11-04

El resto de este documento conserva la propuesta del 30 de octubre como antecedente. El working tree cambió antes de esta ejecución:

- Las 34 imágenes de sagas ya existen. No se restauró ninguna en esta revisión.
- Los 64 candidatos ya estaban archivados; se compararon sus bytes contra las rutas originales del índice Git: 64 de 64 idénticos.
- El informe de arte ya coincide con las 12 rutas activas y todos los hashes source/optimized verifican.
- getGlowTransform, MOVIE_STATUS_OPTIONS y formatDecade ya no aparecen en src; las constantes de audio ya son internas.
- src/ui-kit/index.tsx, rsbuild.minimalist-kit.config.ts y scripts/build-minimalist-kit.mjs ya no existen. Se conservan los artefactos docs/ui-kit. La propuesta de agregar scripts y entradas Knip para esos archivos queda sin efecto en el árbol actual; no se reconstruyó un workbench eliminado por cambios anteriores.

En esta ejecución se agregó el README del archivo histórico y se actualizó SOURCES.md con su ubicación y la selección actual DBZ/Kai. No se atribuyen a esta ejecución los cambios preexistentes enumerados arriba.

Validación: inventario, igualdad binaria de 64 archivos, rutas y SHA-256 de 12 imágenes comprobados. No están disponibles las instalaciones locales de Vitest y TypeScript inspeccionadas, por lo que suite, typecheck y builds permanecen pendientes; tampoco se realizó QA visual. No se instalaron dependencias ni se modificaron lockfiles.


Fecha: 2026-10-30. Estado: propuesta verificada estáticamente. No se aplicaron restauraciones, cambios de código, movimientos, borrados ni staging.

## Resumen y alcance

El plan original se contrastó con el working tree, que contiene numerosos cambios previos. Esta revisión no acredita la supuesta auditoría anterior con tres subagentes; no se delegó trabajo. El alcance es referencias, assets y correcciones al plan, no una auditoría arquitectónica integral.

- Alta: faltan 34 imágenes de sagas con referencias literales vigentes. Git no permite inferir si el borrado fue accidental.
- Moderada: el informe de arte registra las rutas anteriores al intercambio DBZ/Kai. Los archivos nuevos coinciden por SHA-256 con las entradas anteriores.
- Baja: tres declaraciones sin consumidores encontrados y dos exports de constantes internas son candidatos de limpieza.
- Distribución: de 76 imágenes de estantería, 12 están activas y 64 quedan fuera del registro. Las 64 suman 26.618.011 bytes: 25,38 MiB, o 26,62 MB decimales. Esto no mide ahorro de transferencia al navegar ni reducción del historial Git.

## 1. Restaurar solamente las sagas faltantes

Revisar de nuevo el estado antes de implementar. Restaurar únicamente las 34 rutas enumeradas en el anexo desde el índice, si conserva las versiones deseadas; inspeccionar cualquier cambio staged antes de elegir el origen. No usar checkout indiscriminado del directorio ni revertir otras modificaciones.

Ejemplo para una ruta previamente comprobada:

```powershell
git restore --worktree -- apps/web/public/sagas/baby.webp
```

Después, verificar existencia y solicitudes sin 404 en Cronología y Series. El build y TypeScript no garantizan que una URL literal de public exista.

## 2. Archivar el material histórico fuera de public

La lista completa y sus referencias están en los anexos y en `frontend-limpieza-2026-10-30-assets.json`.

Propuesta preferida: mover los 64 candidatos a `docs/assets/series-icons-archive/`, conservando subcarpetas por era y nombres, después de verificar colisiones en destino. Así se retiran de public conservando originales de edición. No reduce el tamaño total del checkout. La eliminación definitiva es una alternativa distinta, no ejecutada.

Actualizar SOURCES.md para distinguir selección actual de historia y enlazar los originales archivados, preservando atribuciones. Conservar los informes históricos como fotografías de su fecha. Todos los candidatos están rastreados, pero no se verificó que cualquier modificación local de sus bytes ya estuviera en un commit: el historial no sustituye la preservación del trabajo local.

No borrar por complemento de una lista de 12 PNG: preservar créditos y revisar cualquier archivo nuevo aparecido desde esta auditoría.

### Evidencia y límites de la búsqueda

Se buscaron rutas relativas por era y nombres base en archivos de texto del repositorio enumerados por rg, incluidos ocultos y no rastreados no ignorados. Extensiones: ts, tsx, js, mjs, cjs, json, html, css, md, yaml, yml, toml, ps1, py, txt y csv. Se excluyeron .git, node_modules, out y out-ui-kit y se respetaron las reglas ignore de rg. No se inspeccionaron fuentes externas, binarios, builds ignorados ni URLs persistidas en el backend.

Las coincidencias por nombre base son pistas ambiguas, pues varias eras comparten nombres. El JSON las separa de las coincidencias de ruta. No se encontraron consumidores ejecutables de las rutas candidatas en el alcance revisado; sí existen referencias documentales a conservar o actualizar.

Se revisó además `scripts/optimize-shelf-art.mjs`: deriva los PNG fuente desde las 12 rutas activas de goku-panorama.ts. Ninguno de los 64 candidatos es necesario para esa derivación actual. El test lee source y optimized del informe; corregir primero sus rutas antiguas. No ejecutar el optimizador como reparación del informe: recodifica imágenes y modifica la configuración.

## 3. Corregir el registro del intercambio DBZ/Kai

En `docs/auditoria/shelf-art-optimization.json`, actualizar ambas columnas, source y optimized:

- `/icons/series-icons/dbz/reposo-brazos-cruzados.png` pasa a `/icons/series-icons/dbkai/reposo-brazos-cruzados.png`.
- `/icons/series-icons/dbkai/reposo-frente.png` pasa a `/icons/series-icons/dbz/reposo-frente.png`.

Los hashes actuales ya corresponden a los mismos bytes en las ubicaciones nuevas. No hay que sustituirlos para forzar el test. Mantener datos de tamaño, dimensiones e igualdad de píxeles solo mientras siga demostrada esa identidad. Los nuevos archivos siguen sin rastrear y las ubicaciones anteriores figuran eliminadas: incluir el conjunto completo en un futuro commit autorizado, sin staging como efecto lateral de la revisión.

## 4. Limpiar las declaraciones reales

Repetir la búsqueda de consumidores antes de implementar. El anexo contiene los bloques actuales completos que se propone eliminar. Quitar también el comentario asociado a getGlowTransform si queda sin objeto. Conservar MovieStatus, que forma parte del resto de las utilidades.

En `apps/web/src/routes/series/$seriesId/-components/series-audio-profile.ts`, quitar únicamente export de AUDIO_PROFILE_LABELS y AUDIO_PROFILE_SIGLAS; conservar tipos, valores y uso interno. No se promete una mejora medible del bundle.

## 5. Mantener y declarar el UI Kit

Mantener TextArea, tests, catálogo, kit-preview y workbench: hay un consumidor real de desarrollo. La configuración tiene entrada separada y salida out-ui-kit; el script genera docs/ui-kit/minimalista.html. No se midió el bundle productivo en esta revisión.

Agregar a scripts de apps/web/package.json sin reemplazar los existentes:

```json
"build:ui-kit": "node scripts/build-minimalist-kit.mjs",
"dev:ui-kit": "rsbuild dev --config rsbuild.minimalist-kit.config.ts"
```

Agregar `src/ui-kit/index.tsx` y `rsbuild.minimalist-kit.config.ts` a entry de apps/web/knip.json. No excluir todo el workbench para ocultar avisos. Knip debe interpretar ambas entradas; no certifica por sí solo las URLs de public ni todos los usos dinámicos.

## 6. Verificación propuesta

Guardar baseline de tests y typecheck antes de implementar y repetir después con las mismas herramientas. Separar fallos previos de regresiones, sin prometer un número fijo de tests.

Desde la raíz:

```powershell
pnpm --filter kamehouse-web test:run
pnpm --filter kamehouse-web typecheck
pnpm --filter kamehouse-web build
```

Después de agregar scripts, ejecutar `pnpm --filter kamehouse-web build:ui-kit`. Ejecutar Knip con una versión explícita y reproducible, desde apps/web y usando knip.json. No usar dlx sin fijar versión como certificado de integridad; no se instaló ninguna herramienta en esta revisión.

Criterios de aceptación:

- Las 34 sagas existen y sus solicitudes no devuelven 404.
- Las 12 URLs de arte existen, coinciden con optimized y verifican los hashes de source/optimized.
- Las 64 entradas archivadas conservan bytes, estructura y créditos sin colisiones ni pérdidas.
- No aparecen errores nuevos de tipos o tests; se generan out y el workbench por separado.
- Series conserva poses de DBZ/Kai, Cronología carga imágenes, Películas mantiene filtros y el UI Kit muestra TextArea.
- git diff --check pasa sobre los archivos implementados, preservando el trabajo ajeno.

### Validación realizada en esta revisión

Recuentos y referencias de sagas comprobados; inventario de candidatos generado; hashes del intercambio confirmados. Se intentó `node node_modules/vitest/vitest.mjs run src/lib/helpers/goku-panorama.test.ts` desde apps/web: no arrancó por MODULE_NOT_FOUND, falta Vitest en esa ubicación. No se ejecutaron suite completa, typecheck, build, Knip ni revisión visual. Permanecen pendientes; este informe no afirma que pasen.

## Anexo A: lista completa de candidatos

Rutas relativas a apps/web/public/icons/series-icons/. Las coincidencias por nombre base están separadas en el JSON.

| Archivo | Bytes | Referencias de ruta |
|---|---:|---|
| `daima/ataque.png` | 500436 | Sin coincidencias de ruta en el alcance |
| `daima/ataque.webp` | 406046 | Sin coincidencias de ruta en el alcance |
| `daima/combate-ssj-kamehameha-referencia.png` | 662407 | `apps/web/public/icons/series-icons/SOURCES.md:89` |
| `daima/combate-ssj4-referencia.jpg` | 233710 | Sin coincidencias de ruta en el alcance |
| `daima/combate-ssj4.png` | 1601119 | `apps/web/public/icons/series-icons/SOURCES.md:71` |
| `daima/normal.png` | 332016 | Sin coincidencias de ruta en el alcance |
| `daima/normal.webp` | 232982 | Sin coincidencias de ruta en el alcance |
| `daima/reposo-baculo.jpg` | 180868 | Sin coincidencias de ruta en el alcance |
| `daima/reposo-pose-referencia.jpg` | 51585 | Sin coincidencias de ruta en el alcance |
| `daima/reposo-referencia.jpg` | 66668 | `apps/web/public/icons/series-icons/SOURCES.md:65` |
| `daima/reposo.png` | 333053 | `apps/web/public/icons/series-icons/SOURCES.md:65` |
| `db/ataque.png` | 576617 | Sin coincidencias de ruta en el alcance |
| `db/ataque.webp` | 378048 | Sin coincidencias de ruta en el alcance |
| `db/normal.png` | 220189 | Sin coincidencias de ruta en el alcance |
| `db/reposo-baculo-referencia.jpg` | 79488 | `apps/web/public/icons/series-icons/SOURCES.md:47` |
| `db/reposo-baculo.jpg` | 79488 | Sin coincidencias de ruta en el alcance |
| `db/reposo-baculo.png` | 600428 | `apps/web/public/icons/series-icons/SOURCES.md:47`; `apps/web/public/icons/series-icons/SOURCES.md:49` |
| `db/reposo-guardia-referencia.jpg` | 73507 | Sin coincidencias de ruta en el alcance |
| `db/reposo-guardia.png` | 1221802 | `apps/web/public/icons/series-icons/SOURCES.md:67` |
| `db/reposo-salto.png` | 44198 | `apps/web/public/icons/series-icons/SOURCES.md:35` |
| `db/reposo.png` | 309330 | `apps/web/public/icons/series-icons/SOURCES.md:7` |
| `db/reposo.webp` | 184598 | Sin coincidencias de ruta en el alcance |
| `dbgt/ataque.png` | 330216 | Sin coincidencias de ruta en el alcance |
| `dbgt/combate-ssj4-kamehameha-referencia.jpg` | 246744 | `apps/web/public/icons/series-icons/SOURCES.md:53` |
| `dbgt/combate-ssj4.png` | 738318 | `docs/auditoria/Z2-catalogo.md:19`; `apps/web/public/icons/series-icons/SOURCES.md:9` |
| `dbgt/combate-ssj4.webp` | 483272 | Sin coincidencias de ruta en el alcance |
| `dbgt/normal.png` | 296873 | Sin coincidencias de ruta en el alcance |
| `dbgt/reposo-anime.png` | 1352835 | `docs/auditoria/Z2-catalogo.md:19`; `apps/web/public/icons/series-icons/SOURCES.md:8` |
| `dbgt/reposo-anime.webp` | 818608 | Sin coincidencias de ruta en el alcance |
| `dbgt/reposo-clasico-referencia.jpg` | 28963 | `apps/web/public/icons/series-icons/SOURCES.md:77` |
| `dbgt/reposo-ssj-referencia.png` | 1001614 | `apps/web/public/icons/series-icons/SOURCES.md:51` |
| `dbgt/reposo-ssj.png` | 1390719 | `apps/web/public/icons/series-icons/SOURCES.md:51` |
| `dbkai/ataque.png` | 321933 | Sin coincidencias de ruta en el alcance |
| `dbkai/combate-kamehameha-referencia.jpg` | 134125 | `apps/web/public/icons/series-icons/SOURCES.md:59` |
| `dbkai/combate-kamehameha.png` | 1410175 | `apps/web/public/icons/series-icons/SOURCES.md:59`; `apps/web/public/icons/series-icons/SOURCES.md:83`; `apps/web/public/icons/series-icons/SOURCES.md:85` |
| `dbkai/combate-namek.png` | 49928 | `apps/web/public/icons/series-icons/SOURCES.md:12` |
| `dbkai/combate-namek.webp` | 49048 | Sin coincidencias de ruta en el alcance |
| `dbkai/combate-ssj-frontal.jpg` | 88938 | `apps/web/public/icons/series-icons/SOURCES.md:85` |
| `dbkai/combate-ssj-lateral-referencia.jpg` | 229334 | `apps/web/public/icons/series-icons/SOURCES.md:87` |
| `dbkai/combate-ssj.png` | 74873 | `apps/web/public/icons/series-icons/SOURCES.md:10` |
| `dbkai/normal.png` | 343247 | Sin coincidencias de ruta en el alcance |
| `dbkai/reposo-campera.png` | 36543 | `apps/web/public/icons/series-icons/SOURCES.md:11` |
| `dbkai/reposo-espaldas-referencia.jpg` | 60271 | `apps/web/public/icons/series-icons/SOURCES.md:57` |
| `dbkai/reposo-espaldas.png` | 890062 | `apps/web/public/icons/series-icons/SOURCES.md:57` |
| `dbkai/reposo-frente-referencia.jpg` | 204749 | `apps/web/public/icons/series-icons/SOURCES.md:81` |
| `dbkai/reposo-goku.jpg` | 205873 | `apps/web/public/icons/series-icons/SOURCES.md:55` |
| `dbs/ataque.png` | 363851 | Sin coincidencias de ruta en el alcance |
| `dbs/ataque.webp` | 229030 | Sin coincidencias de ruta en el alcance |
| `dbs/combate-ultra-instinto-referencia.jpg` | 276880 | `apps/web/public/icons/series-icons/SOURCES.md:63` |
| `dbs/normal.png` | 342391 | Sin coincidencias de ruta en el alcance |
| `dbs/normal.webp` | 229996 | Sin coincidencias de ruta en el alcance |
| `dbs/reposo-god-referencia.jpg` | 117915 | `apps/web/public/icons/series-icons/SOURCES.md:61` |
| `dbs/reposo-god.png` | 798158 | `apps/web/public/icons/series-icons/SOURCES.md:61` |
| `dbs/reposo-hombro-referencia.jpg` | 58912 | `apps/web/public/icons/series-icons/SOURCES.md:79` |
| `dbz/ataque.png` | 489818 | Sin coincidencias de ruta en el alcance |
| `dbz/ataque.webp` | 314500 | Sin coincidencias de ruta en el alcance |
| `dbz/combate-ssj-espaldas-referencia.jpg` | 76648 | `apps/web/public/icons/series-icons/SOURCES.md:43` |
| `dbz/combate-ssj-espaldas.png` | 1452231 | `apps/web/public/icons/series-icons/SOURCES.md:43` |
| `dbz/normal.png` | 260220 | `docs/auditoria/Z2-catalogo.md:69` |
| `dbz/normal.webp` | 187262 | Sin coincidencias de ruta en el alcance |
| `dbz/reposo-brazos-cruzados-referencia.jpg` | 206941 | `apps/web/public/icons/series-icons/SOURCES.md:75` |
| `dbz/reposo-n.png` | 1033598 | `apps/web/public/icons/series-icons/SOURCES.md:41` |
| `dbz/reposo-ssj-referencia.jpg` | 112775 | `apps/web/public/icons/series-icons/SOURCES.md:45` |
| `dbz/reposo-ssj.png` | 911041 | `apps/web/public/icons/series-icons/SOURCES.md:45` |

37 de los 64 candidatos tienen referencias documentales de ruta.

## Anexo B: sagas faltantes y evidencia

| Archivo | Referencias actuales |
|---|---|
| `apps/web/public/sagas/baby.webp` | `apps/web/src/components/chronology/data/sagaImages.ts:34`, `apps/web/src/components/chronology/data/sagaImages.ts:35`, `apps/web/src/components/chronology/data/sagaImages.ts:49`, `apps/web/src/components/chronology/data/sagaImages.ts:83`, `apps/web/src/components/chronology/data/sagaImages.ts:84`, `apps/web/src/lib/config/dragonball_scanner_series.ts:115` |
| `apps/web/public/sagas/batalla-dioses.webp` | `apps/web/src/lib/config/dragonball_scanner_series.ts:154`, `apps/web/src/lib/config/dragonball_scanner_series.ts:201`, `apps/web/src/components/chronology/data/sagaImages.ts:25`, `apps/web/src/components/chronology/data/sagaImages.ts:28`, `apps/web/src/components/chronology/data/sagaImages.ts:30`, `apps/web/src/components/chronology/data/sagaImages.ts:46`, `apps/web/src/components/chronology/data/sagaImages.ts:74`, `apps/web/src/components/chronology/data/sagaImages.ts:77`, `apps/web/src/lib/helpers/series.ts:103` |
| `apps/web/public/sagas/black-star.webp` | `apps/web/src/lib/config/dragonball_scanner_series.ts:114`, `apps/web/src/components/chronology/data/sagaImages.ts:33`, `apps/web/src/components/chronology/data/sagaImages.ts:36`, `apps/web/src/components/chronology/data/sagaImages.ts:49`, `apps/web/src/components/chronology/data/sagaImages.ts:82`, `apps/web/src/components/chronology/data/sagaImages.ts:85`, `apps/web/src/lib/helpers/series.ts:87`, `apps/web/src/lib/helpers/series.ts:88` |
| `apps/web/public/sagas/daima.webp` | `apps/web/src/components/chronology/data/sagaImages.ts:23`, `apps/web/src/components/chronology/data/sagaImages.ts:24`, `apps/web/src/components/chronology/data/sagaImages.ts:45`, `apps/web/src/components/chronology/data/sagaImages.ts:73`, `apps/web/src/lib/config/dragonball_scanner_series.ts:181`, `apps/web/src/lib/config/dragonball_scanner_series.ts:182`, `apps/web/src/lib/helpers/series.ts:54`, `apps/web/src/lib/helpers/series.ts:112` |
| `apps/web/public/sagas/garlic-jr.webp` | `apps/web/src/lib/config/dragonball_scanner_series.ts:75`, `apps/web/src/components/chronology/data/sagaImages.ts:14`, `apps/web/src/components/chronology/data/sagaImages.ts:68` |
| `apps/web/public/sagas/gt/omega-shenron.webp` | `apps/web/src/components/chronology/data/sagaImages.ts:49`, `apps/web/src/lib/config/dragonball_scanner_series.ts:117` |
| `apps/web/public/sagas/gt/super-17-batalla.webp` | `apps/web/src/lib/config/dragonball_scanner_series.ts:116` |
| `apps/web/public/sagas/majin-buu.webp` | `apps/web/src/components/chronology/data/sagaImages.ts:19`, `apps/web/src/components/chronology/data/sagaImages.ts:20`, `apps/web/src/components/chronology/data/sagaImages.ts:21`, `apps/web/src/components/chronology/data/sagaImages.ts:22`, `apps/web/src/components/chronology/data/sagaImages.ts:44`, `apps/web/src/components/chronology/data/sagaImages.ts:72`, `apps/web/src/lib/config/dragonball_scanner_series.ts:79`, `apps/web/src/lib/config/dragonball_scanner_series.ts:80` |
| `apps/web/public/sagas/namek-freezer.webp` | `apps/web/src/components/chronology/data/sagaImages.ts:11`, `apps/web/src/components/chronology/data/sagaImages.ts:12`, `apps/web/src/components/chronology/data/sagaImages.ts:13`, `apps/web/src/components/chronology/data/sagaImages.ts:41`, `apps/web/src/components/chronology/data/sagaImages.ts:66`, `apps/web/src/components/chronology/data/sagaImages.ts:67`, `apps/web/src/lib/config/dragonball_scanner_series.ts:74` |
| `apps/web/public/sagas/original/busqueda-esferas.webp` | `apps/web/src/lib/config/dragonball_scanner_series.ts:198`, `apps/web/src/lib/helpers/series.ts:71`, `apps/web/src/lib/helpers/images.test.ts:141`, `apps/web/src/routes/series/-SeriesCard.tsx:110`, `apps/web/src/components/chronology/data/sagaImages.ts:2`, `apps/web/src/components/chronology/data/sagaImages.ts:37`, `apps/web/src/components/chronology/data/sagaImages.ts:58` |
| `apps/web/public/sagas/original/goku-vs-piccolo-jr.webp` | `apps/web/src/lib/config/dragonball_scanner_series.ts:51`, `apps/web/src/components/chronology/data/sagaImages.ts:8`, `apps/web/src/components/chronology/data/sagaImages.ts:39`, `apps/web/src/components/chronology/data/sagaImages.ts:64` |
| `apps/web/public/sagas/piccolo-daimaku.webp` | `apps/web/src/lib/config/dragonball_scanner_series.ts:50`, `apps/web/src/components/chronology/data/sagaImages.ts:7`, `apps/web/src/components/chronology/data/sagaImages.ts:8`, `apps/web/src/components/chronology/data/sagaImages.ts:39`, `apps/web/src/components/chronology/data/sagaImages.ts:63`, `apps/web/src/components/chronology/data/sagaImages.ts:64` |
| `apps/web/public/sagas/pilaf.webp` | `apps/web/src/lib/config/dragonball_scanner_series.ts:45`, `apps/web/src/components/chronology/data/sagaImages.ts:2`, `apps/web/src/components/chronology/data/sagaImages.ts:37`, `apps/web/src/components/chronology/data/sagaImages.ts:58`, `apps/web/src/components/chronology/data/sagaImages.ts:87`, `apps/web/src/lib/helpers/series.ts:72` |
| `apps/web/public/sagas/red-ribbon.webp` | `apps/web/src/lib/config/dragonball_scanner_series.ts:47`, `apps/web/src/components/chronology/data/sagaImages.ts:4`, `apps/web/src/components/chronology/data/sagaImages.ts:38`, `apps/web/src/components/chronology/data/sagaImages.ts:60` |
| `apps/web/public/sagas/resurreccion-f.webp` | `apps/web/src/lib/config/dragonball_scanner_series.ts:155`, `apps/web/src/components/chronology/data/sagaImages.ts:26`, `apps/web/src/components/chronology/data/sagaImages.ts:46`, `apps/web/src/components/chronology/data/sagaImages.ts:75` |
| `apps/web/public/sagas/saiyajin.webp` | `apps/web/src/lib/config/dragonball_scanner_series.ts:73`, `apps/web/src/lib/helpers/series.ts:79`, `apps/web/src/lib/helpers/series.ts:80`, `apps/web/src/components/chronology/data/sagaImages.ts:9`, `apps/web/src/components/chronology/data/sagaImages.ts:10`, `apps/web/src/components/chronology/data/sagaImages.ts:40`, `apps/web/src/components/chronology/data/sagaImages.ts:65` |
| `apps/web/public/sagas/super/copy-vegeta.webp` | `apps/web/src/lib/config/dragonball_scanner_series.ts:157` |
| `apps/web/public/sagas/super/freezer-dorado.webp` | `apps/web/src/components/chronology/data/sagaImages.ts:26`, `apps/web/src/components/chronology/data/sagaImages.ts:28`, `apps/web/src/components/chronology/data/sagaImages.ts:75`, `apps/web/src/components/chronology/data/sagaImages.ts:77` |
| `apps/web/public/sagas/super/reclutamiento-u7.webp` | `apps/web/src/lib/config/dragonball_scanner_series.ts:160`, `apps/web/src/components/chronology/data/sagaImages.ts:31`, `apps/web/src/components/chronology/data/sagaImages.ts:80` |
| `apps/web/public/sagas/super/torneo-u6.webp` | `apps/web/src/components/chronology/data/sagaImages.ts:27`, `apps/web/src/components/chronology/data/sagaImages.ts:30`, `apps/web/src/components/chronology/data/sagaImages.ts:31`, `apps/web/src/components/chronology/data/sagaImages.ts:32`, `apps/web/src/components/chronology/data/sagaImages.ts:48`, `apps/web/src/components/chronology/data/sagaImages.ts:76`, `apps/web/src/components/chronology/data/sagaImages.ts:79`, `apps/web/src/components/chronology/data/sagaImages.ts:81`, `apps/web/src/lib/config/dragonball_scanner_series.ts:156` |
| `apps/web/public/sagas/super/ultra-instinto-completo-victoria.webp` | `apps/web/src/components/chronology/data/sagaImages.ts:48`, `apps/web/src/components/chronology/data/sagaImages.ts:81`, `apps/web/src/lib/helpers/series.ts:104`, `apps/web/src/lib/config/dragonball_scanner_series.ts:159`, `apps/web/src/lib/config/dragonball_scanner_series.ts:161` |
| `apps/web/public/sagas/torneo-21.webp` | `apps/web/src/components/chronology/data/sagaImages.ts:3`, `apps/web/src/components/chronology/data/sagaImages.ts:37`, `apps/web/src/components/chronology/data/sagaImages.ts:59`, `apps/web/src/lib/config/dragonball_scanner_series.ts:46` |
| `apps/web/public/sagas/torneo-22.webp` | `apps/web/src/components/chronology/data/sagaImages.ts:6`, `apps/web/src/components/chronology/data/sagaImages.ts:38`, `apps/web/src/components/chronology/data/sagaImages.ts:62`, `apps/web/src/lib/config/dragonball_scanner_series.ts:49` |
| `apps/web/public/sagas/trunks-androides-cell.webp` | `apps/web/src/components/chronology/data/sagaImages.ts:15`, `apps/web/src/components/chronology/data/sagaImages.ts:16`, `apps/web/src/components/chronology/data/sagaImages.ts:42`, `apps/web/src/components/chronology/data/sagaImages.ts:69`, `apps/web/src/components/chronology/data/sagaImages.ts:70`, `apps/web/src/lib/helpers/series.ts:95`, `apps/web/src/lib/helpers/series.ts:96`, `apps/web/src/lib/config/dragonball_scanner_series.ts:76` |
| `apps/web/public/sagas/trunks-futuro.webp` | `apps/web/src/lib/config/dragonball_scanner_series.ts:158`, `apps/web/src/components/chronology/data/sagaImages.ts:29`, `apps/web/src/components/chronology/data/sagaImages.ts:47`, `apps/web/src/components/chronology/data/sagaImages.ts:78` |
| `apps/web/public/sagas/uranai-baba.webp` | `apps/web/src/components/chronology/data/sagaImages.ts:5`, `apps/web/src/components/chronology/data/sagaImages.ts:61`, `apps/web/src/lib/config/dragonball_scanner_series.ts:48` |
| `apps/web/public/sagas/z/cell-games-saga.webp` | `apps/web/src/components/chronology/data/sagaImages.ts:17`, `apps/web/src/components/chronology/data/sagaImages.ts:18`, `apps/web/src/components/chronology/data/sagaImages.ts:43`, `apps/web/src/components/chronology/data/sagaImages.ts:71`, `apps/web/src/lib/config/dragonball_scanner_series.ts:77` |
| `apps/web/public/sagas/z/fusion-saga.webp` | `apps/web/src/lib/config/dragonball_scanner_series.ts:200`, `apps/web/src/components/chronology/data/sagaImages.ts:19`, `apps/web/src/components/chronology/data/sagaImages.ts:20`, `apps/web/src/components/chronology/data/sagaImages.ts:21`, `apps/web/src/components/chronology/data/sagaImages.ts:44`, `apps/web/src/components/chronology/data/sagaImages.ts:72` |
| `apps/web/public/sagas/z/goku-llega-namek.webp` | `apps/web/src/components/chronology/data/sagaImages.ts:11`, `apps/web/src/components/chronology/data/sagaImages.ts:41`, `apps/web/src/components/chronology/data/sagaImages.ts:66`, `apps/web/src/lib/config/dragonball_scanner_series.ts:199` |
| `apps/web/public/sagas/z/kid-buu-saga.webp` | `apps/web/src/lib/config/dragonball_scanner_series.ts:136`, `apps/web/src/components/chronology/data/sagaImages.ts:22`, `apps/web/src/components/chronology/data/sagaImages.ts:44` |
| `apps/web/public/sagas/z/other-world-saga.webp` | `apps/web/src/lib/config/dragonball_scanner_series.ts:78` |
| `apps/web/public/sagas/z/perfect-cell-saga.webp` | `apps/web/src/components/chronology/data/sagaImages.ts:16`, `apps/web/src/components/chronology/data/sagaImages.ts:17`, `apps/web/src/components/chronology/data/sagaImages.ts:43`, `apps/web/src/components/chronology/data/sagaImages.ts:70`, `apps/web/src/lib/config/dragonball_scanner_series.ts:135` |
| `apps/web/public/sagas/z/trunks-saga.webp` | `apps/web/src/lib/config/dragonball_scanner_series.ts:202`, `apps/web/src/components/chronology/data/sagaImages.ts:15`, `apps/web/src/components/chronology/data/sagaImages.ts:42`, `apps/web/src/components/chronology/data/sagaImages.ts:69` |
| `apps/web/public/sagas/z/vegeta-saga.webp` | `apps/web/src/components/chronology/data/sagaImages.ts:10`, `apps/web/src/components/chronology/data/sagaImages.ts:40`, `apps/web/src/components/chronology/data/sagaImages.ts:65`, `apps/web/src/lib/config/dragonball_scanner_series.ts:134` |

## Anexo C: bloques reales a eliminar

`apps/web/src/routes/series/-AmbientAura.tsx:4`

```diff
-export function getGlowTransform(selectedIndex: number, total: number, offsetPx: number) {
-    const pct = (selectedIndex / Math.max(total - 1, 1)) * 80 + 10;
-    return `translate3d(calc(${pct}% - ${offsetPx}px), -50%, 0)`;
-}
```

`apps/web/src/routes/movies/-components/movies-utils.ts:37`

```diff
-export const MOVIE_STATUS_OPTIONS: { value: MovieStatus; label: string }[] = [
-    { value: "all", label: "Todas" },
-    { value: "pending", label: "Por ver" },
-    { value: "continue", label: "Continuar" },
-    { value: "watched", label: "Vistas" },
-]
```

`apps/web/src/routes/movies/-components/movies-utils.ts:80`

```diff
-export function formatDecade(decade: number): string {
-    return `Años ${decade}`
-}
```

## Anexo D: identidad de las poses trasladadas

| Ruta actual | SHA-256 igual al informe anterior |
|---|---|
| `dbkai/reposo-brazos-cruzados.png` | `f372815a43215dc2552e5ee8f70a204565b534ff59fc2078cbef8c9b5319a581` |
| `dbz/reposo-frente.png` | `9241805547eb1bc3b2f81130945c1e682ae148ac68f2995104961f0dec148d11` |
