package handlers

import (
	"kamehouse/internal/core"

	"github.com/labstack/echo/v4"
)

type WebhookHandler struct {
	App *core.App
}

func NewWebhookHandler(app *core.App) *WebhookHandler {
	return &WebhookHandler{App: app}
}

type JellyfinWebhookPayload struct {
	NotificationType string `json:"NotificationType"`
	ItemName         string `json:"ItemName"`
	ItemId           string `json:"ItemId"`
	User             string `json:"User"`
	Message          string `json:"Message"`
	Overview         string `json:"Overview"`
	Timestamp        string `json:"Timestamp"`
	Server           string `json:"Server"`
}

func (h *WebhookHandler) HandleJellyfinWebhook(c echo.Context) error {
	var payload JellyfinWebhookPayload
	if err := c.Bind(&payload); err != nil {
		return echo.NewHTTPError(400, "Invalid webhook payload")
	}

	switch payload.NotificationType {
	case "ItemAdded":
		return h.handleItemAdded(c, payload)
	case "ItemDeleted":
		return h.handleItemDeleted(c, payload)
	case "LibraryScanComplete":
		return h.handleLibraryScanComplete(c, payload)
	case "LibraryUpdated":
		return h.handleLibraryUpdated(c, payload)
	case "PlaybackStop":
		return h.handlePlaybackStop(c, payload)
	default:
		return c.JSON(200, map[string]string{
			"status": "ignored",
			"type":   payload.NotificationType,
		})
	}
}

func (h *WebhookHandler) handleItemAdded(c echo.Context, payload JellyfinWebhookPayload) error {
	c.Logger().Info("jellyfin-webhook: New item added - %s (ID: %s)", payload.ItemName, payload.ItemId)

	if h.App != nil && h.App.AutoScanner != nil {
		h.App.Logger.Info().Str("item", payload.ItemName).Msg("jellyfin-webhook: Triggering auto scan")
		go h.App.AutoScanner.RunNow()
	}

	return c.JSON(200, map[string]string{
		"status":   "processed",
		"action":   "item_added",
		"itemName": payload.ItemName,
		"itemId":   payload.ItemId,
	})
}

func (h *WebhookHandler) handleItemDeleted(c echo.Context, payload JellyfinWebhookPayload) error {
	c.Logger().Info("jellyfin-webhook: Item deleted - %s (ID: %s)", payload.ItemName, payload.ItemId)

	return c.JSON(200, map[string]string{
		"status":   "processed",
		"action":   "item_deleted",
		"itemName": payload.ItemName,
		"itemId":   payload.ItemId,
	})
}

func (h *WebhookHandler) handleLibraryScanComplete(c echo.Context, payload JellyfinWebhookPayload) error {
	c.Logger().Info("jellyfin-webhook: Library scan completed")

	return c.JSON(200, map[string]string{
		"status": "processed",
		"action": "scan_complete",
	})
}

func (h *WebhookHandler) handleLibraryUpdated(c echo.Context, payload JellyfinWebhookPayload) error {
	c.Logger().Info("jellyfin-webhook: Library updated")

	return c.JSON(200, map[string]string{
		"status": "processed",
		"action": "library_updated",
	})
}

func (h *WebhookHandler) handlePlaybackStop(c echo.Context, payload JellyfinWebhookPayload) error {
	c.Logger().Info("jellyfin-webhook: Playback stopped - %s (ID: %s)", payload.ItemName, payload.ItemId)

	// Nota: El tracking delegado (AniList) fue desactivado a petición del usuario.
	// Si requieres que la BD local actúe sobre este progreso en el futuro, la invocación de
	// la API de la BD iría aquí.

	return c.JSON(200, map[string]string{
		"status":   "processed",
		"action":   "playback_stopped",
		"itemName": payload.ItemName,
		"itemId":   payload.ItemId,
	})
}
