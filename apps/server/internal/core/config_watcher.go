package core

import (
	"context"
	"fmt"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/fsnotify/fsnotify"
	"github.com/rs/zerolog"
	"github.com/spf13/viper"
)

type ConfigWatcher struct {
	v          *viper.Viper
	configPath string
	logger     *zerolog.Logger
	cancel     context.CancelFunc
	watcher    *fsnotify.Watcher
	callbacks  []func(*Config)
	mu         sync.RWMutex
	lifecycle  sync.Mutex
	workers    sync.WaitGroup
	stopped    bool
}

func NewConfigWatcher(v *viper.Viper, configPath string, logger *zerolog.Logger) *ConfigWatcher {
	return &ConfigWatcher{
		v:          v,
		configPath: configPath,
		logger:     logger,
		callbacks:  make([]func(*Config), 0),
	}
}

func (cw *ConfigWatcher) Start(ctx context.Context) error {
	cw.lifecycle.Lock()
	defer cw.lifecycle.Unlock()
	if cw.stopped {
		return fmt.Errorf("config watcher is stopped")
	}
	if cw.watcher != nil {
		return fmt.Errorf("config watcher is already started")
	}
	ctx, cancel := context.WithCancel(ctx)
	cw.cancel = cancel

	watcher, err := fsnotify.NewWatcher()
	if err != nil {
		cancel()
		return fmt.Errorf("failed to create fsnotify watcher: %w", err)
	}
	cw.watcher = watcher

	configDir := filepath.Dir(cw.configPath)
	if err := watcher.Add(configDir); err != nil {
		watcher.Close()
		cw.watcher = nil
		cancel()
		return fmt.Errorf("failed to watch config directory: %w", err)
	}

	cw.workers.Add(1)
	go func() {
		defer cw.workers.Done()
		defer func() {
			if r := recover(); r != nil {
				cw.logger.Error().Interface("panic", r).Msg("config watcher panic")
			}
		}()

		for {
			select {
			case <-ctx.Done():
				return
			case event, ok := <-watcher.Events:
				if !ok {
					return
				}
				if event.Op&(fsnotify.Write|fsnotify.Create|fsnotify.Rename) != 0 {
					if strings.HasSuffix(event.Name, filepath.Base(cw.configPath)) {
						cw.logger.Info().Str("file", event.Name).Msg("config file changed, reloading")
						// Debounce: espera a que termine la escritura, pero responde a la cancelación.
						timer := time.NewTimer(100 * time.Millisecond)
						select {
						case <-ctx.Done():
							timer.Stop()
							return
						case <-timer.C:
							cw.reload()
						}
					}
				}
			case err, ok := <-watcher.Errors:
				if !ok {
					return
				}
				cw.logger.Error().Err(err).Msg("config watcher error")
			}
		}
	}()

	cw.logger.Info().Str("path", cw.configPath).Msg("config watcher started")
	return nil
}

func (cw *ConfigWatcher) Stop() {
	cw.lifecycle.Lock()
	cw.stopped = true
	if cw.cancel != nil {
		cw.cancel()
	}
	if cw.watcher != nil {
		cw.watcher.Close()
	}
	cw.lifecycle.Unlock()
	cw.workers.Wait()
}

func (cw *ConfigWatcher) OnChange(callback func(*Config)) {
	cw.mu.Lock()
	defer cw.mu.Unlock()
	cw.callbacks = append(cw.callbacks, callback)
}

func (cw *ConfigWatcher) reload() {
	if err := cw.v.ReadInConfig(); err != nil {
		cw.logger.Error().Err(err).Msg("failed to reload config")
		return
	}

	var cfg Config
	if err := cw.v.Unmarshal(&cfg); err != nil {
		cw.logger.Error().Err(err).Msg("failed to unmarshal reloaded config")
		return
	}

	// Only apply hot-reloadable fields
	// Non-reloadable: Database, TLS, Server.Host, Server.Port, Server.UseBinaryPath, Server.Password
	// CorsOrigins also requires restart: HTTP CORS, write guards and WS must agree.
	// Hot-reloadable: AuthTokenTTL, LogLevel (via Logs.Dir), FeatureFlags (via Library), TMDB API key

	cw.mu.RLock()
	callbacks := make([]func(*Config), len(cw.callbacks))
	copy(callbacks, cw.callbacks)
	cw.mu.RUnlock()

	for _, cb := range callbacks {
		cb(&cfg)
	}

	cw.logger.Info().Msg("config reloaded successfully")
}
