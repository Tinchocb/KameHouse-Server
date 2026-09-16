package db

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"
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

	// Ensure all writes in buffer and slow logger are flushed
	if db.bufferedWriter != nil {
		db.bufferedWriter.Flush()
	}
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
	_ = os.Chmod(backupPath, 0600)

	// Validate integrity of the resulting backup
	var integrityResult string
	row := db.gormdb.Raw("PRAGMA integrity_check;").Row()
	if row != nil {
		if err := row.Scan(&integrityResult); err != nil || integrityResult != "ok" {
			db.Logger.Warn().Str("result", integrityResult).Msg("db: integrity_check warning on database")
		}
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
		_ = rotateBackups(backupDir, keep)
	}

	return res, nil
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

