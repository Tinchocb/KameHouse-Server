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
	database.Find(&files)
	fmt.Printf("Total local files in DB: %d\n", len(files))
	for i, f := range files {
		fmt.Printf("[%d] Path: %s, MediaId: %d, LibraryMediaId: %d\n", i, f.Path, f.MediaId, f.LibraryMediaId)
		if i > 20 {
            fmt.Println("...")
            break
        }
	}
}
