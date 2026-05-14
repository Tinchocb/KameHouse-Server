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

	var legacy models.LocalFiles
	result := database.Last(&legacy)
	if result.Error != nil {
		fmt.Printf("Error finding legacy local files: %v\n", result.Error)
	} else {
		fmt.Printf("Legacy LocalFiles found, ID: %d, Length: %d\n", legacy.ID, len(legacy.Value))
	}
}
