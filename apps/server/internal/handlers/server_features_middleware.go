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
	updateMethodsMap = map[string]struct{}{
		"POST": {}, "PUT": {}, "DELETE": {}, "PATCH": {},
	}
	deleteMethodMap = map[string]struct{}{
		"DELETE": {},
	}
)

var staticPathFeatureRules = []pathFeatureRule{
	// offline mode
	{"/api/v1/local", core.ManageOfflineMode, updateMethodsMap, nil},
	// settings
	{"/api/v1/start", core.UpdateSettings, updateMethodsMap, nil},
	{"/api/v1/settings", core.UpdateSettings, updateMethodsMap, nil},
	{"/api/v1/mediastream/settings", core.UpdateSettings, updateMethodsMap, nil},
	{"/api/v1/theme", core.UpdateSettings, updateMethodsMap, nil},
	{"/api/v1/memory", core.UpdateSettings, nil, nil},
	{"/api/v1/filecache", core.UpdateSettings, nil, nil},
	// account
	{"/api/v1/auth", core.ManageAccount, updateMethodsMap, nil},
	// lists
	{"/api/v1/platform/list-entry", core.ManageLists, updateMethodsMap, nil},
	{"/api/v1/library/anime-entry/update-progress", core.ManageLists, updateMethodsMap, nil},
	{"/api/v1/library/anime-entry/update-repeat", core.ManageLists, updateMethodsMap, nil},
	{"/api/v1/library/scan", core.RefreshMetadata, updateMethodsMap, map[string]struct{}{
		"/api/v1/library/scan":            {},
		"/api/v1/library/scan-summaries": {},
	}},
	// playback
	{"/api/v1/playback-manager", core.WatchingLocalAnime, updateMethodsMap, nil},
	{"/api/v1/media-player/start", core.WatchingLocalAnime, updateMethodsMap, nil},

	// proxy
	{"/api/v1/proxy", core.Proxy, nil, nil},
	{"/api/v1/image-proxy", core.Proxy, nil, nil},
	// logs
	{"/api/v1/log", core.ViewLogs, nil, nil},
	{"/api/v1/logs", core.ViewLogs, nil, nil},
	{"/api/v1/logs", core.UpdateSettings, deleteMethodMap, nil},
	// transcode
	{"/api/v1/mediastream", core.WatchingLocalAnime, updateMethodsMap, map[string]struct{}{
		"/api/v1/mediastream/settings": {},
	}},
	{"/api/v1/mediastream/file", core.WatchingLocalAnime, nil, nil},
	{"/api/v1/mediastream", core.WatchingLocalAnime, nil, nil},
	{"/api/v1/metadata-provider", core.ManageLocalAnimeLibrary, updateMethodsMap, nil},
	{"/api/v1/library", core.ManageLocalAnimeLibrary, updateMethodsMap, map[string]struct{}{
		"/api/v1/library/anime-entry/update-progress": {},
		"/api/v1/library/anime-entry/update-repeat":   {},
		"/api/v1/library/scan":                        {},
		"/api/v1/library/scan-summaries":              {},
		"/api/v1/library/explorer/file-tree":          {},
		"/api/v1/library/explorer/file-tree/refresh":  {},
		"/api/v1/library/explorer/directory-children": {},
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
			if h.App.FeatureManager.IsDisabled(rule.feature) && strings.HasPrefix(path, rule.pathStartsWith) {
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

		if h.App.FeatureManager.IsDisabled(core.PushRequests) {
			if strings.HasPrefix(path, "/api/v1/platform/list-anime") ||
				strings.HasPrefix(path, "/api/v1/platform/list-recent-anime") ||
				strings.HasPrefix(path, "/api/v1/announcements") {
				if _, match := updateMethodsMap[method]; match {
					return h.RespondWithData(c, nil)
				}
			}
		}

		return next(c)
	}
}

