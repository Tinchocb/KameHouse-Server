package core

// ─────────────────────────────────────────────────────────────────────
// Explicit DI Wiring Bootstrap
// ─────────────────────────────────────────────────────────────────────
// This file provides explicit, structured wiring of the App's components
// into the ServiceContainer. Instead of handlers reaching into the
// monolithic App struct directly, they can receive specific service
// interfaces from the container built here.
//
// Migration path:
//   1. Call WireServices(app) during server startup
//   2. Pass container.Anime / container.Manga / etc. to new-style handlers
//   3. Old handlers continue using app.* until migrated
// ─────────────────────────────────────────────────────────────────────

// WireServices constructs a ServiceContainer from the existing App.
// This provides a bridge for progressive migration: new handlers use
// the container, old handlers keep using App directly.
func WireServices(app *App) *ServiceContainer {
	return &ServiceContainer{
		Database: app.Database,
		Logger:   app.Logger,
		// Service interfaces are nil until concrete implementations
		// are created. Each can be wired independently:
		//
		// container.Anime = NewAnimeServiceImpl(app.AnimeCollection, app.Database)
		// container.Manga = NewMangaServiceImpl(app.MangaRepository)
		// container.Library = NewLibraryServiceImpl(app.Database, app.FileCacher)
		// etc.
		//
		// For now, this provides the structural foundation.
		// Individual services are wired as they are extracted from App.
	}
}
