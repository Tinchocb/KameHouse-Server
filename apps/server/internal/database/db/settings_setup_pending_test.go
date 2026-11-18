package db

import (
	"context"
	"testing"

	"kamehouse/internal/database/models"

	"github.com/rs/zerolog"
)

// El asistente de primer arranque depende de setup_pending: la fila nueva nace
// pendiente y guardarla la cierra.
func TestSetupPendingNuevaFilaGuardadoYMigracion(t *testing.T) {
	l := zerolog.Nop()
	database, err := NewDatabase(context.Background(), t.TempDir(), "setup_pending", &l)
	if err != nil {
		t.Fatalf("NewDatabase: %v", err)
	}
	t.Cleanup(func() {
		database.Shutdown()
		_ = database.Close()
	})

	// Lee el valor directamente de la base, no de la caché de ajustes.
	stored := func() bool {
		t.Helper()
		var pending bool
		if err := database.Gorm().Raw("SELECT setup_pending FROM settings WHERE id = 1").Scan(&pending).Error; err != nil {
			t.Fatalf("leer setup_pending: %v", err)
		}
		return pending
	}

	// 1. Primer arranque: GetStoredSettings crea la fila y queda pendiente.
	first, err := database.GetStoredSettings()
	if err != nil {
		t.Fatalf("GetStoredSettings: %v", err)
	}
	if !first.SetupPending || !stored() {
		t.Fatalf("fila nueva: SetupPending=%v, en base=%v; se esperaba pendiente", first.SetupPending, stored())
	}

	// 2. Guardar con SetupPending=false (lo que hace el asistente) debe persistirse:
	// UpsertSettings usa Save, así que el valor cero también se escribe.
	done := *first
	done.SetupPending = false
	if _, err := database.UpsertSettings(&done); err != nil {
		t.Fatalf("UpsertSettings: %v", err)
	}
	if stored() {
		t.Fatal("tras guardar el asistente, setup_pending debía quedar en false en la base")
	}

	// 3. Solo AutoMigrate: el DEFAULT false deja las filas existentes en false. La decisión
	// de la migración para filas vacías se prueba en settings_setup_pending_migration_test.go.
	if err := database.Gorm().Migrator().DropColumn(&models.Settings{}, "setup_pending"); err != nil {
		t.Fatalf("DropColumn: %v", err)
	}
	if err := database.Gorm().AutoMigrate(&models.Settings{}); err != nil {
		t.Fatalf("AutoMigrate: %v", err)
	}
	if stored() {
		t.Fatal("AutoMigrate sola no debe dejar la fila pendiente")
	}
}
