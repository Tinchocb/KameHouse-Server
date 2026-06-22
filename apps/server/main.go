package main

import (
	"context"
	"embed"
	"errors"
	"fmt"
	"log"
	"net"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"strconv"
	"strings"
	"syscall"
	"time"

	"kamehouse/internal/core"
	"kamehouse/internal/handlers"

	"github.com/rs/zerolog"
	"github.com/subosito/gotenv"
)

//go:embed all:web
var WebFS embed.FS

//go:embed internal/icon/logo.png
var embeddedLogo []byte

func main() {
	// Global context canceled on OS signals (SIGINT, SIGTERM)
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	if err := run(ctx); err != nil && !errors.Is(err, http.ErrServerClosed) {
		log.Printf("ERROR: server application failed: %v", err)
		os.Exit(1)
	}
}

func run(ctx context.Context) error {
	loadEnvFile()

	portStr := os.Getenv("KAMEHOUSE_PORT")
	portStrVal := 43211
	if portStr != "" {
		if p, err := strconv.Atoi(portStr); err == nil {
			portStrVal = p
		}
	}
	hostStr := os.Getenv("KAMEHOUSE_HOST")
	if hostStr == "" {
		hostStr = "127.0.0.1"
	}

	isDev := os.Getenv("KAMEHOUSE_ENV") != "production"


	// Initialize robust arguments required by NewKameHouse inside KameHouse.
	configOpts := &core.ConfigOptions{
		Flags:        core.KameHouseFlags{Port: portStrVal, Host: hostStr, IsDesktopSidecar: !isDev},
		EmbeddedLogo: embeddedLogo,
	}

	app := core.NewKameHouse(configOpts)

	// Since NewEchoApp returns an unstarted Echo instance, we run it manually
	// Or use core.RunEchoServer if adapted to take context
	e := core.NewEchoApp(app, &WebFS)
	handlers.InitRoutes(app, e)

	bindListener, bindHost, bindPort, err := resolveBindableAddress(hostStr, portStrVal, app.Flags.IsDesktopSidecar, app.Logger)
	if err != nil {
		return err
	}
	defer bindListener.Close()

	// Keep config/flags aligned with the real listen address so GetServerURI, CORS, and
	// "open browser on start" use the same port (important when we fall back to ephemeral).
	app.Config.Server.Host = bindHost
	app.Config.Server.Port = bindPort
	app.Flags.Host = bindHost
	app.Flags.Port = bindPort
	if bindPort != portStrVal {
		app.Logger.Warn().
			Int("requestedPort", portStrVal).
			Int("listeningPort", bindPort).
			Str("host", bindHost).
			Msg("server: configured HTTP port unavailable; listening on alternate port")
	}

	// Add the actual listening address as an allowed origin so that direct-browser
	// access (without the frontend dev proxy) doesn't get blocked by WebSocket
	// CheckOrigin or HTTP CORS.
	app.Config.Server.CorsOrigins = append(app.Config.Server.CorsOrigins, fmt.Sprintf("http://%s:%d", bindHost, bindPort))
	if bindHost != "localhost" {
		app.Config.Server.CorsOrigins = append(app.Config.Server.CorsOrigins, fmt.Sprintf("http://localhost:%d", bindPort))
	}
	if bindHost != "127.0.0.1" && bindHost != "localhost" {
		app.Config.Server.CorsOrigins = append(app.Config.Server.CorsOrigins, fmt.Sprintf("http://127.0.0.1:%d", bindPort))
	}
	addr := fmt.Sprintf("%s:%d", bindHost, bindPort)
	srv := &http.Server{
		Addr:              addr,
		Handler:           e,
		ReadHeaderTimeout: 10 * time.Second,
		ReadTimeout:       30 * time.Second,
		WriteTimeout:      0,
		IdleTimeout:       120 * time.Second,
	}

	// Start server concurrently
	errCh := make(chan error, 1)
	go func() {
		app.Logger.Info().Msg(fmt.Sprintf("server listening on %s", addr))
		if app.Config.Server.TLS.Enabled {
			if err := core.GenerateSelfSignedCert(app.Config.Server.TLS.CertPath, app.Config.Server.TLS.KeyPath, app.Logger); err != nil {
				app.Logger.Error().Err(err).Msg("failed to generate/verify TLS certificate")
				errCh <- err
				return
			}
			errCh <- srv.ServeTLS(bindListener, app.Config.Server.TLS.CertPath, app.Config.Server.TLS.KeyPath)
			return
		}
		errCh <- srv.Serve(bindListener)
	}()


	// Block for shutdown signal or fatal error
	select {
	case err := <-errCh:
		return err
	case <-ctx.Done():
		app.Logger.Info().Msg("initiating graceful shutdown")

		shutdownCtx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
		defer cancel()

		// 1. Stop accepting new HTTP requests
		if err := srv.Shutdown(shutdownCtx); err != nil {
			app.Logger.Error().Err(err).Msg("server shutdown error")
		}
		// 2. Flush pending writes & close DB within deadline
		app.Cleanup(shutdownCtx)
		return nil
	case <-app.WSEventManager.ShutdownSignal:
		app.Logger.Info().Msg("desktop sidecar: no WebSocket connections, initiating graceful shutdown")

		shutdownCtx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
		defer cancel()

		if err := srv.Shutdown(shutdownCtx); err != nil {
			app.Logger.Error().Err(err).Msg("server shutdown error")
		}
		app.Cleanup(shutdownCtx)
		return nil
	}
}

