# Correcciones prioritarias del backend — 29/10/2026

Actualización posterior: el [segundo bloque de fiabilidad](backend-2026-10-29-fiabilidad.md) incorpora R-04, R-05 y R-06. Este documento describe el alcance y los resultados del primer bloque.

Primer bloque de implementación de la [revisión del backend](backend-2026-10-29-revision.md): R-01, R-02 y R-03. Los demás puntos del informe conservan su estado de propuesta. Se preservaron las modificaciones anteriores del checkout; no se cambió esquema SQL, configuración, dependencias, frontend ni contratos HTTP salvo el rechazo explícito de hashes inválidos.

## Cambios

| Hallazgo | Comportamiento aplicado | Evidencia de regresión |
|---|---|---|
| R-01 | El handler devuelve HTTP 400 si el identificador no tiene 40 caracteres hexadecimales. El gestor repite la validación antes de modificar estado y borra mediante `os.OpenRoot(...).RemoveAll(hash)`, confinado a la carpeta de salida. | Valores vacíos, puntos, separadores, rutas absolutas, valores codificados, longitud incorrecta; conservación de raíz y carpetas vecinas; borrado repetido y raíz ausente; enlaces simbólicos cuando el sistema permite crearlos. |
| R-02 | Cada `Database` tiene su propia caché. Cada invalidación publica una generación con snapshot y singleflight independientes. Las lecturas entregan copias profundas; las consultas por media copian solo los archivos que coinciden. | Copias anidadas, duración exacta, nil y slices vacíos; dos bases independientes; fallo de guardado; carga SQL pausada antes de publicar mientras otra escritura invalida; modificaciones concurrentes de copias. |
| R-03 | Los reintentos usan el logger del contexto, con fallback seguro cuando no existe. El descargador de paquetes propaga el logger de la aplicación mediante el contexto. | Error de conexión simulado seguido de éxito con logger global nulo y comprobación del binario/hash; cancelación durante backoff. Sin conexión externa en estas regresiones. |

Se añadieron 13 funciones de test en seis archivos. `LocalFile.Clone` vive en un archivo nuevo para preservar las modificaciones previas de los modelos.

## Archivos del bloque

- Caché y copias: `apps/server/internal/database/db/{db.go,localfiles.go,local_file_relational.go,localfiles_snapshot_test.go}` y `internal/database/models/dto/{localfile_clone.go,localfile_clone_test.go}`.
- Consumidores de la caché: `internal/handlers/{drive.go,drive_mediastream.go,drive_technical_info_test.go}` e `internal/library/anime/intelligence.go`. En los archivos de Drive ya modificados, este bloque solo adapta el argumento de invalidación.
- Borrado: `internal/mediastream/pretranscode/{pretranscode.go,delete_safety_test.go,delete_safety_windows_test.go}` e `internal/handlers/{pretranscode.go,pretranscode_safety_test.go}`.
- Reintento: `internal/util/ffmpegutil/{downloader.go,downloader_retry_test.go}`.

## Verificación

Entorno: Go 1.26.6, `GOTOOLCHAIN=local`, `GOPROXY=off`, `GOSUMDB=off`, `GOFLAGS=-mod=readonly`, `GOMAXPROCS=2`. Las pruebas con SQLite y multimedia usan datos temporales. Los comandos se ejecutan desde `apps/server`.

Resultados:

- Regresiones específicas de los seis paquetes afectados: PASS.
- `go test -p 1 ./... -short -count=1 -timeout=8m`: PASS en una ejecución completa después de los cambios de producción.
- `go test -race -p 1 ./internal/database/db ./internal/database/models/dto ./internal/mediastream/pretranscode ./internal/util/ffmpegutil ./internal/handlers ./internal/library/anime -short -count=1 -timeout=8m`: PASS.
- `go vet -p 1 ./...`: PASS.
- `go build -p 1 ./...`: PASS.
- Regresión adicional de junctions de Windows, agregada después de la suite general: `go test -race -p 1 ./internal/mediastream/pretranscode -run '^TestDelete' -v -count=1 -timeout=1m`: PASS. Se conservaron los marcadores fuera del objetivo tanto con junction anidada como con junction en la entrada que se borra.
- La prueba de symlinks se omitió porque Windows no concedió el privilegio de crearlos. La prueba de junctions sí se ejecutó; no equivale a ejecutar el caso de symlink.
- `git diff --check` sobre los fuentes del servidor: PASS.

## Límites y trabajo pendiente

- Las lecturas completas del catálogo ahora asignan memoria para sus copias profundas. Se prioriza aislar estado mutable; no se midió una mejora de rendimiento. Las lecturas por media evitan copiar los archivos ajenos a esa media.
- Una lectura iniciada antes de una escritura puede terminar con su snapshot anterior. No puede contaminar la generación nueva; una lectura posterior a la invalidación tampoco comparte ese trabajo anterior.
- SQL ejecutado por fuera de los repositorios necesita invalidar la caché de su base. Se adaptaron todos los consumidores encontrados en el servidor, incluidas las actualizaciones de Drive.
- Este bloque resuelve el confinamiento del borrado. La coordinación entre cancelación, terminación del proceso y reencolado sigue siendo R-04 y no se declara resuelta.
- No se instaló un binario, reinició el servidor, reindexó Drive ni reprodujo contenido real. La aceptación en navegador y KameHouseTV sigue pendiente.
