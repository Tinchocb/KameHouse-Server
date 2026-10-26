package handlers

import (
	"errors"
	"net/http"

	"kamehouse/internal/database/db"

	"github.com/labstack/echo/v4"
)

// MediaAudioProfile es el perfil de audio propio de una serie. Las series sin fila usan
// el perfil global de Ajustes.
type MediaAudioProfile struct {
	MediaID      int    `json:"mediaId"`
	AudioProfile string `json:"audioProfile"`
}

// HandleGetAudioProfiles lists the series that have their own audio profile.
//
//	@summary lists the per-series audio profiles.
//	@desc Series without a row play with the global audio profile from Settings.
//	@route /api/v1/library/audio-profiles [GET]
//	@returns []handlers.MediaAudioProfile
func (h *Handler) HandleGetAudioProfiles(c echo.Context) error {
	rows, err := h.App.Database.GetAudioPreferences()
	if err != nil {
		return h.RespondWithError(c, err)
	}
	out := make([]MediaAudioProfile, 0, len(rows))
	for _, r := range rows {
		out = append(out, MediaAudioProfile{MediaID: r.MediaID, AudioProfile: r.AudioProfile})
	}
	return h.RespondWithData(c, out)
}

// HandleSetAudioProfile sets the audio profile of one series.
//
//	@summary sets the audio profile of a series.
//	@desc "latino", "castellano", "japanese", "english" or "auto". An empty profile removes the series' own profile, so it follows the global one again.
//	@route /api/v1/library/audio-profile [POST]
//	@returns handlers.MediaAudioProfile
func (h *Handler) HandleSetAudioProfile(c echo.Context) error {
	type body struct {
		MediaID      int    `json:"mediaId"`
		AudioProfile string `json:"audioProfile"`
	}
	var b body
	if err := c.Bind(&b); err != nil {
		return h.RespondWithError(c, err)
	}
	if b.MediaID <= 0 {
		return h.RespondWithCodeError(c, http.StatusBadRequest, errors.New("valid positive media id is required"))
	}
	if b.AudioProfile != "" && !db.IsValidAudioProfile(b.AudioProfile) {
		return h.RespondWithCodeError(c, http.StatusBadRequest, errors.New("audioProfile must be 'latino', 'castellano', 'japanese', 'english', 'auto' or empty"))
	}
	if err := h.App.Database.SetAudioPreference(b.MediaID, b.AudioProfile); err != nil {
		return h.RespondWithError(c, err)
	}
	return h.RespondWithData(c, MediaAudioProfile{MediaID: b.MediaID, AudioProfile: b.AudioProfile})
}
