package handlers

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"sync"
	"time"

	"kamehouse/internal/database/db"
	"kamehouse/internal/database/models"
	"kamehouse/internal/database/models/dto"
	"kamehouse/internal/library/anime"
	"kamehouse/internal/util/result"

	"github.com/labstack/echo/v4"
	"golang.org/x/sync/singleflight"
)

var (
	animeEntryCache    = result.NewBoundedCache[int, *anime.Entry](128)
	animeEntryCacheTTL = 5 * time.Minute
	animeEntryGroup    singleflight.Group
)

func InvalidateAnimeEntryCache(mediaID int) {
	animeEntryCache.Delete(mediaID)
}

func ClearAnimeEntryCache() {
	animeEntryCache.Clear()
}

func getAnimeEntryETag(entry *anime.Entry) string {
	if entry == nil || entry.Media == nil {
		return `W/"entry-empty"`
	}
	progress := 0
	if entry.EntryListData != nil {
		progress = entry.EntryListData.Progress
	}
	return fmt.Sprintf(`W/"entry-%d-%d-%d-%d"`, entry.MediaID, entry.Media.UpdatedAt.Unix(), len(entry.LocalFiles), progress)
}

var fillerFetchAttempts sync.Map

// enrichmentTimeBudget acota el enriquecimiento best-effort (TMDB/Jikan) de una ficha;
// enrichmentCooldown recuerda (por media) las que agotaron ese tiempo.
const (
	enrichmentTimeBudget  = 3 * time.Second
	enrichmentCooldownFor = 10 * time.Minute
)

var enrichmentCooldown sync.Map

func (h *Handler) getAnimeEntry(ctx context.Context, lfs []*dto.LocalFile, mID int) (*anime.Entry, error) {
	//

	// Anime collection is no longer used for getting entries

	// Create a new media entry
	entry, err := anime.NewEntry(ctx, &anime.NewEntryOptions{
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

	var entry *anime.Entry
	// Si la ficha todavía necesita TMDB/Jikan, la respuesta sale sin esperarlos: el enriquecimiento
	// corre en segundo plano después de responder (scheduleAnimeEnrichment) y la siguiente visita
	// ya la encuentra completa en caché.
	scheduleEnrich := false
	if cached, ok := animeEntryCache.Get(mID); ok && cached != nil {
		entry = cached
	} else {
		val, err, _ := animeEntryGroup.Do(strconv.Itoa(mID), func() (interface{}, error) {
			if cached, ok := animeEntryCache.Get(mID); ok && cached != nil {
				return cached, nil
			}
			lfs, err := db.GetLocalFilesByMediaID(h.App.Database, mID)
			if err != nil {
				return nil, err
			}
			lfs = h.visibleLocalFiles(lfs)

			e, err := h.getAnimeEntry(c.Request().Context(), lfs, mID)
			if err != nil {
				return nil, err
			}
			if animeEntryNeedsEnrichment(mID, e) {
				scheduleEnrich = true
			} else {
				animeEntryCache.SetT(mID, e, animeEntryCacheTTL)
			}
			return e, nil
		})
		if err != nil {
			return h.RespondWithError(c, err)
		}
		entry = val.(*anime.Entry)
	}
	if scheduleEnrich {
		// Se ejecuta al terminar esta función, es decir, después de escribir la respuesta.
		defer h.scheduleAnimeEnrichment(mID)
	}

	etag := getAnimeEntryETag(entry)
	c.Response().Header().Set("ETag", etag)
	c.Response().Header().Set("Cache-Control", "no-cache")

	if c.Request().Method == http.MethodGet || c.Request().Method == http.MethodHead {
		if ifNoneMatch := c.Request().Header.Get("If-None-Match"); ifNoneMatch != "" {
			if ifNoneMatch == etag || ifNoneMatch == "*" {
				return c.NoContent(http.StatusNotModified)
			}
		}
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
	InvalidateAnimeEntryCache(b.MediaID)
	ClearLibraryCollectionCache()

	return h.RespondWithData(c, true)
}
