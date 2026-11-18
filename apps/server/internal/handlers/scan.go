package handlers

import (
	"context"
	"errors"
	"net/http"
	"sync/atomic"
	"time"

	"kamehouse/internal/database/db"
	"kamehouse/internal/library/scanner"
	"kamehouse/internal/library/summary"
	"kamehouse/internal/util/ffmpegutil"

	"github.com/labstack/echo/v4"
)

var globalScanActive atomic.Bool

// HandleScanLocalFiles ...
//
//	@summary scans the user's library.
//	@desc This will scan the user's library.
//	@desc The response is ignored, the client should re-fetch the library after this.
//	@route /api/v1/library/scan [POST]
//	@returns []dto.LocalFile
func (h *Handler) HandleScanLocalFiles(c echo.Context) error {

	type body struct {
		Mode             string `json:"mode"` // "metadata", "fast", "deep"
		SkipLockedFiles  bool   `json:"skipLockedFiles"`
		SkipIgnoredFiles bool   `json:"skipIgnoredFiles"`
	}

	var b body
	if err := c.Bind(&b); err != nil {
		return h.RespondWithError(c, err)
	}

	// Default to fast mode if not provided
	if b.Mode == "" {
		b.Mode = "fast"
	}
	if b.Mode != "fast" && b.Mode != "deep" && b.Mode != "metadata" {
		return h.RespondWithCodeError(c, http.StatusBadRequest, errors.New("invalid scan mode, expected 'fast', 'deep' or 'metadata'"))
	}
	if h.localDiskDisconnected() {
		return h.RespondWithCodeError(c, http.StatusConflict, errors.New("el disco local está desconectado: reconéctalo en Ajustes > Biblioteca para escanear"))
	}

	// +---------------------+
	// |   Concurrent Lock   |
	// +---------------------+
	if !globalScanActive.CompareAndSwap(false, true) {
		return h.RespondWithCodeError(c, http.StatusConflict, errors.New("ya hay un escaneo de biblioteca en curso, por favor espera"))
	}
	cleanupLock := true
	defer func() {
		if cleanupLock {
			globalScanActive.Store(false)
		}
	}()

	settings := h.App.SettingsSnapshot()
	if settings == nil {
		return h.RespondWithCodeError(c, 400, errors.New("invalid settings: ajustes no encontrados, por favor configura la biblioteca primero"))
	}

	// Retrieve the user's library path
	libraryPaths := settings.GetLibrary().GetAllPaths()
	if len(libraryPaths) == 0 {
		return h.RespondWithCodeError(c, 400, errors.New("invalid settings: no hay carpetas de origen configuradas"))
	}
	libraryPath := libraryPaths[0]
	var additionalLibraryPaths []string
	if len(libraryPaths) > 1 {
		additionalLibraryPaths = libraryPaths[1:]
	}

	// Get the latest local files
	existingLfs, _, err := db.GetLocalFiles(h.App.Database)
	if err != nil {
		return h.RespondWithError(c, err)
	}

	// Deep scans reset only their working copies during discovery. The walker
	// already traverses every directory; never erase persisted identities here.

	// Get the latest shelved local files
	existingShelvedLfs, err := db.GetShelvedLocalFiles(h.App.Database)
	if err != nil {
		return h.RespondWithError(c, err)
	}

	mSettings, ok := h.App.Database.GetMediastreamSettings()
	var customFfprobe string
	if ok {
		customFfprobe = mSettings.FfprobePath
	}
	ffprobePath := ffmpegutil.ResolveFFprobePath(h.App.Config.Cache.Dir, customFfprobe)

	// +---------------------+
	// |       Scanner       |
	// +---------------------+

	// Create scan summary logger
	scanSummaryLogger := summary.NewScanSummaryLogger()

	// Create a new scan logger
	scanLogger, err := scanner.NewScanLogger(h.App.Config.Logs.Dir)
	if err != nil {
		globalScanActive.Store(false)
		return h.RespondWithError(c, err)
	}

	ac, _ := h.App.GetAnimeCollection(false)

	// Create a new scanner
	sc := scanner.NewScanner(&scanner.ScannerOptions{
		DirPath:              libraryPath,
		OtherDirPaths:        additionalLibraryPaths,
		SeriesPaths:          settings.GetLibrary().SeriesPaths,
		MoviePaths:           settings.GetLibrary().MoviePaths,
		Enhanced:             true,
		ScanMode:             b.Mode, // Pass the mode
		PlatformRef:          h.App.Metadata.Platform,
		Logger:               h.App.Logger,
		WSEventManager:       h.App.WSEventManager,
		EventDispatcher:      h.App.WSEventManager.Dispatcher(),
		ExistingLocalFiles:   existingLfs,
		SkipLockedFiles:      b.SkipLockedFiles,
		SkipIgnoredFiles:     b.SkipIgnoredFiles,
		ScanSummaryLogger:    scanSummaryLogger,
		ScanLogger:           scanLogger,
		Database:             h.App.Database,
		MetadataProviderRef:  h.App.Metadata.Provider,
		MatchingThreshold:    settings.GetLibrary().ScannerMatchingThreshold,
		StrictStructure:      settings.GetLibrary().ScannerStrictStructure,
		WithShelving:         true,
		ExistingShelvedFiles: existingShelvedLfs,
		AnimeCollection:      ac,
		UseTMDB:              settings.GetLibrary().ScannerProvider == "tmdb",
		TMDBClient:           h.App.Metadata.GetTMDBClient(),
		FFprobePath:          ffprobePath,
		BackgroundQueue:      h.App.BackgroundQueue,
		UnifiedScan:          settings.GetLibrary().UnifiedScan,
	})

	cleanupLock = false
	// EXECUTE ASYNCHRONOUSLY to prevent HTTP Timeout & 504 errors on massive scans
	go func() {
		defer func() {
			if r := recover(); r != nil {
				h.App.Logger.Error().Interface("panic", r).Msg("scan: panic during background library scan")
			}
		}()
		defer globalScanActive.Store(false)
		defer func() {
			if err := scanLogger.Done(); err != nil {
				h.App.Logger.Warn().Err(err).Msg("scan: could not close the scan log")
			}
		}()

		// Timeout safety: if any external API or DB call hangs indefinitely,
		// globalScanActive would never be reset without this. Also cancels immediately on shutdown.
		scanCtx, scanCancel := context.WithTimeout(h.App.ShutdownCtx(), 2*time.Hour)
		defer scanCancel()

		allLfs, err := sc.Scan(scanCtx)
		if err != nil {
			if !errors.Is(err, scanner.ErrNoLocalFiles) {
				h.App.Logger.Error().Err(err).Msg("Failed background library scan")
				// Notify the frontend so it can display an error to the user
				h.App.WSEventManager.SendEvent("SCAN_ERROR", err.Error())
			}
			return
		}

		// Insert the local files
		_, err = db.InsertLocalFiles(h.App.Database, allLfs)
		if err != nil {
			h.App.Logger.Error().Err(err).Msg("Failed to insert local files after scan")
			return
		}

		// Save the shelved local files
		err = db.SaveShelvedLocalFiles(h.App.Database, sc.GetShelvedLocalFiles())
		if err != nil {
			h.App.Logger.Error().Err(err).Msg("Failed to save shelved files after scan")
			return
		}

		// Warm the media-info (ffprobe) cache in the background so the first play of
		// any freshly scanned file skips the cold-start probe. Best-effort.
		if h.App.MediastreamRepository != nil {
			paths := make([]string, 0, len(allLfs))
			for _, lf := range allLfs {
				if lf != nil && lf.Path != "" {
					paths = append(paths, lf.Path)
				}
			}
			h.App.StartBackground(func() {
				defer func() {
					if r := recover(); r != nil {
						h.App.Logger.Warn().Interface("panic", r).Msg("scan: panic during WarmMediaInfo")
					}
				}()
				h.App.MediastreamRepository.WarmMediaInfoContext(h.App.ShutdownCtx(), paths)
			})
		}

		// Save the scan summary
		_ = db.InsertScanSummary(h.App.Database, scanSummaryLogger.GenerateSummary())

		// Force WAL checkpoint to consolidate WAL changes to main DB
		h.App.Database.Gorm().Exec("PRAGMA wal_checkpoint(PASSIVE);")

		// Post-scan maintenance tasks executed under scanCtx before clearing scan lock
		ClearLibraryCollectionCache()
		h.prewarmShelfImages(0) // series nuevas: sus fondos al disco local
		// Frames que faltan, en segundo plano y de a uno.
		h.warmThumbnailsAfterScan(2 * time.Second)
		if h.App.Metadata.Platform != nil {
			_, _ = h.App.Metadata.Platform.RefreshAnimeCollection(scanCtx)
		}
	}()

	// Respond immediately (202 Accepted logic).
	// Sending an empty array `[]` avoids React TypeScript schema mismatches on the Frontend.
	return h.RespondWithData(c, make([]interface{}, 0))

}

