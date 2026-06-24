package handlers

import (
	"context"
	"os"
	"sort"
	"strconv"

	"kamehouse/internal/api/tmdb"
	"kamehouse/internal/database/db"
	"kamehouse/internal/library/anime"
	librarymetadata "kamehouse/internal/library/metadata"
	"kamehouse/internal/platforms/platform"
)

func debugLogEnrich(location, message string, data map[string]any) {
	// disabled
}

func getActiveProvider(h *Handler) librarymetadata.Provider {
	var useTMDB bool
	var tmdbToken string
	var tmdbLanguage string
	if settings, err := h.App.Database.GetSettings(); err == nil && settings != nil {
		useTMDB = settings.Library.ScannerProvider == "tmdb"
		tmdbToken = settings.Library.TmdbApiKey
		tmdbLanguage = settings.Library.TmdbLanguage
	}
	if tmdbToken == "" {
		tmdbToken = os.Getenv("KAMEHOUSE_TMDB_TOKEN")
	}

	if useTMDB {
		if tmdbLanguage == "" || tmdbLanguage == "en" || tmdbLanguage == "es" {
			tmdbLanguage = "es-MX"
		}
		if tmdbToken != "" {
			return librarymetadata.NewTMDBProvider(tmdbToken, h.App.Database, tmdbLanguage)
		}
		h.App.Logger.Warn().Msg("handlers: TMDB mode requested but TMDB token not set")
	}

	return nil
}

// enrichEpisodesWithTMDB fetches episode-level metadata from TMDB and fills in
// any fields that AniDB/Animap left empty (title, overview/summary, still image, runtime).
// Supports multi-season series by fetching all available seasons in parallel.
// This is purely additive — never overwrites existing non-empty values.
func (h *Handler) enrichEpisodesWithTMDB(ctx context.Context, entry *anime.Entry) {
	if entry == nil || entry.Media == nil || entry.Media.TmdbID == 0 {
		return
	}
	if len(entry.Episodes) == 0 {
		return
	}

	// Skip TMDB fetch when all episodes already have image and overview from the primary provider.
	allComplete := true
	for _, ep := range entry.Episodes {
		if ep == nil {
			continue
		}
		md := ep.EpisodeMetadata
		if md == nil || !md.HasImage || md.Overview == "" {
			allComplete = false
			break
		}
	}
	if allComplete {
		debugLogEnrich("anime_entries.go:enrichEpisodesWithTMDB", "skipped — episodes complete", map[string]any{
			"tmdbID": entry.Media.TmdbID, "episodeCount": len(entry.Episodes), "hypothesisId": "C",
		})
		return
	}

	h.App.Logger.Debug().Int("tmdbID", entry.Media.TmdbID).Msg("enrichEpisodesWithTMDB: starting enrichment")

	// Build a TMDB provider
	var tmdbToken string
	var tmdbLanguage string
	if settings, err := h.App.Database.GetSettings(); err == nil && settings != nil {
		tmdbToken = settings.Library.TmdbApiKey
		tmdbLanguage = settings.Library.TmdbLanguage
	}
	if tmdbToken == "" {
		tmdbToken = os.Getenv("KAMEHOUSE_TMDB_TOKEN")
	}
	if tmdbToken == "" {
		return
	}
	if tmdbLanguage == "" || tmdbLanguage == "en" || tmdbLanguage == "es" {
		tmdbLanguage = "es-MX"
	}

	provider := librarymetadata.NewTMDBProvider(tmdbToken, h.App.Database, tmdbLanguage)
	tmdbID := entry.Media.TmdbID

	// Determine the number of seasons we need to cover.
	maxEp := 0
	for _, ep := range entry.Episodes {
		if ep != nil && ep.EpisodeNumber > maxEp {
			maxEp = ep.EpisodeNumber
		}
	}

	if maxEp == 0 {
		return
	}

	// If it's a movie, handle differently
	if entry.Media.Format == string(platform.MediaFormatMovie) {
		movie, err := provider.GetMediaDetails(ctx, strconv.Itoa(tmdbID+1000000))
		if err == nil && movie != nil {
			for i := range entry.Episodes {
				if entry.Episodes[i].EpisodeMetadata == nil {
					entry.Episodes[i].EpisodeMetadata = &anime.EpisodeMetadata{}
				}
				md := entry.Episodes[i].EpisodeMetadata
				if md.Summary == "" && movie.Description != nil {
					md.Summary = *movie.Description
					md.Overview = *movie.Description
				}
				if !md.HasImage && movie.CoverImage != nil && movie.CoverImage.Large != nil {
					md.Image = *movie.CoverImage.Large
					md.HasImage = true
				}
			}
		}
		return
	}

	// Fetch Season 1 baseline
	s1, err := provider.GetTVSeason(ctx, tmdbID, 1)
	if err != nil {
		h.App.Logger.Warn().Err(err).Int("tmdbID", tmdbID).Msg("enrichEpisodesWithTMDB: could not fetch TMDB season 1")
		return
	}

	numSeasonsNeeded := 1
	if len(s1.Episodes) > 0 && maxEp > len(s1.Episodes) {
		numSeasonsNeeded = (maxEp / len(s1.Episodes)) + 1
		if numSeasonsNeeded > 15 {
			numSeasonsNeeded = 15
		}
	}

	epMap := make(map[int]tmdb.TVEpisode)
	offset := 0

	addSeason := func(season tmdb.TVSeasonDetails) {
		for _, te := range season.Episodes {
			absNum := offset + te.EpisodeNumber
			epMap[absNum] = te
		}
		offset += len(season.Episodes)
	}
	addSeason(s1)

	if numSeasonsNeeded > 1 {
		type seasonResult struct {
			season tmdb.TVSeasonDetails
			num    int
			err    error
		}
		ch := make(chan seasonResult, numSeasonsNeeded-1)
		for sn := 2; sn <= numSeasonsNeeded; sn++ {
			go func(seasonNum int) {
				s, e := provider.GetTVSeason(ctx, tmdbID, seasonNum)
				ch <- seasonResult{season: s, num: seasonNum, err: e}
			}(sn)
		}

		results := make([]seasonResult, 0, numSeasonsNeeded-1)
		for i := 0; i < numSeasonsNeeded-1; i++ {
			results = append(results, <-ch)
		}
		sort.Slice(results, func(i, j int) bool {
			return results[i].num < results[j].num
		})
		for _, r := range results {
			if r.err == nil {
				addSeason(r.season)
			}
		}
	}

	const imgBase = "https://image.tmdb.org/t/p/w500"

	for i := range entry.Episodes {
		ep := entry.Episodes[i]
		if ep == nil {
			continue
		}
		te, ok := epMap[ep.AbsoluteEpisodeNumber]
		if !ok {
			continue
		}

		if ep.EpisodeMetadata == nil {
			entry.Episodes[i].EpisodeMetadata = &anime.EpisodeMetadata{}
		}
		md := entry.Episodes[i].EpisodeMetadata

		if te.Name != "" {
			if md.Title == "" {
				md.Title = te.Name
			}
			if entry.Episodes[i].EpisodeTitle == "" {
				entry.Episodes[i].EpisodeTitle = te.Name
			}
		}

		if md.Summary == "" && te.Overview != "" {
			md.Summary = te.Overview
		}
		if md.Overview == "" && te.Overview != "" {
			md.Overview = te.Overview
		}

		if !md.HasImage && te.StillPath != "" {
			md.Image = imgBase + te.StillPath
			md.HasImage = true
		}

		if md.Length == 0 && te.Runtime > 0 {
			md.Length = te.Runtime
		}

		if md.AirDate == "" && te.AirDate != "" {
			md.AirDate = te.AirDate
		}
	}

	h.App.Logger.Debug().
		Int("tmdbID", tmdbID).
		Int("mapped", len(epMap)).
		Msg("enrichEpisodesWithTMDB: complete")
}

