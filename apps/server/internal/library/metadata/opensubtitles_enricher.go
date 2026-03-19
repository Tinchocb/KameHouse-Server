package metadata

import (
	"context"

	"kamehouse/internal/api/opensubtitles"
	"kamehouse/internal/database/models/dto"
)

// OpenSubtitlesEnricher searches for available remote subtitles using the OpenSubtitles v1 API.
// It populates FileTechnicalInfo.RemoteSubtitles with available downloads.
//
// Free API key: https://www.opensubtitles.com/en/consumers
// Rate limits: unlimited searches, 5 downloads/day (without VIP)
type OpenSubtitlesEnricher struct {
	client    *opensubtitles.Client
	languages []string // preferred language codes, e.g. ["es", "en"]
}

// NewOpenSubtitlesEnricher creates a new OpenSubtitles enricher.
// languages is a list of ISO 639-1 language codes to search for, e.g. ["es", "en"].
func NewOpenSubtitlesEnricher(apiKey string, languages ...string) *OpenSubtitlesEnricher {
	if len(languages) == 0 {
		languages = []string{"es", "en"}
	}
	return &OpenSubtitlesEnricher{
		client:    opensubtitles.NewClient(apiKey, "KameHouse/2.0"),
		languages: languages,
	}
}

// EnrichLocalFile searches for remote subtitles for the given local file.
// It uses the TMDb ID from the matched media if available, then falls back to title search.
// Results are stored in localFile.TechnicalInfo.RemoteSubtitles.
// Non-fatal: any errors are silently ignored to not break the scan pipeline.
func (e *OpenSubtitlesEnricher) EnrichLocalFile(
	ctx context.Context,
	localFile *dto.LocalFile,
	media *dto.NormalizedMedia,
	seasonNumber, episodeNumber int,
) error {
	if localFile == nil || localFile.TechnicalInfo == nil {
		return nil
	}

	// If we already have local subtitles for all preferred languages, skip remote search
	if hasAllLanguagesLocally(localFile.TechnicalInfo.ExternalSubtitles, e.languages) {
		return nil
	}

	var tmdbID int
	if media != nil && media.TmdbId != nil {
		tmdbID = *media.TmdbId
	}

	var allRemote []*dto.RemoteSubtitle

	for _, lang := range e.languages {
		// Skip if we already have a local subtitle for this language
		if hasLanguageLocally(localFile.TechnicalInfo.ExternalSubtitles, lang) {
			continue
		}

		opts := opensubtitles.SearchOptions{
			TmdbID:        tmdbID,
			Language:      lang,
			SeasonNumber:  seasonNumber,
			EpisodeNumber: episodeNumber,
			Limit:         3,
		}

		// Fallback to title if no TMDb ID
		if tmdbID == 0 && media != nil && media.Title != nil && media.Title.UserPreferred != nil {
			opts.Query = *media.Title.UserPreferred
		}

		resp, err := e.client.SearchSubtitles(ctx, opts)
		if err != nil {
			continue // Non-fatal per language
		}

		for _, result := range resp.Data {
			for _, file := range result.Attributes.Files {
				remote := &dto.RemoteSubtitle{
					ProviderID:    "opensubtitles",
					FileID:        file.FileID,
					Language:      lang,
					DownloadCount: result.Attributes.DownloadCount,
					Release:       result.Attributes.Release,
				}
				allRemote = append(allRemote, remote)
				break // Only take the first file per result entry
			}
		}
	}

	if len(allRemote) > 0 {
		localFile.TechnicalInfo.RemoteSubtitles = allRemote
	}

	return nil
}

// hasAllLanguagesLocally checks if local subtitles cover all requested languages.
func hasAllLanguagesLocally(subs []*dto.ExternalSubtitle, languages []string) bool {
	for _, lang := range languages {
		if !hasLanguageLocally(subs, lang) {
			return false
		}
	}
	return true
}

// hasLanguageLocally checks if there is at least one local subtitle for the given language.
func hasLanguageLocally(subs []*dto.ExternalSubtitle, lang string) bool {
	for _, s := range subs {
		if s.Language == lang {
			return true
		}
	}
	return false
}
