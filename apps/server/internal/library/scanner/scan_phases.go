package scanner

import (
	"context"
	"runtime"
	"strconv"
	"sync"

	"kamehouse/internal/database/db"
	"kamehouse/internal/database/models"
	"kamehouse/internal/database/models/dto"
	"kamehouse/internal/events"
	librarymetadata "kamehouse/internal/library/metadata"
	"kamehouse/internal/util"
)

// scanEnrichmentPhase runs optional metadata enrichers (FanArt, OMDb, OpenSubtitles) in parallel.
func (scn *Scanner) scanEnrichmentPhase(ctx context.Context, localFiles []*dto.LocalFile, mc *MediaContainer, tmdbProvider *librarymetadata.TMDBProvider) {
	if scn.FanArtEnricher == nil && scn.OMDbEnricher == nil && scn.OpenSubsEnricher == nil {
		return
	}

	scn.Logger.Info().Msg("scanner: running optional metadata enrichers")
	normalizedMap := make(map[int]*dto.NormalizedMedia)
	for _, nm := range mc.NormalizedMedia {
		normalizedMap[nm.ID] = nm
	}

	mediaGroups := make(map[int][]*dto.LocalFile)
	for _, lf := range localFiles {
		if lf.MediaID != 0 {
			mediaGroups[lf.MediaID] = append(mediaGroups[lf.MediaID], lf)
		}
	}

	enrichWorkers := runtime.NumCPU()
	if enrichWorkers < 2 {
		enrichWorkers = 2
	}
	if enrichWorkers > 8 {
		enrichWorkers = 8
	}

	mIdChan := make(chan int, len(mediaGroups))
	for mID := range mediaGroups {
		mIdChan <- mID
	}
	close(mIdChan)

	openSubsSem := make(chan struct{}, 2)

	var enrichWg sync.WaitGroup
	for i := 0; i < enrichWorkers; i++ {
		enrichWg.Add(1)
		go func() {
			defer enrichWg.Done()
			for mID := range mIdChan {
				matchedMedia, ok := normalizedMap[mID]
				if !ok {
					continue
				}

				if scn.FanArtEnricher != nil {
					isMovie := matchedMedia.ID >= 1_000_000 || (matchedMedia.Format != nil && *matchedMedia.Format == dto.MediaFormatMovie)
					if isMovie {
						realTmdbId := matchedMedia.ID
						if realTmdbId >= 1_000_000 {
							realTmdbId -= 1_000_000
						}
						_ = scn.FanArtEnricher.EnrichMovie(ctx, matchedMedia, realTmdbId)
					} else {
						tvdbID := ""
						if matchedMedia.TvdbId != nil {
							tvdbID = strconv.Itoa(*matchedMedia.TvdbId)
						}
						if tvdbID == "" && tmdbProvider != nil {
							extIds, err := tmdbProvider.GetClient().GetTVExternalIDs(ctx, matchedMedia.ID)
							if err == nil && extIds.TvdbID != "" {
								tvdbID = extIds.TvdbID
							}
						}
						if tvdbID != "" {
							_ = scn.FanArtEnricher.EnrichTV(ctx, matchedMedia, tvdbID)
						}
					}
				}

				if scn.OMDbEnricher != nil {
					if matchedMedia.Title != nil && matchedMedia.Title.UserPreferred != nil {
						year := 0
						if matchedMedia.Year != nil {
							year = *matchedMedia.Year
						}
						_ = scn.OMDbEnricher.EnrichByTitle(ctx, matchedMedia, *matchedMedia.Title.UserPreferred, year)
					}
				}

				if scn.OpenSubsEnricher != nil {
					var fileWg sync.WaitGroup
					for _, lf := range mediaGroups[mID] {
						season, episode := 0, 0
						if lf.ParsedData != nil {
							if lf.ParsedData.Season != "" {
								season, _ = util.StringToInt(lf.ParsedData.Season)
							}
							if lf.ParsedData.Episode != "" {
								episode, _ = util.StringToInt(lf.ParsedData.Episode)
							}
						}
						fileWg.Add(1)
						go func(lf *dto.LocalFile, s, e int) {
							defer fileWg.Done()

							select {
							case openSubsSem <- struct{}{}:
								defer func() { <-openSubsSem }()
							case <-ctx.Done():
								return
							}

							_ = scn.OpenSubsEnricher.EnrichLocalFile(ctx, lf, matchedMedia, s, e)
						}(lf, season, episode)
					}
					fileWg.Wait()
				}
			}
		}()
	}
	enrichWg.Wait()
}

