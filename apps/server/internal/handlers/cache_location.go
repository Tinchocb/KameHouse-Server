package handlers

import (
	"net/http"

	"github.com/labstack/echo/v4"
)

// HandleGetCacheLocation returns the active and saved cache directories.
//
// @route /api/v1/system/cache/location [GET]
// @returns core.CacheLocation
func (h *Handler) HandleGetCacheLocation(c echo.Context) error {
	location, err := h.App.Config.CacheLocation()
	if err != nil {
		return h.RespondWithError(c, err)
	}
	return h.RespondWithData(c, location)
}

// HandleSaveCacheLocation saves the cache directory for the next server start.
//
// @route /api/v1/system/cache/location [PATCH]
// @body directory string
// @returns core.CacheLocation
func (h *Handler) HandleSaveCacheLocation(c echo.Context) error {
	var body struct {
		Directory string `json:"directory"`
	}
	if err := c.Bind(&body); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "La ubicación de caché no es válida")
	}
	location, err := h.App.Config.SaveCacheLocation(body.Directory)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}
	return h.RespondWithData(c, location)
}
