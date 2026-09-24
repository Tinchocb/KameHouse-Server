package handlers

import (
	"context"
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

	client := h.App.Metadata.TMDBClient
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
		jikanClient := jikan.NewClient(h.App.Logger)
		jikanRes, err := jikanClient.SearchAnimeAdvanced(c.Request().Context(), b.Query, 1, 20)
		if err == nil && jikanRes != nil {
			for _, r := range jikanRes.Data {
				name := r.TitleEng
				if name == "" {
					name = r.Title
				}
				m := map[string]interface{}{
					"id":          r.MalID,
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

// HandleTMDBGetDetails ...
//
//	@summary get TMDB (or Jikan) anime details and alternative titles.
//	@desc Returns detailed metadata and alternative titles for a show.
//	@returns map[string]interface{}
//	@route /api/v1/tmdb/details [POST]
func (h *Handler) HandleTMDBGetDetails(c echo.Context) error {
	type body struct {
		ID          int    `json:"id"`
		TVID        int    `json:"tvId"` // Legacy
		MediaType   string `json:"mediaType"`
		BearerToken string `json:"bearerToken"`
	}

	var b body
	if err := c.Bind(&b); err != nil {
		return h.RespondWithError(c, err)
	}

	id := b.ID
	if id == 0 {
		id = b.TVID
	}

	if id <= 0 {
		return h.RespondWithCodeError(c, http.StatusBadRequest, errors.New("valid positive id is required"))
	}
	if b.MediaType != "" && b.MediaType != "tv" && b.MediaType != "movie" {
		return h.RespondWithCodeError(c, http.StatusBadRequest, errors.New("invalid mediaType, expected 'tv' or 'movie'"))
	}

	client := h.App.Metadata.TMDBClient
	var altTitles []tmdb.AlternativeTitle
	var err error

	if client != nil && client.HasApiKey() {
		if b.MediaType == "movie" {
			altTitles, err = client.GetMovieAlternativeTitles(c.Request().Context(), id)
		} else {
			altTitles, err = client.GetTVAlternativeTitles(c.Request().Context(), id)
		}
	}

	if client == nil || !client.HasApiKey() || err != nil || len(altTitles) == 0 {
		// Fallback: fetch details from Jikan
		jikanClient := jikan.NewClient(h.App.Logger)
		if fullRes, jErr := jikanClient.GetAnimeFull(c.Request().Context(), id); jErr == nil && fullRes != nil {
			if fullRes.Data.TitleEng != "" {
				altTitles = append(altTitles, tmdb.AlternativeTitle{
					Title:    fullRes.Data.TitleEng,
					ISO31661: "US",
					Type:     "English Title",
				})
			}
			if fullRes.Data.TitleJpn != "" {
				altTitles = append(altTitles, tmdb.AlternativeTitle{
					Title:    fullRes.Data.TitleJpn,
					ISO31661: "JP",
					Type:     "Japanese Title",
				})
			}
			if fullRes.Data.Title != "" && fullRes.Data.Title != fullRes.Data.TitleEng {
				altTitles = append(altTitles, tmdb.AlternativeTitle{
					Title:    fullRes.Data.Title,
					ISO31661: "RO",
					Type:     "Romaji Title",
				})
			}
			err = nil
		}
	}

	if err != nil && len(altTitles) == 0 {
		return h.RespondWithError(c, err)
	}

	return h.RespondWithData(c, map[string]interface{}{
		"id":                id,
		"alternativeTitles": altTitles,
	})
}

// HandleTMDBAssign ...
//
//	@summary manually assign a metadata ID to a set of local files.
//	@desc Fetches full details from TMDB or Jikan, upserts LibraryMedia, and updates local files.
//	@route /api/v1/library/local-files/tmdb-assign [POST]
func (h *Handler) HandleTMDBAssign(c echo.Context) error {
	type body struct {
		Paths     []string `json:"paths"`
		TmdbID    int      `json:"tmdbId"`
		MediaType string   `json:"mediaType"` // "tv" or "movie"
	}

	var b body
	if err := c.Bind(&b); err != nil {
		return h.RespondWithError(c, err)
	}

	if len(b.Paths) == 0 {
		return h.RespondWithCodeError(c, http.StatusBadRequest, errors.New("paths is required"))
	}
	if b.TmdbID <= 0 {
		return h.RespondWithCodeError(c, http.StatusBadRequest, errors.New("valid positive tmdbId is required"))
	}
	if b.MediaType != "" && b.MediaType != "tv" && b.MediaType != "movie" {
		return h.RespondWithCodeError(c, http.StatusBadRequest, errors.New("invalid mediaType, expected 'tv' or 'movie'"))
	}

	// 1. Fetch full details from TMDB or Jikan
	token := h.App.Config.Metadata.TMDBApiKey
	lang := h.App.Config.Metadata.TMDBLanguage
	if lang == "" {
		lang = "es-MX"
	}

	var provider librarymetadata.Provider
	if token != "" {
		provider = librarymetadata.NewTMDBProvider(token, h.App.Database, lang)
	} else {
		provider = librarymetadata.NewJikanProvider(h.App.Database, h.App.Logger)
	}
	
	lookUpID := strconv.Itoa(b.TmdbID)
	if token != "" && b.MediaType == "movie" {
		lookUpID = strconv.Itoa(b.TmdbID + constants.MovieIDOffset)
	}

	nm, err := provider.GetMediaDetails(c.Request().Context(), lookUpID)
	if err != nil {
		return h.RespondWithError(c, err)
	}

	// 2. Map NormalizedMedia to LibraryMedia
	libMedia := &models.LibraryMedia{
		Type:          "ANIME",
		TmdbID:        b.TmdbID,
		Format:        string(lo.FromPtrOr(nm.Format, dto.MediaFormatTV)),
		TotalEpisodes: lo.FromPtrOr(nm.Episodes, 0),
		Year:          lo.FromPtrOr(nm.Year, 0),
		Description:   lo.FromPtrOr(nm.Description, ""),
	}
	if token == "" {
		libMedia.MyanimelistId = b.TmdbID
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

	// 3. Upsert LibraryMedia
	savedMedia, err := db.InsertLibraryMedia(h.App.Database, libMedia)
	if err != nil {
		return h.RespondWithError(c, err)
	}

	// 4. Update LocalFiles
	lfs, lfsID, err := db.GetLocalFiles(h.App.Database)
	if err != nil {
		return h.RespondWithError(c, err)
	}

	for _, path := range b.Paths {
		lf, found := lo.Find(lfs, func(f *dto.LocalFile) bool {
			return f.HasSamePath(path)
		})
		if found {
			lf.MediaID = b.TmdbID
			lf.LibraryMediaId = savedMedia.ID
			lf.Locked = true   // Lock it to prevent scanner from changing it
			lf.Ignored = false
		}
	}

	_, err = db.SaveLocalFiles(h.App.Database, lfsID, lfs)
	if err != nil {
		return h.RespondWithError(c, err)
	}

	// 5. Refresh collection
	_, _ = h.App.Metadata.Platform.RefreshAnimeCollection(context.Background())
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

	client := h.App.Metadata.TMDBClient
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

// HandleTMDBImages fetches all backdrops, posters, and logos for a TV show or movie from TMDb.
//
//	@summary get TMDB images (backdrops, posters, logos)
//	@desc Fetches backdrops, posters, and logos from TMDb with caching.
//	@route /api/v1/tmdb/images/:type/:id [GET]
func (h *Handler) HandleTMDBImages(c echo.Context) error {
	mediaType := c.Param("type") // "tv" or "movie"
	idStr := c.Param("id")
	id, err := strconv.Atoi(idStr)
	if err != nil || id <= 0 {
		return h.RespondWithCodeError(c, http.StatusBadRequest, errors.New("valid positive id is required"))
	}

	client := h.App.Metadata.TMDBClient
	if client == nil || !client.HasApiKey() {
		return h.RespondWithCodeError(c, http.StatusServiceUnavailable, errors.New("tmdb client not configured"))
	}

	var resp *tmdb.ImagesResponse
	if mediaType == "movie" {
		resp, err = client.GetMovieImages(c.Request().Context(), id)
	} else if mediaType == "tv" {
		resp, err = client.GetTVImages(c.Request().Context(), id)
	} else {
		return h.RespondWithCodeError(c, http.StatusBadRequest, errors.New("invalid type, expected 'tv' or 'movie'"))
	}

	if err != nil {
		return h.RespondWithError(c, err)
	}

	return h.RespondWithData(c, resp)
}


