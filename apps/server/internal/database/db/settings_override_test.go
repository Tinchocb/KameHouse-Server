package db

import (
	"testing"

	"kamehouse/internal/database/models"
)

// Los overrides de entorno se ven en GetSettings pero nunca llegan a la base:
// antes se escribían sobre el puntero cacheado y el siguiente guardado de
// ajustes los persistía como si los hubiera escrito el usuario.
func TestSettingsOverrideNoSePersiste(t *testing.T) {
	db := openSettingsTestDB(t)

	if _, err := db.GetSettings(); err != nil { // crea la fila
		t.Fatal(err)
	}
	db.SetSettingsOverride(func(s *models.Settings) { s.Library.TmdbApiKey = "token-de-entorno" })

	eff, err := db.GetSettings()
	if err != nil || eff.Library.TmdbApiKey != "token-de-entorno" {
		t.Fatalf("GetSettings debía traer el override: err=%v key=%q", err, eff.Library.TmdbApiKey)
	}
	stored, err := db.GetStoredSettings()
	if err != nil || stored.Library.TmdbApiKey != "" {
		t.Fatalf("GetStoredSettings no debía traer el override: err=%v key=%q", err, stored.Library.TmdbApiKey)
	}

	// Guardar cualquier ajuste desde lo guardado no arrastra el override a la base.
	next := *stored
	next.Library.AutoScan = true
	if _, err := db.UpsertSettings(&next); err != nil {
		t.Fatal(err)
	}
	var row models.Settings
	if err := db.gormdb.First(&row, 1).Error; err != nil {
		t.Fatal(err)
	}
	if row.Library.TmdbApiKey != "" {
		t.Fatalf("el token de entorno se persistió en la base: %q", row.Library.TmdbApiKey)
	}
	if !row.Library.AutoScan {
		t.Fatal("el cambio real (AutoScan) no se guardó")
	}

	// Tras guardar, la vista efectiva se recalcula: cambio nuevo + override.
	eff, _ = db.GetSettings()
	if !eff.Library.AutoScan || eff.Library.TmdbApiKey != "token-de-entorno" {
		t.Fatalf("la vista efectiva quedó desactualizada: autoScan=%v key=%q", eff.Library.AutoScan, eff.Library.TmdbApiKey)
	}
}
