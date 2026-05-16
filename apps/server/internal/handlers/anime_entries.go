package handlers

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"kamehouse/internal/api/tmdb"
	"kamehouse/internal/database/db"
	"kamehouse/internal/database/models"
	"kamehouse/internal/database/models/dto"
	"kamehouse/internal/library/anime"
	librarymetadata "kamehouse/internal/library/metadata"

	"kamehouse/internal/platforms/platform"
	"kamehouse/internal/util"
	"kamehouse/internal/util/result"
	"net/http"
	"os"
	"os/exec"
	"runtime"
	"sort"
	"strconv"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/samber/lo"
)

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

func (h *Handler) getAnimeEntry(c echo.Context, lfs []*dto.LocalFile, mId int) (*anime.Entry, error) {
	//

	// Anime collection is no longer used for getting entries

	// Create a new media entry
	entry, err := anime.NewEntry(c.Request().Context(), &anime.NewEntryOptions{
		MediaId:             mId,
		LocalFiles:          lfs,
		Database:            h.App.Database,
		PlatformRef:         h.App.Metadata.PlatformRef,
		MetadataProviderRef: h.App.Metadata.ProviderRef,
		IsSimulated:         h.App.GetUser() != nil && h.App.GetUser().IsSimulated,
		IntelligenceSvc:     h.App.IntelligenceService,
	})
	if err != nil {
		return nil, err
	}

	h.App.FillerManager.HydrateFillerData(entry)

	// ── TMDB Episode Enrichment ──────────────────────────────────────────────────
	// If the media has a TmdbId and episodes are missing synopsis/image,
	// fetch TMDB season data and fill in the gaps (best-effort, never fails the request).
	h.enrichEpisodesWithTMDB(c.Request().Context(), entry)
	h.enrichMediaWithTMDB(c.Request().Context(), entry)

	return entry, nil
}

// enrichEpisodesWithTMDB fetches episode-level metadata from TMDB and fills in
// any fields that AniDB/Animap left empty (title, overview/summary, still image, runtime).
// Supports multi-season series by fetching all available seasons in parallel.
// This is purely additive — never overwrites existing non-empty values.
func (h *Handler) enrichEpisodesWithTMDB(ctx context.Context, entry *anime.Entry) {
	if entry == nil || entry.Media == nil || entry.Media.TmdbId == 0 {
		return
	}
	if len(entry.Episodes) == 0 {
		return
	}

	h.App.Logger.Debug().Int("tmdbId", entry.Media.TmdbId).Msg("enrichEpisodesWithTMDB: starting enrichment")

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
	tmdbId := entry.Media.TmdbId

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
		// Movies don't have seasons, we just map the movie details to all episodes (usually just 1)
		movie, err := provider.GetMediaDetails(ctx, strconv.Itoa(tmdbId+1000000))
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
	s1, err := provider.GetTVSeason(ctx, tmdbId, 1)
	if err != nil {
		h.App.Logger.Warn().Err(err).Int("tmdbId", tmdbId).Msg("enrichEpisodesWithTMDB: could not fetch TMDB season 1")
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
				s, e := provider.GetTVSeason(ctx, tmdbId, seasonNum)
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
		Int("tmdbId", tmdbId).
		Int("mapped", len(epMap)).
		Msg("enrichEpisodesWithTMDB: complete")
}

// enrichMediaWithTMDB fetches series-level metadata from TMDB if the local description is missing.
func (h *Handler) enrichMediaWithTMDB(ctx context.Context, entry *anime.Entry) {
	if entry == nil || entry.Media == nil || entry.Media.TmdbId == 0 {
		return
	}

	// Only enrich if important metadata is missing
	missingMetadata := entry.Media.Description == "" || 
		(entry.Media.TitleSpanish == "" && entry.Media.TitleEnglish == "") ||
		entry.Media.PosterImage == ""
		
	if !missingMetadata {
		return
	}

	h.App.Logger.Debug().Int("tmdbId", entry.Media.TmdbId).Msg("enrichMediaWithTMDB: fetching series metadata")

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
	tmdbId := entry.Media.TmdbId

	// Fetch details
	lookUpId := strconv.Itoa(tmdbId)
	if entry.Media.Format == string(platform.MediaFormatMovie) {
		lookUpId = strconv.Itoa(tmdbId + 1000000)
	}

	nm, err := provider.GetMediaDetails(ctx, lookUpId)
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
			h.App.Logger.Warn().Err(err).Int("tmdbId", tmdbId).Msg("enrichMediaWithTMDB: failed to persist enriched metadata")
		} else {
			h.App.Logger.Info().Int("tmdbId", tmdbId).Msg("enrichMediaWithTMDB: updated series metadata in DB")
		}
	}
}




