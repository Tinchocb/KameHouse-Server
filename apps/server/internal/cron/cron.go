package cron

import (
	"kamehouse/internal/core"
)



func RunJobs(app *core.App) {
	// The background jobs have been temporarily disabled.
	// When re-implementing, ensure these run inside goroutines that listen to a proper context.Context cancellation (ctx.Done()) to prevent goroutine leaks during server shutdown.
}
