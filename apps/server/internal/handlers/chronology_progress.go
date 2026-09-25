package handlers

import (
	"errors"
	"net/http"
	"regexp"

	"kamehouse/internal/intelligence"

	"github.com/labstack/echo/v4"
)

// maxChronologyOverrides acota el lote: hay 35 lapsos, el margen cubre ids futuros.
const maxChronologyOverrides = 200

var chronologySpanIDPattern = regexp.MustCompile(`^[a-z0-9]+(-[a-z0-9]+)*$`)

// ChronologySpanOverridesPayload aplica marcas manuales por lapso; null borra la marca.
type ChronologySpanOverridesPayload struct {
	Overrides map[string]*bool `json:"overrides"`
}

// HandleGetChronologyProgress returns the chronology progress for the current account.
//
//	@summary get Dragon Ball chronology progress.
//	@desc Returns watched episodes per Dragon Ball series and the manual per-span overrides.
//	@returns intelligence.ChronologyProgressResponse
//	@route /api/v1/intelligence/chronology [GET]
func (h *Handler) HandleGetChronologyProgress(c echo.Context) error {
	progress, err := intelligence.BuildChronologyProgress(h.App.Database, currentAccountID(c))
	if err != nil {
		return h.RespondWithError(c, err)
	}
	return h.RespondWithData(c, progress)
}

// HandleSaveChronologySpanOverrides sets or clears manual watched marks for chronology spans.
//
//	@summary set or clear manual watched marks for chronology spans.
//	@desc Upserts each spanId -> watched mark; a null value removes the mark so the span follows watch history again.
//	@param body ChronologySpanOverridesPayload true "Span overrides payload"
//	@returns bool
//	@route /api/v1/intelligence/chronology/overrides [POST]
func (h *Handler) HandleSaveChronologySpanOverrides(c echo.Context) error {
	var payload ChronologySpanOverridesPayload
	if err := c.Bind(&payload); err != nil {
		return h.RespondWithCodeError(c, http.StatusBadRequest, errors.New("invalid request payload"))
	}
	if len(payload.Overrides) == 0 {
		return h.RespondWithData(c, true)
	}
	if len(payload.Overrides) > maxChronologyOverrides {
		return h.RespondWithCodeError(c, http.StatusBadRequest, errors.New("too many span overrides"))
	}
	for spanID := range payload.Overrides {
		if len(spanID) > 64 || !chronologySpanIDPattern.MatchString(spanID) {
			return h.RespondWithCodeError(c, http.StatusBadRequest, errors.New("invalid spanId"))
		}
	}

	if err := h.App.Database.SetChronologySpanOverrides(currentAccountID(c), payload.Overrides); err != nil {
		return h.RespondWithError(c, err)
	}
	return h.RespondWithData(c, true)
}
