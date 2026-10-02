package handlers

import (
	"errors"
	"kamehouse/internal/database/db"
	"kamehouse/internal/library/anime"
	"kamehouse/internal/platforms/platform"

	"github.com/labstack/echo/v4"
)

// HandlePopulateFillerData ...
//
//	@summary fetches and caches filler data for the given media.
//	@desc This will fetch and cache filler data for the given media.
//	@returns true
//	@route /api/v1/metadata-provider/filler [POST]
func (h *Handler) HandlePopulateFillerData(c echo.Context) error {
	type body struct {
		MediaID int `json:"mediaId"`
	}

	var b body
	if err := c.Bind(&b); err != nil {
		return h.RespondWithError(c, err)
	}

	animeCollection, err := h.App.GetAnimeCollection(false)
	if err != nil {
		return h.RespondWithError(c, err)
	}

	entry, found := animeCollection.GetListEntryFromMediaId(b.MediaID)
	var media *platform.UnifiedMedia
	if !found {
		// Fetch media from active platform (TMDB-based)
		m, err := h.App.Metadata.Platform.GetAnime(c.Request().Context(), b.MediaID)
		if err != nil {
			return h.RespondWithError(c, err)
		}
		var ok bool
		media, ok = m.(*platform.UnifiedMedia)
		if !ok || media == nil {
			return h.RespondWithError(c, errors.New("invalid media metadata"))
		}
	} else {
		media = entry.Media
	}

	if media == nil {
		return h.RespondWithError(c, errors.New("media not found"))
	}

	// Fetch filler data
	titles := make([]string, 0)
	if media.Title != nil {
		if media.Title.Romaji != nil {
			titles = append(titles, *media.Title.Romaji)
		}
		if media.Title.English != nil {
			titles = append(titles, *media.Title.English)
		}
		if media.Title.Native != nil {
			titles = append(titles, *media.Title.Native)
		}
	}
	err = h.App.FillerManager.FetchAndStoreFillerData(b.MediaID, titles)
	if err != nil {
		return h.RespondWithError(c, err)
	}

	return h.RespondWithData(c, true)
}

// HandleRemoveFillerData ...
//
//	@summary removes filler data cache.
//	@desc This will remove the filler data cache for the given media.
//	@returns bool
//	@route /api/v1/metadata-provider/filler [DELETE]
func (h *Handler) HandleRemoveFillerData(c echo.Context) error {
	type body struct {
		MediaID int `json:"mediaId"`
	}

	var b body
	if err := c.Bind(&b); err != nil {
		return h.RespondWithError(c, err)
	}

	err := h.App.FillerManager.RemoveFillerData(b.MediaID)
	if err != nil {
		return h.RespondWithError(c, err)
	}

	return h.RespondWithData(c, true)
}

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
	if h.App.Metadata.TMDBClient != nil {
		h.App.Metadata.TMDBClient.ClearCache()
	}
	anime.ClearEpisodeCollectionCache()

	return h.RespondWithData(c, true)
}

