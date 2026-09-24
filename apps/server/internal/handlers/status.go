package handlers

import (
	"errors"
	"fmt"
	"io/fs"
	"kamehouse/internal/api/tmdb"
	"kamehouse/internal/constants"
	"kamehouse/internal/core"
	"kamehouse/internal/database/models"
	"kamehouse/internal/user"
	"kamehouse/internal/util"
	"kamehouse/internal/util/result"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"runtime"
	"runtime/pprof"
	"slices"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/labstack/echo/v4"
)


var (
	cpuProfileMu       sync.Mutex
	cpuProfilingActive bool
)

// Status is a struct containing the user data, settings, and OS.
// It is used by the client in various places to access necessary information.
type Status struct {
	OS                    string                        `json:"os"`
	ClientDevice          string                        `json:"clientDevice"`
	ClientPlatform        string                        `json:"clientPlatform"`
	ClientUserAgent       string                        `json:"clientUserAgent"`
	DataDir               string                        `json:"dataDir"`
	User                  *user.User                    `json:"user"`
	Settings              *models.Settings              `json:"settings"`
	Version               string                        `json:"version"`
	VersionName           string                        `json:"versionName"`
	ThemeSettings         *models.Theme                 `json:"themeSettings"`
	IsOffline             bool                          `json:"isOffline"`
	MediastreamSettings   *models.MediastreamSettings   `json:"mediastreamSettings"`
	// PlatformClientID       string                        `json:"PlatformClientId"`
	Updating              bool                          `json:"updating"`         // If true, a new screen will be displayed
	IsDesktopSidecar      bool                          `json:"isDesktopSidecar"` // The server is running as a desktop sidecar
	FeatureFlags          core.FeatureFlags             `json:"featureFlags"`
	DisabledFeatures      []core.FeatureKey             `json:"disabledFeatures"`
	ServerReady           bool                          `json:"serverReady"`
	ServerHasPassword     bool                          `json:"serverHasPassword"`
	ShowChangelogTour     string                        `json:"showChangelogTour"`
	ServerIPs             []string                      `json:"serverIPs"`
	ServerPort            int                           `json:"serverPort"`
	Pid                   int                           `json:"pid"` // OS process id of the server; used by the desktop sidecar to reap orphans
	TMDBDegraded          bool                          `json:"tmdbDegraded"`       // True when no usable TMDB token is configured (placeholder/missing)
	TMDBDegradedReason    string                        `json:"tmdbDegradedReason"` // "", "missing" or "placeholder"
}

var clientInfoCache = result.NewMap[string, util.ClientInfo]()

// NewStatus returns a new Status struct.
// It uses the RouteCtx to get the App instance containing the Database instance.
func (h *Handler) NewStatus(c echo.Context) *Status {
	var dbAcc *models.Account
	var currentUser *user.User
	var settings *models.Settings
	var theme *models.Theme
	//var mal *models.Mal

	// Get the user from the database (if logged in)
	if dbAcc, _ = h.App.Database.GetAccount(); dbAcc != nil {
		currentUser, _ = user.NewUser(dbAcc)
		if currentUser != nil {
			currentUser.Token = "HIDDEN"
		}
	} else {
		// If the user is not logged in, create a simulated user
		currentUser = user.NewSimulatedUser()
	}

	if settings, _ = h.App.Database.GetSettings(); settings == nil {
		settings = &models.Settings{}
	}

	clientInfo, found := clientInfoCache.Get(c.Request().UserAgent())
	if !found {
		clientInfo = util.GetClientInfo(c.Request().UserAgent())
		clientInfoCache.Set(c.Request().UserAgent(), clientInfo)
	}

	theme, _ = h.App.Database.GetThemeCopy()
	if theme == nil {
		theme = &models.Theme{}
	}

	status := &Status{
		OS:                    runtime.GOOS,
		ClientDevice:          clientInfo.Device,
		ClientPlatform:        clientInfo.Platform,
		DataDir:               h.App.Config.Data.AppDataDir,
		ClientUserAgent:       c.Request().UserAgent(),
		User:                  currentUser,
		Settings:              settings,
		Version:               h.App.Version,
		VersionName:           constants.VersionName,
		ThemeSettings:         theme,
		IsOffline:             h.App.IsOffline(),
		MediastreamSettings:   h.App.SecondarySettings.Mediastream,
		// PlatformClientID:       h.App.Config.Platform.ClientID,
		Updating:              false,
		IsDesktopSidecar:      h.App.IsDesktopSidecar,
		FeatureFlags:          h.App.FeatureFlags,
		ServerReady:           h.App.ServerReady,
		ServerHasPassword:     h.App.Config.Server.Password != "",
		DisabledFeatures:      h.App.FeatureManager.DisabledFeatures,
		ShowChangelogTour:     h.App.ShowTour,
		ServerIPs:             util.GetLocalIPv4Addresses(),
		ServerPort:            h.App.Config.Server.Port,
		Pid:                   os.Getpid(),
	}

	if tmdbDegraded, tmdbReason := tmdb.DegradedState(settings.Library.TmdbApiKey, h.App.Config.Metadata.TMDBApiKey); tmdbDegraded {
		status.TMDBDegraded = true
		status.TMDBDegradedReason = tmdbReason
	}

	isAuthenticated := h.isAuthorized(c)

	if !isAuthenticated {
		// If the user is unauthenticated, return a status with no user data
		status.OS = ""
		status.DataDir = ""
		status.User = user.NewSimulatedUser()
		status.ThemeSettings = nil
		status.MediastreamSettings = nil
		status.Settings = &models.Settings{}
		status.FeatureFlags = core.FeatureFlags{}
	}

	return status
}

