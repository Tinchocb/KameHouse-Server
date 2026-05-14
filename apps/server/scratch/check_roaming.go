package main

import (
	"fmt"
	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
	"kamehouse/internal/database/models"
	"log"
)

func main() {
	database, err := gorm.Open(sqlite.Open("C:\\Users\\marti\\AppData\\Roaming\\KameHouse\\kamehouse.db"), &gorm.Config{})
	if err != nil {
		log.Fatal(err)
	}

	var count int64
	database.Model(&models.LocalFile{}).Count(&count)
	fmt.Printf("Total local files: %d\n", count)

    var media models.LibraryMedia
	result := database.Where("tmdb_id = ?", 61709).First(&media)
	if result.Error != nil {
		fmt.Printf("Error finding media by TMDB ID 61709: %v\n", result.Error)
	} else {
		fmt.Printf("Media by TMDB ID 61709: ID=%d, Title=%s, Poster=%s\n", media.ID, media.TitleRomaji, media.PosterImage)
	}
}
