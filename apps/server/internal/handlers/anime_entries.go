package handlers

import (
	"context"
	"crypto/sha256"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"sync"
	"time"

	"kamehouse/internal/api/tmdb"
	"kamehouse/internal/database/db"
	"kamehouse/internal/database/models/dto"
	"kamehouse/internal/library/anime"
	librarymetadata "kamehouse/internal/library/metadata"
	"kamehouse/internal/util/result"

	"github.com/labstack/echo/v4"
	"golang.org/x/sync/singleflight"
)

var (
	animeEntryCache      = result.NewBoundedCache[int, *anime.Entry](128)
	animeEntryCacheTTL   = 5 * time.Minute
	animeEntryGroup      singleflight.Group
	animeEntryCacheMu    sync.RWMutex
	animeEntryGeneration uint64
)

func InvalidateAnimeEntryCache(mediaID int) {
	animeEntryCacheMu.Lock()
	defer animeEntryCacheMu.Unlock()
	animeEntryGeneration++
	animeEntryCache.Delete(mediaID)
}

func ClearAnimeEntryCache() {
	animeEntryCacheMu.Lock()
	defer animeEntryCacheMu.Unlock()
	animeEntryGeneration++
	animeEntryCache.Clear()
}

func cachedAnimeEntry(mediaID int) (*anime.Entry, uint64) {
	animeEntryCacheMu.RLock()
	defer animeEntryCacheMu.RUnlock()
	entry, _ := animeEntryCache.Get(mediaID)
	return entry, animeEntryGeneration
}

func animeEntryGenerationCurrent(generation uint64) bool {
	animeEntryCacheMu.RLock()
	defer animeEntryCacheMu.RUnlock()
	return generation == animeEntryGeneration
}

// Both foreground builds and background enrichment may finish after a scan or
// progress/source change. A retired snapshot must never repopulate the cache.
func publishAnimeEntry(mediaID int, generation uint64, entry *anime.Entry) bool {
	animeEntryCacheMu.Lock()
	defer animeEntryCacheMu.Unlock()
	if generation != animeEntryGeneration {
		return false
	}
	animeEntryCache.SetT(mediaID, entry, animeEntryCacheTTL)
	return true
}

func getAnimeEntryETag(entry *anime.Entry) string {
	if entry == nil || entry.Media == nil {
		return `W/"entry-empty"`
	}
	// Background enrichment changes episode metadata without updating the media
	// row. Validate the whole response so a cached empty summary cannot hide it.
	hash := sha256.New()
	if err := json.NewEncoder(hash).Encode(entry); err != nil {
		return ""
	}
	return fmt.Sprintf(`W/"entry-%x"`, hash.Sum(nil)[:16])
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
			mediaID, media := mID, entry.Media
			if !h.App.StartBackground(func() {
				defer fillerFetchAttempts.Delete(mediaID)
				// Parsea datos externos fuera del request: sin recover, un panic
				// acá tiraba el servidor (el middleware Recover no lo ve).
				defer func() {
					if r := recover(); r != nil {
						h.App.Logger.Error().Interface("panic", r).Int("mediaId", mediaID).Msg("filler: panic fetching filler data")
					}
				}()
				if media == nil || h.App.ShutdownCtx().Err() != nil {
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
			}) {
				fillerFetchAttempts.Delete(mID)
			}
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
	cached, generation := cachedAnimeEntry(mID)
	if cached != nil {
		entry = cached
	} else {
		val, err, _ := animeEntryGroup.Do(fmt.Sprintf("%d:%d", generation, mID), func() (interface{}, error) {
			if cached, current := cachedAnimeEntry(mID); cached != nil && current == generation {
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
			refresh := false
			if e.Media != nil && e.Media.TmdbID > 0 && len(e.Episodes) > 0 {
				if client := h.App.Metadata.GetTMDBClient(); client != nil {
					provider := librarymetadata.NewTMDBProviderWithClient(client, h.App.Database)
					mapped := make(map[int]tmdb.TVEpisode)
					offset := 0
					for sn := 1; ; sn++ {
						season, found, fresh := provider.CachedSeason(e.Media.TmdbID, sn)
						if !found {
							break
						}
						end, err := tmdb.SeasonEnd(offset, season)
						if err != nil {
							break
						}
						for _, ep := range season.Episodes {
							mapped[offset+ep.EpisodeNumber] = ep
						}
						offset = end
						refresh = refresh || !fresh
					}
					applyEpisodeMap(e, mapped)
				}
			}
			if refresh || animeEntryNeedsEnrichment(mID, e) {
				e.EpisodeEnrichmentPending = true
				scheduleEnrich = true
				publishAnimeEntry(mID, generation, e)
			} else {
				publishAnimeEntry(mID, generation, e)
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
		defer h.scheduleAnimeEnrichment(mID, generation)
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

	media, err := db.ResolveLibraryMediaByPublicID(h.App.Database, b.MediaID)
	if err != nil {
		return h.RespondWithError(c, err)
	}
	if media == nil {
		return h.RespondWithCodeError(c, http.StatusNotFound, errors.New("media not found in library"))
	}
	if err := db.SetManualMediaProgress(c.Request().Context(), h.App.Database, media, b.Progress); err != nil {
		return h.RespondWithError(c, err)
	}

	InvalidateAnimeEntryCache(b.MediaID)
	ClearLibraryCollectionCache()

	return h.RespondWithData(c, true)
}
