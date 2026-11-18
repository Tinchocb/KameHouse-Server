package scanner

import (
	"context"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/require"
	"kamehouse/internal/database/db"
	"kamehouse/internal/database/models"
	"kamehouse/internal/database/models/dto"
)

func TestDeepScanReidentifiesWorkingCopiesAndPreservesSkippedFiles(t *testing.T) {
	for _, mode := range []string{"fast", "deep"} {
		t.Run(mode, func(t *testing.T) {
			dir := t.TempDir()
			path := filepath.Join(dir, "Episode 01.mkv")
			info := writeFile(t, path, "video")
			known := &dto.LocalFile{Path: path, Name: "Episode 01.mkv", FileSize: info.Size(), FileModTime: info.ModTime().Unix(), MediaID: 123, LibraryMediaId: 7, ParsedData: &dto.LocalFileParsedData{}, Metadata: &dto.LocalFileMetadata{Episode: 1}}
			lockedPath := filepath.Join(dir, "Episode 02.mkv")
			writeFile(t, lockedPath, "video")
			locked := &dto.LocalFile{Path: lockedPath, Locked: true, MediaID: 123, LibraryMediaId: 7}
			drive := &dto.LocalFile{Path: "gdrive://file", MediaID: 123, LibraryMediaId: 7}
			scn := newPhaseScanner()
			scn.ScanMode = mode
			scn.SkipLockedFiles = true
			scn.ExistingLocalFiles = []*dto.LocalFile{known, locked, drive}
			skipped := scn.collectSkippedLocalFiles([]string{dir})
			require.Same(t, locked, skipped[locked.GetNormalizedPath()])
			require.Same(t, drive, skipped[drive.GetNormalizedPath()])
			// Exercise discovery even in fast mode, independently of its skip optimization.
			files := scn.createLocalFiles(context.Background(), []string{path}, []string{dir}, nil)
			require.Len(t, files, 1)
			if mode == "deep" {
				require.Zero(t, files[0].MediaID)
				require.Zero(t, files[0].LibraryMediaId)
				files[0].Metadata.Episode = 99
				require.Equal(t, 1, known.Metadata.Episode)
			} else {
				require.Equal(t, 123, files[0].MediaID)
				require.EqualValues(t, 7, files[0].LibraryMediaId)
			}
			require.Equal(t, 123, known.MediaID)
			require.EqualValues(t, 7, known.LibraryMediaId)
		})
	}
}

func TestDeepScanIgnoresGhostWithoutErasingPersistedAssociations(t *testing.T) {
	database := newPersistenceTestDB(t)
	dir := t.TempDir()
	path := filepath.Join(dir, "ZXQPV 01.mkv")
	info := writeFile(t, path, "video")
	media := models.LibraryMedia{Type: "SHOW", TmdbID: 123}
	require.NoError(t, database.Gorm().Create(&media).Error)
	known := &dto.LocalFile{Path: path, Name: "ZXQPV 01.mkv", MediaID: 123, LibraryMediaId: media.ID, FileSize: info.Size(), FileModTime: info.ModTime().Unix(), ParsedData: &dto.LocalFileParsedData{Title: "ZXQPV"}, Metadata: &dto.LocalFileMetadata{Episode: 1}}
	require.NoError(t, db.UpsertLocalFileRelationalBatch(database, []*dto.LocalFile{known}))
	require.NoError(t, database.ResolveGhostAssociation(path, 123))
	scn := newPhaseScanner()
	scn.Database = database
	scn.ScanMode = "deep"
	scn.ExistingLocalFiles = []*dto.LocalFile{known}
	files := scn.createLocalFiles(context.Background(), []string{path}, []string{dir}, nil)
	require.Len(t, files, 1)
	catalog := &MediaContainer{NormalizedMedia: []*dto.NormalizedMedia{{ID: 123, Title: &dto.NormalizedMediaTitle{Romaji: ptrStr("Completely Unrelated Catalog")}}}}
	for _, ignore := range []bool{false, true} {
		file := files[0].Clone()
		matcher := &Matcher{MediaContainer: catalog, Logger: scn.Logger, Database: database, IgnoreGhostAssociations: ignore}
		matcher.BayesianResolve(file)
		if ignore {
			require.Zero(t, file.MediaID)
		} else {
			require.Equal(t, 123, file.MediaID)
		}
	}
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	_, err := scn.Scan(ctx)
	require.ErrorIs(t, err, context.Canceled)
	persisted, err := db.GetLocalFilesByMediaID(database, 123)
	require.NoError(t, err)
	require.Len(t, persisted, 1)
	require.Equal(t, media.ID, persisted[0].LibraryMediaId)
	ghost, err := database.GetGhostAssociationByPath(path)
	require.NoError(t, err)
	require.NotNil(t, ghost)
	require.True(t, ghost.UserResolved)
	require.Equal(t, 123, ghost.TargetMediaID)
}
