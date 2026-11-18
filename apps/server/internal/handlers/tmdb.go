package handlers

import (
	"errors"
	"kamehouse/internal/api/jikan"
	"kamehouse/internal/api/tmdb"
	"kamehouse/internal/constants"
	"kamehouse/internal/database/db"
	"kamehouse/internal/database/models"
	"kamehouse/internal/database/models/dto"
	librarymetadata "kamehouse/internal/library/metadata"
	"net/http"

	"strconv"

	"github.com/labstack/echo/v4"
	"github.com/samber/lo"
)

// HandleTMDBSearch ...
//
//	@summary search TMDB (or Jikan fallback) for anime/TV show metadata.
//	@desc Searches TMDB for TV shows matching the query, falling back to Jikan if no TMDB API key exists.
//	@returns []map[string]interface{}
//	@route /api/v1/tmdb/search [POST]
func (h *Handler) HandleTMDBSearch(c echo.Context) error {
	type body struct {
		Query       string `json:"query"`
		BearerToken string `json:"bearerToken"`
		SearchType  string `json:"searchType"` // "tv" | "movie" | "multi" (default: "multi")
	}

	var b body
	if err := c.Bind(&b); err != nil {
		return h.RespondWithError(c, err)
	}

	if b.Query == "" {
		return h.RespondWithCodeError(c, http.StatusBadRequest, errors.New("query is required"))
	}

	client := h.App.Metadata.GetTMDBClient()
	if client == nil && b.BearerToken != "" {
		client = tmdb.NewClient(b.BearerToken)
	}
	hasTmdbKey := client != nil && (client.HasApiKey() || b.BearerToken != "")

	searchType := b.SearchType
	if searchType == "" {
		searchType = "multi"
	}
	if searchType != "tv" && searchType != "movie" && searchType != "multi" {
		return h.RespondWithCodeError(c, http.StatusBadRequest, errors.New("invalid searchType, expected 'tv', 'movie', or 'multi'"))
	}

	// Collect results with media_type annotation
	var combined []map[string]interface{}

	if hasTmdbKey && client != nil {
		if searchType == "tv" || searchType == "multi" {
			tvResults, err := client.SearchTV(c.Request().Context(), b.Query)
			if err == nil {
				for _, r := range tvResults {
					m := map[string]interface{}{
						"id":             r.ID,
						"provider":       "tmdb",
						"name":           r.Name,
						"first_air_date": r.FirstAirDate,
						"poster_path":    r.PosterPath,
						"overview":       r.Overview,
						"vote_average":   r.VoteAverage,
						"media_type":     "tv",
					}
					combined = append(combined, m)
				}
			}
		}

		if searchType == "movie" || searchType == "multi" {
			movieResults, err := client.SearchMovie(c.Request().Context(), b.Query)
			if err == nil {
				for _, r := range movieResults {
					m := map[string]interface{}{
						"id":           r.ID,
						"provider":     "tmdb",
						"title":        r.Title,
						"release_date": r.ReleaseDate,
						"poster_path":  r.PosterPath,
						"overview":     r.Overview,
						"vote_average": r.VoteAverage,
						"media_type":   "movie",
					}
					combined = append(combined, m)
				}
			}
		}
	}

	// Fallback to Jikan if TMDB search produced no results or no TMDB key is configured
	if len(combined) == 0 {
		jikanClient := jikan.Shared(h.App.Logger)
		jikanRes, err := jikanClient.SearchAnimeAdvanced(c.Request().Context(), b.Query, 1, 20)
		if err == nil && jikanRes != nil {
			for _, r := range jikanRes.Data {
				name := r.TitleEng
				if name == "" {
					name = r.Title
				}
				m := map[string]interface{}{
					"id":          r.MalID,
					"provider":    "jikan",
					"name":        name,
					"title":       name,
					"poster_path": r.Images.Jpg.LargeImageUrl,
					"overview":    r.Synopsis,
					"media_type":  "tv",
					"is_jikan":    true,
				}
				combined = append(combined, m)
			}
		}
	}

	// Contrato: siempre array (nunca null) para no romper clientes que iteran.
	if combined == nil {
		combined = []map[string]interface{}{}
	}

	return h.RespondWithData(c, combined)
}