// HandleGetUnlinkedFiles ...
//
//	@summary returns all files the scanner failed to identify.
//	@desc These are files stored as GhostAssociations in the database.
//	@route /api/v1/library/unlinked [GET]
//	@returns []models.GhostAssociatedMedia
func (h *Handler) HandleGetUnlinkedFiles(c echo.Context) error {
	associations, err := h.App.Database.GetAllGhostAssociations()
	if err != nil {
		return h.RespondWithError(c, err)
	}
	return h.RespondWithData(c, associations)
}

// HandleResolveUnlinkedFile ...
//
//	@summary manually links an unrecognized file to a media ID.
//	@desc Persists the user's choice as a Ghost Association so the next scan picks it up.
//	@route /api/v1/library/unlinked/resolve [POST]
func (h *Handler) HandleResolveUnlinkedFile(c echo.Context) error {
	type body struct {
		Path          string `json:"path"`
		TargetMediaID int    `json:"targetMediaId"`
	}
	var b body
	if err := c.Bind(&b); err != nil {
		return h.RespondWithError(c, err)
	}
	if b.Path == "" || b.TargetMediaID == 0 {
		return h.RespondWithCodeError(c, 400, errors.New("path and targetMediaId are required"))
	}
	if err := h.App.Database.ResolveGhostAssociation(b.Path, b.TargetMediaID); err != nil {
		return h.RespondWithError(c, err)
	}
	return h.RespondWithData(c, map[string]any{"ok": true})
}
