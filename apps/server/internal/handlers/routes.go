package handlers

import (
	"errors"
	"net/http"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
	lru "github.com/hashicorp/golang-lru/v2"
	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
	"github.com/rs/zerolog"
	"github.com/ziflex/lecho/v3"
	"golang.org/x/time/rate"
	"kamehouse/internal/api/dragonball"
	"kamehouse/internal/core"
	"kamehouse/internal/database/models"
	"kamehouse/internal/intelligence"
	"kamehouse/internal/library/anime"
	util "kamehouse/internal/util/proxies"
)

func contains(s []string, e string) bool {
	for _, a := range s {
		if a == e {
			return true
		}
	}
	return false
}

var (
	authLimiter    = rate.NewLimiter(10, 20)   // 10 req/s, burst 20
	generalLimiter = rate.NewLimiter(50, 100) // 50 req/s, burst 100

	limiterMu      sync.Mutex
	limitersCache, _ = lru.New[string, *rate.Limiter](1000)
)

func getLimiter(key string, r rate.Limit, b int) *rate.Limiter {
	limiterMu.Lock()
	defer limiterMu.Unlock()
	if limitersCache == nil {
		limitersCache, _ = lru.New[string, *rate.Limiter](1000)
	}
	l, ok := limitersCache.Get(key)
	if !ok {
		l = rate.NewLimiter(r, b)
		limitersCache.Add(key, l)
	}
	return l
}

func rateLimitMiddleware(next echo.HandlerFunc) echo.HandlerFunc {
	return func(c echo.Context) error {
		path := c.Request().URL.Path

		// Skip health endpoint
		if path == "/api/health" {
			return next(c)
		}

		// Skip non-public endpoints (auth endpoints handled by authRateLimitMiddleware)
		if strings.HasPrefix(path, "/api/v1/auth/") {
			return next(c)
		}

		// Public endpoints: /api/v1/status, /api/v1/image-proxy, /api/v1/ws, /api/v1/events
		isPublic := path == "/api/v1/status" ||
			strings.HasPrefix(path, "/api/v1/image-proxy") ||
			path == "/api/v1/ws" ||
			path == "/api/v1/events"

		if !isPublic {
			return next(c)
		}

		// Use client ID or IP as key
		clientID := getClientID(c)
		if clientID == "" {
			clientID = c.RealIP()
		}

		limiter := getLimiter(clientID, 50, 100)
		if !limiter.Allow() {
			c.Response().Header().Set("Retry-After", "1")
			return c.JSON(http.StatusTooManyRequests, map[string]string{"error": "rate limit exceeded"})
		}
		return next(c)
	}
}

func authRateLimitMiddleware(next echo.HandlerFunc) echo.HandlerFunc {
	return func(c echo.Context) error {
		path := c.Request().URL.Path

		// Only apply to auth endpoints
		if !strings.HasPrefix(path, "/api/v1/auth/") {
			return next(c)
		}

		// Use client ID or IP as key
		clientID := getClientID(c)
		if clientID == "" {
			clientID = c.RealIP()
		}

		limiter := getLimiter("auth:"+clientID, 10, 20)
		if !limiter.Allow() {
			c.Response().Header().Set("Retry-After", "1")
			return c.JSON(http.StatusTooManyRequests, map[string]string{"error": "rate limit exceeded"})
		}
		return next(c)
	}
}

func getClientID(c echo.Context) string {
	if v := c.Get("KameHouse-Client-Id"); v != nil {
		if s, ok := v.(string); ok {
			return s
		}
	}
	return ""
}

type Handler struct {
	App                  *core.App
	settingsMu           sync.RWMutex
	settings             *models.Settings
	IntelligenceSelector *intelligence.Selector
}

