package main

import (
	"context"
	"embed"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"
)

//go:embed all:web
var WebFS embed.FS

//go:embed internal/icon/logo.png
var embeddedLogo []byte

// AppDI represents the primary dependency injection container.
type AppDI struct {
	Logger *slog.Logger
	// TODO: Inject Config, DB Pool, and Core Services here.
}

func main() {
	// Global context canceled on OS signals (SIGINT, SIGTERM)
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	if err := run(ctx); err != nil && !errors.Is(err, http.ErrServerClosed) {
		slog.Error("server application failed", "error", err)
		os.Exit(1)
	}
}

func run(ctx context.Context) error {
	// 1. Dependency Injection Initialization
	di := &AppDI{
		Logger: slog.New(slog.NewJSONHandler(os.Stdout, nil)),
	}

	// 2. HTTP Server Configuration
	srv := &http.Server{
		Addr:         ":8080", // Should be injected via config in the future
		Handler:      http.NewServeMux(), // Placeholder: replace with AppRouter router
		ReadTimeout:  5 * time.Second,
		WriteTimeout: 10 * time.Second,
		IdleTimeout:  120 * time.Second,
	}

	// 3. Start server concurrently
	errCh := make(chan error, 1)
	go func() {
		di.Logger.Info("server listening", "addr", srv.Addr)
		errCh <- srv.ListenAndServe()
	}()

	// 4. Block for shutdown signal or fatal error
	select {
	case err := <-errCh:
		return err
	case <-ctx.Done():
		di.Logger.Info("initiating graceful shutdown")
		
		// Derive timeout context to ensure no infinite blocking on shutdown
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		
		return srv.Shutdown(shutdownCtx)
	}
}
