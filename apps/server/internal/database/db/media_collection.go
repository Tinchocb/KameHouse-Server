package db

import (
	"kamehouse/internal/database/models"
)

// UpsertMediaCollection inserts or updates a MediaCollection record by its TMDB collection ID.
// If the collection already exists (matched by tmdb_collection_id), it updates name, overview,
// poster, backdrop and merges the memberID list.
func UpsertMediaCollection(db *Database, coll *models.MediaCollection) error {
	var existing models.MediaCollection
	result := db.gormdb.Where("tmdb_collection_id = ?", coll.TMDBCollectionID).First(&existing)

	if result.Error != nil {
		// Not found — insert
		return db.gormdb.Create(coll).Error
	}

	// Merge member IDs (deduplicate)
	idSet := make(map[int]struct{}, len(existing.MemberIDs)+len(coll.MemberIDs))
	for _, id := range existing.MemberIDs {
		idSet[id] = struct{}{}
	}
	for _, id := range coll.MemberIDs {
		idSet[id] = struct{}{}
	}
	merged := make(models.IntSlice, 0, len(idSet))
	for id := range idSet {
		merged = append(merged, id)
	}

	return db.gormdb.Model(&existing).Updates(map[string]interface{}{
		"name":          coll.Name,
		"overview":      coll.Overview,
		"poster_path":   coll.PosterPath,
		"backdrop_path": coll.BackdropPath,
		"member_ids":    merged,
	}).Error
}

// GetMediaCollection fetches a stored MediaCollection by its TMDB collection ID.
func GetMediaCollection(db *Database, tmdbCollectionID int) (*models.MediaCollection, error) {
	var coll models.MediaCollection
	if err := db.gormdb.Where("tmdb_collection_id = ?", tmdbCollectionID).First(&coll).Error; err != nil {
		return nil, err
	}
	return &coll, nil
}

// ListMediaCollections returns all known franchise collections.
func ListMediaCollections(db *Database) ([]*models.MediaCollection, error) {
	var colls []*models.MediaCollection
	if err := db.gormdb.Find(&colls).Error; err != nil {
		return nil, err
	}
	return colls, nil
}
