package db

import (
	"errors"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"gorm.io/gorm"
	"kamehouse/internal/database/models/dto"
)

func seedSnapshotFile(t *testing.T, d *Database, name string) {
	t.Helper()
	if err := UpsertLocalFileRelationalBatch(d, []*dto.LocalFile{{
		Path: "/snapshot/file.mkv", Name: name, MediaID: 7,
		Metadata:      &dto.LocalFileMetadata{Episodes: []int{1}},
		TechnicalInfo: &dto.FileTechnicalInfo{VideoStream: &dto.VideoStreamInfo{Codec: "hevc"}},
	}}); err != nil {
		t.Fatal(err)
	}
}

func TestLocalFilesSnapshotsOwnedByCallerAndDatabase(t *testing.T) {
	a, b := openSettingsTestDB(t), openSettingsTestDB(t)
	seedSnapshotFile(t, a, "first")
	seedSnapshotFile(t, b, "second")
	for _, d := range []*Database{a, b} {
		if _, _, err := GetLocalFiles(d); err != nil {
			t.Fatal(err)
		}
	}
	files, _, err := GetLocalFiles(a)
	if err != nil {
		t.Fatal(err)
	}
	files[0].Name = "uncommitted"
	files[0].Metadata.Episodes[0] = 99
	files[0].TechnicalInfo.VideoStream.Codec = "uncommitted"
	cached, ok := CachedLocalFiles(a)
	if !ok {
		t.Fatal("cache unexpectedly cold")
	}
	if cached[0].Name != "first" || cached[0].Metadata.Episodes[0] != 1 || cached[0].TechnicalInfo.VideoStream.Codec != "hevc" {
		t.Fatal("caller mutated the published snapshot")
	}
	cached[0].Name = "cached-copy"
	byMedia, err := GetLocalFilesByMediaID(a, 7)
	if err != nil {
		t.Fatal(err)
	}
	byMedia[0].Name = "filtered-copy"
	other, _, err := GetLocalFiles(b)
	if err != nil {
		t.Fatal(err)
	}
	if other[0].Name != "second" {
		t.Fatal("cache leaked across database instances")
	}
	InvalidateLocalFilesCache(b)
	next, _, err := GetLocalFiles(a)
	if err != nil || next[0].Name != "first" {
		t.Fatalf("read aliases caller or other database: %v", err)
	}
}

func TestLocalFilesFailedSaveDoesNotChangeCache(t *testing.T) {
	d := openSettingsTestDB(t)
	seedSnapshotFile(t, d, "saved")
	files, _, err := GetLocalFiles(d)
	if err != nil {
		t.Fatal(err)
	}
	files[0].Name = "not-saved"
	if err := d.Gorm().Callback().Create().Before("gorm:create").Register("snapshot:fail", func(tx *gorm.DB) {
		tx.AddError(errors.New("synthetic save failure"))
	}); err != nil {
		t.Fatal(err)
	}
	defer d.Gorm().Callback().Create().Remove("snapshot:fail")
	if err := UpsertLocalFileRelationalBatch(d, files); err == nil {
		t.Fatal("expected save failure")
	}
	next, _, err := GetLocalFiles(d)
	if err != nil || next[0].Name != "saved" {
		t.Fatalf("failed save changed cache: %v", err)
	}
}

func TestLocalFilesInvalidationSeparatesInflightReads(t *testing.T) {
	d := openSettingsTestDB(t)
	seedSnapshotFile(t, d, "old")
	loaded, release := make(chan struct{}), make(chan struct{})
	var paused atomic.Bool
	var unblock sync.Once
	defer unblock.Do(func() { close(release) })
	if err := d.Gorm().Callback().Query().After("gorm:query").Register("snapshot:pause", func(tx *gorm.DB) {
		if tx.Statement.Table == "local_file" && paused.CompareAndSwap(false, true) {
			close(loaded)
			<-release
		}
	}); err != nil {
		t.Fatal(err)
	}
	defer d.Gorm().Callback().Query().Remove("snapshot:pause")
	type response struct {
		files []*dto.LocalFile
		err   error
	}
	oldResult := make(chan response, 1)
	go func() { files, _, err := GetLocalFiles(d); oldResult <- response{files, err} }()
	select {
	case <-loaded:
	case <-time.After(5 * time.Second):
		t.Fatal("read did not reach pause")
	}
	seedSnapshotFile(t, d, "new")
	freshResult := make(chan response, 1)
	go func() { files, _, err := GetLocalFiles(d); freshResult <- response{files, err} }()
	select {
	case fresh := <-freshResult:
		if fresh.err != nil || len(fresh.files) != 1 || fresh.files[0].Name != "new" {
			t.Fatalf("fresh read joined stale load: %+v", fresh)
		}
	case <-time.After(5 * time.Second):
		t.Fatal("fresh read waited on obsolete generation")
	}
	unblock.Do(func() { close(release) })
	select {
	case old := <-oldResult:
		if old.err != nil {
			t.Fatal(old.err)
		}
	case <-time.After(5 * time.Second):
		t.Fatal("old read stuck")
	}
	next, _, err := GetLocalFiles(d)
	if err != nil || next[0].Name != "new" {
		t.Fatalf("obsolete read republished stale cache: %v", err)
	}
}

func TestLocalFilesConcurrentCallerMutations(t *testing.T) {
	d := openSettingsTestDB(t)
	seedSnapshotFile(t, d, "saved")
	if _, _, err := GetLocalFiles(d); err != nil {
		t.Fatal(err)
	}
	var wg sync.WaitGroup
	for i := 0; i < 8; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for j := 0; j < 30; j++ {
				files, _, err := GetLocalFiles(d)
				if err != nil {
					t.Error(err)
					return
				}
				files[0].Name = "caller"
				files[0].Metadata.Episodes[0]++
				files[0].TechnicalInfo.VideoStream.Codec = "caller"
			}
		}()
	}
	wg.Wait()
	files, _, err := GetLocalFiles(d)
	if err != nil || files[0].Name != "saved" || files[0].Metadata.Episodes[0] != 1 {
		t.Fatalf("concurrent mutation escaped: %v", err)
	}
}
