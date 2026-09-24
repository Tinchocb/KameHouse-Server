package db

import (
	"context"
	"path/filepath"
	"testing"

	"kamehouse/internal/database/models"
	"kamehouse/internal/util"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

// Bases antiguas tienen idx_media_episode sobre library_media_id. La migración
// debe recrearlo sobre media_id; si no, todo upsert del historial falla con
// "ON CONFLICT clause does not match any PRIMARY KEY or UNIQUE constraint".
func TestMigrateSchemaRecreaIndiceHeredadoDeWatchHistory(t *testing.T) {
	dir := t.TempDir()
	logger := util.NewLogger()

	legacy, err := gorm.Open(sqlite.Open(filepath.Join(dir, "legacy.db")), &gorm.Config{})
	if err != nil {
		t.Fatalf("abrir base: %v", err)
	}
	t.Cleanup(func() {
		// En Windows, TempDir no puede borrar un .db abierto.
		if sqlDB, err := legacy.DB(); err == nil {
			_ = sqlDB.Close()
		}
	})
	for _, stmt := range []string{
		"CREATE TABLE `watch_histories` (`id` integer PRIMARY KEY AUTOINCREMENT,`created_at` datetime,`updated_at` datetime,`account_id` integer,`media_id` integer,`episode_number` integer,`current_time` real,`duration` real,`library_media_id` integer)",
		"CREATE UNIQUE INDEX `idx_media_episode` ON `watch_histories`(`account_id`,`library_media_id`,`episode_number`)",
	} {
		if err := legacy.Exec(stmt).Error; err != nil {
			t.Fatalf("preparar esquema heredado: %v", err)
		}
	}
	if indexHasColumns(legacy, "idx_media_episode", "account_id", "media_id", "episode_number") {
		t.Fatal("el índice heredado no debería coincidir con las columnas nuevas")
	}

	if err := migrateSchema(context.Background(), legacy, logger); err != nil {
		t.Fatalf("migrateSchema: %v", err)
	}
	if !indexHasColumns(legacy, "idx_media_episode", "account_id", "media_id", "episode_number") {
		t.Fatal("la migración debe recrear idx_media_episode sobre (account_id, media_id, episode_number)")
	}

	repo := &WatchHistoryRepository{DB: legacy}
	item := models.WatchHistory{MediaID: 12971, EpisodeNumber: 1, CurrentTime: 10, Duration: 1400}
	if err := repo.UpsertBatch([]models.WatchHistory{item}); err != nil {
		t.Fatalf("primer upsert: %v", err)
	}
	item.CurrentTime = 42
	if err := repo.UpsertBatch([]models.WatchHistory{item}); err != nil {
		t.Fatalf("segundo upsert (conflicto): %v", err)
	}

	var rows []models.WatchHistory
	legacy.Where("media_id = ? AND episode_number = ?", 12971, 1).Find(&rows)
	if len(rows) != 1 || rows[0].CurrentTime != 42 {
		t.Fatalf("se esperaba una fila con current_time=42, llegó %+v", rows)
	}
}
