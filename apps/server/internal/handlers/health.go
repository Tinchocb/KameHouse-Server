package handlers

import (
	"context"
	"net/http"
	"os"
	"sync"
	"time"

	"kamehouse/internal/api/tmdb"
	"kamehouse/internal/database/db"
	"kamehouse/internal/util/ffmpegutil"
	"kamehouse/internal/util/filecache"
	httputil "kamehouse/internal/util/http"

	"github.com/goccy/go-json"
	"github.com/labstack/echo/v4"
)

type HealthCheckResult struct {
	Status    string `json:"status"`
	LatencyMs int64  `json:"latency_ms"`
	Message   string `json:"message,omitempty"`
	Details   any    `json:"details,omitempty"`
}

type HealthResponse struct {
	Status string                       `json:"status"`
	Checks map[string]HealthCheckResult `json:"checks"`
}

// /api/health es anónimo y sin rate limit: cada llamada consultaba la DB y la
// API de TMDB. Se reutiliza el último resultado un rato; el mutex hace que una
// ráfaga concurrente espere al único cálculo en curso en vez de repetirlo.
const (
	healthCacheTTL         = 30 * time.Second
	healthCacheTTLDegraded = 5 * time.Second
)

var healthCache struct {
	mu        sync.Mutex
	body      []byte
	status    int
	expiresAt time.Time
}

func (h *Handler) HandleHealth(c echo.Context) error {
	c.Response().Header().Set("Access-Control-Allow-Origin", "*")
	c.Response().Header().Set("Access-Control-Allow-Methods", "GET, OPTIONS")
	c.Response().Header().Set("Access-Control-Allow-Headers", "Origin, Content-Type, Accept")

	if c.Request().Method == "OPTIONS" {
		return c.NoContent(200)
	}

	healthCache.mu.Lock()
	defer healthCache.mu.Unlock()
	if healthCache.body != nil && time.Now().Before(healthCache.expiresAt) {
		return c.JSONBlob(healthCache.status, healthCache.body)
	}

	// No el ctx del request: el resultado se comparte y se cachea, y un cliente
	// que corta no debe dejar cacheado un "down" falso.
	ctx, cancel := context.WithTimeout(h.App.ShutdownCtx(), 5*time.Second)
	defer cancel()

	checks := make(map[string]HealthCheckResult)
	overallStatus := "ok"

	// DB check
	dbResult := checkDB(ctx, h.App.Database)
	checks["db"] = dbResult
	if dbResult.Status == "down" {
		overallStatus = "down"
	} else if dbResult.Status == "degraded" && overallStatus == "ok" {
		overallStatus = "degraded"
	}

	// Cache check
	cacheResult := checkCache(ctx, h.App.FileCacher, h.App.Config.Cache.Dir)
	checks["cache"] = cacheResult
	if cacheResult.Status == "down" {
		overallStatus = "down"
	} else if cacheResult.Status == "degraded" && overallStatus == "ok" {
		overallStatus = "degraded"
	}

	// TMDB check
	tmdbResult := checkTMDB(ctx, h.App.Metadata.TMDBClient)
	checks["tmdb"] = tmdbResult
	if tmdbResult.Status == "down" {
		overallStatus = "down"
	} else if tmdbResult.Status == "degraded" && overallStatus == "ok" {
		overallStatus = "degraded"
	}

	// Migration status check
	migrationResult := checkMigrations(ctx, h.App.Database)
	checks["migrations"] = migrationResult
	if migrationResult.Status == "down" {
		overallStatus = "down"
	} else if migrationResult.Status == "degraded" && overallStatus == "ok" {
		overallStatus = "degraded"
	}

	// FFmpeg check
	ffmpegResult := checkFFmpeg(ctx, h.App.FFmpegManager, h.App.Config.Cache.Dir)
	checks["ffmpeg"] = ffmpegResult
	if ffmpegResult.Status == "down" {
		overallStatus = "down"
	} else if ffmpegResult.Status == "degraded" && overallStatus == "ok" {
		overallStatus = "degraded"
	}

	response := HealthResponse{
		Status: overallStatus,
		Checks: checks,
	}

	statusCode := 200
	if overallStatus == "down" {
		statusCode = 503
	}

	body, _ := json.Marshal(response)
	ttl := healthCacheTTL
	if overallStatus != "ok" {
		ttl = healthCacheTTLDegraded
	}
	healthCache.body, healthCache.status, healthCache.expiresAt = body, statusCode, time.Now().Add(ttl)
	return c.JSONBlob(statusCode, body)
}

