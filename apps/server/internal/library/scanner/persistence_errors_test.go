package scanner

import (
	"context"
	"errors"
	"testing"
	"time"

	"gorm.io/gorm"
	"kamehouse/internal/database/models"
	"kamehouse/internal/database/models/dto"
	"kamehouse/internal/util"
)

func TestPersistMatchedMediaPropagatesSQLFailures(t *testing.T) {
	for _, stage := range []string{"existing", "upsert", "identifiers"} {
		t.Run(stage, func(t *testing.T) {
			d := newPersistenceTestDB(t)
			deadline := time.Now().Add(3 * time.Second)
			for {
				complete, err := d.MigrationStatus()
				if err != nil {
					t.Fatal(err)
				}
				if complete {
					break
				}
				if time.Now().After(deadline) {
					t.Fatal("migration did not finish")
				}
				time.Sleep(time.Millisecond)
			}
			failure := errors.New("synthetic persistence failure")
			queries := 0
			if err := d.Gorm().Callback().Query().Before("gorm:query").Register("persistence:fail", func(tx *gorm.DB) {
				if tx.Statement.Table != "library_media" {
					return
				}
				queries++
				if stage == "existing" && queries == 1 || stage == "identifiers" && queries == 2 {
					tx.AddError(failure)
				}
			}); err != nil {
				t.Fatal(err)
			}
			if err := d.Gorm().Callback().Create().Before("gorm:create").Register("persistence:fail", func(tx *gorm.DB) {
				if stage == "upsert" && tx.Statement.Table == "library_media" {
					tx.AddError(failure)
				}
			}); err != nil {
				t.Fatal(err)
			}
			defer d.Gorm().Callback().Query().Remove("persistence:fail")
			defer d.Gorm().Callback().Create().Remove("persistence:fail")
			file := &dto.LocalFile{Path: "/fixture/file.mkv", MediaID: 12345, LibraryMediaId: 99}
			scn := &Scanner{Database: d, Logger: util.NewLogger()}
			ids, err := scn.persistMatchedMedia(context.Background(), map[int]struct{}{12345: {}}, nil, nil, []*dto.LocalFile{file})
			if !errors.Is(err, failure) || ids != nil {
				t.Fatalf("failure was swallowed: ids=%v err=%v", ids, err)
			}
			if file.LibraryMediaId != 99 {
				t.Fatal("failed persistence changed an association")
			}
		})
	}
}

func TestPersistMatchedMediaHonorsCancelledContext(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	ids, err := (&Scanner{}).persistMatchedMedia(ctx, nil, nil, nil, nil)
	if !errors.Is(err, context.Canceled) || ids != nil {
		t.Fatalf("cancelled scan continued: %v", err)
	}
}

func TestPersistMatchedMediaCancellationRollsBackAllBatches(t *testing.T) {
	d := newPersistenceTestDB(t)
	deadline := time.Now().Add(3 * time.Second)
	for {
		complete, err := d.MigrationStatus()
		if err != nil {
			t.Fatal(err)
		}
		if complete {
			break
		}
		if time.Now().After(deadline) {
			t.Fatal("migration did not finish")
		}
		time.Sleep(time.Millisecond)
	}
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	if err := d.Gorm().Callback().Create().After("gorm:create").Register("persistence:cancel", func(tx *gorm.DB) {
		if tx.Statement.Table == "library_media" {
			cancel()
		}
	}); err != nil {
		t.Fatal(err)
	}
	defer d.Gorm().Callback().Create().Remove("persistence:cancel")
	ids := make(map[int]struct{})
	for i := 12345; i < 12357; i++ {
		ids[i] = struct{}{}
	}
	file := &dto.LocalFile{Path: "/fixture/file.mkv", MediaID: 12345, LibraryMediaId: 99}
	scn := &Scanner{Database: d, Logger: util.NewLogger()}
	result, err := scn.persistMatchedMedia(ctx, ids, nil, nil, []*dto.LocalFile{file})
	if err == nil || result != nil || ctx.Err() == nil {
		t.Fatalf("cancelled batch was reported successful: %v", err)
	}
	var count int64
	if err := d.Gorm().Model(&models.LibraryMedia{}).Count(&count).Error; err != nil {
		t.Fatal(err)
	}
	if count != 0 || file.LibraryMediaId != 99 {
		t.Fatalf("cancelled transaction left rows=%d association=%d", count, file.LibraryMediaId)
	}
}
