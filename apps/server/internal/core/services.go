package core

import (
	"context"
	"kamehouse/internal/database/db"
	"kamehouse/internal/database/models"
	"kamehouse/internal/database/models/dto"

	"github.com/rs/zerolog"
)

// ─────────────────────────────────────────────────────────────────────
// Service Interfaces for Dependency Injection
// ─────────────────────────────────────────────────────────────────────
// These interfaces decouple handlers from the monolithic App struct,
// allowing handlers to depend only on the services they actually use.
//
// Usage (progressive adoption):
//   1. Handlers that only need anime operations accept AnimeService
//   2. Handlers that only need manga accept MangaService
//   3. Each interface is small and focused (Interface Segregation)
//
// Example migration:
//   Before: func (h *Handler) HandleGetAnime(c echo.Context) error {
//               data := h.App.AnimeCollection.GetAll()
//           }
//   After:  func (h *AnimeHandler) HandleGetAnime(c echo.Context) error {
//               data := h.animeSvc.GetCollection()
//           }
// ─────────────────────────────────────────────────────────────────────

// AnimeService abstracts anime collection and entry operations.
type AnimeService interface {
	GetAnimeCollection(ctx context.Context) (interface{}, error)
	GetAnimeEntry(ctx context.Context, mediaID int) (interface{}, error)
	RefreshAnimeCollection(ctx context.Context) error
}

// MangaService abstracts manga repository operations.
type MangaService interface {
	GetMangaCollection(ctx context.Context) (interface{}, error)
	GetMangaEntry(ctx context.Context, mediaID int) (interface{}, error)
	SearchManga(ctx context.Context, query string) (interface{}, error)
	DownloadChapter(ctx context.Context, mediaID int, chapterID string) error
}

// LibraryService abstracts local file and library scanning.
type LibraryService interface {
	GetLocalFiles() ([]*dto.LocalFile, error)
	SaveLocalFiles(files []*dto.LocalFile) error
	ScanLibrary(ctx context.Context, libraryPath string, enhanced bool) error
	GetScanSummaries() ([]*models.ScanSummary, error)
}

// MediaStreamService abstracts media streaming and transcoding.
type MediaStreamService interface {
	GetSettings() (interface{}, error)
	UpdateSettings(ctx context.Context, settings interface{}) error
	PreloadMedia(ctx context.Context, path string) error
}

// TorrentService abstracts torrent client and search operations.
type TorrentService interface {
	Search(ctx context.Context, query string) (interface{}, error)
	ListTorrents(ctx context.Context) (interface{}, error)
	AddTorrent(ctx context.Context, magnetURI string) error
	RemoveTorrent(ctx context.Context, hash string) error
}

// PlaybackService abstracts playback control and progress tracking.
type PlaybackService interface {
	GetPlaybackStatus(ctx context.Context) (interface{}, error)
	UpdateProgress(ctx context.Context, mediaID int, episodeNumber int, progress float64) error
	SyncPlaybackState(ctx context.Context) error
}

// AutoDownloaderService abstracts auto-download rule management.
type AutoDownloaderService interface {
	GetRules() ([]*models.AutoDownloaderRule, error)
	CreateRule(rule *models.AutoDownloaderRule) error
	UpdateRule(rule *models.AutoDownloaderRule) error
	DeleteRule(id uint) error
	RunAutoDownloader(ctx context.Context) error
}

// SettingsService abstracts application settings management.
type SettingsService interface {
	GetSettings() (*models.Settings, error)
	SaveSettings(settings *models.Settings) error
	GetTheme() (*models.Theme, error)
	SaveTheme(theme *models.Theme) error
}

// AuthService abstracts authentication and user management.
type AuthService interface {
	Login(ctx context.Context, username, password string) (string, error)
	ValidateToken(token string) (bool, error)
	GetCurrentUser() (interface{}, error)
}

// ─────────────────────────────────────────────────────────────────────
// ServiceContainer holds all service interfaces for explicit wiring.
// This replaces the monolithic App struct for handler dependencies.
// ─────────────────────────────────────────────────────────────────────

// ServiceContainer is the top-level DI container.
// Handlers receive only the services they need from this container.
type ServiceContainer struct {
	Database       *db.Database
	Logger         *zerolog.Logger
	Anime          AnimeService
	Manga          MangaService
	Library        LibraryService
	MediaStream    MediaStreamService
	Torrent        TorrentService
	Playback       PlaybackService
	AutoDownloader AutoDownloaderService
	Settings       SettingsService
	Auth           AuthService
}
