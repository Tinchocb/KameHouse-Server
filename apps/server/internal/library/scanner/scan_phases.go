package scanner

import (
	"context"
	"errors"
	"fmt"
	"kamehouse/internal/database/models/dto"
	"kamehouse/internal/events"
	"kamehouse/internal/library/summary"
	"time"

	"github.com/samber/lo"
)

// scanFinalizePhase sends completion events, merges skipped files, and logs scan summary.
func (scn *Scanner) scanFinalizePhase(
	localFiles []*dto.LocalFile,
	skippedLfs map[string]*dto.LocalFile,
	sortedLibraryPaths []string,
	mc *MediaContainer,
	mf *MediaFetcher,
) []*dto.LocalFile {
	if scn.WSEventManager != nil {
		scn.WSEventManager.SendEvent(events.EventScanProgress, 90)
		scn.WSEventManager.SendEvent(events.EventScanStatus, "Verifying file integrity...")
		scn.WSEventManager.SendEvent(events.EventScanProgressDetailed, map[string]interface{}{
			"stage":   "integrity-check",
			"message": "Verifying file integrity and merging results...",
		})
	}

	if len(skippedLfs) > 0 {
		for _, sf := range skippedLfs {
			if sf == nil {
				continue
			}
			localFiles = append(localFiles, sf)
		}
	}

	scn.ScanSummaryLogger.HydrateData(localFiles, mc.NormalizedMedia, nil)

	scn.addRemainingShelvedFiles(skippedLfs, sortedLibraryPaths)

	scn.Logger.Info().Msg("scanner: Scan completed")
	if scn.WSEventManager != nil {
		scn.WSEventManager.SendEvent(events.EventScanProgress, 100)
		scn.WSEventManager.SendEvent(events.EventScanStatus, "Scan completed")
	}

	if scn.ScanLogger != nil {
		scn.ScanLogger.logger.Info().
			Int("count", len(localFiles)).
			Int("unknownMediaCount", len(mf.UnknownMediaIds)).
			Msg("Scan completed")
	}

	if scn.EventDispatcher != nil {
		scn.EventDispatcher.Publish(events.Event{
			Topic: "library.scan",
			Payload: map[string]any{
				"status":          "FINISH",
				"total_processed": len(localFiles),
			},
		})
	}

	return localFiles
}

// prepareScanConfig resuelve la configuración de matching del escaneo.
func (scn *Scanner) prepareScanConfig() {
	if scn.ScanSummaryLogger == nil {
		scn.ScanSummaryLogger = summary.NewScanSummaryLogger()
	}

	if scn.ConfigAsString != "" && scn.Config == nil {
		scn.Config, _ = ToConfig(scn.ConfigAsString)
	}
	if scn.Config == nil {
		scn.Config = &Config{}
	}
	scn.Config.Matching.StrictStructure = scn.StrictStructure
}

// gatherLocalFiles obtiene los archivos a procesar: en modo "metadata" los ya
// conocidos; si no, descubre rutas, separa los que no hace falta re-escanear
// (skippedLfs) y parsea el resto.
func (scn *Scanner) gatherLocalFiles(ctx context.Context, telemetry *scanTelemetry) (
	localFiles []*dto.LocalFile,
	skippedLfs map[string]*dto.LocalFile,
	libraryPaths []string,
	sortedLibraryPaths []string,
) {
	skippedLfs = make(map[string]*dto.LocalFile)

	if scn.ScanMode == "metadata" {
		scn.Logger.Info().Msg("scanner: Running in metadata improvement mode. Skipping file matching and probing.")
		telemetry.Send(events.EventScanStatus, "Loading existing library files...")
		localFiles = append([]*dto.LocalFile(nil), scn.ExistingLocalFiles...)
		libraryPaths = append([]string{scn.DirPath}, scn.OtherDirPaths...)
	} else {
		// +---------------------+
		// |     File paths      |
		// +---------------------+

		var paths []string
		paths, libraryPaths, sortedLibraryPaths = scn.discoverFilePaths(ctx, time.Time{})

		if scn.ScanLogger != nil {
			scn.ScanLogger.logger.Info().
				Any("count", len(paths)).
				Msg("Retrieved file paths from all directories")
		}

		// +---------------------+
		// |    Local files      |
		// +---------------------+

		// Archivos ya conocidos que no hace falta re-escanear.
		skippedLfs = scn.collectSkippedLocalFiles(sortedLibraryPaths)

		telemetry.Send(events.EventScanProgress, 20)
		telemetry.Send(events.EventScanStatus, "Verifying shelved files...")

		scn.unshelveReappearedFiles(skippedLfs)

		telemetry.Send(events.EventScanProgress, 30)
		telemetry.Send(events.EventScanStatus, "Scanning local files...")
		telemetry.Send(events.EventScanProgressDetailed, map[string]interface{}{
			"stage":     "file-retrieval",
			"fileCount": len(paths),
			"skipped":   len(skippedLfs),
			"message":   fmt.Sprintf("Found %d files (%d skipped)", len(paths), len(skippedLfs)),
		})

		localFiles = scn.createLocalFiles(ctx, paths, libraryPaths, skippedLfs)

		scn.logParsedLocalFiles(localFiles, skippedLfs)
	}
	return localFiles, skippedLfs, libraryPaths, sortedLibraryPaths
}

