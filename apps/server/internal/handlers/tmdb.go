package handlers

import (
	"context"
	"kamehouse/internal/api/tmdb"
	"kamehouse/internal/database/db"
	"kamehouse/internal/database/models"
	"kamehouse/internal/database/models/dto"
	librarymetadata "kamehouse/internal/library/metadata"
	"net/http"
	"os"
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
	}

	var b body
	if err := c.Bind(&b); err != nil {
		return h.RespondWithError(c, err)
	}

	if b.Query == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "query is required"})
	}
	if b.BearerToken == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "TMDB bearer token is required"})
	}

	client := tmdb.NewClient(b.BearerToken) // uses default es-ES language
	results, err := client.SearchTV(c.Request().Context(), b.Query)
	if err != nil {
		return h.RespondWithError(c, err)
	}

	return h.RespondWithData(c, results)
}

// HandleTMDBGetDetails
//
//	@summary get TMDB TV show details and alternative titles.
//	@desc Returns detailed metadata and alternative titles for a TMDB TV show.
//	@returns map[string]interface{}
//	@route /api/v1/tmdb/details [POST]
func (h *Handler) HandleTMDBGetDetails(c echo.Context) error {
	type body struct {
		TVID        int    `json:"tvId"`
		BearerToken string `json:"bearerToken"`
	}

	var b body
	if err := c.Bind(&b); err != nil {
		return h.RespondWithError(c, err)
	}

	if b.TVID == 0 {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "tvId is required"})
	}
	if b.BearerToken == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "TMDB bearer token is required"})
	}

	client := tmdb.NewClient(b.BearerToken) // uses default es-ES language

	// Get alternative titles
	altTitles, _ := client.GetTVAlternativeTitles(c.Request().Context(), b.TVID)

	return h.RespondWithData(c, map[string]interface{}{
		"tvId":              b.TVID,
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
	token := h.App.Settings.Library.TmdbApiKey
	if token == "" {
		token = os.Getenv("KAMEHOUSE_TMDB_TOKEN")
	}
	if token == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "TMDB API key not configured"})
	}

	provider := librarymetadata.NewTMDBProvider(token, h.App.Settings.Library.TmdbLanguage)
	
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

