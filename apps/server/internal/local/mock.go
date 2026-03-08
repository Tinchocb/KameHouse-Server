package local

import (
	"kamehouse/internal/api/anilist"
	"kamehouse/internal/api/metadata_provider"
	"kamehouse/internal/database/db"
	"kamehouse/internal/events"
	"kamehouse/internal/extension"
	"kamehouse/internal/manga"
	"kamehouse/internal/platforms/anilist_platform"
	"kamehouse/internal/platforms/platform"
	"kamehouse/internal/test_utils"
	"kamehouse/internal/util"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/require"
)

func GetMockManager(t *testing.T, db *db.Database) Manager {
	logger := util.NewLogger()
	metadataProvider := metadata_provider.GetFakeProvider(t, db)
	metadataProviderRef := util.NewRef[metadata_provider.Provider](metadataProvider)
	mangaRepository := manga.GetFakeRepository(t, db)

	wsEventManager := events.NewMockWSEventManager(logger)
	anilistClient := anilist.NewMockAnilistClient()
	anilistClientRef := util.NewRef[anilist.AnilistClient](anilistClient)
	extensionBankRef := util.NewRef(extension.NewUnifiedBank())
	anilistPlatform := anilist_platform.NewAnilistPlatform(anilistClientRef, extensionBankRef, logger, db)
	anilistPlatformRef := util.NewRef[platform.Platform](anilistPlatform)

	localDir := filepath.Join(test_utils.ConfigData.Path.DataDir, "offline")
	assetsDir := filepath.Join(test_utils.ConfigData.Path.DataDir, "offline", "assets")

	m, err := NewManager(&NewManagerOptions{
		LocalDir:            localDir,
		AssetDir:            assetsDir,
		Logger:              util.NewLogger(),
		MetadataProviderRef: metadataProviderRef,
		MangaRepository:     mangaRepository,
		Database:            db,
		WSEventManager:      wsEventManager,
		AnilistPlatformRef:  anilistPlatformRef,
		IsOffline:           false,
	})
	require.NoError(t, err)

	return m
}
