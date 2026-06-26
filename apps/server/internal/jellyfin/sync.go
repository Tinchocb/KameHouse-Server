package jellyfin

import (
	"context"
	"kamehouse/internal/database/db"
	"kamehouse/internal/database/models"

	"github.com/rs/zerolog"
)

// SyncService maneja la sincronización de IDs entre KameHouse y Jellyfin.
type SyncService struct {
	db     *db.Database
	client *Client
	logger *zerolog.Logger
}

// NewSyncService crea un nuevo servicio de sincronización.
func NewSyncService(database *db.Database, client *Client, logger *zerolog.Logger) *SyncService {
	return &SyncService{
		db:     database,
		client: client,
		logger: logger,
	}
}

// SyncAllMedia sincroniza todos los IDs de la librería con Jellyfin.
func (s *SyncService) SyncAllMedia(ctx context.Context) (*SyncResult, error) {
	if !s.client.IsConfigured() {
		return nil, ErrJellyfinNotConfigured
	}

	var allMedia []models.LibraryMedia
	if err := s.db.Gorm().Find(&allMedia).Error; err != nil {
		return nil, err
	}

	result := &SyncResult{
		Total: len(allMedia),
	}

	for _, media := range allMedia {
		if ctx.Err() != nil {
			return nil, ctx.Err()
		}

		if media.TmdbID == 0 {
			result.Skipped++
			continue
		}

		mapping, err := s.SyncSingleMedia(ctx, &media)
		if err != nil {
			s.logger.Warn().Err(err).Int("tmdbId", media.TmdbID).Msg("jellyfin: failed to sync media")
			result.Errors++
			continue
		}

		if mapping != nil {
			result.Synced++
		}
	}

	s.logger.Info().
		Int("total", result.Total).
		Int("synced", result.Synced).
		Int("skipped", result.Skipped).
		Int("errors", result.Errors).
		Msg("jellyfin: sync completed")

	return result, nil
}

// SyncSingleMedia sincroniza un solo item de media con Jellyfin.
func (s *SyncService) SyncSingleMedia(ctx context.Context, media *models.LibraryMedia) (*models.MediaIDMapping, error) {
	item, err := s.client.SearchByTMDB(ctx, media.TmdbID)
	if err != nil {
		return nil, err
	}

	mediaType := "tv"
	if media.Format == "MOVIE" {
		mediaType = "movie"
	}

	mapping := &models.MediaIDMapping{
		InternalID: int(media.ID),
		TMDBID:     media.TmdbID,
		MALID:      media.MyanimelistId,
		JellyfinID: item.ID,
		MediaType:  mediaType,
		Title:      media.GetPreferredTitle(),
	}

	if err := s.db.UpsertMediaIDMapping(mapping); err != nil {
		return nil, err
	}

	return mapping, nil
}

// SyncResult resultado de una operación de sincronización.
type SyncResult struct {
	Total   int `json:"total"`
	Synced  int `json:"synced"`
	Skipped int `json:"skipped"`
	Errors  int `json:"errors"`
}

// ErrJellyfinNotConfigured error cuando Jellyfin no está configurado.
var ErrJellyfinNotConfigured = &NotConfiguredError{}

type NotConfiguredError struct{}

func (e *NotConfiguredError) Error() string {
	return "jellyfin: client not configured (URL or API key missing)"
}
