package scanner

import (
	"kamehouse/internal/api/metadata"
	"kamehouse/internal/database/models/dto"
	"kamehouse/internal/util"
	"regexp"
	"strconv"
	"strings"

	"github.com/rs/zerolog"
)

func (fh *FileHydrator) logFileHydration(level zerolog.Level, lf *dto.LocalFile, mID int, episode int) *zerolog.Event {
	return fh.ScanLogger.LogFileHydrator(level).
		Str("filename", lf.Name).
		Int("mediaID", mID).
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
	mediaID int, // matched media ID
	animeMetadata *metadata.AnimeMetadata,
) (int, bool) {
	if animeMetadata == nil {
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
			Int("mediaID", mediaID).
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
		if rule.rule.MediaID != 0 && lf.MediaID != rule.rule.MediaID {
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
	input = calcRegex.ReplaceAllStringFunc(input, func(match string) string {
		submatches := calcRegex.FindStringSubmatch(match)
		if len(submatches) < 2 {
			return match
		}
		return eval(match, submatches[1])
	})
	return input
}
