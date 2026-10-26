package core

import (
	"context"
	"io"
	"net/http"
	"strings"
	"sync"
	"testing"

	"github.com/rs/zerolog"
	"kamehouse/internal/api/metadata_provider"
	"kamehouse/internal/api/tmdb"
	"kamehouse/internal/database/db"
	"kamehouse/internal/database/models"
)

func metadataTestApp(t *testing.T) *App {
	t.Helper()
	l := zerolog.Nop()
	d, err := db.NewDatabase(context.Background(), t.TempDir(), "metadata-test", &l)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { d.Shutdown(); _ = d.Close() })
	s := &models.Settings{BaseModel: models.BaseModel{ID: 1}}
	s.Library.TmdbLanguage = "ja-JP"
	if _, err := d.UpsertSettings(s); err != nil {
		t.Fatal(err)
	}
	c := tmdb.NewClient("old-key", "ja-JP")
	return &App{CoreServices: CoreServices{Database: d, Config: &Config{}, Logger: &l}, Metadata: MetadataProviders{
		tmdbClient: c,
		Provider:   metadata_provider.NewDynamicProvider(metadata_provider.NewProvider(&metadata_provider.NewProviderImplOptions{Logger: &l, Database: d, TMDBClient: c})),
	}}
}

func TestMetadataHotReloadRefreshesProviderAndLanguage(t *testing.T) {
	a := metadataTestApp(t)
	a.Metadata.GetTMDBClient().SetHTTPClient(&http.Client{Transport: metadataTransport(func(r *http.Request) (*http.Response, error) {
		t.Error("request used the previous client")
		return metadataResponse(`{}`), nil
	})})
	prev := a.Metadata.Provider.GetProvider()
	cfg := &Config{}
	cfg.Metadata.TMDBApiKey = "new-key"
	a.handleConfigChange(cfg)
	if a.Metadata.Provider.GetProvider() == prev {
		t.Error("hot reload left the previous provider installed")
	}
	c := a.Metadata.GetTMDBClient()
	if c.GetBearerToken() != "new-key" {
		t.Error("client token was not refreshed")
	}
	var paths []string
	c.SetHTTPClient(&http.Client{Transport: metadataTransport(func(r *http.Request) (*http.Response, error) {
		if r.URL.Query().Get("api_key") != "new-key" || r.URL.Query().Get("language") != "ja-JP" {
			t.Errorf("wrong token or language: %s", r.URL)
		}
		paths = append(paths, r.URL.Path)
		if strings.HasSuffix(r.URL.Path, "/search/tv") {
			return metadataResponse(`{"results":[{"id":876543,"name":"New search"}]}`), nil
		}
		return metadataResponse(`{"id":876543,"title":"New movie","original_title":"Original","overview":"New metadata"}`), nil
	})})
	results, err := c.SearchTV(context.Background(), "refresh-test")
	if err != nil || len(results) != 1 {
		t.Fatalf("search: %v, %v", results, err)
	}
	media := &models.LibraryMedia{Type: "MOVIE", Format: "MOVIE", TmdbID: 876543}
	if err := a.Database.Gorm().Create(media).Error; err != nil {
		t.Fatal(err)
	}
	meta, err := a.Metadata.Provider.GetAnimeMetadata(int(media.ID))
	if err != nil || meta == nil || meta.Description != "New metadata" {
		t.Fatalf("provider did not use refreshed client: %v, %v", meta, err)
	}
	if len(paths) != 2 {
		t.Fatalf("expected search and movie requests, got %v", paths)
	}
	// Clear memory only: a rebuilt client must still find the SQL-backed cache.
	c.ClearCache()
	c.SetHTTPClient(&http.Client{Transport: metadataTransport(func(r *http.Request) (*http.Response, error) {
		t.Error("persistent cache miss after reload")
		return metadataResponse(`{}`), nil
	})})
	results, err = c.SearchTV(context.Background(), "refresh-test")
	if err != nil || len(results) != 1 {
		t.Fatalf("persistent cache: %v, %v", results, err)
	}
}

type metadataTransport func(*http.Request) (*http.Response, error)

func (f metadataTransport) RoundTrip(r *http.Request) (*http.Response, error) { return f(r) }
func metadataResponse(body string) *http.Response {
	return &http.Response{StatusCode: 200, Header: make(http.Header), Body: io.NopCloser(strings.NewReader(body))}
}

func TestMetadataReloadKeepsEffectiveKeyPrecedence(t *testing.T) {
	a := metadataTestApp(t)
	s, err := a.Database.GetStoredSettings()
	if err != nil {
		t.Fatal(err)
	}
	view := *s
	view.Library.TmdbApiKey = "db-key"
	if _, err := a.Database.UpsertSettings(&view); err != nil {
		t.Fatal(err)
	}
	cfg := &Config{}
	cfg.Metadata.TMDBApiKey = "config-key"
	a.handleConfigChange(cfg)
	if a.Metadata.GetTMDBClient().GetBearerToken() != "db-key" {
		t.Fatal("config overrode DB key")
	}
	a.Database.SetSettingsOverride(func(s *models.Settings) { s.Library.TmdbApiKey = "env-key" })
	a.handleConfigChange(cfg)
	if a.Metadata.GetTMDBClient().GetBearerToken() != "env-key" {
		t.Fatal("effective environment override lost")
	}
	stored, err := a.Database.GetStoredSettings()
	if err != nil || stored.Library.TmdbApiKey != "db-key" {
		t.Fatal("reload persisted effective override")
	}
}

func TestMetadataConcurrentReloadAndRead(t *testing.T) {
	a := metadataTestApp(t)
	var wg sync.WaitGroup
	start := make(chan struct{})
	wg.Go(func() {
		<-start
		for range 30 {
			cfg := &Config{}
			cfg.Metadata.TMDBApiKey = "new-key"
			a.handleConfigChange(cfg)
		}
	})
	for range 8 {
		wg.Go(func() {
			<-start
			for range 1000 {
				c := a.Metadata.GetTMDBClient()
				_ = c.HasApiKey()
				_ = a.Metadata.Provider.GetProvider()
			}
		})
	}
	close(start)
	wg.Wait()
}
