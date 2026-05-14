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

	var files []models.LocalFile
	database.Where("media_id = ? OR library_media_id = ?", 61709, 1028).Find(&files)
	fmt.Printf("Found %d local files for 61709 / 1028\n", len(files))
	for _, f := range files {
		fmt.Printf("  Path: %s, MediaId: %d, LibId: %d\n", f.Path, f.MediaId, f.LibraryMediaId)
	}
}
