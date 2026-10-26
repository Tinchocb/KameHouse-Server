package handlers

import (
	"kamehouse/internal/intelligence"

	"github.com/labstack/echo/v4"
)

// HandleSemanticSearch returns lore entities and smart recommendations for a query.
//
//	@summary search lore entities and sagas.
//	@desc Searches characters, transformations, sagas and milestones.
//	@returns []intelligence.SemanticSearchResult
//	@route /api/v1/intelligence/search [GET]
func (h *Handler) HandleSemanticSearch(c echo.Context) error {
	query := c.QueryParam("q")
	results := intelligence.SearchSemanticEntities(query)
	return h.RespondWithData(c, results)
}
