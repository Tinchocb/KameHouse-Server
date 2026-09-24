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
	// Si el cliente se va, el chunk en curso se revierte; los ya confirmados
	// quedan (el retag es idempotente, se puede relanzar).
	gdb := h.App.Database.Gorm().WithContext(c.Request().Context())

	type epRetagItem struct {
		ID          uint
		Title       string
		Description string
	}
	var episodes []epRetagItem
	if err := gdb.Model(&models.LibraryEpisode{}).
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

		// Transacción por chunk: un fallo revierte el chunk entero en vez de
		// dejar filas a medias en silencio.
		if err := gdb.Transaction(func(tx *gorm.DB) error {
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
					}).Error; err != nil {
					return fmt.Errorf("retag episode id %d: %w", ep.ID, err)
				}
				updated++
			}
			return nil
		}); err != nil {
			return c.JSON(500, NewErrorResponse(err))
		}
	}

	type mediaRetagItem struct {
		ID            uint
		Format        string
		TitleRomaji   string
		TitleEnglish  string
		Description   string
	}
	var allMedia []mediaRetagItem
	if err := gdb.Model(&models.LibraryMedia{}).
		Select("id, format, title_romaji, title_english, description").
		Find(&allMedia).Error; err != nil {
		return c.JSON(500, NewErrorResponse(err))
	}
	mediaUpdated := 0
	for i := 0; i < len(allMedia); i += batchSize {
		end := i + batchSize
		if end > len(allMedia) {
			end = len(allMedia)
		}
		chunk := allMedia[i:end]
		if err := gdb.Transaction(func(tx *gorm.DB) error {
			for j := range chunk {
				m := &chunk[j]
				isMovie := m.Format == "MOVIE"
				title := m.TitleEnglish
				if title == "" {
					title = m.TitleRomaji
				}
				analysis := tagger.Analyze(fmt.Sprintf("media_%d", m.ID), title, m.Description, isMovie)
				if err := tx.Model(&models.LibraryMedia{}).
					Where("id = ?", m.ID).
					Updates(map[string]any{
						"suggested_swimlane": analysis.SuggestedSwimlane,
						"dominant_vibe":      analysis.DominantVibe,
					}).Error; err != nil {
					return fmt.Errorf("retag media id %d: %w", m.ID, err)
				}
				mediaUpdated++
			}
			return nil
		}); err != nil {
			return c.JSON(500, NewErrorResponse(err))
		}
	}



	h.App.Logger.Info().Int("updated", updated).Int("total", len(episodes)).Msg("retag: Complete")

	anime.InvalidateCuratedHomeCache()

	return c.JSON(200, NewDataResponse(map[string]any{
		"episodes_retagged": updated,
		"total_episodes":    len(episodes),
		"media_retagged":    mediaUpdated,
	}))
}
