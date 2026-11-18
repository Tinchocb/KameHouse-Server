package handlers

import (
	"context"
	"kamehouse/internal/database/models"

	"github.com/labstack/echo/v4"
)

// HandleClearMetadataCache ...
//
//	@summary clears provider metadata cache.
//	@desc Deletes persisted TMDB/Jikan/AniList episode & media detail caches (all
//	@desc language variants) so the next scan re-fetches them — e.g. after changing
//	@desc the metadata language — and clears the in-memory metadata caches.
//	@desc Migration markers and user data are preserved.
//	@route /api/v1/metadata/cache [DELETE]
//	@returns bool
func (h *Handler) HandleClearMetadataCache(c echo.Context) error {
	if _, err := h.clearProviderMetadata(c.Request().Context()); err != nil {
		return h.RespondWithError(c, err)
	}
	return h.RespondWithData(c, true)
}

// Both manual entry points share the same namespace allowlist and barriers.
func (h *Handler) clearProviderMetadata(ctx context.Context) (int64, error) {
	provider := h.App.Metadata.Provider
	if provider != nil {
		provider.ClearCache()
		defer provider.ClearCache()
	}
	providers := []string{
		"tmdb-api", "tmdb-anime-episodes", "tmdb-media-details", "tmdb-season-details",
		"tmdb-tv-details", "tmdb-movie-details", "jikan-anime-episodes", "jikan-media-details",
		"anilist-anime-episodes", "anilist-media-details", "anidb-anime-episodes", "anidb-media-details",
		"mal-anime-episodes", "mal-media-details", "animethemes", "scanner",
	}
	var count int64
	clear := func() error {
		if h.App.Database == nil {
			return nil
		}
		result := h.App.Database.Gorm().WithContext(ctx).Where("provider IN ?", providers).Delete(&models.MetadataCache{})
		count = result.RowsAffected
		return result.Error
	}
	var err error
	if client := h.App.Metadata.GetTMDBClient(); client != nil {
		err = client.ClearCacheWith(clear)
	} else {
		err = clear()
	}
	ClearAnimeEntryCache()
	return count, err
}
