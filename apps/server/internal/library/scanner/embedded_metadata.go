package scanner

import (
	"context"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"

	"kamehouse/internal/database/models/dto"
	"kamehouse/internal/library/parser"
	"kamehouse/internal/mkvparser"

	"github.com/rs/zerolog"
)

var (
	embeddedEpisodeFromTitle = regexp.MustCompile(`(?i)(?:^|[\s._-])s(\d{1,2})e(\d{1,4})\b|\s+-\s+0*(\d{1,4})(?:v\d+)?(?:\D|$)`)
	embeddedInteger          = regexp.MustCompile(`\d+`)
)

func ingestLocalFileEmbeddedMetadata(ctx context.Context, lf *dto.LocalFile, logger *zerolog.Logger) {
	if lf == nil {
		return
	}

	identity, ok := readEmbeddedMediaIdentity(ctx, lf.Path, lf, logger)
	if !ok {
		return
	}

	applyEmbeddedMediaIdentity(lf, identity)
}

func readEmbeddedMediaIdentity(ctx context.Context, path string, lf *dto.LocalFile, logger *zerolog.Logger) (*dto.LocalFileEmbeddedMetadata, bool) {
	if !isMatroskaPath(path) {
		return nil, false
	}

	file, err := os.Open(path)
	if err != nil {
		logEmbeddedMetadataDebug(logger, path, err.Error())
		return nil, false
	}
	defer file.Close()

	if _, ok := mkvparser.ReadIsMkvOrWebm(file); !ok {
		return nil, false
	}

	metadataParser := mkvparser.NewMetadataParser(file, loggerOrNop(logger))
	metadata := metadataParser.GetMetadata(ctx)
	if metadata == nil || metadata.Error != nil {
		if metadata != nil && metadata.Error != nil {
			logEmbeddedMetadataDebug(logger, path, metadata.Error.Error())
		}
		return nil, false
	}

	if lf.TechnicalInfo == nil {
		lf.TechnicalInfo = &dto.FileTechnicalInfo{}
	}

	for _, track := range metadata.AudioTracks {
		lf.TechnicalInfo.AudioStreams = append(lf.TechnicalInfo.AudioStreams, &dto.AudioStreamInfo{
			Codec:    track.CodecID,
			Language: track.Language,
			Title:    track.Name,
		})
	}
	for _, track := range metadata.SubtitleTracks {
		lf.TechnicalInfo.SubtitleStreams = append(lf.TechnicalInfo.SubtitleStreams, &dto.AudioStreamInfo{
			Codec:    track.CodecID,
			Language: track.Language,
			Title:    track.Name,
		})
	}

	title := firstTagValue(metadata.Tags,
		"TITLE",
		"SERIES_TITLE",
		"SHOW_TITLE",
		"TVSHOW",
		"TV_SHOW",
	)
	if title == "" {
		title = metadata.Title
	}

	season, hasSeason := firstTagInt(metadata.Tags,
		"SEASON",
		"SEASON_NUMBER",
		"SEASONNUMBER",
	)
	episode, hasEpisode := firstTagInt(metadata.Tags,
		"EPISODE",
		"EPISODE_NUMBER",
		"EPISODENUMBER",
		"PART_NUMBER",
		"PARTNUMBER",
		"TRACKNUMBER",
		"TRACK_NUMBER",
	)

	cleanTitle := ""
	if title != "" {
		parsedTitle := parser.Parse(title)
		cleanTitle = parsedTitle.Title
		if !hasSeason && parsedTitle.Season > 0 && hasEpisodeMarker(title) {
			season = parsedTitle.Season
			hasSeason = true
		}
		if !hasEpisode && parsedTitle.Episode > 0 && hasEpisodeMarker(title) {
			episode = parsedTitle.Episode
			hasEpisode = true
		}
	}

	if cleanTitle == "" && !hasSeason && !hasEpisode {
		return nil, false
	}

	identity := &dto.LocalFileEmbeddedMetadata{
		Title:  cleanTitle,
		Source: "mkv",
	}
	if hasSeason {
		identity.Season = &season
	}
	if hasEpisode {
		identity.Episode = &episode
	}
	return identity, true
}

func applyEmbeddedMediaIdentity(lf *dto.LocalFile, identity *dto.LocalFileEmbeddedMetadata) {
	if lf == nil || identity == nil {
		return
	}
	if lf.ParsedData == nil {
		lf.ParsedData = &dto.LocalFileParsedData{Original: filepath.Base(lf.Path)}
	}
	if identity.Title != "" {
		lf.ParsedData.Title = identity.Title
	}
	if identity.Season != nil {
		lf.ParsedData.Season = strconv.Itoa(*identity.Season)
	}
	if identity.Episode != nil {
		lf.ParsedData.Episode = strconv.Itoa(*identity.Episode)
		if lf.Metadata != nil {
			lf.Metadata.Episodes = []int{*identity.Episode}
		}
	}
	lf.EmbeddedMetadata = identity
}

func parsedMediaFromLocalFile(lf *dto.LocalFile) parser.ParsedMedia {
	if lf == nil {
		return parser.ParsedMedia{Season: 1, Episodes: []int{1}, Resolution: "UNKNOWN"}
	}

	name := lf.Name
	if name == "" {
		name = filepath.Base(lf.Path)
	}
	pm := parser.Parse(filepath.Base(name))

	if lf.EmbeddedMetadata == nil {
		return pm
	}

	if lf.EmbeddedMetadata.Title != "" {
		pm.Title = lf.EmbeddedMetadata.Title
	}
	if lf.EmbeddedMetadata.Season != nil {
		pm.Season = *lf.EmbeddedMetadata.Season
	}
	if lf.EmbeddedMetadata.Episode != nil {
		pm.Episodes = []int{*lf.EmbeddedMetadata.Episode}
	}

	return pm
}

func firstTagValue(tags map[string][]string, names ...string) string {
	for _, name := range names {
		values := tags[normalizeTagName(name)]
		for _, value := range values {
			if trimmed := strings.TrimSpace(value); trimmed != "" {
				return trimmed
			}
		}
	}
	return ""
}

func firstTagInt(tags map[string][]string, names ...string) (int, bool) {
	for _, name := range names {
		values := tags[normalizeTagName(name)]
		for _, value := range values {
			if parsed, ok := parseFirstInt(value); ok {
				return parsed, true
			}
		}
	}
	return 0, false
}

func parseFirstInt(input string) (int, bool) {
	match := embeddedInteger.FindString(input)
	if match == "" {
		return 0, false
	}
	parsed, err := strconv.Atoi(match)
	return parsed, err == nil
}

func normalizeTagName(name string) string {
	name = strings.ToUpper(strings.TrimSpace(name))
	return strings.NewReplacer(" ", "_", "-", "_").Replace(name)
}

func hasEpisodeMarker(input string) bool {
	return embeddedEpisodeFromTitle.MatchString(input)
}

func isMatroskaPath(path string) bool {
	ext := strings.ToLower(filepath.Ext(path))
	return ext == ".mkv" || ext == ".mk3d" || ext == ".mka" || ext == ".webm"
}

func loggerOrNop(logger *zerolog.Logger) *zerolog.Logger {
	if logger != nil {
		return logger
	}
	nop := zerolog.Nop()
	return &nop
}

func logEmbeddedMetadataDebug(logger *zerolog.Logger, path string, reason string) {
	if logger == nil {
		return
	}
	logger.Debug().
		Str("path", path).
		Str("reason", reason).
		Msg("scanner: embedded MKV metadata unavailable")
}
