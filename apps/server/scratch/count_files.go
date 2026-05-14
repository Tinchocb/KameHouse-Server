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

	var count int64
	database.Model(&models.LocalFile{}).Count(&count)
	fmt.Printf("Total local files: %d\n", count)
}
