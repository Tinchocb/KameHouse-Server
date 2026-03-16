package debrid_client

import (
	"kamehouse/internal/api/metadata_provider"
	"kamehouse/internal/database/db"
	"kamehouse/internal/events"
	"kamehouse/internal/platforms/platform"
	"kamehouse/internal/util"
	"testing"
)

func GetMockRepository(t *testing.T, db *db.Database) *Repository {
	logger := util.NewLogger()
	wsEventManager := events.NewWSEventManager(logger)
	metadataProvider := metadata_provider.GetFakeProvider(t, db)
	platformRef := util.NewRef[platform.Platform](nil)
	metadataProviderRef := util.NewRef(metadataProvider)

	r := NewRepository(&NewRepositoryOptions{
		Logger:              logger,
		WSEventManager:      wsEventManager,
		Database:            db,
		MetadataProviderRef: metadataProviderRef,
		PlatformRef:         platformRef,
	})

	return r
}
