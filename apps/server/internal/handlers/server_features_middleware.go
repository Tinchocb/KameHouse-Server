package handlers

import (
	"errors"
	"kamehouse/internal/core"
	"strings"

	"github.com/labstack/echo/v4"
)

var ErrFeatureDisabled = errors.New("feature disabled")

type pathFeatureRule struct {
	pathStartsWith string
	feature        core.FeatureKey
	methods        map[string]struct{}
	excludePaths   map[string]struct{}
}

var (
	readMethodsMap = map[string]struct{}{
		"GET": {}, "HEAD": {},
	}
	updateMethodsMap = map[string]struct{}{
		"POST": {}, "PUT": {}, "DELETE": {}, "PATCH": {},
	}
	deleteMethodMap = map[string]struct{}{
		"DELETE": {},
	}
)

var staticPathFeatureRules = []pathFeatureRule{
	// settings
	{"/api/v1/settings", core.ViewSettings, readMethodsMap, nil},
	{"/api/v1/mediastream/settings", core.ViewSettings, readMethodsMap, nil},
	{"/api/v1/report", core.ViewSettings, readMethodsMap, nil},
	{"/api/v1/db/backup", core.ViewSettings, nil, nil},
	{"/api/v1/db/backup", core.UpdateSettings, updateMethodsMap, nil},
	{"/api/v1/start", core.UpdateSettings, updateMethodsMap, nil},
	{"/api/v1/settings", core.UpdateSettings, updateMethodsMap, nil},
	{"/api/v1/mediastream/settings", core.UpdateSettings, updateMethodsMap, nil},
	{"/api/v1/memory", core.UpdateSettings, nil, nil},
	// lists & progress
	{"/api/v1/library/anime-entry/progress", core.ManageLists, updateMethodsMap, nil},
	{"/api/v1/library/scan", core.RefreshMetadata, updateMethodsMap, map[string]struct{}{
		"/api/v1/library/scan":           {},
		"/api/v1/library/scan-summaries": {},
	}},
	// proxy
	{"/api/v1/image-proxy", core.Proxy, nil, nil},
	// logs
	{"/api/v1/report", core.ViewLogs, readMethodsMap, nil},
	{"/api/v1/log", core.ViewLogs, nil, nil},
	{"/api/v1/logs", core.ViewLogs, nil, nil},
	{"/api/v1/logs", core.UpdateSettings, deleteMethodMap, nil},
	// transcode & stream
	{"/api/v1/mediastream", core.WatchingLocalAnime, updateMethodsMap, map[string]struct{}{
		"/api/v1/mediastream/settings": {},
	}},
	{"/api/v1/mediastream", core.WatchingLocalAnime, nil, nil},
	{"/api/v1/library", core.ManageLocalAnimeLibrary, updateMethodsMap, map[string]struct{}{
		"/api/v1/library/anime-entry/progress": {},
		"/api/v1/library/scan":                 {},
	}},
}

func (h *Handler) FeaturesMiddleware(next echo.HandlerFunc) echo.HandlerFunc {
	return func(c echo.Context) error {
		if !h.App.FeatureManager.HasDisabledFeatures() {
			return next(c)
		}

		path := c.Request().URL.Path
		method := strings.ToUpper(c.Request().Method)

		for _, rule := range staticPathFeatureRules {
			if strings.HasPrefix(path, rule.pathStartsWith) && h.App.FeatureManager.IsDisabled(rule.feature) {
				if rule.excludePaths != nil {
					if _, excluded := rule.excludePaths[path]; excluded {
						continue
					}
				}

				if len(rule.methods) == 0 {
					return h.RespondWithCodeError(c, 403, ErrFeatureDisabled)
				}

				if _, match := rule.methods[method]; match {
					return h.RespondWithCodeError(c, 403, ErrFeatureDisabled)
				}
			}
		}

		return next(c)
	}
}
