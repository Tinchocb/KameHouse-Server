package db

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/glebarez/sqlite"
	"github.com/rs/zerolog"
	"gorm.io/gorm"
	gormlogger "gorm.io/gorm/logger"
	"kamehouse/internal/database/models"
	"kamehouse/internal/database/models/dto"
)

func openBackendSafetyDB(t *testing.T) *gorm.DB {
	t.Helper()
	g, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{Logger: gormlogger.Discard})
	if err != nil {
		t.Fatal(err)
	}
	pool, err := g.DB()
	if err != nil {
		t.Fatal(err)
	}
	pool.SetMaxOpenConns(1)
	t.Cleanup(func() {
		if err := pool.Close(); err != nil {
			t.Error(err)
		}
	})
	return g
}

func seedLegacySnapshot(t *testing.T, g *gorm.DB, body []byte) {
	t.Helper()
	if err := g.AutoMigrate(&models.LocalFiles{}, &models.LocalFile{}); err != nil {
		t.Fatal(err)
	}
	if err := g.Create(&models.LocalFiles{Value: body}).Error; err != nil {
		t.Fatal(err)
	}
}

func assertLegacySnapshotPreserved(t *testing.T, g *gorm.DB, body []byte) {
	t.Helper()
	var legacy models.LocalFiles
	if err := g.Table("local_files").Last(&legacy).Error; err != nil {
		t.Fatalf("legacy snapshot lost: %v", err)
	}
	if string(legacy.Value) != string(body) {
		t.Fatalf("legacy snapshot changed: %s", legacy.Value)
	}
}

func TestLegacyMigrationPreservesInvalidSnapshots(t *testing.T) {
	for _, body := range []string{`{broken`, `null`, `[null]`, `[{"path":""}]`} {
		t.Run(body, func(t *testing.T) {
			g := openBackendSafetyDB(t)
			seedLegacySnapshot(t, g, []byte(body))
			if err := migrateLegacyLocalFiles(g); err == nil {
				t.Fatal("invalid snapshot accepted")
			}
			assertLegacySnapshotPreserved(t, g, []byte(body))
			var count int64
			if err := g.Model(&models.LocalFile{}).Count(&count).Error; err != nil {
				t.Fatal(err)
			}
			if count != 0 {
				t.Fatalf("partial migration: %d rows", count)
			}
		})
	}
}

func TestLegacyMigrationRequiresReconciliationForMixedTables(t *testing.T) {
	g := openBackendSafetyDB(t)
	body := []byte(`[{"path":"C:/legacy/ep.mkv"}]`)
	seedLegacySnapshot(t, g, body)
	if err := g.Create(&models.LocalFile{Path: "C:/current/ep.mkv"}).Error; err != nil {
		t.Fatal(err)
	}
	if err := migrateLegacyLocalFiles(g); err == nil || !strings.Contains(err.Error(), "reconciliation") {
		t.Fatalf("expected reconciliation error, got %v", err)
	}
	assertLegacySnapshotPreserved(t, g, body)
	var count int64
	if err := g.Model(&models.LocalFile{}).Count(&count).Error; err != nil {
		t.Fatal(err)
	}
	if count != 1 {
		t.Fatalf("relational rows changed: %d", count)
	}
}

func TestLegacyMigrationPreservesSourceOnQueryErrors(t *testing.T) {
	for _, failCount := range []bool{true, false} {
		t.Run(map[bool]string{true: "count", false: "snapshot"}[failCount], func(t *testing.T) {
			g := openBackendSafetyDB(t)
			body := []byte("[{\"path\":\"C:/legacy/ep.mkv\"}]")
			seedLegacySnapshot(t, g, body)
			failure := errors.New("injected legacy query failure")
			const callback = "test:legacy_query_failure"
			if err := g.Callback().Query().Before("gorm:query").Register(callback, func(tx *gorm.DB) {
				_, isSnapshot := tx.Statement.Dest.(*models.LocalFiles)
				if tx.Statement.Table == "local_files" && isSnapshot != failCount {
					tx.AddError(failure)
				}
			}); err != nil {
				t.Fatal(err)
			}
			err := migrateLegacyLocalFiles(g)
			g.Callback().Query().Remove(callback)
			if !errors.Is(err, failure) {
				t.Fatalf("query failure swallowed: %v", err)
			}
			assertLegacySnapshotPreserved(t, g, body)
		})
	}
}

