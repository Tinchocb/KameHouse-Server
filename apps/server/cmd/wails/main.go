package main

import (
	"embed"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"time"

	"kamehouse/internal/core"
	"kamehouse/internal/handlers"

	"github.com/subosito/gotenv"
	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
)

//go:embed all:frontend/dist
var assets embed.FS

//go:embed logo.png
var embeddedLogo []byte

func main() {
	loadEnvFile()

	app := NewApp()

	// Resolve Port & Host for Echo server
	portStr := os.Getenv("KAMEHOUSE_PORT")
	portVal := 43211 // Default desktop port
	if portStr != "" {
		if p, err := strconv.Atoi(portStr); err == nil {
			portVal = p
		}
	}
	hostStr := os.Getenv("KAMEHOUSE_HOST")
	if hostStr == "" {
		hostStr = "127.0.0.1"
	}

	// Start KameHouse Echo server in background
	go func() {
		configOpts := &core.ConfigOptions{
			Flags: core.KameHouseFlags{
				Port:             portVal,
				Host:             hostStr,
				IsDesktopSidecar: true, // Behaves like the desktop sidecar
			},
			EmbeddedLogo: embeddedLogo,
		}

		kameApp := core.NewKameHouse(configOpts)
		
		// Initialize Echo app (using an empty embed.FS since Wails is serving the frontend)
		var emptyWebFS embed.FS
		e := core.NewEchoApp(kameApp, &emptyWebFS)
		handlers.InitRoutes(kameApp, e)

		// Set listening configurations
		kameApp.Config.Server.Host = hostStr
		kameApp.Config.Server.Port = portVal
		kameApp.Flags.Host = hostStr
		kameApp.Flags.Port = portVal

		// Add allowed CORS origins
		kameApp.Config.Server.CorsOrigins = append(kameApp.Config.Server.CorsOrigins, 
			fmt.Sprintf("http://%s:%d", hostStr, portVal),
			"http://localhost:43210", // Allow local dev server
			"http://127.0.0.1:43210",
			"http://wails.localhost", // Allow Wails production origin
		)

		addr := fmt.Sprintf("%s:%d", hostStr, portVal)
		srv := &http.Server{
			Addr:              addr,
			Handler:           e,
			ReadHeaderTimeout: 10 * time.Second,
			ReadTimeout:       30 * time.Second,
			WriteTimeout:      0,
			IdleTimeout:       120 * time.Second,
		}

		kameApp.Logger.Info().Msg(fmt.Sprintf("Echo server running inside Wails at %s", addr))
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			kameApp.Logger.Error().Err(err).Msg("Echo server inside Wails failed")
		}
	}()

	// Launch Wails native window
	err := wails.Run(&options.App{
		Title:  "KameHouse",
		Width:  1280,
		Height: 800,
		AssetServer: &assetserver.Options{
			Assets: assets,
		},
		BackgroundColour: &options.RGBA{R: 13, G: 15, B: 20, A: 255},
		OnStartup:        app.startup,
		OnShutdown:       app.shutdown,
		Bind: []interface{}{
			app,
		},
	})

	if err != nil {
		println("Error:", err.Error())
	}
}

// loadEnvFile matches the original server env loading
func loadEnvFile() {
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
