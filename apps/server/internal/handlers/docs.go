package handlers

import (
	"github.com/labstack/echo/v4"
)

type (
	ApiDocsGroup struct {
		Filename string          `json:"filename"`
		Name     string          `json:"name"`
		Handlers []*RouteHandler `json:"handlers"`
	}

	RouteHandler struct {
		Name        string           `json:"name"`
		TrimmedName string           `json:"trimmedName"`
		Comments    []string         `json:"comments"`
		Filepath    string           `json:"filepath"`
		Filename    string           `json:"filename"`
		Api         *RouteHandlerApi `json:"api"`
	}

	RouteHandlerApi struct {
		Summary              string               `json:"summary"`
		Descriptions         []string             `json:"descriptions"`
		Endpoint             string               `json:"endpoint"`
		Methods              []string             `json:"methods"`
		Params               []*RouteHandlerParam `json:"params"`
		BodyFields           []*RouteHandlerParam `json:"bodyFields"`
		Returns              string               `json:"returns"`
		ReturnGoType         string               `json:"returnGoType"`
		ReturnTypescriptType string               `json:"returnTypescriptType"`
	}

	RouteHandlerParam struct {
		Name           string   `json:"name"`
		JsonName       string   `json:"jsonName"`
		GoType         string   `json:"goType"`         // e.g., []models.User
		UsedStructType string   `json:"usedStructType"` // e.g., models.User
		TypescriptType string   `json:"typescriptType"` // e.g., Array<User>
		Required       bool     `json:"required"`
		Descriptions   []string `json:"descriptions"`
	}
)

var cachedDocs []*ApiDocsGroup

// HandleGetDocs
//
//	@summary returns the API documentation
//	@route /api/v1/internal/docs [GET]
//	@returns []handlers.ApiDocsGroup
func (h *Handler) HandleGetDocs(c echo.Context) error {

	if len(cachedDocs) > 0 {
		return h.RespondWithData(c, cachedDocs)
	}

	return h.RespondWithData(c, []*ApiDocsGroup{})
}