func resolveBindableAddress(host string, port int, isDesktopSidecar bool, logger *zerolog.Logger) (net.Listener, string, int, error) {
	addr := fmt.Sprintf("%s:%d", host, port)

	// Retry binding to the requested port a few times (helps clear TIME_WAIT from rapid restarts in dev)
	maxRetries := 3
	for i := 0; i < maxRetries; i++ {
		l, err := net.Listen("tcp", addr)
		if err == nil {
			return l, host, port, nil
		}

		errText := err.Error()
		isBusy := strings.Contains(errText, "address already in use") || strings.Contains(errText, "Only one usage")
		if !isBusy {
			return nil, "", 0, err
		}

		if i < maxRetries-1 {
			logger.Warn().
				Int("port", port).
				Int("attempt", i+1).
				Int("max", maxRetries).
				Msg("Port is busy (another instance may be running). Retrying in 500ms...")
			time.Sleep(500 * time.Millisecond)
		}
	}

	if isDesktopSidecar {
		return nil, "", 0, fmt.Errorf("port %d is busy and fallback is disabled in desktop sidecar mode", port)
	}

	// If still busy, log a final warning before falling back to ephemeral port (port 0)
	logger.Warn().
		Int("port", port).
		Int("attempts", maxRetries).
		Msg("Port is still busy after all attempts. Falling back to an ephemeral port.")
	l2, err2 := net.Listen("tcp", fmt.Sprintf("%s:%d", host, 0))
	if err2 != nil {
		return nil, "", 0, err2
	}
	ephemeralPort := l2.Addr().(*net.TCPAddr).Port
	return l2, host, ephemeralPort, nil
}

// loadEnvFile searches for a .env file starting from the CWD and
// the executable's directory, then walking up to 5 parent directories.
// This is needed because `go run` sets CWD to a temporary build directory.
func loadEnvFile() {
	// Candidate directories to search
	candidates := make([]string, 0, 12)

	if cwd, err := os.Getwd(); err == nil {
		dir := cwd
		for i := 0; i < 6; i++ {
			candidates = append(candidates, dir)
			parent := filepath.Dir(dir)
			if parent == dir {
				break
			}
			dir = parent
		}
	}

	if exe, err := os.Executable(); err == nil {
		dir := filepath.Dir(exe)
		for i := 0; i < 6; i++ {
			candidates = append(candidates, dir)
			parent := filepath.Dir(dir)
			if parent == dir {
				break
			}
			dir = parent
		}
	}

	for _, dir := range candidates {
		envPath := filepath.Join(dir, ".env")
		if _, err := os.Stat(envPath); err == nil {
			_ = gotenv.OverLoad(envPath)
			return
		}
	}
}