// HandleGetAnimeEntry
//
//	@summary return a media entry for the given anime media id.
//	@desc This is used by the anime media entry pages to get all the data about the anime.
//	@desc This includes episodes and metadata (if any), list data, download info...
//	@route /api/v1/library/anime-entry/{id} [GET]
//	@param id - int - true - "Anime media ID"
//	@returns anime.Entry
func (h *Handler) HandleGetAnimeEntry(c echo.Context) error {
	idParam := c.Param("id")
	mId, err := strconv.Atoi(idParam)
	if err != nil {
		return h.RespondWithError(c, err)
	}

	lfs, _, err := db.GetLocalFiles(h.App.Database)
	if err != nil {
		return h.RespondWithError(c, err)
	}

	entry, err := h.getAnimeEntry(c, lfs, mId)
	if err != nil {
		return h.RespondWithError(c, err)
	}

	return h.RespondWithData(c, entry)
}

//----------------------------------------------------------------------------------------------------------------------------------------------------

var entriesSuggestionsCache = result.NewCache[string, []*platform.UnifiedMedia]()

// HandleGetAnimeEntrySuggestions
//
//	@summary returns anime suggestions for the given local files.
//	@desc Accepts either a directory path (dir) or explicit file paths (paths[]).
//	@desc The frontend codegen contract sends dir; the legacy backend contract sends paths.
//	@route /api/v1/library/anime-entry/suggestions [POST]
//	@param dir - string - false - "Directory of the local files (frontend contract)"
//	@param paths - []string - false - "Explicit file paths (legacy contract)"
//	@returns []*platform.UnifiedMedia
func (h *Handler) HandleGetAnimeEntrySuggestions(c echo.Context) error {

	type body struct {
		// Frontend codegen sends dir (a directory path)
		Dir   string   `json:"dir"`
		Paths []string `json:"paths"`
	}
	b := new(body)
	if err := c.Bind(b); err != nil {
		return h.RespondWithError(c, err)
	}

	lfs, _, err := db.GetLocalFiles(h.App.Database)
	if err != nil {
		return h.RespondWithError(c, err)
	}

	var selectedLfs []*dto.LocalFile

	if b.Dir != "" {
		dir := strings.ReplaceAll(b.Dir, "\\", "/")
		selectedLfs = lo.Filter(lfs, func(lf *dto.LocalFile, _ int) bool {
			norm := strings.ReplaceAll(lf.Path, "\\", "/")
			return strings.HasPrefix(norm, dir)
		})
	} else if len(b.Paths) > 0 {
		selectedLfs = lo.Filter(lfs, func(lf *dto.LocalFile, _ int) bool {
			return matchesAnyRequestedPath(lf.Path, b.Paths)
		})
	} else {
		return h.RespondWithError(c, errors.New("provide either dir or paths"))
	}

	if len(selectedLfs) == 0 {
		return h.RespondWithError(c, errors.New("no local files found for the given location"))
	}

	title := selectedLfs[0].GetParsedTitle()

	if res, ok := entriesSuggestionsCache.Get(title); ok {
		return h.RespondWithData(c, res)
	}

	h.App.Logger.Info().Str("title", title).Msg("handlers: Fetching anime suggestions")

	if h.App.Metadata.TMDBClient == nil {
		return h.RespondWithError(c, errors.New("tmdb client is not configured"))
	}

	provider := librarymetadata.NewTMDBProviderWithClient(h.App.Metadata.TMDBClient, h.App.Database)

	res, err := provider.SearchMedia(c.Request().Context(), title)
	if err != nil {
		return h.RespondWithError(c, err)
	}

	// Fake UnifiedMedia array for frontend compatibility
	var newSuggestions []*platform.UnifiedMedia
	for _, nm := range res {
		title := &platform.MediaTitle{}
		if nm.Title != nil {
			title.English = nm.Title.English
			title.Romaji = nm.Title.Romaji
			title.Native = nm.Title.Native
		}

		var cover *platform.MediaCoverImage
		if nm.CoverImage != nil {
			cover = &platform.MediaCoverImage{
				ExtraLarge: nm.CoverImage.ExtraLarge,
				Large:      nm.CoverImage.Large,
				Medium:     nm.CoverImage.Medium,
				Color:      nm.CoverImage.Color,
			}
		}

		var startDate *platform.FuzzyDate
		if nm.StartDate != nil {
			startDate = &platform.FuzzyDate{
				Year:  nm.StartDate.Year,
				Month: nm.StartDate.Month,
				Day:   nm.StartDate.Day,
			}
		}

		var format platform.MediaFormat
		if nm.Format != nil {
			format = platform.MediaFormat(*nm.Format)
		}

		var status platform.MediaStatus
		if nm.Status != nil {
			status = platform.MediaStatus(*nm.Status)
		}

		newSuggestions = append(newSuggestions, &platform.UnifiedMedia{
			ID:         nm.ID,
			Title:      title,
			CoverImage: cover,
			Format:     format,
			StartDate:  startDate,
			Status:     status,
		})
	}

	entriesSuggestionsCache.SetT(title, newSuggestions, 1*time.Hour)

	return h.RespondWithData(c, newSuggestions)
}

