# 1. TABLA RESUMEN DE HALLAZGOS

> **Estado actualizado:** plan implementado. Ver [ejecución y validaciones](backend-2026-10-25-ejecucion.md). Los bloques ANTES/DESPUÉS de este documento conservan el snapshot de la auditoría original.

Auditoría del árbol de trabajo del 25/10/2026. No se modificó código del servidor. Los rangos son los originales antes de aplicar cambios.

| ID | Severidad (Alta/Media/Baja) | Archivo y Líneas | Tipo (Código Muerto/Opt/Robustez) | Resumen del Problema |
|---|---|---|---|---|
| D-01 | Baja | `internal/drive/chunked.go:168-179` | Código Muerto | Helper totalFromContentRange sin referencias; validatePartialRange implementa el parseo real. |
| O-01 | Media | `internal/library/scanner/discovery.go:114-211` | Opt | Dos buffers de canales dimensionados con toda la biblioteca. |
| O-02 | Media | `internal/handlers/chronology_frames.go:41-84` | Opt/Robustez | Consulta por absolute_number sin índice compuesto correspondiente, SELECT completo y contexto perdido. |
| R-01 | Alta | `internal/mediastream/cassette/segment.go:102-107` | Robustez | len(st.segments) leído después de liberar RLock, concurrentemente con Grow. |
| R-02 | Alta | `internal/database/db/library_media.go:14-160` | Robustez | UpdateLibraryMediaMappings no invalida la caché; carga anterior puede republicar datos obsoletos. |
| R-03 | Alta | `internal/database/db/db_migrations.go:227-283` | Robustez | La migración puede borrar local_files tras JSON inválido, error de lectura o coexistencia de datos relacionales. |
| R-04 | Media | `internal/database/db/db.go:55-172` | Robustez | Pool abierto sin cierre en errores de inicialización y logger.Fatal dentro del constructor. |
| R-05 | Media | `internal/database/db/db_migrations.go:18-40` | Robustez | recover de migraciones cierra done sin publicar error ni estado final. |
| R-06 | Media | `internal/library/scanner/metadata_mapping.go:132-138` | Opt/Robustez | Respuesta del servicio opcional de mappings leída sin límite de bytes. |
| R-07 | Media | `internal/handlers/drive_subtitles.go:29-49` | Robustez | Consulta síncrona de subtítulos pierde contexto; el primer llamador de la apertura compartida tampoco puede abandonar la espera. |

Reproducidos con bases temporales y overlays: R-01 (-race), R-02 y R-03. Los demás proceden de inspección estática. La suite existente `go test ./... -short`, `go vet ./...` y `go build -o <temporal> .` pasaron. Los tres tests nuevos fallan sobre el código actual y pasan con las correcciones propuestas.

# 2. PLAN DE IMPLEMENTACIÓN DETALLADO (/plan)

Precondiciones: inspeccionar git status/diff; conservar cambios ajenos; no hacer commits, migraciones sobre bases reales ni iniciar el servidor. Aplicar por anclas, dado que las líneas cambian. Preparar respaldo SQLite consistente antes de ejecutar migraciones sobre datos reales. Prioridad operativa: R-03 y R-01 antes de optimizaciones.

## Fase 1: Eliminación de Código Muerto

### D-01 — Helper totalFromContentRange sin referencias; validatePartialRange implementa el parseo real.

Eliminar solo el helper. Conservar strconv y strings, usados por el parser activo. Sin impacto esperado en rendimiento del binario.

**Archivo exacto:** `internal/drive/chunked.go`. **Líneas originales:** 166-182.

**ANTES:**

```go
}

// totalFromContentRange parses the size from "bytes a-b/total" (-1 if unknown).
func totalFromContentRange(v string) int64 {
	i := strings.LastIndexByte(v, '/')
	if i < 0 || v[i+1:] == "*" {
		return -1
	}
	n, err := strconv.ParseInt(strings.TrimSpace(v[i+1:]), 10, 64)
	if err != nil {
		return -1
	}
	return n
}

type prefetched struct {
	start int64
```

**DESPUÉS:**

```go
}

type prefetched struct {
	start int64
```

**Verificación de aceptación:** rg no debe encontrar referencias al símbolo. go test ./internal/drive y build deben pasar.

## Fase 2: Optimizaciones de Memoria/Locks

### O-01 — Dos buffers de canales dimensionados con toda la biblioteca.

Acotar los buffers al número de workers y mover el envío a un productor concurrente cancelable. La salida completa sigue siendo O(N); se elimina capacidad auxiliar de canales O(N). No reducir solo los buffers: el productor sincrónico bloquearía antes de empezar el consumidor.

**Archivo exacto:** `internal/library/scanner/discovery.go`. **Líneas originales:** 112-117.

**ANTES:**

```go
	})

	jobs := make(chan string, len(paths))
	results := make(chan *dto.LocalFile, len(paths))
	var skipped atomic.Int64

```

**DESPUÉS:**

```go
	})

	jobs := make(chan string, maxWorkers)
	results := make(chan *dto.LocalFile, maxWorkers)
	var skipped atomic.Int64

```

**Archivo exacto:** `internal/library/scanner/discovery.go`. **Líneas originales:** 206-213.

**ANTES:**

```go
	}

	for _, p := range paths {
		jobs <- p
	}
	close(jobs)

	go func() {
```

**DESPUÉS:**

```go
	}

	go func() {
		defer close(jobs)
		for _, p := range paths {
			select {
			case jobs <- p:
			case <-ctx.Done():
				return
			}
		}
	}()

	go func() {
```

**Verificación de aceptación:** Escanear fixtures con 0, 1 y miles de rutas, permisos fallidos y cancelación; comprobar que terminan workers y productor y que no cambia el conjunto de rutas. Comparar allocs/bytes con -benchmem.

### O-02 — Consulta por absolute_number sin índice compuesto correspondiente, SELECT completo y contexto perdido.

