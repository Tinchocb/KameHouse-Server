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

	var ddl string
	err = db.QueryRow("SELECT sql FROM sqlite_master WHERE type='table' AND name='local_files'").Scan(&ddl)
	if err != nil {
		log.Fatal(err)
	}

	fmt.Println("DDL for local_files:")
	fmt.Println(ddl)
}