// HandleUpdateAnimeEntryProgress
//
//	@summary updates the progress of an anime entry.
//	@desc This is used when the user manually updates the progress of an anime.
//	@route /api/v1/library/anime-entry/progress [POST]
//	@param mediaId - int - true - "Anime media ID"
//	@param progress - int - true - "New progress"
//	@returns bool
func (h *Handler) HandleUpdateAnimeEntryProgress(c echo.Context) error {

	type body struct {
		MediaId  int `json:"mediaId"`
		Progress int `json:"progress"`
	}
	b := new(body)
	if err := c.Bind(b); err != nil {
		return h.RespondWithError(c, err)
	}

	err := h.App.Metadata.PlatformRef.Get().UpdateEntryProgress(c.Request().Context(), b.MediaId, b.Progress, nil)
	if err != nil {
		return h.RespondWithError(c, err)
	}

	_, _ = h.App.Metadata.PlatformRef.Get().RefreshAnimeCollection(context.Background())
	ClearLibraryCollectionCache()


	return h.RespondWithData(c, true)
}

// HandleUpdateAnimeEntryRepeat
//
//	@summary updates the repeat count of an anime entry.
//	@desc This is used when the user manually updates the repeat count of an anime.
//	@route /api/v1/library/anime-entry/repeat [POST]
//	@param mediaId - int - true - "Anime media ID"
//	@param repeat - int - true - "New repeat count"
//	@returns bool
func (h *Handler) HandleUpdateAnimeEntryRepeat(c echo.Context) error {

	type body struct {
		MediaId int `json:"mediaId"`
		Repeat  int `json:"repeat"`
	}
	b := new(body)
	if err := c.Bind(b); err != nil {
		return h.RespondWithError(c, err)
	}

	err := h.App.Metadata.PlatformRef.Get().UpdateEntryRepeat(c.Request().Context(), b.MediaId, b.Repeat)
	if err != nil {
		return h.RespondWithError(c, err)
	}

	_, _ = h.App.Metadata.PlatformRef.Get().RefreshAnimeCollection(context.Background())
	ClearLibraryCollectionCache()


	return h.RespondWithData(c, true)
}

// HandleManualMatch is used to manually match a group of local files to a media.
// It will create a new scanner and run it for the selected files.
func (h *Handler) HandleManualMatch(c echo.Context) error {
	type body struct {
		MediaId int      `json:"mediaId"`
		Paths   []string `json:"paths"`
	}
	b := new(body)
	if err := c.Bind(b); err != nil {
		return h.RespondWithError(c, err)
	}

	lfs, lfsID, err := db.GetLocalFiles(h.App.Database)
	if err != nil {
		return h.RespondWithError(c, err)
	}

	// Get the local files that are being matched
	selectedLfs := lo.Filter(lfs, func(lf *dto.LocalFile, _ int) bool {
		return matchesAnyRequestedPath(lf.Path, b.Paths)
	})
	if len(selectedLfs) == 0 {
		return h.RespondWithError(c, errors.New("no local files found for the given paths"))
	}

	// Clear metadata cache to ensure fresh data
	_ = db.DeleteMetadataCache(h.App.Database, "jikan-anime-episodes", strconv.Itoa(b.MediaId))
	_ = db.DeleteMetadataCache(h.App.Database, "tmdb-tv-details", strconv.Itoa(b.MediaId))
	_ = db.DeleteMetadataCache(h.App.Database, "tmdb-movie-details", strconv.Itoa(b.MediaId))
	h.App.Metadata.ProviderRef.Get().ClearCache()

	libraryMediaID, err := h.ensureLibraryMediaForManualMatch(c.Request().Context(), b.MediaId, lfs)
	if err != nil {
		return h.RespondWithError(c, err)
	}

	for _, lf := range selectedLfs {
		lf.MediaId = b.MediaId
		lf.LibraryMediaId = libraryMediaID
		lf.Locked = true
		lf.Ignored = false
		ensureManualMatchMetadata(lf)
	}

	if lfsID == 0 {
		_, err = db.InsertLocalFiles(h.App.Database, lfs)
	} else {
		_, err = db.SaveLocalFiles(h.App.Database, lfsID, lfs)
	}
	if err != nil {
		return h.RespondWithError(c, err)
	}

	// Refresh the collection
	_, _ = h.App.Metadata.PlatformRef.Get().RefreshAnimeCollection(context.Background())
	ClearLibraryCollectionCache()

	return h.RespondWithData(c, true)
}

