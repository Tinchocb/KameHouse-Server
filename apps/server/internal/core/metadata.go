package core

import (
	"kamehouse/internal/api/metadata_provider"
	"kamehouse/internal/api/tmdb"
	"kamehouse/internal/database/models"
)

// GetTMDBClient returns a fully configured snapshot. Requests already holding
// an older client can finish normally while a new one is published.
func (m *MetadataProviders) GetTMDBClient() *tmdb.Client {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.tmdbClient
}

func (m *MetadataProviders) publishTMDB(client *tmdb.Client, provider metadata_provider.Provider) {
	m.mu.Lock()
	err := m.Provider.SetProvider(provider)
	if err == nil {
		m.tmdbClient = client
	}
	m.mu.Unlock()
	if err != nil {
		// A configuration callback racing shutdown must not leak its rejected
		// candidate or replace the last accepted client snapshot.
		_ = provider.Close()
	}
}

// Caller holds moduleMu. Build both objects before publishing the client, so a
// reader acquiring it sees a configured cache and an already updated provider.
func (a *App) refreshMetadata(settings *models.Settings) {
	token, reason := tmdb.ResolveToken(settings.Library.TmdbApiKey, a.Config.Metadata.TMDBApiKey)
	if token == "" {
		a.Logger.Warn().Str("reason", reason).Msg("app: No usable TMDB API key - TMDB features degraded")
	}
	client := tmdb.NewClient(token, settings.Library.TmdbLanguage)
	if a.Database != nil {
		client.SetPersistentCache(&TMDbCacheAdapter{db: a.Database})
	}
	provider := metadata_provider.NewProvider(&metadata_provider.NewProviderImplOptions{
		Logger:     a.Logger,
		Database:   a.Database,
		TMDBClient: client,
	})
	a.Metadata.publishTMDB(client, provider)
}
