# Frente 4/7 — generaciones de metadata y cierre de proveedores

Trabajo sobre el árbol local existente de KameHouse, 2026-11-07. Se modificaron proveedores de metadata, el handler de borrado de metadata (ampliación coordinada con raíz) y sus pruebas. No se tocaron credenciales, configuración ni base del usuario. Sin despliegue, reinicio real, commit o push.

## Fallos reproducidos antes del cambio

`TestProviderClearDoesNotRepublishRetiredPersistentRead` usa SQLite privado y una barrera después de leer una fila de metadata. Invalida el proveedor, reemplaza la fila y realiza una nueva consulta antes de liberar la anterior.

Con el código anterior fallaron ambos subcasos:

- Jikan: el nuevo consumidor se unía al inflight anterior, agotaba su espera inline y la finalización vieja repoblaba el caché con `EpisodeCount=1` en lugar del valor nuevo `2`.
- TMDB: la consulta posterior obtenía el valor nuevo, pero al liberar la antigua esta volvía a publicar el valor `1` sobre el caché vigente.

También se revisaron los snapshots de LocalFiles y LibraryMedia: ya separan sus publicaciones por generación. No se cambiaron en este frente.

## Cambios implementados

### Invalidación y publicación

En `jikan_impl.go` y `tmdb_impl.go`, cada carga captura una generación. Los resultados de una generación retirada pueden completar para sus consumidores originales, pero no publican en memoria ni escriben metadata persistente después de una invalidación ya completada.

`ClearCache` avanza la generación. Jikan separa además el mapa de inflight: los nuevos pedidos no se unen a trabajos retirados, y una finalización vieja solo elimina su propia entrada por identidad. Los fallos retirados tampoco vuelven a marcar el ID/servicio como caído ni persisten un outage en la nueva generación.

Un mutex de publicación separado serializa la invalidación con las escrituras durables admitidas. El mutex de lectura de memoria se libera antes de SQLite. Así, `ClearCache` puede esperar una escritura ya iniciada, pero los hits calientes no quedan detrás de esa E/S. Las consultas HTTP no se realizan con esos mutexes de publicación o memoria tomados.

Los datos TMDB cargados desde SQLite se enriquecen antes de publicarlos, eliminando la ventana anterior en que otro lector podía observar el objeto mientras todavía se modificaba.

Se preservaron los TTL y políticas existentes: seis horas en memoria, siete días para episodios persistidos y cinco minutos de fallos Jikan. `ClearCache` continúa siendo una invalidación de memoria/estado del proveedor; no se convirtió en un borrado general de SQLite ni de la caché del cliente HTTP inferior.

### Cierre coordinado con frente 5

- Jikan admite productores bajo su mutex, los registra en WaitGroup y usa un contexto propio para el HTTP de sus cargas. `Close` rechaza consultas nuevas, cancela ese contexto y une todos los productores, incluso si el handler ya devolvió un resultado pendiente. Cierra también el fallback TMDB inicializado por esos productores.
- TMDB registra sus `GetAnimeMetadata` admitidos. `Close` rechaza nuevos pedidos, cancela su contexto y espera a los Get activos, incluida su publicación SQL final.
- Ambos Close son repetibles. No cierran transportes compartidos con otros consumidores.
- Cuando esos Close retornan, no quedan productores/Get admitidos del proveedor que puedan escribir después en la base. Esta garantía depende de que el propietario invoque Close antes de cerrar SQLite; el registro de cleanup de la app pertenece al frente 5.

La cancelación no equivale a cierre instantáneo. El cliente TMDB conserva su deduplicación HTTP desacoplada de la cancelación individual; un Get activo puede esperar ese fetch compartido antes de terminar. El fallback TMDB de Jikan puede tener la misma espera. No se reescribió el cliente HTTP ni se promete un límite nuevo de latencia de cierre.

### Orden del borrado global de metadata

El handler `HandleClearMetadataCache` borraba las filas persistidas y después invalidaba el proveedor. Una escritura ya admitida que ClearCache tuviera que unir podía completar en ese intervalo y sobrevivir al borrado. La regresión de orden lo reprodujo: el handler devolvía éxito pero quedaba una fila de episodios escrita durante el Clear.

