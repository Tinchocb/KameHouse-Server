package handlers

import (
	"kamehouse/internal/util"
	"github.com/labstack/echo/v4"
)

// HandleLogin
//
//	@summary logs in the user by saving the JWT token in the database.
//	@desc This is called when the JWT token is obtained after logging in with redirection on the client.
//	@route /api/v1/auth/login [POST]
//	@returns handlers.Status
func (h *Handler) HandleLogin(c echo.Context) error {
	type body struct {
		Token string `json:"token"`
	}

	var b body
	if err := c.Bind(&b); err != nil {
		return h.RespondWithError(c, err)
	}

	// Platform logic removed
	h.App.Logger.Info().Msg("app: Login handler called (Platform removed)")

	// Create a new status
	status := h.NewStatus(c)

	h.App.InitOrRefreshModules()

	go func() {
		defer util.HandlePanicThen(func() {})
		h.App.InitOrRefreshTorrentstreamSettings()
		h.App.InitOrRefreshMediastreamSettings()
	}()

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

	h.App.InitOrRefreshModules()

	return h.RespondWithData(c, status)
}