func InitRoutes(app *core.App, e *echo.Echo) {
	allowedOrigins := app.Config.Server.CorsOrigins

	// CORS — fail-fast if wildcard " *" is present with AllowCredentials
	// (Echo + credentials + "*" = session hijack via reflected origin).
	if contains(allowedOrigins, "*") {
		for _, o := range allowedOrigins {
			if o == "*" {
				app.Logger.Fatal().Msg("CORS: wildcard origin with credentials detected — rejecting to prevent session hijack. Remove '*' from CorsOrigins or disable credentials.")
			}
		}
	}

	// CORS — incluye cabeceras byte-range requeridas por el reproductor web de video
	e.Use(middleware.CORSWithConfig(middleware.CORSConfig{
		AllowOrigins: allowedOrigins,
		AllowMethods: []string{http.MethodGet, http.MethodPost, http.MethodPut, http.MethodPatch, http.MethodDelete, http.MethodOptions, http.MethodHead},
		AllowHeaders: []string{
			"Origin", "Content-Type", "Accept", "Cookie", "Authorization",
			"Range", "Accept-Ranges", "Content-Range", "If-Range",
			"X-KameHouse-Token",
		},
		ExposeHeaders: []string{
			"Accept-Ranges", "Content-Range", "Content-Length", "Content-Disposition",
		},
		AllowCredentials: true,
		Skipper: func(c echo.Context) bool {
			// Skip CORS for health endpoint — handled manually with permissive headers
			return c.Path() == "/api/health"
		},
	}))

	e.Use(rateLimitMiddleware)
	e.Use(authRateLimitMiddleware)

	e.HTTPErrorHandler = CustomHTTPErrorHandler

	e.Use(TraceMiddleware(app.Logger))

	lechoLogger := lecho.From(*app.Logger)

	urisToSkip := []string{
		"/internal/metrics",
		"/icons",
		"/events",
		"/api/v1/image-proxy",
		"/api/v1/mediastream/transcode/",
		"/api/v1/mediastream/direct/play",
		"/api/v1/mediastream/hls/",
		"/api/v1/mediastream/video-thumbnail",
		"/api/v1/proxy",
	}

	e.Use(lecho.Middleware(lecho.Config{
		Logger: lechoLogger,
		Enricher: func(c echo.Context, logger zerolog.Context) zerolog.Context {
			logger = logger.Str("file", c.Path())
			if traceID := GetTraceID(c.Request().Context()); traceID != "" {
				logger = logger.Str("trace_id", traceID)
			}
			return logger
		},
		Skipper: func(c echo.Context) bool {
			path := c.Request().URL.RequestURI()
			if filepath.Ext(c.Request().URL.Path) == ".txt" ||
				filepath.Ext(c.Request().URL.Path) == ".png" ||
				filepath.Ext(c.Request().URL.Path) == ".ico" {
				return true
			}
			for _, uri := range urisToSkip {
				if uri == path || strings.HasPrefix(path, uri) {
					return true
				}
			}
			return false
		},
	}))

	e.Use(middleware.Recover())

	e.Use(middleware.GzipWithConfig(middleware.GzipConfig{
		Level: 5,
		Skipper: func(c echo.Context) bool {
			path := c.Request().URL.Path
			return strings.HasPrefix(path, "/api/v1/mediastream") ||
				strings.HasPrefix(path, "/api/v1/drive/play") ||
				strings.HasPrefix(path, "/api/v1/image-proxy") ||
				strings.HasPrefix(path, "/api/v1/proxy") ||
				strings.HasPrefix(path, "/api/v1/events") ||
				strings.HasPrefix(path, "/api/v1/ws")
		},
	}))

	e.Use(func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			// Vary: Origin siempre que hay CORS con credenciales.
			c.Response().Header().Set("Vary", "Origin")
			cookie, err := c.Cookie("KameHouse-Client-Id")
			clientID := ""
			if err == nil {
				// Validar formato UUID para evitar fijación/enumeración con valores forjados.
				if _, perr := uuid.Parse(strings.TrimSpace(cookie.Value)); perr == nil {
					clientID = cookie.Value
				}
			}
			if clientID == "" {
				u := uuid.New().String()
				newCookie := new(http.Cookie)
				newCookie.Name = "KameHouse-Client-Id"
				newCookie.Value = u
				newCookie.HttpOnly = true // prevent JS access
				newCookie.Expires = time.Now().Add(30 * 24 * time.Hour) // 30 days
				newCookie.Path = "/"
				newCookie.Domain = ""
				newCookie.SameSite = http.SameSiteLaxMode // Lax: sent with top-level navigations, safe for CSRF
				newCookie.Secure = c.Scheme() == "https" || c.Request().Header.Get("X-Forwarded-Proto") == "https" // only over TLS
				c.SetCookie(newCookie)
				c.Set("KameHouse-Client-Id", u)
			} else {
				c.Set("KameHouse-Client-Id", clientID)
			}
			return next(c)
		}
	})

	e.Use(headMethodMiddleware)

	h := &Handler{
		App:                  app,
		IntelligenceSelector: intelligence.NewSelector(app.Database, app.Logger),
	}

	app.AddOnRefreshAnimeCollectionFunc("ClearLibraryCollectionCache", func() {
		ClearLibraryCollectionCache()
	})
	app.AddOnRefreshAnimeCollectionFunc("ClearAnimeScheduleCache", func() {
		ClearAnimeScheduleCache()
	})
	app.AddOnRefreshAnimeCollectionFunc("ClearEpisodeCollectionCache", func() {
		anime.ClearEpisodeCollectionCache()
	})

	h.StartPlaybackHeartbeatSubscriber()

	// Health endpoint (no auth required, open CORS)
	e.GET("/api/health", h.HandleHealth)
	e.OPTIONS("/api/health", h.HandleHealth)

	v1 := e.Group("/api/v1")
	v1.GET("/events", h.webSocketEventHandler)
	v1.GET("/ws", h.webSocketEventHandler)

	v1.Use(h.OptionalAuthMiddleware)
	v1.Use(h.FeaturesMiddleware)

	imageProxy := &util.ImageProxy{
		CacheDir: filepath.Join(app.Config.Cache.Dir, "images"),
	}
	v1.GET("/image-proxy", imageProxy.ProxyImage)
	v1.GET("/proxy", h.VideoProxy)
	v1.HEAD("/proxy", h.VideoProxy)
	v1.GET("/status", h.HandleGetStatus)
	v1.GET("/config/metadata", h.HandleGetConfigMetadata)
	v1.GET("/status/home-items", h.HandleGetHomeItems)
	v1.POST("/status/home-items", h.HandleUpdateHomeItems)
	v1.GET("/home/curated", h.HandleGetHomeCurated)
	v1.GET("/home/continue-watching", h.HandleGetContinueWatching)
	v1.POST("/home/retag", h.HandleRetagEpisodes)
	v1.GET("/resolver/streams", h.HandleResolveStreams)
	v1.GET("/log/*", h.HandleGetLogContent)
	v1.GET("/logs/filenames", h.HandleGetLogFilenames)
	v1.DELETE("/logs", h.HandleDeleteLogs)
	v1.GET("/logs/latest", h.HandleGetLatestLogContent)
	v1.GET("/memory/stats", h.HandleGetMemoryStats)
	v1.GET("/memory/profile", h.HandleGetMemoryProfile)
	v1.GET("/memory/goroutine", h.HandleGetGoRoutineProfile)
	v1.GET("/memory/cpu", h.HandleGetCPUProfile)
	v1.POST("/memory/gc", h.HandleForceGC)
	v1.GET("/system/cache/stats", h.HandleGetCacheStats)
	v1.POST("/system/cache/clear", h.HandleClearSystemCache)
	v1.POST("/cache/thumbnails/warm", h.HandleWarmThumbnailCache)
	v1.POST("/announcements", h.HandleGetAnnouncements)
	v1.GET("/notifications", h.HandleGetNotifications)
	v1.POST("/notifications/read", h.HandleMarkNotificationsRead)
	v1.DELETE("/notifications", h.HandleClearNotifications)
	v1.POST("/directory-selector", h.HandleDirectorySelector)
	v1.POST("/open-in-explorer", h.HandleOpenInExplorer)
	v1.POST("/shutdown", h.HandleShutdown)
	v1.GET("/lore/dragonball", h.HandleGetDragonballLore)
	v1.GET("/music/scan", h.HandleScanBackgroundMusic)
	v1.GET("/music/stream", h.HandleStreamBackgroundMusic)

	h.RegisterLibraryRoutes(v1)
	h.RegisterStreamingRoutes(v1)
	h.RegisterDriveRoutes(v1)
	h.RegisterSettingsRoutes(v1)
	h.RegisterLocalRoutes(v1)
	h.RegisterIntelligenceRoutes(v1)
	h.RegisterAdminRoutes(v1)

	// Enciclopedia de Dragon Ball (arquitectura limpia en internal/api/dragonball).
	dragonball.Register(v1)
}

