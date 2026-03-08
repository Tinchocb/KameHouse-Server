package mocks

import (
	"kamehouse/internal/api/metadata_provider"
	"kamehouse/internal/continuity"
	"kamehouse/internal/database/db"
	"kamehouse/internal/events"
	"kamehouse/internal/extension"
	"kamehouse/internal/extension_repo"
	"kamehouse/internal/manga"
	"kamehouse/internal/util"
	"kamehouse/internal/util/filecache"
	"path/filepath"
	"testing"

	"github.com/rs/zerolog"
	"github.com/stretchr/testify/require"
)

// TestEnv is a centralized test environment that shares database,
// logger, and file cache across test packages.
type TestEnv struct {
	t          *testing.T
	db         *db.Database
	logger     *zerolog.Logger
	fileCacher *filecache.Cacher
	dataDir    string
}

// NewTestEnv creates a new test environment with shared infrastructure.
func NewTestEnv(t *testing.T) *TestEnv {
	t.Helper()
	logger := util.NewLogger()
	dataDir := t.TempDir()

	database, err := db.NewDatabase(dataDir, "test", logger)
	require.NoError(t, err)

	cacher, err := filecache.NewCacher(filepath.Join(dataDir, "cache"))
	require.NoError(t, err)

	return &TestEnv{
		t:          t,
		db:         database,
		logger:     logger,
		fileCacher: cacher,
		dataDir:    dataDir,
	}
}

// NewTestEnvDBOnly creates a minimal test environment with just a database.
func NewTestEnvDBOnly(t *testing.T) *TestEnv {
	t.Helper()
	logger := util.NewLogger()
	dataDir := t.TempDir()

	database, err := db.NewDatabase(dataDir, "test", logger)
	require.NoError(t, err)

	return &TestEnv{t: t, db: database, logger: logger, dataDir: dataDir}
}

func (e *TestEnv) Database() *db.Database        { return e.db }
func (e *TestEnv) Logger() *zerolog.Logger       { return e.logger }
func (e *TestEnv) FileCacher() *filecache.Cacher { return e.fileCacher }
func (e *TestEnv) DataDir() string               { return e.dataDir }

func (e *TestEnv) WSEventManager() events.WSEventManagerInterface {
	return events.NewMockWSEventManager(e.logger)
}

// MetadataProvider creates a metadata provider using the test environment.
func (e *TestEnv) MetadataProvider() metadata_provider.Provider {
	return metadata_provider.NewProvider(&metadata_provider.NewProviderImplOptions{
		Logger:           e.logger,
		FileCacher:       e.fileCacher,
		Database:         e.db,
		ExtensionBankRef: util.NewRef(extension.NewUnifiedBank()),
	})
}

// ContinuityManager creates a continuity manager using the test environment.
func (e *TestEnv) ContinuityManager() *continuity.Manager {
	return continuity.NewManager(&continuity.NewManagerOptions{
		FileCacher: e.fileCacher,
		Logger:     e.logger,
		Database:   e.db,
	})
}

// ExtensionRepository creates an extension repository using the test environment.
func (e *TestEnv) ExtensionRepository() *extension_repo.Repository {
	return extension_repo.NewRepository(&extension_repo.NewRepositoryOptions{
		Logger:         e.logger,
		ExtensionDir:   e.t.TempDir(),
		WSEventManager: e.WSEventManager(),
		FileCacher:     e.fileCacher,
	})
}

// MangaRepository creates a manga repository using the test environment.
func (e *TestEnv) MangaRepository() *manga.Repository {
	cacheDir := filepath.Join(e.dataDir, "cache")
	return manga.NewRepository(&manga.NewRepositoryOptions{
		Logger:           e.logger,
		FileCacher:       e.fileCacher,
		CacheDir:         cacheDir,
		ServerURI:        "",
		WsEventManager:   e.WSEventManager(),
		DownloadDir:      filepath.Join(e.dataDir, "manga"),
		Database:         e.db,
		ExtensionBankRef: util.NewRef(extension.NewUnifiedBank()),
	})
}
