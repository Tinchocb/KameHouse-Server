package scanner

import (
	"context"
	"errors"

	"kamehouse/internal/api/metadata"
	"kamehouse/internal/api/metadata_provider"
	"kamehouse/internal/database/models/dto"
	"kamehouse/internal/library/summary"
	"kamehouse/internal/platforms/platform"
	"kamehouse/internal/util"
	"kamehouse/internal/util/comparison"
	"kamehouse/internal/util/limiter"
	"regexp"
	"runtime"
	"strconv"
	"time"

	"github.com/rs/zerolog"
	"github.com/samber/lo"
	"golang.org/x/sync/errgroup"
)

var calcRegex = regexp.MustCompile(`\{calc\(([^)]+)\)}`)

// FileHydrator hydrates the metadata of all (matched) LocalFiles.
// LocalFiles should already have their media ID hydrated.
type FileHydrator struct {
	LocalFiles          []*dto.LocalFile       // Local files to hydrate
	AllMedia            []*dto.NormalizedMedia // All media used to hydrate local files
	PlatformRef         platform.Platform
	MetadataProviderRef metadata_provider.Provider
	Logger              *zerolog.Logger
	ScanLogger          *ScanLogger                // optional
	ScanSummaryLogger   *summary.ScanSummaryLogger // optional
	ForceMediaId        int                        // optional - force all local files to have this media ID
	Config              *Config
	hydrationRules      map[string]*compiledHydrationRule
}

type compiledHydrationRule struct {
	regex        *regexp.Regexp
	rule         *HydrationRule
	fileRulesRgx map[string]*compiledHydrationFileRule
}

type compiledHydrationFileRule struct {
	regex *regexp.Regexp
	rule  *HydrationFileRule
}

// HydrateMetadata will hydrate the metadata of each LocalFile with the metadata of the matched platform.UnifiedMedia.
// It will divide the LocalFiles into groups based on their media ID and process each group in parallel.
func (fh *FileHydrator) HydrateMetadata(ctx context.Context) {
	start := time.Now()
	rateLimiter := limiter.NewLimiter(5*time.Second, 20)

	fh.Logger.Debug().Msg("hydrator: Starting metadata hydration")

	fh.precompileRules()

	// Group local files by media ID
	groups := lo.GroupBy(fh.LocalFiles, func(localFile *dto.LocalFile) int {
		return localFile.MediaID
	})

	// Remove the group with unmatched media
	delete(groups, 0)

	if fh.ScanLogger != nil {
		fh.ScanLogger.LogFileHydrator(zerolog.InfoLevel).
			Int("entryCount", len(groups)).
			Msg("Starting metadata hydration process")
	}

	maxWorkers := runtime.NumCPU()
	if maxWorkers < 4 {
		maxWorkers = 4
	}

	eg, ctx := errgroup.WithContext(ctx)
	eg.SetLimit(maxWorkers)

	for mID, files := range groups {
		if len(files) == 0 {
			continue
		}

		capturedMId := mID
		capturedFiles := files

		eg.Go(func() error {
			// Respect cancellation: once the parent scan ctx is cancelled,
			// stop launching work for the remaining groups.
			if err := ctx.Err(); err != nil {
				return err
			}
			fh.hydrateGroupMetadata(ctx, capturedMId, capturedFiles, rateLimiter)
			return nil
		})
	}
	_ = eg.Wait()

	if fh.ScanLogger != nil {
		fh.ScanLogger.LogFileHydrator(zerolog.InfoLevel).
			Int64("ms", time.Since(start).Milliseconds()).
			Msg("Finished metadata hydration")
	}
}

