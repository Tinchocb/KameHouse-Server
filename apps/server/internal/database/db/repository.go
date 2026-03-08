package db

// ─────────────────────────────────────────────────────────────────────
// DTO Boundary Interfaces
// ─────────────────────────────────────────────────────────────────────
// These interfaces define the contract between the database layer and
// the API/handler layer, preventing direct coupling to GORM models.
//
// How it works:
//   - Database functions return domain models (package `models`)
//   - Handlers convert models → DTOs using mappers (package `dto`)
//   - These interfaces enforce the boundary so models don't leak
//     into API responses and vice versa
//
// Migration path:
//   1. New handler code calls repository methods that return models
//   2. Handler maps model → DTO before sending to client
//   3. Old code continues to work unchanged
// ─────────────────────────────────────────────────────────────────────

// LocalFileRepository abstracts local file persistence.
type LocalFileRepository interface {
	GetAll(dbInst *Database) ([]byte, error)
	Save(dbInst *Database, data []byte) error
}

// AutoDownloaderRuleRepository abstracts auto-downloader rule persistence.
type AutoDownloaderRuleRepository interface {
	GetAll(dbInst *Database) (interface{}, error)
	GetByID(dbInst *Database, id uint) (interface{}, error)
	GetByMediaID(dbInst *Database, mediaID int) (interface{}, error)
	Create(dbInst *Database, rule interface{}) error
	Update(dbInst *Database, rule interface{}) error
	Delete(dbInst *Database, id uint) error
}

// PlaylistRepository abstracts playlist persistence.
type PlaylistRepository interface {
	GetAll(dbInst *Database) (interface{}, error)
	GetByID(dbInst *Database, id uint) (interface{}, error)
	Create(dbInst *Database, playlist interface{}) error
	Update(dbInst *Database, playlist interface{}) error
	Delete(dbInst *Database, id uint) error
}

// SettingsRepository abstracts application settings persistence.
type SettingsRepository interface {
	Get(dbInst *Database) (interface{}, error)
	Save(dbInst *Database, settings interface{}) error
}

// ScanSummaryRepository abstracts scan summary persistence.
type ScanSummaryRepository interface {
	GetAll(dbInst *Database) (interface{}, error)
	GetLatest(dbInst *Database) (interface{}, error)
	Save(dbInst *Database, summary interface{}) error
}