// HandleGetStatus ...
//
//	@summary returns the server status.
//	@desc The server status includes app info, auth info and settings.
//	@desc The client uses this to set the UI.
//	@desc It is called on every page load to get the most up-to-date data.
//	@desc It should be called right after updating the settings.
//	@route /api/v1/status [GET]
//	@returns handlers.Status
func (h *Handler) HandleGetStatus(c echo.Context) error {

	status := h.NewStatus(c)

	return h.RespondWithData(c, status)

}

// HandleGetLogContent returns the content of one log file.
//
//	@summary returns the content of a log file.
//	@desc The filename is the wildcard segment of the route (/api/v1/log/{filename}).
//	@route /api/v1/log/{filename} [GET]
//	@returns string
func (h *Handler) HandleGetLogContent(c echo.Context) error {
	if h.App.Config == nil || h.App.Config.Logs.Dir == "" {
		return h.RespondWithData(c, "")
	}

	filename := c.Param("*")

	fp, err := util.SafeJoinPath(h.App.Config.Logs.Dir, filename)
	if err != nil {
		h.App.Logger.Error().Err(err).Msg("handlers: Invalid log filename")
		return h.RespondWithError(c, fmt.Errorf("invalid filename"))
	}
	if filepath.Ext(fp) != ".log" {
		h.App.Logger.Error().Msg("handlers: Unsupported file extension")
		return h.RespondWithError(c, fmt.Errorf("unsupported file extension"))
	}

	if _, err := os.Stat(fp); err != nil {
		h.App.Logger.Error().Err(err).Msg("handlers: Stat error")
		return h.RespondWithError(c, err)
	}

	contentB, err := os.ReadFile(fp)
	if err != nil {
		h.App.Logger.Error().Err(err).Msg("handlers: Failed to read log file")
		return h.RespondWithError(c, err)
	}

	content := string(contentB)

	return h.RespondWithData(c, content)
}


// HandleGetLogFilenames lists the log files, newest first.
//
//	@summary returns the log filenames.
//	@route /api/v1/logs/filenames [GET]
//	@returns []string
func (h *Handler) HandleGetLogFilenames(c echo.Context) error {
	if h.App.Config == nil || h.App.Config.Logs.Dir == "" {
		return h.RespondWithData(c, []string{})
	}

	var filenames []string
	filepath.WalkDir(h.App.Config.Logs.Dir, func(path string, d fs.DirEntry, err error) error {
		if err != nil || d == nil || d.IsDir() || filepath.Ext(path) != ".log" {
			return nil
		}
		filenames = append(filenames, filepath.Base(path))
		return nil
	})

	if len(filenames) > 0 {
		slices.SortStableFunc(filenames, func(i, j string) int { return strings.Compare(j, i) })
	}

	return h.RespondWithData(c, filenames)
}

