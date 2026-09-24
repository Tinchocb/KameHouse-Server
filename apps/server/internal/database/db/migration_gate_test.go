package db

import (
	"context"
	"kamehouse/internal/util"
	"testing"
)

// TestMigrationGateFailClosed verifica que las migraciones one-shot se omiten
// (fail closed) cuando la lectura del gate falla, en vez de re-ejecutarse y
// pisar elecciones del usuario o re-purgar filas.
func TestMigrationGateFailClosed(t *testing.T) {
	tempDir := t.TempDir()
	logger := util.NewLogger()

	database, err := NewDatabase(context.Background(), tempDir, "migration_gate_test", logger)
	if err != nil {
		t.Fatalf("Failed to create test database: %v", err)
	}

	// Cerrar el pool para forzar error en GetMetadataCache.
	if err := database.Close(); err != nil {
		t.Fatalf("Failed to close test database: %v", err)
	}

	// No debe entrar en pánico con la DB cerrada...
	migrateDefaultSettings(database, logger)
	migratePlaybackAndPerformanceDefaults(database, logger)
	purgeStaleSkipTimes(database, logger)

	// ...y el gate debe seguir sin marcar (se reintentará al próximo arranque).
	var done bool
	if ok, err := GetMetadataCache(database, "migrations", "default_auto_play_next_episode_v1", &done); err == nil && ok && done {
		t.Errorf("migration gate should not be marked when the gate read failed")
	}
}