// finishEmptyScan cierra un escaneo sin archivos nuevos que procesar (todos
// omitidos, o se borró alguno): conserva los omitidos y los archivados.
func (scn *Scanner) finishEmptyScan(localFiles []*dto.LocalFile, skippedLfs map[string]*dto.LocalFile, sortedLibraryPaths []string) []*dto.LocalFile {
	if scn.WSEventManager != nil {
		scn.WSEventManager.SendEvent(events.EventScanProgress, 90)
		scn.WSEventManager.SendEvent(events.EventScanStatus, "Verifying file integrity...")
	}

	scn.Logger.Debug().Int("skippedLfs", len(skippedLfs)).Msgf("scanner: Adding skipped local files")
	// Add skipped files
	localFiles = scn.mergeSkippedFiles(localFiles, skippedLfs)

	// Add remaining shelved files
	scn.addRemainingShelvedFiles(skippedLfs, sortedLibraryPaths)

	scn.Logger.Debug().Msg("scanner: Scan completed")
	if scn.WSEventManager != nil {
		scn.WSEventManager.SendEvent(events.EventScanProgress, 100)
		scn.WSEventManager.SendEvent(events.EventScanStatus, "Scan completed")
	}

	if scn.EventDispatcher != nil {
		scn.EventDispatcher.Publish(events.Event{
			Topic: "library.scan",
			Payload: map[string]any{
				"status":          "FINISH",
				"total_processed": len(localFiles),
			},
		})
	}

	return localFiles
}

// fetchAndMatchMedia trae la media candidata de los proveedores y, salvo en
// modo "metadata", matchea cada archivo local contra ella.
func (scn *Scanner) fetchAndMatchMedia(ctx context.Context, localFiles []*dto.LocalFile, telemetry *scanTelemetry) (*MediaFetcher, *MediaContainer, error) {
	telemetry.Send(events.EventScanProgress, 40)
	if scn.Enhanced {
		telemetry.Send(events.EventScanStatus, "Fetching additional matching data...")
	} else {
		telemetry.Send(events.EventScanStatus, "Fetching media...")
	}

	// +---------------------+
	// |    NFO Support      |
	// +---------------------+

	if scn.ScanMode != "metadata" {
		scn.resolveNfoMetadata(ctx, localFiles)
	}
	// +---------------------+
	// |    MediaFetcher     |
	// +---------------------+

	// Clientes y proveedores de metadata (TMDB, AniList, Jikan, AniDB).
	sp := scn.buildMetadataProviders()
	tmdbClient, tmdbProvider, providers := sp.tmdbClient, sp.tmdbProvider, sp.providers

	mf, err := NewMediaFetcher(ctx, &MediaFetcherOptions{
		PlatformRef:             scn.PlatformRef,
		MetadataProviderRef:     scn.MetadataProviderRef,
		MetadataProviders:       providers,
		LocalFiles:              localFiles,
		Logger:                  scn.Logger,
		DisableAnimeCollection:  false,
		ScanLogger:              scn.ScanLogger,
		OptionalAnimeCollection: scn.AnimeCollection,
		TMDBProvider:            tmdbProvider,
		SeriesPaths:             scn.SeriesPaths,
		MoviePaths:              scn.MoviePaths,
		Database:                scn.Database,
		UnifiedScan:             scn.UnifiedScan,
	})
	if err != nil {
		return nil, nil, err
	}

	telemetry.Send(events.EventScanProgress, 50)
	telemetry.Send(events.EventScanStatus, "Matching local files...")

	// +---------------------+
	// |   MediaContainer    |
	// +---------------------+

	// TMDb client has already been initialized above

	// Create a new container for media
	mc := NewMediaContainer(&MediaContainerOptions{
		AllMedia:   mf.AllMedia,
		ScanLogger: scn.ScanLogger,
		TmdbClient: tmdbClient,
	})

	scn.Logger.Debug().
		Any("count", len(mc.NormalizedMedia)).
		Msg("media container: Media container created")

	// +---------------------+
	// |      Matcher        |
	// +---------------------+

	if scn.ScanMode != "metadata" {
		// Create a new matcher
		matcher := &Matcher{
			LocalFiles:        localFiles,
			MediaContainer:    mc,
			Logger:            scn.Logger,
			Database:          scn.Database,
			Threshold:         scn.MatchingThreshold,
			MatchingAlgorithm: scn.MatchingAlgorithm,
			StrictStructure:   scn.StrictStructure,
		}

		telemetry.Send(events.EventScanProgress, 60)

		err := matcher.MatchLocalFilesWithMedia()
		if err != nil {
			if errors.Is(err, ErrNoLocalFiles) {
				scn.Logger.Debug().Msg("scanner: Scan completed")
				telemetry.Send(events.EventScanProgress, 100)
				telemetry.Send(events.EventScanStatus, "Scan completed")
			}
			return nil, nil, err
		}
	}
	return mf, mc, nil
}

