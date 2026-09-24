package handlers

import (
	"github.com/labstack/echo/v4"
)

// HandleLogin is a no-op kept for route compatibility: this fork has no
// platform accounts and auth is handled by middleware (loopback/token).
// It returns the current status so old clients don't break.
//
//	@summary returns the current status (login is a no-op without platform accounts).
//	@desc This is called when the JWT token is obtained after logging in with redirection on the client.
//	@route /api/v1/auth/login [POST]
//	@returns handlers.Status
func (h *Handler) HandleLogin(c echo.Context) error {
	// Platform logic removed
	h.App.Logger.Info().Msg("app: Login handler called (Platform removed)")

	status := h.NewStatus(c)

	// Return new status
	return h.RespondWithData(c, status)
}

// HandleLogout is a no-op kept for route compatibility (see HandleLogin).
// It returns the current status so old clients don't break.
//
//	@summary returns the current status (logout is a no-op without platform accounts).
//	@route /api/v1/auth/logout [POST]
//	@returns handlers.Status
func (h *Handler) HandleLogout(c echo.Context) error {
	// Platform logic removed
	h.App.Logger.Info().Msg("Logged out (Platform removed)")

	status := h.NewStatus(c)

	return h.RespondWithData(c, status)
}
