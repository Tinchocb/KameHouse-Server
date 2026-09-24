package core

import (
	"embed"
	"io/fs"
	"log"
	"net/http"
	"strings"

	"github.com/goccy/go-json"
	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
	"github.com/valyala/bytebufferpool"
)

func NewEchoApp(app *App, webFS *embed.FS) *echo.Echo {
	e := echo.New()
	e.HideBanner = true
	e.HidePort = true
	e.Debug = false
	e.JSONSerializer = &CustomJSONSerializer{}
	// Errores internos de net/http (TLS, conexiones rotas…) al log de la app,
	// para que lleguen a los archivos de log y al informe de diagnóstico.
	e.StdLogger = log.New(app.Logger.With().Str("module", "http").Logger(), "", 0)

	// Set Cache-Control headers: immutable for fingerprinted assets, no-cache for entrypoints (index.html, sw.js)
	e.Use(func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			path := c.Request().URL.Path
			if strings.HasPrefix(path, "/assets/") || strings.HasPrefix(path, "/offline-assets/") || strings.HasPrefix(path, "/static/") {
				c.Response().Header().Set("Cache-Control", "public, max-age=31536000, immutable")
			} else if path == "/" || path == "/index.html" || path == "/sw.js" || path == "/manifest.json" || strings.HasSuffix(path, ".html") {
				c.Response().Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
				c.Response().Header().Set("Pragma", "no-cache")
				c.Response().Header().Set("Expires", "0")
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
		Browse:     false,
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
	buf := bytebufferpool.Get()
	defer bytebufferpool.Put(buf)

	if err := json.NewEncoder(buf).Encode(i); err != nil {
		return err
	}

	c.Response().Header().Set(echo.HeaderContentType, echo.MIMEApplicationJSONCharsetUTF8)
	_, err := c.Response().Write(buf.Bytes())
	return err
}

func (j *CustomJSONSerializer) Deserialize(c echo.Context, i interface{}) error {
	// Limit request body to 15 MB to prevent OOM denial of service
	const maxBodyBytes = 15 * 1024 * 1024
	c.Request().Body = http.MaxBytesReader(c.Response().Writer, c.Request().Body, maxBodyBytes)
	dec := json.NewDecoder(c.Request().Body)
	return dec.Decode(i)
}
