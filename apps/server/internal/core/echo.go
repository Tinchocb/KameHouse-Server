package core

import (
	"embed"
	"io/fs"
	"kamehouse/internal/constants"
	"log"
	"net/http"
	"strings"

	"github.com/goccy/go-json"
	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
)

func NewEchoApp(app *App, webFS *embed.FS) *echo.Echo {
	e := echo.New()
	e.HideBanner = true
	e.HidePort = true
	e.Debug = false
	e.JSONSerializer = &CustomJSONSerializer{}
	e.StdLogger = log.Default()

	// Set long-lived Cache-Control headers for static web assets
	e.Use(func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			path := c.Request().URL.Path
			if strings.HasPrefix(path, "/assets/") || strings.HasPrefix(path, "/offline-assets/") || strings.HasPrefix(path, "/static/") {
				c.Response().Header().Set("Cache-Control", "public, max-age=31536000, immutable")
			}
			return next(c)
		}
	})

	// NOTE: Recover(), CORS and Gzip middleware are registered in handlers.InitRoutes
	// to avoid duplication and ensure the most complete config is used.


	distFS, err := fs.Sub(webFS, "web")
	if err != nil {
		app.Logger.Fatal().Err(err).Msg("app: Failed to extract embedded web filesystem")
	}

	if app.Config.Server.TLS.Enabled {
		app.Logger.Debug().Msg("app: TLS is enabled, adding security middleware")
		e.Use(middleware.Secure())
	}

	e.Use(middleware.StaticWithConfig(middleware.StaticConfig{
		Filesystem: http.FS(distFS),
		Browse:     !constants.IsRspackFrontend,
		HTML5:      true,
		Skipper: func(c echo.Context) bool {
			cURL := c.Request().URL
			if strings.HasPrefix(cURL.RequestURI(), "/api") ||
				strings.HasPrefix(cURL.RequestURI(), "/events") ||
				strings.HasPrefix(cURL.RequestURI(), "/assets") ||
				strings.HasPrefix(cURL.RequestURI(), "/offline-assets") {
				return true
			}
			cleanPath := strings.TrimPrefix(cURL.Path, "/")
			if cleanPath != "" {
				if f, err := distFS.Open(cleanPath); err == nil {
					f.Close()
					return false
				}
			}
			if !strings.HasSuffix(cURL.Path, ".html") {
				cURL.Path = "/index.html"
			}
			return false
		},
	}))

	app.Logger.Info().Msgf("app: Serving embedded web interface")

	// Serve web assets
	app.Logger.Info().Msgf("app: Web assets path: %s", app.Config.Web.AssetDir)
	e.Static("/assets", app.Config.Web.AssetDir)


	// Serve offline assets
	app.Logger.Info().Msgf("app: Offline assets path: %s", app.Config.Offline.AssetDir)
	e.Static("/offline-assets", app.Config.Offline.AssetDir)

	return e
}

type CustomJSONSerializer struct{}

func (j *CustomJSONSerializer) Serialize(c echo.Context, i interface{}, indent string) error {
	enc := json.NewEncoder(c.Response())
	return enc.Encode(i)
}

func (j *CustomJSONSerializer) Deserialize(c echo.Context, i interface{}) error {
	dec := json.NewDecoder(c.Request().Body)
	return dec.Decode(i)
}