// RegisterIntelligenceRoutes registra las rutas del motor de selección e inteligencia.
func (h *Handler) RegisterIntelligenceRoutes(v1 *echo.Group) {
	intel := v1.Group("/intelligence")
	intel.GET("/best-source", h.HandleGetBestSource)
	intel.GET("/stats", h.HandleGetIntelligenceStats)
	intel.GET("/chronology", h.HandleGetChronologyTimeline)
	intel.GET("/search", h.HandleSemanticSearch)
}

// RegisterAdminRoutes registra las rutas de administración.
func (h *Handler) RegisterAdminRoutes(v1 *echo.Group) {
	admin := v1.Group("/admin")
	admin.GET("/transcode-stats", h.HandleGetTranscodeStats)
	admin.GET("/library-stats", h.HandleGetLibraryStats)
}

func (h *Handler) JSON(c echo.Context, code int, i interface{}) error {
	return c.JSON(code, i)
}

func (h *Handler) RespondWithData(c echo.Context, data interface{}) error {
	return c.JSON(200, NewDataResponse(data))
}

func (h *Handler) RespondWithError(c echo.Context, err error) error {
	// Mapeo mínimo para no devolver 500 en errores de validación.
	// Los call-sites específicos deben migrar a RespondWithCodeError(400/404/403).
	msg := ""
	if err != nil {
		msg = strings.ToLower(err.Error())
	}
	switch {
	case strings.Contains(msg, "not found") || strings.Contains(msg, "no such") || strings.Contains(msg, "no rows"):
		return c.JSON(404, NewErrorResponse(err))
	case strings.Contains(msg, "invalid") || strings.Contains(msg, "empty") || strings.Contains(msg, "required") ||
		strings.Contains(msg, "bad request") || strings.Contains(msg, "malformed") || strings.Contains(msg, "too large") ||
		strings.Contains(msg, "not allowed") && strings.Contains(msg, "file"):
		return c.JSON(400, NewErrorResponse(err))
	case strings.Contains(msg, "forbidden") || strings.Contains(msg, "not allowed") || strings.Contains(msg, "blocked"):
		return c.JSON(403, NewErrorResponse(err))
	default:
		return c.JSON(500, NewErrorResponse(err))
	}
}

func (h *Handler) RespondWithCodeError(c echo.Context, code int, err error) error {
	return c.JSON(code, NewErrorResponse(err))
}

func (h *Handler) invalidateSettingsCache() {
	h.settingsMu.Lock()
	h.settings = nil
	h.settingsMu.Unlock()
	ClearLibraryCollectionCache()
}

func headMethodMiddleware(next echo.HandlerFunc) echo.HandlerFunc {
	return func(c echo.Context) error {
		if c.Request().Method == http.MethodHead {
			// Execute handler natively first so HEAD handlers or c.File() can respond with headers only
			err := next(c)
			if err != nil && errors.Is(err, echo.ErrMethodNotAllowed) {
				// Fallback to GET handler if HEAD is not explicitly registered on this route
				c.Request().Method = http.MethodGet
				defer func() {
					c.Request().Method = http.MethodHead
				}()
				if getErr := next(c); getErr != nil {
					if errors.Is(getErr, echo.ErrMethodNotAllowed) {
						return c.NoContent(http.StatusOK)
					}
					return getErr
				}
				return nil
			}
			return err
		}
		return next(c)
	}
}
