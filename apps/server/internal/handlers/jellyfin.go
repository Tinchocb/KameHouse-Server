package handlers

import (
	"kamehouse/internal/database/db"
	"kamehouse/internal/jellyfin"

	"github.com/labstack/echo/v4"
	"github.com/rs/zerolog"
)

type JellyfinHandler struct {
	Database *db.Database
	Logger   *zerolog.Logger
}

func NewJellyfinHandler(database *db.Database, logger *zerolog.Logger) *JellyfinHandler {
	return &JellyfinHandler{
		Database: database,
		Logger:   logger,
	}
}

type AddLibraryRequest struct {
	Name           string   `json:"name"`
	CollectionType string   `json:"collectionType"`
	Paths          []string `json:"paths"`
	RefreshLibrary bool     `json:"refreshLibrary"`
}

type SearchRequest struct {
	Query string `json:"query"`
	Limit int    `json:"limit"`
}

type AuthRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

// getClient builds a Jellyfin client dynamically from the DB settings.
// This ensures we always use the latest settings saved through the UI.
func (h *JellyfinHandler) getClient() (*jellyfin.Client, error) {
	settings, err := h.Database.GetSettings()
	if err != nil {
		return nil, echo.NewHTTPError(500, "Failed to retrieve settings: "+err.Error())
	}

	if settings.Jellyfin == nil || !settings.Jellyfin.Enabled {
		return nil, echo.NewHTTPError(400, "Jellyfin is not enabled. Please configure it in Settings.")
	}

	if settings.Jellyfin.ServerURL == "" {
		return nil, echo.NewHTTPError(400, "Jellyfin server URL is not configured.")
	}

	if settings.Jellyfin.ApiKey == "" {
		return nil, echo.NewHTTPError(400, "Jellyfin API key is not configured.")
	}

	client := jellyfin.NewClient(settings.Jellyfin.ServerURL, settings.Jellyfin.ApiKey, settings.Jellyfin.Username, h.Logger)
	return client, nil
}

func (h *JellyfinHandler) HandleGetVirtualFolders(c echo.Context) error {
	client, err := h.getClient()
	if err != nil {
		return err
	}

	folders, err := client.GetVirtualFolders(c.Request().Context())
	if err != nil {
		return echo.NewHTTPError(500, err.Error())
	}

	return c.JSON(200, NewDataResponse(folders))
}

func (h *JellyfinHandler) HandleAddVirtualFolder(c echo.Context) error {
	client, err := h.getClient()
	if err != nil {
		return err
	}

	var req AddLibraryRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(400, "Invalid request body")
	}

	if req.Name == "" {
		return echo.NewHTTPError(400, "Library name is required")
	}

	if req.CollectionType == "" {
		req.CollectionType = "tvshows"
	}

	addReq := jellyfin.AddVirtualFolderRequest{
		Name:           req.Name,
		CollectionType: req.CollectionType,
		Paths:          req.Paths,
		RefreshLibrary: req.RefreshLibrary,
	}

	if err := client.AddVirtualFolder(c.Request().Context(), addReq); err != nil {
		return echo.NewHTTPError(500, err.Error())
	}

	return c.JSON(200, NewDataResponse(map[string]string{
		"message": "Library added successfully",
		"name":    req.Name,
	}))
}

func (h *JellyfinHandler) HandleRemoveVirtualFolder(c echo.Context) error {
	client, err := h.getClient()
	if err != nil {
		return err
	}

	name := c.Param("name")
	if name == "" {
		return echo.NewHTTPError(400, "Library name is required")
	}

	if err := client.RemoveVirtualFolder(c.Request().Context(), name); err != nil {
		return echo.NewHTTPError(500, err.Error())
	}

	return c.JSON(200, NewDataResponse(map[string]string{
		"message": "Library removed successfully",
		"name":    name,
	}))
}

func (h *JellyfinHandler) HandleRefreshLibrary(c echo.Context) error {
	client, err := h.getClient()
	if err != nil {
		return err
	}

	if err := client.RefreshLibrary(c.Request().Context()); err != nil {
		return echo.NewHTTPError(500, err.Error())
	}

	return c.JSON(200, NewDataResponse(map[string]string{
		"message": "Library refresh triggered",
	}))
}

func (h *JellyfinHandler) HandleSearchItems(c echo.Context) error {
	client, err := h.getClient()
	if err != nil {
		return err
	}

	var req SearchRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(400, "Invalid request body")
	}

	if req.Query == "" {
		return echo.NewHTTPError(400, "Search query is required")
	}

	if req.Limit == 0 {
		req.Limit = 20
	}

	items, err := client.SearchItems(c.Request().Context(), req.Query, req.Limit)
	if err != nil {
		return echo.NewHTTPError(500, err.Error())
	}

	return c.JSON(200, NewDataResponse(items))
}

func (h *JellyfinHandler) HandleGetItem(c echo.Context) error {
	client, err := h.getClient()
	if err != nil {
		return err
	}

	itemID := c.Param("id")
	if itemID == "" {
		return echo.NewHTTPError(400, "Item ID is required")
	}

	item, err := client.GetItem(c.Request().Context(), itemID)
	if err != nil {
		return echo.NewHTTPError(500, err.Error())
	}

	return c.JSON(200, NewDataResponse(item))
}

func (h *JellyfinHandler) HandleAuthenticate(c echo.Context) error {
	// For auth, we need at least a server URL but not necessarily an API key
	settings, err := h.Database.GetSettings()
	if err != nil {
		return echo.NewHTTPError(500, "Failed to retrieve settings: "+err.Error())
	}

	if settings.Jellyfin == nil || settings.Jellyfin.ServerURL == "" {
		return echo.NewHTTPError(400, "Jellyfin server URL is not configured.")
	}

	client := jellyfin.NewClient(settings.Jellyfin.ServerURL, settings.Jellyfin.ApiKey, settings.Jellyfin.Username, h.Logger)

	var req AuthRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(400, "Invalid request body")
	}

	if req.Username == "" || req.Password == "" {
		return echo.NewHTTPError(400, "Username and password are required")
	}

	resp, err := client.AuthenticateByName(c.Request().Context(), req.Username, req.Password)
	if err != nil {
		return echo.NewHTTPError(401, err.Error())
	}

	return c.JSON(200, NewDataResponse(map[string]string{
		"accessToken": resp.AccessToken,
		"userId":      resp.User.ID,
		"username":    resp.User.Username,
	}))
}

func (h *JellyfinHandler) HandleCreateAPIKey(c echo.Context) error {
	client, err := h.getClient()
	if err != nil {
		return err
	}

	type CreateKeyRequest struct {
		Name string `json:"name"`
	}

	var req CreateKeyRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(400, "Invalid request body")
	}

	if req.Name == "" {
		req.Name = "kamehouse"
	}

	apiKey, err := client.CreateAPIKey(c.Request().Context(), req.Name)
	if err != nil {
		return echo.NewHTTPError(500, err.Error())
	}

	return c.JSON(200, NewDataResponse(map[string]string{
		"apiKey": apiKey,
	}))
}
