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
	ctx, cancel := context.WithCancel(ctx)
	cw.cancel = cancel

	watcher, err := fsnotify.NewWatcher()
	if err != nil {
		return fmt.Errorf("failed to create fsnotify watcher: %w", err)
	}
	cw.watcher = watcher

	configDir := filepath.Dir(cw.configPath)
	if err := watcher.Add(configDir); err != nil {
		watcher.Close()
		return fmt.Errorf("failed to watch config directory: %w", err)
	}

	go func() {
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
						// Debounce: wait a bit for the write to complete
						time.Sleep(100 * time.Millisecond)
						cw.reload()
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
	if cw.cancel != nil {
		cw.cancel()
	}
	if cw.watcher != nil {
		cw.watcher.Close()
	}
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
	// Non-reloadable: Database, TLS, Server.Host, Server.Port, Server.Offline, Server.UseBinaryPath, Server.Systray, Server.DoHUrl, Server.Password
	// Hot-reloadable: CorsOrigins, AuthTokenTTL, LogLevel (via Logs.Dir), FeatureFlags (via Library), TMDB API key

	cw.mu.RLock()
	callbacks := make([]func(*Config), len(cw.callbacks))
	copy(callbacks, cw.callbacks)
	cw.mu.RUnlock()

	for _, cb := range callbacks {
		cb(&cfg)
	}

	cw.logger.Info().Msg("config reloaded successfully")
}

func (cw *ConfigWatcher) GetCallbacks() []func(*Config) {
	cw.mu.RLock()
	defer cw.mu.RUnlock()
	callbacks := make([]func(*Config), len(cw.callbacks))
	copy(callbacks, cw.callbacks)
	return callbacks
}