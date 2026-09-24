package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"github.com/labstack/echo/v4"
	"github.com/rs/zerolog"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"kamehouse/internal/core"
	"kamehouse/internal/util/cache"
	"kamehouse/internal/util/filecache"
)

func TestCacheHandlers_GetStatsAndClear(t *testing.T) {
	tempDir := t.TempDir()
	cacheDir := filepath.Join(tempDir, "cache")
	thumbDir := filepath.Join(cacheDir, "thumbnails")
	require.NoError(t, os.MkdirAll(thumbDir, 0755))

	// Create dummy thumbnail
	dummyFile := filepath.Join(thumbDir, "dummy.jpg")
	require.NoError(t, os.WriteFile(dummyFile, []byte("fake-jpeg-content-12345"), 0644))

	logger := zerolog.Nop()
	thumbCache, err := cache.NewThumbnailCache(100)
	require.NoError(t, err)
	thumbCache.Set("dummy-key", []byte("fake-jpeg-content-12345"))

	fileCacher, err := filecache.NewCacher(cacheDir)
	require.NoError(t, err)

	cfg := &core.Config{}
	cfg.Cache.Dir = cacheDir
	cfg.Cache.Thumbnails.MemoryMaxItems = 100
	cfg.Cache.Thumbnails.DiskMaxSizeMB = 5120

	app := &core.App{
		CoreServices: core.CoreServices{
			Config:         cfg,
			Logger:         &logger,
			ThumbnailCache: thumbCache,
			FileCacher:     fileCacher,
		},
	}

	h := &Handler{App: app}
	e := echo.New()

	// 1. Test GetCacheStats
	reqStats := httptest.NewRequest(http.MethodGet, "/api/v1/system/cache/stats", nil)
	recStats := httptest.NewRecorder()
	cStats := e.NewContext(reqStats, recStats)

	err = h.HandleGetCacheStats(cStats)
	require.NoError(t, err)
	assert.Equal(t, http.StatusOK, recStats.Code)

	var statsResp struct {
		Data CacheStatsResponse `json:"data"`
	}
	require.NoError(t, json.Unmarshal(recStats.Body.Bytes(), &statsResp))
	assert.Equal(t, 1, statsResp.Data.Thumbnails.MemoryCount)
	assert.Equal(t, 1, statsResp.Data.Thumbnails.DiskItemCount)
	assert.Greater(t, statsResp.Data.Thumbnails.DiskSizeBytes, int64(0))

	// 2. Test ClearSystemCache
	reqClear := httptest.NewRequest(http.MethodPost, "/api/v1/system/cache/clear", nil)
	recClear := httptest.NewRecorder()
	cClear := e.NewContext(reqClear, recClear)

	err = h.HandleClearSystemCache(cClear)
	require.NoError(t, err)
	assert.Equal(t, http.StatusOK, recClear.Code)

	// Memory should be empty
	assert.Equal(t, 0, thumbCache.Len())
	// Disk file should be removed
	assert.NoFileExists(t, dummyFile)

	// 3. Test Targeted Clear (keyframes and fingerprints)
	kfDir := filepath.Join(cacheDir, "keyframes")
	require.NoError(t, os.MkdirAll(kfDir, 0755))
	kfFile := filepath.Join(kfDir, "kf1.json")
	require.NoError(t, os.WriteFile(kfFile, []byte("{}"), 0644))

	reqTargetClear := httptest.NewRequest(http.MethodPost, "/api/v1/system/cache/clear?target=keyframes", nil)
	recTargetClear := httptest.NewRecorder()
	cTargetClear := e.NewContext(reqTargetClear, recTargetClear)
	err = h.HandleClearSystemCache(cTargetClear)
	require.NoError(t, err)
	assert.Equal(t, http.StatusOK, recTargetClear.Code)
	assert.NoFileExists(t, kfFile)

	// 4. Test WarmThumbnailCache cancel when idle
	reqCancel := httptest.NewRequest(http.MethodPost, "/api/v1/cache/thumbnails/warm?action=cancel", nil)
	recCancel := httptest.NewRecorder()
	cCancel := e.NewContext(reqCancel, recCancel)
	err = h.HandleWarmThumbnailCache(cCancel)
	require.NoError(t, err)
	assert.Equal(t, http.StatusOK, recCancel.Code)
}