// HandleUnmatchFiles will unmatch the given local files.
// It will set the mediaId of the files to 0 and remove the metadata.
func (h *Handler) HandleUnmatchFiles(c echo.Context) error {
	type body struct {
		Paths []string `json:"paths"`
	}
	b := new(body)
	if err := c.Bind(b); err != nil {
		return h.RespondWithError(c, err)
	}

	lfs, lfsID, err := db.GetLocalFiles(h.App.Database)
	if err != nil {
		return h.RespondWithError(c, err)
	}

	// Get the local files that are being unmatched
	selectedLfs := lo.Filter(lfs, func(lf *dto.LocalFile, _ int) bool {
		return matchesAnyRequestedPath(lf.Path, b.Paths)
	})
	if len(selectedLfs) == 0 {
		return h.RespondWithError(c, errors.New("no local files found for the given paths"))
	}

	// Unmatch the files
	for _, lf := range selectedLfs {
		lf.MediaId = 0
		lf.Metadata = nil
		lf.Locked = false
		lf.Ignored = false
	}

	// Save local files
	_, err = db.SaveLocalFiles(h.App.Database, lfsID, lfs)
	if err != nil {
		return h.RespondWithError(c, err)
	}

	ClearLibraryCollectionCache()



	return h.RespondWithData(c, true)
}

func matchesAnyRequestedPath(localFilePath string, requestedPaths []string) bool {
	localNormalized := util.NormalizePath(localFilePath)
	for _, requestedPath := range requestedPaths {
		requestedNormalized := strings.TrimSuffix(util.NormalizePath(requestedPath), "/")
		if requestedNormalized == "" {
			continue
		}
		if localNormalized == requestedNormalized {
			return true
		}
		if strings.HasPrefix(localNormalized, requestedNormalized+"/") {
			return true
		}
	}
	return false
}

func ensureManualMatchMetadata(lf *dto.LocalFile) {
	if lf.Metadata == nil {
		lf.Metadata = &dto.LocalFileMetadata{}
	}
	if lf.Metadata.Type == "" {
		lf.Metadata.Type = dto.LocalFileTypeMain
	}
	if lf.ParsedData == nil || lf.ParsedData.Episode == "" {
		return
	}
	episode, err := strconv.Atoi(lf.ParsedData.Episode)
	if err != nil {
		return
	}
	if lf.Metadata.Episode == 0 {
		lf.Metadata.Episode = episode
	}
	if lf.Metadata.AniDBEpisode == "" {
		lf.Metadata.AniDBEpisode = fmt.Sprintf("%d", episode)
	}
}

func (h *Handler) getLibraryMediaIDForMedia(mediaID int, lfs []*dto.LocalFile) uint {
	for _, lf := range lfs {
		if lf.MediaId == mediaID && lf.LibraryMediaId > 0 {
			return lf.LibraryMediaId
		}
	}
	return 0
}

func (h *Handler) ensureLibraryMediaForManualMatch(ctx context.Context, mediaID int, lfs []*dto.LocalFile) (uint, error) {
	if existingID := h.getLibraryMediaIDForMedia(mediaID, lfs); existingID > 0 {
		return existingID, nil
	}

	if h.App.Metadata.TMDBClient == nil {
		return 0, errors.New("tmdb client is not configured")
	}

	provider := librarymetadata.NewTMDBProviderWithClient(h.App.Metadata.TMDBClient, h.App.Database)
	media, err := provider.GetMediaDetails(ctx, strconv.Itoa(mediaID))
	if err != nil {
		return 0, err
	}
	if media == nil {
		return 0, errors.New("media details not found")
	}

	saved, err := db.InsertLibraryMedia(h.App.Database, normalizedMediaToLibraryMedia(media))
	if err != nil {
		return 0, err
	}

	return saved.ID, nil
}

