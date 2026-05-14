package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"strings"

	"github.com/rs/zerolog"

	"kamehouse/internal/database/db"
)

func main() {
	logger := zerolog.New(os.Stdout).With().Timestamp().Logger()
	ctx := context.Background()

	appDataDir := `C:\Users\marti\AppData\Roaming\KameHouse`
	dbName := "kamehouse"

	database, err := db.NewDatabase(ctx, appDataDir, dbName, &logger)
	if err != nil {
		log.Fatal(err)
	}

	lfs, _, _ := db.GetLocalFiles(database)
	
	realCount := 0
	fakeCount := 0
	matchedCount := 0
	
	for _, lf := range lfs {
		if strings.Contains(strings.ToLower(lf.Path), "fakepath") {
			fakeCount++
		} else {
			realCount++
			if lf.MediaId != 0 {
				matchedCount++
			}
		}
	}
	
	fmt.Printf("Total files in DB: %d\n", len(lfs))
	fmt.Printf("Real files: %d\n", realCount)
	fmt.Printf("Fake files: %d\n", fakeCount)
	fmt.Printf("Matched real files: %d\n", matchedCount)
}
