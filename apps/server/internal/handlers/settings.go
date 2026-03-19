package handlers

import (
	"errors"
	"kamehouse/internal/database/models"
	"kamehouse/internal/torrents/torrent"
	"kamehouse/internal/util"
	"os"
	"path/filepath"
	"time"

	"github.com/labstack/echo/v4"
)

// HandleGetSettings
//
//	@summary returns the app settings.
//	@route /api/v1/settings [GET]
//	@returns models.Settings
func (h *Handler) HandleGetSettings(c echo.Context) error {

	settings, err := h.App.Database.GetSettings()
	if err != nil {
		return h.RespondWithError(c, err)
	}

	// Attach separate-table sub-settings for the full settings view
	settings.Mediastream, _ = h.App.Database.GetMediastreamSettings()
	settings.Torrentstream, _ = h.App.Database.GetTorrentstreamSettings()
	settings.Theme, _ = h.App.Database.GetTheme()

	return h.RespondWithData(c, settings)
}

// HandleGettingStarted
//
//	@summary initial setup – save base settings on first run.
//	@desc This will update the app settings.
//	@desc The client should re-fetch the server status after this.
//	@route /api/v1/start [POST]
//	@returns handlers.Status
func (h *Handler) HandleGettingStarted(c echo.Context) error {

	type body struct {
		Library                models.LibrarySettings      `json:"library"`
		MediaPlayer            models.MediaPlayerSettings  `json:"mediaPlayer"`
		Torrent                models.TorrentSettings      `json:"torrent"`
		Notifications          models.NotificationSettings `json:"notifications"`
		EnableTranscode        bool                        `json:"enableTranscode"`
	}

	var b body
	if err := c.Bind(&b); err != nil {
		return h.RespondWithError(c, err)
	}

	if b.Library.SeriesPaths == nil {
		b.Library.SeriesPaths = []string{}
	}
	if b.Library.MoviePaths == nil {
		b.Library.MoviePaths = []string{}
	}
	b.Library.IncludeOnlineStreamingInLibrary = b.Library.EnableOnlinestream

	settings, err := h.App.Database.UpsertSettings(&models.Settings{
		BaseModel:     models.BaseModel{ID: 1, UpdatedAt: time.Now()},
		Library:       b.Library,
		MediaPlayer:   b.MediaPlayer,
		Torrent:       b.Torrent,
		Notifications: b.Notifications,
		AutoDownloader: models.AutoDownloaderSettings{
			Provider:              b.Library.TorrentProvider,
			Interval:              20,
			Enabled:               false,
			DownloadAutomatically: true,
			EnableEnhancedQueries: true,
		},
	})
	if err != nil {
		return h.RespondWithError(c, err)
	}

	if b.EnableTranscode {
		go func() {
			defer util.HandlePanicThen(func() {})
			if prev, found := h.App.Database.GetMediastreamSettings(); found {
				prev.TranscodeEnabled = true
				_, _ = h.App.Database.UpsertMediastreamSettings(prev)
			}
		}()
	}

	h.App.WSEventManager.SendEvent("settings", settings)
	h.App.InitOrRefreshModules()

	return h.RespondWithData(c, h.NewStatus(c))
}

