package main

import (
	"fmt"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

type LibraryMedia struct {
	ID     uint   `gorm:"primaryKey"`
	TmdbId int    `gorm:"column:tmdb_id"`
	Format string `gorm:"column:format"`
	TitleRomaji string `gorm:"column:title_romaji"`
}

func (LibraryMedia) TableName() string {
	return "library_media"
}

func main() {
	db, err := gorm.Open(sqlite.Open("C:\\Users\\marti\\AppData\\Roaming\\KameHouse\\kamehouse.db"), &gorm.Config{})
	if err != nil {
		panic("failed to connect database: " + err.Error())
	}

	var allMedia []LibraryMedia
	db.Find(&allMedia)

	// Build a map from positive TMDB ID -> list of media IDs that have it
	type entry struct {
		id      uint
		tmdbId  int
	}
	positiveMap := make(map[int][]entry)
	for _, m := range allMedia {
		positiveMap[abs(m.TmdbId)] = append(positiveMap[abs(m.TmdbId)], entry{m.ID, m.TmdbId})
	}

	// For each group with both a positive and negative duplicate, delete the old positive one
	// (old positive = the one that was incorrectly created before the scanner fix)
	deleted := 0
	for tmdbId, entries := range positiveMap {
		if len(entries) < 2 {
			continue
		}
		_ = tmdbId
		// Separate negative and positive entries
		var negEntries, posEntries []entry
		for _, e := range entries {
			if e.tmdbId < 0 {
				negEntries = append(negEntries, e)
			} else {
				posEntries = append(posEntries, e)
			}
		}
		// Delete the old positive-ID duplicates that collide (the negatives will be converted)
		for _, pe := range posEntries {
			for _, ne := range negEntries {
				if pe.tmdbId == -ne.tmdbId {
					// Delete the old positive entry
					result := db.Exec("DELETE FROM library_media WHERE id = ?", pe.id)
					if result.Error != nil {
						fmt.Printf("ERROR deleting media %d: %s\n", pe.id, result.Error.Error())
					} else {
						fmt.Printf("Deleted duplicate +%d (id=%d)\n", pe.tmdbId, pe.id)
						deleted++
					}
					break
				}
			}
		}
	}

	// Now convert negative IDs to positive
	db.Find(&allMedia)
	fixed := 0
	for _, m := range allMedia {
		if m.TmdbId < 0 {
			newTmdbId := -m.TmdbId
			result := db.Exec("UPDATE library_media SET tmdb_id = ? WHERE id = ?", newTmdbId, m.ID)
			if result.Error != nil {
				fmt.Printf("ERROR updating media %d: %s\n", m.ID, result.Error.Error())
			} else {
				fmt.Printf("Fixed media %d (%s): tmdb_id %d -> %d\n", m.ID, m.TitleRomaji, m.TmdbId, newTmdbId)
				fixed++
			}
		}
	}

	fmt.Printf("\nDone! Deleted %d duplicates, Fixed %d records.\n", deleted, fixed)
}

func abs(n int) int {
	if n < 0 {
		return -n
	}
	return n
}
