package main

import (
	"database/sql"
	"fmt"
	"log"
	
	_ "github.com/glebarez/go-sqlite"
)

func main() {
	db, err := sql.Open("sqlite", "C:/Users/Tinchoo/AppData/Roaming/KameHouse/kamehouse.db")
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()

	rows, err := db.Query("SELECT path, media_id, library_media_id FROM local_file WHERE path LIKE '%Kai%' LIMIT 10")
	if err != nil {
		log.Fatal(err)
	}
	defer rows.Close()

	fmt.Println("Local Files with 'Kai' in path:")
	for rows.Next() {
		var path string
		var mediaID, libMediaID sql.NullInt64
		if err := rows.Scan(&path, &mediaID, &libMediaID); err != nil {
			log.Fatal(err)
		}
		
		mID := int64(0)
		if mediaID.Valid { mID = mediaID.Int64 }
		lmID := int64(0)
		if libMediaID.Valid { lmID = libMediaID.Int64 }
		
		fmt.Printf(" - Path: %q, MediaID: %d, LibraryMediaID: %d\n", path, mID, lmID)
	}
}
