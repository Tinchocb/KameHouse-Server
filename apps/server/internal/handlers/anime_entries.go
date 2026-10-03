package handlers

import (
	"context"
	"errors"
	"net/http"
	"strconv"
	"sync"

	"kamehouse/internal/database/db"
	"kamehouse/internal/database/models"
	"kamehouse/internal/database/models/dto"
	"kamehouse/internal/library/anime"

	"github.com/labstack/echo/v4"
)

var fillerFetchAttempts sync.Map

func (h *Handler) getAnimeEntry(c echo.Context, lfs []*dto.LocalFile, mID int) (*anime.Entry, error) {
	//

	// Anime collection is no longer used for getting entries

	// Create a new media entry
	entry, err := anime.NewEntry(c.Request().Context(), &anime.NewEntryOptions{
		MediaID:             mID,
		LocalFiles:          lfs,
		Database:            h.App.Database,
		PlatformRef:         h.App.Metadata.Platform,
		MetadataProviderRef: h.App.Metadata.Provider,
		IntelligenceSvc:     h.App.IntelligenceService,
	})
	if err != nil {
		return nil, err
	}

	h.App.FillerManager.HydrateFillerData(entry)

	if !h.App.FillerManager.HasFillerFetched(mID) {
		if _, loading := fillerFetchAttempts.LoadOrStore(mID, true); !loading {
			go func(mediaID int, media *models.LibraryMedia) {
				defer fillerFetchAttempts.Delete(mediaID)
				// Parsea datos externos fuera del request: sin recover, un panic
				// acá tiraba el servidor (el middleware Recover no lo ve).
				defer func() {
					if r := recover(); r != nil {
						h.App.Logger.Error().Interface("panic", r).Int("mediaId", mediaID).Msg("filler: panic fetching filler data")
					}
				}()
				if media == nil {
					return
				}
				titles := make([]string, 0)
				if media.TitleRomaji != "" {
					titles = append(titles, media.TitleRomaji)
				}
				if media.TitleEnglish != "" {
					titles = append(titles, media.TitleEnglish)
				}
				if media.TitleOriginal != "" {
					titles = append(titles, media.TitleOriginal)
				}
				_ = h.App.FillerManager.FetchAndStoreFillerData(mediaID, titles)
			}(mID, entry.Media)
		}
	}

	// ── TMDB Episode & Media Enrichment ──────────────────────────────────────────────────────────────────────────────
	// If the media has a TmdbID and episodes are missing synopsis/image,
	// fetch TMDB season data and fill in the gaps (best-effort, never fails the request).
	h.enrichEpisodesWithTMDB(c.Request().Context(), entry, nil)
	h.enrichMediaWithTMDB(c.Request().Context(), entry, nil)

	return entry, nil
}

// HandleGetAnimeEntry returns a media entry for the given anime media id.
//
//	@summary return a media entry for the given anime media id.
//	@desc This is used by the anime media entry pages to get all the data about the anime.
//	@desc This includes episodes and metadata (if any), list data, download info...
//	@route /api/v1/library/anime-entry/{id} [GET]
//	@param id - int - true - "Anime media ID"
//	@returns anime.Entry
func (h *Handler) HandleGetAnimeEntry(c echo.Context) error {
	idParam := c.Param("id")
	mID, err := strconv.Atoi(idParam)
	if err != nil || mID <= 0 {
		return h.RespondWithCodeError(c, http.StatusBadRequest, errors.New("valid positive anime media id is required"))
	}

	lfs, err := db.GetLocalFilesByMediaID(h.App.Database, mID)
	if err != nil {
		return h.RespondWithError(c, err)
	}
	lfs = h.visibleLocalFiles(lfs)

	entry, err := h.getAnimeEntry(c, lfs, mID)
	if err != nil {
		return h.RespondWithError(c, err)
	}

	return h.RespondWithData(c, entry)
}

// HandleGetAnimeEntryLocalFiles returns only the local files for the given anime media id.
//
//	@summary return local files for the given anime media id.
//	@desc Used for fast fetching of playable files (like random play or TV mode).
//	@route /api/v1/library/anime-entry/{id}/local-files [GET]
//	@param id - int - true - "Anime media ID"
//	@returns []dto.LocalFile
func (h *Handler) HandleGetAnimeEntryLocalFiles(c echo.Context) error {
	idParam := c.Param("id")
	mID, err := strconv.Atoi(idParam)
	if err != nil || mID <= 0 {
		return h.RespondWithCodeError(c, http.StatusBadRequest, errors.New("valid positive anime media id is required"))
	}

	lfs, err := db.GetLocalFilesByMediaID(h.App.Database, mID)
	if err != nil {
		return h.RespondWithError(c, err)
	}
	lfs = h.visibleLocalFiles(lfs)

	return h.RespondWithData(c, lfs)
}

// HandleUpdateAnimeEntryProgress updates the progress of an anime entry.
//
//	@summary updates the progress of an anime entry.
//	@desc This is used when the user manually updates the progress of an anime.
//	@route /api/v1/library/anime-entry/progress [POST]
//	@param mediaID - int - true - "Anime media ID"
//	@param progress - int - true - "New progress"
//	@returns bool
func (h *Handler) HandleUpdateAnimeEntryProgress(c echo.Context) error {

	type body struct {
		MediaID  int `json:"mediaId"`
		Progress int `json:"progress"`
	}
	b := new(body)
	if err := c.Bind(b); err != nil {
		return h.RespondWithError(c, err)
	}

	if b.MediaID <= 0 {
		return h.RespondWithCodeError(c, 400, errors.New("invalid mediaId"))
	}
	if b.Progress < 0 {
		return h.RespondWithCodeError(c, 400, errors.New("invalid progress: must be >= 0"))
	}

	err := h.App.Metadata.Platform.UpdateEntryProgress(c.Request().Context(), b.MediaID, b.Progress, nil)
	if err != nil {
		return h.RespondWithError(c, err)
	}

	_, _ = h.App.Metadata.Platform.RefreshAnimeCollection(context.Background())
	ClearLibraryCollectionCache()

	return h.RespondWithData(c, true)
}

