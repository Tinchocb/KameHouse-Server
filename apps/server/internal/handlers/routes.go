package handlers

import (
	"kamehouse/internal/core"
	util "kamehouse/internal/util/proxies"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
	"github.com/rs/zerolog"
	"github.com/ziflex/lecho/v3"
)

type Handler struct {
	App *core.App
}

func InitRoutes(app *core.App, e *echo.Echo) {
	allowedOriginsStr := os.Getenv("KAMEHOUSE_CORS_ALLOWED_ORIGINS")
	var allowedOrigins []string
	if allowedOriginsStr != "" {
		for _, o := range strings.Split(allowedOriginsStr, ",") {
			allowedOrigins = append(allowedOrigins, strings.TrimSpace(o))
		}
	} else if devOrigins := os.Getenv("KAMEHOUSE_DEV_CORS_ORIGINS"); devOrigins != "" {
		for _, o := range strings.Split(devOrigins, ",") {
			allowedOrigins = append(allowedOrigins, strings.TrimSpace(o))
		}
	} else if os.Getenv("KAMEHOUSE_ENV") != "production" {
		// Development defaults: allow the frontend dev server on port 43210
		allowedOrigins = []string{
			"http://localhost:43210",
			"http://127.0.0.1:43210",
			"http://localhost",
			"http://127.0.0.1",
		}
	} else {
		allowedOrigins = []string{"http://localhost", "http://127.0.0.1"}
	}

	// CORS — includes byte-range headers required by the web video player
	e.Use(middleware.CORSWithConfig(middleware.CORSConfig{
		AllowOrigins: allowedOrigins,
		AllowMethods: []string{http.MethodGet, http.MethodPost, http.MethodPut, http.MethodPatch, http.MethodDelete, http.MethodOptions, http.MethodHead},
		AllowHeaders: []string{
			"Origin", "Content-Type", "Accept", "Cookie", "Authorization",
			// Byte-range streaming — without these the browser cannot seek in video
			"Range", "Accept-Ranges", "Content-Range", "If-Range",
			// App-specific auth headers
			"X-KameHouse-Token",
		},
		// ExposeHeaders lets the browser READ these headers from streaming responses
		ExposeHeaders: []string{
			"Accept-Ranges", "Content-Range", "Content-Length", "Content-Disposition",
		},
		AllowCredentials: true,
	}))

	// Delegate to the canonical error handler defined in response.go.
	e.HTTPErrorHandler = CustomHTTPErrorHandler

	lechoLogger := lecho.From(*app.Logger)

	urisToSkip := []string{
		"/internal/metrics",
		"/icons",
		"/events",
		"/api/v1/image-proxy",
		"/api/v1/mediastream/transcode/",
		"/api/v1/proxy",
	}

	// Logging middleware
	e.Use(lecho.Middleware(lecho.Config{
		Logger: lechoLogger,
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
		Enricher: func(c echo.Context, logger zerolog.Context) zerolog.Context {
			// Add which file the request came from
			return logger.Str("file", c.Path())
		},
	}))

	// Recovery middleware
	e.Use(middleware.Recover())

	// Client ID middleware
	e.Use(func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			// Check if the client has a UUID cookie
			cookie, err := c.Cookie("KameHouse-Client-Id")

			if err != nil || cookie.Value == "" {
				// Generate a new UUID for the client
				u := uuid.New().String()

				// Create a cookie with the UUID
				newCookie := new(http.Cookie)
				newCookie.Name = "KameHouse-Client-Id"
				newCookie.Value = u
				newCookie.HttpOnly = false // Make the cookie accessible via JS
				newCookie.Expires = time.Now().Add(24 * time.Hour)
				newCookie.Path = "/"
				newCookie.Domain = ""
				newCookie.SameSite = http.SameSiteDefaultMode
				newCookie.Secure = c.Scheme() == "https" || c.Request().Header.Get("X-Forwarded-Proto") == "https"

				// Set the cookie
				c.SetCookie(newCookie)

				// Store the UUID in the context for use in the request
				c.Set("KameHouse-Client-Id", u)
			} else {
				// Store the existing UUID in the context for use in the request
				c.Set("KameHouse-Client-Id", cookie.Value)
			}

			return next(c)
		}
	})

	e.Use(headMethodMiddleware)

	h := &Handler{
		App: app,
	}

	v1 := e.Group("/api/v1")
	v1.GET("/events", h.webSocketEventHandler)
	v1.GET("/ws", h.webSocketEventHandler) // alias consumed by the web/native clients

	// Auth and feature middleware
	v1.Use(h.OptionalAuthMiddleware)
	v1.Use(h.FeaturesMiddleware)

	// Shared routes
	imageProxy := &util.ImageProxy{}
	v1.GET("/image-proxy", imageProxy.ProxyImage)
	v1.GET("/proxy", h.VideoProxy)
	v1.HEAD("/proxy", h.VideoProxy)
	v1.GET("/status", h.HandleGetStatus)
	v1.GET("/status/home-items", h.HandleGetHomeItems)
	v1.POST("/status/home-items", h.HandleUpdateHomeItems)
	v1.GET("/home/curated", h.HandleGetHomeCurated)
	v1.GET("/home/continue-watching", h.HandleGetContinueWatching)
	// Unified stream resolver (Local only)
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
	v1.POST("/announcements", h.HandleGetAnnouncements)
	v1.POST("/directory-selector", h.HandleDirectorySelector)
	v1.POST("/open-in-explorer", h.HandleOpenInExplorer)

	// Domain-specific routes
	h.RegisterLibraryRoutes(v1)
	h.RegisterStreamingRoutes(v1)
	h.RegisterSettingsRoutes(v1)
	h.RegisterLocalRoutes(v1)
}


func (h *Handler) JSON(c echo.Context, code int, i interface{}) error {
	return c.JSON(code, i)
}

func (h *Handler) RespondWithData(c echo.Context, data interface{}) error {
	return c.JSON(200, NewDataResponse(data))
}

func (h *Handler) RespondWithError(c echo.Context, err error) error {
	return c.JSON(500, NewErrorResponse(err))
}

func (h *Handler) RespondWithCodeError(c echo.Context, code int, err error) error {
	return c.JSON(code, NewErrorResponse(err))
}

func headMethodMiddleware(next echo.HandlerFunc) echo.HandlerFunc {
	return func(c echo.Context) error {


		if c.Request().Method == http.MethodHead {
			// Set the method to GET temporarily to reuse the handler
			c.Request().Method = http.MethodGet

			defer func() {
				c.Request().Method = http.MethodHead
			}() // Restore method after

			// Call the next handler and then clear the response body
			if err := next(c); err != nil {
				if err.Error() == echo.ErrMethodNotAllowed.Error() {
					return c.NoContent(http.StatusOK)
				}

				return err
			}
			
			return nil
		}

		return next(c)
	}
}

