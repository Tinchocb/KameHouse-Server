package handlers

import (
	"net/http"
	"strings"
	"time"

	"github.com/labstack/echo/v4"
)

// Sessions cover long films and native HLS clients which cannot refresh headers.
// Password changes invalidate these signatures through the existing HMAC secret.
const playbackSessionTTL = 12 * time.Hour
const apiSessionPurpose = "api-session"

func (h *Handler) isAPISessionToken(token string) bool {
	claims, err := h.App.GetServerPasswordHMACAuth().ValidateToken(token, apiSessionPurpose)
	return err == nil && claims.Endpoint == apiSessionPurpose
}

// HandleAuthSession exchanges an authenticated request for bounded credentials.
// The route uses OptionalAuthMiddleware, including its failed-attempt budget.
func (h *Handler) HandleAuthSession(c echo.Context) error {
	c.Response().Header().Set("Cache-Control", "no-store")
	if h.App.Config == nil || h.App.Config.Server.Password == "" {
		return h.RespondWithData(c, map[string]interface{}{"required": false})
	}
	auth := h.App.GetServerPasswordHMACAuth()
	// The API session honors server.authTokenTTL; playback has its own bounded
	// lifetime so a short API TTL cannot interrupt native HLS midway through a film.
	session, err := auth.GenerateToken(apiSessionPurpose)
	if err != nil {
		return h.RespondWithError(c, err)
	}
	stream, err := auth.GenerateTokenWithTTL("*", playbackSessionTTL)
	if err != nil {
		return h.RespondWithError(c, err)
	}
	claims, err := auth.ValidateToken(session, apiSessionPurpose)
	if err != nil {
		return h.RespondWithError(c, err)
	}
	return h.RespondWithData(c, map[string]interface{}{
		"required": true, "sessionToken": session, "streamToken": stream,
		"expiresAt": claims.ExpiresAt,
	})
}

func (h *Handler) RegisterAuthRoutes(v1 *echo.Group) {
	v1.GET("/auth/session", h.HandleAuthSession)
}

// sessionWSRequest excludes query parameters: full API sessions must never be
// accepted from URLs, histories or Referer headers.
func (h *Handler) sessionWSRequest(r *http.Request, token string) bool {
	fromHeader := r.Header.Get("Authorization") == "Bearer "+token
	for _, proto := range strings.Split(r.Header.Get("Sec-WebSocket-Protocol"), ",") {
		if strings.TrimSpace(proto) == "kamehouse.token."+token {
			fromHeader = true
		}
	}
	return fromHeader && h.isAPISessionToken(token)
}
