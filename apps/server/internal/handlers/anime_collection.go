package handlers

import (
	"context"
	"fmt"
	"net/http"
	"sync/atomic"
	"time"

	"kamehouse/internal/database/db"
	"kamehouse/internal/database/models/dto"
	"kamehouse/internal/library/anime"
	"kamehouse/internal/util"
	"kamehouse/internal/util/result"

	"github.com/labstack/echo/v4"
	"golang.org/x/sync/singleflight"
)

var (
	libraryCollectionCache = result.NewCache[string, *anime.LibraryCollection]()
	collectionVersion      atomic.Uint64
	// libraryCollectionFlight colapsa las construcciones simultaneas con la cache vacia.
	libraryCollectionFlight singleflight.Group
)

// libraryCollectionBuildTimeout acota la construccion compartida, que ya no depende del request.
const libraryCollectionBuildTimeout = 2 * time.Minute

func ClearLibraryCollectionCache() {
	libraryCollectionCache.Clear()
	collectionVersion.Add(1)
	ClearAnimeEntryCache()
}

func getCollectionETag() string {
	return fmt.Sprintf(`W/"col-%d"`, collectionVersion.Load())
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
	etag := getCollectionETag()
	c.Response().Header().Set("ETag", etag)
	c.Response().Header().Set("Cache-Control", "no-cache")

	if c.Request().Method == http.MethodGet || c.Request().Method == http.MethodHead {
		if ifNoneMatch := c.Request().Header.Get("If-None-Match"); ifNoneMatch != "" {
			if ifNoneMatch == etag || ifNoneMatch == "*" {
				return c.NoContent(http.StatusNotModified)
			}
		}
	}

	// Use cache if available
	if ret, ok := libraryCollectionCache.Get("main"); ok {
		return h.RespondWithData(c, ret)
	}

	// Con la cache vacia (arranque, tras un escaneo o a los 5 minutos) varias pantallas piden la
	// coleccion a la vez: un solo vuelo lee los archivos locales y la arma para todas.
	reqCtx := c.Request().Context()
	flight := libraryCollectionFlight.DoChan("main", func() (interface{}, error) {
		// Otra peticion pudo dejarla en cache mientras esta esperaba su turno.
		if ret, ok := libraryCollectionCache.Get("main"); ok {
			return ret, nil
		}
		// Desacoplado del request: lo comparten todos los que esperan, y que el primero
		// cierre la pestana no debe cancelarles la construccion.
		ctx, cancel := context.WithTimeout(context.WithoutCancel(reqCtx), libraryCollectionBuildTimeout)
		defer cancel()
		return h.buildLibraryCollection(ctx)
	})

	select {
	case res := <-flight:
		if res.Err != nil {
			return h.RespondWithError(c, res.Err)
		}
		libraryCollection, _ := res.Val.(*anime.LibraryCollection)
		return h.RespondWithData(c, libraryCollection)
	case <-reqCtx.Done():
		return h.RespondWithError(c, reqCtx.Err())
	}
}

// buildLibraryCollection arma la coleccion principal y la deja en cache.
func (h *Handler) buildLibraryCollection(ctx context.Context) (*anime.LibraryCollection, error) {
	// Si algo invalida la cache mientras se arma (escaneo, cambio de ajustes), lo armado ya es
	// viejo: se entrega a quienes lo esperan pero no se guarda.
	version := collectionVersion.Load()

	if _, err := h.App.GetAnimeCollection(false); err != nil {
		return nil, err
	}

	var lfs []*dto.LocalFile
	lfs, _, err := db.GetLocalFiles(h.App.Database)
	if err != nil {
		return nil, err
	}
	lfs = h.visibleLocalFiles(lfs)

	libraryCollection, err := anime.NewLibraryCollection(ctx, &anime.NewLibraryCollectionOptions{
		Database:            h.App.Database,
		PlatformRef:         h.App.Metadata.Platform,
		LocalFiles:          lfs,
		MetadataProviderRef: h.App.Metadata.Provider,
	})
	if err != nil {
		return nil, err
	}

	// Hydrate total library size
	if libraryCollection != nil && libraryCollection.Stats != nil {
		libraryCollection.Stats.TotalSize = util.Bytes(h.App.GetTotalLibrarySize())
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

	if collectionVersion.Load() == version {
		libraryCollectionCache.SetT("main", libraryCollection, 5*time.Minute)
	}

	return libraryCollection, nil
}
