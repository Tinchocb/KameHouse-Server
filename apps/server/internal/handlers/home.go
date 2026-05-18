package handlers

import (
	"errors"
	"fmt"
	"kamehouse/internal/api/metadata_provider"
	"kamehouse/internal/database/models"
	"kamehouse/internal/database/models/dto"
	"kamehouse/internal/library/anime"

	"github.com/labstack/echo/v4"
)

// HandleGetHomeCurated returns the intelligent swimlanes for the home page.
func (h *Handler) HandleGetHomeCurated(c echo.Context) error {
	ctx := c.Request().Context()

	if h.App.Database == nil {
		return c.JSON(500, NewErrorResponse(errors.New("database not initialized")))
	}

	resp, err := anime.GetCuratedHome(ctx, h.App.Database)
	if err != nil {
		return c.JSON(500, NewErrorResponse(err))
	}

	return c.JSON(200, NewDataResponse(resp))
}

// HandleGetContinueWatching returns the "Continue Watching" items for the user.
func (h *Handler) HandleGetContinueWatching(c echo.Context) error {
	ctx := c.Request().Context()

	if h.App.Database == nil {
		return h.JSON(c, 500, NewErrorResponse(errors.New("database not initialized")))
	}

	// Require an authenticated user_id — do NOT fall back to userID=1 (admin)
	// to prevent guests from seeing the admin's private watch history.
	userID := uint(0)
	if val := c.Get("user_id"); val != nil {
		if id, ok := val.(uint); ok {
			userID = id
		}
	}
	if userID == 0 {
		return h.JSON(c, 200, NewDataResponse(make([]dto.ContinueWatchingItem, 0)))
	}

	svc := anime.NewIntelligenceService(h.App.Database, nil, h.App.Logger)
	resp, err := svc.GetContinueWatching(ctx, userID)
	if err != nil {
		return h.JSON(c, 500, NewErrorResponse(err))
	}

	if resp == nil {
		resp = make([]dto.ContinueWatchingItem, 0)
	}

	return h.JSON(c, 200, NewDataResponse(resp))
}
// HandleRetagEpisodes re-runs IntelligenceTagger on all LibraryEpisode records
// using the titles and descriptions already stored in the DB — no TMDB API needed.
// Trigger this via POST /api/v1/home/retag after adding new tag rules.
func (h *Handler) HandleRetagEpisodes(c echo.Context) error {
	if h.App.Database == nil {
		return c.JSON(500, NewErrorResponse(errors.New("database not initialized")))
	}

	var episodes []models.LibraryEpisode
	if err := h.App.Database.Gorm().Find(&episodes).Error; err != nil {
		return c.JSON(500, NewErrorResponse(err))
	}

	tagger := metadata_provider.NewIntelligenceTagger()
	updated := 0

	for i := range episodes {
		ep := &episodes[i]
		analysis := tagger.Analyze(
			fmt.Sprintf("ep_%d", ep.ID),
			ep.Title,
			ep.Description,
			false,
		)

		tagsJSON := analysis.GetTagsAsJSON()
		if err := h.App.Database.Gorm().
			Model(ep).
			Updates(map[string]any{
				"tags":               tagsJSON,
				"dominant_vibe":      analysis.DominantVibe,
				"suggested_swimlane": analysis.SuggestedSwimlane,
			}).Error; err == nil {
			updated++
		}
	}

	// Also retag LibraryMedia (movies & series headers)
	var allMedia []models.LibraryMedia
	h.App.Database.Gorm().Find(&allMedia)
	for i := range allMedia {
		m := &allMedia[i]
		isMovie := m.Format == "MOVIE"
		analysis := tagger.Analyze(fmt.Sprintf("media_%d", m.ID), m.GetPreferredTitle(), m.Description, isMovie)
		h.App.Database.Gorm().Model(m).Updates(map[string]any{
			"suggested_swimlane": analysis.SuggestedSwimlane,
			"dominant_vibe":      analysis.DominantVibe,
		})
	}
	h.App.Logger.Info().Int("updated", updated).Int("total", len(episodes)).Msg("retag: Complete")

	anime.InvalidateCuratedHomeCache()

	return c.JSON(200, NewDataResponse(map[string]any{
		"episodes_retagged": updated,
		"total_episodes":    len(episodes),
		"media_retagged":    len(allMedia),
	}))
}
