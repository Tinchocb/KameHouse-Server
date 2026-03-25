package handlers

import (
	"github.com/labstack/echo/v4"
)

// HandleLogin
//
//	@summary logs in the user by saving the JWT token in the database.
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

// HandleLogout
//
//	@summary logs out the user by removing JWT token from the database.
//	@route /api/v1/auth/logout [POST]
//	@returns handlers.Status
func (h *Handler) HandleLogout(c echo.Context) error {
	// Platform logic removed
	h.App.Logger.Info().Msg("Logged out (Platform removed)")

	status := h.NewStatus(c)

	return h.RespondWithData(c, status)
}
