package handlers

import (
	"kamehouse/internal/database/models"
	"net/http"

	"github.com/labstack/echo/v4"
)

type SaveProgressRequest struct {
	MediaId  int     `json:"mediaId"`
	Status   string  `json:"status"`
	Progress int     `json:"progress"`
	Score    float64 `json:"score"`
}

// HandleGetProgress handles GET /api/v1/progress
func (h *Handler) HandleGetProgress(c echo.Context) error {
	clientIdRaw := c.Get("KameHouse-Client-Id")
	if clientIdRaw == nil {
		return c.JSON(http.StatusUnauthorized, map[string]string{"error": "missing client id"})
	}
	clientId := clientIdRaw.(string)

	var progress []models.UserMediaProgress
	if err := h.App.Database.Gorm().Where("anon_user_id = ?", clientId).Find(&progress).Error; err != nil {
		return h.RespondWithError(c, err)
	}

	return h.RespondWithData(c, progress)
}

// HandleSaveProgress handles POST /api/v1/progress
func (h *Handler) HandleSaveProgress(c echo.Context) error {
	clientIdRaw := c.Get("KameHouse-Client-Id")
	if clientIdRaw == nil {
		return c.JSON(http.StatusUnauthorized, map[string]string{"error": "missing client id"})
	}
	clientId := clientIdRaw.(string)

	var req SaveProgressRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid request body"})
	}

	if req.MediaId == 0 {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "mediaId is required"})
	}

	var progress models.UserMediaProgress
	result := h.App.Database.Gorm().Where("anon_user_id = ? AND media_id = ?", clientId, req.MediaId).First(&progress)

	if result.Error != nil {
		// Create new
		progress = models.UserMediaProgress{
			AnonUserId: clientId,
			MediaId:    req.MediaId,
			Status:     req.Status,
			Progress:   req.Progress,
			Score:      req.Score,
		}
		if err := h.App.Database.Gorm().Create(&progress).Error; err != nil {
			return h.RespondWithError(c, err)
		}
	} else {
		// Update existing
		progress.Status = req.Status
		progress.Progress = req.Progress
		progress.Score = req.Score
		if err := h.App.Database.Gorm().Save(&progress).Error; err != nil {
			return h.RespondWithError(c, err)
		}
	}

	return h.RespondWithData(c, progress)
}
