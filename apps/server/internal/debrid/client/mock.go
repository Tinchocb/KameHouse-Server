package debrid_client

import (
	"kamehouse/internal/api/anilist"
	"kamehouse/internal/api/metadata_provider"
	"kamehouse/internal/database/db"
	"kamehouse/internal/events"
	"kamehouse/internal/extension"
	"kamehouse/internal/platforms/anilist_platform"
	"kamehouse/internal/util"
	"testing"
)

func GetMockRepository(t *testing.T, db *db.Database) *Repository {
	logger := util.NewLogger()
	wsEventManager := events.NewWSEventManager(logger)
	anilistClient := anilist.TestGetMockAnilistClient()
	anilistClientRef := util.NewRef(anilistClient)
	extensionBankRef := util.NewRef(extension.NewUnifiedBank())
	platform := anilist_platform.NewAnilistPlatform(anilistClientRef, extensionBankRef, logger, db)
	metadataProvider := metadata_provider.GetFakeProvider(t, db)
	platformRef := util.NewRef(platform)
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
