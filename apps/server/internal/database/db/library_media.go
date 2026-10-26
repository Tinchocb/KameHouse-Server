package db

import (
	"errors"
	"fmt"
	"kamehouse/internal/database/models"
	"sync"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// GetLibraryMediaByTmdbIdAndType retrieves a LibraryMedia by its TMDB ID and Type.
// Cloned to prevent caller mutating cached object.
func GetLibraryMediaByTmdbIdAndType(d *Database, tmdbID int, mediaType string) (*models.LibraryMedia, error) {
	cache := d.libraryMediaSnapshot()
	cacheKey := fmt.Sprintf("id_type_%d_%s", tmdbID, mediaType)
	if v, ok := cache.Load(cacheKey); ok {
		if media, _ := v.(*models.LibraryMedia); media == nil {
			return nil, nil
		} else {
			copy := *media
			return &copy, nil
		}
	}
	var media models.LibraryMedia
	err := d.Gorm().Where("tmdb_id = ? AND type = ?", tmdbID, mediaType).First(&media).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			cache.Store(cacheKey, (*models.LibraryMedia)(nil))
			return nil, nil
		}
		return nil, err
	}
	cache.Store(cacheKey, &media)
	copy := media
	return &copy, nil
}

// GetLibraryMediaByID retrieves a LibraryMedia by its primary key ID.
// Cloned to prevent caller mutating cached object.
func GetLibraryMediaByID(d *Database, id uint) (*models.LibraryMedia, error) {
	cache := d.libraryMediaSnapshot()
	cacheKey := fmt.Sprintf("pk_%d", id)
	if v, ok := cache.Load(cacheKey); ok {
		if media, _ := v.(*models.LibraryMedia); media == nil {
			return nil, nil
		} else {
			copy := *media
			return &copy, nil
		}
	}
	var media models.LibraryMedia
	err := d.Gorm().First(&media, id).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			cache.Store(cacheKey, (*models.LibraryMedia)(nil))
			return nil, nil
		}
		return nil, err
	}
	cache.Store(cacheKey, &media)
	copy := media
	return &copy, nil
}

// GetMediaEntryListData retrieves the MediaEntryListData for a given LibraryMedia ID.
func GetMediaEntryListData(d *Database, libraryMediaId uint) (*models.MediaEntryListData, error) {
	var listData models.MediaEntryListData
	err := d.Gorm().Where("library_media_id = ?", libraryMediaId).First(&listData).Error
	if err != nil {
		return nil, err
	}
	return &listData, nil
}

// InsertLibraryMedia creates or updates a LibraryMedia record in the database.
// If a record with the same TMDB ID exists, it updates it; otherwise it creates a new one.
// The in-memory cache is invalidated so subsequent reads reflect the new state.
func InsertLibraryMedia(d *Database, media *models.LibraryMedia) (*models.LibraryMedia, error) {
	err := d.Gorm().Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "tmdb_id"}, {Name: "type"}}, // Must match uniqueIndex:idx_tmdb_id_type on the model
		UpdateAll: true,
	}).Create(media).Error
	if err != nil {
		return nil, err
	}
	d.invalidateLibraryMediaCache()
	return media, nil
}

// UpsertLibraryMediaBatch inserts or updates a slice of LibraryMedia atomically in a single transaction.
// All affected TMDB IDs are evicted from the in-memory cache after the write.
func UpsertLibraryMediaBatch(d *Database, media []*models.LibraryMedia, batchSize int) error {
	if len(media) == 0 {
		return nil
	}

	err := d.Gorm().Transaction(func(tx *gorm.DB) error {
		return tx.Clauses(clause.OnConflict{
			Columns:   []clause.Column{{Name: "tmdb_id"}, {Name: "type"}}, // Unique composite constraint
			UpdateAll: true,
		}).CreateInBatches(media, batchSize).Error
	})

	if err == nil {
		d.invalidateLibraryMediaCache()
	}
	return err
}

// InsertLibraryMediaBatchIfMissing inserta solo los LibraryMedia cuyo (tmdb_id, type)
// todavía no existe; los existentes quedan intactos. Es para orígenes con datos
// parciales (NFO locales): UpsertLibraryMediaBatch pisaría con campos vacíos el
// póster, la descripción y demás que un enriquecimiento previo ya había guardado.
func InsertLibraryMediaBatchIfMissing(d *Database, media []*models.LibraryMedia, batchSize int) error {
	if len(media) == 0 {
		return nil
	}
	err := d.Gorm().Transaction(func(tx *gorm.DB) error {
		return tx.Clauses(clause.OnConflict{
			Columns:   []clause.Column{{Name: "tmdb_id"}, {Name: "type"}},
			DoNothing: true,
		}).CreateInBatches(media, batchSize).Error
	})
	if err == nil {
		// También los nuevos: una consulta previa pudo dejar cacheado "no existe".
		d.invalidateLibraryMediaCache()
	}
	return err
}

// libraryMediaSnapshot pins one cache generation for the whole read. A query
// started before an invalidation can only publish into its retired generation.
func (d *Database) libraryMediaSnapshot() *sync.Map {
	if c := d.libraryMediaCache.Load(); c != nil {
		return c
	}
	c := &sync.Map{}
	if d.libraryMediaCache.CompareAndSwap(nil, c) {
		return c
	}
	return d.libraryMediaCache.Load()
}

