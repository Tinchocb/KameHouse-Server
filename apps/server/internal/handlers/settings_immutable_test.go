package handlers

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/rs/zerolog"
	"kamehouse/internal/database/db"
	"kamehouse/internal/database/models"
	"kamehouse/internal/mediastream"
)

func TestConcurrentLegacySettingsReadsAreImmutable(t *testing.T) {
	a, _ := setupTestApp(t)
	waitSettingsMigrations(t, a.Database)
	if _, err := a.Database.UpsertSettings(&models.Settings{BaseModel: models.BaseModel{ID: 1}}); err != nil {
		t.Fatal(err)
	}
	if err := a.Database.Gorm().Create(&models.MediastreamSettings{BaseModel: models.BaseModel{ID: 1}}).Error; err != nil {
		t.Fatal(err)
	}
	if err := a.Database.Gorm().Model(&models.MediastreamSettings{}).Where("id = ?", 1).Update("performance_profile", "").Error; err != nil {
		t.Fatal(err)
	}
	cached, _ := a.Database.GetMediastreamSettings()
	_, _ = a.Database.GetSettings()
	_, _ = a.Database.GetTheme()
	h := &Handler{App: a}
	var wg sync.WaitGroup
	start := make(chan struct{})
	for range 32 {
		wg.Go(func() {
			<-start
			e := echo.New()
			rec := httptest.NewRecorder()
			if err := h.HandleGetSettings(e.NewContext(httptest.NewRequest(http.MethodGet, "/api/v1/settings", nil), rec)); err != nil {
				t.Error(err)
				return
			}
			if !strings.Contains(rec.Body.String(), `"performanceProfile":"auto"`) {
				t.Error("response did not supply auto default")
			}
		})
	}
	close(start)
	wg.Wait()
	if cached.PerformanceProfile != "" {
		t.Fatal("GET mutated shared legacy settings")
	}
	var stored models.MediastreamSettings
	if err := a.Database.Gorm().First(&stored, 1).Error; err != nil {
		t.Fatal(err)
	}
	if stored.PerformanceProfile != "" {
		t.Fatal("GET persisted a response default")
	}
}

func TestSaveSettingsThemeFailurePreservesUnchangedStreaming(t *testing.T) {
	a, base := setupTestApp(t)
	waitSettingsMigrations(t, a.Database)
	l := zerolog.Nop()
	a.Logger = &l
	a.Config.Cache.Dir = base
	a.Config.Cache.TranscodeDir = filepath.Join(base, "transcode")
	a.MediastreamRepository = mediastream.NewRepository(&mediastream.NewRepositoryOptions{Logger: &l})
	t.Cleanup(a.MediastreamRepository.OnCleanup)
	if _, err := a.Database.UpsertSettings(&models.Settings{BaseModel: models.BaseModel{ID: 1}}); err != nil {
		t.Fatal(err)
	}
	s := &models.MediastreamSettings{BaseModel: models.BaseModel{ID: 1}, TranscodeEnabled: true, TranscodeHwAccel: "disabled"}
	if _, err := a.Database.UpsertMediastreamSettings(s); err != nil {
		t.Fatal(err)
	}
	a.MediastreamRepository.InitializeModules(s, base, a.Config.Cache.TranscodeDir)
	marker := filepath.Join(a.Config.Cache.TranscodeDir, "segment.ts")
	if err := os.WriteFile(marker, []byte("active"), 0600); err != nil {
		t.Fatal(err)
	}
	// Force the partial-save path in this disposable database only.
	if err := a.Database.Gorm().Migrator().DropTable(&models.Theme{}); err != nil {
		t.Fatal(err)
	}
	e := echo.New()
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPatch, "/api/v1/settings", strings.NewReader(`{"mediastream":{"performanceProfile":"low"},"theme":{}}`))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	h := &Handler{App: a}
	if err := h.HandleSaveSettings(e.NewContext(req, rec)); err != nil {
		t.Fatal(err)
	}
	if rec.Code < 400 || !strings.Contains(rec.Body.String(), "no se pudo guardar el tema") {
		t.Fatalf("expected Theme failure, got HTTP %d: %s", rec.Code, rec.Body.String())
	}
	if _, err := os.Stat(marker); err != nil {
		t.Fatalf("partial save removed active segment: %v", err)
	}
	stored, _ := a.Database.GetMediastreamSettings()
	if stored.PerformanceProfile != "low" || a.MediastreamRepository.GetSettings().MustGet().PerformanceProfile != "low" {
		t.Fatal("saved streaming preferences not applied after Theme failure")
	}
}

// The background migration legitimately fills the legacy default. Finish it
// before seeding a deliberately legacy row, so GET is the only actor tested.
func waitSettingsMigrations(t *testing.T, database *db.Database) {
	t.Helper()
	deadline := time.Now().Add(10 * time.Second)
	for {
		if done, err := database.MigrationStatus(); done {
			if err != nil {
				t.Fatal(err)
			}
			return
		}
		if time.Now().After(deadline) {
			t.Fatal("database migration did not finish")
		}
		time.Sleep(time.Millisecond)
	}
}
