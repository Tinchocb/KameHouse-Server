package handlers

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"kamehouse/internal/database/models"
	"kamehouse/internal/drive"
	"kamehouse/internal/util"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"time"

	"github.com/labstack/echo/v4"
)

// HandleGetSettings returns the app settings.
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
	settings.Theme, _ = h.App.Database.GetTheme()

	// Coalesce defaults para columnas nuevas en filas pre-migración (sin persistir).
	if settings.Library.PreferredAudioProfile == "" {
		settings.Library.PreferredAudioProfile = "latino"
	}
	if settings.Mediastream != nil && settings.Mediastream.PerformanceProfile == "" {
		settings.Mediastream.PerformanceProfile = "auto"
	}

	return h.RespondWithData(c, settings)
}

// HandleGettingStarted implements the initial setup, saving base settings on first run.
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

	settings, err := h.App.Database.UpsertSettings(&models.Settings{
		BaseModel:     models.BaseModel{ID: 1, UpdatedAt: time.Now()},
		Library:       b.Library,
		MediaPlayer:   b.MediaPlayer,
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

	h.invalidateSettingsCache()
	h.App.WSEventManager.SendEvent("settings", settings)
	h.App.InitOrRefreshModules()

	return h.RespondWithData(c, h.NewStatus(c))
}

// HandleSaveSettings updates the app settings.
//
//	@summary updates the app settings.
//	@desc Applies a PATCH-style merge: only keys present in the payload overwrite
//	@desc stored values. This applies to Library (field-by-field), Mediastream and
//	@desc Theme (merge-before-upsert against the stored row). Separate-table settings
//	@desc are upserted only when present in payload.
//	@route /api/v1/settings [PATCH]
//	@returns handlers.Status
func (h *Handler) HandleSaveSettings(c echo.Context) error {

	bodyBytes, err := io.ReadAll(c.Request().Body)
	if err != nil {
		return h.RespondWithError(c, err)
	}
	c.Request().Body = io.NopCloser(bytes.NewBuffer(bodyBytes))

	type body struct {
		Library       *models.LibrarySettings       `json:"library"`
		MediaPlayer   *models.MediaPlayerSettings   `json:"mediaPlayer"`
		Mediastream   *models.MediastreamSettings   `json:"mediastream"`
		Theme         *models.Theme                 `json:"theme"`
		Notifications *models.NotificationSettings `json:"notifications"`
		Platform      *models.PlatformSettings     `json:"platform"`
		GoogleDrive   *models.GoogleDriveSettings  `json:"googleDrive"`
	}

	var b body
	if err := c.Bind(&b); err != nil {
		return h.RespondWithError(c, err)
	}

	var rawRoot map[string]json.RawMessage
	_ = json.Unmarshal(bodyBytes, &rawRoot)

	var rawLibrary map[string]json.RawMessage
	if rawLibBytes, ok := rawRoot["library"]; ok && len(rawLibBytes) > 0 {
		_ = json.Unmarshal(rawLibBytes, &rawLibrary)
	}
	var rawMediastream map[string]json.RawMessage
	if rawMsBytes, ok := rawRoot["mediastream"]; ok && len(rawMsBytes) > 0 {
		_ = json.Unmarshal(rawMsBytes, &rawMediastream)
	}
	var rawTheme map[string]json.RawMessage
	if rawThemeBytes, ok := rawRoot["theme"]; ok && len(rawThemeBytes) > 0 {
		_ = json.Unmarshal(rawThemeBytes, &rawTheme)
	}
	var rawGoogleDrive map[string]json.RawMessage
	if rawGdBytes, ok := rawRoot["googleDrive"]; ok && len(rawGdBytes) > 0 {
		_ = json.Unmarshal(rawGdBytes, &rawGoogleDrive)
	}

	// ── 1. Fetch current settings ─────────────────────────────────────────────
	prev, err := h.App.Database.GetSettings()
	if err != nil {
		return h.RespondWithError(c, err)
	}

	merged := prev
	merged.ID = 1
	merged.UpdatedAt = time.Now()

	// ── 2. Field-by-field PATCH merge for Library ─────────────────────────────
	if b.Library != nil && rawLibrary != nil {
		cleanOnePath := func(p string) (string, error) {
			if strings.TrimSpace(p) == "" {
				return "", nil
			}
			clean := filepath.ToSlash(filepath.Clean(strings.TrimSpace(p)))
			if clean == "" || clean == "." {
				return "", nil
			}
			if strings.Contains(clean, ",") {
				return "", fmt.Errorf("invalid library path %q: commas are not supported (CSV storage)", p)
			}
			return clean, nil
		}
		if _, ok := rawLibrary["seriesPaths"]; ok {
			cleanSeries := make([]string, 0, len(b.Library.SeriesPaths))
			for _, p := range b.Library.SeriesPaths {
				clean, err := cleanOnePath(p)
				if err != nil {
					return h.RespondWithError(c, err)
				}
				if clean == "" {
					continue
				}
				info, err := os.Stat(filepath.FromSlash(clean))
				if err != nil {
					h.App.Logger.Warn().Err(err).Str("path", clean).Msg("settings: library path not accessible")
				} else if !info.IsDir() {
					h.App.Logger.Warn().Str("path", clean).Msg("settings: library path is not a directory")
				}
				cleanSeries = append(cleanSeries, clean)
			}
			merged.Library.SeriesPaths = cleanSeries
		}

		if _, ok := rawLibrary["moviePaths"]; ok {
			cleanMovies := make([]string, 0, len(b.Library.MoviePaths))
			for _, p := range b.Library.MoviePaths {
				clean, err := cleanOnePath(p)
				if err != nil {
					return h.RespondWithError(c, err)
				}
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
			merged.Library.MoviePaths = cleanMovies
		}

		allPaths := merged.Library.GetAllPaths()
		seen := make(map[string]string, len(allPaths))
		for _, p := range allPaths {
			key := p
			if runtime.GOOS == "windows" {
				key = strings.ToLower(p)
			}
			if prev, dup := seen[key]; dup {
				return h.RespondWithError(c, fmt.Errorf("invalid library paths: %q and %q are duplicated", prev, p))
			}
			seen[key] = p
		}
		for i, p1 := range allPaths {
			for j, p2 := range allPaths {
				if i != j && util.IsSubdirectory(p1, p2) {
					return h.RespondWithError(c, fmt.Errorf("invalid library paths: %q and %q cannot be subdirectories of each other", p1, p2))
				}
			}
		}

		if _, ok := rawLibrary["autoScan"]; ok {
			merged.Library.AutoScan = b.Library.AutoScan
		}
		if _, ok := rawLibrary["unifiedScan"]; ok {
			merged.Library.UnifiedScan = b.Library.UnifiedScan
		}
		if _, ok := rawLibrary["refreshLibraryOnStart"]; ok {
			merged.Library.RefreshLibraryOnStart = b.Library.RefreshLibraryOnStart
		}
		if _, ok := rawLibrary["autoPlayNextEpisode"]; ok {
			merged.Library.AutoPlayNextEpisode = b.Library.AutoPlayNextEpisode
		}
		if _, ok := rawLibrary["autoDetectSkipTimes"]; ok {
			merged.Library.AutoDetectSkipTimes = b.Library.AutoDetectSkipTimes
		}
		if _, ok := rawLibrary["enableWatchContinuity"]; ok {
			merged.Library.EnableWatchContinuity = b.Library.EnableWatchContinuity
		}
		if _, ok := rawLibrary["scannerMatchingThreshold"]; ok {
			merged.Library.ScannerMatchingThreshold = b.Library.ScannerMatchingThreshold
		}
		if _, ok := rawLibrary["primaryMetadataProvider"]; ok && b.Library.PrimaryMetadataProvider != "" {
			merged.Library.PrimaryMetadataProvider = b.Library.PrimaryMetadataProvider
		}
		if _, ok := rawLibrary["scannerProvider"]; ok && b.Library.ScannerProvider != "" {
			merged.Library.ScannerProvider = b.Library.ScannerProvider
		}
		if _, ok := rawLibrary["tmdbApiKey"]; ok {
			merged.Library.TmdbApiKey = b.Library.TmdbApiKey
		}
		if _, ok := rawLibrary["tmdbLanguage"]; ok && b.Library.TmdbLanguage != "" {
			merged.Library.TmdbLanguage = b.Library.TmdbLanguage
		}
		if _, ok := rawLibrary["scannerStrictStructure"]; ok {
			merged.Library.ScannerStrictStructure = b.Library.ScannerStrictStructure
		}
		if _, ok := rawLibrary["scannerUseLegacyMatching"]; ok {
			merged.Library.ScannerUseLegacyMatching = b.Library.ScannerUseLegacyMatching
		}
		if _, ok := rawLibrary["disableLocalScanning"]; ok {
			merged.Library.DisableLocalScanning = b.Library.DisableLocalScanning
		}
		if _, ok := rawLibrary["preferredAudioProfile"]; ok && b.Library.PreferredAudioProfile != "" {
			merged.Library.PreferredAudioProfile = b.Library.PreferredAudioProfile
		}
		if _, ok := rawLibrary["autoSkipIntro"]; ok {
			merged.Library.AutoSkipIntro = b.Library.AutoSkipIntro
		}
		if _, ok := rawLibrary["autoSkipOutro"]; ok {
			merged.Library.AutoSkipOutro = b.Library.AutoSkipOutro
		}
		if _, ok := rawLibrary["autoSkipFiller"]; ok {
			merged.Library.AutoSkipFiller = b.Library.AutoSkipFiller
		}
		if _, ok := rawLibrary["autoDisableSubtitlesWhenDubbed"]; ok {
			merged.Library.AutoDisableSubtitlesWhenDubbed = b.Library.AutoDisableSubtitlesWhenDubbed
		}
		if _, ok := rawLibrary["marathonMode"]; ok {
			merged.Library.MarathonMode = b.Library.MarathonMode
		}
		if _, ok := rawLibrary["tvMode"]; ok {
			merged.Library.TvMode = b.Library.TvMode
		}

		if merged.Library.TmdbApiKey != "" && merged.Library.PrimaryMetadataProvider == "" {
			merged.Library.PrimaryMetadataProvider = "tmdb"
		}
		if merged.Library.TmdbApiKey != "" && merged.Library.ScannerProvider == "" {
			merged.Library.ScannerProvider = "tmdb"
		}
		// Si solo llega primary (cliente parcial), mantener scanner alineado.
		if _, primaryOk := rawLibrary["primaryMetadataProvider"]; primaryOk {
			if _, scannerOk := rawLibrary["scannerProvider"]; !scannerOk && b.Library.PrimaryMetadataProvider != "" {
				merged.Library.ScannerProvider = b.Library.PrimaryMetadataProvider
			}
		}
		// Defaults para columnas nuevas en filas pre-migración.
		if merged.Library.PreferredAudioProfile == "" {
			merged.Library.PreferredAudioProfile = "latino"
		}
	}

	// ── 3. Merge other sub-objects if provided ─────────────────────────────────
	if _, ok := rawRoot["mediaPlayer"]; ok && b.MediaPlayer != nil {
		merged.MediaPlayer = *b.MediaPlayer
	}
	if _, ok := rawRoot["notifications"]; ok && b.Notifications != nil {
		merged.Notifications = *b.Notifications
	}
	// Aceptar tanto "platform" (canónico Go/codegen) como "Platform" (zod frontend).
	if _, ok := rawRoot["platform"]; ok && b.Platform != nil {
		merged.Platform = *b.Platform
	} else if _, ok := rawRoot["Platform"]; ok && b.Platform != nil {
		merged.Platform = *b.Platform
	}
	if b.GoogleDrive != nil && rawGoogleDrive != nil {
		if _, ok := rawGoogleDrive["enabled"]; ok {
			merged.GoogleDrive.Enabled = b.GoogleDrive.Enabled
		}
		if _, ok := rawGoogleDrive["clientId"]; ok {
			merged.GoogleDrive.ClientID = b.GoogleDrive.ClientID
		}
		if _, ok := rawGoogleDrive["clientSecret"]; ok {
			merged.GoogleDrive.ClientSecret = b.GoogleDrive.ClientSecret
		}
		if _, ok := rawGoogleDrive["refreshToken"]; ok {
			merged.GoogleDrive.RefreshToken = b.GoogleDrive.RefreshToken
		}
		if _, ok := rawGoogleDrive["folderId"]; ok {
			merged.GoogleDrive.FolderID = drive.CleanFolderID(b.GoogleDrive.FolderID)
		}
		if _, ok := rawGoogleDrive["folderName"]; ok {
			merged.GoogleDrive.FolderName = b.GoogleDrive.FolderName
		}
	}

	// ── 5. Single upsert for the main embedded settings ───────────────────────
	saved, err := h.App.Database.UpsertSettings(merged)
	if err != nil {
		return h.RespondWithError(c, err)
	}

	if b.GoogleDrive != nil && h.App.DriveService != nil {
		_ = h.App.DriveService.UpdateConfig(
			saved.GoogleDrive.Enabled,
			saved.GoogleDrive.ClientID,
			saved.GoogleDrive.ClientSecret,
			saved.GoogleDrive.RefreshToken,
			saved.GoogleDrive.FolderID,
			saved.GoogleDrive.FolderName,
		)
	}

	// ── 6. Merge-before-upsert for separate-table settings ────────────────
	// Mediastream: solo las claves presentes en el payload pisan la fila almacenada.
	mediastreamSaved := false
	if b.Mediastream != nil && rawMediastream != nil {
		prevMs, found := h.App.Database.GetMediastreamSettings()
		mergedMs := b.Mediastream
		if found && prevMs != nil {
			mergedMs.ID = 1
			mergedMs.CreatedAt = prevMs.CreatedAt
			if _, ok := rawMediastream["transcodeEnabled"]; !ok {
				mergedMs.TranscodeEnabled = prevMs.TranscodeEnabled
			}
			if _, ok := rawMediastream["ffmpegPath"]; !ok {
				mergedMs.FfmpegPath = prevMs.FfmpegPath
			}
			if _, ok := rawMediastream["ffprobePath"]; !ok {
				mergedMs.FfprobePath = prevMs.FfprobePath
			}
			if _, ok := rawMediastream["preTranscodeLibraryDir"]; !ok {
				mergedMs.PreTranscodeLibraryDir = prevMs.PreTranscodeLibraryDir
			}
			if _, ok := rawMediastream["transcodeHwAccel"]; !ok {
				mergedMs.TranscodeHwAccel = prevMs.TranscodeHwAccel
			} else if mergedMs.TranscodeHwAccel == "none" {
				// Normalizar alias legacy "none" al canónico "disabled".
				mergedMs.TranscodeHwAccel = "disabled"
			}
			if _, ok := rawMediastream["transcodePreset"]; !ok {
				mergedMs.TranscodePreset = prevMs.TranscodePreset
			}
			if _, ok := rawMediastream["transcodeHwAccelCustomSettings"]; !ok {
				mergedMs.TranscodeHwAccelCustomSettings = prevMs.TranscodeHwAccelCustomSettings
			}
			if _, ok := rawMediastream["preTranscodeEnabled"]; !ok {
				mergedMs.PreTranscodeEnabled = prevMs.PreTranscodeEnabled
			}
			if _, ok := rawMediastream["transcodeThreads"]; !ok {
				mergedMs.TranscodeThreads = prevMs.TranscodeThreads
			}
			if _, ok := rawMediastream["directPlayOnly"]; !ok {
				mergedMs.DirectPlayOnly = prevMs.DirectPlayOnly
			}
			if _, ok := rawMediastream["disableAutoSwitchToDirectPlay"]; !ok {
				mergedMs.DisableAutoSwitchToDirectPlay = prevMs.DisableAutoSwitchToDirectPlay
			}
			if _, ok := rawMediastream["performanceProfile"]; !ok {
				mergedMs.PerformanceProfile = prevMs.PerformanceProfile
			}
			if _, ok := rawMediastream["autoGovernorEnabled"]; !ok {
				mergedMs.AutoGovernorEnabled = prevMs.AutoGovernorEnabled
			}
		} else {
			mergedMs.ID = 1
			if mergedMs.TranscodeHwAccel == "none" {
				mergedMs.TranscodeHwAccel = "disabled"
			}
		}
		mergedMs.UpdatedAt = time.Now()
		_, _ = h.App.Database.UpsertMediastreamSettings(mergedMs)
		mediastreamSaved = true
	}

	// Theme: merge genérico vía mapa para no borrar 40 columnas en PATCH parcial.
	if b.Theme != nil && rawTheme != nil {
		prevTheme, _ := h.App.Database.GetTheme()
		mergedTheme := b.Theme
		if prevTheme != nil {
			prevBytes, _ := json.Marshal(prevTheme)
			var prevMap map[string]json.RawMessage
			_ = json.Unmarshal(prevBytes, &prevMap)
			for k, v := range rawTheme {
				prevMap[k] = v
			}
			mergedBytes, _ := json.Marshal(prevMap)
			_ = json.Unmarshal(mergedBytes, mergedTheme)
		}
		mergedTheme.ID = 1
		_, _ = h.App.Database.UpsertTheme(mergedTheme)
	}

	// ── 7. Invalidate settings cache ──────────────────────────────────────────
	h.invalidateSettingsCache()

	// El transcoder hornea el perfil HW al construirse: si cambió mediastream,
	// reinicializar igual que el endpoint dedicado (corta streams activos;
	// el frontend avisa con toast). Sin esto, GPU/preset/policy persistían
	// pero no se aplicaban hasta reiniciar.
	if mediastreamSaved {
		h.App.InitOrRefreshMediastreamSettings()
	}

	// ── 8. Broadcast & refresh ────────────────────────────────────────────────
	h.App.WSEventManager.SendEvent("settings", saved)
	h.App.InitOrRefreshModules()

	return h.RespondWithData(c, h.NewStatus(c))
}



// HandleSaveMediaPlayerSettings updates the media player settings.
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

	h.invalidateSettingsCache()
	h.App.WSEventManager.SendEvent("settings", currSettings)
	h.App.InitOrRefreshModules()

	return h.RespondWithData(c, true)
}

