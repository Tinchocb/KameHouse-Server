package main

import (
	"context"
	"fmt"
	"log"
	"os"

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
	
	fmt.Printf("Total files: %d\n", len(lfs))
	
	for i, lf := range lfs {
		if i < 10 {
			fmt.Printf("Path %d: %s (MediaId: %d)\n", i, lf.Path, lf.MediaId)
		}
	}
}