// hydrateAndPersist completa la metadata de los archivos matcheados, los une
// con los omitidos y persiste/enriquece la media en la base y la plataforma.
func (scn *Scanner) hydrateAndPersist(
	ctx context.Context,
	localFiles []*dto.LocalFile,
	skippedLfs map[string]*dto.LocalFile,
	libraryPaths []string,
	mf *MediaFetcher,
	mc *MediaContainer,
	telemetry *scanTelemetry,
) ([]*dto.LocalFile, error) {
	telemetry.Send(events.EventScanProgress, 70)
	telemetry.Send(events.EventScanStatus, "Hydrating metadata...")
	telemetry.Send(events.EventScanProgressDetailed, map[string]interface{}{
		"stage":      "matching-complete",
		"matched":    len(lo.Filter(localFiles, func(lf *dto.LocalFile, _ int) bool { return lf.MediaID != 0 })),
		"unmatched":  len(lo.Filter(localFiles, func(lf *dto.LocalFile, _ int) bool { return lf.MediaID == 0 })),
		"totalFiles": len(localFiles),
		"message":    "Matching complete, hydrating metadata...",
	})

	// +---------------------+
	// |    FileHydrator     |
	// +---------------------+

	// Create a new hydrator
	hydrator := &FileHydrator{
		AllMedia:            mc.NormalizedMedia,
		LocalFiles:          localFiles,
		MetadataProviderRef: scn.MetadataProviderRef,
		PlatformRef:         scn.PlatformRef,
		Logger:              scn.Logger,
		ScanLogger:          scn.ScanLogger,
		ScanSummaryLogger:   scn.ScanSummaryLogger,
		Config:              scn.Config,
	}
	hydrator.HydrateMetadata(ctx)

	telemetry.Send(events.EventScanProgress, 80)

	// +---------------------+
	// |  Add missing media  |
	// +---------------------+

	// Add non-added media entries to platform collection
	if len(mf.UnknownMediaIds) < 5 && scn.PlatformRef != nil {
		if scn.WSEventManager != nil {
			scn.WSEventManager.SendEvent(events.EventScanStatus, "Adding missing media to platform...")
		}

		if err := scn.PlatformRef.AddMediaToCollection(ctx, mf.UnknownMediaIds); err != nil {
			scn.Logger.Warn().Msg("scanner: An error occurred while adding media to collection: " + err.Error())
		}
	}

	// +---------------------+
	// |    Merge files      |
	// +---------------------+

	// Merge skipped files with scanned files before persistence so they are all accounted for
	// and their LibraryMediaId associations are verified/restored.
	if len(skippedLfs) > 0 {
		scn.Logger.Debug().Int("skippedLfs", len(skippedLfs)).Msg("scanner: Merging skipped local files before persistence")
		localFiles = scn.mergeSkippedFiles(localFiles, skippedLfs)
	}

	// IDs matcheados (más los de la colección) y cuáles son películas.
	allMatchedIds, movieIds := collectMatchedMedia(localFiles, mf.CollectionMediaIds, libraryPaths)

	// Create LibraryMedia DB records for each unique matched media
	// This is necessary so the collection can look them up and show entries in the UI
	scn.Logger.Info().
		Int("allMatchedIds", len(allMatchedIds)).
		Bool("dbIsNil", scn.Database == nil).
		Msg("scanner: Starting TMDB LibraryMedia persistence")
	if scn.Database != nil {

		// Persist LibraryMedia records and map IDs back to local files
		libraryMediaIdMap := scn.persistMatchedMedia(allMatchedIds, movieIds, mc.NormalizedMedia, localFiles)

		scn.Logger.Info().
			Int("totalMatched", len(allMatchedIds)).
			Int("libraryMediaCreated", len(libraryMediaIdMap)).
			Msg("scanner: TMDB LibraryMedia persistence completed")

		// Fetch enriched metadata (seasons, episodes, etc.)
		if err := scn.enrichMediaMetadata(ctx, libraryMediaIdMap, movieIds, localFiles); err != nil {
			return nil, err
		}
	}

	// Add media to platform collection (requires platform ref)
	if scn.PlatformRef != nil {
		allIds := make([]int, 0, len(allMatchedIds))
		for id := range allMatchedIds {
			allIds = append(allIds, id)
		}
		if len(allIds) > 0 {
			scn.Logger.Debug().Int("count", len(allIds)).Msg("scanner: Adding all matched media to platform collection")
			if err := scn.PlatformRef.AddMediaToCollection(ctx, allIds); err != nil {
				scn.Logger.Warn().Msg("scanner: An error occurred while adding TMDB media to collection: " + err.Error())
			}
		}
	}
	return localFiles, nil
}
