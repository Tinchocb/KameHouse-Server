package handlers

import (
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

// HandleGetLibraryCollection returns the main local anime collection.
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
	lfs = h.visibleLocalFiles(lfs)

	libraryCollection, err := anime.NewLibraryCollection(c.Request().Context(), &anime.NewLibraryCollectionOptions{
		Database:            h.App.Database,
		PlatformRef:         h.App.Metadata.Platform,
		LocalFiles:          lfs,
		MetadataProviderRef: h.App.Metadata.Provider,
	})
	if err != nil {
		return h.RespondWithError(c, err)
	}

	_ = originalAnimeCollection

	// Hydrate total library size
	if libraryCollection != nil && libraryCollection.Stats != nil {
		libraryCollection.Stats.TotalSize = util.Bytes(h.App.TotalLibrarySize)
	}

	// Defensa: nunca serializar entries nulos (Go nil -> JSON null revienta
	// `entry.media` en el cliente con "Cannot read properties of null").
	if libraryCollection != nil {
		for _, list := range libraryCollection.Lists {
			if list == nil {
				continue
			}
			filtered := list.Entries[:0]
			for _, e := range list.Entries {
				if e != nil {
					filtered = append(filtered, e)
				}
			}
			for i := len(filtered); i < len(list.Entries); i++ {
				list.Entries[i] = nil
			}
			list.Entries = filtered
		}
	}

	libraryCollectionCache.SetT("main", libraryCollection, 5*time.Minute)

	return h.RespondWithData(c, libraryCollection)
}
