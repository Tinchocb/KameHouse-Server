package main

import (
	"fmt"
	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
	"log"
)

func main() {
	database, err := gorm.Open(sqlite.Open("C:\\Users\\marti\\AppData\\Roaming\\KameHouse\\kamehouse.db"), &gorm.Config{})
	if err != nil {
		log.Fatal(err)
	}

	var tables []string
	database.Raw("SELECT name FROM sqlite_master WHERE type='table'").Scan(&tables)
	fmt.Printf("Tables: %v\n", tables)

    type TableInfo struct {
        Name string
        Type string
    }
    var info []TableInfo
    database.Raw("PRAGMA table_info(local_files)").Scan(&info)
    for _, i := range info {
        fmt.Printf("Col: %s (%s)\n", i.Name, i.Type)
    }
}