func TestLegacyMigrationRollsBackEarlierBatches(t *testing.T) {
	g := openBackendSafetyDB(t)
	files := make([]*dto.LocalFile, 101)
	for i := range files {
		files[i] = &dto.LocalFile{Path: fmt.Sprintf("C:/legacy/ep-%d.mkv", i)}
	}
	files[100].Path = files[0].Path // Fail after the first 100-row batch.
	body, err := json.Marshal(files)
	if err != nil {
		t.Fatal(err)
	}
	seedLegacySnapshot(t, g, body)
	if err := migrateLegacyLocalFiles(g); err == nil {
		t.Fatal("duplicate paths accepted")
	}
	assertLegacySnapshotPreserved(t, g, body)
	var count int64
	if err := g.Model(&models.LocalFile{}).Count(&count).Error; err != nil {
		t.Fatal(err)
	}
	if count != 0 {
		t.Fatalf("earlier batch was not rolled back: %d rows", count)
	}
}

func TestLegacyMigrationPreservesFileMetadataAndIsIdempotent(t *testing.T) {
	g := openBackendSafetyDB(t)
	file := &dto.LocalFile{
		Path: "C:/legacy/ep.mkv", Name: "ep.mkv", FileHash: "original-hash",
		FileSize: 123456, FileModTime: 1700000000, DriveFileID: "drive-file-id", Locked: true,
		EmbeddedMetadata: &dto.LocalFileEmbeddedMetadata{Title: "Embedded title"},
		Metadata:         &dto.LocalFileMetadata{Episodes: []int{1}, Episode: 1},
	}
	body, err := json.Marshal([]*dto.LocalFile{file})
	if err != nil {
		t.Fatal(err)
	}
	seedLegacySnapshot(t, g, body)
	for range 2 {
		if err := migrateLegacyLocalFiles(g); err != nil {
			t.Fatal(err)
		}
	}
	if g.Migrator().HasTable("local_files") {
		t.Fatal("success did not retire legacy table")
	}
	var rows []models.LocalFile
	if err := g.Find(&rows).Error; err != nil {
		t.Fatal(err)
	}
	if len(rows) != 1 {
		t.Fatalf("got %d migrated rows", len(rows))
	}
	got, err := LocalFileModelToDto(&rows[0])
	if err != nil {
		t.Fatal(err)
	}
	if got.Path != file.Path || got.FileHash != file.FileHash || got.FileSize != file.FileSize || got.FileModTime != file.FileModTime || got.DriveFileID != file.DriveFileID || !got.Locked || got.EmbeddedMetadata == nil || got.EmbeddedMetadata.Title != file.EmbeddedMetadata.Title || got.Metadata == nil || got.Metadata.Episode != 1 {
		t.Fatalf("metadata lost: %+v", got)
	}
}

func TestLibraryMediaMappingsInvalidateCache(t *testing.T) {
	g := openBackendSafetyDB(t)
	if err := g.AutoMigrate(&models.LibraryMedia{}); err != nil {
		t.Fatal(err)
	}
	m := &models.LibraryMedia{TmdbID: 123, Type: "SHOW", MyanimelistId: 10}
	if err := g.Create(m).Error; err != nil {
		t.Fatal(err)
	}
	d := &Database{gormdb: g}
	if _, err := GetLibraryMediaByTmdbIdAndType(d, 123, "SHOW"); err != nil {
		t.Fatal(err)
	}
	if err := UpdateLibraryMediaMappings(d, m.ID, 2, 20); err != nil {
		t.Fatal(err)
	}
	got, err := GetLibraryMediaByTmdbIdAndType(d, 123, "SHOW")
	if err != nil {
		t.Fatal(err)
	}
	if got == nil || got.MyanimelistId != 20 || got.AnidbId != 2 {
		t.Fatalf("stale mapping: %+v", got)
	}
	pool, _ := g.DB()
	if err := pool.Close(); err != nil {
		t.Fatal(err)
	}
	if err := UpdateLibraryMediaMappings(d, m.ID, 3, 30); err == nil {
		t.Fatal("closed DB update succeeded")
	}
	if got, err := GetLibraryMediaByTmdbIdAndType(d, 123, "SHOW"); err != nil || got == nil || got.MyanimelistId != 20 {
		t.Fatalf("failed SQL discarded valid cached data: %v %v", got, err)
	}
}

