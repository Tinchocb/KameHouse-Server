package handlers

import (
	"kamehouse/internal/database/db"

	"github.com/labstack/echo/v4"
)

// HandleGetScanSummaries
//
//	@summary returns the latest scan summaries.
//	@route /api/v1/library/scan-summaries [GET]
//	@returns []summary.ScanSummaryItem
func (h *Handler) HandleGetScanSummaries(c echo.Context) error {

	sm, err := db.GetScanSummaries(h.App.Database)
	if err != nil {
		return h.RespondWithError(c, err)
	}

	return h.RespondWithData(c, sm)
}
