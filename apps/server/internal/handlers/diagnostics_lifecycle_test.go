package handlers

import (
	"archive/zip"
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"kamehouse/internal/database/models"
	"kamehouse/internal/util/filecache"

	"github.com/labstack/echo/v4"
	"github.com/stretchr/testify/require"
)

type diagnosticsFailWriter struct {
	calls, failOn int
	buf           bytes.Buffer
}

var errDiagnosticsWrite = errors.New("client disconnected")

func (w *diagnosticsFailWriter) Write(data []byte) (int, error) {
	w.calls++
	if w.calls == w.failOn {
		return 0, errDiagnosticsWrite
	}
	return w.buf.Write(data)
}

func TestDiagnosticsZipPreservesEntriesAndRedactsSettings(t *testing.T) {
	app, _ := setupTestApp(t)
	_, err := app.Database.UpsertSettings(&models.Settings{BaseModel: models.BaseModel{ID: 1}, Library: models.LibrarySettings{TmdbApiKey: "private-api-key"}, GoogleDrive: models.GoogleDriveSettings{ClientSecret: "private-client-secret", RefreshToken: "private-refresh-token"}})
	require.NoError(t, err)
	require.NoError(t, os.WriteFile(filepath.Join(app.Config.Logs.Dir, "kamehouse-fixture.log"), []byte("fixture log"), 0600))
	w := &diagnosticsFailWriter{}
	require.NoError(t, (&Handler{App: app}).writeDiagnosticsArchive(t.Context(), w))
	r, err := zip.NewReader(bytes.NewReader(w.buf.Bytes()), int64(w.buf.Len()))
	require.NoError(t, err)
	entries := map[string]string{}
	for _, f := range r.File {
		in, err := f.Open()
		require.NoError(t, err)
		data, err := io.ReadAll(in)
		require.NoError(t, err)
		require.NoError(t, in.Close())
		entries[f.Name] = string(data)
	}
	require.Len(t, entries, 4)
	require.Equal(t, "fixture log", entries["logs/latest.log"])
	for _, secret := range []string{"private-api-key", "private-client-secret", "private-refresh-token"} {
		require.NotContains(t, entries["settings.json"], secret)
	}
	var redacted models.Settings
	require.NoError(t, json.Unmarshal([]byte(entries["settings.json"]), &redacted))
	require.Equal(t, "<redacted>", redacted.Library.TmdbApiKey)
	require.Equal(t, "<redacted>", redacted.GoogleDrive.ClientSecret)
	require.Equal(t, "<redacted>", redacted.GoogleDrive.RefreshToken)
	settings, err := app.Database.GetSettings()
	require.NoError(t, err)
	require.Equal(t, "private-api-key", settings.Library.TmdbApiKey)
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/report", nil)
	require.NoError(t, (&Handler{App: app}).HandleGetDiagnosticsReport(echo.New().NewContext(req, rec)))
	require.Equal(t, http.StatusOK, rec.Code)
	require.Equal(t, "application/zip", rec.Header().Get("Content-Type"))
	_, err = zip.NewReader(bytes.NewReader(rec.Body.Bytes()), int64(rec.Body.Len()))
	require.NoError(t, err)
	// Failing the last output write exercises errors from ZIP finalization.
	failing := &diagnosticsFailWriter{failOn: w.calls}
	require.ErrorIs(t, (&Handler{App: app}).writeDiagnosticsArchive(t.Context(), failing), errDiagnosticsWrite)
	require.Equal(t, failing.failOn, failing.calls)
}

func TestDiagnosticsWriteFailureStopsBeforeSettingsSnapshot(t *testing.T) {
	app, _ := setupTestApp(t)
	require.NoError(t, os.WriteFile(filepath.Join(app.Config.Logs.Dir, "kamehouse-fixture.log"), []byte("fixture log"), 0600))
	app.Database = nil // reaching the next snapshot would panic instead of returning the write error
	w := &diagnosticsFailWriter{failOn: 1}
	require.ErrorIs(t, (&Handler{App: app}).writeDiagnosticsArchive(t.Context(), w), errDiagnosticsWrite)
	require.Equal(t, 1, w.calls)
}

func TestCancelledDiagnosticsStopsBeforeOptionalWork(t *testing.T) {
	for _, cancelOnFlush := range []bool{false, true} {
		t.Run(map[bool]string{false: "before-start", true: "during-flush"}[cancelOnFlush], func(t *testing.T) {
			app, dir := setupTestApp(t)
			cache, err := filecache.NewCacher(filepath.Join(dir, "cache"))
			require.NoError(t, err)
			app.FileCacher = cache
			t.Cleanup(func() { _ = cache.Close() })
			ctx, cancel := context.WithCancel(t.Context())
			defer cancel()
			flushed := false
			app.OnFlushLogs = func() { flushed = true; cancel() }
			if !cancelOnFlush {
				cancel()
			}
			req := httptest.NewRequest(http.MethodGet, "/report", nil).WithContext(ctx)
			rec := httptest.NewRecorder()
			err = (&Handler{App: app}).HandleGetDiagnosticsReport(echo.New().NewContext(req, rec))
			require.ErrorIs(t, err, context.Canceled)
			require.Equal(t, cancelOnFlush, flushed)
			require.Empty(t, rec.Body.Bytes())
		})
	}
}