// HandleDeleteLogs deletes the given log files.
//
//	@summary deletes log files.
//	@route /api/v1/logs [DELETE]
//	@returns bool
func (h *Handler) HandleDeleteLogs(c echo.Context) error {
	type body struct {
		Filenames []string `json:"filenames"`
	}

	if h.App.Config == nil || h.App.Config.Logs.Dir == "" {
		return h.RespondWithData(c, false)
	}

	var b body
	if err := c.Bind(&b); err != nil {
		return h.RespondWithError(c, err)
	}

	actualNewest := ""
	var allLogs []string
	filepath.WalkDir(h.App.Config.Logs.Dir, func(path string, d fs.DirEntry, err error) error {
		if err != nil || d.IsDir() || filepath.Ext(path) != ".log" {
			return nil
		}
		if strings.HasPrefix(strings.ToLower(d.Name()), "kamehouse-") {
			allLogs = append(allLogs, d.Name())
		}
		return nil
	})
	if len(allLogs) > 0 {
		slices.SortStableFunc(allLogs, func(i, j string) int { return strings.Compare(j, i) })
		actualNewest = allLogs[0]
	}

	err := filepath.WalkDir(h.App.Config.Logs.Dir, func(path string, d fs.DirEntry, err error) error {
		if err != nil || d == nil || d.IsDir() || filepath.Ext(path) != ".log" {
			return nil
		}
		for _, filename := range b.Filenames {
			if util.NormalizePath(filepath.Base(path)) == util.NormalizePath(filename) {
				if actualNewest != "" && util.NormalizePath(actualNewest) == util.NormalizePath(filename) {
					return fmt.Errorf("invalid request: cannot delete the newest log file")
				}
				if err := os.Remove(path); err != nil {
					return err
				}
			}
		}
		return nil
	})

	if err != nil {
		return h.RespondWithError(c, err)
	}
	return h.RespondWithData(c, true)
}

func (h *Handler) latestServerLogPath() (string, error) {
	if h.App.Config == nil || h.App.Config.Logs.Dir == "" {
		return "", fmt.Errorf("logs dir not configured")
	}
	dirEntries, err := os.ReadDir(h.App.Config.Logs.Dir)
	if err != nil {
		return "", err
	}
	var logFiles []string
	for _, entry := range dirEntries {
		if entry.IsDir() {
			continue
		}
		name := entry.Name()
		if filepath.Ext(name) != ".log" || !strings.HasPrefix(strings.ToLower(name), "kamehouse-") {
			continue
		}
		logFiles = append(logFiles, filepath.Join(h.App.Config.Logs.Dir, name))
	}
	if len(logFiles) == 0 {
		return "", fmt.Errorf("no log files found")
	}
	slices.SortFunc(logFiles, func(a, b string) int { return strings.Compare(filepath.Base(b), filepath.Base(a)) })
	return logFiles[0], nil
}

// HandleGetLatestLogContent flushes the logger and returns the latest server log.
//
//	@summary returns the content of the latest server log.
//	@route /api/v1/logs/latest [GET]
//	@returns string
func (h *Handler) HandleGetLatestLogContent(c echo.Context) error {
	if h.App.OnFlushLogs != nil {
		h.App.OnFlushLogs()
		time.Sleep(100 * time.Millisecond)
	}
	logPath, err := h.latestServerLogPath()
	if err != nil {
		if err.Error() == "logs dir not configured" || err.Error() == "no log files found" {
			return h.RespondWithData(c, "")
		}
		return h.RespondWithError(c, err)
	}
	contentB, err := os.ReadFile(logPath)
	if err != nil {
		return h.RespondWithError(c, err)
	}
	return h.RespondWithData(c, string(contentB))
}

func (h *Handler) HandleGetAnnouncements(c echo.Context) error {
	return h.RespondWithCodeError(c, 501, errors.New("announcements not implemented"))
}

type MemoryStatsResponse struct {
	Alloc         uint64  `json:"alloc"`
	TotalAlloc    uint64  `json:"totalAlloc"`
	Sys           uint64  `json:"sys"`
	HeapAlloc     uint64  `json:"heapAlloc"`
	HeapSys       uint64  `json:"heapSys"`
	HeapIdle      uint64  `json:"heapIdle"`
	HeapInuse     uint64  `json:"heapInuse"`
	HeapObjects   uint64  `json:"heapObjects"`
	NumGC         uint32  `json:"numGC"`
	GCCPUFraction float64 `json:"gcCPUFraction"`
	NumGoroutine  int     `json:"numGoroutine"`
}

func mapMemStats(m runtime.MemStats) MemoryStatsResponse {
	return MemoryStatsResponse{
		Alloc:         m.Alloc,
		TotalAlloc:    m.TotalAlloc,
		Sys:           m.Sys,
		HeapAlloc:     m.HeapAlloc,
		HeapSys:       m.HeapSys,
		HeapIdle:      m.HeapIdle,
		HeapInuse:     m.HeapInuse,
		HeapObjects:   m.HeapObjects,
		NumGC:         m.NumGC,
		GCCPUFraction: m.GCCPUFraction,
		NumGoroutine:  runtime.NumGoroutine(),
	}
}


