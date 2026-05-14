package main

import (
	"database/sql"
	"fmt"
	"log"

	_ "github.com/glebarez/sqlite"
)

func main() {
	dbPath := `C:\Users\marti\AppData\Roaming\KameHouse\kamehouse.db`
	dsn := fmt.Sprintf("%s?_query_only=true&_busy_timeout=1000", dbPath)
	db, err := sql.Open("sqlite", dsn)
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()

	var count int
	err = db.QueryRow("SELECT COUNT(*) FROM local_files WHERE value IS NOT NULL").Scan(&count)
	if err != nil {
		log.Fatal(err)
	}
	fmt.Printf("Rows with blob value: %d\n", count)

	var length int
	err = db.QueryRow("SELECT LENGTH(value) FROM local_files WHERE value IS NOT NULL LIMIT 1").Scan(&length)
	if err == nil {
		fmt.Printf("First blob length: %d bytes\n", length)
	}
}
