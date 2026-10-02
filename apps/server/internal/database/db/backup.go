package db

import (
	"errors"
	"fmt"
	"net/url"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
	gormlogger "gorm.io/gorm/logger"
)

type BackupResult struct {
	Path      string    `json:"path"`
	SizeBytes int64     `json:"sizeBytes"`
	CreatedAt time.Time `json:"createdAt"`
}

// Backup creates a vacuumed copy of the database.
func (db *Database) Backup(backupDir string, keep int) (*BackupResult, error) {
	if db.sqlitePath == ":memory:" || db.sqlitePath == "" {
		return nil, errors.New("cannot backup in-memory database")
	}

	if err := os.MkdirAll(backupDir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create backup dir: %w", err)
	}

	timestamp := time.Now().Format("2006-01-02_15-04-05")
	backupFileName := fmt.Sprintf("kamehouse-backup-%s.db", timestamp)
	backupPath := filepath.Join(backupDir, backupFileName)

	if db.slowTraceLogger != nil {
		db.slowTraceLogger.Flush()
	}

	// Ensure all writes are flushed to DB file via truncate checkpoint
	if err := db.gormdb.Exec("PRAGMA wal_checkpoint(TRUNCATE);").Error; err != nil {
		db.Logger.Error().Err(err).Msg("db: WAL checkpoint failed before backup")
		return nil, fmt.Errorf("pre-backup WAL checkpoint failed: %w", err)
	}

	// Escape single quotes for SQLite literal
	escapedPath := strings.ReplaceAll(backupPath, "'", "''")
	query := fmt.Sprintf("VACUUM INTO '%s'", escapedPath)
	if err := db.gormdb.Exec(query).Error; err != nil {
		return nil, fmt.Errorf("VACUUM INTO failed: %w", err)
	}

	// Enforce 0600 permissions on the created backup file
	if err := os.Chmod(backupPath, 0600); err != nil {
		db.Logger.Warn().Err(err).Str("path", backupPath).Msg("db: could not restrict backup file permissions")
	}

	// Validar el archivo recién creado (no la base en uso): un backup corrupto
	// se descarta antes de rotar, para que no desplace a uno bueno.
	if err := verifyBackupIntegrity(backupPath); err != nil {
		db.Logger.Error().Err(err).Str("path", backupPath).Msg("db: backup failed integrity check; discarding it")
		_ = os.Remove(backupPath)
		return nil, fmt.Errorf("backup integrity check failed: %w", err)
	}

	info, err := os.Stat(backupPath)
	if err != nil {
		return nil, fmt.Errorf("failed to stat backup file: %w", err)
	}

	res := &BackupResult{
		Path:      backupPath,
		SizeBytes: info.Size(),
		CreatedAt: time.Now(),
	}

	if keep > 0 {
		if err := rotateBackups(backupDir, keep); err != nil {
			db.Logger.Warn().Err(err).Msg("db: backup rotation failed; old backups were not pruned")
		}
	}

	return res, nil
}

// verifyBackupIntegrity abre el archivo de backup en solo lectura y corre
// PRAGMA integrity_check sobre él.
func verifyBackupIntegrity(path string) error {
	dsn := (&url.URL{Scheme: "file", Opaque: filepath.ToSlash(path), RawQuery: "mode=ro"}).String()
	g, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{Logger: gormlogger.Discard})
	if err != nil {
		return fmt.Errorf("open backup: %w", err)
	}
	sqlDB, err := g.DB()
	if err != nil {
		return fmt.Errorf("open backup: %w", err)
	}
	defer sqlDB.Close()

	var result string
	if err := g.Raw("PRAGMA integrity_check;").Row().Scan(&result); err != nil {
		return fmt.Errorf("integrity_check: %w", err)
	}
	if result != "ok" {
		return fmt.Errorf("integrity_check reported: %s", result)
	}
	return nil
}

func rotateBackups(backupDir string, keep int) error {
	entries, err := os.ReadDir(backupDir)
	if err != nil {
		return err
	}

	var backups []string
	const backupPrefix = "kamehouse-backup-"
	for _, entry := range entries {
		if !entry.IsDir() && strings.HasPrefix(entry.Name(), backupPrefix) && filepath.Ext(entry.Name()) == ".db" {
			backups = append(backups, entry.Name())
		}
	}

	if len(backups) <= keep {
		return nil
	}

	// Sort descending by name (which has timestamp)
	sort.Slice(backups, func(i, j int) bool {
		return backups[i] > backups[j]
	})

	for i := keep; i < len(backups); i++ {
		_ = os.Remove(filepath.Join(backupDir, backups[i]))
	}

	return nil
}
