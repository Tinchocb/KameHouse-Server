package db

import (
	"context"
	"errors"
	"fmt"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/glebarez/sqlite"
	"github.com/rs/zerolog"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
	gormlogger "gorm.io/gorm/logger"
	"kamehouse/internal/database/models"
	"kamehouse/internal/database/models/dto"
)

func openProjectionFixture(tb testing.TB, count int) *Database {
	tb.Helper()
	path := filepath.Join(tb.TempDir(), "library.db")
	g, err := gorm.Open(sqlite.Open(path+"?_pragma=journal_mode(WAL)&_pragma=synchronous(NORMAL)&_pragma=busy_timeout(5000)&_pragma=temp_store(MEMORY)"), &gorm.Config{PrepareStmt: true, SkipDefaultTransaction: true, Logger: gormlogger.Default.LogMode(gormlogger.Silent)})
	require.NoError(tb, err)
	sqlDB, err := g.DB()
	require.NoError(tb, err)
	sqlDB.SetMaxOpenConns(4)
	sqlDB.SetMaxIdleConns(4)
	tb.Cleanup(func() { require.NoError(tb, sqlDB.Close()) })
	logger := zerolog.Nop()
	require.NoError(tb, migrateSchema(context.Background(), g, &logger))
	rows := make([]*models.LocalFile, count)
	stamp := time.Date(2026, 11, 1, 12, 0, 0, 0, time.UTC)
	for i := range rows {
		rows[i] = &models.LocalFile{
			BaseModel: models.BaseModel{CreatedAt: stamp, UpdatedAt: stamp},
			Path:      fmt.Sprintf("gdrive://fixture-%06d/episode.mkv", i), Name: fmt.Sprintf("Episode %d.mkv", i%100+1),
			FileHash: "fixture-hash", FileSize: 1_234_567_890, FileModTime: stamp.Unix(), DriveFileID: fmt.Sprintf("fixture-%06d", i),
			MediaID: i/100 + 1, LibraryMediaId: uint(i/100 + 1), Locked: i%3 == 0, Ignored: i%7 == 0,
			ParsedData:       []byte(`{"original":"episode.mkv","title":"Fixture","episode":"1","season":"1"}`),
			ParsedFolderData: []byte(`[{"original":"Fixture","title":"Fixture"}]`),
			EmbeddedMetadata: []byte(`{"title":"Embedded title","season":1,"episode":1}`),
			Metadata:         []byte(`{"episode":1,"episodes":[1],"aniDBEpisode":"1","type":"main"}`),
			TechnicalInfo:    []byte(`{"duration":1440000000000,"size":1234567890,"format":"matroska","videoStream":{"codec":"hevc","width":1920,"height":1080},"audioStreams":[{"codec":"aac","language":"jpn"}],"subtitleStreams":[{"codec":"ass","language":"spa"}]}`),
			Tags:             models.StringSlice{"fixture", "tag2", "tag3", "tag4"},
		}
	}
	if len(rows) > 0 {
		require.NoError(tb, g.Transaction(func(tx *gorm.DB) error { return tx.CreateInBatches(rows, 100).Error }))
	}
	return &Database{gormdb: g, Logger: &logger}
}

func loadProjectionFixture(d *Database, projected bool) ([]*dto.LocalFile, error) {
	if projected {
		return GetAllLocalFilesRelational(d)
	}
	query := d.Gorm().Order("id asc")
	var rows []*models.LocalFile
	if err := query.Find(&rows).Error; err != nil {
		return nil, err
	}
	files := make([]*dto.LocalFile, len(rows))
	for i, row := range rows {
		file, err := LocalFileModelToDto(row)
		if err != nil {
			return nil, err
		}
		files[i] = file
	}
	return files, nil
}

