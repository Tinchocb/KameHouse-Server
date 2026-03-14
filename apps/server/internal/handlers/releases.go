package handlers

import (
	"fmt"
	"kamehouse/internal/util/result"

	"github.com/labstack/echo/v4"
)

// HandleInstallLatestUpdate
//
//	@summary installs the latest update.
//	@desc This will install the latest update and launch the new version.
//	@route /api/v1/install-update [POST]
//	@returns handlers.Status
func (h *Handler) HandleInstallLatestUpdate(c echo.Context) error {
	type body struct {
		FallbackDestination string `json:"fallback_destination"`
	}
	var b body
	if err := c.Bind(&b); err != nil {
		return h.RespondWithError(c, err)
	}

	return h.RespondWithData(c, nil)
}

// HandleGetLatestUpdate
//
//	@summary returns the latest update.
//	@desc This will return the latest update.
//	@desc If an error occurs, it will return an empty update.
//	@route /api/v1/latest-update [GET]
//	@returns any
func (h *Handler) HandleGetLatestUpdate(c echo.Context) error {
	return h.RespondWithData(c, nil)
}

type changelogItem struct {
	Version string   `json:"version"`
	Lines   []string `json:"lines"`
}

var changelogCache = result.NewCache[string, []*changelogItem]()

// HandleGetChangelog
//
//	@summary returns the changelog for versions greater than or equal to the given version.
//	@route /api/v1/changelog [GET]
//	@param before query string true "The version to get the changelog for."
//	@returns string
func (h *Handler) HandleGetChangelog(c echo.Context) error {
	before := c.QueryParam("before")
	after := c.QueryParam("after")

	key := fmt.Sprintf("%s-%s", before, after)

	cached, ok := changelogCache.Get(key)
	if ok {
		return h.RespondWithData(c, cached)
	}

	// changelog fetches from Github are disabled
	return h.RespondWithData(c, []*changelogItem{})
}
