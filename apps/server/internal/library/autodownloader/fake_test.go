package autodownloader

import (
	"context"
	"kamehouse/internal/api/metadata_provider"
	"kamehouse/internal/database/db"
	"kamehouse/internal/extension"
	hibiketorrent "kamehouse/internal/extension/hibike/torrent"
	"kamehouse/internal/test_utils"
	"kamehouse/internal/torrents/torrent"
	"kamehouse/internal/util"
	"testing"
)

// FakeSearchProvider simulates a torrent provider for autodownloader tests.
type FakeSearchProvider struct {
	GetLatestResults []*hibiketorrent.AnimeTorrent
	SearchResults    []*hibiketorrent.AnimeTorrent
}

func (f *FakeSearchProvider) Search(opts hibiketorrent.AnimeSearchOptions) ([]*hibiketorrent.AnimeTorrent, error) {
	return f.SearchResults, nil
}
func (f *FakeSearchProvider) SmartSearch(opts hibiketorrent.AnimeSmartSearchOptions) ([]*hibiketorrent.AnimeTorrent, error) {
	return f.SearchResults, nil
}
func (f *FakeSearchProvider) GetTorrentInfoHash(t *hibiketorrent.AnimeTorrent) (string, error) {
	return t.InfoHash, nil
}
func (f *FakeSearchProvider) GetTorrentMagnetLink(t *hibiketorrent.AnimeTorrent) (string, error) {
	return t.MagnetLink, nil
}
func (f *FakeSearchProvider) GetLatest() ([]*hibiketorrent.AnimeTorrent, error) {
	return f.GetLatestResults, nil
}
func (f *FakeSearchProvider) GetSettings() hibiketorrent.AnimeProviderSettings {
	return hibiketorrent.AnimeProviderSettings{
		CanSmartSearch: true,
		Type:           "main",
	}
}

// Fake sets up the environment and creates a test AutoDownloader instance.
type Fake struct {
	GetLatestResults []*hibiketorrent.AnimeTorrent
	SearchResults    []*hibiketorrent.AnimeTorrent
	Database         *db.Database
}

// New creates the AutoDownloader with the fake provider and database.
func (f *Fake) New(t *testing.T) *AutoDownloader {
	logger := util.NewLogger()
	database, err := db.NewDatabase(context.Background(), t.TempDir(), "test", logger)
	if err != nil {
		t.Fatalf("failed to create test database: %v", err)
	}
	f.Database = database

	provider := &FakeSearchProvider{
		GetLatestResults: f.GetLatestResults,
		SearchResults:    f.SearchResults,
	}

	ext := extension.NewAnimeTorrentProviderExtension(&extension.Extension{
		ID:   "fake",
		Type: extension.TypeAnimeTorrentProvider,
		Name: "Fake Provider",
	}, provider)

	bank := extension.NewUnifiedBank()
	bank.Set("fake", ext)

	repoOpts := &torrent.NewRepositoryOptions{
		Logger:              logger,
		Database:            database,
		MetadataProviderRef: util.NewRef(metadata_provider.GetFakeProvider(t, database)),
		ExtensionBankRef:    util.NewRef(bank),
	}
	repo := torrent.NewRepository(repoOpts)

	test_utils.InitTestProvider(t, test_utils.Anilist())

	ad := New(logger, database, nil)
	// Setup the dependencies using setter or direct assignment
	ad.SetTorrentClientRepository(repo)
	ad.metadataProviderRef = repoOpts.MetadataProviderRef
	ad.extensionBankRef = repoOpts.ExtensionBankRef

	return ad
}
