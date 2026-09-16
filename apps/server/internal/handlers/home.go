package handlers

import (
	"errors"
	"fmt"
	"kamehouse/internal/api/metadata_provider"
	"kamehouse/internal/database/models"
	"kamehouse/internal/database/models/dto"
	"kamehouse/internal/library/anime"

	"github.com/labstack/echo/v4"
	"gorm.io/gorm"
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

	type epRetagItem struct {
		ID          uint
		Title       string
		Description string
	}
	var episodes []epRetagItem
	if err := h.App.Database.Gorm().Model(&models.LibraryEpisode{}).
		Select("id, title, description").
		Find(&episodes).Error; err != nil {
		return c.JSON(500, NewErrorResponse(err))
	}

	tagger := metadata_provider.NewIntelligenceTagger()
	updated := 0

	const batchSize = 100
	for i := 0; i < len(episodes); i += batchSize {
		end := i + batchSize
		if end > len(episodes) {
			end = len(episodes)
		}
		chunk := episodes[i:end]

		_ = h.App.Database.Gorm().Transaction(func(tx *gorm.DB) error {
			for j := range chunk {
				ep := &chunk[j]
				analysis := tagger.Analyze(
					fmt.Sprintf("ep_%d", ep.ID),
					ep.Title,
					ep.Description,
					false,
				)

				tagsJSON := analysis.GetTagsAsJSON()
				if err := tx.Model(&models.LibraryEpisode{}).
					Where("id = ?", ep.ID).
					Updates(map[string]any{
						"tags":               tagsJSON,
						"dominant_vibe":      analysis.DominantVibe,
						"suggested_swimlane": analysis.SuggestedSwimlane,
					}).Error; err == nil {
					updated++
				}
			}
			return nil
		})
	}

	type mediaRetagItem struct {
		ID            uint
		Format        string
		TitleRomaji   string
		TitleEnglish  string
		TitleJapanese string
		Description   string
	}
	var allMedia []mediaRetagItem
	if err := h.App.Database.Gorm().Model(&models.LibraryMedia{}).
		Select("id, format, title_romaji, title_english, title_japanese, description").
		Find(&allMedia).Error; err == nil {
		for i := 0; i < len(allMedia); i += batchSize {
			end := i + batchSize
			if end > len(allMedia) {
				end = len(allMedia)
			}
			chunk := allMedia[i:end]
			_ = h.App.Database.Gorm().Transaction(func(tx *gorm.DB) error {
				for j := range chunk {
					m := &chunk[j]
					isMovie := m.Format == "MOVIE"
					title := m.TitleEnglish
					if title == "" {
						title = m.TitleRomaji
					}
					if title == "" {
						title = m.TitleJapanese
					}
					analysis := tagger.Analyze(fmt.Sprintf("media_%d", m.ID), title, m.Description, isMovie)
					_ = tx.Model(&models.LibraryMedia{}).
						Where("id = ?", m.ID).
						Updates(map[string]any{
							"suggested_swimlane": analysis.SuggestedSwimlane,
							"dominant_vibe":      analysis.DominantVibe,
						}).Error
				}
				return nil
			})
		}
	}



	h.App.Logger.Info().Int("updated", updated).Int("total", len(episodes)).Msg("retag: Complete")

	anime.InvalidateCuratedHomeCache()

	return c.JSON(200, NewDataResponse(map[string]any{
		"episodes_retagged": updated,
		"total_episodes":    len(episodes),
		"media_retagged":    len(allMedia),
	}))
}
