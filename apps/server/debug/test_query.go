package main

import (
	"encoding/json"
	"fmt"
	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
	"kamehouse/internal/database/models"
	"kamehouse/internal/database/models/dto"
)

func main() {
	db, err := gorm.Open(sqlite.Open("C:\\Users\\marti\\AppData\\Roaming\\KameHouse\\kamehouse.db"), &gorm.Config{})
	if err != nil {
		panic("failed to connect database: " + err.Error())
	}

	var res models.LocalFiles
	db.Last(&res)

	var lfs []*dto.LocalFile
	json.Unmarshal(res.Value, &lfs)

	fmt.Printf("Total LocalFiles in JSON: %d\n", len(lfs))

	count := 0
	for _, lf := range lfs {
		if lf.MediaId == 0 {
			continue
		}
		if count >= 10 {
			break
		}
		typeStr := "NIL"
		if lf.Metadata != nil {
			typeStr = string(lf.Metadata.Type)
		}
		fmt.Printf("- File: %s\n  MediaId: %d, LibMediaId: %d, Type: %s\n", lf.Name, lf.MediaId, lf.LibraryMediaId, typeStr)
		count++
	}

	// Check one specific LibraryMedia
	// Check movie LibraryMedia
	var m2 models.LibraryMedia
	err = db.First(&m2, 33168).Error
	if err == nil {
		fmt.Printf("\nMedia 33168 in DB:\n  TMDB: %d\n  Title: %s\n  Format: %s\n  TotalEpisodes: %d\n", m2.TmdbId, m2.TitleRomaji, m2.Format, m2.TotalEpisodes)
	} else {
		fmt.Printf("\nMedia 33168 not found in DB: %s\n", err.Error())
	}
	// Check Dragon Ball Z
	var m3 models.LibraryMedia
	err = db.First(&m3, 33169).Error
	if err == nil {
		fmt.Printf("\nMedia 33169 in DB:\n  TMDB: %d\n  Title: %s\n  TotalEpisodes: %d\n", m3.TmdbId, m3.TitleRomaji, m3.TotalEpisodes)
	}
}
