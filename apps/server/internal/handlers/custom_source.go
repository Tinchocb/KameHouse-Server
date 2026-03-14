package handlers

import (
	"github.com/labstack/echo/v4"
)

type CustomSourceHandler struct {
}

func NewCustomSourceHandler() *CustomSourceHandler {
	return &CustomSourceHandler{}
}

func (h *CustomSourceHandler) GetExtensions(c echo.Context) error {
	return c.JSON(200, []string{})
}

func (h *CustomSourceHandler) GetExtension(c echo.Context) error {
	return c.JSON(200, nil)
}

func (h *CustomSourceHandler) InstallExtension(c echo.Context) error {
	return c.JSON(200, nil)
}

func (h *CustomSourceHandler) UninstallExtension(c echo.Context) error {
	return c.JSON(200, nil)
}
