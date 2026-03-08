package cron

import (
	"kamehouse/internal/core"
	"time"
)

type JobCtx struct {
	App *core.App
}

func RunJobs(app *core.App) {

	// Run the jobs only if the server is online
	ctx := &JobCtx{
		App: app,
	}

	refreshAnilistTicker := time.NewTicker(10 * time.Minute)
	refreshLocalDataTicker := time.NewTicker(30 * time.Minute)
	refetchReleaseTicker := time.NewTicker(1 * time.Hour)
	refetchAnnouncementsTicker := time.NewTicker(10 * time.Minute)

	go func() {
		for {
			select {
			case <-refreshAnilistTicker.C:
				if app.IsOffline() {
					continue
				}
				RefreshAnilistDataJob(ctx)
				app.SyncAnilistToSimulatedCollection()
			}
		}
	}()

	go func() {
		for {
			select {
			case <-refreshLocalDataTicker.C:
				if app.IsOffline() {
					continue
				}
				SyncLocalDataJob(ctx)
			}
		}
	}()

	go func() {
		for {
			select {
			case <-refetchReleaseTicker.C:
				if app.IsOffline() {
					continue
				}
				app.Updater.ShouldRefetchReleases()
			}
		}
	}()

	go func() {
		for {
			select {
			case <-refetchAnnouncementsTicker.C:
				if app.IsOffline() {
					continue
				}
				app.Updater.FetchAnnouncements()
			}
		}
	}()

	// AniList catalog cache: refresh daily, run once on startup after 2 minutes
	refreshCatalogCacheTicker := time.NewTicker(24 * time.Hour)

	go func() {
		// Initial run after a short delay to let the app finish booting
		time.Sleep(2 * time.Minute)
		if !app.IsOffline() {
			RefreshAnilistCatalogCacheJob(ctx)
		}

		for {
			select {
			case <-refreshCatalogCacheTicker.C:
				if app.IsOffline() {
					continue
				}
				RefreshAnilistCatalogCacheJob(ctx)
			}
		}
	}()

}
