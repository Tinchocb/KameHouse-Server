package handlers

import (
	"fmt"
	"kamehouse/internal/platforms/platform"
	"kamehouse/internal/torrentstream"
	"net/http"

	"github.com/labstack/echo/v4"
)

// HandleTorrentstreamStartStream starts a torrent stream from a magnet link.
//
//	@summary Start streaming a torrent via magnet link
//	@route /api/v1/torrentstream/start [POST]
func (h *Handler) HandleTorrentstreamStartStream(c echo.Context) error {
	type body struct {
		MagnetLink    string `json:"magnetLink"`
		MediaId       int    `json:"mediaId"`
		EpisodeNumber int    `json:"episodeNumber"`
		AniDbEpisode  string `json:"aniDbEpisode"`
		ClientId      string `json:"clientId"`
	}

	var b body
	if err := c.Bind(&b); err != nil {
		return h.RespondWithError(c, err)
	}

	if b.MagnetLink == "" {
		return c.JSON(http.StatusBadRequest, NewErrorResponse(fmt.Errorf("magnetLink is required")))
	}

	// Get the client ID from cookie if not provided
	clientId := b.ClientId
	if clientId == "" {
		if id, ok := c.Get("KameHouse-Client-Id").(string); ok {
			clientId = id
		} else {
			clientId = "torrentstream"
		}
	}

	// Get media from platform if mediaId is provided
	var media *platform.UnifiedMedia
	_ = media // Suppress unused warning if no mediaId is passed
	if b.MediaId > 0 {
		p := h.App.Metadata.PlatformRef.Get()
		if p != nil {
			m, err := p.GetAnime(c.Request().Context(), b.MediaId)
			if err != nil {
				h.App.Logger.Warn().Err(err).Int("mediaId", b.MediaId).Msg("torrentstream: Could not get media info, streaming without metadata")
			} else if um, ok := m.(*platform.UnifiedMedia); ok {
				media = um
			}
		}
	}

	err := h.App.TorrentstreamRepository.StartStream(c.Request().Context(), &torrentstream.StartStreamOptions{
		MagnetLink:    b.MagnetLink,
		Media:         media,
		AniDbEpisode:  b.AniDbEpisode,
		EpisodeNumber: b.EpisodeNumber,
		ClientId:      clientId,
	})
	if err != nil {
		return c.JSON(http.StatusInternalServerError, NewErrorResponse(err))
	}

	return h.RespondWithData(c, map[string]interface{}{
		"status":    "streaming",
		"streamUrl": "/api/v1/directstream/stream",
	})
}

// HandleTorrentstreamStopStream stops the current torrent stream and cleans up.
//
//	@summary Stop the current torrent stream
//	@route /api/v1/torrentstream/stop [POST]
func (h *Handler) HandleTorrentstreamStopStream(c echo.Context) error {
	if err := h.App.TorrentstreamRepository.Stop(); err != nil {
		return h.RespondWithError(c, err)
	}
	return h.RespondWithData(c, true)
}

// HandleTorrentstreamGetStatus returns the current status of the torrent engine.
//
//	@summary Get torrent stream status (progress, peers, speed)
//	@route /api/v1/torrentstream/status [GET]
func (h *Handler) HandleTorrentstreamGetStatus(c echo.Context) error {
	status := h.App.TorrentstreamRepository.GetStatus()
	return h.RespondWithData(c, status)
}

// HandleTorrentstreamPreloadStream is a placeholder for preloading the next stream.
func (h *Handler) HandleTorrentstreamPreloadStream(c echo.Context) error {
	return h.RespondWithData(c, true)
}

// HandleTorrentstreamGetBatchHistory returns the batch history for torrent streams.
func (h *Handler) HandleTorrentstreamGetBatchHistory(c echo.Context) error {
	return h.RespondWithData(c, nil)
}
