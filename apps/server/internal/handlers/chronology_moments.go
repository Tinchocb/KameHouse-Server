package handlers

import (
	"errors"
	"net/http"
	"strconv"
	"strings"

	"github.com/labstack/echo/v4"
)

// ChronologyMomentTimePayload defines request body for saving a chronology moment start time.
type ChronologyMomentTimePayload struct {
	MomentKey string `json:"momentKey"`
	Seconds   *int   `json:"seconds"`
}

// isValidMomentKey verifies that the key conforms to spanId:episode:index format.
func isValidMomentKey(key string) bool {
	parts := strings.Split(key, ":")
	if len(parts) != 3 {
		return false
	}
	if strings.TrimSpace(parts[0]) == "" {
		return false
	}
	ep, err := strconv.Atoi(parts[1])
	if err != nil || ep <= 0 {
		return false
	}
	idx, err := strconv.Atoi(parts[2])
	if err != nil || idx < 0 {
		return false
	}
	return true
}

// HandleGetChronologyMomentTimes returns custom start times for chronology moments.
//
//	@summary get custom start times for chronology moments.
//	@desc Returns map of momentKey to seconds for manually calibrated moments.
//	@returns map[string]int
//	@route /api/v1/intelligence/chronology/moment-times [GET]
func (h *Handler) HandleGetChronologyMomentTimes(c echo.Context) error {
	times, err := h.App.Database.GetChronologyMomentTimes()
	if err != nil {
		return h.RespondWithError(c, err)
	}
	return h.RespondWithData(c, times)
}

// HandleSaveChronologyMomentTime updates or deletes a custom start second for a chronology moment.
//
//	@summary update or remove custom start time for a chronology moment.
//	@desc Upserts custom start second correction for a chronology moment, or deletes if seconds < 0 or omitted.
//	@param body ChronologyMomentTimePayload true "Moment time payload"
//	@returns bool
//	@route /api/v1/intelligence/chronology/moment-times [POST]
func (h *Handler) HandleSaveChronologyMomentTime(c echo.Context) error {
	var payload ChronologyMomentTimePayload
	if err := c.Bind(&payload); err != nil {
		return h.RespondWithCodeError(c, http.StatusBadRequest, errors.New("invalid request payload"))
	}

	payload.MomentKey = strings.TrimSpace(payload.MomentKey)
	if !isValidMomentKey(payload.MomentKey) {
		return h.RespondWithCodeError(c, http.StatusBadRequest, errors.New("invalid momentKey format (expected spanId:episode:index)"))
	}

	// seconds < 0 o vacío borra la corrección
	if payload.Seconds == nil || *payload.Seconds < 0 {
		if err := h.App.Database.SetChronologyMomentTime(payload.MomentKey, -1); err != nil {
			return h.RespondWithError(c, err)
		}
		return h.RespondWithData(c, true)
	}

	// 0 <= seconds <= 6h (21600 seconds)
	maxSeconds := 6 * 3600
	if *payload.Seconds > maxSeconds {
		return h.RespondWithCodeError(c, http.StatusBadRequest, errors.New("seconds must be between 0 and 21600 (6 hours)"))
	}

	if err := h.App.Database.SetChronologyMomentTime(payload.MomentKey, *payload.Seconds); err != nil {
		return h.RespondWithError(c, err)
	}

	return h.RespondWithData(c, true)
}