// HandleGetMemoryStats ...
//
//	@summary returns current memory statistics.
//	@desc This returns real-time memory usage statistics from the Go runtime.
//	@route /api/v1/memory/stats [GET]
//	@returns handlers.MemoryStatsResponse
func (h *Handler) HandleGetMemoryStats(c echo.Context) error {
	var m runtime.MemStats
	runtime.ReadMemStats(&m)

	response := mapMemStats(m)

	return h.RespondWithData(c, response)
}

// HandleGetMemoryProfile ...
//
//	@summary generates and returns a memory profile.
//	@desc This generates a memory profile that can be analyzed with go tool pprof.
//	@desc Query parameters: heap=true for heap profile, allocs=true for alloc profile.
//	@route /api/v1/memory/profile [GET]
//	@returns nil
func (h *Handler) HandleGetMemoryProfile(c echo.Context) error {
	// Parse query parameters
	heap := c.QueryParam("heap") == "true"
	allocs := c.QueryParam("allocs") == "true"

	// Default to heap profile if no specific type requested
	if !heap && !allocs {
		heap = true
	}

	// Set response headers for file download
	timestamp := time.Now().Format("2006-01-02_15-04-05")
	var filename string
	var profile *pprof.Profile
	var err error

	if heap {
		filename = fmt.Sprintf("KameHouse-heap-profile-%s.pprof", timestamp)
		profile = pprof.Lookup("heap")
	} else if allocs {
		filename = fmt.Sprintf("KameHouse-allocs-profile-%s.pprof", timestamp)
		profile = pprof.Lookup("allocs")
	}

	if profile == nil {
		h.App.Logger.Error().Msg("handlers: Failed to lookup memory profile")
		return h.RespondWithError(c, fmt.Errorf("failed to lookup memory profile"))
	}

	c.Response().Header().Set("Content-Type", "application/octet-stream")
	c.Response().Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s\"", filename))

	// // Force garbage collection before profiling for more accurate results
	// runtime.GC()

	// Write profile to response
	if err = profile.WriteTo(c.Response().Writer, 0); err != nil {
		h.App.Logger.Error().Err(err).Msg("handlers: Failed to write memory profile")
		return h.RespondWithError(c, err)
	}

	return nil
}

// HandleGetGoRoutineProfile ...
//
//	@summary generates and returns a goroutine profile.
//	@desc This generates a goroutine profile showing all running goroutines and their stack traces.
//	@route /api/v1/memory/goroutine [GET]
//	@returns nil
func (h *Handler) HandleGetGoRoutineProfile(c echo.Context) error {
	timestamp := time.Now().Format("2006-01-02_15-04-05")
	filename := fmt.Sprintf("KameHouse-goroutine-profile-%s.pprof", timestamp)

	profile := pprof.Lookup("goroutine")
	if profile == nil {
		h.App.Logger.Error().Msg("handlers: Failed to lookup goroutine profile")
		return h.RespondWithError(c, fmt.Errorf("failed to lookup goroutine profile"))
	}

	c.Response().Header().Set("Content-Type", "application/octet-stream")
	c.Response().Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s\"", filename))

	if err := profile.WriteTo(c.Response().Writer, 0); err != nil {
		h.App.Logger.Error().Err(err).Msg("handlers: Failed to write goroutine profile")
		return h.RespondWithError(c, err)
	}

	return nil
}

