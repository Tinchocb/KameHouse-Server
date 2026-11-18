package db

import (
	"errors"
	"fmt"
	"kamehouse/internal/constants"
	"kamehouse/internal/database/models"

	"gorm.io/gorm"
)

// AmbiguousMediaIDError prevents legacy provider ID collisions from selecting
// an arbitrary title. The caller must resolve file associations explicitly.
type AmbiguousMediaIDError struct{ MediaID int }

func (e *AmbiguousMediaIDError) Error() string {
	return fmt.Sprintf("media ID %d is linked to multiple library titles; identify the files before updating progress", e.MediaID)
}

// ResolveLibraryMediaByPublicID resolves API/local_file IDs, never an unqualified
// library_media primary key. Explicit file associations also cover local-only NFOs.
func ResolveLibraryMediaByPublicID(d *Database, mediaID int) (*models.LibraryMedia, error) {
	if mediaID <= 0 {
		return nil, nil
	}
	if media, err := GetLibraryMediaByExternalMediaID(d, mediaID); err == nil {
		return media, nil
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}
	if mediaID >= constants.MovieIDOffset {
		return GetLibraryMediaByTmdbIdAndType(d, mediaID-constants.MovieIDOffset, "MOVIE")
	}
	// Jikan identities use MAL IDs. Existing NFO imports used ANIME + TMDB ID;
	// retain those rows without treating their auto-increment PK as a public ID.
	// Without file associations, SHOW and ANIME can share a public number. Never
	// pick one merely because its provider is queried first.
	var candidates []models.LibraryMedia
	if err := d.Gorm().Where("(type = ? AND tmdb_id = ?) OR (type = ? AND (myanimelist_id = ? OR tmdb_id = ?))", "SHOW", mediaID, "ANIME", mediaID, mediaID).Limit(2).Find(&candidates).Error; err != nil {
		return nil, err
	}
	if len(candidates) > 1 {
		return nil, &AmbiguousMediaIDError{MediaID: mediaID}
	}
	if len(candidates) == 0 {
		return nil, nil
	}
	return &candidates[0], nil
}

// ResolvePublicMediaIDByMAL keeps skip times in the same public namespace as
// local files. A primary key is never a substitute for a public identity.
func ResolvePublicMediaIDByMAL(d *Database, malID int) (int, error) {
	var candidates []models.LibraryMedia
	if err := d.Gorm().Where("myanimelist_id = ?", malID).Limit(2).Find(&candidates).Error; err != nil {
		return 0, err
	}
	if len(candidates) == 0 {
		return 0, gorm.ErrRecordNotFound
	}
	if len(candidates) != 1 {
		return 0, &AmbiguousMediaIDError{MediaID: malID}
	}
	m := candidates[0]
	var ids []int
	if err := d.Gorm().Model(&models.LocalFile{}).Distinct("media_id").
		Where("library_media_id = ? AND media_id > 0", m.ID).Limit(2).Pluck("media_id", &ids).Error; err != nil {
		return 0, err
	}
	if len(ids) > 1 {
		return 0, &AmbiguousMediaIDError{MediaID: malID}
	}
	id := m.TmdbID
	if id <= 0 && m.Type == "ANIME" {
		id = m.MyanimelistId
	}
	if m.Type == "MOVIE" && id > 0 {
		id += constants.MovieIDOffset
	}
	if len(ids) == 1 {
		id = ids[0]
	}
	if id <= 0 {
		return 0, gorm.ErrRecordNotFound
	}
	resolved, err := ResolveLibraryMediaByPublicID(d, id)
	if err != nil {
		return 0, err
	}
	if resolved == nil || resolved.ID != m.ID {
		return 0, &AmbiguousMediaIDError{MediaID: id}
	}
	return id, nil
}
