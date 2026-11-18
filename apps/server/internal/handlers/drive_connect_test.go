package handlers

import (
	"context"
	"encoding/json"
	"golang.org/x/oauth2"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"

	"github.com/labstack/echo/v4"
	"github.com/rs/zerolog"
	"github.com/stretchr/testify/require"
	"kamehouse/internal/core"
	"kamehouse/internal/database/db"
	"kamehouse/internal/database/models"
	"kamehouse/internal/drive"
	"kamehouse/internal/events"
)

type driveOAuthFixtureTransport func(*http.Request) (*http.Response, error)

func (f driveOAuthFixtureTransport) RoundTrip(r *http.Request) (*http.Response, error) { return f(r) }

func TestDriveConnectUsesProvisionedCredentialsWithoutQueryParameters(t *testing.T) {
	l := zerolog.Nop()
	d, err := db.NewDatabase(t.Context(), t.TempDir(), "drive-connect", &l)
	require.NoError(t, err)
	t.Cleanup(func() { d.Shutdown(); _ = d.Close() })
	_, err = d.UpsertSettings(&models.Settings{BaseModel: models.BaseModel{ID: 1}})
	require.NoError(t, err)
	d.SetSettingsOverride(func(s *models.Settings) {
		s.GoogleDrive.ClientID = "provisioned.apps.googleusercontent.com"
		s.GoogleDrive.ClientSecret = "fixture-secret-never-public"
	})
	a := &core.App{CoreServices: core.CoreServices{Database: d, Logger: &l}, FallbackHMACSecret: "fixture-hmac"}
	h := &Handler{App: a}
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "http://127.0.0.1:43212/api/v1/drive/auth-url", nil)
	require.NoError(t, h.HandleDriveAuthURL(echo.New().NewContext(req, rec)))
	require.Equal(t, http.StatusOK, rec.Code)
	var response struct {
		Data struct {
			URL string `json:"url"`
		} `json:"data"`
	}
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &response))
	u, err := url.Parse(response.Data.URL)
	require.NoError(t, err)
	require.Equal(t, "accounts.google.com", u.Host)
	require.Equal(t, "provisioned.apps.googleusercontent.com", u.Query().Get("client_id"))
	require.Equal(t, "http://127.0.0.1:43212/api/v1/drive/callback", u.Query().Get("redirect_uri"))
	require.NotEmpty(t, u.Query().Get("state"))
	require.NotContains(t, rec.Body.String(), "fixture-secret-never-public")
	rec = httptest.NewRecorder()
	require.NoError(t, h.HandleDriveStatus(echo.New().NewContext(httptest.NewRequest(http.MethodGet, "/api/v1/drive/status", nil), rec)))
	require.Contains(t, rec.Body.String(), `"oauthConfigured":true`)
	require.False(t, strings.Contains(rec.Body.String(), "fixture-secret-never-public"))
	// Complete the callback against a local token fixture. Application secrets
	// remain provisioned on the server; only this account's refresh token is saved.
	a.DriveService = drive.NewService(&l)
	a.WSEventManager = events.NewWSEventManager(&l, nil, t.Context())
	callback := "http://127.0.0.1:43212/api/v1/drive/callback?code=fixture-code&state=" + url.QueryEscape(u.Query().Get("state"))
	req = httptest.NewRequest(http.MethodGet, callback, nil)
	tokenClient := &http.Client{Transport: driveOAuthFixtureTransport(func(r *http.Request) (*http.Response, error) {
		require.Equal(t, "oauth2.googleapis.com", r.URL.Host)
		return &http.Response{StatusCode: http.StatusOK, Header: http.Header{"Content-Type": []string{"application/json"}}, Body: io.NopCloser(strings.NewReader(`{"access_token":"fixture-access","refresh_token":"fixture-refresh","token_type":"Bearer","expires_in":3600}`))}, nil
	})}
	req = req.WithContext(context.WithValue(req.Context(), oauth2.HTTPClient, tokenClient))
	rec = httptest.NewRecorder()
	require.NoError(t, h.HandleDriveCallback(echo.New().NewContext(req, rec)))
	require.Equal(t, http.StatusOK, rec.Code)
	_, err = a.DriveService.GetClient()
	require.NoError(t, err)
	stored, err := d.GetStoredSettings()
	require.NoError(t, err)
	require.Empty(t, stored.GoogleDrive.ClientSecret)
	require.Empty(t, stored.GoogleDrive.ClientID)
	require.Equal(t, "fixture-refresh", stored.GoogleDrive.RefreshToken)
	// A successfully consumed state cannot start a second exchange.
	rec = httptest.NewRecorder()
	require.NoError(t, h.HandleDriveCallback(echo.New().NewContext(req, rec)))
	require.Equal(t, http.StatusBadRequest, rec.Code)
	require.Contains(t, rec.Body.String(), "Error de seguridad")
	// The public consent URL cannot bind refresh tokens to credentials that
	// would be discarded on the next settings refresh/restart.
	req = httptest.NewRequest(http.MethodGet, "http://127.0.0.1:43212/api/v1/drive/auth-url?clientId=another-client", nil)
	err = h.HandleDriveAuthURL(echo.New().NewContext(req, httptest.NewRecorder()))
	var he *echo.HTTPError
	require.ErrorAs(t, err, &he)
	require.Equal(t, http.StatusBadRequest, he.Code)
}