// HandleTMDBAssign ...
//
//	@summary manually assign a metadata ID to a set of local files.
//	@desc Fetches full details from TMDB or Jikan, upserts LibraryMedia, and updates local files.
//	@route /api/v1/library/local-files/tmdb-assign [POST]
func (h *Handler) HandleTMDBAssign(c echo.Context) error {
	type body struct {
		Paths      []string `json:"paths"`
		TmdbID     int      `json:"tmdbId"` // legacy TMDB-only ID
		ExternalID int      `json:"externalId"`
		Provider   string   `json:"provider"`
		MediaType  string   `json:"mediaType"` // "tv" or "movie"
	}

	var b body
	if err := c.Bind(&b); err != nil {
		return h.RespondWithError(c, err)
	}

	if len(b.Paths) == 0 {
		return h.RespondWithCodeError(c, http.StatusBadRequest, errors.New("paths is required"))
	}
	if b.ExternalID == 0 {
		b.ExternalID = b.TmdbID
	}
	if b.Provider == "" {
		b.Provider = "tmdb"
	} // legacy endpoint IDs are TMDB IDs
	if b.Provider != "tmdb" && b.Provider != "jikan" {
		return h.RespondWithCodeError(c, http.StatusBadRequest, errors.New("provider must be tmdb or jikan"))
	}
	if b.ExternalID <= 0 {
		return h.RespondWithCodeError(c, http.StatusBadRequest, errors.New("valid positive externalId is required"))
	}
	if b.MediaType != "" && b.MediaType != "tv" && b.MediaType != "movie" {
		return h.RespondWithCodeError(c, http.StatusBadRequest, errors.New("invalid mediaType, expected 'tv' or 'movie'"))
	}

	// 1. Fetch full details from TMDB or Jikan
	token := h.App.Config.Metadata.TMDBApiKey
	lang := h.App.Config.Metadata.TMDBLanguage
	// Match the live metadata client: keys entered in Settings take precedence
	// over the config-file fallback.
	if settings, err := h.App.Database.GetSettings(); err == nil && settings != nil {
		if settings.Library.TmdbApiKey != "" {
			token = settings.Library.TmdbApiKey
		}
		if settings.Library.TmdbLanguage != "" {
			lang = settings.Library.TmdbLanguage
		}
	}
	if lang == "" {
		lang = "es-MX"
	}

	var provider librarymetadata.Provider
	if b.Provider == "tmdb" {
		if token == "" {
			return h.RespondWithCodeError(c, http.StatusServiceUnavailable, errors.New("tmdb client not configured"))
		}
		provider = librarymetadata.NewTMDBProvider(token, h.App.Database, lang)
	} else {
		provider = librarymetadata.NewJikanProvider(h.App.Database, h.App.Logger)
	}

	publicID := b.ExternalID
	mediaType := "ANIME"
	if b.Provider == "tmdb" {
		mediaType = "SHOW"
	}
	lookUpID := strconv.Itoa(b.ExternalID)
	if b.Provider == "tmdb" && b.MediaType == "movie" {
		publicID += constants.MovieIDOffset
		mediaType = "MOVIE"
		lookUpID = strconv.Itoa(publicID)
	}

	nm, err := provider.GetMediaDetails(c.Request().Context(), lookUpID)
	if err != nil {
		return h.RespondWithError(c, err)
	}

	// 2. Map NormalizedMedia to LibraryMedia
	libMedia := &models.LibraryMedia{
		Type:          mediaType,
		TmdbID:        b.ExternalID,
		Format:        string(lo.FromPtrOr(nm.Format, dto.MediaFormatTV)),
		TotalEpisodes: lo.FromPtrOr(nm.Episodes, 0),
		Year:          lo.FromPtrOr(nm.Year, 0),
		Description:   lo.FromPtrOr(nm.Description, ""),
	}
	if b.Provider == "jikan" {
		libMedia.MyanimelistId = b.ExternalID
	}
	if nm.MyanimelistId != nil && *nm.MyanimelistId > 0 {
		libMedia.MyanimelistId = *nm.MyanimelistId
	}
	if nm.Title != nil {
		libMedia.TitleRomaji = lo.FromPtrOr(nm.Title.Romaji, "")
		libMedia.TitleEnglish = lo.FromPtrOr(nm.Title.English, "")
		libMedia.TitleOriginal = lo.FromPtrOr(nm.Title.Native, "")
	}
	if nm.CoverImage != nil {
		libMedia.PosterImage = lo.FromPtrOr(nm.CoverImage.Large, "")
	}
	if nm.BannerImage != nil {
		libMedia.BannerImage = *nm.BannerImage
	}
	if nm.LogoImage != nil {
		libMedia.LogoImage = *nm.LogoImage
	}
	if nm.ThumbImage != nil {
		libMedia.ThumbImage = *nm.ThumbImage
	}
	if nm.ClearArtImage != nil {
		libMedia.ClearArtImage = *nm.ClearArtImage
	}

	if err := db.AssignLibraryMediaFiles(c.Request().Context(), h.App.Database, libMedia, publicID, b.Paths); err != nil {
		if errors.Is(err, db.ErrAssignmentPathNotFound) {
			return h.RespondWithCodeError(c, http.StatusNotFound, err)
		}
		return h.RespondWithError(c, err)
	}

	ClearLibraryCollectionCache()

	return h.RespondWithData(c, true)
}

// HandleTMDBEpisodeStill fetches the real still for a TV episode by absolute number.
//
//	@summary get TMDB episode still by absolute episode number
//	@desc Maps absolute->season/episode server-side and returns still_path for chronology thumbnails.
//	@route /api/v1/tmdb/episode/:tvId/:absolute [GET]
func (h *Handler) HandleTMDBEpisodeStill(c echo.Context) error {
	tvID, err := strconv.Atoi(c.Param("tvId"))
	if err != nil || tvID <= 0 {
		return h.RespondWithCodeError(c, http.StatusBadRequest, errors.New("valid positive tvId is required"))
	}
	absolute, err := strconv.Atoi(c.Param("absolute"))
	if err != nil || absolute <= 0 {
		return h.RespondWithCodeError(c, http.StatusBadRequest, errors.New("valid positive absolute episode is required"))
	}

	client := h.App.Metadata.GetTMDBClient()
	if client == nil || !client.HasApiKey() {
		return h.RespondWithCodeError(c, http.StatusServiceUnavailable, errors.New("tmdb client not configured"))
	}

	ep, err := client.GetTVEpisode(c.Request().Context(), tvID, absolute)
	if err != nil {
		return h.RespondWithError(c, err)
	}

	stillURL := ""
	if ep.StillPath != "" {
		stillURL = "https://image.tmdb.org/t/p/w780" + ep.StillPath
	}

	return h.RespondWithData(c, map[string]interface{}{
		"tvId":            tvID,
		"season":          ep.SeasonNumber,
		"episode":         ep.EpisodeNumber,
		"absoluteEpisode": absolute,
		"name":            ep.Name,
		"overview":        ep.Overview,
		"stillPath":       ep.StillPath,
		"stillUrl":        stillURL,
		"airDate":         ep.AirDate,
	})
}