// scanFranchisePhase persists franchise/saga collections for scanned movies.
func (scn *Scanner) scanFranchisePhase(ctx context.Context, movieIds map[int]bool) {
	if scn.Database == nil || scn.TMDBClient == nil || len(movieIds) == 0 {
		return
	}

	scn.Logger.Info().Int("movieCount", len(movieIds)).Msg("scanner: Fetching BelongsToCollection for movies")

	realMovieIDs := make([]int, 0, len(movieIds))
	for normalizedID := range movieIds {
		if realMovieID := normalizedID - 1_000_000; realMovieID > 0 {
			realMovieIDs = append(realMovieIDs, realMovieID)
		}
	}

	var collectionMu sync.Mutex
	collectionMembers := make(map[int][]int)

	movieIDCh := make(chan int, len(realMovieIDs))
	for _, id := range realMovieIDs {
		movieIDCh <- id
	}
	close(movieIDCh)

	collWorkers := 5
	if len(realMovieIDs) < collWorkers {
		collWorkers = len(realMovieIDs)
	}
	var collWg sync.WaitGroup
	for w := 0; w < collWorkers; w++ {
		collWg.Add(1)
		go func() {
			defer collWg.Done()
			for realMovieID := range movieIDCh {
				if ctx.Err() != nil {
					return
				}
				details, detailErr := scn.TMDBClient.GetMovieDetailsV2(ctx, realMovieID)
				if detailErr != nil {
					scn.Logger.Debug().Err(detailErr).Int("tmdbID", realMovieID).Msg("scanner: Could not get movie details for collection lookup")
					continue
				}
				if details.BelongsToCollection != nil && details.BelongsToCollection.ID > 0 {
					collID := details.BelongsToCollection.ID
					collectionMu.Lock()
					collectionMembers[collID] = append(collectionMembers[collID], realMovieID)
					collectionMu.Unlock()
				}
			}
		}()
	}
	collWg.Wait()

	for collID, memberIDs := range collectionMembers {
		if ctx.Err() != nil {
			break
		}
		collDetails, collErr := scn.TMDBClient.GetCollection(ctx, collID)
		if collErr != nil {
			scn.Logger.Warn().Err(collErr).Int("collectionId", collID).Msg("scanner: Could not fetch collection details")
			continue
		}

		posterPath := ""
		backdropPath := ""
		if collDetails.PosterPath != "" {
			posterPath = "https://image.tmdb.org/t/p/original" + collDetails.PosterPath
		}
		if collDetails.BackdropPath != "" {
			backdropPath = "https://image.tmdb.org/t/p/original" + collDetails.BackdropPath
		}

		memberSlice := make(models.IntSlice, len(memberIDs))
		copy(memberSlice, memberIDs)

		coll := &models.MediaCollection{
			TMDBCollectionID: collID,
			Name:             collDetails.Name,
			Overview:         collDetails.Overview,
			PosterPath:       posterPath,
			BackdropPath:     backdropPath,
			MemberIDs:        memberSlice,
		}

		if upsertErr := db.UpsertMediaCollection(scn.Database, coll); upsertErr != nil {
			scn.Logger.Warn().Err(upsertErr).Int("collectionId", collID).Msg("scanner: Failed to upsert MediaCollection")
		} else {
			scn.Logger.Info().
				Int("collectionId", collID).
				Str("name", collDetails.Name).
				Int("members", len(memberIDs)).
				Msg("scanner: Persisted saga collection")
		}
	}
}

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
