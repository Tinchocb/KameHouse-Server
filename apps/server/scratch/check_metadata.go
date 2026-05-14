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
		fmt.Printf("Error finding media 61709: %v\n", result.Error)
	} else {
		fmt.Printf("Media 61709: %s\n", media.TitleRomaji)
		fmt.Printf("Poster Image: %s\n", media.PosterImage)
		fmt.Printf("Banner Image: %s\n", media.BannerImage)
		fmt.Printf("Metadata Status: %s\n", media.MetadataStatus)
	}
}