func checkDB(ctx context.Context, database *db.Database) HealthCheckResult {
	start := time.Now()
	result := HealthCheckResult{}

	if database == nil {
		result.Status = "down"
		result.Message = "database not initialized"
		result.LatencyMs = time.Since(start).Milliseconds()
		return result
	}

	gormDB := database.Gorm()
	if gormDB == nil {
		result.Status = "down"
		result.Message = "gorm db not initialized"
		result.LatencyMs = time.Since(start).Milliseconds()
		return result
	}

	sqlDB, err := gormDB.DB()
	if err != nil {
		result.Status = "down"
		result.Message = "failed to get sql.DB: " + err.Error()
		result.LatencyMs = time.Since(start).Milliseconds()
		return result
	}

	if err := sqlDB.PingContext(ctx); err != nil {
		result.Status = "down"
		result.Message = "ping failed: " + err.Error()
		result.LatencyMs = time.Since(start).Milliseconds()
		return result
	}

	result.Status = "ok"
	result.LatencyMs = time.Since(start).Milliseconds()
	result.Message = "database reachable"
	return result
}

func checkCache(ctx context.Context, cacher *filecache.Cacher, cacheDir string) HealthCheckResult {
	start := time.Now()
	result := HealthCheckResult{}

	if cacher == nil {
		result.Status = "down"
		result.Message = "cache not initialized"
		result.LatencyMs = time.Since(start).Milliseconds()
		return result
	}

	dir := cacheDir
	if dir == "" {
		result.Status = "down"
		result.Message = "cache directory unknown"
		result.LatencyMs = time.Since(start).Milliseconds()
		return result
	}

	info, err := os.Stat(dir)
	if err != nil {
		result.Status = "down"
		result.Message = "cache directory not accessible: " + err.Error()
		result.LatencyMs = time.Since(start).Milliseconds()
		return result
	}

	if !info.IsDir() {
		result.Status = "down"
		result.Message = "cache path is not a directory"
		result.LatencyMs = time.Since(start).Milliseconds()
		return result
	}

	testFile := dir + "/.health_check_" + time.Now().Format("20060102150405")
	f, err := os.Create(testFile)
	if err != nil {
		result.Status = "down"
		result.Message = "cache directory not writable: " + err.Error()
		result.LatencyMs = time.Since(start).Milliseconds()
		return result
	}
	f.Close()
	os.Remove(testFile)

	result.Status = "ok"
	result.LatencyMs = time.Since(start).Milliseconds()
	result.Message = "cache directory writable"
	result.Details = map[string]string{"path": dir}
	return result
}