func normalizedMediaToLibraryMedia(media *dto.NormalizedMedia) *models.LibraryMedia {
	ret := &models.LibraryMedia{
		Type:           "SHOW",
		Format:         "TV",
		MetadataStatus: "COMPLETE",
	}

	if media == nil {
		return ret
	}

	if media.Format != nil {
		ret.Format = string(*media.Format)
		if ret.Format == "MOVIE" {
			ret.Type = "MOVIE"
		}
	}
	if media.TmdbId != nil {
		ret.TmdbId = *media.TmdbId
	}
	if media.Title != nil {
		if media.Title.Native != nil {
			ret.TitleOriginal = *media.Title.Native
		}
		if media.Title.Romaji != nil {
			ret.TitleRomaji = *media.Title.Romaji
		}
		if media.Title.English != nil {
			ret.TitleEnglish = *media.Title.English
		}
		if media.Title.Spanish != nil {
			ret.TitleSpanish = *media.Title.Spanish
		}
		if ret.TitleEnglish == "" && media.Title.UserPreferred != nil {
			ret.TitleEnglish = *media.Title.UserPreferred
		}
	}
	if media.Description != nil {
		ret.Description = *media.Description
	}
	if media.Score != nil {
		ret.Score = *media.Score
	}
	if len(media.Genres) > 0 {
		if b, err := json.Marshal(media.Genres); err == nil {
			ret.Genres = b
		}
	}
	if media.CoverImage != nil && media.CoverImage.Large != nil {
		ret.PosterImage = *media.CoverImage.Large
	}
	if media.BannerImage != nil {
		ret.BannerImage = *media.BannerImage
	}
	if media.Year != nil {
		ret.Year = *media.Year
	}
	if media.Episodes != nil {
		ret.TotalEpisodes = *media.Episodes
	}
	if media.Status != nil {
		ret.Status = string(*media.Status)
	}
	if media.MetadataStatus != nil && *media.MetadataStatus != "" {
		ret.MetadataStatus = *media.MetadataStatus
	}

	return ret
}

// HandleDeletePlatformEntry will delete the given media entry from Platform.
func (h *Handler) HandleDeletePlatformEntry(c echo.Context) error {
	type body struct {
		MediaId int `json:"mediaId"`
	}
	b := new(body)
	if err := c.Bind(b); err != nil {
		return h.RespondWithError(c, err)
	}

	// Delete the entry from the user's collection
	if err := h.App.Metadata.PlatformRef.Get().DeleteEntry(c.Request().Context(), b.MediaId, b.MediaId); err != nil {
		return h.RespondWithError(c, errors.New("error: Platform responded with an error, this is most likely a rate limit issue"))
	}
	_, _ = h.App.Metadata.PlatformRef.Get().RefreshAnimeCollection(context.Background())

	return h.RespondWithData(c, true)
}



// HandleGetMissingEpisodes
//
//	@summary returns a list of missing episodes.
//	@desc This is used by the "Missing episodes" page to display the missing episodes.
//	@route /api/v1/library/missing-episodes [GET]
//	@returns anime.MissingEpisodes
func (h *Handler) HandleGetMissingEpisodes(c echo.Context) error {
	mIds, _ := h.App.Database.GetSilencedMediaEntryIds()

	lfs, _, err := db.GetLocalFiles(h.App.Database)
	if err != nil {
		return h.RespondWithError(c, err)
	}

	missing := anime.NewMissingEpisodes(&anime.NewMissingEpisodesOptions{
		Database:            h.App.Database,
		LocalFiles:          lfs,
		SilencedMediaIds:    mIds,
		MetadataProviderRef: h.App.Metadata.ProviderRef,
	})

	return h.RespondWithData(c, missing)
}

// HandleSilenceMissingEpisodes will silence the missing episodes for the given media.
func (h *Handler) HandleSilenceMissingEpisodes(c echo.Context) error {
	type body struct {
		MediaId int `json:"mediaId"`
	}
	b := new(body)
	if err := c.Bind(b); err != nil {
		return h.RespondWithError(c, err)
	}

	if err := h.App.Database.InsertSilencedMediaEntry(uint(b.MediaId)); err != nil {
		return h.RespondWithError(c, err)
	}

	return h.RespondWithData(c, true)
}