// HandleSaveSettings
//
//	@summary updates the app settings.
//	@desc Applies a PATCH-style merge: the incoming payload's non-nil sub-objects
//	@desc replace the stored ones; AutoDownloader is always merged from the DB to
//	@desc preserve scheduler state. Separate-table settings (Mediastream,
//	@desc Torrentstream, Debrid, Theme) are upserted only when present in payload.
//	@route /api/v1/settings [PATCH]
//	@returns handlers.Status
func (h *Handler) HandleSaveSettings(c echo.Context) error {

	type body struct {
		Library       *models.LibrarySettings       `json:"library"`
		MediaPlayer   *models.MediaPlayerSettings   `json:"mediaPlayer"`
		Torrent       *models.TorrentSettings       `json:"torrent"`
		Notifications *models.NotificationSettings  `json:"notifications"`
		Mediastream   *models.MediastreamSettings   `json:"mediastream"`
		Torrentstream *models.TorrentstreamSettings `json:"torrentstream"`
		Theme         *models.Theme                 `json:"theme"`
	}

	var b body
	if err := c.Bind(&b); err != nil {
		return h.RespondWithError(c, err)
	}

	// ── 1. Sanitize library paths (if provided) ───────────────────────────────
	if b.Library != nil {
		if b.Library.SeriesPaths == nil {
			b.Library.SeriesPaths = []string{}
		}
		if b.Library.MoviePaths == nil {
			b.Library.MoviePaths = []string{}
		}

		cleanSeries := make([]string, 0, len(b.Library.SeriesPaths))
		for _, p := range b.Library.SeriesPaths {
			clean := filepath.ToSlash(filepath.Clean(p))
			if clean == "" {
				continue
			}
			// Relaxed validation: check if it exists, but don't drop if it doesn't
			info, err := os.Stat(filepath.FromSlash(clean))
			if err != nil {
				h.App.Logger.Warn().Err(err).Str("path", clean).Msg("settings: library path not accessible")
			} else if !info.IsDir() {
				h.App.Logger.Warn().Str("path", clean).Msg("settings: library path is not a directory")
			}
			cleanSeries = append(cleanSeries, clean)
		}
		b.Library.SeriesPaths = cleanSeries

		cleanMovies := make([]string, 0, len(b.Library.MoviePaths))
		for _, p := range b.Library.MoviePaths {
			clean := filepath.ToSlash(filepath.Clean(p))
			if clean == "" {
				continue
			}
			info, err := os.Stat(filepath.FromSlash(clean))
			if err != nil {
				h.App.Logger.Warn().Err(err).Str("path", clean).Msg("settings: library path not accessible")
			} else if !info.IsDir() {
				h.App.Logger.Warn().Str("path", clean).Msg("settings: library path is not a directory")
			}
			cleanMovies = append(cleanMovies, clean)
		}
		b.Library.MoviePaths = cleanMovies

		allPaths := b.Library.GetAllPaths()
		for i, p1 := range allPaths {
			for j, p2 := range allPaths {
				if i != j && util.IsSubdirectory(p1, p2) {
					return h.RespondWithError(c, errors.New("library paths cannot be subdirectories of each other"))
				}
			}
		}
	}

	// ── 2. Single fetch – free if cache is warm ───────────────────────────────
	prev, err := h.App.Database.GetSettings()
	if err != nil {
		return h.RespondWithError(c, err)
	}

	// ── 3. Preserve AutoDownloader: always carry the stored state forward ─────
	autoDownloader := prev.AutoDownloader
	// If the provider is being cleared, disable the scheduler proactively
	if b.Library != nil && b.Library.TorrentProvider == torrent.ProviderNone && autoDownloader.Enabled {
		h.App.Logger.Debug().Msg("settings: disabling auto-downloader – torrent provider set to none")
		autoDownloader.Enabled = false
	}

	merged := prev
	merged.ID = 1
	merged.UpdatedAt = time.Now()

	if b.Library != nil {
		if len(b.Library.SeriesPaths) > 0 {
			merged.Library.SeriesPaths = b.Library.SeriesPaths
		}
		if len(b.Library.MoviePaths) > 0 {
			merged.Library.MoviePaths = b.Library.MoviePaths
		}
		merged.Library.AutoUpdateProgress = b.Library.AutoUpdateProgress
		merged.Library.TorrentProvider = b.Library.TorrentProvider
		merged.Library.AutoSelectTorrentProvider = b.Library.AutoSelectTorrentProvider
		merged.Library.AutoScan = b.Library.AutoScan
		merged.Library.EnableOnlinestream = b.Library.EnableOnlinestream
		merged.Library.IncludeOnlineStreamingInLibrary = b.Library.IncludeOnlineStreamingInLibrary
		merged.Library.DisableAnimeCardTrailers = b.Library.DisableAnimeCardTrailers
		merged.Library.DOHProvider = b.Library.DOHProvider
		merged.Library.OpenTorrentClientOnStart = b.Library.OpenTorrentClientOnStart
		merged.Library.OpenWebURLOnStart = b.Library.OpenWebURLOnStart
		merged.Library.RefreshLibraryOnStart = b.Library.RefreshLibraryOnStart
		merged.Library.AutoPlayNextEpisode = b.Library.AutoPlayNextEpisode
		merged.Library.EnableWatchContinuity = b.Library.EnableWatchContinuity
		merged.Library.AutoSyncOfflineLocalData = b.Library.AutoSyncOfflineLocalData
		merged.Library.ScannerMatchingThreshold = b.Library.ScannerMatchingThreshold
		merged.Library.ScannerMatchingAlgorithm = b.Library.ScannerMatchingAlgorithm
		merged.Library.AutoSyncToLocalAccount = b.Library.AutoSyncToLocalAccount
		merged.Library.AutoSaveCurrentMediaOffline = b.Library.AutoSaveCurrentMediaOffline
		merged.Library.UseFallbackMetadataProvider = b.Library.UseFallbackMetadataProvider
		if b.Library.TmdbApiKey != "" {
			merged.Library.TmdbApiKey = b.Library.TmdbApiKey
		}
		if b.Library.TmdbLanguage != "" {
			merged.Library.TmdbLanguage = b.Library.TmdbLanguage
		}
		merged.Library.ScannerUseLegacyMatching = b.Library.ScannerUseLegacyMatching
		merged.Library.ScannerConfig = b.Library.ScannerConfig
		merged.Library.ScannerStrictStructure = b.Library.ScannerStrictStructure
		merged.Library.ScannerProvider = b.Library.ScannerProvider
		merged.Library.DisableLocalScanning = b.Library.DisableLocalScanning
		merged.Library.DisableTorrentStreaming = b.Library.DisableTorrentStreaming
		merged.Library.DisableTorrentProvider = b.Library.DisableTorrentProvider

		// If a TMDB API key is provided and the primary provider is empty, set it to "tmdb"
		if merged.Library.TmdbApiKey != "" && merged.Library.PrimaryMetadataProvider == "" {
			merged.Library.PrimaryMetadataProvider = "tmdb"
		}
	}

	// Partial updates for Media Player Settings
	if b.MediaPlayer != nil {
		if b.MediaPlayer.Default != "" {
			merged.MediaPlayer.Default = b.MediaPlayer.Default
		}
		if b.MediaPlayer.VlcPath != "" {
			merged.MediaPlayer.VlcPath = b.MediaPlayer.VlcPath
		}
		if b.MediaPlayer.MpvPath != "" {
			merged.MediaPlayer.MpvPath = b.MediaPlayer.MpvPath
		}
	}

	// Partial updates for Torrent Settings
	if b.Torrent != nil {
		merged.Torrent.ShowBufferingStatus = b.Torrent.ShowBufferingStatus
		merged.Torrent.ShowNetworkSpeed = b.Torrent.ShowNetworkSpeed
	}

	// Partial updates for Notification Settings
	if b.Notifications != nil {
		merged.Notifications.DisableNotifications = b.Notifications.DisableNotifications
		merged.Notifications.DisableAutoDownloaderNotifications = b.Notifications.DisableAutoDownloaderNotifications
		merged.Notifications.DisableAutoScannerNotifications = b.Notifications.DisableAutoScannerNotifications
	}

	merged.AutoDownloader = autoDownloader

	// If the provider was updated, check if we need to disable auto-downloader
	if b.Library != nil {
		if b.Library.TorrentProvider == torrent.ProviderNone && autoDownloader.Enabled {
			h.App.Logger.Debug().Msg("settings: disabling auto-downloader – torrent provider set to none")
			autoDownloader.Enabled = false
			merged.AutoDownloader.Enabled = false
		}
	}

	// ── 5. Single upsert for the main embedded settings ───────────────────────
	saved, err := h.App.Database.UpsertSettings(merged)
	if err != nil {
		return h.RespondWithError(c, err)
	}

	// ── 6. Conditional upserts for separate-table settings ────────────────────
	if b.Mediastream != nil {
		b.Mediastream.ID = 1
		b.Mediastream.UpdatedAt = time.Now()
		_, _ = h.App.Database.UpsertMediastreamSettings(b.Mediastream)
	}
	if b.Torrentstream != nil {
		b.Torrentstream.ID = 1
		b.Torrentstream.UpdatedAt = time.Now()
		_, _ = h.App.Database.UpsertTorrentstreamSettings(b.Torrentstream)
	}
	if b.Theme != nil {
		b.Theme.ID = 1
		// Preserve HomeItems – they are managed by a separate flow
		if currentTheme, err := h.App.Database.GetTheme(); err == nil && currentTheme != nil {
			b.Theme.HomeItems = currentTheme.HomeItems
		}
		_, _ = h.App.Database.UpsertTheme(b.Theme)
	}

	// ── 7. Broadcast & refresh ────────────────────────────────────────────────
	h.App.WSEventManager.SendEvent("settings", saved)
	h.App.InitOrRefreshModules()

	return h.RespondWithData(c, h.NewStatus(c))
}

