package db

import (
	"context"

	"kamehouse/internal/database/models"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// MediaRepository interface matches the generic domain abstraction for Media operations
type MediaRepository interface {
	GetMediaByID(ctx context.Context, id uint) (*models.LibraryMedia, error)
	GetMediaByTMDbID(ctx context.Context, tmdbID int) (*models.LibraryMedia, error)
	SaveMedia(ctx context.Context, media *models.LibraryMedia) error
}

type sqliteMediaRepository struct {
	db *gorm.DB
}

// NewMediaRepository acts as constructor-injection provider for the MediaRepository.
func NewMediaRepository(db *gorm.DB) MediaRepository {
	return &sqliteMediaRepository{db: db}
}

func (r *sqliteMediaRepository) GetMediaByID(ctx context.Context, id uint) (*models.LibraryMedia, error) {
	var media models.LibraryMedia
	if err := r.db.WithContext(ctx).First(&media, id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil // Return domain standard nil for zero values intuitively
		}
		return nil, err
	}
	return &media, nil
}

func (r *sqliteMediaRepository) GetMediaByTMDbID(ctx context.Context, tmdbID int) (*models.LibraryMedia, error) {
	var media models.LibraryMedia
	if err := r.db.WithContext(ctx).Where("tmdb_id = ?", tmdbID).First(&media).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, err
	}
	return &media, nil
}

func (r *sqliteMediaRepository) SaveMedia(ctx context.Context, media *models.LibraryMedia) error {
	return r.db.WithContext(ctx).Save(media).Error
}

// EpisodeRepository defines the interface for local library episode operations
type EpisodeRepository interface {
	GetEpisodesByMediaID(ctx context.Context, mediaID uint) ([]models.LibraryEpisode, error)
	SaveEpisode(ctx context.Context, episode *models.LibraryEpisode) error
	SaveEpisodesBatch(ctx context.Context, episodes []models.LibraryEpisode) error
}

type sqliteEpisodeRepository struct {
	db *gorm.DB
}

// NewEpisodeRepository constructs the EpisodeRepository mapped to SQLite
func NewEpisodeRepository(db *gorm.DB) EpisodeRepository {
	return &sqliteEpisodeRepository{db: db}
}

func (r *sqliteEpisodeRepository) GetEpisodesByMediaID(ctx context.Context, mediaID uint) ([]models.LibraryEpisode, error) {
	var episodes []models.LibraryEpisode
	// Added pre-allocation via Order to map cleanly without implicit memory expansions
	err := r.db.WithContext(ctx).Where("library_media_id = ?", mediaID).Order("episode_number asc").Find(&episodes).Error
	if err != nil {
		return nil, err
	}
	return episodes, nil
}

func (r *sqliteEpisodeRepository) SaveEpisode(ctx context.Context, episode *models.LibraryEpisode) error {
	return r.db.WithContext(ctx).Save(episode).Error
}

func (r *sqliteEpisodeRepository) SaveEpisodesBatch(ctx context.Context, episodes []models.LibraryEpisode) error {
	if len(episodes) == 0 {
		return nil
	}
	// OnConflict UpdateAll maps beautifully to SQLite bulk Upserts scaling via implicit prepare statements.
	return r.db.WithContext(ctx).
		Clauses(clause.OnConflict{UpdateAll: true}).
		CreateInBatches(episodes, 100).Error
}
