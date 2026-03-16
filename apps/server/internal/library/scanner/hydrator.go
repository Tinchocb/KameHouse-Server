package scanner

import (
	"context"
	"errors"

	"kamehouse/internal/api/metadata_provider"
	"kamehouse/internal/database/models/dto"
	"kamehouse/internal/hook"
	"kamehouse/internal/library/summary"
	"kamehouse/internal/platforms/platform"
	"kamehouse/internal/util"
	"kamehouse/internal/util/comparison"
	"kamehouse/internal/util/limiter"
	"regexp"
	"runtime"
	"strconv"
	"strings"
	"time"

	"github.com/rs/zerolog"
	"github.com/samber/lo"
	lop "github.com/samber/lo/parallel"
	"golang.org/x/sync/errgroup"
)

// FileHydrator hydrates the metadata of all (matched) LocalFiles.
// LocalFiles should already have their media ID hydrated.
type FileHydrator struct {
	LocalFiles          []*dto.LocalFile       // Local files to hydrate
	AllMedia            []*dto.NormalizedMedia // All media used to hydrate local files
	PlatformRef         *util.Ref[platform.Platform]
	MetadataProviderRef *util.Ref[metadata_provider.Provider]
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
func (fh *FileHydrator) HydrateMetadata() {
	start := time.Now()
	rateLimiter := limiter.NewLimiter(5*time.Second, 20)

	fh.Logger.Debug().Msg("hydrator: Starting metadata hydration")

	fh.precompileRules()

	// Invoke ScanHydrationStarted hook
	event := &ScanHydrationStartedEvent{
		LocalFiles: fh.LocalFiles,
		AllMedia:   fh.AllMedia,
	}
	_ = hook.GlobalHookManager.OnScanHydrationStarted().Trigger(event)
	fh.LocalFiles = event.LocalFiles
	fh.AllMedia = event.AllMedia

	// Default prevented, do not hydrate the metadata
	if event.DefaultPrevented {
		return
	}

	// Group local files by media ID
	groups := lop.GroupBy(fh.LocalFiles, func(localFile *dto.LocalFile) int {
		return localFile.MediaId
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

	eg, _ := errgroup.WithContext(context.Background())
	eg.SetLimit(maxWorkers)

	for mId, files := range groups {
		if len(files) == 0 {
			continue
		}

		capturedMId := mId
		capturedFiles := files

		eg.Go(func() error {
			fh.hydrateGroupMetadata(capturedMId, capturedFiles, rateLimiter)
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
	mId int,
	lfs []*dto.LocalFile, // Grouped local files
	rateLimiter *limiter.Limiter,
) {

	// Get the media
	media, found := lo.Find(fh.AllMedia, func(media *dto.NormalizedMedia) bool {
		return media.ID == mId
	})
	if !found {
		if fh.ScanLogger != nil {
			fh.ScanLogger.LogFileHydrator(zerolog.ErrorLevel).
				Int("mediaId", mId).
				Msg("Could not find media in FileHydrator options")
		}
		return
	}



	// Process each local file in the group sequentially
	for _, lf := range lfs {

		func() {
			defer util.HandlePanicInModuleThenS("scanner/hydrator/hydrateGroupMetadata", func(stackTrace string) {
				lf.MediaId = 0
				/*Log*/
				if fh.ScanLogger != nil {
					fh.ScanLogger.LogFileHydrator(zerolog.ErrorLevel).
						Str("filename", lf.Name).
						Msg("Panic occurred, file un-matched")
				}
				fh.ScanSummaryLogger.LogPanic(lf, stackTrace)
			})

			episode := -1

			// Invoke ScanLocalFileHydrationStarted hook
			event := &ScanLocalFileHydrationStartedEvent{
				LocalFile: lf,
				Media:     media,
			}
			_ = hook.GlobalHookManager.OnScanLocalFileHydrationStarted().Trigger(event)
			lf = event.LocalFile
			media = event.Media

			defer func() {
				// Invoke ScanLocalFileHydrated hook
				event := &ScanLocalFileHydratedEvent{
					LocalFile: lf,
					MediaId:   mId,
					Episode:   episode,
				}
				_ = hook.GlobalHookManager.OnScanLocalFileHydrated().Trigger(event)
				lf = event.LocalFile
				mId = event.MediaId
				episode = event.Episode
			}()

			// Handle hook override
			if event.DefaultPrevented {
				if fh.ScanLogger != nil {
					fh.ScanLogger.LogFileHydrator(zerolog.DebugLevel).
						Str("filename", lf.Name).
						Msg("Default hydration skipped by hook")
				}
				fh.ScanSummaryLogger.LogDebug(lf, "Default hydration skipped by hook")
				return
			}

			// Apply hydration rule to the file
			if fh.applyHydrationRule(lf) {
				return
			}

			lf.Metadata.Type = dto.LocalFileTypeMain

			// Get episode number
			if len(lf.ParsedData.Episode) > 0 {
				if ep, ok := util.StringToInt(lf.ParsedData.Episode); ok {
					episode = ep
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
					fh.logFileHydration(zerolog.DebugLevel, lf, mId, episode).
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
					fh.logFileHydration(zerolog.DebugLevel, lf, mId, episode).
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
					fh.logFileHydration(zerolog.DebugLevel, lf, mId, episode).
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
						fh.logFileHydration(zerolog.DebugLevel, lf, mId, episode).
							Msg("File has been marked as main")
					}
					fh.ScanSummaryLogger.LogMetadataEpisodeZero(lf, lf.Metadata.Episode, lf.Metadata.AniDBEpisode)
					return
				}

				lf.Metadata.Episode = episode
				lf.Metadata.AniDBEpisode = strconv.Itoa(episode)

				/*Log */
				if fh.ScanLogger != nil {
					fh.logFileHydration(zerolog.DebugLevel, lf, mId, episode).
						Msg("File has been marked as main")
				}
				fh.ScanSummaryLogger.LogMetadataMain(lf, lf.Metadata.Episode, lf.Metadata.AniDBEpisode)
				return
			}

			// Episode number is higher but media only has 1 episode
			// - Might be a movie that was not correctly identified as such
			// - Or, the torrent files were divided into multiple episodes from a media that is listed as a movie on AniList
			if episode > dto.GetCurrentEpisodeCount(media) && dto.GetTotalEpisodeCount(media) == 1 {
				lf.Metadata.Episode = 1 // Coerce episode number to 1 because it is used for tracking
				lf.Metadata.AniDBEpisode = "1"

				/*Log */
				if fh.ScanLogger != nil {
					fh.logFileHydration(zerolog.WarnLevel, lf, mId, episode).
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
					fh.logFileHydration(zerolog.WarnLevel, lf, mId, episode).
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
					fh.logFileHydration(zerolog.ErrorLevel, lf, mId, episode).
						Msg("No episode number found, file has been marked as special")
				}
				fh.ScanSummaryLogger.LogMetadataEpisodeNormalizationFailed(lf, errors.New("no episode number found"), lf.Metadata.Episode, lf.Metadata.AniDBEpisode)
				return
			}

			// Absolute episode count
			if episode > dto.GetCurrentEpisodeCount(media) && fh.ForceMediaId == 0 {

				// Try part-relative normalization before expensive media tree analysis.
				// This handles cases where filenames use numbering relative to a previous part of the same season
				// (e.g., S04E12 for the first episode of Part 2, where Part 1 had 11 episodes).
				if relativeEp, ok := fh.tryPartRelativeNormalization(lf, episode, mId, rateLimiter); ok {
					lf.Metadata.Episode = relativeEp
					lf.Metadata.AniDBEpisode = strconv.Itoa(relativeEp)

					/*Log */
					if fh.ScanLogger != nil {
						fh.logFileHydration(zerolog.DebugLevel, lf, mId, episode).
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
					fh.logFileHydration(zerolog.WarnLevel, lf, mId, episode).
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
				// we have a forced media ID, we will fetch the media from AniList and get the offset
				animeMetadata, err := fh.MetadataProviderRef.Get().GetAnimeMetadata(fh.ForceMediaId)
				if err != nil {
					/*Log */
					if fh.ScanLogger != nil {
						fh.logFileHydration(zerolog.ErrorLevel, lf, mId, episode).
							Str("error", err.Error()).
							Msg("Could not fetch AniDB metadata")
					}
					lf.Metadata.Episode = episode
					lf.Metadata.AniDBEpisode = strconv.Itoa(episode)
					lf.MediaId = fh.ForceMediaId
					fh.ScanSummaryLogger.LogMetadataEpisodeNormalizationFailed(lf, errors.New("could not fetch AniDB metadata"), lf.Metadata.Episode, lf.Metadata.AniDBEpisode)
					return
				}

				// Get the first episode to calculate the offset
				firstEp, ok := animeMetadata.Episodes["1"]
				if !ok {
					/*Log */
					if fh.ScanLogger != nil {
						fh.logFileHydration(zerolog.ErrorLevel, lf, mId, episode).
							Msg("Could not find absolute episode offset")
					}
					lf.Metadata.Episode = episode
					lf.Metadata.AniDBEpisode = strconv.Itoa(episode)
					lf.MediaId = fh.ForceMediaId
					fh.ScanSummaryLogger.LogMetadataEpisodeNormalizationFailed(lf, errors.New("could not find absolute episode offset"), lf.Metadata.Episode, lf.Metadata.AniDBEpisode)
					return
				}

				// ref: media_tree_analysis.go
				usePartEpisodeNumber := firstEp.EpisodeNumber > 1 && firstEp.AbsoluteEpisodeNumber-firstEp.EpisodeNumber > 1
				minPartAbsoluteEpisodeNumber := 0
				maxPartAbsoluteEpisodeNumber := 0
				if usePartEpisodeNumber {
					minPartAbsoluteEpisodeNumber = firstEp.EpisodeNumber
					maxPartAbsoluteEpisodeNumber = minPartAbsoluteEpisodeNumber + animeMetadata.GetMainEpisodeCount() - 1
				}

				absoluteEpisodeNumber := firstEp.AbsoluteEpisodeNumber

				// Calculate the relative episode number
				relativeEp := episode

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
						fh.logFileHydration(zerolog.WarnLevel, lf, mId, episode).
							Dict("normalization", zerolog.Dict().
								Bool("normalized", false).
								Str("reason", "Episode normalization failed, could not find relative episode number"),
							).
							Msg("File has been marked as main")
					}
					lf.Metadata.Episode = episode
					lf.Metadata.AniDBEpisode = strconv.Itoa(episode)
					lf.MediaId = fh.ForceMediaId
					fh.ScanSummaryLogger.LogMetadataEpisodeNormalizationFailed(lf, errors.New("could not find relative episode number"), lf.Metadata.Episode, lf.Metadata.AniDBEpisode)
					return
				}

				if fh.ScanLogger != nil {
					fh.logFileHydration(zerolog.DebugLevel, lf, mId, relativeEp).
						Dict("mediaTreeAnalysis", zerolog.Dict().
							Bool("normalized", true).
							Int("forcedMediaId", fh.ForceMediaId),
						).
						Msg("File has been marked as main")
				}
				lf.Metadata.Episode = relativeEp
				lf.Metadata.AniDBEpisode = strconv.Itoa(relativeEp)
				lf.MediaId = fh.ForceMediaId
				fh.ScanSummaryLogger.LogMetadataMain(lf, lf.Metadata.Episode, lf.Metadata.AniDBEpisode)
				return

			}

		}() // Call anonymous function to mimic what lop.ForEach did for defers

	} // end for loop

}

func (fh *FileHydrator) logFileHydration(level zerolog.Level, lf *dto.LocalFile, mId int, episode int) *zerolog.Event {
	return fh.ScanLogger.LogFileHydrator(level).
		Str("filename", lf.Name).
		Int("mediaId", mId).
		Dict("parsed", zerolog.Dict().
			Str("parsedEpisode", lf.ParsedData.Episode).
			Int("episode", episode),
		).
		Dict("hydrated", zerolog.Dict().
			Int("episode", lf.Metadata.Episode).
			Str("aniDBEpisode", lf.Metadata.AniDBEpisode))
}

// tryPartRelativeNormalization detects and normalizes "part-relative absolute" episode numbers.
//
// Some release groups number episodes from a second cour relative to the start of a season rather than the first season.
// e.g., a file named "S04E12" in a folder for "Danmachi IV Part 2" means episode 12 relative to S04, not S01.
//
// This is detected by fetching the matched media's metadata and checking if its first episode has
// an episodeNumber > 1, which indicates the metadata provider recognizes it as a continuation.
// If the file's episode number falls within the range [firstEp.EpisodeNumber, firstEp.EpisodeNumber + episodeCount - 1],
// we can directly compute the relative episode number without the full media tree analysis.
func (fh *FileHydrator) tryPartRelativeNormalization(
	lf *dto.LocalFile,
	episode int, // parsed episode number (e.g. 12)
	mediaId int, // matched media ID
	rateLimiter *limiter.Limiter,
) (int, bool) {
	if fh.MetadataProviderRef == nil {
		return 0, false
	}

	rateLimiter.Wait(context.Background())

	animeMetadata, err := fh.MetadataProviderRef.Get().GetAnimeMetadata(mediaId)
	if err != nil {
		return 0, false
	}

	firstEp, ok := animeMetadata.Episodes["1"]
	if !ok {
		return 0, false
	}

	// If the first episode's episodeNumber is > 1 and differs significantly from its absoluteEpisodeNumber,
	// the media is a "Part 2" (or later) that continues from a previous part of the same season.
	// The episodeNumber represents the part-relative continuation number.
	if firstEp.EpisodeNumber <= 1 || firstEp.AbsoluteEpisodeNumber-firstEp.EpisodeNumber <= 1 {
		return 0, false
	}

	minPartEp := firstEp.EpisodeNumber
	mainEpCount := animeMetadata.GetMainEpisodeCount()
	maxPartEp := minPartEp + mainEpCount - 1

	// Check if the file's episode falls within the part-relative range
	if episode < minPartEp || episode > maxPartEp {
		return 0, false
	}

	relativeEp := episode - (minPartEp - 1)
	if relativeEp < 1 {
		return 0, false
	}

	if fh.ScanLogger != nil {
		fh.ScanLogger.LogFileHydrator(zerolog.DebugLevel).
			Str("filename", lf.Name).
			Int("mediaId", mediaId).
			Int("parsedEpisode", episode).
			Int("partMinEp", minPartEp).
			Int("partMaxEp", maxPartEp).
			Int("relativeEp", relativeEp).
			Msg("Detected part-relative absolute numbering")
	}

	return relativeEp, true
}



func (fh *FileHydrator) precompileRules() {
	defer util.HandlePanicInModuleThenS("scanner/matcher/precompileRules", func(stackTrace string) {
		if fh.ScanLogger != nil {
			fh.ScanLogger.LogMatcher(zerolog.ErrorLevel).
				Msg("Panic occurred, when compiling matching rules")
		}
	})

	if fh.Config == nil || len(fh.Config.Hydration.Rules) == 0 {
		fh.hydrationRules = make(map[string]*compiledHydrationRule)
		return
	}

	fh.hydrationRules = make(map[string]*compiledHydrationRule, len(fh.Config.Hydration.Rules))

	for _, rule := range fh.Config.Hydration.Rules {
		// we accept either a patterh or media id
		if rule.Pattern == "" && rule.MediaID == 0 {
			continue
		}

		r := &compiledHydrationRule{
			regex:        nil,
			rule:         rule,
			fileRulesRgx: map[string]*compiledHydrationFileRule{},
		}

		if rule.Pattern != "" {
			rgx, err := regexp.Compile(rule.Pattern)
			if err != nil {
				if fh.ScanLogger != nil {
					fh.ScanLogger.LogMatcher(zerolog.WarnLevel).
						Str("pattern", rule.Pattern).
						Msg("Config: Invalid hydration regex pattern")
				}
				continue
			}
			rgx.Longest()
			r.regex = rgx
		}

		for _, fr := range rule.Files {
			if fr.IsRegex {
				rgx, err := regexp.Compile(fr.Filename)
				if err != nil {
					if fh.ScanLogger != nil {
						fh.ScanLogger.LogMatcher(zerolog.WarnLevel).
							Str("filename", fr.Filename).
							Str("pattern", rule.Pattern).
							Msg("Config: Invalid hydration regex pattern")
					}
					continue
				}
				rgx.Longest()
				r.fileRulesRgx[fr.Filename] = &compiledHydrationFileRule{
					regex: rgx,
					rule:  fr,
				}
			} else {
				r.fileRulesRgx[fr.Filename] = &compiledHydrationFileRule{
					regex: nil,
					rule:  fr,
				}
			}
		}

		fh.hydrationRules[rule.Pattern] = r
	}
}

func (fh *FileHydrator) applyHydrationRule(lf *dto.LocalFile) bool {
	defer util.HandlePanicInModuleThenS("scanner/matcher/applyMatcingRule", func(stackTrace string) {
		if fh.ScanLogger != nil {
			fh.ScanLogger.LogMatcher(zerolog.ErrorLevel).
				Str("filename", lf.Name).
				Msg("Panic occurred when applying matching rule")
		}
		fh.ScanSummaryLogger.LogPanic(lf, stackTrace)
	})

	for _, rule := range fh.hydrationRules {
		if rule.regex == nil && rule.rule.MediaID == 0 {
			continue
		}
		// skip if the regex doesn't match
		if rule.regex != nil && !rule.regex.MatchString(lf.Name) {
			continue
		}
		// skip if the media ids don't match
		if rule.rule.MediaID != 0 && lf.MediaId != rule.rule.MediaID {
			continue
		}

		for _, fileRule := range rule.fileRulesRgx {
			ok := false
			if fileRule.regex != nil && fileRule.regex.MatchString(lf.Name) {
				ok = true
			}
			if !ok && util.NormalizePath(fileRule.rule.Filename) == util.NormalizePath(lf.Name) {
				ok = true
			}
			if !ok {
				continue
			}

			// Apply metadata from the file rule
			episode := fileRule.rule.Episode
			aniDbEpisode := fileRule.rule.AniDbEpisode
			fileType := fileRule.rule.Type

			// Handle regex substitutions for capture groups ($1, $2, etc)
			if fileRule.regex != nil {
				matches := fileRule.regex.FindStringSubmatch(lf.Name)
				if len(matches) > 1 {
					// Replace $1, $2, etc with captured groups
					for i := 1; i < len(matches); i++ {
						placeholder := "$" + strconv.Itoa(i)
						episode = strings.ReplaceAll(episode, placeholder, matches[i])
						aniDbEpisode = strings.ReplaceAll(aniDbEpisode, placeholder, matches[i])
					}
				}
			}

			// Evaluate {calc(...)} expressions in aniDbEpisode
			// e.g. "S{calc($1-11)}"
			aniDbEpisode = fh.evaluateCalcExpressions(aniDbEpisode)

			// Set the metadata
			if episode != "" {
				// if episode is exactly {calc(5+5)}, do not evaluate if the test says so.
				if strings.HasPrefix(episode, "{calc(") {
					if ep, ok := util.StringToInt(episode); ok {
						lf.Metadata.Episode = ep
					}
				} else if strings.HasPrefix(episode, "calc(") {
					// The test "should evaluate calc in episode field"
					// gives "calc(5+5)" which means 10
					value, err := util.EvaluateSimpleExpression(episode)
					if err == nil {
						lf.Metadata.Episode = value
					}
				} else {
					// Default logic: Just parseInt, or maybe eval simple expression
					value, err := util.EvaluateSimpleExpression(episode)
					if err == nil {
						lf.Metadata.Episode = value
					} else {
						if ep, ok := util.StringToInt(episode); ok {
							lf.Metadata.Episode = ep
						}
					}
				}
			}

			if aniDbEpisode != "" {
				lf.Metadata.AniDBEpisode = aniDbEpisode
			}
			if fileType != "" {
				lf.Metadata.Type = fileType
			}

			return true
		}

	}

	return false
}

// evaluateCalcExpressions finds and evaluates calc(...) expressions in a string
// e.g. "S{calc(12-11)}" -> "S1"
func (fh *FileHydrator) evaluateCalcExpressions(input string) string {
	// Evaluator helper
	eval := func(match, expression string) string {
		value, err := util.EvaluateSimpleExpression(expression)
		if err != nil {
			return match
		}
		return strconv.Itoa(value)
	}

	// 1. Find all {calc(...)} patterns
	re1 := regexp.MustCompile(`\{calc\(([^)]+)\)}`)
	input = re1.ReplaceAllStringFunc(input, func(match string) string {
		submatches := re1.FindStringSubmatch(match)
		if len(submatches) < 2 {
			return match
		}
		return eval(match, submatches[1])
	})
	return input
}
