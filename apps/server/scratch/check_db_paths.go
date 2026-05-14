package main

import (
	"fmt"
	"log"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

type LocalFile struct {
	Path string `gorm:"primaryKey"`
}

func main() {
	dbPath := `C:\Users\marti\AppData\Roaming\KameHouse\kamehouse.db`
	db, err := gorm.Open(sqlite.Open(dbPath), &gorm.Config{})
	if err != nil {
		log.Fatal(err)
	}

	var files []LocalFile
	if err := db.Find(&files).Error; err != nil {
		log.Fatal(err)
	}

	fmt.Printf("Found %d files in local_files table\n", len(files))
	for _, f := range files {
		fmt.Printf("Path: %s\n", f.Path)
	}
}