// enrichMediaWithTMDB fetches series-level metadata from TMDB if the local description is missing.
func (h *Handler) enrichMediaWithTMDB(ctx context.Context, entry *anime.Entry) {
	if entry == nil || entry.Media == nil || entry.Media.TmdbID == 0 {
		return
	}

	// Only enrich if important metadata is missing
	missingMetadata := entry.Media.Description == "" ||
		(entry.Media.TitleSpanish == "" && entry.Media.TitleEnglish == "") ||
		entry.Media.PosterImage == ""

	if !missingMetadata {
		return
	}

	h.App.Logger.Debug().Int("tmdbID", entry.Media.TmdbID).Msg("enrichMediaWithTMDB: fetching series metadata")

	var tmdbToken string
	var tmdbLanguage string
	if settings, err := h.App.Database.GetSettings(); err == nil && settings != nil {
		tmdbToken = settings.Library.TmdbApiKey
		tmdbLanguage = settings.Library.TmdbLanguage
	}
	if tmdbToken == "" {
		tmdbToken = os.Getenv("KAMEHOUSE_TMDB_TOKEN")
	}
	if tmdbToken == "" {
		return
	}
	if tmdbLanguage == "" || tmdbLanguage == "en" || tmdbLanguage == "es" {
		tmdbLanguage = "es-MX"
	}

	provider := librarymetadata.NewTMDBProvider(tmdbToken, h.App.Database, tmdbLanguage)
	tmdbID := entry.Media.TmdbID

	// Fetch details
	lookUpID := strconv.Itoa(tmdbID)
	if entry.Media.Format == string(platform.MediaFormatMovie) {
		lookUpID = strconv.Itoa(tmdbID + 1000000)
	}

	nm, err := provider.GetMediaDetails(ctx, lookUpID)
	if err != nil || nm == nil {
		return
	}

	updated := false
	if nm.Description != nil && *nm.Description != "" && entry.Media.Description == "" {
		entry.Media.Description = *nm.Description
		updated = true
	}
	if nm.Title != nil {
		if nm.Title.Spanish != nil && *nm.Title.Spanish != "" && entry.Media.TitleSpanish == "" {
			entry.Media.TitleSpanish = *nm.Title.Spanish
			updated = true
		}
		if nm.Title.English != nil && *nm.Title.English != "" && entry.Media.TitleEnglish == "" {
			entry.Media.TitleEnglish = *nm.Title.English
			updated = true
		}
	}
	if nm.CoverImage != nil && nm.CoverImage.Large != nil && entry.Media.PosterImage == "" {
		entry.Media.PosterImage = *nm.CoverImage.Large
		updated = true
	}
	if nm.BannerImage != nil && *nm.BannerImage != "" && entry.Media.BannerImage == "" {
		entry.Media.BannerImage = *nm.BannerImage
		updated = true
	}

	if updated {
		// Persist to database
		_, err := db.InsertLibraryMedia(h.App.Database, entry.Media)
		if err != nil {
			h.App.Logger.Warn().Err(err).Int("tmdbID", tmdbID).Msg("enrichMediaWithTMDB: failed to persist enriched metadata")
		} else {
			h.App.Logger.Info().Int("tmdbID", tmdbID).Msg("enrichMediaWithTMDB: updated series metadata in DB")
		}
	}
}
