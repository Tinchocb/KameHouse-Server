package handlers

import (
	"kamehouse/internal/constants"

	"github.com/goccy/go-json"
	"github.com/labstack/echo/v4"
)

func (h *Handler) HandleHealth(c echo.Context) error {
	c.Response().Header().Set("Access-Control-Allow-Origin", "*")
	c.Response().Header().Set("Access-Control-Allow-Methods", "GET, OPTIONS")
	c.Response().Header().Set("Access-Control-Allow-Headers", "Origin, Content-Type, Accept")

	if c.Request().Method == "OPTIONS" {
		return c.NoContent(200)
	}

	body, _ := json.Marshal(map[string]interface{}{
		"status":  "ok",
		"app":     "KameHouse",
		"version": constants.Version,
	})
	return c.JSONBlob(200, body)
}
