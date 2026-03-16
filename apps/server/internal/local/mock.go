package local

import (
	"kamehouse/internal/api/metadata_provider"
	"kamehouse/internal/database/db"
	"kamehouse/internal/events"
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

	wsEventManager := events.NewMockWSEventManager(logger)

	// extension dependency removed

	localDir := filepath.Join(test_utils.ConfigData.Path.DataDir, "offline")
	assetsDir := filepath.Join(test_utils.ConfigData.Path.DataDir, "offline", "assets")

	m, err := NewManager(&NewManagerOptions{
		LocalDir:            localDir,
		AssetDir:            assetsDir,
		Logger:              util.NewLogger(),
		MetadataProviderRef: metadataProviderRef,
		Database:            db,
		WSEventManager:      wsEventManager,
		PlatformRef:         nil, // platform dependency removed
		IsOffline:           false,
	})
	require.NoError(t, err)

	return m
}
