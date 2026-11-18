package handlers

import (
	"github.com/labstack/echo/v4"
	"github.com/rs/zerolog"
	"github.com/stretchr/testify/require"
	"kamehouse/internal/core"
	"kamehouse/internal/database/db"
	"kamehouse/internal/database/models"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestDriveOAuthRejectsStreamingExpiredAndReusedStates(t *testing.T) {
	l := zerolog.Nop()
	h := &Handler{App: &core.App{CoreServices: core.CoreServices{Logger: &l}, FallbackHMACSecret: "fixture"}}
	streamToken, err := h.App.GetServerPasswordHMACAuth().GenerateTokenWithTTL("*", 5*time.Minute)
	require.NoError(t, err)
	h.driveOAuthStates = map[string]driveOAuthAttempt{
		"expired": {expiresAt: time.Now().Add(-time.Second)},
		"once":    {expiresAt: time.Now().Add(time.Minute)},
	}
	for _, state := range []string{streamToken, "expired", "once", "once"} {
		rec := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodGet, "/callback?state="+url.QueryEscape(state), nil)
		require.NoError(t, h.HandleDriveCallback(echo.New().NewContext(req, rec)))
		// The first 'once' reaches OAuth's missing-code error; every other state
		// must fail before a token exchange can occur.
		require.Equal(t, http.StatusBadRequest, rec.Code)
		if state != "once" {
			require.Contains(t, rec.Body.String(), "Error de seguridad")
		}
	}
	require.Empty(t, h.driveOAuthStates)
}

func TestRemoteMusicIsConfinedToSavedRoot(t *testing.T) {
	l := zerolog.Nop()
	d, err := db.NewDatabase(t.Context(), t.TempDir(), "music", &l)
	require.NoError(t, err)
	t.Cleanup(func() { _ = d.Close() })
	root, outside := t.TempDir(), t.TempDir()
	require.NoError(t, os.Mkdir(filepath.Join(root, "openings"), 0700))
	for _, dir := range []string{root, outside, filepath.Join(root, "openings")} {
		require.NoError(t, os.WriteFile(filepath.Join(dir, "song.mp3"), []byte("audio"), 0600))
	}
	_, err = d.UpsertTheme(&models.Theme{BaseModel: models.BaseModel{ID: 1}, BgMusicDir: root})
	require.NoError(t, err)
	h := &Handler{App: &core.App{CoreServices: core.CoreServices{Database: d, Logger: &l}}}
	for _, dir := range []string{root, filepath.Join(root, "openings"), outside} {
		for _, stream := range []bool{false, true} {
			q := url.Values{"dir": {dir}, "file": {"song.mp3"}}
			req := httptest.NewRequest(http.MethodGet, "/?"+q.Encode(), nil)
			req.RemoteAddr = "192.168.1.50:5000"
			rec := httptest.NewRecorder()
			c := echo.New().NewContext(req, rec)
			var handlerErr error
			if stream {
				handlerErr = h.HandleStreamBackgroundMusic(c)
			} else {
				handlerErr = h.HandleScanBackgroundMusic(c)
			}
			if dir == outside {
				var he *echo.HTTPError
				require.ErrorAs(t, handlerErr, &he)
				require.Equal(t, http.StatusForbidden, he.Code)
			} else {
				require.NoError(t, handlerErr)
				require.Equal(t, http.StatusOK, rec.Code)
			}
		}
	}
	// Even a file inside the approved folder cannot link to an outside recording.
	link := filepath.Join(root, "external.mp3")
	if err := os.Symlink(filepath.Join(outside, "song.mp3"), link); err == nil {
		req := httptest.NewRequest(http.MethodGet, "/?"+url.Values{"dir": {root}, "file": {"external.mp3"}}.Encode(), nil)
		req.RemoteAddr = "192.168.1.50:5000"
		require.Error(t, h.HandleStreamBackgroundMusic(echo.New().NewContext(req, httptest.NewRecorder())))
	}
}
