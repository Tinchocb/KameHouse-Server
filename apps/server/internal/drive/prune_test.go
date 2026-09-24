package drive

import (
	"context"
	"testing"

	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
	"kamehouse/internal/database/models"
)

func TestPruneDriveFiles(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&models.LocalFile{}))

	kept := DriveFile{ID: "a", RelativePath: "DBZ/E001.mkv"}
	moved := DriveFile{ID: "b", RelativePath: "DBZ/Saga/E002.mkv"}
	for _, p := range []string{
		DrivePath(kept),
		"gdrive://b/DBZ/E002.mkv", // same file ID, old location
		"gdrive://c/DBZ/E003.mkv", // deleted from Drive
		DrivePath(moved),
		"D:/Anime/local.mkv", // local files are never touched
	} {
		require.NoError(t, db.Create(&models.LocalFile{Path: p}).Error)
	}

	pruned, err := PruneDriveFiles(context.Background(), db, []DriveFile{kept, moved})
	require.NoError(t, err)
	require.Equal(t, 2, pruned)

	var paths []string
	require.NoError(t, db.Model(&models.LocalFile{}).Order("path").Pluck("path", &paths).Error)
	require.Equal(t, []string{"D:/Anime/local.mkv", DrivePath(kept), DrivePath(moved)}, paths)
}
