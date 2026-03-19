package handlers

import (
	"context"
	"errors"

	"kamehouse/internal/database/db"
	"kamehouse/internal/library/scanner"
	"kamehouse/internal/library/summary"

	"github.com/labstack/echo/v4"
)

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
	// |       Scanner       |
	// +---------------------+

	// Create scan summary logger
	scanSummaryLogger := summary.NewScanSummaryLogger()

	// Create a new scan logger
	scanLogger, err := scanner.NewScanLogger(h.App.Config.Logs.Dir)
	if err != nil {
		return h.RespondWithError(c, err)
	}
	defer scanLogger.Done()

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
	}

	// Scan the library
	allLfs, err := sc.Scan(c.Request().Context())
	if err != nil {
		if errors.Is(err, scanner.ErrNoLocalFiles) {
			return h.RespondWithData(c, []interface{}{})
		}

		return h.RespondWithError(c, err)
	}

	// Insert the local files
	lfs, err := db.InsertLocalFiles(h.App.Database, allLfs)
	if err != nil {
		return h.RespondWithError(c, err)
	}

	// Save the shelved local files
	err = db.SaveShelvedLocalFiles(h.App.Database, sc.GetShelvedLocalFiles())
	if err != nil {
		return h.RespondWithError(c, err)
	}

	// Save the scan summary
	_ = db.InsertScanSummary(h.App.Database, scanSummaryLogger.GenerateSummary())

	go h.App.AutoDownloader.CleanUpDownloadedItems()

	go func() {
		_, _ = h.App.Metadata.PlatformRef.Get().RefreshAnimeCollection(context.Background())
	}()

	return h.RespondWithData(c, lfs)

}