// HandleGetCPUProfile ...
//
//	@summary generates and returns a CPU profile.
//	@desc This generates a CPU profile for the specified duration (default 30 seconds).
//	@desc Query parameter: duration=30 for duration in seconds.
//	@desc Concurrency policy: a single profile runs at a time (mutex + 409 on
//	@desc overlap), duration is capped at 60s, and client disconnect aborts early,
//	@desc so load is bounded to one worker plus cheap 409s under hammering.
//	@route /api/v1/memory/cpu [GET]
//	@returns nil
func (h *Handler) HandleGetCPUProfile(c echo.Context) error {
	cpuProfileMu.Lock()
	if cpuProfilingActive {
		cpuProfileMu.Unlock()
		return h.RespondWithCodeError(c, 409, fmt.Errorf("CPU profiling is already in progress"))
	}
	cpuProfilingActive = true
	cpuProfileMu.Unlock()

	defer func() {
		cpuProfileMu.Lock()
		cpuProfilingActive = false
		cpuProfileMu.Unlock()
	}()

	// Parse duration from query parameter (default to 30 seconds, max 60 to
	// avoid holding an HTTP worker for minutes).
	durationStr := c.QueryParam("duration")
	duration := 30 * time.Second
	if durationStr != "" {
		if d, err := strconv.Atoi(durationStr); err == nil && d > 0 && d <= 60 {
			duration = time.Duration(d) * time.Second
		}
	}

	timestamp := time.Now().Format("2006-01-02_15-04-05")
	filename := fmt.Sprintf("KameHouse-cpu-profile-%s.pprof", timestamp)

	c.Response().Header().Set("Content-Type", "application/octet-stream")
	c.Response().Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s\"", filename))

	// Start CPU profiling
	if err := pprof.StartCPUProfile(c.Response().Writer); err != nil {
		h.App.Logger.Error().Err(err).Msg("handlers: Failed to start CPU profile")
		return h.RespondWithError(c, err)
	}

	// Profile for the specified duration, aborting early if the client
	// disconnects instead of blocking the worker until the end.
	h.App.Logger.Info().Msgf("handlers: Starting CPU profile for %v", duration)
	deadline := time.Now().Add(duration)
	ticker := time.NewTicker(time.Second)
	defer ticker.Stop()
	for time.Now().Before(deadline) {
		select {
		case <-c.Request().Context().Done():
			pprof.StopCPUProfile()
			return nil
		case <-ticker.C:
		}
	}

	// Stop CPU profiling
	pprof.StopCPUProfile()
	h.App.Logger.Info().Msg("handlers: CPU profile completed")

	return nil
}

// HandleForceGC ...
//
//	@summary forces garbage collection and returns memory stats.
//	@desc This forces a garbage collection cycle and returns the updated memory statistics.
//	@route /api/v1/memory/gc [POST]
//	@returns handlers.MemoryStatsResponse
func (h *Handler) HandleForceGC(c echo.Context) error {
	h.App.Logger.Info().Msg("handlers: Forcing garbage collection")

	// Force garbage collection
	runtime.GC()
	runtime.GC() // Run twice to ensure cleanup

	// Get updated memory stats
	var m runtime.MemStats
	runtime.ReadMemStats(&m)

	response := mapMemStats(m)

	h.App.Logger.Info().Msgf("handlers: GC completed, heap size: %d bytes", response.HeapAlloc)

	return h.RespondWithData(c, response)
}

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// HandleGetHomeItems ...
//
//	@summary returns the home items.
//	@route /api/v1/status/home-items [GET]
//	@returns []string
func (h *Handler) HandleGetHomeItems(c echo.Context) error {
	return h.RespondWithCodeError(c, 501, errors.New("home items not implemented"))
}

// HandleUpdateHomeItems ...
//
//	@summary updates the home items.
//	@route /api/v1/status/home-items [POST]
//	@returns nil
func (h *Handler) HandleUpdateHomeItems(c echo.Context) error {
	return h.RespondWithCodeError(c, 501, errors.New("home items not implemented"))
}

// HandleShutdown handles graceful shutdown requests from local clients (e.g. desktop sidecar).
//
//	@summary gracefully shuts down the server.
//	@route /api/v1/shutdown [POST]
//	@returns status message
func (h *Handler) HandleShutdown(c echo.Context) error {
	remoteHost, _, err := net.SplitHostPort(c.Request().RemoteAddr)
	if err != nil {
		remoteHost = c.Request().RemoteAddr
	}
	if remoteHost != "127.0.0.1" && remoteHost != "::1" && remoteHost != "localhost" && remoteHost != "" {
		return h.RespondWithCodeError(c, http.StatusForbidden, fmt.Errorf("shutdown only allowed from loopback"))
	}

	h.App.Logger.Info().Msg("handlers: graceful shutdown requested via /api/v1/shutdown")
	if h.App.WSEventManager != nil {
		go func() {
			defer func() {
				if r := recover(); r != nil {
					h.App.Logger.Error().Interface("panic", r).Msg("status: panic during trigger shutdown")
				}
			}()
			time.Sleep(50 * time.Millisecond) // allow HTTP 200 response to flush
			h.App.WSEventManager.TriggerShutdown()
		}()
	}

	return h.RespondWithData(c, map[string]string{"status": "shutting_down"})
}

