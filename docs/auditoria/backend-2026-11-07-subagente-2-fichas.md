# Frente 2/7: fichas y enriquecimiento — 2026-11-07

Propiedad de esta intervención: `internal/handlers/anime_entries.go`, `anime_enrichment.go` y el nuevo `anime_pending_entry_test.go`. Se preservaron los cambios anteriores; no se tocaron los proveedores de metadata, la colección general ni otros archivos compartidos. Sin commit, push, despliegue ni reinicio real.

## Trabajo evitado mientras falta metadata

El enriquecimiento de fondo reconstruía la ficha completa una vez por segundo durante hasta unos 30 segundos mientras `MetadataPending` seguía activo. Cada reconstrucción repetía lectura de progreso/temporadas/episodios desde SQLite, construcción de episodios e hidratación de filler, aunque el resultado de Jikan todavía no estuviera disponible.

Ahora se construye inicialmente y se consulta después únicamente el estado del proveedor compartido. La ficha se vuelve a construir cuando el proveedor deja de indicar metadata pendiente. No se omiten campos ni se cambia la respuesta inicial, el presupuesto de espera, el intervalo de sondeo o el enriquecimiento final. Un error definitivo del proveedor continúa dejando la ficha de fallback, como antes.

`resolvePendingAnimeEntry` tiene espera cancelable y observa `ShutdownCtx` entre operaciones. Si se agota el presupuesto mantiene el estado pendiente, sin publicar una ficha incompleta como enriquecida. No transforma las llamadas síncronas al proveedor en operaciones inmediatamente cancelables: el presupuesto es cooperativo entre operaciones.

### Evidencia

- Con cuatro sondeos hasta disponibilidad, la prueba realiza dos construcciones: inicial y resultado listo. El bucle anterior habría construido cinco fichas (inicial más una por sondeo).
- Con el proveedor pendiente hasta agotar el presupuesto, realiza una sola construcción y conserva el objeto/estado pendiente.
- Una cancelación interrumpe una espera configurada de un minuto sin esperar ese intervalo.
- Un error del constructor se conserva y no provoca sondeos extra.

Es evidencia de reducción de trabajo, no una comparación de latencia real de Jikan, SQLite o la pantalla. No se inventó un porcentaje de mejora de experiencia a partir del contador de construcciones.

## Publicación de fichas por generación

Los dos publicadores de `animeEntryCache` podían finalizar después de invalidaciones de progreso, origen o escaneo: la construcción de un request y el enriquecimiento de fondo (que había capturado los archivos antes de esperar).

Se añadió una época global protegida por un RWMutex corto. Invalidar una ficha o limpiar la caché renueva la época. Las claves singleflight y de enriquecimiento incluyen esa época, y el guardado verifica su vigencia bajo el mismo mutex que la invalidación. Una construcción retirada ya no puede repoblar la caché; su cooldown tampoco se publica después de invalidarla.

Una invalidación individual mantiene las otras entradas ya cacheadas, pero retira conservadoramente todas las construcciones en curso de esa época. Esto evita un mapa de generaciones por ID que crezca sin límite, con el coste de que un resultado concurrente de otra ficha pueda necesitar reconstruirse después.

Se comprueba la vigencia antes de reconstruir y antes de enriquecer. El sondeo de un trabajo retirado deja de esperar al observar ese cambio. Una respuesta ya iniciada puede completar con su snapshot; no se promete reemplazarla ni cancelarla inmediatamente.

## Verificación

```powershell
& 'C:/Program Files/Go/bin/go.exe' test ./internal/handlers -run 'Test(PendingEntry|RetiredAnimeEntry|HandleGetAnimeEntry)' -v -count=3
& 'C:/Program Files/Go/bin/go.exe' test ./internal/handlers -run 'Test(PendingEntry|RetiredAnimeEntry|HandleGetAnimeEntry)' -count=20 '-cpu=1,4,12'
& 'C:/Program Files/Go/bin/go.exe' vet ./internal/handlers
```

Todo aprobado. La segunda ejecución repite cada caso 60 veces, con uno, cuatro y doce CPUs. Incluye el contrato anterior de caché/ETag de ficha. No se ejecutó una suite completa paralela ni `-race`; la verificación integrada corresponde al agente principal y CGO/compilador C sigue siendo una limitación conocida.

## Límites pendientes

- Los workers de enriquecimiento conservan el mecanismo anterior de goroutine y no se registran ahora en un grupo global de cierre. Vincular el contexto detiene las esperas, pero no equivale a unir todos los workers antes de cerrar DB.
- No se cambiaron las escrituras persistentes de `enrichMediaWithTMDB` ni su resolución de conflictos con una edición concurrente de `LibraryMedia`. La guardia añadida cubre caché y cooldown.
- No se cambió la espera síncrona de `animeEntryGroup.Do` del request ni su dependencia del contexto del primer constructor. Esa cancelación individual sigue siendo otro frente posible.
