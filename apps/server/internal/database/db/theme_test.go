package db

import (
	"context"
	"testing"

	"kamehouse/internal/database/models"
	"kamehouse/internal/util"
)

// Los campos de audio tienen `default:true`/`default:0.25` en el tag GORM:
// apagarlos (false / volumen 0) tiene que sobrevivir al upsert y a la relectura.
func TestUpsertThemePersistsZeroValues(t *testing.T) {
	database, err := NewDatabase(context.Background(), t.TempDir(), "test-theme", util.NewLogger())
	if err != nil {
		t.Fatalf("NewDatabase: %v", err)
	}
	t.Cleanup(func() { _ = database.Close() })

	on := &models.Theme{BaseModel: models.BaseModel{ID: 1}, BgMusicEnabled: true, UiSoundsEnabled: true, BgMusicVolume: 0.5}
	if _, err := database.UpsertTheme(on); err != nil {
		t.Fatalf("UpsertTheme(on): %v", err)
	}

	off := &models.Theme{BaseModel: models.BaseModel{ID: 1}, BgMusicEnabled: false, UiSoundsEnabled: false, BgMusicVolume: 0}
	if _, err := database.UpsertTheme(off); err != nil {
		t.Fatalf("UpsertTheme(off): %v", err)
	}

	themeCache.Store(nil) // forzar relectura desde SQLite
	got, err := database.GetTheme()
	if err != nil {
		t.Fatal(err)
	}
	if got.BgMusicEnabled || got.UiSoundsEnabled || got.BgMusicVolume != 0 {
		t.Errorf("tras apagar: bgMusic=%v uiSounds=%v volume=%v, want false/false/0",
			got.BgMusicEnabled, got.UiSoundsEnabled, got.BgMusicVolume)
	}
}