// HandleGetUpcomingEpisodes
//
//	@summary returns a list of upcoming episodes.
//	@desc This is used by the "Upcoming" page to display the upcoming episodes.
//	@route /api/v1/library/upcoming-episodes [GET]
//	@returns anime.UpcomingEpisodes
func (h *Handler) HandleGetUpcomingEpisodes(c echo.Context) error {
	animeCollection, err := h.App.GetAnimeCollection(false)
	if err != nil {
		return h.RespondWithError(c, err)
	}

	upcoming := anime.NewUpcomingEpisodes(&anime.NewUpcomingEpisodesOptions{
		AnimeCollection:     animeCollection,
		MetadataProviderRef: h.App.Metadata.ProviderRef,
	})

	return h.RespondWithData(c, upcoming)
}

// --- Anime Entry Actions ---

func (h *Handler) HandleAnimeEntryBulkAction(c echo.Context) error {
	type body struct {
		MediaId int    `json:"mediaId"`
		Action  string `json:"action"`
	}
	var b body
	if err := c.Bind(&b); err != nil {
		return h.RespondWithError(c, err)
	}
	if b.MediaId == 0 {
		return c.JSON(http.StatusBadRequest, NewErrorResponse(fmt.Errorf("mediaId is required")))
	}

	lfs, lfsId, err := db.GetLocalFiles(h.App.Database)
	if err != nil {
		return h.RespondWithError(c, err)
	}

	mediaFiles := lo.Filter(lfs, func(lf *dto.LocalFile, _ int) bool {
		return lf.MediaId == b.MediaId
	})
	if len(mediaFiles) == 0 {
		return h.RespondWithData(c, true) // no-op
	}

	paths := lo.Map(mediaFiles, func(lf *dto.LocalFile, _ int) string { return lf.Path })
	for _, lf := range lfs {
		if !lo.Contains(paths, lf.Path) {
			continue
		}
		switch b.Action {
		case "lock":
			lf.Locked = true
		case "unlock":
			lf.Locked = false
		case "ignore":
			lf.Ignored = true
			lf.Locked = false
		case "unignore":
			lf.Ignored = false
		}
	}

	if _, err := db.SaveLocalFiles(h.App.Database, lfsId, lfs); err != nil {
		return h.RespondWithError(c, err)
	}
	return h.RespondWithData(c, true)
}

func (h *Handler) HandleOpenAnimeEntryInExplorer(c echo.Context) error {
	type body struct {
		MediaId int `json:"mediaId"`
	}
	var b body
	if err := c.Bind(&b); err != nil {
		return h.RespondWithError(c, err)
	}

	lfs, _, err := db.GetLocalFiles(h.App.Database)
	if err != nil {
		return h.RespondWithError(c, err)
	}

	var targetPath string
	for _, lf := range lfs {
		if lf.MediaId == b.MediaId && lf.Path != "" {
			targetPath = lf.Path
			break
		}
	}

	if targetPath == "" {
		return c.JSON(http.StatusNotFound, NewErrorResponse(fmt.Errorf("no local files found for mediaId %d", b.MediaId)))
	}

	var cmd *exec.Cmd
	switch runtime.GOOS {
	case "windows":
		cmd = exec.Command("explorer", "/select,", targetPath)
	case "darwin":
		cmd = exec.Command("open", "-R", targetPath)
	default:
		cmd = exec.Command("xdg-open", targetPath)
	}

	if err := cmd.Start(); err != nil {
		h.App.Logger.Warn().Err(err).Str("path", targetPath).Msg("handlers: Could not open file explorer")
	}
	return h.RespondWithData(c, true)
}

// HandleGetAnimeEntrySilenceStatus returns a stable no-op silence status.
func (h *Handler) HandleGetAnimeEntrySilenceStatus(c echo.Context) error {
	return h.RespondWithData(c, map[string]interface{}{
		"mediaId":  c.Param("id"),
		"silenced": false,
	})
}

// HandleToggleAnimeEntrySilenceStatus toggles the silence flag (no-op until DB column exists).
func (h *Handler) HandleToggleAnimeEntrySilenceStatus(c echo.Context) error {
	type body struct {
		MediaId int `json:"mediaId"`
	}
	var b body
	if err := c.Bind(&b); err != nil {
		return h.RespondWithError(c, err)
	}
	return h.RespondWithData(c, map[string]interface{}{
		"mediaId":  b.MediaId,
		"silenced": false, // Placeholder until silence column is added to DB
	})
}
