package db

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/rs/zerolog"
	"gorm.io/gorm"
	"kamehouse/internal/database/models"
)

func TestMaintenanceCanceledPreservesExpiredMetadata(t *testing.T) {
	g := openBackendSafetyDB(t)
	if err := g.AutoMigrate(&models.MetadataCache{}); err != nil {
		t.Fatal(err)
	}
	if err := g.Create(&models.MetadataCache{Provider: "test", Key: "expired", ExpiresAt: time.Now().Add(-time.Hour)}).Error; err != nil {
		t.Fatal(err)
	}
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	d := &Database{gormdb: g}
	deleted, err := DeleteExpiredMetadataCacheContext(ctx, d)
	if !errors.Is(err, context.Canceled) || deleted != 0 {
		t.Fatalf("deleted=%d err=%v", deleted, err)
	}
	var count int64
	if err := g.Model(&models.MetadataCache{}).Count(&count).Error; err != nil || count != 1 {
		t.Fatalf("count=%d err=%v", count, err)
	}
}

func TestCleanupStopsAfterCancellationDuringQuery(t *testing.T) {
	g := openBackendSafetyDB(t)
	if err := g.AutoMigrate(&models.ScanSummary{}); err != nil {
		t.Fatal(err)
	}
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	queries := 0
	if err := g.Callback().Query().Before("gorm:query").Register("test:cancel-cleanup", func(tx *gorm.DB) {
		queries++
		if tx.Statement.Context != ctx {
			t.Error("maintenance query lost its context")
		}
		cancel()
	}); err != nil {
		t.Fatal(err)
	}
	logger := zerolog.Nop()
	manager := NewCleanupManager(g, &logger)
	manager.RunAllCleanupOperations(ctx)
	if queries != 1 {
		t.Fatalf("queries after cancellation: %d", queries)
	}
	if manager.gormdb.Statement.Context.Err() != nil {
		t.Fatal("shared GORM context was mutated")
	}
}
