//go:build ignore

package main

import (
	"fmt"
	"os"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

func main() {
	dbPath := os.Getenv("APPDATA") + "\\KameHouse\\kamehouse.db"
	db, err := gorm.Open(sqlite.Open(dbPath), &gorm.Config{})
	if err != nil {
		fmt.Println("Error connecting to db:", err)
		return
	}

	res := db.Exec("DELETE FROM metadata_caches")
	if res.Error != nil {
		fmt.Println("Error deleting cache:", res.Error)
		return
	}
	
	fmt.Printf("Cleared %d cache entries\n", res.RowsAffected)
}
