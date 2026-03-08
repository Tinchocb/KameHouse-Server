package continuity

import (
	"kamehouse/internal/database/db"
	"kamehouse/internal/util"
	"kamehouse/internal/util/filecache"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/require"
)

func GetMockManager(t *testing.T, db *db.Database) *Manager {
	logger := util.NewLogger()
	cacher, err := filecache.NewCacher(filepath.Join(t.TempDir(), "cache"))
	require.NoError(t, err)

	manager := NewManager(&NewManagerOptions{
		FileCacher: cacher,
		Logger:     logger,
		Database:   db,
	})

	return manager
}
