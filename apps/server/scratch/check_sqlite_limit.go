package main

import (
	"database/sql"
	"fmt"
	"log"

	_ "github.com/glebarez/sqlite"
)

func main() {
	dbPath := ":memory:"
	db, err := sql.Open("sqlite", dbPath)
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()

	var limit int
	// SQLITE_LIMIT_VARIABLE_NUMBER is 9
	err = db.QueryRow("SELECT sqlite_limit(9, -1)").Scan(&limit)
	if err != nil {
		log.Fatal(err)
	}
	fmt.Printf("SQLITE_LIMIT_VARIABLE_NUMBER: %d\n", limit)
}
