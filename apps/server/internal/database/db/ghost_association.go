package db

import (
	"errors"
	"kamehouse/internal/database/models"

	"gorm.io/gorm"
)

// GetGhostAssociationByPath retrieves a ghost association for a specific file path.
func (db *Database) GetGhostAssociationByPath(path string) (*models.GhostAssociatedMedia, error) {
	var association models.GhostAssociatedMedia
	err := db.gormdb.Where("path = ?", path).First(&association).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil // Return nil, but no error if not found
		}
		return nil, err
	}
	return &association, nil
}

// UpsertGhostAssociation inserts or updates a ghost association.
// If the path already has an association for the same TargetMediaId, it increments the GhostMatchCount.
func (db *Database) UpsertGhostAssociation(association *models.GhostAssociatedMedia) error {
	var existing models.GhostAssociatedMedia
	err := db.gormdb.Where("path = ?", association.Path).First(&existing).Error

	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			// Insert new
			return db.gormdb.Create(association).Error
		}
		return err
	}

	// Update existing
	if existing.TargetMediaId == association.TargetMediaId {
		existing.GhostMatchCount++
		existing.AlgorithmScore = association.AlgorithmScore // Update to latest score calculation
		existing.UserResolved = association.UserResolved
		return db.gormdb.Save(&existing).Error
	} else {
		// The path is now being associated with a DIFFERENT media ID.
		// Reset the heuristics and point to the new ID.
		existing.TargetMediaId = association.TargetMediaId
		existing.AlgorithmScore = association.AlgorithmScore
		existing.UserResolved = association.UserResolved
		existing.GhostMatchCount = 1
		return db.gormdb.Save(&existing).Error
	}
}

// Ensure interface compliance
func (db *Database) DeleteGhostAssociation(path string) error {
	return db.gormdb.Where("path = ?", path).Delete(&models.GhostAssociatedMedia{}).Error
}