Ahora el handler ejecuta una barrera del proveedor antes del DELETE, de modo que esas escrituras viejas ya admitidas quedan incluidas en el borrado. Después del DELETE y de limpiar el cliente TMDB, ejecuta una segunda barrera para retirar lecturas que hayan consultado filas todavía presentes mientras se borraban otros providers. Esa segunda invalidación también ocurre si el borrado fue parcial por un error. El handler devuelve el error de DELETE en lugar del `200` falso anterior.

No es una transacción global que suspenda todas las solicitudes. Los pedidos nuevos pueden volver a cargar metadata fresca; tampoco se reescriben los vuelos/cachés inferiores del cliente HTTP. La garantía concreta es el orden frente a las publicaciones retiradas de los proveedores y las lecturas persistidas solapadas, no una promesa de que todas las tablas permanezcan vacías si hay nuevos consumidores activos.

## Pruebas focales

- Lecturas persistidas retiradas de Jikan/TMDB no reemplazan los resultados nuevos.
- Un fallo Jikan retirado no elimina el inflight nuevo, no contamina los mapas de fallos y no persiste un outage.
- Una carga HTTP TMDB que termina después de `ClearCache` no publica en memoria ni SQLite.
- Con una escritura SQLite deliberadamente detenida, un hit en memoria sigue atendible; `ClearCache` espera esa escritura admitida antes de retornar.
- Un productor Jikan que ya devolvió pending se cancela y se une al cerrar; no se admiten nuevas consultas después de Close.
- Close TMDB espera una escritura SQL que ya estaba admitida; un Get posterior se rechaza sin crear otra escritura.
- El DELETE de metadata elimina una publicación vieja que el proveedor completa al entrar a su barrera, descarta una lectura de la fila realizada durante la fase de borrado y responde `500` ante fallo SQL en lugar de un éxito falso. Los casos de fila sobreviviente y éxito falso fallaron antes de editar el handler y pasaron después.

Comprobaciones aprobadas:

```powershell
# Desde apps/server
& 'C:/Program Files/Go/bin/go.exe' test ./internal/api/metadata_provider -run 'Test(ProviderClear|ProviderPublication|JikanRetired|TMDBRetired|JikanClose|TMDBClose)' -count=20 '-cpu=1,4,12'
& 'C:/Program Files/Go/bin/go.exe' test ./internal/api/metadata_provider -count=1
& 'C:/Program Files/Go/bin/go.exe' vet ./internal/api/metadata_provider
& 'C:/Program Files/Go/bin/go.exe' test ./internal/handlers -run '^TestClearMetadata' -count=20 '-cpu=1,4,12'
& 'C:/Program Files/Go/bin/go.exe' vet ./internal/api/metadata_provider ./internal/handlers
```

La pasada repetida de proveedores terminó en 21,919 s y la del handler en 4,651 s; son 60 ejecuciones por prueba superior, además de sus subcasos Jikan/TMDB. Hubo también pasadas focales previas de tres repeticiones. No se ejecutó la suite global desde este frente, para no competir con los otros agentes; queda para el frente 7. `-race` sigue pendiente por la ausencia de CGO/compilador C señalada en la sesión. No se atribuyen estas comprobaciones al detector de carreras ni a Drive/TMDB/Jikan públicos.

## Límites y hallazgos comunicados

- La operación global de DELETE no congela las solicitudes nuevas ni borra transaccionalmente todos los providers: si falla a mitad, puede haber borrado parcial y se reporta error. Las barreras y su límite de concurrencia fresca se describen arriba.
- La caché inferior de respuestas HTTP TMDB conserva su política y vuelos compartidos; no se garantiza un refetch de red por limpiar únicamente el proveedor.
- LibraryMedia separa generaciones pero su copia de estructura es superficial para campos anidados como RawMessage/Relations/Characters. No se cambió la capa DB en esta retoma; se comunicó como siguiente revisión de ownership de datos.
- AniList no se modificó. No se afirma una garantía nueva para sus productores ni para toda la app hasta integrar la validación de los otros frentes.

No hay una mejora porcentual de carga nueva que atribuir a estos cambios. Son correcciones de coherencia, espera indebida y orden de cierre con regresiones reproducidas y verificadas.