func (fh *FileHydrator) hydrateGroupMetadata(
	ctx context.Context,
	mID int,
	lfs []*dto.LocalFile, // Grouped local files
	rateLimiter *limiter.Limiter,
) {
	if ctx.Err() != nil {
		return
	}

	// Get the media
	media, found := lo.Find(fh.AllMedia, func(media *dto.NormalizedMedia) bool {
		return media.ID == mID
	})
	if !found {
		if fh.ScanLogger != nil {
			fh.ScanLogger.LogFileHydrator(zerolog.ErrorLevel).
				Int("mediaID", mID).
				Msg("Could not find media in FileHydrator options")
		}
		return
	}

	var (
		fetchedGroupMetadata bool
		groupMetadata        *metadata.AnimeMetadata

		fetchedForcedMetadata bool
		forcedMetadata        *metadata.AnimeMetadata
		forcedMetadataErr     error
	)

	// Process each local file in the group sequentially
	for _, lf := range lfs {

		func() {
			defer util.HandlePanicInModuleThenS("scanner/hydrator/hydrateGroupMetadata", func(stackTrace string) {
				lf.MediaID = 0
				/*Log*/
				if fh.ScanLogger != nil {
					fh.ScanLogger.LogFileHydrator(zerolog.ErrorLevel).
						Str("filename", lf.Name).
						Msg("Panic occurred, file un-matched")
				}
				if fh.ScanSummaryLogger != nil {
					fh.ScanSummaryLogger.LogPanic(lf, stackTrace)
				}
			})

			episode := -1

			// Apply hydration rule to the file
			if fh.applyHydrationRule(lf) {
				return
			}

			lf.Metadata.Type = dto.LocalFileTypeMain

			// Get episode number
			if len(lf.Metadata.Episodes) > 0 && lf.Metadata.Episodes[0] > 0 {
				episode = lf.Metadata.Episodes[0]
			} else if len(lf.ParsedData.Episode) > 0 {
				if ep, ok := util.StringToInt(lf.ParsedData.Episode); ok {
					episode = ep
					if len(lf.Metadata.Episodes) == 0 {
						lf.Metadata.Episodes = []int{ep}
					}
				}
			}

			// NC metadata
			if lf.IsProbablyNC() {
				lf.Metadata.Episode = 0
				lf.Metadata.AniDBEpisode = ""
				lf.Metadata.Type = dto.LocalFileTypeNC

				if episode > -1 {
					lf.Metadata.Episode = episode
					// Parse OP/ED type from the filename and set AniDBEpisode for better tracking
					// e.g. "OP1", "ED2", etc.
					if ncType, ok := comparison.ExtractNCType(lf.Name); ok {
						lf.Metadata.AniDBEpisode = ncType + strconv.Itoa(episode)
					}
				}

				/*Log */
				if fh.ScanLogger != nil {
					fh.logFileHydration(zerolog.DebugLevel, lf, mID, episode).
						Msg("File has been marked as NC")
				}
				fh.ScanSummaryLogger.LogMetadataNC(lf)
				return
			}

			// Special metadata
			if lf.IsProbablySpecial() {
				lf.Metadata.Type = dto.LocalFileTypeSpecial
				// Sometimes a movie filename could be written as a special episode of the main series
				// anidb rarely if ever adds relevant specials to movie entries
				if media.Format != nil && *media.Format == dto.MediaFormatMovie {
					lf.Metadata.Episode = 1
					lf.Metadata.AniDBEpisode = "1"
					lf.Metadata.Type = dto.LocalFileTypeMain
				} else if episode > -1 {
					// ep14 (13 original) -> ep1 s1
					if episode > dto.GetCurrentEpisodeCount(media) {
						lf.Metadata.Episode = episode - dto.GetCurrentEpisodeCount(media)
						lf.Metadata.AniDBEpisode = "S" + strconv.Itoa(episode-dto.GetCurrentEpisodeCount(media))
					} else {
						lf.Metadata.Episode = episode
						lf.Metadata.AniDBEpisode = "S" + strconv.Itoa(episode)
					}
				} else {
					lf.Metadata.Episode = 1
					lf.Metadata.AniDBEpisode = "S1"
				}

				/*Log */
				if fh.ScanLogger != nil {
					fh.logFileHydration(zerolog.DebugLevel, lf, mID, episode).
						Msg("File has been marked as special")
				}
				fh.ScanSummaryLogger.LogMetadataSpecial(lf, lf.Metadata.Episode, lf.Metadata.AniDBEpisode)
				return
			}
			// Movie metadata
			if media.Format != nil && *media.Format == dto.MediaFormatMovie {
				lf.Metadata.Episode = 1
				lf.Metadata.AniDBEpisode = "1"

				/*Log */
				if fh.ScanLogger != nil {
					fh.logFileHydration(zerolog.DebugLevel, lf, mID, episode).
						Msg("File has been marked as main")
				}
				fh.ScanSummaryLogger.LogMetadataMain(lf, lf.Metadata.Episode, lf.Metadata.AniDBEpisode)
				return
			}

			// No absolute episode count
			// "dto.GetTotalEpisodeCount(media) == -1" is a fix for media with unknown episode count, we will just assume that the episode number is correct
			// devnote(don't know if this is still revelant): We might want to fetch the media when the episode count is unknown in order to get the correct episode count
			if episode > -1 && (episode <= dto.GetCurrentEpisodeCount(media) || dto.GetTotalEpisodeCount(media) == -1) {
				// Episode 0 - Might be a special
				// By default, we will assume that AniDB doesn't include Episode 0 as part of the main episodes (which is often the case)
				if episode == 0 {
					// Leave episode number as 0, assuming that the client will handle tracking correctly
					lf.Metadata.Episode = 0
					lf.Metadata.AniDBEpisode = "S1"

					/*Log */
					if fh.ScanLogger != nil {
						fh.logFileHydration(zerolog.DebugLevel, lf, mID, episode).
							Msg("File has been marked as main")
					}
					fh.ScanSummaryLogger.LogMetadataEpisodeZero(lf, lf.Metadata.Episode, lf.Metadata.AniDBEpisode)
					return
				}

				lf.Metadata.Episode = episode
				lf.Metadata.AniDBEpisode = strconv.Itoa(episode)

				/*Log */
				if fh.ScanLogger != nil {
					fh.logFileHydration(zerolog.DebugLevel, lf, mID, episode).
						Msg("File has been marked as main")
				}
				fh.ScanSummaryLogger.LogMetadataMain(lf, lf.Metadata.Episode, lf.Metadata.AniDBEpisode)
				return
			}

			// Episode number is higher but media only has 1 episode
			// - Might be a movie that was not correctly identified as such
			// - Or, the torrent files were divided into multiple episodes from a media that is listed as a movie on the metadata provider
			if episode > dto.GetCurrentEpisodeCount(media) && dto.GetTotalEpisodeCount(media) == 1 {
				lf.Metadata.Episode = 1 // Coerce episode number to 1 because it is used for tracking
				lf.Metadata.AniDBEpisode = "1"

				/*Log */
				if fh.ScanLogger != nil {
					fh.logFileHydration(zerolog.WarnLevel, lf, mID, episode).
						Str("warning", "File's episode number is higher than the media's episode count, but the media only has 1 episode").
						Msg("File has been marked as main")
				}
				fh.ScanSummaryLogger.LogMetadataMain(lf, lf.Metadata.Episode, lf.Metadata.AniDBEpisode)
				return
			}

			// No episode number, but the media only has 1 episode
			if episode == -1 && dto.GetCurrentEpisodeCount(media) == 1 {
				lf.Metadata.Episode = 1 // Coerce episode number to 1 because it is used for tracking
				lf.Metadata.AniDBEpisode = "1"

				/*Log */
				if fh.ScanLogger != nil {
					fh.logFileHydration(zerolog.WarnLevel, lf, mID, episode).
						Str("warning", "No episode number found, but the media only has 1 episode").
						Msg("File has been marked as main")
				}
				fh.ScanSummaryLogger.LogMetadataMain(lf, lf.Metadata.Episode, lf.Metadata.AniDBEpisode)
				return
			}

			// Still no episode number and the media has more than 1 episode and is not a movie
			// We will mark it as a special episode
			// devnote: Mark as NC?
			if episode == -1 {
				lf.Metadata.Type = dto.LocalFileTypeSpecial
				lf.Metadata.Episode = 1
				lf.Metadata.AniDBEpisode = "S1"

				/*Log */
				if fh.ScanLogger != nil {
					fh.logFileHydration(zerolog.ErrorLevel, lf, mID, episode).
						Msg("No episode number found, file has been marked as special")
				}
				fh.ScanSummaryLogger.LogMetadataEpisodeNormalizationFailed(lf, errors.New("no episode number found"), lf.Metadata.Episode, lf.Metadata.AniDBEpisode)
				return
			}

			// Absolute episode count
			if episode > dto.GetCurrentEpisodeCount(media) && fh.ForceMediaId == 0 {

				// Check if this media belongs to the Dragon Ball franchise and has canonical sagas
				maxDbEp := 0
				tmdbId := mID
				if media.TmdbID != nil && *media.TmdbID > 0 {
					tmdbId = *media.TmdbID
				}
				if dbSagas := GetDragonBallSagas(tmdbId); len(dbSagas) > 0 {
					maxDbEp = dbSagas[len(dbSagas)-1].endEp
				}

				if maxDbEp > 0 && episode <= maxDbEp {
					lf.Metadata.Episode = episode
					lf.Metadata.AniDBEpisode = strconv.Itoa(episode)
					lf.Metadata.Type = dto.LocalFileTypeMain
					if fh.ScanLogger != nil {
						fh.logFileHydration(zerolog.DebugLevel, lf, mID, episode).
							Msg("File normalized via Dragon Ball saga definition")
					}
					fh.ScanSummaryLogger.LogMetadataMain(lf, lf.Metadata.Episode, lf.Metadata.AniDBEpisode)
					return
				}

				// Try part-relative normalization before expensive media tree analysis.
				// This handles cases where filenames use numbering relative to a previous part of the same season
				// (e.g., S04E12 for the first episode of Part 2, where Part 1 had 11 episodes).
				if !fetchedGroupMetadata && fh.MetadataProviderRef != nil {
					// Con ctx el Wait vuelve en cuanto se cancela el escaneo (antes quedaba
					// bloqueado hasta que el limitador liberaba su turno).
					if rateLimiter.Wait(ctx) == nil {
						groupMetadata, _ = fh.MetadataProviderRef.GetAnimeMetadata(mID)
					}
					fetchedGroupMetadata = true
				}

				if relativeEp, ok := fh.tryPartRelativeNormalization(lf, episode, mID, groupMetadata); ok {
					lf.Metadata.Episode = relativeEp
					lf.Metadata.AniDBEpisode = strconv.Itoa(relativeEp)

					/*Log */
					if fh.ScanLogger != nil {
						fh.logFileHydration(zerolog.DebugLevel, lf, mID, episode).
							Dict("partRelativeNormalization", zerolog.Dict().
								Bool("normalized", true).
								Int("relativeEpisode", relativeEp),
							).
							Msg("File normalized via part-relative detection")
					}
					fh.ScanSummaryLogger.LogMetadataMain(lf, lf.Metadata.Episode, lf.Metadata.AniDBEpisode)
					return
				}

				// Media tree analysis skipped during migration
				diff := episode - dto.GetCurrentEpisodeCount(media)
				lf.Metadata.Episode = diff
				lf.Metadata.AniDBEpisode = "S" + strconv.Itoa(diff)
				lf.Metadata.Type = dto.LocalFileTypeSpecial

				/*Log */
				if fh.ScanLogger != nil {
					fh.logFileHydration(zerolog.WarnLevel, lf, mID, episode).
						Dict("mediaTreeAnalysis", zerolog.Dict().
							Bool("normalized", false).
							Str("reason", "Episode normalization failed (tree analysis disabled)")).
						Msg("File has been marked as special")
				}
				fh.ScanSummaryLogger.LogMetadataEpisodeNormalizationFailed(lf, errors.New("tree analysis disabled"), lf.Metadata.Episode, lf.Metadata.AniDBEpisode)
				return
			}

			// Absolute episode count with forced media ID
			if fh.ForceMediaId != 0 && episode > dto.GetCurrentEpisodeCount(media) {

				// When we encounter a file with an episode number higher than the media's episode count
				// we have a forced media ID, we will fetch the media from TMDB and get the offset
				if !fetchedForcedMetadata && fh.MetadataProviderRef != nil {
					if forcedMetadataErr = rateLimiter.Wait(ctx); forcedMetadataErr == nil {
						forcedMetadata, forcedMetadataErr = fh.MetadataProviderRef.GetAnimeMetadata(fh.ForceMediaId)
					}
					fetchedForcedMetadata = true
				}

				if forcedMetadataErr != nil {
					/*Log */
					if fh.ScanLogger != nil {
						fh.logFileHydration(zerolog.ErrorLevel, lf, mID, episode).
							Str("error", forcedMetadataErr.Error()).
							Msg("Could not fetch TMDB metadata")
					}
					lf.Metadata.Episode = episode
					lf.Metadata.AniDBEpisode = strconv.Itoa(episode)
					lf.MediaID = fh.ForceMediaId
					fh.ScanSummaryLogger.LogMetadataEpisodeNormalizationFailed(lf, errors.New("could not fetch TMDB metadata"), lf.Metadata.Episode, lf.Metadata.AniDBEpisode)
					return
				}

				// Get the first episode to calculate the offset
				firstEp, ok := forcedMetadata.Episodes["1"]
				if !ok {
					/*Log */
					if fh.ScanLogger != nil {
						fh.logFileHydration(zerolog.ErrorLevel, lf, mID, episode).
							Msg("Could not find absolute episode offset")
					}
					lf.Metadata.Episode = episode
					lf.Metadata.AniDBEpisode = strconv.Itoa(episode)
					lf.MediaID = fh.ForceMediaId
					fh.ScanSummaryLogger.LogMetadataEpisodeNormalizationFailed(lf, errors.New("could not find absolute episode offset"), lf.Metadata.Episode, lf.Metadata.AniDBEpisode)
					return
				}

				// ref: media_tree_analysis.go
				usePartEpisodeNumber := firstEp.EpisodeNumber > 1 && firstEp.AbsoluteEpisodeNumber-firstEp.EpisodeNumber > 1
				minPartAbsoluteEpisodeNumber := 0
				maxPartAbsoluteEpisodeNumber := 0
				if usePartEpisodeNumber {
					minPartAbsoluteEpisodeNumber = firstEp.EpisodeNumber
					maxPartAbsoluteEpisodeNumber = minPartAbsoluteEpisodeNumber + forcedMetadata.GetMainEpisodeCount() - 1
				}

				absoluteEpisodeNumber := firstEp.AbsoluteEpisodeNumber

				// Calculate the relative episode number
				var relativeEp int

				// Let's say the media has 12 episodes and the file is "episode 13"
				// If the [partAbsoluteEpisodeNumber] is 13, then the [relativeEp] will be 1, we can safely ignore the [absoluteEpisodeNumber]
				// e.g. 13 - (13-1) = 1
				if minPartAbsoluteEpisodeNumber <= episode && maxPartAbsoluteEpisodeNumber >= episode {
					relativeEp = episode - (minPartAbsoluteEpisodeNumber - 1)
				} else {
					// Let's say the media has 12 episodes and the file is "episode 38"
					// The [absoluteEpisodeNumber] will be 38 and the [relativeEp] will be 1
					// e.g. 38 - (38-1) = 1
					relativeEp = episode - (absoluteEpisodeNumber - 1)
				}

				if relativeEp < 1 {
					if fh.ScanLogger != nil {
						fh.logFileHydration(zerolog.WarnLevel, lf, mID, episode).
							Dict("normalization", zerolog.Dict().
								Bool("normalized", false).
								Str("reason", "Episode normalization failed, could not find relative episode number"),
							).
							Msg("File has been marked as main")
					}
					lf.Metadata.Episode = episode
					lf.Metadata.AniDBEpisode = strconv.Itoa(episode)
					lf.MediaID = fh.ForceMediaId
					fh.ScanSummaryLogger.LogMetadataEpisodeNormalizationFailed(lf, errors.New("could not find relative episode number"), lf.Metadata.Episode, lf.Metadata.AniDBEpisode)
					return
				}

				if fh.ScanLogger != nil {
					fh.logFileHydration(zerolog.DebugLevel, lf, mID, relativeEp).
						Dict("mediaTreeAnalysis", zerolog.Dict().
							Bool("normalized", true).
							Int("forcedMediaId", fh.ForceMediaId),
						).
						Msg("File has been marked as main")
				}
				lf.Metadata.Episode = relativeEp
				lf.Metadata.AniDBEpisode = strconv.Itoa(relativeEp)
				lf.MediaID = fh.ForceMediaId
				fh.ScanSummaryLogger.LogMetadataMain(lf, lf.Metadata.Episode, lf.Metadata.AniDBEpisode)
				return

			}

		}() // Call anonymous function to mimic what lop.ForEach did for defers

	} // end for loop

}
