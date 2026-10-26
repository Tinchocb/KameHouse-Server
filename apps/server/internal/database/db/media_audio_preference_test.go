package db

import (
	"context"
	"kamehouse/internal/database/models"
	"kamehouse/internal/util"
	"testing"
)

func TestAudioPreferenceSetAndClear(t *testing.T) {
	logger := util.NewLogger()
	database, err := NewDatabase(context.Background(), t.TempDir(), "audio_pref_test", logger)
	if err != nil {
		t.Fatalf("Failed to create test database: %v", err)
	}
	defer database.Close()
	defer database.Shutdown()

	if err := database.SetAudioPreference(10, "latino"); err != nil {
		t.Fatalf("set latino: %v", err)
	}
	if err := database.SetAudioPreference(20, "japanese"); err != nil {
		t.Fatalf("set japanese: %v", err)
	}
	if err := database.SetAudioPreference(10, "english"); err != nil {
		t.Fatalf("update: %v", err)
	}

	rows, err := database.GetAudioPreferences()
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	if len(rows) != 2 || rows[0].MediaID != 10 || rows[0].AudioProfile != "english" || rows[1].AudioProfile != "japanese" {
		t.Fatalf("unexpected rows after upsert: %+v", rows)
	}

	// Vaciar el perfil borra la fila: la serie vuelve al global.
	if err := database.SetAudioPreference(10, ""); err != nil {
		t.Fatalf("clear: %v", err)
	}
	rows, _ = database.GetAudioPreferences()
	if len(rows) != 1 || rows[0].MediaID != 20 {
		t.Fatalf("clearing must remove only that series, got %+v", rows)
	}
}

func TestAudioProfileValidation(t *testing.T) {
	for _, p := range []string{"latino", "castellano", "japanese", "english", "auto"} {
		if !IsValidAudioProfile(p) {
			t.Errorf("%q must be valid", p)
		}
	}
	for _, p := range []string{"", "spanish", "Latino"} {
		if IsValidAudioProfile(p) {
			t.Errorf("%q must not be valid", p)
		}
	}
}

// Dragon Ball Daima se siembra una vez, cuando la serie ya está en la biblioteca. Una
// vez sembrada, borrar la preferencia del usuario no la vuelve a crear.
func TestSeedDaimaAudioProfileOnce(t *testing.T) {
	logger := util.NewLogger()
	database, err := NewDatabase(context.Background(), t.TempDir(), "daima_seed_test", logger)
	if err != nil {
		t.Fatalf("Failed to create test database: %v", err)
	}
	defer database.Close()
	defer database.Shutdown()

	// Sin Daima en la biblioteca no hay nada que sembrar, y la migración queda pendiente.
	seedDaimaAudioProfile(database, logger)
	if rows, _ := database.GetAudioPreferences(); len(rows) != 0 {
		t.Fatalf("no Daima in the library: nothing to seed, got %+v", rows)
	}

	daima := models.LibraryMedia{TmdbID: daimaTmdbID, Type: "SHOW"}
	daima.ID = 7
	if err := database.Gorm().Create(&daima).Error; err != nil {
		t.Fatalf("insert Daima: %v", err)
	}
	seedDaimaAudioProfile(database, logger)
	rows, _ := database.GetAudioPreferences()
	if len(rows) != 1 || rows[0].MediaID != 7 || rows[0].AudioProfile != "japanese" {
		t.Fatalf("Daima must be seeded as japanese, got %+v", rows)
	}

	if err := database.SetAudioPreference(7, ""); err != nil {
		t.Fatalf("clear: %v", err)
	}
	seedDaimaAudioProfile(database, logger)
	if rows, _ := database.GetAudioPreferences(); len(rows) != 0 {
		t.Fatalf("a seeded preference the user cleared must not come back, got %+v", rows)
	}
}
