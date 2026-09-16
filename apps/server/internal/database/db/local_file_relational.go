package db

import (
	"fmt"

	"github.com/goccy/go-json"
	"kamehouse/internal/database/models"
	"kamehouse/internal/database/models/dto"
	"strings"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// localFileUpsertColumns lists every data column refreshed on path-conflict
// upserts. `id` and `created_at` are deliberately excluded so rescans never
// rewrite the original creation timestamp (UpdateAll:true used to clobber it).
var localFileUpsertColumns = []string{
	"name", "file_hash", "file_size", "file_mod_time", "locked", "ignored",
	"library_media_id", "media_id", "parsed_data", "parsed_folder_data",
	"embedded_metadata", "metadata", "technical_info", "tags", "updated_at",
}

// escapeLikePattern escapes SQLite LIKE wildcards so a library path containing
// `%`, `_` or `\` matches literally instead of acting as a wildcard.
func escapeLikePattern(s string) string {
	s = strings.ReplaceAll(s, "\\", "\\\\")
	s = strings.ReplaceAll(s, "%", "\\%")
	s = strings.ReplaceAll(s, "_", "\\_")
	return s
}

// GetAllLocalFilesRelational retrieves all local files from the relational table.
// Accepts optional page/perPage for pagination; if both 0, returns all (legacy compat).
func GetAllLocalFilesRelational(d *Database) ([]*dto.LocalFile, error) {
	query := d.gormdb.Order("id asc")

	var dbFiles []*models.LocalFile
	err := query.Find(&dbFiles).Error
	if err != nil {
		return nil, err
	}

	res := make([]*dto.LocalFile, len(dbFiles))
	for i, dbf := range dbFiles {
		conv, err := LocalFileModelToDto(dbf)
		if err != nil {
			// Una fila corrupta no debe tumbar todo el listado: se conserva la
			// fila con los campos escalares y se registra el problema.
			d.Logger.Warn().Err(err).Str("path", dbf.Path).Msg("db: Skipping corrupt JSON fields in local file row")
			conv = &dto.LocalFile{
				Path: dbf.Path, Name: dbf.Name, FileHash: dbf.FileHash,
				Locked: dbf.Locked, Ignored: dbf.Ignored,
				LibraryMediaId: dbf.LibraryMediaId, MediaID: dbf.MediaID,
				FileSize: dbf.FileSize, FileModTime: dbf.FileModTime,
			}
		}
		res[i] = conv
	}
	return res, nil
}

// GetLocalFilesByMediaIDRelational retrieves all local files for a specific media ID.
// GetLibraryMediaByExternalMediaID resuelve el LibraryMedia a partir del mediaId
// EXTERNO (derivado de TMDB) con el que se indexan la API, local_file.media_id y
// episode_skip_times.media_id.
//
// Ese id NO es la PK de library_media: los dos espacios de ids no se solapan, así
// que un `Where("id = ?", mediaID)` sobre library_media devuelve siempre
// ErrRecordNotFound. Como ese "not found" suele tratarse como "esta media no
// tiene mapeo" en vez de como un bug, la feature que dependa de él se apaga en
// silencio (le pasó al Método A de skipdetect y a HandleResolveMAL). Resolvemos
// por la FK library_media_id de los archivos locales, que vale igual para series
// y para películas (cuyo id externo va prefijado).
//
// Devuelve ErrRecordNotFound si la media no está en la librería local.
func GetLibraryMediaByExternalMediaID(d *Database, mediaID int) (*models.LibraryMedia, error) {
	var libraryMediaID uint
	if err := d.gormdb.Model(&models.LocalFile{}).
		Select("library_media_id").
		Where("media_id = ? AND library_media_id > 0", mediaID).
		Limit(1).
		Pluck("library_media_id", &libraryMediaID).Error; err != nil {
		return nil, err
	}

	var lm models.LibraryMedia
	if err := d.gormdb.Where("id = ?", libraryMediaID).First(&lm).Error; err != nil {
		return nil, err
	}
	return &lm, nil
}

func GetLocalFilesByMediaIDRelational(d *Database, mediaID int) ([]*dto.LocalFile, error) {
	var dbFiles []*models.LocalFile
	err := d.gormdb.Where("media_id = ?", mediaID).Find(&dbFiles).Error
	if err != nil {
		return nil, err
	}

	res := make([]*dto.LocalFile, len(dbFiles))
	for i, dbf := range dbFiles {
		conv, err := LocalFileModelToDto(dbf)
		if err != nil {
			d.Logger.Warn().Err(err).Str("path", dbf.Path).Msg("db: Skipping corrupt JSON fields in local file row")
			conv = &dto.LocalFile{
				Path: dbf.Path, Name: dbf.Name, FileHash: dbf.FileHash,
				Locked: dbf.Locked, Ignored: dbf.Ignored,
				LibraryMediaId: dbf.LibraryMediaId, MediaID: dbf.MediaID,
				FileSize: dbf.FileSize, FileModTime: dbf.FileModTime,
			}
		}
		res[i] = conv
	}
	return res, nil
}

// UpsertLocalFileRelationalBatch inserts or updates a slice of LocalFiles in the relational table.
func UpsertLocalFileRelationalBatch(d *Database, files []*dto.LocalFile) error {
	if len(files) == 0 {
		return nil
	}

	dbFiles := make([]*models.LocalFile, len(files))
	for i, f := range files {
		m, err := LocalFileDtoToModel(f)
		if err != nil {
			return fmt.Errorf("upsert local file %q: %w", f.Path, err)
		}
		dbFiles[i] = m
	}

	err := d.gormdb.Transaction(func(tx *gorm.DB) error {
		return tx.Clauses(clause.OnConflict{
			Columns:   []clause.Column{{Name: "path"}},
			DoUpdates: clause.AssignmentColumns(localFileUpsertColumns),
		}).CreateInBatches(dbFiles, 60).Error
	})
	if err != nil {
		return err
	}
	InvalidateLocalFilesCache()
	return nil
}

// SyncLocalFilesRelational performs a full sync: upserts the given files and deletes any other file in the DB.
func SyncLocalFilesRelational(d *Database, files []*dto.LocalFile) error {
	if len(files) == 0 {
		return nil // Safety guard: scan returning 0 files must not wipe database
	}

	paths := make([]string, len(files))
	for i, f := range files {
		paths[i] = f.Path
	}

	err := d.gormdb.Transaction(func(tx *gorm.DB) error {
		// 1. Upsert files in batches
		dbModels := make([]*models.LocalFile, len(files))
		for i, f := range files {
			m, err := LocalFileDtoToModel(f)
			if err != nil {
				return fmt.Errorf("sync local file %q: %w", f.Path, err)
			}
			dbModels[i] = m
		}
		if err := tx.Clauses(clause.OnConflict{
			Columns:   []clause.Column{{Name: "path"}},
			DoUpdates: clause.AssignmentColumns(localFileUpsertColumns),
		}).CreateInBatches(dbModels, 100).Error; err != nil {
			return err
		}

		// 2. Delete files that are no longer present
		if len(paths) < 950 {
			return tx.Where("path NOT IN ?", paths).Delete(&models.LocalFile{}).Error
		}

		// For larger libraries, use a temporary table to avoid SQLite's variable limit (SQLITE_MAX_VARIABLE_NUMBER)
		d.Logger.Info().Int("count", len(paths)).Msg("db: Library large, using temporary table for sync")

		if err := tx.Exec("CREATE TEMPORARY TABLE IF NOT EXISTS sync_paths (path TEXT PRIMARY KEY)").Error; err != nil {
			return err
		}
		// Ensure clean state
		if err := tx.Exec("DELETE FROM sync_paths").Error; err != nil {
			return err
		}

		// Insert paths in batches of 500 (safe for single-column inserts)
		for i := 0; i < len(paths); i += 500 {
			end := i + 500
			if end > len(paths) {
				end = len(paths)
			}
			batch := paths[i:end]

			placeholders := make([]string, len(batch))
			vals := make([]interface{}, len(batch))
			for j, p := range batch {
				placeholders[j] = "?"
				vals[j] = p
			}
			sql := "INSERT INTO sync_paths (path) VALUES (" + strings.Join(placeholders, "),(") + ")"
			if err := tx.Exec(sql, vals...).Error; err != nil {
				return err
			}
		}

		// Delete files not in the temporary table. The project uses the literal
		// table name "local_file" (mapped from models.LocalFile via default GORM
		// convention). If a custom NamingStrategy is ever applied, the migration
		// paths must be updated accordingly.
		if err := tx.Exec("DELETE FROM local_file WHERE path NOT IN (SELECT path FROM sync_paths)").Error; err != nil {
			return err
		}


		// Cleanup
		return tx.Exec("DROP TABLE sync_paths").Error
	})
	if err != nil {
		return err
	}
	InvalidateLocalFilesCache()
	return nil
}

// SyncPartialLocalFilesRelational performs a partial sync: upserts given files and deletes missing files ONLY within targeted paths.
func SyncPartialLocalFilesRelational(d *Database, files []*dto.LocalFile, targetPaths []string) error {
	if len(files) == 0 {
		return nil
	}
	if len(targetPaths) == 0 {
		return SyncLocalFilesRelational(d, files)
	}

	err := UpsertLocalFileRelationalBatch(d, files)
	if err != nil {
		return err
	}

	newPaths := make([]string, len(files))
	for i, f := range files {
		newPaths[i] = f.Path
	}

	// Create a query to delete files that belong to targetPaths but were not found in this scan
	// Chunk NOT IN to avoid SQLite variable limit (999).
	if len(newPaths) == 0 {
		return nil
	}
	chunkSize := 500
	var lastErr error
	for i := 0; i < len(newPaths); i += chunkSize {
		end := i + chunkSize
		if end > len(newPaths) {
			end = len(newPaths)
		}
		chunk := newPaths[i:end]

		query := d.gormdb.Model(&models.LocalFile{}).Where("path NOT IN ?", chunk)

		if len(targetPaths) > 0 {
			pathGroup := d.gormdb.Where("path LIKE ? ESCAPE '\\'", escapeLikePattern(targetPaths[0])+"%")
			for _, target := range targetPaths[1:] {
				pathGroup = pathGroup.Or("path LIKE ? ESCAPE '\\'", escapeLikePattern(target)+"%")
			}
			query = query.Where(pathGroup)
		}

		if err := query.Delete(&models.LocalFile{}).Error; err != nil {
			lastErr = err
		}
	}
	if lastErr != nil {
		return lastErr
	}
	InvalidateLocalFilesCache()
	return nil
}

// UpdateSingleLocalFileRelational actualiza un único archivo local en SQLite sin re-escribir toda la tabla.
// Devuelve (true, nil) si la fila existía y fue actualizada, (false, nil) si
// no había fila con ese path (el caller decide si insertar).
func UpdateSingleLocalFileRelational(d *Database, f *dto.LocalFile) (bool, error) {
	if f == nil || f.Path == "" {
		return false, nil
	}
	m, err := LocalFileDtoToModel(f)
	if err != nil {
		return false, fmt.Errorf("update local file %q: %w", f.Path, err)
	}
	res := d.gormdb.Model(&models.LocalFile{}).Where("path = ?", f.Path).Updates(map[string]interface{}{
		"name":               m.Name,
		"file_hash":          m.FileHash,
		"locked":             m.Locked,
		"ignored":            m.Ignored,
		"library_media_id":   m.LibraryMediaId,
		"media_id":           m.MediaID,
		"file_size":          m.FileSize,
		"file_mod_time":      m.FileModTime,
		"parsed_data":        m.ParsedData,
		"parsed_folder_data": m.ParsedFolderData,
		"embedded_metadata":  m.EmbeddedMetadata,
		"metadata":           m.Metadata,
		"technical_info":     m.TechnicalInfo,
	})
	if res.Error != nil {
		return false, res.Error
	}
	if res.RowsAffected == 0 {
		return false, nil
	}
	InvalidateLocalFilesCache()
	return true, nil
}

// DeleteLocalFilesRelationalByPaths removes local files with the given paths.
func DeleteLocalFilesRelationalByPaths(d *Database, paths []string) error {
	if len(paths) == 0 {
		return nil
	}
	for i := 0; i < len(paths); i += 500 {
		end := i + 500
		if end > len(paths) {
			end = len(paths)
		}
		chunk := paths[i:end]
		err := d.gormdb.Where("path IN ?", chunk).Delete(&models.LocalFile{}).Error
		if err != nil {
			return err
		}
	}
	InvalidateLocalFilesCache()
	return nil
}

// ─────────────────────────────────────────────────────────────────────────────
// Converters
// ─────────────────────────────────────────────────────────────────────────────

func LocalFileDtoToModel(f *dto.LocalFile) (*models.LocalFile, error) {
	m := &models.LocalFile{
		Path:           f.Path,
		Name:           f.Name,
		FileHash:       f.FileHash,
		Locked:         f.Locked,
		Ignored:        f.Ignored,
		LibraryMediaId: f.LibraryMediaId,
		MediaID:        f.MediaID,
		FileSize:       f.FileSize,
		FileModTime:    f.FileModTime,
	}

	if f.ParsedData != nil {
		raw, err := json.Marshal(f.ParsedData)
		if err != nil {
			return nil, fmt.Errorf("marshal ParsedData: %w", err)
		}
		m.ParsedData = raw
	}
	if f.ParsedFolderData != nil {
		raw, err := json.Marshal(f.ParsedFolderData)
		if err != nil {
			return nil, fmt.Errorf("marshal ParsedFolderData: %w", err)
		}
		m.ParsedFolderData = raw
	}
	if f.EmbeddedMetadata != nil {
		raw, err := json.Marshal(f.EmbeddedMetadata)
		if err != nil {
			return nil, fmt.Errorf("marshal EmbeddedMetadata: %w", err)
		}
		m.EmbeddedMetadata = raw
	}
	if f.Metadata != nil {
		raw, err := json.Marshal(f.Metadata)
		if err != nil {
			return nil, fmt.Errorf("marshal Metadata: %w", err)
		}
		m.Metadata = raw
	}
	if f.TechnicalInfo != nil {
		raw, err := json.Marshal(f.TechnicalInfo)
		if err != nil {
			return nil, fmt.Errorf("marshal TechnicalInfo: %w", err)
		}
		m.TechnicalInfo = raw
	}

	return m, nil
}

func LocalFileModelToDto(m *models.LocalFile) (*dto.LocalFile, error) {
	f := &dto.LocalFile{
		Path:           m.Path,
		Name:           m.Name,
		FileHash:       m.FileHash,
		Locked:         m.Locked,
		Ignored:        m.Ignored,
		LibraryMediaId: m.LibraryMediaId,
		MediaID:        m.MediaID,
		FileSize:       m.FileSize,
		FileModTime:    m.FileModTime,
	}

	if len(m.ParsedData) > 0 {
		if err := json.Unmarshal(m.ParsedData, &f.ParsedData); err != nil {
			return nil, fmt.Errorf("unmarshal ParsedData: %w", err)
		}
	}
	if len(m.ParsedFolderData) > 0 {
		if err := json.Unmarshal(m.ParsedFolderData, &f.ParsedFolderData); err != nil {
			return nil, fmt.Errorf("unmarshal ParsedFolderData: %w", err)
		}
	}
	if len(m.EmbeddedMetadata) > 0 {
		if err := json.Unmarshal(m.EmbeddedMetadata, &f.EmbeddedMetadata); err != nil {
			return nil, fmt.Errorf("unmarshal EmbeddedMetadata: %w", err)
		}
	}
	if len(m.Metadata) > 0 {
		if err := json.Unmarshal(m.Metadata, &f.Metadata); err != nil {
			return nil, fmt.Errorf("unmarshal Metadata: %w", err)
		}
	}
	if len(m.TechnicalInfo) > 0 {
		if err := json.Unmarshal(m.TechnicalInfo, &f.TechnicalInfo); err != nil {
			return nil, fmt.Errorf("unmarshal TechnicalInfo: %w", err)
		}
	}

	return f, nil
}