func checkTMDB(ctx context.Context, client *tmdb.Client) HealthCheckResult {
	start := time.Now()
	result := HealthCheckResult{}

	if client == nil {
		result.Status = "degraded"
		result.Message = "tmdb client not initialized"
		result.LatencyMs = time.Since(start).Milliseconds()
		return result
	}

	if !client.HasApiKey() {
		result.Status = "degraded"
		result.Message = "no TMDB API key configured"
		result.LatencyMs = time.Since(start).Milliseconds()
		return result
	}

	reqCtx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()

	req, err := http.NewRequestWithContext(reqCtx, "GET", "https://api.themoviedb.org/3/configuration", nil)
	if err != nil {
		result.Status = "down"
		result.Message = "failed to create request: " + err.Error()
		result.LatencyMs = time.Since(start).Milliseconds()
		return result
	}

	token := client.GetBearerToken()
	if len(token) > 50 {
		req.Header.Set("Authorization", "Bearer "+token)
	} else {
		q := req.URL.Query()
		q.Add("api_key", token)
		req.URL.RawQuery = q.Encode()
	}
	req.Header.Set("Accept", "application/json")

	httpClient := httputil.NewFastClient()

	resp, err := httpClient.Do(req)
	if err != nil {
		result.Status = "down"
		result.Message = "request failed: " + err.Error()
		result.LatencyMs = time.Since(start).Milliseconds()
		return result
	}
	defer resp.Body.Close()

	if resp.StatusCode == 401 {
		result.Status = "degraded"
		result.Message = "invalid TMDB API key"
		result.LatencyMs = time.Since(start).Milliseconds()
		return result
	}

	if resp.StatusCode >= 500 {
		result.Status = "down"
		result.Message = "TMDB service unavailable"
		result.LatencyMs = time.Since(start).Milliseconds()
		return result
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		result.Status = "degraded"
		result.Message = "unexpected TMDB status: " + resp.Status
		result.LatencyMs = time.Since(start).Milliseconds()
		return result
	}

	result.Status = "ok"
	result.LatencyMs = time.Since(start).Milliseconds()
	result.Message = "TMDB reachable"
	return result
}

func checkMigrations(ctx context.Context, database *db.Database) HealthCheckResult {
	start := time.Now()
	result := HealthCheckResult{}

	if database == nil {
		result.Status = "down"
		result.Message = "database not initialized"
		result.LatencyMs = time.Since(start).Milliseconds()
		return result
	}

	complete, err := database.MigrationStatus()
	if err != nil {
		result.Status = "down"
		result.Message = "migration error: " + err.Error()
		result.LatencyMs = time.Since(start).Milliseconds()
		return result
	}

	if !complete {
		result.Status = "degraded"
		result.Message = "data migrations still running"
		result.LatencyMs = time.Since(start).Milliseconds()
		return result
	}

	result.Status = "ok"
	result.LatencyMs = time.Since(start).Milliseconds()
	result.Message = "migrations complete"
	return result
}

func checkFFmpeg(ctx context.Context, manager *ffmpegutil.Manager, cacheDir string) HealthCheckResult {
	start := time.Now()
	result := HealthCheckResult{}

	if manager == nil {
		result.Status = "down"
		result.Message = "ffmpeg manager not initialized"
		result.LatencyMs = time.Since(start).Milliseconds()
		return result
	}

	status := manager.GetStatus("", "")

	if !status.FFmpegAvailable && !status.FFprobeAvailable {
		result.Status = "down"
		result.Message = "neither ffmpeg nor ffprobe available"
		result.LatencyMs = time.Since(start).Milliseconds()
		result.Details = map[string]any{
			"ffmpeg_path":  status.FFmpegPath,
			"ffprobe_path": status.FFprobePath,
		}
		return result
	}

	if !status.FFmpegAvailable || !status.FFprobeAvailable {
		result.Status = "degraded"
		result.Message = "ffmpeg or ffprobe missing"
		result.LatencyMs = time.Since(start).Milliseconds()
		result.Details = map[string]any{
			"ffmpeg_available":  status.FFmpegAvailable,
			"ffprobe_available": status.FFprobeAvailable,
			"ffmpeg_path":       status.FFmpegPath,
			"ffprobe_path":      status.FFprobePath,
			"ffmpeg_version":    status.FFmpegVersion,
			"ffprobe_version":   status.FFprobeVersion,
		}
		return result
	}

	result.Status = "ok"
	result.LatencyMs = time.Since(start).Milliseconds()
	result.Message = "ffmpeg and ffprobe available"
	result.Details = map[string]any{
		"ffmpeg_path":     status.FFmpegPath,
		"ffprobe_path":    status.FFprobePath,
		"ffmpeg_version":  status.FFmpegVersion,
		"ffprobe_version": status.FFprobeVersion,
	}
	return result
}
