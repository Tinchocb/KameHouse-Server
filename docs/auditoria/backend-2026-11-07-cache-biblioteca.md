# Backend: invalidación y respuestas condicionales de biblioteca — 2026-11-07

Continuación de la revisión, sobre el árbol local existente. Se preservó el trabajo previo. No hubo despliegue, reinicio de la instancia real, cambios de credenciales, commit ni push.

## Problema reproducido

La caché de `/api/v1/library/collection` tenía un contador de versión, pero todos los pedidos fríos compartían una única clave singleflight, `main`. Tras invalidarla por un escaneo o cambio de ajustes, un pedido nuevo podía sumarse a la construcción anterior, esperar su final y recibir el resultado con el ETag de la versión nueva.

Además, la comprobación de versión y la publicación en caché eran operaciones separadas: una invalidación entre ambas podía permitir que una construcción retirada repoblara la caché.

`TestCollectionInvalidationDoesNotJoinRetiredBuild` bloquea una construcción anterior, invalida y lanza un segundo pedido. Antes del cambio falló al comprobar que el segundo seguía esperando tras 250 ms. Con el cambio, la nueva construcción comienza sin liberar la anterior. Es una regresión controlada por canales, no una medición de latencia real de red.

## Cambios

En `apps/server/internal/handlers/anime_collection.go`:

- Cada request captura juntos la versión, ETag y referencia de caché bajo un RWMutex corto.
- Las construcciones compartidas se identifican por versión. Los lectores de la misma versión siguen compartiendo trabajo; los de una versión posterior no se suman a una construcción retirada.
- La invalidación y la publicación están sincronizadas. La comprobación de vigencia y el guardado son indivisibles frente a una invalidación.
- El trabajo costoso de construir la colección y la serialización de la respuesta se realizan fuera de ese mutex.
- El header `If-None-Match` admite listas de ETags, espacios y comparación débil para GET/HEAD, reutilizando el comparador existente. Antes se aceptaba únicamente la igualdad literal con todo el header o `*`.

Una petición ya iniciada puede completar con su versión capturada; una nueva no hereda su construcción. No se cancelan las construcciones retiradas: conservan el contexto y comportamiento previos, pero no pueden publicar en la versión vigente. Invalidaciones sucesivas con requests activos pueden mantener varias construcciones en curso; no se afirma una reducción del trabajo total en ese caso.

## Evidencia y regresiones

- La regresión de espera posterior a invalidación falló con el código anterior y pasó tras el cambio.
- Una prueba con SQLite privado y dos construcciones exitosas comprueba que la nueva colección permanece en caché después de completar la retirada, y que los dos pedidos tienen ETags de versiones distintas.
- Un header con lista que incluye el ETag vigente, su forma fuerte equivalente, espacios o `*` responde 304 sin cuerpo ni necesidad de acceder a App/DB. La prueba existente conserva el caso de un ETag viejo, que debe obtener 200.
- Los tres casos nuevos pasaron con `-count=20 -cpu=1,4,12`: 60 ejecuciones por caso. Esto verifica concurrencia funcional y no equivale al detector `-race`.
- La fixture de colección completa (50 series, 1.200 archivos, cinco en curso) pasó tres corridas: frío sin demora externa 27,1–28,3 ms; con proveedor controlado de 300 ms, 311,9–313,6 ms. La respuesta completa sigue pesando unos 50 KB. No se mide una aceleración general de esa construcción; la mejora es evitar la espera de una versión retirada y reenviar el cuerpo ante condiciones válidas que antes no se reconocían.
- Suite corta completa, vet y build comprobados después de los cambios.

Comandos desde `apps/server`:

```powershell
& 'C:/Program Files/Go/bin/go.exe' test ./internal/handlers -run '^TestCollection(Invalidation|Retired|Conditional)' -count=20 '-cpu=1,4,12'
& 'C:/Program Files/Go/bin/go.exe' test ./internal/handlers -run '^Test(CollectionInvalidation|CollectionConditional|HandleGetLibraryCollection|LibraryCollectionFixture)' -v -count=3
& 'C:/Program Files/Go/bin/go.exe' test -short . ./internal/... ./codegen/...
& 'C:/Program Files/Go/bin/go.exe' vet ./...
& 'C:/Program Files/Go/bin/go.exe' build -buildvcs=false ./...
```

`-race` sigue pendiente por falta de compilador C/CGO disponible. No se midió la instalación real ni se atribuyen a esta tanda resultados nuevos de Drive, FFmpeg o presentación del primer fotograma en el navegador.
