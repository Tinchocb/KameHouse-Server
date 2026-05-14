package handlers

import (
	"errors"
	"kamehouse/internal/library/anime"
	"kamehouse/internal/platforms/platform"

	"kamehouse/internal/database/db"
	"kamehouse/internal/database/models/dto"
	"kamehouse/internal/util"
	"kamehouse/internal/util/result"
	"time"

	"github.com/labstack/echo/v4"
)

var libraryCollectionCache = result.NewCache[string, *anime.LibraryCollection]()

func ClearLibraryCollectionCache() {
	libraryCollectionCache.Clear()
}

// HandleGetLibraryCollection
//
//	@summary returns the main local anime anime collection.
//	@desc This creates a new LibraryCollection struct and returns it.
//	@desc This is used to get the main anime collection of the user.
//	@desc It uses the cached platform anime collection for the GET method.
//	@desc It refreshes the platform anime collection if the POST method is used.
//	@route /api/v1/library/collection [GET,POST]
//	@returns anime.LibraryCollection
func (h *Handler) HandleGetLibraryCollection(c echo.Context) error {

	// Use cache if available
	if ret, ok := libraryCollectionCache.Get("main"); ok {
		return h.RespondWithData(c, ret)
	}

	animeCollection, err := h.App.GetAnimeCollection(false)
	if err != nil {
		return h.RespondWithError(c, err)
	}

	if animeCollection == nil {
		animeCollection = &platform.UnifiedCollection{}
	}

	originalAnimeCollection := animeCollection

	var lfs []*dto.LocalFile
	lfs, _, err = db.GetLocalFiles(h.App.Database)
	if err != nil {
		return h.RespondWithError(c, err)
	}

	libraryCollection, err := anime.NewLibraryCollection(c.Request().Context(), &anime.NewLibraryCollectionOptions{
		Database:            h.App.Database,
		PlatformRef:         h.App.Metadata.PlatformRef,
		LocalFiles:          lfs,
		MetadataProviderRef: h.App.Metadata.ProviderRef,
	})
	if err != nil {
		return h.RespondWithError(c, err)
	}

	_ = originalAnimeCollection

	// Hydrate total library size
	if libraryCollection != nil && libraryCollection.Stats != nil {
		libraryCollection.Stats.TotalSize = util.Bytes(h.App.TotalLibrarySize)
	}

	libraryCollectionCache.SetT("main", libraryCollection, 5*time.Minute)

	return h.RespondWithData(c, libraryCollection)
}

//----------------------------------------------------------------------------------------------------------------------------------------------------

var animeScheduleCache = result.NewCache[int, []*anime.ScheduleItem]()

// HandleGetAnimeCollectionSchedule
//
//	@summary returns anime collection schedule
//	@desc This is used by the "Schedule" page to display the anime schedule.
//	@route /api/v1/library/schedule [GET]
//	@returns []anime.ScheduleItem
func (h *Handler) HandleGetAnimeCollectionSchedule(c echo.Context) error {

	// Invalidate the cache when the platform collection is refreshed
	h.App.AddOnRefreshAnimeCollectionFunc("HandleGetAnimeCollectionSchedule", func() {
		animeScheduleCache.Clear()
	})

	if ret, ok := animeScheduleCache.Get(1); ok {
		return h.RespondWithData(c, ret)
	}

	animeScheduleData, err := h.App.Metadata.PlatformRef.Get().GetAnimeAiringSchedule(c.Request().Context())
	if err != nil {
		return h.RespondWithError(c, err)
	}
	animeSchedule := animeScheduleData.(*platform.UnifiedAiringSchedule)

	animeCollection, err := h.App.GetAnimeCollection(false)
	if err != nil {
		return h.RespondWithError(c, err)
	}

	ret := anime.GetScheduleItems(animeSchedule, animeCollection)

	animeScheduleCache.SetT(1, ret, 1*time.Hour)

	return h.RespondWithData(c, ret)
}

// HandleAddUnknownMedia
//
//	@summary adds the given media to the user's Platform planning collections
//	@desc Since media not found in the user's Platform collection are not displayed in the library, this route is used to add them.
//	@desc The response is ignored in the frontend, the client should just refetch the entire library collection.
//	@route /api/v1/library/unknown-media [POST]
//	@returns Platform.AnimeCollection
func (h *Handler) HandleAddUnknownMedia(c echo.Context) error {

	type body struct {
		MediaIds []int `json:"mediaIds"`
	}

	b := new(body)
	if err := c.Bind(b); err != nil {
		return h.RespondWithError(c, err)
	}

	// Add non-added media entries to Platform collection
	if err := h.App.Metadata.PlatformRef.Get().AddMediaToCollection(c.Request().Context(), b.MediaIds); err != nil {
		return h.RespondWithError(c, errors.New("error: Platform responded with an error, this is most likely a rate limit issue"))
	}

	// Bypass the cache
	animeCollection, err := h.App.GetAnimeCollection(true)
	if err != nil {
		return h.RespondWithError(c, errors.New("error: Platform responded with an error, wait one minute before refreshing"))
	}

	// Clear cache to force refresh on next request
	ClearLibraryCollectionCache()
	return h.RespondWithData(c, animeCollection)
}
