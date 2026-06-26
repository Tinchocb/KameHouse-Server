package main

import (
	"context"
	"net/http"
	"time"

	"kamehouse/internal/core"
)

// App struct holds references needed for a graceful shutdown.
type App struct {
	ctx     context.Context
	srv     *http.Server
	kameApp *core.App
}

// NewApp creates a new App struct instance
func NewApp() *App {
	return &App{}
}

// startup is called when the app starts. The context is saved
// so we can call the runtime methods
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
}

// shutdown is called when the Wails window closes.
// It drains in-flight HTTP requests and flushes the database before exit.
func (a *App) shutdown(ctx context.Context) {
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if a.srv != nil {
		_ = a.srv.Shutdown(shutdownCtx)
	}
	if a.kameApp != nil {
		a.kameApp.Cleanup(shutdownCtx)
	}
}
