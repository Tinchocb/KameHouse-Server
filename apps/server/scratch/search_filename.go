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

	var files []models.LocalFile
	result := database.Where("path LIKE ?", "%KAME-VHS 6 EP8%").Find(&files)
	if result.Error != nil {
		log.Fatal(result.Error)
	}

	fmt.Printf("Found %d local files matching 'KAME-VHS 6 EP8'\n", len(files))
	for _, f := range files {
		fmt.Printf("  File: %s, MediaId: %d, LibraryMediaId: %d\n", f.Path, f.MediaId, f.LibraryMediaId)
	}
}