// A SQL read finishing after a committed write must not poison its cache.
func TestLibraryMediaConcurrentReadCannotRepublishStaleData(t *testing.T) {
	for _, existing := range []bool{true, false} {
		t.Run(fmt.Sprintf("existing=%v", existing), func(t *testing.T) {
			g := openBackendSafetyDB(t)
			if err := g.AutoMigrate(&models.LibraryMedia{}); err != nil {
				t.Fatal(err)
			}
			m := &models.LibraryMedia{BaseModel: models.BaseModel{ID: 1}, TmdbID: 123, Type: "SHOW", MyanimelistId: 10}
			if existing {
				if err := g.Create(m).Error; err != nil {
					t.Fatal(err)
				}
			}
			d := &Database{gormdb: g}
			read := func() (*models.LibraryMedia, error) {
				return GetLibraryMediaByTmdbIdAndType(d, 123, "SHOW")
			}
			captured, resume, finished := make(chan struct{}), make(chan struct{}), make(chan struct{})
			var once sync.Once
			unblock := func() { once.Do(func() { close(resume) }) }
			var paused atomic.Bool
			const callback = "test:pause_library_media_read"
			if err := g.Callback().Query().After("gorm:query").Register(callback, func(tx *gorm.DB) {
				if tx.Statement.Table == "library_media" && paused.CompareAndSwap(false, true) {
					close(captured)
					<-resume
				}
			}); err != nil {
				t.Fatal(err)
			}
			t.Cleanup(func() { g.Callback().Query().Remove(callback) })
			type result struct {
				media *models.LibraryMedia
				err   error
			}
			old := make(chan result, 1)
			go func() { defer close(finished); m, err := read(); old <- result{m, err} }()
			defer func() {
				unblock()
				select {
				case <-finished:
				case <-time.After(3 * time.Second):
					t.Error("old reader did not finish")
				}
			}()
			select {
			case <-captured:
			case <-time.After(3 * time.Second):
				t.Fatal("SQL snapshot not captured")
			}
			if existing {
				if err := UpdateLibraryMediaMappings(d, 1, 2, 20); err != nil {
					t.Fatal(err)
				}
			} else {
				m.MyanimelistId = 20
				if _, err := InsertLibraryMedia(d, m); err != nil {
					t.Fatal(err)
				}
			}
			if got, err := read(); err != nil || got == nil || got.MyanimelistId != 20 {
				t.Fatalf("write not visible: %+v %v", got, err)
			}
			unblock()
			previous := <-old
			if previous.err != nil {
				t.Fatal(previous.err)
			}
			if existing && (previous.media == nil || previous.media.MyanimelistId != 10) {
				t.Fatalf("old reader did not retain snapshot: %+v", previous.media)
			}
			if !existing && previous.media != nil {
				t.Fatalf("old negative read changed: %+v", previous.media)
			}
			if got, err := read(); err != nil || got == nil || got.MyanimelistId != 20 {
				t.Fatalf("late reader poisoned cache: %+v %v", got, err)
			}
		})
	}
}

func TestLibraryMediaWritersInvalidateNegativeCache(t *testing.T) {
	for _, writer := range []struct {
		name  string
		write func(*Database, *models.LibraryMedia) error
	}{
		{"single", func(d *Database, m *models.LibraryMedia) error { _, err := InsertLibraryMedia(d, m); return err }},
		{"batch", func(d *Database, m *models.LibraryMedia) error {
			return UpsertLibraryMediaBatchContext(context.Background(), d, []*models.LibraryMedia{m}, 10)
		}},
		{"missing", func(d *Database, m *models.LibraryMedia) error {
			return InsertLibraryMediaBatchIfMissing(d, []*models.LibraryMedia{m}, 10)
		}},
	} {
		t.Run(writer.name, func(t *testing.T) {
			g := openBackendSafetyDB(t)
			if err := g.AutoMigrate(&models.LibraryMedia{}); err != nil {
				t.Fatal(err)
			}
			d := &Database{gormdb: g}
			if got, err := GetLibraryMediaByTmdbIdAndType(d, 123, "SHOW"); err != nil || got != nil {
				t.Fatalf("unexpected initial row: %v %v", got, err)
			}
			m := &models.LibraryMedia{BaseModel: models.BaseModel{ID: 1}, TmdbID: 123, Type: "SHOW", TitleEnglish: "Created"}
			if err := writer.write(d, m); err != nil {
				t.Fatal(err)
			}
			got, err := GetLibraryMediaByTmdbIdAndType(d, 123, "SHOW")
			if err != nil || got == nil || got.TitleEnglish != "Created" {
				t.Fatalf("negative TMDB cache retained: %v %v", got, err)
			}
		})
	}
}

