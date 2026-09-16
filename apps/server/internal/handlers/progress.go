package handlers

import (
	"errors"
	"kamehouse/internal/database/models"
	"net/http"

	"github.com/labstack/echo/v4"
)

type SaveProgressRequest struct {
	MediaID  int     `json:"mediaId"`
	Status   string  `json:"status"`
	Progress int     `json:"progress"`
	Score    float64 `json:"score"`
}

// HandleGetProgress handles GET /api/v1/progress
func (h *Handler) HandleGetProgress(c echo.Context) error {
	clientIDRaw := c.Get("KameHouse-Client-Id")
	if clientIDRaw == nil {
		return h.RespondWithCodeError(c, http.StatusUnauthorized, errors.New("missing client id"))
	}
	clientID, ok := clientIDRaw.(string)
	if !ok || clientID == "" {
		return h.RespondWithCodeError(c, http.StatusUnauthorized, errors.New("invalid client id"))
	}

	var progress []models.UserMediaProgress
	if err := h.App.Database.Gorm().Where("anon_user_id = ?", clientID).Find(&progress).Error; err != nil {
		return h.RespondWithError(c, err)
	}

	return h.RespondWithData(c, progress)
}

// HandleSaveProgress handles POST /api/v1/progress
func (h *Handler) HandleSaveProgress(c echo.Context) error {
	clientIDRaw := c.Get("KameHouse-Client-Id")
	if clientIDRaw == nil {
		return h.RespondWithCodeError(c, http.StatusUnauthorized, errors.New("missing client id"))
	}
	clientID, ok := clientIDRaw.(string)
	if !ok || clientID == "" {
		return h.RespondWithCodeError(c, http.StatusUnauthorized, errors.New("invalid client id"))
	}

	var req SaveProgressRequest
	if err := c.Bind(&req); err != nil {
		return h.RespondWithCodeError(c, http.StatusBadRequest, errors.New("invalid request body"))
	}

	if req.MediaID == 0 {
		return h.RespondWithCodeError(c, http.StatusBadRequest, errors.New("mediaID is required"))
	}

	var progress models.UserMediaProgress
	result := h.App.Database.Gorm().Where("anon_user_id = ? AND media_id = ?", clientID, req.MediaID).First(&progress)

	if result.Error != nil {
		// Create new
		progress = models.UserMediaProgress{
			AnonUserId: clientID,
			MediaID:    req.MediaID,
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
