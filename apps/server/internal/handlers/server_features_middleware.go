package handlers

import (
	"errors"
	"kamehouse/internal/core"
	"slices"
	"strings"

	"github.com/labstack/echo/v4"
)

func (h *Handler) FeaturesMiddleware(next echo.HandlerFunc) echo.HandlerFunc {
	return func(c echo.Context) error {
		if !h.App.FeatureManager.HasDisabledFeatures() {
			return next(c)
		}

		var ErrFeatureDisabled = errors.New("feature disabled")

		type pathFeatureConfig struct {
			PathStartsWith string
			ShouldReject   bool
			Methods        []string
			ExcludePaths   []string
		}

		var UpdateMethods = []string{"POST", "PUT", "DELETE", "PATCH"}
		var Empty []string

		path := c.Request().URL.Path
		method := strings.ToUpper(c.Request().Method)

		var pathFeatureConfigs = []pathFeatureConfig{
			// offline mode
			{"/api/v1/local", h.App.FeatureManager.IsDisabled(core.ManageOfflineMode), UpdateMethods, Empty},
			// settings
			{"/api/v1/start", h.App.FeatureManager.IsDisabled(core.UpdateSettings), UpdateMethods, Empty},
			{"/api/v1/settings", h.App.FeatureManager.IsDisabled(core.UpdateSettings), UpdateMethods, Empty},
			{"/api/v1/mediastream/settings", h.App.FeatureManager.IsDisabled(core.UpdateSettings), UpdateMethods, Empty},
			{"/api/v1/theme", h.App.FeatureManager.IsDisabled(core.UpdateSettings), UpdateMethods, Empty},
			{"/api/v1/memory", h.App.FeatureManager.IsDisabled(core.UpdateSettings), Empty, Empty},
			{"/api/v1/filecache", h.App.FeatureManager.IsDisabled(core.UpdateSettings), Empty, Empty},
			// account
			{"/api/v1/auth", h.App.FeatureManager.IsDisabled(core.ManageAccount), UpdateMethods, Empty},
			// lists
			{"/api/v1/platform/list-entry", h.App.FeatureManager.IsDisabled(core.ManageLists), UpdateMethods, Empty},
			{"/api/v1/library/anime-entry/update-progress", h.App.FeatureManager.IsDisabled(core.ManageLists), UpdateMethods, Empty},
			{"/api/v1/library/anime-entry/update-repeat", h.App.FeatureManager.IsDisabled(core.ManageLists), UpdateMethods, Empty},
			{"/api/v1/library/scan", h.App.FeatureManager.IsDisabled(core.RefreshMetadata), UpdateMethods, []string{"/api/v1/library/scan", "/api/v1/library/scan-summaries"}},
			// playback
			{"/api/v1/playback-manager", h.App.FeatureManager.IsDisabled(core.WatchingLocalAnime), UpdateMethods, Empty},
			{"/api/v1/media-player/start", h.App.FeatureManager.IsDisabled(core.WatchingLocalAnime), UpdateMethods, Empty},

			// open in explorer
			// home items
			// extensions
			// proxy
			{"/api/v1/proxy", h.App.FeatureManager.IsDisabled(core.Proxy), Empty, Empty},
			{"/api/v1/image-proxy", h.App.FeatureManager.IsDisabled(core.Proxy), Empty, Empty},
			// logs
			{"/api/v1/log", h.App.FeatureManager.IsDisabled(core.ViewLogs), Empty, Empty},
			{"/api/v1/logs", h.App.FeatureManager.IsDisabled(core.ViewLogs), Empty, Empty},
			{"/api/v1/logs", h.App.FeatureManager.IsDisabled(core.UpdateSettings), []string{"DELETE"}, Empty},
			// transcode
			{"/api/v1/mediastream", h.App.FeatureManager.IsDisabled(core.WatchingLocalAnime), UpdateMethods, []string{"/api/v1/mediastream/settings"}},
			{"/api/v1/mediastream/file", h.App.FeatureManager.IsDisabled(core.WatchingLocalAnime), Empty, Empty},
			{"/api/v1/mediastream", h.App.FeatureManager.IsDisabled(core.WatchingLocalAnime), Empty, Empty},
			{"/api/v1/metadata-provider", h.App.FeatureManager.IsDisabled(core.ManageLocalAnimeLibrary), UpdateMethods, Empty},
			{"/api/v1/library", h.App.FeatureManager.IsDisabled(core.ManageLocalAnimeLibrary), UpdateMethods, []string{"/api/v1/library/anime-entry/update-progress", "/api/v1/library/anime-entry/update-repeat", "/api/v1/library/scan", "/api/v1/library/scan-summaries", "/api/v1/library/explorer/file-tree", "/api/v1/library/explorer/file-tree/refresh", "/api/v1/library/explorer/directory-children"}},
		}

		pathPrefixes := make([]string, 0, len(pathFeatureConfigs))
		for _, config := range pathFeatureConfigs {
			pathPrefixes = append(pathPrefixes, config.PathStartsWith)
			if config.ShouldReject &&
				strings.HasPrefix(path, config.PathStartsWith) &&
				!slices.ContainsFunc(config.ExcludePaths, func(i string) bool { return path == i }) {
				if len(config.Methods) == 0 || strings.Contains(strings.Join(config.Methods, ","), strings.ToUpper(method)) {
					return h.RespondWithCodeError(c, 403, ErrFeatureDisabled)
				}
			}
		}

		if h.App.FeatureManager.IsDisabled(core.PushRequests) {
			pathPrefixes = append(pathPrefixes, "/api/v1/platform/list-anime", "/api/v1/platform/list-recent-anime", "/api/v1/announcements")
			if !slices.ContainsFunc(pathPrefixes, func(i string) bool { return strings.HasPrefix(path, i) }) {
				if strings.Contains(strings.Join(UpdateMethods, ","), strings.ToUpper(method)) {
					//return h.RespondWithError(c, ErrFeatureDisabled)
					return h.RespondWithData(c, nil)
				}
			}
		}

		return next(c)
	}
}

