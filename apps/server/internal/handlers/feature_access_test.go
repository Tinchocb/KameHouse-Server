package handlers

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"kamehouse/internal/core"

	"github.com/labstack/echo/v4"
	"github.com/rs/zerolog"
	"github.com/stretchr/testify/require"
)

func TestFeatureRestrictionsCoverSettingsReadsAndLogExport(t *testing.T) {
	for _, tc := range []struct {
		feature      core.FeatureKey
		method, path string
		want         int
	}{
		{core.ViewSettings, http.MethodGet, "/api/v1/settings", 403},
		{core.ViewSettings, http.MethodHead, "/api/v1/settings", 403},
		{core.ViewSettings, http.MethodGet, "/api/v1/mediastream/settings", 403},
		{core.ViewLogs, http.MethodGet, "/api/v1/report", 403},
		{core.UpdateSettings, http.MethodGet, "/api/v1/settings", 200},
		{core.UpdateSettings, http.MethodPatch, "/api/v1/settings", 403},
		{core.ViewSettings, http.MethodGet, "/api/v1/library/collection", 200},
		{core.ViewSettings, http.MethodGet, "/api/v1/db/backup/download", 403},
		{core.ViewSettings, http.MethodHead, "/api/v1/db/backup/download", 403},
		{core.ViewSettings, http.MethodPost, "/api/v1/db/backup", 403},
		{core.UpdateSettings, http.MethodPost, "/api/v1/db/backup", 403},
		{core.UpdateSettings, http.MethodGet, "/api/v1/db/backup/download", 200},
		{core.ViewLogs, http.MethodPost, "/api/v1/db/backup", 200},
	} {
		t.Run(string(tc.feature)+tc.method+tc.path, func(t *testing.T) {
			logger := zerolog.Nop()
			app := &core.App{}
			app.FeatureManager = core.NewFeatureManager(&logger, core.KameHouseFlags{DisableFeatures: []core.FeatureKey{tc.feature}})
			h := &Handler{App: app}
			e := echo.New()
			rec := httptest.NewRecorder()
			c := e.NewContext(httptest.NewRequest(tc.method, tc.path, nil), rec)
			called := false
			require.NoError(t, h.FeaturesMiddleware(func(c echo.Context) error { called = true; return c.NoContent(200) })(c))
			require.Equal(t, tc.want, rec.Code)
			require.Equal(t, tc.want == 200, called)
		})
	}
}
