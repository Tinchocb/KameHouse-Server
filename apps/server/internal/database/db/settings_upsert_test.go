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

func openSettingsTestDB(t *testing.T) *Database {
	t.Helper()
	logger := util.NewLogger()
	g, err := gorm.Open(sqlite.Open(filepath.Join(t.TempDir(), "settings.db")), &gorm.Config{})
	if err != nil {
		t.Fatalf("abrir base: %v", err)
	}
	t.Cleanup(func() {
		if sqlDB, err := g.DB(); err == nil {
			_ = sqlDB.Close()
		}
	})
	if err := migrateSchema(context.Background(), g, logger); err != nil {
		t.Fatalf("migrateSchema: %v", err)
	}
	return &Database{gormdb: g, Logger: logger}
}

// Regresión: Create+OnConflict reemplazaba los false por el `default:true` del
// tag GORM, así que apagar "Ocultar subtítulos si el audio está doblado" o el
// "Gobernador térmico" no se guardaba: al recargar volvían a estar encendidos.
func TestUpsertSettingsGuardaFalseEnCamposConDefaultTrue(t *testing.T) {
	db := openSettingsTestDB(t)

	s, err := db.GetSettings() // crea la fila con los defaults
	if err != nil || !s.Library.AutoDisableSubtitlesWhenDubbed {
		t.Fatalf("fila inicial: err=%v autoDisable=%v", err, s != nil && s.Library.AutoDisableSubtitlesWhenDubbed)
	}
	next := *s
	next.Library.AutoDisableSubtitlesWhenDubbed = false
	if _, err := db.UpsertSettings(&next); err != nil {
		t.Fatalf("UpsertSettings: %v", err)
	}
	var stored models.Settings
	if err := db.gormdb.First(&stored, 1).Error; err != nil {
		t.Fatal(err)
	}
	if stored.Library.AutoDisableSubtitlesWhenDubbed {
		t.Fatal("autoDisableSubtitlesWhenDubbed=false no se guardó")
	}

	ms := &models.MediastreamSettings{BaseModel: models.BaseModel{ID: 1}, AutoGovernorEnabled: true}
	if _, err := db.UpsertMediastreamSettings(ms); err != nil {
		t.Fatal(err)
	}
	ms2 := *ms
	ms2.AutoGovernorEnabled = false
	if _, err := db.UpsertMediastreamSettings(&ms2); err != nil {
		t.Fatal(err)
	}
	var storedMs models.MediastreamSettings
	if err := db.gormdb.First(&storedMs, 1).Error; err != nil {
		t.Fatal(err)
	}
	if storedMs.AutoGovernorEnabled {
		t.Fatal("autoGovernorEnabled=false no se guardó")
	}
	// Una sola fila: Save actualizó la existente en vez de insertar otra.
	var n int64
	db.gormdb.Model(&models.MediastreamSettings{}).Count(&n)
	if n != 1 {
		t.Fatalf("filas de mediastream = %d, se esperaba 1", n)
	}
}