// HandleSaveAutoDownloaderSettings
//
//	@summary updates the auto-downloader settings.
//	@route /api/v1/settings/auto-downloader [PATCH]
//	@returns bool
func (h *Handler) HandleSaveAutoDownloaderSettings(c echo.Context) error {

	type body struct {
		Provider              string `json:"provider"`
		Interval              int    `json:"interval"`
		Enabled               bool   `json:"enabled"`
		DownloadAutomatically bool   `json:"downloadAutomatically"`
		EnableEnhancedQueries bool   `json:"enableEnhancedQueries"`
		EnableSeasonCheck     bool   `json:"enableSeasonCheck"`
	}

	var b body

	if err := c.Bind(&b); err != nil {
		return h.RespondWithError(c, err)
	}

	currSettings, err := h.App.Database.GetSettings()
	if err != nil {
		return h.RespondWithError(c, err)
	}

	// Validation
	if b.Interval < 15 {
		return h.RespondWithError(c, errors.New("interval must be at least 15 minutes"))
	}

	autoDownloaderSettings := &models.AutoDownloaderSettings{
		Provider:              b.Provider,
		Interval:              b.Interval,
		Enabled:               b.Enabled,
		DownloadAutomatically: b.DownloadAutomatically,
		EnableEnhancedQueries: b.EnableEnhancedQueries,
		EnableSeasonCheck:     b.EnableSeasonCheck,
	}

	currSettings.AutoDownloader = *autoDownloaderSettings
	currSettings.BaseModel = models.BaseModel{
		ID:        1,
		UpdatedAt: time.Now(),
	}

	_, err = h.App.Database.UpsertSettings(currSettings)
	if err != nil {
		return h.RespondWithError(c, err)
	}

	// Update Auto Downloader settings
	h.App.AutoDownloader.SetSettings(*autoDownloaderSettings)

	return h.RespondWithData(c, true)
}

// HandleSaveMediaPlayerSettings
//
//	@summary updates the media player settings.
//	@route /api/v1/settings/media-player [PATCH]
//	@returns bool
func (h *Handler) HandleSaveMediaPlayerSettings(c echo.Context) error {

	type body struct {
		MediaPlayer *models.MediaPlayerSettings `json:"mediaPlayer"`
	}

	var b body

	if err := c.Bind(&b); err != nil {
		return h.RespondWithError(c, err)
	}

	currSettings, err := h.App.Database.GetSettings()
	if err != nil {
		return h.RespondWithError(c, err)
	}

	if b.MediaPlayer == nil {
		return h.RespondWithError(c, errors.New("mediaPlayer is required"))
	}

	currSettings.MediaPlayer = *b.MediaPlayer
	currSettings.BaseModel = models.BaseModel{
		ID:        1,
		UpdatedAt: time.Now(),
	}

	_, err = h.App.Database.UpsertSettings(currSettings)
	if err != nil {
		return h.RespondWithError(c, err)
	}

	h.App.InitOrRefreshModules()

	return h.RespondWithData(c, true)
}
