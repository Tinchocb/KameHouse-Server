package db

import (
	"github.com/rs/zerolog"
	"kamehouse/internal/constants"
	"kamehouse/internal/database/models"
	"testing"
)

func identityRegressionDB(t *testing.T) *Database {
	t.Helper()
	g := openBackendSafetyDB(t)
	if err := g.AutoMigrate(&models.LibraryMedia{}, &models.LocalFile{}, &models.LibraryEpisode{}, &models.LibrarySeason{}, &models.MediaEntryListData{}, &models.WatchHistory{}, &models.EpisodeSkipTime{}, &models.MediaFiller{}, &models.MetadataCache{}, &models.Settings{}, &models.MediastreamSettings{}); err != nil {
		t.Fatal(err)
	}
	logger := zerolog.Nop()
	return &Database{gormdb: g, Logger: &logger}
}
func TestPublicMediaIdentityNeverUsesCoincidentPrimaryKey(t *testing.T) {
	d := identityRegressionDB(t)
	rows := []models.LibraryMedia{
		{BaseModel: models.BaseModel{ID: 42}, Type: "SHOW", TmdbID: 9999},
		{BaseModel: models.BaseModel{ID: 7}, Type: "SHOW", TmdbID: 42},
		{BaseModel: models.BaseModel{ID: 8}, Type: "MOVIE", TmdbID: 42},
		{BaseModel: models.BaseModel{ID: 9}, Type: "ANIME", MyanimelistId: 123, TmdbID: 123},
	}
	if err := d.Gorm().Create(&rows).Error; err != nil {
		t.Fatal(err)
	}
	for _, tc := range []struct {
		public int
		want   uint
	}{{42, 7}, {42 + constants.MovieIDOffset, 8}, {123, 9}} {
		got, err := ResolveLibraryMediaByPublicID(d, tc.public)
		if err != nil || got == nil || got.ID != tc.want {
			t.Fatalf("public %d: got %+v err %v want PK %d", tc.public, got, err, tc.want)
		}
	}
	if err := d.Gorm().Create(&models.LocalFile{Path: "/library/nfo.mkv", MediaID: 777, LibraryMediaId: 7}).Error; err != nil {
		t.Fatal(err)
	}
	got, err := ResolveLibraryMediaByPublicID(d, 777)
	if err != nil || got == nil || got.ID != 7 {
		t.Fatalf("explicit link: %+v %v", got, err)
	}
	got, err = ResolveLibraryMediaByPublicID(d, 8)
	if err != nil || got != nil {
		t.Fatalf("unqualified PK accepted: %+v %v", got, err)
	}
}
func TestOrphanCleanupPreservesPublicIdentityState(t *testing.T) {
	d := identityRegressionDB(t)
	rows := []models.LibraryMedia{{BaseModel: models.BaseModel{ID: 42}, Type: "SHOW", TmdbID: 900}, {BaseModel: models.BaseModel{ID: 43}, Type: "MOVIE", TmdbID: 900}, {BaseModel: models.BaseModel{ID: 44}, Type: "SHOW", TmdbID: 42}}
	if err := d.Gorm().Create(&rows).Error; err != nil {
		t.Fatal(err)
	}
	if err := d.Gorm().Create(&models.LocalFile{Path: "/library/real.mkv", MediaID: 42, LibraryMediaId: 44}).Error; err != nil {
		t.Fatal(err)
	}
	for _, row := range []any{&models.WatchHistory{MediaID: 42, EpisodeNumber: 1}, &models.EpisodeSkipTime{MediaID: 42, EpisodeNumber: 1}, &models.MediaFiller{MediaID: 42}} {
		if err := d.Gorm().Create(row).Error; err != nil {
			t.Fatal(err)
		}
	}
	NewCleanupManager(d.Gorm(), d.Logger).removeOrphanedAndCollidedMedia()
	var count int64
	if err := d.Gorm().Model(&models.LibraryMedia{}).Where("id = 42").Count(&count).Error; err != nil || count != 0 {
		t.Fatalf("orphan not deleted: %d %v", count, err)
	}
	for _, model := range []any{&models.WatchHistory{}, &models.EpisodeSkipTime{}, &models.MediaFiller{}} {
		if err := d.Gorm().Model(model).Where("media_id = 42").Count(&count).Error; err != nil || count != 1 {
			t.Fatalf("public state lost for %T: %d %v", model, count, err)
		}
	}
}
func TestPlaybackDefaultsMigrationRollsBackAndRetries(t *testing.T) {
	d := identityRegressionDB(t)
	if err := d.Gorm().Create(&models.Settings{BaseModel: models.BaseModel{ID: 1}}).Error; err != nil {
		t.Fatal(err)
	}
	if err := d.Gorm().Create(&models.MediastreamSettings{BaseModel: models.BaseModel{ID: 1}}).Error; err != nil {
		t.Fatal(err)
	}
	for _, stmt := range []string{"UPDATE settings SET library_preferred_audio_profile = '', library_auto_disable_subtitles_when_dubbed = 0", "UPDATE mediastream_settings SET performance_profile = '', auto_governor_enabled = 0", "CREATE TRIGGER reject_governor BEFORE UPDATE ON mediastream_settings WHEN NEW.auto_governor_enabled = 1 BEGIN SELECT RAISE(ABORT, 'injected migration failure'); END"} {
		if err := d.Gorm().Exec(stmt).Error; err != nil {
			t.Fatal(err)
		}
	}
	if err := migratePlaybackAndPerformanceDefaults(d, d.Logger); err == nil {
		t.Fatal("injected failure ignored")
	}
	var profile string
	if err := d.Gorm().Raw("SELECT library_preferred_audio_profile FROM settings WHERE id=1").Scan(&profile).Error; err != nil || profile != "" {
		t.Fatalf("partial migration persisted: %q %v", profile, err)
	}
	var done bool
	if ok, err := GetMetadataCache(d, "migrations", "playback_performance_defaults_v1", &done); err != nil || ok {
		t.Fatalf("failed migration marked done: %v %v", ok, err)
	}
	if err := d.Gorm().Exec("DROP TRIGGER reject_governor").Error; err != nil {
		t.Fatal(err)
	}
	if err := migratePlaybackAndPerformanceDefaults(d, d.Logger); err != nil {
		t.Fatal(err)
	}
	if ok, err := GetMetadataCache(d, "migrations", "playback_performance_defaults_v1", &done); err != nil || !ok || !done {
		t.Fatalf("successful migration unmarked: %v %v %v", ok, done, err)
	}
	if err := d.Gorm().Exec("UPDATE mediastream_settings SET auto_governor_enabled = 0").Error; err != nil {
		t.Fatal(err)
	}
	if err := migratePlaybackAndPerformanceDefaults(d, d.Logger); err != nil {
		t.Fatal(err)
	}
	var enabled bool
	if err := d.Gorm().Raw("SELECT auto_governor_enabled FROM mediastream_settings WHERE id=1").Scan(&enabled).Error; err != nil || enabled {
		t.Fatalf("one-shot overwrote preference: %v %v", enabled, err)
	}
}
