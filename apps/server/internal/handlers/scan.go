package handlers

import (
	"context"
	"errors"
	"sync/atomic"

	"kamehouse/internal/database/db"
	"kamehouse/internal/library/scanner"
	"kamehouse/internal/library/summary"

	"github.com/labstack/echo/v4"
)

var globalScanActive atomic.Bool

// HandleScanLocalFiles
//
//	@summary scans the user's library.
//	@desc This will scan the user's library.
//	@desc The response is ignored, the client should re-fetch the library after this.
//	@route /api/v1/library/scan [POST]
//	@returns []dto.LocalFile
func (h *Handler) HandleScanLocalFiles(c echo.Context) error {

	type body struct {
		Enhanced                   bool `json:"enhanced"`
		EnhanceWithOfflineDatabase bool `json:"enhanceWithOfflineDatabase"`
		SkipLockedFiles            bool `json:"skipLockedFiles"`
		SkipIgnoredFiles           bool `json:"skipIgnoredFiles"`
	}

	var b body
	if err := c.Bind(&b); err != nil {
		return h.RespondWithError(c, err)
	}

	if h.App.Settings == nil {
		return h.RespondWithError(c, errors.New("ajustes no encontrados, por favor configura la biblioteca primero"))
	}

	// Retrieve the user's library path
	libraryPaths := h.App.Settings.GetLibrary().GetAllPaths()
	if len(libraryPaths) == 0 {
		return h.RespondWithError(c, errors.New("no hay carpetas de origen configuradas"))
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

	// Get the latest shelved local files
	existingShelvedLfs, err := db.GetShelvedLocalFiles(h.App.Database)
	if err != nil {
		return h.RespondWithError(c, err)
	}

	// +---------------------+
	// |   Concurrent Lock   |
	// +---------------------+
	
	if !globalScanActive.CompareAndSwap(false, true) {
		return h.RespondWithError(c, errors.New("ya hay un escaneo de biblioteca en curso, por favor espera"))
	}

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
	sc := scanner.Scanner{
		DirPath:                    libraryPath,
		OtherDirPaths:              additionalLibraryPaths,
		SeriesPaths:                h.App.Settings.GetLibrary().SeriesPaths,
		MoviePaths:                 h.App.Settings.GetLibrary().MoviePaths,
		Enhanced:                   b.Enhanced,
		EnhanceWithOfflineDatabase: b.EnhanceWithOfflineDatabase,
		PlatformRef:                h.App.Metadata.PlatformRef,
		Logger:                     h.App.Logger,
		WSEventManager:             h.App.WSEventManager,
		EventDispatcher:            h.App.WSEventManager.Dispatcher(),
		ExistingLocalFiles:         existingLfs,
		SkipLockedFiles:            b.SkipLockedFiles,
		SkipIgnoredFiles:           b.SkipIgnoredFiles,
		ScanSummaryLogger:          scanSummaryLogger,
		ScanLogger:                 scanLogger,
		Database:                   h.App.Database,
		MetadataProviderRef:        h.App.Metadata.ProviderRef,
		MatchingAlgorithm:          h.App.Settings.GetLibrary().ScannerMatchingAlgorithm,
		MatchingThreshold:          h.App.Settings.GetLibrary().ScannerMatchingThreshold,
		UseLegacyMatching:          h.App.Settings.GetLibrary().ScannerUseLegacyMatching,
		StrictStructure:            h.App.Settings.GetLibrary().ScannerStrictStructure,
		WithShelving:               true,
		ExistingShelvedFiles:       existingShelvedLfs,
		ConfigAsString:             h.App.Settings.GetLibrary().ScannerConfig,
		AnimeCollection:            ac,
		UseTMDB:                    h.App.Settings.GetLibrary().ScannerProvider == "tmdb",
		TMDBClient:                 h.App.Metadata.TMDBClient,
		FanArtEnricher:             h.App.Metadata.FanArt,
		OMDbEnricher:               h.App.Metadata.OMDb,
		OpenSubsEnricher:           h.App.Metadata.OpenSubs,
	}

	// EXECUTE ASYNCHRONOUSLY to prevent HTTP Timeout & 504 errors on massive scans
	go func() {
		defer globalScanActive.Store(false)
		defer scanLogger.Done()

		allLfs, err := sc.Scan(context.Background())
		if err != nil {
			if !errors.Is(err, scanner.ErrNoLocalFiles) {
				h.App.Logger.Error().Err(err).Msg("Failed background library scan")
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

		// Save the scan summary
		_ = db.InsertScanSummary(h.App.Database, scanSummaryLogger.GenerateSummary())

		// Background maintenance tasks
		go h.App.AutoDownloader.CleanUpDownloadedItems()
		go func() {
			_, _ = h.App.Metadata.PlatformRef.Get().RefreshAnimeCollection(context.Background())
		}()
	}()

	// Respond immediately (202 Accepted logic). 
	// Sending an empty array `[]` avoids React TypeScript schema mismatches on the Frontend.
	return h.RespondWithData(c, make([]interface{}, 0))

}

// HandleGetScanStatus
//
//	@summary returns the latest scan summary.
//	@desc Returns metadata about the most recent library scan:
//	@desc  - timestamp, duration, matched/unmatched file counts, errors.
//	@desc Clients can poll this endpoint instead of relying solely on WebSocket events.
//	@route /api/v1/library/scan/status [GET]
//	@returns dto.ScanSummaryItem
func (h *Handler) HandleGetScanStatus(c echo.Context) error {
	summaries, err := db.GetScanSummaries(h.App.Database)
	if err != nil {
		return h.RespondWithError(c, err)
	}

	if len(summaries) == 0 {
		return h.RespondWithData(c, map[string]any{
			"status":  "idle",
			"message": "No scan has been performed yet",
		})
	}

	// Return the most recent summary (GetScanSummaries returns them in insertion order).
	latest := summaries[len(summaries)-1]
	return h.RespondWithData(c, map[string]any{
		"status":      "done",
		"lastScanAt":  latest.CreatedAt,
		"summary":     latest.ScanSummary,
	})
}
// HandleGetUnlinkedFiles
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

// HandleResolveUnlinkedFile
//
//	@summary manually links an unrecognized file to a media ID.
//	@desc Persists the user's choice as a Ghost Association so the next scan picks it up.
//	@route /api/v1/library/unlinked/resolve [POST]
func (h *Handler) HandleResolveUnlinkedFile(c echo.Context) error {
	type body struct {
		Path          string `json:"path"`
		TargetMediaId int    `json:"targetMediaId"`
	}
	var b body
	if err := c.Bind(&b); err != nil {
		return h.RespondWithError(c, err)
	}
	if b.Path == "" || b.TargetMediaId == 0 {
		return h.RespondWithError(c, errors.New("path and targetMediaId are required"))
	}
	if err := h.App.Database.ResolveGhostAssociation(b.Path, b.TargetMediaId); err != nil {
		return h.RespondWithError(c, err)
	}
	return h.RespondWithData(c, map[string]any{"ok": true})
}