Añadir índice (library_media_id, absolute_number), proyectar cuatro columnas y usar WithContext en las tres queries. No cambiar la búsqueda JSON de local_file sin medirla. EXPLAIN en fixture muestra búsqueda por ambas columnas tras crear el índice; no representa latencia de producción.

**Archivo exacto:** `internal/database/db/db_migrations.go`. **Líneas originales:** 70-73.

**ANTES:**

```go
// de forma síncrona durante el inicio. No contiene lógica de migración de datos.
func migrateSchema(ctx context.Context, db *gorm.DB, logger *zerolog.Logger) error {
	// Limpia duplicados de LibraryMedia (los TMDB ID deben ser únicos POR TIPO)
	if err := db.Exec(`
```

**DESPUÉS:**

```go
// de forma síncrona durante el inicio. No contiene lógica de migración de datos.
func migrateSchema(ctx context.Context, db *gorm.DB, logger *zerolog.Logger) error {
	db = db.WithContext(ctx)

	// Limpia duplicados de LibraryMedia (los TMDB ID deben ser únicos POR TIPO)
	if err := db.Exec(`
```

**Archivo exacto:** `internal/database/db/db_migrations.go`. **Líneas originales:** 111-114.

**ANTES:**

```go
	); err != nil {
		return err
	}

```

**DESPUÉS:**

```go
	); err != nil {
		return err
	}

	if err := db.Exec("CREATE INDEX IF NOT EXISTS idx_library_episodes_media_absolute ON library_episodes (library_media_id, absolute_number)").Error; err != nil {
		return fmt.Errorf("create episode absolute-number index: %w", err)
	}

```

**Archivo exacto:** `internal/handlers/chronology_frames.go`. **Líneas originales:** 39-43.

**ANTES:**

```go
	// 1. Find LibraryMedia by TMDB ID (type ANIME or SHOW)
	var libMedia models.LibraryMedia
	if err := h.App.Database.Gorm().
		Select("id").
		Where("tmdb_id = ? AND type IN (?, ?)", tmdbID, "ANIME", "SHOW").
```

**DESPUÉS:**

```go
	// 1. Find LibraryMedia by TMDB ID (type ANIME or SHOW)
	var libMedia models.LibraryMedia
	if err := h.App.Database.Gorm().WithContext(c.Request().Context()).
		Select("id").
		Where("tmdb_id = ? AND type IN (?, ?)", tmdbID, "ANIME", "SHOW").
```

**Archivo exacto:** `internal/handlers/chronology_frames.go`. **Líneas originales:** 47-52.

**ANTES:**

```go

	// 2. Find LibraryEpisode by LibraryMediaID + AbsoluteNumber
	var libEpisode models.LibraryEpisode
	if err := h.App.Database.Gorm().
		Where("library_media_id = ? AND absolute_number = ?", libMedia.ID, absoluteEpisode).
		First(&libEpisode).Error; err != nil {
```

**DESPUÉS:**

```go

	// 2. Find LibraryEpisode by LibraryMediaID + AbsoluteNumber
	var libEpisode struct {
		Image          string
		AbsoluteNumber int
		Title          string
		SagaName       string
	}
	if err := h.App.Database.Gorm().WithContext(c.Request().Context()).
		Model(&models.LibraryEpisode{}).
		Select("image", "absolute_number", "title", "saga_name").
		Where("library_media_id = ? AND absolute_number = ?", libMedia.ID, absoluteEpisode).
		First(&libEpisode).Error; err != nil {
```

**Archivo exacto:** `internal/handlers/chronology_frames.go`. **Líneas originales:** 72-76.

**ANTES:**

```go
	var localFile models.LocalFile
	// Use raw SQL for flexible matching on parsed/metadata
	query := h.App.Database.Gorm().
		Table("local_file").
		Select("path", "file_mod_time", "file_size").
```

**DESPUÉS:**

```go
	var localFile models.LocalFile
	// Use raw SQL for flexible matching on parsed/metadata
	query := h.App.Database.Gorm().WithContext(c.Request().Context()).
		Table("local_file").
		Select("path", "file_mod_time", "file_size").
```

**Verificación de aceptación:** Probar imagen existente, fallback local, serie/episodio ausentes y contexto cancelado. EXPLAIN QUERY PLAN debe usar idx_library_episodes_media_absolute en una fixture representativa. Verificar que AutoMigrate crea la tabla antes del índice.

### R-01 — len(st.segments) leído después de liberar RLock, concurrentemente con Grow.

Capturar longitud dentro del lock. Reproducción con -race confirmó la carrera. No sustituir SegmentTable por atomics: los canales y el crecimiento requieren un protocolo conjunto.

**Archivo exacto:** `internal/mediastream/cassette/segment.go`. **Líneas originales:** 103-108.

**ANTES:**

```go
	st.mu.RLock()
	if seg < 0 || int(seg) >= len(st.segments) {
		st.mu.RUnlock()
		return fmt.Errorf("%w: index %d (len=%d)", ErrSegmentOutOfRange, seg, len(st.segments))
	}
	ch := st.segments[seg].ch
```

**DESPUÉS:**

```go
	st.mu.RLock()
	if seg < 0 || int(seg) >= len(st.segments) {
		length := len(st.segments)
		st.mu.RUnlock()
		return fmt.Errorf("%w: index %d (len=%d)", ErrSegmentOutOfRange, seg, length)
	}
	ch := st.segments[seg].ch
```

**Verificación de aceptación:** Añadir test concurrente Grow/WaitFor sobre índices inválidos y ejecutar -race. La longitud del mensaje debe corresponder al snapshot bajo lock.

### R-02 — UpdateLibraryMediaMappings no invalida la caché; carga anterior puede republicar datos obsoletos.

Caché por generación mediante atomic.Pointer[sync.Map]. Cada lector publica en la generación que capturó, cada escritura de estos repositorios intercambia el mapa tras éxito. Invalida todos los alias sin carreras de republicación; coste: misses de otras medias tras una escritura. No garantiza coherencia de escrituras SQL externas a estos repositorios; centralizarlas es seguimiento separado.

**Archivo exacto:** `internal/database/db/db.go`. **Líneas originales:** 26-30.

**ANTES:**

```go
	CurrMediaFillers        mo.Option[map[int]*MediaFillerItem]
	cleanupManager          *CleanupManager
	LibraryMediaCache       sync.Map // L1 read cache scoped to the database instance
	slowTraceLogger         *SlowTraceLogger
	sqlitePath              string
```

**DESPUÉS:**

```go
	CurrMediaFillers        mo.Option[map[int]*MediaFillerItem]
	cleanupManager          *CleanupManager
	libraryMediaCache       atomic.Pointer[sync.Map] // Generation scoped to this database.
	slowTraceLogger         *SlowTraceLogger
	sqlitePath              string
```

**Archivo exacto:** `internal/database/db/library_media.go`. **Líneas originales:** 5-8.

**ANTES:**

```go
	"fmt"
	"kamehouse/internal/database/models"

	"gorm.io/gorm"
```

**DESPUÉS:**

```go
	"fmt"
	"kamehouse/internal/database/models"
	"sync"

	"gorm.io/gorm"
```

**Archivo exacto:** `internal/database/db/library_media.go`. **Líneas originales:** 13-18.

**ANTES:**

```go
// Cloned to prevent caller mutating cached object.
func GetLibraryMediaByTmdbIdAndType(d *Database, tmdbID int, mediaType string) (*models.LibraryMedia, error) {
	cacheKey := fmt.Sprintf("id_type_%d_%s", tmdbID, mediaType)
	if v, ok := d.LibraryMediaCache.Load(cacheKey); ok {
		if media, _ := v.(*models.LibraryMedia); media == nil {
			return nil, nil
```

**DESPUÉS:**

```go
// Cloned to prevent caller mutating cached object.
func GetLibraryMediaByTmdbIdAndType(d *Database, tmdbID int, mediaType string) (*models.LibraryMedia, error) {
	cache := d.libraryMediaSnapshot()
	cacheKey := fmt.Sprintf("id_type_%d_%s", tmdbID, mediaType)
	if v, ok := cache.Load(cacheKey); ok {
		if media, _ := v.(*models.LibraryMedia); media == nil {
			return nil, nil
```

**Archivo exacto:** `internal/database/db/library_media.go`. **Líneas originales:** 26-35.

**ANTES:**

```go
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			d.LibraryMediaCache.Store(cacheKey, (*models.LibraryMedia)(nil))
			return nil, nil
		}
		return nil, err
	}
	d.LibraryMediaCache.Store(cacheKey, &media)
	copy := media
	return &copy, nil
```

**DESPUÉS:**

```go
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			cache.Store(cacheKey, (*models.LibraryMedia)(nil))
			return nil, nil
		}
		return nil, err
	}
	cache.Store(cacheKey, &media)
	copy := media
	return &copy, nil
```

**Archivo exacto:** `internal/database/db/library_media.go`. **Líneas originales:** 39-44.

**ANTES:**

```go
// Cloned to prevent caller mutating cached object.
func GetLibraryMediaByID(d *Database, id uint) (*models.LibraryMedia, error) {
	cacheKey := fmt.Sprintf("pk_%d", id)
	if v, ok := d.LibraryMediaCache.Load(cacheKey); ok {
		if media, _ := v.(*models.LibraryMedia); media == nil {
			return nil, nil
```

**DESPUÉS:**

```go
// Cloned to prevent caller mutating cached object.
func GetLibraryMediaByID(d *Database, id uint) (*models.LibraryMedia, error) {
	cache := d.libraryMediaSnapshot()
	cacheKey := fmt.Sprintf("pk_%d", id)
	if v, ok := cache.Load(cacheKey); ok {
		if media, _ := v.(*models.LibraryMedia); media == nil {
			return nil, nil
```

**Archivo exacto:** `internal/database/db/library_media.go`. **Líneas originales:** 52-61.

**ANTES:**

```go
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			d.LibraryMediaCache.Store(cacheKey, (*models.LibraryMedia)(nil))
			return nil, nil
		}
		return nil, err
	}
	d.LibraryMediaCache.Store(cacheKey, &media)
	copy := media
	return &copy, nil
```

**DESPUÉS:**

```go
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			cache.Store(cacheKey, (*models.LibraryMedia)(nil))
			return nil, nil
		}
		return nil, err
	}
	cache.Store(cacheKey, &media)
	copy := media
	return &copy, nil
```

**Archivo exacto:** `internal/database/db/library_media.go`. **Líneas originales:** 83-94.

**ANTES:**

```go
		return nil, err
	}
	// Invalidate cache entry so the next read fetches the authoritative DB record.
	if media.TmdbID != 0 {
		d.LibraryMediaCache.Delete(fmt.Sprintf("id_%d", media.TmdbID))
		d.LibraryMediaCache.Delete(fmt.Sprintf("id_type_%d_%s", media.TmdbID, media.Type))
	}
	if media.ID != 0 {
		d.LibraryMediaCache.Delete(fmt.Sprintf("pk_%d", media.ID))
	}
	return media, nil
}
```

**DESPUÉS:**

```go
		return nil, err
	}
	d.invalidateLibraryMediaCache()
	return media, nil
}
```

**Archivo exacto:** `internal/database/db/library_media.go`. **Líneas originales:** 136-161.

**ANTES:**

```go

// evictLibraryMediaCache saca de la caché en memoria las entradas de cada registro escrito.
func evictLibraryMediaCache(d *Database, media []*models.LibraryMedia) {
	for _, m := range media {
		if m.TmdbID != 0 {
			d.LibraryMediaCache.Delete(fmt.Sprintf("id_%d", m.TmdbID))
			d.LibraryMediaCache.Delete(fmt.Sprintf("id_type_%d_%s", m.TmdbID, m.Type))
			// Also evict malId mapping if present
			if m.MyanimelistId != 0 {
				d.LibraryMediaCache.Delete(fmt.Sprintf("malid_%d", m.MyanimelistId))
			}
		}
		if m.ID != 0 {
			d.LibraryMediaCache.Delete(fmt.Sprintf("pk_%d", m.ID))
		}
	}
}

// UpdateLibraryMediaMappings updates the external mappings (AniDB, MAL) for a LibraryMedia record.
func UpdateLibraryMediaMappings(d *Database, id uint, anidbId, malId int) error {
	return d.Gorm().Model(&models.LibraryMedia{}).Where("id = ?", id).Updates(map[string]interface{}{
		"anidb_id":       anidbId,
		"myanimelist_id": malId,
	}).Error
}

```

**DESPUÉS:**

```go

// evictLibraryMediaCache saca de la caché en memoria las entradas de cada registro escrito.
func (d *Database) libraryMediaSnapshot() *sync.Map {
	if c := d.libraryMediaCache.Load(); c != nil {
		return c
	}
	c := &sync.Map{}
	if d.libraryMediaCache.CompareAndSwap(nil, c) {
		return c
	}
	return d.libraryMediaCache.Load()
}

func (d *Database) invalidateLibraryMediaCache() { d.libraryMediaCache.Store(&sync.Map{}) }

func evictLibraryMediaCache(d *Database, _ []*models.LibraryMedia) { d.invalidateLibraryMediaCache() }

// UpdateLibraryMediaMappings updates the external mappings (AniDB, MAL) for a LibraryMedia record.
func UpdateLibraryMediaMappings(d *Database, id uint, anidbId, malId int) error {
	err := d.Gorm().Model(&models.LibraryMedia{}).Where("id = ?", id).Updates(map[string]interface{}{
		"anidb_id":       anidbId,
		"myanimelist_id": malId,
	}).Error
	if err != nil {
		return err
	}
	d.invalidateLibraryMediaCache()
	return nil
}

```

**Verificación de aceptación:** Sembrar caché PK y TMDB/type, modificar MAL y AniDB, comprobar ambas lecturas. Intercalar lector antiguo, escritura e invalidación y comprobar que no contamina la nueva generación. Probar error SQL: no invalidar antes del commit.

## Fase 3: Robustez y Contextos

### R-03 — La migración puede borrar local_files tras JSON inválido, error de lectura o coexistencia de datos relacionales.

Fallar conservando el origen; comprobar errores; validar filas nil y path vacío; usar LocalFileDtoToModel para no perder campos. Crear filas y borrar tabla solo dentro de la transacción exitosa. Con ambas tablas pobladas, devolver error de conciliación; nunca elegir automáticamente qué datos descartar.

**Archivo exacto:** `internal/database/db/db_migrations.go`. **Líneas originales:** 229-286.

**ANTES:**

```go
		return nil
	}
	var count int64
	gormDB.Table("local_files").Count(&count)
	var relationalCount int64
	gormDB.Model(&models.LocalFile{}).Count(&relationalCount)

	if relationalCount == 0 && count > 0 {
		var legacy models.LocalFiles
		if err := gormDB.Table("local_files").Last(&legacy).Error; err == nil {
			var lfs []*dto.LocalFile
			if err := json.Unmarshal(legacy.Value, &lfs); err == nil && len(lfs) > 0 {
				dbFiles := make([]*models.LocalFile, len(lfs))
				for i, f := range lfs {
					dbf := &models.LocalFile{
						Path:           f.Path,
						Name:           f.Name,
						FileHash:       f.FileHash,
						Locked:         f.Locked,
						Ignored:        f.Ignored,
						LibraryMediaId: f.LibraryMediaId,
						MediaID:        f.MediaID,
					}
					if f.ParsedData != nil {
						dbf.ParsedData, _ = json.Marshal(f.ParsedData)
					}
					if f.ParsedFolderData != nil {
						dbf.ParsedFolderData, _ = json.Marshal(f.ParsedFolderData)
					}
					if f.Metadata != nil {
						dbf.Metadata, _ = json.Marshal(f.Metadata)
					}
					if f.TechnicalInfo != nil {
						dbf.TechnicalInfo, _ = json.Marshal(f.TechnicalInfo)
					}
					dbFiles[i] = dbf
				}

				if err := gormDB.Transaction(func(tx *gorm.DB) error {
					if err := tx.CreateInBatches(dbFiles, 100).Error; err != nil {
						return err
					}
					return tx.Migrator().DropTable("local_files")
				}); err != nil {
					return err
				}
				return nil
			}
		}
	}

	// Si no hay datos pendientes por migrar, purgar la tabla legacy de forma segura
	if gormDB.Migrator().HasTable("local_files") {
		_ = gormDB.Migrator().DropTable("local_files")
	}
	return nil
}

```

**DESPUÉS:**

```go
		return nil
	}
	return gormDB.Transaction(func(tx *gorm.DB) error {
		var count int64
		if err := tx.Table("local_files").Count(&count).Error; err != nil {
			return fmt.Errorf("count legacy local files: %w", err)
		}
		if count == 0 {
			return nil
		}
		var relationalCount int64
		if err := tx.Model(&models.LocalFile{}).Count(&relationalCount).Error; err != nil {
			return fmt.Errorf("count relational local files: %w", err)
		}
		if relationalCount != 0 {
			return fmt.Errorf("legacy local_files and relational local_file both contain data; reconciliation required")
		}
		var legacy models.LocalFiles
		if err := tx.Table("local_files").Last(&legacy).Error; err != nil {
			return fmt.Errorf("read legacy local files: %w", err)
		}
		var lfs []*dto.LocalFile
		if err := json.Unmarshal(legacy.Value, &lfs); err != nil {
			return fmt.Errorf("decode legacy local files: %w", err)
		}
		if lfs == nil {
			return fmt.Errorf("legacy local files snapshot is null")
		}
		dbFiles := make([]*models.LocalFile, 0, len(lfs))
		for i, f := range lfs {
			if f == nil || f.Path == "" {
				return fmt.Errorf("invalid legacy local file at index %d", i)
			}
			m, err := LocalFileDtoToModel(f)
			if err != nil {
				return fmt.Errorf("convert legacy local file %d: %w", i, err)
			}
			dbFiles = append(dbFiles, m)
		}
		if len(dbFiles) > 0 {
			if err := tx.CreateInBatches(dbFiles, 100).Error; err != nil {
				return fmt.Errorf("insert legacy local files: %w", err)
			}
		}
		return tx.Migrator().DropTable("local_files")
	})
}

```

**Verificación de aceptación:** JSON truncado, null, [null], path vacío, ambas tablas pobladas, error de inserción y migración exitosa. Comprobar conservación del origen ante error, rollback total y preservación de DriveFileID, FileSize, FileModTime y EmbeddedMetadata. No automatizar conciliación de bases mixtas.

### R-04 — Pool abierto sin cierre en errores de inicialización y logger.Fatal dentro del constructor.

Validar logger, cerrar el pool mientras no se transfiera su propiedad y devolver error de migración. El llamador decide terminar el proceso. Mantener pool y PRAGMA actuales; WAL permite un escritor simultáneo, y cambiar a una conexión global degradaría lecturas sin evidencia.

**Archivo exacto:** `internal/database/db/db.go`. **Líneas originales:** 54-57.

**ANTES:**

```go
// heredados (DML) se delega a runDataMigrations en segundo plano.
func NewDatabase(ctx context.Context, appDataDir, dbName string, logger *zerolog.Logger) (*Database, error) {
	var sqlitePath string
	if os.Getenv("TEST_ENV") == "true" || appDataDir == "" {
```

**DESPUÉS:**

```go
// heredados (DML) se delega a runDataMigrations en segundo plano.
func NewDatabase(ctx context.Context, appDataDir, dbName string, logger *zerolog.Logger) (*Database, error) {
	if logger == nil {
		return nil, fmt.Errorf("db: logger is required")
	}
	var sqlitePath string
	if os.Getenv("TEST_ENV") == "true" || appDataDir == "" {
```

**Archivo exacto:** `internal/database/db/db.go`. **Líneas originales:** 106-109.

**ANTES:**

```go
	}

	maxOpenConns := runtime.NumCPU()
	if maxOpenConns < 4 {
```

**DESPUÉS:**

```go
	}

	ownsPool := true
	defer func() {
		if ownsPool {
			_ = sqlDB.Close()
		}
	}()

	maxOpenConns := runtime.NumCPU()
	if maxOpenConns < 4 {
```

**Archivo exacto:** `internal/database/db/db.go`. **Líneas originales:** 120-125.

**ANTES:**

```go
	// DDL: migración de esquema e índices (síncrona - requerida para funcionamiento)
	if err := migrateSchema(ctx, db, logger); err != nil {
		logger.Fatal().Err(err).Msg("db: Failed to perform auto migration. Schema out of date.")
		return nil, err
	}

```

**DESPUÉS:**

```go
	// DDL: migración de esquema e índices (síncrona - requerida para funcionamiento)
	if err := migrateSchema(ctx, db, logger); err != nil {
		logger.Error().Err(err).Msg("db: Failed to perform auto migration. Schema out of date.")
		return nil, fmt.Errorf("migrate database schema: %w", err)
	}

```

**Archivo exacto:** `internal/database/db/db.go`. **Líneas originales:** 170-173.

**ANTES:**

```go
	}()

	return database, nil
}
```

**DESPUÉS:**

```go
	}()

	ownsPool = false
	return database, nil
}
```

**Verificación de aceptación:** Logger nil devuelve error; contexto cancelado devuelve error sin terminar proceso; fallo de migración devuelve error y cierra el pool; éxito conserva conexiones utilizables hasta Close.

### R-05 — recover de migraciones cierra done sin publicar error ni estado final.

Publicar resultado dentro del defer tanto en éxito como en error y panic. MigrationStatus complete significa terminada; health comprueba primero error y devuelve down. No heredar ciegamente el timeout de inicialización de 30 segundos para trabajos duraderos.

**Archivo exacto:** `internal/database/db/db_migrations.go`. **Líneas originales:** 19-38.

**ANTES:**

```go
	db.migrationsDone = make(chan struct{})
	go func() {
		defer close(db.migrationsDone)
		defer func() {
			if r := recover(); r != nil {
				db.Logger.Error().Interface("panic", r).Msg("db: panic en runDataMigrations")
			}
		}()

		db.Logger.Info().Msg("db: iniciando migraciones de datos en background")
		err := db.runDataMigrationsInternal()
		db.migrationMu.Lock()
		db.migrationComplete = true
		db.migrationError = err
		db.migrationMu.Unlock()
		if err != nil {
			db.Logger.Error().Err(err).Msg("db: fallo en migraciones de datos background")
		} else {
			db.Logger.Info().Msg("db: migraciones de datos background completadas")
		}
```

**DESPUÉS:**

```go
	db.migrationsDone = make(chan struct{})
	go func() {
		var migrationErr error
		defer func() {
			if r := recover(); r != nil {
				migrationErr = fmt.Errorf("data migration panic: %v", r)
			}
			db.migrationMu.Lock()
			db.migrationComplete = true
			db.migrationError = migrationErr
			db.migrationMu.Unlock()
			close(db.migrationsDone)
			if migrationErr != nil {
				db.Logger.Error().Err(migrationErr).Msg("db: fallo en migraciones de datos background")
			}
		}()

		db.Logger.Info().Msg("db: iniciando migraciones de datos en background")
		migrationErr = db.runDataMigrationsInternal()
		if migrationErr == nil {
			db.Logger.Info().Msg("db: migraciones de datos background completadas")
		}
```

**Verificación de aceptación:** Forzar panic en prueba aislada y comprobar done cerrado, complete=true y error no nil; health debe informar down. No considerar éxito solo porque done cerró.

### R-06 — Respuesta del servicio opcional de mappings leída sin límite de bytes.

Aplicar límite de 1 MiB más un byte centinela, rechazar exceso y conservar defer Body.Close. Probar exacto, exceso, cuerpo nil y error de lectura; el límite aplica también a respuestas 429 antes de reintentar.

**Archivo exacto:** `internal/library/scanner/metadata_mapping.go`. **Líneas originales:** 135-139.

**ANTES:**

```go
	}
	defer resp.Body.Close()
	return io.ReadAll(resp.Body)
}

```

**DESPUÉS:**

```go
	}
	defer resp.Body.Close()
	const maxMappingBody = 1 << 20
	body, err := io.ReadAll(io.LimitReader(resp.Body, maxMappingBody+1))
	if err != nil {
		return nil, err
	}
	if len(body) > maxMappingBody {
		return nil, fmt.Errorf("mapping response exceeds %d bytes", maxMappingBody)
	}
	return body, nil
}

```

**Verificación de aceptación:** 1 MiB permitido; 1 MiB+1 rechazado; Body.Close siempre invocado; sin respuesta/cuerpo devuelve error.

### R-07 — Consulta síncrona de subtítulos pierde contexto; el primer llamador de la apertura compartida tampoco puede abandonar la espera.

Pasar contexto desde Echo; mantener trabajo compartido con timeout de 40s; abrir en una goroutine deduplicada y permitir a cada cliente cancelar su espera. Publicar resultado y cerrar done incluso ante panic. Actualizar dos llamadas de producción y dos de tests. Cancelar un cliente no debe romper a otros.

**Archivo exacto:** `internal/handlers/drive_subtitles.go`. **Líneas originales:** 27-31.

**ANTES:**

```go
//
// `out.MediaInfo` debe ser una copia privada (publicDriveContainer ya la hace).
func (h *Handler) addDriveEmbeddedSubtitles(out *mediastream.MediaContainer, src *videofile.MediaInfo, drivePath string) {
	if out == nil || out.MediaInfo == nil || src == nil {
		return
```

**DESPUÉS:**

```go
//
// `out.MediaInfo` debe ser una copia privada (publicDriveContainer ya la hace).
func (h *Handler) addDriveEmbeddedSubtitles(ctx context.Context, out *mediastream.MediaContainer, src *videofile.MediaInfo, drivePath string) {
	if out == nil || out.MediaInfo == nil || src == nil {
		return
```

**Archivo exacto:** `internal/handlers/drive_subtitles.go`. **Líneas originales:** 44-50.

**ANTES:**

```go
	// que se está viendo, sin bajar el archivo entero. El resto (PGS, archivos sin
	// índice) queda pendiente de la extracción completa, que el usuario dispara.
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	info := h.App.MediastreamRepository.DriveWindowSupportInfo(ctx, drivePath, embedded)
	cancel()
	windowed := info.Tracks
	if info.FileReason != "" {
```

**DESPUÉS:**

```go
	// que se está viendo, sin bajar el archivo entero. El resto (PGS, archivos sin
	// índice) queda pendiente de la extracción completa, que el usuario dispara.
	ctx, cancel := context.WithTimeout(ctx, 20*time.Second)
	defer cancel()
	info := h.App.MediastreamRepository.DriveWindowSupportInfo(ctx, drivePath, embedded)
	windowed := info.Tracks
	if info.FileReason != "" {
```

**Archivo exacto:** `internal/handlers/drive_mediastream.go`. **Líneas originales:** 264-268.

**ANTES:**

```go
	}
	out := publicDriveContainer(mc, drivePath, publicURL)
	h.addDriveEmbeddedSubtitles(out, mc.MediaInfo, drivePath)
	h.addDriveExternalSubtitles(c.Request().Context(), out, drivePath, fileID, fileName)
	h.signStreamURL(out)
```

**DESPUÉS:**

```go
	}
	out := publicDriveContainer(mc, drivePath, publicURL)
	h.addDriveEmbeddedSubtitles(c.Request().Context(), out, mc.MediaInfo, drivePath)
	h.addDriveExternalSubtitles(c.Request().Context(), out, drivePath, fileID, fileName)
	h.signStreamURL(out)
```

**Archivo exacto:** `internal/handlers/drive_mediastream.go`. **Líneas originales:** 281-285.

**ANTES:**

```go
	}
	out := publicDriveContainer(mc, drivePath, publicURL)
	h.addDriveEmbeddedSubtitles(out, mc.MediaInfo, drivePath)
	h.addDriveExternalSubtitles(c.Request().Context(), out, drivePath, fileID, fileName)
	h.signStreamURL(out)
```

**DESPUÉS:**

```go
	}
	out := publicDriveContainer(mc, drivePath, publicURL)
	h.addDriveEmbeddedSubtitles(c.Request().Context(), out, mc.MediaInfo, drivePath)
	h.addDriveExternalSubtitles(c.Request().Context(), out, drivePath, fileID, fileName)
	h.signStreamURL(out)
```

**Archivo exacto:** `internal/handlers/external_subtitles_test.go`. **Líneas originales:** 75-79.

**ANTES:**

```go
	}
	out := &mediastream.MediaContainer{MediaInfo: &videofile.MediaInfo{}}
	h.addDriveEmbeddedSubtitles(out, src, "gdrive://id/ep.mkv")

	require.Len(t, out.MediaInfo.Subtitles, 2, "el DVB sin extensión no se ofrece")
```

**DESPUÉS:**

```go
	}
	out := &mediastream.MediaContainer{MediaInfo: &videofile.MediaInfo{}}
	h.addDriveEmbeddedSubtitles(context.Background(), out, src, "gdrive://id/ep.mkv")

	require.Len(t, out.MediaInfo.Subtitles, 2, "el DVB sin extensión no se ofrece")
```

**Archivo exacto:** `internal/handlers/external_subtitles_test.go`. **Líneas originales:** 112-116.

**ANTES:**

```go
	}
	out := &mediastream.MediaContainer{MediaInfo: &videofile.MediaInfo{}}
	h.addDriveEmbeddedSubtitles(out, src, "gdrive://id/ep.mkv")

	require.Len(t, out.MediaInfo.Subtitles, 3)
```

**DESPUÉS:**

```go
	}
	out := &mediastream.MediaContainer{MediaInfo: &videofile.MediaInfo{}}
	h.addDriveEmbeddedSubtitles(context.Background(), out, src, "gdrive://id/ep.mkv")

	require.Len(t, out.MediaInfo.Subtitles, 3)
```

**Archivo exacto:** `internal/mediastream/drivesubs_window.go`. **Líneas originales:** 316-347.

**ANTES:**

```go
		g.mu.Unlock()

		// La apertura no depende del pedido que la disparó: si ese se cancela, la lectura de
		// la cabecera sigue y su resultado lo aprovechan los demás.
		octx, cancel := context.WithTimeout(context.Background(), driveWindowOpenTimeout)
		s, err := r.openDriveWindowSession(octx, drivePath, hash)
		cancel()

		g.mu.Lock()
		delete(g.opening, hash)
		if err == nil {
			if g.sessions == nil {
				g.sessions = map[string]*driveWindowSession{}
			}
			g.evictLocked()
			g.sessions[hash] = s
			delete(g.failed, hash)
		} else if errors.Is(err, ErrDriveWindowReadFailed) {
			if g.failed == nil {
				g.failed = map[string]openFailure{}
			}
			g.failed[hash] = openFailure{err: err, at: time.Now()}
		}
		g.mu.Unlock()
		call.s, call.err = s, err
		close(call.done)
		if err != nil {
			return nil, err
		}
		return s, nil
	}
}
```

**DESPUÉS:**

```go
		g.mu.Unlock()

		go func() {
			var session *driveWindowSession
			var openErr error
			defer func() {
				if v := recover(); v != nil {
					openErr = newReadError(fmt.Errorf("Drive window open panic: %v", v))
				}
				g.mu.Lock()
				delete(g.opening, hash)
				if openErr == nil {
					if g.sessions == nil {
						g.sessions = map[string]*driveWindowSession{}
					}
					g.evictLocked()
					g.sessions[hash] = session
					delete(g.failed, hash)
				} else if errors.Is(openErr, ErrDriveWindowReadFailed) {
					if g.failed == nil {
						g.failed = map[string]openFailure{}
					}
					g.failed[hash] = openFailure{err: openErr, at: time.Now()}
				}
				g.mu.Unlock()
				call.s, call.err = session, openErr
				close(call.done)
			}()
			octx, cancel := context.WithTimeout(context.Background(), driveWindowOpenTimeout)
			defer cancel()
			session, openErr = r.openDriveWindowSession(octx, drivePath, hash)
		}()
		select {
		case <-ctx.Done():
			return nil, newReadError(ctx.Err())
		case <-call.done:
			return call.s, call.err
		}
	}
}
```

**Verificación de aceptación:** Factory bloqueada: cancelar primer cliente debe devolver antes de que la factory termine; segundo cliente sigue esperando el mismo openCall. Al liberar factory, los demás reciben resultado; nunca dejar opening o done colgados. Probar panic y -race.

## Límites y decisiones de la auditoría

- No borrar Deserialize/Serialize, MarshalJSON/UnmarshalJSON, AfterFind, TableName ni WriteLevel por ausencia de referencias textuales: son contratos de interfaces/hooks. WaitIdle y SetHTTPClient tienen consumidores en tests.
- No retirar endpoints únicamente por no aparecer su URL literal. GetLibraryEpisodeFile tiene consumidor en library-episode.hooks.ts y EpisodeThumbnailImg.tsx; pretranscode también tiene UI activa. No se confirmó ningún endpoint obsoleto apto para borrar en este pase.
- models.LocalFiles es legacy pero lo consume la migración. ShelvedLocalFiles se lee y guarda durante escaneos. No se justificó DROP COLUMN ni eliminación de otras tablas.
- Proxy de imágenes ya usa singleflight y entrega hits desde disco; no proponer otro deduplicador ni cargar hits completos en memoria. MediaInfoExtractor, colección y entradas ya tienen deduplicación.
- Colecciones y swimlanes ya usan lotes y proyecciones en varios caminos; no se confirmó N+1 en esos recorridos. El catálogo completo en collection_hydrate.go requiere medición antes de recortar columnas que forman parte de la respuesta.
- CompareFingerprints tiene bucle O(N*M) e histogramas O(N+M). Optimización pendiente de benchmark y equivalencia de límites/marcas; no cambiar tipos, pools ni algoritmo sin demostrar ganancia y resultados idénticos.
- La caché global de LocalFiles y las escrituras GORM que evitan los repositorios merecen una revisión posterior de alcance/ownership. La propuesta R-02 cubre las escrituras de library_media.go; no promete coherencia automática para SQL arbitrario.

# 3. COMANDOS DE VERIFICACIÓN

```powershell
Set-Location 'D:\Proyectos_personales\KameHouse-rio-grande\apps\server'
$goAudit = 'C:/Users/Tinchoo/go/pkg/mod/golang.org/toolchain@v0.0.1-go1.26.6.windows-amd64/bin/go.exe'
$env:GOTOOLCHAIN = 'local'
$env:GOPROXY = 'off'
$env:GOSUMDB = 'off'
$env:GOFLAGS = '-mod=readonly'
& $goAudit version
& $goAudit vet ./...
& $goAudit test ./... -short
& $goAudit test ./... -count=1 -timeout=15m
$env:CGO_ENABLED = '1'
& $goAudit test -race ./internal/database/db ./internal/mediastream ./internal/mediastream/cassette ./internal/handlers ./internal/library/scanner -short -count=1 -timeout=15m
$buildAuditDir = Join-Path $env:TEMP ('kamehouse-build-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $buildAuditDir | Out-Null
& $goAudit build -o (Join-Path $buildAuditDir 'kamehouse-server.exe') .
git diff --check
```

En ejecución manual, comprobar `$LASTEXITCODE` después de cada comando. No ejecutar la suite completa con credenciales ni rutas de biblioteca real configuradas: usar configuración de pruebas. No fijar TEST_ENV=true globalmente: las pruebas de backup necesitan SQLite en archivo.

### Reproducciones entregadas

Archivo nuevo de test (overlay): `audit_db_test.go`. ANTES: archivo inexistente. DESPUÉS:

```go
package db
import (
 "testing"
 "github.com/glebarez/sqlite"
 "gorm.io/gorm"
 "kamehouse/internal/database/models"
)
func auditDB(t *testing.T) *gorm.DB {
 t.Helper()
 g, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
 if err != nil { t.Fatal(err) }
 s,err:=g.DB(); if err!=nil {t.Fatal(err)}; s.SetMaxOpenConns(1); t.Cleanup(func(){s.Close()})
 return g
}
func TestAuditCorruptLegacyPreserved(t *testing.T) {
 g:=auditDB(t)
 if err:=g.AutoMigrate(&models.LocalFiles{}, &models.LocalFile{}); err!=nil {t.Fatal(err)}
 if err:=g.Create(&models.LocalFiles{Value: []byte("{broken")}).Error;err!=nil {t.Fatal(err)}
 err:=migrateLegacyLocalFiles(g)
 if err==nil {t.Error("migration returned success for corrupt JSON")}
 if !g.Migrator().HasTable("local_files") {t.Error("DATA LOSS: legacy table dropped after invalid JSON")}
}
func TestAuditMappingCacheFresh(t *testing.T) {
 g:=auditDB(t)
 if err:=g.AutoMigrate(&models.LibraryMedia{});err!=nil {t.Fatal(err)}
 m:=&models.LibraryMedia{TmdbID: 123,Type:"SHOW",MyanimelistId:10}
 if err:=g.Create(m).Error;err!=nil {t.Fatal(err)}
 d:=&Database{gormdb:g}
 if _,err:=GetLibraryMediaByID(d,m.ID);err!=nil {t.Fatal(err)}
 if err:=UpdateLibraryMediaMappings(d,m.ID,1,20);err!=nil {t.Fatal(err)}
 got,err:=GetLibraryMediaByID(d,m.ID);if err!=nil {t.Fatal(err)}
 if got.MyanimelistId!=20 {t.Fatalf("stale MAL mapping: got %d want 20",got.MyanimelistId)}
}

```

Archivo nuevo de test (overlay): `audit_segment_test.go`. ANTES: archivo inexistente. DESPUÉS:

```go
package cassette
import (
 "context"
 "sync"
 "testing"
)
func TestAuditSegmentConcurrentGrow(t *testing.T) {
 st:=NewSegmentTable(1)
 var wg sync.WaitGroup
 wg.Add(1)
 go func(){defer wg.Done(); for n:=2;n<100000;n++ {st.Grow(n)}}()
 for i:=0;i<100000;i++ {_=st.WaitFor(context.Background(),-1,nil)}
 wg.Wait()
}

```

### Fuentes técnicas verificadas

- [Contextos GORM](https://gorm.io/docs/context.html): `WithContext` es la API usada en O-02.
- [SQLite WAL](https://www.sqlite.org/wal.html) y [aislamiento](https://www.sqlite.org/isolation.html): WAL no elimina la restricción de un escritor simultáneo; fundamento para conservar el pool hasta medirlo.
- [singleflight](https://pkg.go.dev/golang.org/x/sync/singleflight): contrato del deduplicador ya presente en varias rutas.

### Artefactos y estado

Patch propuesto, sin aplicar: `backend-2026-10-25-propuesta.patch`. Incluye los cambios mostrados y las tres regresiones de overlay. Revisar antes de aplicar; no ejecutar automáticamente contra una base real.

### Evidencia obtenida en esta auditoría

Estado original, sin modificaciones de producción:

- `go vet ./...`: PASS.
- `go test ./... -short`: PASS; varios paquetes aprovecharon caché de Go.
- `go build -o <directorio temporal>/kamehouse-server.exe .`: PASS.
- Regresión de migración: FAIL esperado, `migration returned success for corrupt JSON` y `DATA LOSS: legacy table dropped after invalid JSON`.
- Regresión de mappings: FAIL esperado, `stale MAL mapping: got 10 want 20`.
- Regresión concurrente: FAIL esperado con `WARNING: DATA RACE`, escritura en `segment.go:48` y lectura en `segment.go:106`.

Propuesta preparada exclusivamente en archivos temporales y seleccionada con `-overlay`:

- Pruebas `-short` de database/db, handlers, library/scanner, mediastream, mediastream/cassette y drive: PASS.
- Las tres regresiones nuevas ejecutadas con `-race`: PASS.
- `go vet -overlay <propuesta> ./...`: PASS.
- `git apply --check --ignore-space-change -- docs/auditoria/backend-2026-10-25-propuesta.patch`, desde la raíz del repo: PASS. Se necesita tolerancia de whitespace por los finales de línea del checkout Windows; el patch no se aplicó.

No se ejecutó `go test ./...` sin `-short`, ni una prueba de carga real, ni una migración sobre la biblioteca del usuario. Los tests de cancelación de apertura compartida, panic de migraciones y límites de mappings descritos en el plan aún deben añadirse como regresiones permanentes. Pasar las pruebas existentes no sustituye esos casos.
