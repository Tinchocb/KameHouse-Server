package main

import (
	"context"
	"fmt"
	"kamehouse/internal/database/db"
	"kamehouse/internal/database/models/dto"
	"os"
	"path/filepath"

	"github.com/rs/zerolog"
	_ "github.com/glebarez/sqlite"
)

func main() {
	logger := zerolog.New(os.Stdout).With().Logger()
	appDataDir := filepath.Join(os.Getenv("APPDATA"), "KameHouse")
	
	d, err := db.NewDatabase(context.Background(), appDataDir, "kamehouse", &logger)
	if err != nil {
		fmt.Printf("Failed to open DB: %v\n", err)
		return
	}

	files := make([]*dto.LocalFile, 100)
	for i := 0; i < 100; i++ {
		files[i] = &dto.LocalFile{
			Path: fmt.Sprintf("D:\\FakePath\\File%d.mkv", i),
			Name: fmt.Sprintf("File%d.mkv", i),
		}
	}

	err = db.UpsertLocalFileRelationalBatch(d, files)
	if err != nil {
		fmt.Printf("FAILED with 100 files: %v\n", err)
	} else {
		fmt.Printf("SUCCESS with 100 files\n")
	}

	filesSmall := make([]*dto.LocalFile, 50)
	for i := 0; i < 50; i++ {
		filesSmall[i] = &dto.LocalFile{
			Path: fmt.Sprintf("D:\\FakePath\\FileSmall%d.mkv", i),
			Name: fmt.Sprintf("FileSmall%d.mkv", i),
		}
	}

	err = db.UpsertLocalFileRelationalBatch(d, filesSmall)
	if err != nil {
		fmt.Printf("FAILED with 50 files: %v\n", err)
	} else {
		fmt.Printf("SUCCESS with 50 files\n")
	}
}
