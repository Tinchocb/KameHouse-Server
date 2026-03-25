package handlers

import (
	"context"
	"kamehouse/internal/api/tmdb"
	"kamehouse/internal/database/db"
	"kamehouse/internal/database/models"
	"kamehouse/internal/database/models/dto"
	librarymetadata "kamehouse/internal/library/metadata"
	"net/http"

	"strconv"

	"github.com/labstack/echo/v4"
	"github.com/samber/lo"
)

// HandleTMDBSearch
//
//	@summary search TMDB for anime/TV show metadata.
//	@desc Searches TMDB for TV shows matching the query. Requires TMDB bearer token in the request body.
//	@returns []tmdb.SearchResult
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
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "query is required"})
	}

	client := tmdb.NewClient("0584d4437be4d13174085bc9b4435985", "es-MX")

	searchType := b.SearchType
	if searchType == "" {
		searchType = "multi"
	}

	// Collect results with media_type annotation
	type annotated struct {
		MediaType string `json:"media_type"`
		ID        int    `json:"id"`
		// Embed raw fields by marshalling
		Data map[string]interface{} `json:"-"`
	}

	var combined []map[string]interface{}

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
					"media_type":   "movie",
				}
				combined = append(combined, m)
			}
		}
	}

	return h.RespondWithData(c, combined)
}

// HandleTMDBGetDetails
//
//	@summary get TMDB TV show details and alternative titles.
//	@desc Returns detailed metadata and alternative titles for a TMDB TV show.
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

	if id == 0 {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "id is required"})
	}

	client := tmdb.NewClient("0584d4437be4d13174085bc9b4435985", "es-MX")

	var altTitles []tmdb.AlternativeTitle
	var err error
	if b.MediaType == "movie" {
		altTitles, err = client.GetMovieAlternativeTitles(c.Request().Context(), id)
	} else {
		altTitles, err = client.GetTVAlternativeTitles(c.Request().Context(), id)
	}

	if err != nil {
		return h.RespondWithError(c, err)
	}

	return h.RespondWithData(c, map[string]interface{}{
		"id":                id,
		"alternativeTitles": altTitles,
	})
}


// HandleTMDBAssign
//
//	@summary manually assign a TMDB ID to a set of local files.
//	@desc Fetches full TMDB details, upserts LibraryMedia, and updates the local files.
//	@route /api/v1/library/local-files/tmdb-assign [POST]
func (h *Handler) HandleTMDBAssign(c echo.Context) error {
	type body struct {
		Paths     []string `json:"paths"`
		TmdbId    int      `json:"tmdbId"`
		MediaType string   `json:"mediaType"` // "tv" or "movie"
	}

	var b body
	if err := c.Bind(&b); err != nil {
		return h.RespondWithError(c, err)
	}

	if len(b.Paths) == 0 {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "paths is required"})
	}
	if b.TmdbId == 0 {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "tmdbId is required"})
	}

	// 1. Fetch full details from TMDB
	token := "0584d4437be4d13174085bc9b4435985"
	lang := "es-MX"

	provider := librarymetadata.NewTMDBProvider(token, lang)
	
	lookUpId := strconv.Itoa(b.TmdbId)
	if b.MediaType == "movie" {
		lookUpId = strconv.Itoa(b.TmdbId + 1000000)
	}

	nm, err := provider.GetMediaDetails(c.Request().Context(), lookUpId)
	if err != nil {
		return h.RespondWithError(c, err)
	}

	// 2. Map NormalizedMedia to LibraryMedia
	libMedia := &models.LibraryMedia{
		Type:        "ANIME",
		TmdbId:      b.TmdbId,
		Format:      string(lo.FromPtrOr(nm.Format, dto.MediaFormatTV)),
		TotalEpisodes: lo.FromPtrOr(nm.Episodes, 0),
		Year:        lo.FromPtrOr(nm.Year, 0),
		Description: lo.FromPtrOr(nm.Description, ""),
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

	// 3. Upsert LibraryMedia
	savedMedia, err := db.InsertLibraryMedia(h.App.Database, libMedia)
	if err != nil {
		return h.RespondWithError(c, err)
	}

	// 4. Update LocalFiles
	lfs, lfsId, err := db.GetLocalFiles(h.App.Database)
	if err != nil {
		return h.RespondWithError(c, err)
	}

	for _, path := range b.Paths {
		lf, found := lo.Find(lfs, func(f *dto.LocalFile) bool {
			return f.HasSamePath(path)
		})
		if found {
			lf.MediaId = b.TmdbId
			lf.LibraryMediaId = savedMedia.ID
			lf.Locked = true   // Lock it to prevent scanner from changing it
			lf.Ignored = false
		}
	}

	_, err = db.SaveLocalFiles(h.App.Database, lfsId, lfs)
	if err != nil {
		return h.RespondWithError(c, err)
	}

	// 5. Refresh collection
	_, _ = h.App.Metadata.PlatformRef.Get().RefreshAnimeCollection(context.Background())

	return h.RespondWithData(c, true)
}

