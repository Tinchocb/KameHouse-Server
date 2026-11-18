package handlers

import (
	"errors"
	"fmt"
	"net/http"
	"strconv"

	"kamehouse/internal/database/db"
	"kamehouse/internal/database/models"
	"kamehouse/internal/database/models/dto"
	"kamehouse/internal/library/scanner"

	"github.com/labstack/echo/v4"
)

// resolveLibraryMediaForSagas uses the public identity carried by API routes.
func (h *Handler) resolveLibraryMediaForSagas(mID int) (*models.LibraryMedia, error) {
	return db.ResolveLibraryMediaByPublicID(h.App.Database, mID)
}

// HandleGetSeriesSagas returns fully enriched sagas for a given media entry.
//
//	@summary returns enriched saga array for a media entry.
//	@route /api/v1/library/anime-entry/{id}/sagas [GET]
//	@param id - int - true - "Anime media ID"
//	@returns []dto.SagaDTO
func (h *Handler) HandleGetSeriesSagas(c echo.Context) error {
	idParam := c.Param("id")
	mID, err := strconv.Atoi(idParam)
	if err != nil || mID <= 0 {
		return h.RespondWithCodeError(c, http.StatusBadRequest, errors.New("valid positive anime media id is required"))
	}

	media, err := h.resolveLibraryMediaForSagas(mID)
	if err != nil {
		return h.RespondWithError(c, err)
	}
	if media == nil {
		return h.RespondWithData(c, []dto.SagaDTO{})
	}

	etag := fmt.Sprintf(`W/"sagas-%d"`, media.TmdbID)
	c.Response().Header().Set("ETag", etag)
	c.Response().Header().Set("Cache-Control", "no-cache")

	if c.Request().Method == http.MethodGet || c.Request().Method == http.MethodHead {
		if ifNoneMatch := c.Request().Header.Get("If-None-Match"); ifNoneMatch != "" {
			if ifNoneMatch == etag || ifNoneMatch == "*" {
				return c.NoContent(http.StatusNotModified)
			}
		}
	}

	sagaInfos := scanner.GetDragonBallSagaInfo(media.TmdbID)
	sagas := make([]dto.SagaDTO, 0, len(sagaInfos))
	for _, s := range sagaInfos {
		subSagas := make([]dto.SubSagaDTO, 0, len(s.SubSagas))
		for _, ss := range s.SubSagas {
			subSagas = append(subSagas, dto.SubSagaDTO{
				ID:           ss.ID,
				Name:         ss.Name,
				EpisodeRange: fmt.Sprintf("%d-%d", ss.StartEp, ss.EndEp),
				StartEp:      ss.StartEp,
				EndEp:        ss.EndEp,
			})
		}

		sagas = append(sagas, dto.SagaDTO{
			ID:            s.ID,
			Name:          s.Name,
			EpisodeRange:  fmt.Sprintf("%d-%d", s.StartEp, s.EndEp),
			StartEp:       s.StartEp,
			EndEp:         s.EndEp,
			Description:   "",
			IsFiller:      false,
			CanonStatus:   "Canon",
			Antagonists:   []string{},
			KeyEvents:     []string{},
			NewCharacters: []string{},
			KeyCharacters: []dto.CharacterDTO{},
			SubSagas:      subSagas,
		})
	}

	return h.RespondWithData(c, sagas)
}
