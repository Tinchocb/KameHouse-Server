package handlers

import (
	"errors"
	"kamehouse/internal/database/db"
	"kamehouse/internal/database/models"
	"kamehouse/internal/library/anime"
	"kamehouse/internal/platforms/platform"
	"strconv"

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

// HandleGetMediaMetadataParent ...
//
//	@summary retrieves media metadata parent by media ID.
//	@desc Returns the media metadata parent information for the given media ID.
//	@route /api/v1/metadata/parent/{id} [GET]
//	@param id - int - true - "The media ID"
//	@returns models.MediaMetadataParent
func (h *Handler) HandleGetMediaMetadataParent(c echo.Context) error {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		return h.RespondWithError(c, errors.New("invalid id"))
	}

	parent, err := h.App.Database.GetMediaMetadataParent(id)
	if err != nil {
		return h.RespondWithData(c, &models.MediaMetadataParent{})
	}

	return h.RespondWithData(c, parent)
}

// HandleSaveMediaMetadataParent ...
//
//	@summary saves or updates media metadata parent.
//	@desc Creates or updates the media metadata parent information.
//	@route /api/v1/metadata/parent [POST]
//	@returns models.MediaMetadataParent
func (h *Handler) HandleSaveMediaMetadataParent(c echo.Context) error {
	type body struct {
		ParentID      int `json:"parentId"`
		SpecialOffset int `json:"specialOffset"`
	}

	var b body
	if err := c.Bind(&b); err != nil {
		return h.RespondWithError(c, err)
	}

	if b.ParentID == 0 {
		return h.RespondWithError(c, errors.New("invalid parent id"))
	}

	savedParent, err := h.App.Database.InsertMediaMetadataParent(models.MediaMetadataParent{
		MediaID:       b.ParentID,
		ParentID:      b.ParentID,
		SpecialOffset: b.SpecialOffset,
	})
	if err != nil {
		return h.RespondWithError(c, err)
	}

	h.App.Metadata.Provider.ClearCache()
	anime.ClearEpisodeCollectionCache()

	return h.RespondWithData(c, savedParent)
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
	// Explicit provider allowlist: never wipe "migrations" markers or other buckets.
	providers := []string{
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
	anime.ClearEpisodeCollectionCache()

	return h.RespondWithData(c, true)
}

// HandleDeleteMediaMetadataParent ...
//
//	@summary deletes media metadata parent.
//	@desc Removes the media metadata parent information for the given media ID.
//	@route /api/v1/metadata/parent [DELETE]
//	@returns bool
func (h *Handler) HandleDeleteMediaMetadataParent(c echo.Context) error {
	type body struct {
		MediaID int `json:"mediaId"`
	}

	var b body
	if err := c.Bind(&b); err != nil {
		return h.RespondWithError(c, err)
	}

	err := h.App.Database.DeleteMediaMetadataParent(b.MediaID)
	if err != nil {
		return h.RespondWithError(c, err)
	}

	h.App.Metadata.Provider.ClearCache()
	anime.ClearEpisodeCollectionCache()

	return h.RespondWithData(c, true)
}

