package handlers

import (
	"errors"
	"strings"

	"github.com/labstack/echo/v4"
)

func (h *Handler) OptionalAuthMiddleware(next echo.HandlerFunc) echo.HandlerFunc {
	return func(c echo.Context) error {
		if h.App.Config.Server.Password == "" {
			return next(c)
		}

		path := c.Request().URL.Path
		passwordHash := c.Request().Header.Get("X-KameHouse-Token")

		// Allow the following paths to be accessed by anyone
		if path == "/api/v1/auth/login" || // for auth
			path == "/api/v1/auth/logout" || // for auth
			path == "/api/v1/status" || // for interface
			path == "/api/v1/events" || // for server events
			path == "/api/v1/ws" || // for server events (alias)
			path == "/api/v1/proxy" || // for remote media images
			strings.HasPrefix(path, "/api/v1/image") || // local covers requests
			strings.HasPrefix(path, "/api/v1/mediastream/transcode/") ||
			strings.HasPrefix(path, "/api/v1/mediastream/subs/") { // used by media players

			if path == "/api/v1/status" {
				// allow status requests by anyone but mark as unauthenticated
				// so we can filter out critical info like settings
				if passwordHash != h.App.ServerPasswordHash {
					c.Set("unauthenticated", true)
				}
			}

			return next(c)
		}

		if passwordHash == h.App.ServerPasswordHash {
			return next(c)
		}

		// Check HMAC token in query parameter
		token := c.Request().URL.Query().Get("token")
		if token != "" {
			hmacAuth := h.App.GetServerPasswordHMACAuth()
			_, err := hmacAuth.ValidateToken(token, path)
			if err == nil {
				return next(c)
			} else {
				h.App.Logger.Debug().Err(err).Str("path", path).Msg("server auth: HMAC token validation failed")
			}
		}

		return h.RespondWithCodeError(c, 401, errors.New("UNAUTHENTICATED"))
	}
}