func (d *Database) invalidateLibraryMediaCache() {
	d.libraryMediaCache.Store(&sync.Map{})
}

// UpdateLibraryMediaMappings updates the external mappings (AniDB, MAL) for a LibraryMedia record.
func UpdateLibraryMediaMappings(d *Database, id uint, anidbId, malId int) error {
	err := d.Gorm().Model(&models.LibraryMedia{}).Where("id = ?", id).Updates(map[string]interface{}{
		"anidb_id":       anidbId,
		"myanimelist_id": malId,
	}).Error
	if err != nil {
		return err
	}
	d.invalidateLibraryMediaCache()
	return nil
}

// CleanBrokenLibraryMediaPosters resets broken/hallucinated legacy placeholder image URLs in the DB
// and updates the core Dragon Ball series with their verified authentic TMDB artwork.
func CleanBrokenLibraryMediaPosters(d *Database) {
	const migrationKey = "clean_broken_posters_v1"
	if migrationDone(d, d.Logger, migrationKey) {
		return
	}

	brokenPatterns := []string{
		"%daima_poster%", "%daima_banner%",
		"%bardock_poster%", "%bardock_banner%",
		"%trunks_future%", "%deadzone%",
		"%broly_poster%", "%superhero_poster%",
		"%6GI51l50f4Gf0K7D5V7bZ2V6eB5%",
		"%3w8hdA7V1f6Y23qgJjW8R9Y54Vb%",
		"%4gN1vO4bZz2PzR0V6eB6aQ7lH4m%",
		"%qV8s4B1zO0f1V7bZ2V6eB5lH4m0%",
		"%96X0I7m4oD1vO4bZz2PzR0V6eB5%",
		"%f02FFv0x2fB6aQ7lH4m0vO4bZz2%",
		"%rugyJioKn7Ky1qO4bZz2PzR0V6e%",
		"%2exOOgqIeYvC4vFk7Hj5tQ3XpW6%",
		"%6xK4S5gN0V8bZ2PzR0V6eB6aQ7l%",
		"%mX9V8s4B1zO0f1V7bZ2V6eB5lH4%",
		"%7hM7zP0V6eB5lH4m0vO4bZz2PzR%",
		"%dJODzGsqM92Z2rP0Z8dI1iPz8N0%",
	}
	for _, p := range brokenPatterns {
		d.Gorm().Model(&models.LibraryMedia{}).Where("poster_image LIKE ?", p).Update("poster_image", "")
		d.Gorm().Model(&models.LibraryMedia{}).Where("banner_image LIKE ?", p).Update("banner_image", "")
	}

	// Set verified official artwork for canonical TV series if missing or cleared
	// bannerImage = backdrop 16:9 horizontal (1920×1080 a 3840×2160)
	verifiedArt := map[int][2]string{
		12609:  {"https://image.tmdb.org/t/p/w500/30L49n4Dhn7dzuGG50GV3ybMhC3.jpg", "https://image.tmdb.org/t/p/original/tZuNziXpjmOsDlmiT6adFPmmSKT.jpg"},
		12971:  {"https://image.tmdb.org/t/p/w500/ydf1CeiBLfdxiyNTpskM0802TKl.jpg", "https://image.tmdb.org/t/p/original/u3nEeIkCR7mcpEJXZpUGUTLmF3O.jpg"},
		12697:  {"https://image.tmdb.org/t/p/w500/aJOlYXjxb5IvnTsO4I1tmFpC7GH.jpg", "https://image.tmdb.org/t/p/original/c76HQMfMuspovC1OzBfZEQoEPry.jpg"},
		61709:  {"https://image.tmdb.org/t/p/w500/oz5zbMBKCUsb7hsbjdxvK8yagPD.jpg", "https://image.tmdb.org/t/p/original/hwENQkheJIPVYyotxaWxPJH3Lb4.jpg"},
		42705:  {"https://image.tmdb.org/t/p/w500/oz5zbMBKCUsb7hsbjdxvK8yagPD.jpg", "https://image.tmdb.org/t/p/original/hwENQkheJIPVYyotxaWxPJH3Lb4.jpg"},
		62715:  {"https://image.tmdb.org/t/p/w500/qA2UwUQbj05aeBMCuC0mHSQ4loE.jpg", "https://image.tmdb.org/t/p/original/yJAOi2n0VYBEXdPI1NXv5FiOcBX.jpg"},
		236994: {"https://image.tmdb.org/t/p/w500/oUmWLyeko3kYdUr8DBLIsxwcugl.jpg", "https://image.tmdb.org/t/p/original/jslk3I4TLDTb9BTKUqjMHpsCsml.jpg"},
	}

	for tmdbId, art := range verifiedArt {
		d.Gorm().Model(&models.LibraryMedia{}).
			Where("tmdb_id = ? AND (poster_image = '' OR poster_image IS NULL)", tmdbId).
			Update("poster_image", art[0])
		d.Gorm().Model(&models.LibraryMedia{}).
			Where("tmdb_id = ? AND (banner_image = '' OR banner_image IS NULL)", tmdbId).
			Update("banner_image", art[1])
	}

	if err := UpsertMetadataCache(d, "migrations", migrationKey, true, 0); err != nil {
		d.Logger.Error().Err(err).Msg("db: no se pudo marcar clean_broken_posters_v1 como completado")
	}
}
