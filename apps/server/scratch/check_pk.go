package main

import (
	"fmt"
	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
	"kamehouse/internal/database/models"
	"log"
)

func main() {
	database, err := gorm.Open(sqlite.Open("kamehouse.db"), &gorm.Config{})
	if err != nil {
		log.Fatal(err)
	}

	var media models.LibraryMedia
	result := database.Where("tmdb_id = ?", 61709).First(&media)
	if result.Error != nil {
		fmt.Printf("Error finding media by TMDB ID 61709: %v\n", result.Error)
	} else {
		fmt.Printf("Media by TMDB ID 61709: ID=%d, Title=%s\n", media.ID, media.TitleRomaji)
	}

	var media2 models.LibraryMedia
	result = database.First(&media2, 61709)
	if result.Error != nil {
		fmt.Printf("Error finding media by PK 61709: %v\n", result.Error)
	} else {
		fmt.Printf("Media by PK 61709: ID=%d, Title=%s\n", media2.ID, media2.TitleRomaji)
	}
}