func BenchmarkLargeLocalFilesProjection(b *testing.B) {
	d := openProjectionFixture(b, 50000)
	for _, projected := range []bool{false, true} {
		name := "all_columns"
		if projected {
			name = "dto_columns"
		}
		b.Run(name, func(b *testing.B) {
			b.ReportAllocs()
			for range b.N {
				files, err := loadProjectionFixture(d, projected)
				if err != nil || len(files) != 50000 {
					b.Fatalf("load: %d %v", len(files), err)
				}
			}
		})
	}
}

func TestLocalFilesProjectionPreservesCompleteDTO(t *testing.T) {
	d := openProjectionFixture(t, 3)
	// Cover SQL null JSON alongside complete fields and ordering.
	require.NoError(t, d.Gorm().Model(&models.LocalFile{}).Where("id = ?", 2).Updates(map[string]interface{}{"parsed_data": nil, "parsed_folder_data": nil, "embedded_metadata": nil, "metadata": nil, "technical_info": nil}).Error)
	all, err := loadProjectionFixture(d, false)
	require.NoError(t, err)
	projected, err := loadProjectionFixture(d, true)
	require.NoError(t, err)
	require.Equal(t, all, projected)
	byMedia, err := GetLocalFilesByMediaIDRelational(d, 1)
	require.NoError(t, err)
	require.ElementsMatch(t, all, byMedia)
	// Corrupt JSON still returns the same scalar fallback rather than losing the row.
	require.NoError(t, d.Gorm().Model(&models.LocalFile{}).Where("id = ?", 3).Update("metadata", []byte("{")).Error)
	fallback, err := GetAllLocalFilesRelational(d)
	require.NoError(t, err)
	require.Len(t, fallback, 3)
	require.Equal(t, all[2].Path, fallback[2].Path)
	require.Equal(t, all[2].FileSize, fallback[2].FileSize)
	require.Nil(t, fallback[2].Metadata)
}

func TestLargeSQLiteProjectionPlanAndConcurrentWrite(t *testing.T) {
	d := openProjectionFixture(t, 50000)
	var plan []struct{ Detail string }
	columns := strings.Join(localFileDTOColumns, ",")
	require.NoError(t, d.Gorm().Raw("EXPLAIN QUERY PLAN SELECT "+columns+" FROM local_file WHERE media_id = ?", 250).Scan(&plan).Error)
	var details []string
	for _, row := range plan {
		details = append(details, row.Detail)
	}
	joined := strings.Join(details, "; ")
	require.Contains(t, joined, "SEARCH local_file USING INDEX")
	sqlDB, err := d.Gorm().DB()
	require.NoError(t, err)
	ctx, cancel := context.WithTimeout(t.Context(), 2*time.Second)
	defer cancel()
	rows, err := sqlDB.QueryContext(ctx, "SELECT "+columns+" FROM local_file ORDER BY id")
	require.NoError(t, err)
	defer rows.Close()
	require.True(t, rows.Next()) // Pin a live read cursor/snapshot on one connection.
	start := time.Now()
	_, err = sqlDB.ExecContext(ctx, "UPDATE local_file SET name = ? WHERE id = ?", "updated under reader", 1)
	elapsed := time.Since(start)
	require.NoError(t, err, "a WAL reader should not block the small write")
	require.NoError(t, rows.Close())
	var name string
	require.NoError(t, sqlDB.QueryRowContext(ctx, "SELECT name FROM local_file WHERE id=1").Scan(&name))
	require.Equal(t, "updated under reader", name)
	t.Logf("rows=50000 plan=%q write_during_open_reader=%s", joined, elapsed)
}

func TestProjectedLocalFilesPreserveQueryCancellation(t *testing.T) {
	d := openProjectionFixture(t, 1)
	ctx, cancel := context.WithCancel(t.Context())
	cancel()
	scoped := &Database{gormdb: d.Gorm().WithContext(ctx), Logger: d.Logger}
	_, err := GetAllLocalFilesRelational(scoped)
	require.True(t, errors.Is(err, context.Canceled), "full query: %v", err)
	_, err = GetLocalFilesByMediaIDRelational(scoped, 1)
	require.True(t, errors.Is(err, context.Canceled), "filtered query: %v", err)
}
