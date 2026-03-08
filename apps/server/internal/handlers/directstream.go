package handlers

import (
	"fmt"
	"net/http"

	"kamehouse/internal/database/db"
	"kamehouse/internal/directstream"

	"github.com/labstack/echo/v4"
)

// HandleDirectstreamPlayLocalFile
//
//	@summary request local file stream.
//	@desc This requests a local file stream and returns the media container to start the playback.
//	@returns mediastream.MediaContainer
//	@route /api/v1/directstream/play/localfile [POST]
func (h *Handler) HandleDirectstreamPlayLocalFile(c echo.Context) error {
	type body struct {
		Path     string `json:"path"`     // The path of the file.
		ClientId string `json:"clientId"` // The session id
	}

	var b body
	if err := c.Bind(&b); err != nil {
		return h.RespondWithError(c, err)
	}

	lfs, _, err := db.GetLocalFiles(h.App.Database)
	if err != nil {
		return h.RespondWithError(c, err)
	}

	return h.App.DirectStreamManager.PlayLocalFile(c.Request().Context(), directstream.PlayLocalFileOptions{
		ClientId:   b.ClientId,
		Path:       b.Path,
		LocalFiles: lfs,
	})
}

// HandleDirectstreamConvertSubs
//
//	@summary converts subtitles from one format to another.
//	@returns string
//	@route /api/v1/directstream/subs/convert-subs [POST]
func (h *Handler) HandleDirectstreamConvertSubs(c echo.Context) error {
	type body struct {
		Url     string `json:"url"`
		Content string `json:"content"`
		To      string `json:"to"`
	}

	var b body
	if err := c.Bind(&b); err != nil {
		return h.RespondWithError(c, err)
	}

	// VideoCore removed — subtitle conversion not yet re-implemented
	return h.RespondWithError(c, fmt.Errorf("subtitle conversion is not currently available"))
}

func (h *Handler) HandleDirectstreamGetStream() http.Handler {
	return h.App.DirectStreamManager.ServeEchoStream()
}

func (h *Handler) HandleDirectstreamGetAttachments(c echo.Context) error {
	return h.App.DirectStreamManager.ServeEchoAttachments(c)
}
