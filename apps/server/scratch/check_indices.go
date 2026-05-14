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

	rows, err := db.Query("SELECT name, sql FROM sqlite_master WHERE type='index' AND tbl_name='local_files'")
	if err != nil {
		log.Fatal(err)
	}
	defer rows.Close()

	fmt.Println("Indices for local_files:")
	for rows.Next() {
		var name string
		var sql sql.NullString
		rows.Scan(&name, &sql)
		fmt.Printf("Index: %s, SQL: %s\n", name, sql.String)
	}
}