func TestSchemaCreatesEpisodeAbsoluteIndex(t *testing.T) {
	g := openBackendSafetyDB(t)
	logger := zerolog.Nop()
	if err := migrateSchema(context.Background(), g, &logger); err != nil {
		t.Fatal(err)
	}
	var plan []struct{ Detail string }
	if err := g.Raw("EXPLAIN QUERY PLAN SELECT image, absolute_number, title, saga_name FROM library_episodes WHERE library_media_id = ? AND absolute_number = ? ORDER BY id LIMIT 1", 1, 42).Scan(&plan).Error; err != nil {
		t.Fatal(err)
	}
	found := false
	for _, row := range plan {
		if strings.Contains(row.Detail, "idx_library_episodes_media_absolute") && strings.Contains(row.Detail, "absolute_number=?") {
			found = true
		}
	}
	if !found {
		t.Fatalf("episode query does not use the composite index: %+v", plan)
	}
}

func TestDataMigrationPanicPublishesFailure(t *testing.T) {
	logger := zerolog.Nop()
	d := &Database{Logger: &logger} // Fault injection: nil GORM panics during migration.
	d.startDataMigrations(context.Background())
	select {
	case <-d.migrationsDone:
	case <-time.After(3 * time.Second):
		t.Fatal("migration waiters blocked after panic")
	}
	complete, err := d.MigrationStatus()
	if !complete || err == nil || !strings.Contains(err.Error(), "panic") {
		t.Fatalf("panic not published: complete=%v err=%v", complete, err)
	}
}

func TestDataMigrationErrorPublishesFailure(t *testing.T) {
	g := openBackendSafetyDB(t)
	seedLegacySnapshot(t, g, []byte("{broken"))
	logger := zerolog.Nop()
	d := &Database{gormdb: g, Logger: &logger}
	d.startDataMigrations(context.Background())
	select {
	case <-d.migrationsDone:
	case <-time.After(3 * time.Second):
		t.Fatal("migration did not finish")
	}
	complete, err := d.MigrationStatus()
	if !complete || err == nil {
		t.Fatalf("error not published: complete=%v err=%v", complete, err)
	}
	assertLegacySnapshotPreserved(t, g, []byte("{broken"))
}

func TestDatabaseConstructorRejectsNilLogger(t *testing.T) {
	if d, err := NewDatabase(context.Background(), t.TempDir(), "nil-logger", nil); err == nil || d != nil {
		t.Fatalf("got database=%v err=%v", d, err)
	}
}

func TestDatabaseConstructorCanceledContextReleasesFile(t *testing.T) {
	t.Setenv("TEST_ENV", "")
	dir := t.TempDir()
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	logger := zerolog.Nop()
	if d, err := NewDatabase(ctx, dir, "canceled", &logger); err == nil || d != nil || !errors.Is(err, context.Canceled) {
		t.Fatalf("got database=%v err=%v", d, err)
	}
	path := filepath.Join(dir, "canceled.db")
	if _, err := os.Stat(path); err == nil {
		if err := os.Rename(path, path+".released"); err != nil {
			t.Fatalf("database file remains open: %v", err)
		}
	}
}

func TestDatabaseConstructorReturnsSchemaErrorAndReleasesFile(t *testing.T) {
	t.Setenv("TEST_ENV", "")
	dir := t.TempDir()
	path := filepath.Join(dir, "invalid.db")
	g, err := gorm.Open(sqlite.Open(path), &gorm.Config{Logger: gormlogger.Discard})
	if err != nil {
		t.Fatal(err)
	}
	if err := g.Exec("CREATE VIEW library_episodes AS SELECT 1 AS id").Error; err != nil {
		t.Fatal(err)
	}
	pool, _ := g.DB()
	if err := pool.Close(); err != nil {
		t.Fatal(err)
	}
	logger := zerolog.Nop()
	d, err := NewDatabase(context.Background(), dir, "invalid", &logger)
	if err == nil || d != nil {
		if d != nil {
			_ = d.Close()
		}
		t.Fatalf("expected schema error, got %v", err)
	}
	if !strings.Contains(err.Error(), "migrate database schema") {
		t.Fatalf("unexpected failure: %v", err)
	}
	if err := os.Rename(path, path+".released"); err != nil {
		t.Fatalf("database file remains open after schema failure: %v", err)
	}
}
