package handlers

import (
	"kamehouse/internal/library/scanner"

	"github.com/labstack/echo/v4"
)

// DUMMY HANDLER

type RequestBody struct {
	Dir      string `json:"dir"`
	Username string `json:"userName"`
}

// HandleTestDump
//
//	@summary this is a dummy handler for testing purposes.
//	@route /api/v1/test-dump [POST]
func (h *Handler) HandleTestDump(c echo.Context) error {

	body := new(RequestBody)
	if err := c.Bind(body); err != nil {
		return h.RespondWithError(c, err)
	}

	localFiles, err := scanner.GetLocalFilesFromDir(body.Dir, h.App.Logger)
	if err != nil {
		return h.RespondWithError(c, err)
	}

	mc, err := scanner.NewMediaFetcher(c.Request().Context(), &scanner.MediaFetcherOptions{
		PlatformRef:            h.App.Metadata.PlatformRef,
		MetadataProviderRef:    h.App.Metadata.ProviderRef,
		LocalFiles:             localFiles,
		Logger:                 h.App.Logger,
		DisableAnimeCollection: false,
		ScanLogger:             nil,
	})

	if err != nil {
		return h.RespondWithError(c, err)
	}

	return h.RespondWithData(c, mc.AllMedia)
}
