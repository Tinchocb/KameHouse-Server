package handlers

import (
	"kamehouse/internal/database/db"

	"github.com/labstack/echo/v4"
)

// HandleClearMetadataCache ...
//
//	@summary clears provider metadata cache.
//	@desc Deletes persisted TMDB/Jikan/AniList episode & media detail caches (all
//	@desc language variants) so the next scan re-fetches them — e.g. after changing
//	@desc the metadata language — and clears the in-memory metadata caches.
//	@desc Migration markers and raw TMDB API responses are preserved.
//	@route /api/v1/metadata/cache [DELETE]
//	@returns bool
func (h *Handler) HandleClearMetadataCache(c echo.Context) error {
	providers := []string{
		"tmdb-api",
		"tmdb-anime-episodes",
		"tmdb-media-details",
		"tmdb-season-details",
		"tmdb-tv-details",
		"tmdb-movie-details",
		"jikan-anime-episodes",
		"jikan-media-details",
		"anilist-anime-episodes",
		"anilist-media-details",
		"anidb-anime-episodes",
		"anidb-media-details",
		"mal-anime-episodes",
		"mal-media-details",
		"animethemes",
		"scanner",
	}
	for _, p := range providers {
		_ = db.DeleteMetadataCacheByProvider(h.App.Database, p)
	}

	h.App.Metadata.Provider.ClearCache()
	if client := h.App.Metadata.GetTMDBClient(); client != nil {
		client.ClearCache()
	}

	return h.RespondWithData(c, true)
}
