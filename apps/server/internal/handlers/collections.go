package handlers

import (
	"errors"
	"kamehouse/internal/database/db"
	"strconv"

	"github.com/labstack/echo/v4"
)

// HandleGetCollection returns the TMDB collection by ID.
// It fetches from the TMDB platform and returns a CollectionResponse that matches
// the MediaCollectionData frontend interface. Collection-level metadata (poster,
// backdrop, overview) is sourced from: DB cache → TMDB live → entry-level fallback.
func (h *Handler) HandleGetCollection(c echo.Context) error {
	idStr := c.Param("id")
	collectionID, err := strconv.Atoi(idStr)
	if err != nil {
		return c.JSON(400, NewErrorResponse(errors.New("invalid collection ID")))
	}

	// Fetch from TMDB platform (live query)
	unifiedColl, err := h.App.Metadata.PlatformRef.Get().GetMediaCollection(c.Request().Context(), collectionID)
	if err != nil {
		return c.JSON(500, NewErrorResponse(err))
	}

	if unifiedColl == nil || len(unifiedColl.Lists) == 0 {
		return c.JSON(404, NewErrorResponse(errors.New("collection not found")))
	}

	list := unifiedColl.Lists[0]

	// Format response to match MediaCollectionData
	type PartResponse struct {
		ID           int     `json:"id"`
		Title        string  `json:"title"`
		Overview     *string `json:"overview,omitempty"`
		PosterPath   *string `json:"posterPath,omitempty"`
		BackdropPath *string `json:"backdropPath,omitempty"`
		ReleaseDate  *string `json:"releaseDate,omitempty"`
		Format       string  `json:"format,omitempty"`
	}

	type CollectionResponse struct {
		ID           int            `json:"id"`
		Name         string         `json:"name"`
		Overview     *string        `json:"overview,omitempty"`
		PosterPath   *string        `json:"posterPath,omitempty"`
		BackdropPath *string        `json:"backdropPath,omitempty"`
		Parts        []PartResponse `json:"parts"`
	}

	// Priority: DB (cached scan data) → TMDB live collection metadata → entry-level fallback
	var overview *string
	var poster *string
	var backdrop *string

	dbColl, dbErr := db.GetMediaCollection(h.App.CoreServices.Database, collectionID)
	if dbErr == nil && dbColl != nil {
		if dbColl.Overview != "" {
			overview = &dbColl.Overview
		}
		if dbColl.PosterPath != "" {
			poster = &dbColl.PosterPath
		}
		if dbColl.BackdropPath != "" {
			backdrop = &dbColl.BackdropPath
		}
	}

	// Fall back to collection-level images stored in the list metadata
	if poster == nil && list.PosterPath != "" {
		poster = &list.PosterPath
	}
	if backdrop == nil && list.BackdropPath != "" {
		backdrop = &list.BackdropPath
	}
	if overview == nil && list.Overview != "" {
		overview = &list.Overview
	}

	res := CollectionResponse{
		ID:           collectionID,
		Name:         list.Name,
		Overview:     overview,
		PosterPath:   poster,
		BackdropPath: backdrop,
		Parts:        make([]PartResponse, 0, len(list.Entries)),
	}

	for _, entry := range list.Entries {
		if entry.Media == nil {
			continue
		}

		var rd *string
		if entry.Media.StartDate != nil {
			s := entry.Media.StartDate.ToTMDBString()
			rd = &s
		}

		var pp, bp *string
		if entry.Media.CoverImage != nil && entry.Media.CoverImage.ExtraLarge != nil {
			pp = entry.Media.CoverImage.ExtraLarge
		}
		if entry.Media.BannerImage != nil {
			bp = entry.Media.BannerImage
		}

		var ov *string
		if entry.Media.Overview != nil {
			ov = entry.Media.Overview
		}

		res.Parts = append(res.Parts, PartResponse{
			ID:           entry.Media.ID,
			Title:        entry.Media.GetTitleSafe(),
			Overview:     ov,
			PosterPath:   pp,
			BackdropPath: bp,
			ReleaseDate:  rd,
			Format:       string(entry.Media.Format),
		})
	}

	return c.JSON(200, NewDataResponse(res))
}
