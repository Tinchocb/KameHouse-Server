package handlers

import (
	"fmt"
	"io"
	"os"
	"path/filepath"

	"github.com/labstack/echo/v4"
)

type TorrentClientActionBody struct {
	Hash   string `json:"hash"`
	Action string `json:"action"`
	Dir    string `json:"dir"`
}

type AnimeTorrent struct {
	Name     string `json:"name"`
	Hash     string `json:"hash"`
	Link     string `json:"link"`
	Provider string `json:"provider"`
}

type TorrentClientDownloadBody struct {
	Torrents    []AnimeTorrent `json:"torrents"`
	Destination string         `json:"destination"`
	SmartSelect struct {
		Enabled               bool  `json:"enabled"`
		MissingEpisodeNumbers []int `json:"missingEpisodeNumbers"`
	} `json:"smartSelect"`
}

func (h *Handler) HandleTorrentClientAction(c echo.Context) error {
	var body TorrentClientActionBody
	if err := c.Bind(&body); err != nil {
		return h.RespondWithError(c, err)
	}
	return h.RespondWithData(c, map[string]string{"status": "ok", "message": "not fully implemented"})
}

func (h *Handler) HandleTorrentClientGetFiles(c echo.Context) error {
	return h.RespondWithData(c, []interface{}{})
}

func (h *Handler) HandleTorrentClientDownload(c echo.Context) error {
	var body TorrentClientDownloadBody
	if err := c.Bind(&body); err != nil {
		return h.RespondWithError(c, err)
	}

	settings, err := h.App.Database.GetSettings()
	if err != nil {
		return h.RespondWithError(c, err)
	}

	// For now just return success
	h.App.Logger.Info().Interface("torrents", body.Torrents).Str("client", settings.Torrent.DefaultTorrentClient).Msg("Simulating adding torrent to client")
	return h.RespondWithData(c, map[string]string{"status": "ok", "message": "Simulated download"})
}

func (h *Handler) HandleTorrentClientRuleMagnet(c echo.Context) error {
	return h.RespondWithData(c, map[string]string{"status": "ok"})
}

func (h *Handler) HandleTorrentClientUploadFile(c echo.Context) error {
	file, err := c.FormFile("torrentFile")
	if err != nil {
		return h.RespondWithError(c, err)
	}
	
	settings, err := h.App.Database.GetSettings()
	if err != nil {
		return h.RespondWithError(c, err)
	}
	
	destDir := settings.Torrent.QbittorrentPath
	if destDir == "" {
		destDir = settings.Torrent.TransmissionPath
	}
	if destDir == "" {
		destDir = os.TempDir()
	}

	src, err := file.Open()
	if err != nil {
		return h.RespondWithError(c, err)
	}
	defer src.Close()

	destPath := filepath.Join(destDir, file.Filename)
	dst, err := os.Create(destPath)
	if err != nil {
		return h.RespondWithError(c, fmt.Errorf("could not create torrent file in destination: %w", err))
	}
	defer dst.Close()

	if _, err = io.Copy(dst, src); err != nil {
		return h.RespondWithError(c, err)
	}

	h.App.Logger.Info().Str("filename", file.Filename).Str("dest", destPath).Msg("Uploaded torrent file")

	return h.RespondWithData(c, map[string]string{
		"status": "ok", 
		"message": "File uploaded",
		"destination": destPath,
	})
}
