package cron

import (
	"kamehouse/internal/core"
	"time"
)



func RunJobs(app *core.App) {

	// Run the jobs only if the server is online

	refreshLocalDataTicker := time.NewTicker(30 * time.Minute)
	refetchReleaseTicker := time.NewTicker(1 * time.Hour)
	refetchAnnouncementsTicker := time.NewTicker(10 * time.Minute)

	go func() {
		for {
			select {
			case <-refreshLocalDataTicker.C:
				if app.IsOffline() {
					continue
				}
				// SyncLocalDataJob(ctx)
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
				//
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
				//
			}
		}
	}()

}
