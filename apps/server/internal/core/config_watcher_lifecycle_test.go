package core

import (
	"context"
	"os"
	"path/filepath"
	"sync"
	"testing"
	"time"

	"github.com/rs/zerolog"
	"github.com/spf13/viper"
)

func TestConfigWatcherStopJoinsReloadCallback(t *testing.T) {
	path := filepath.Join(t.TempDir(), "config.toml")
	if err := os.WriteFile(path, []byte("[server]\nport=1234\n"), 0600); err != nil {
		t.Fatal(err)
	}
	v := viper.New()
	v.SetConfigFile(path)
	logger := zerolog.Nop()
	w := NewConfigWatcher(v, path, &logger)
	started, release := make(chan struct{}), make(chan struct{})
	var announced, unblock sync.Once
	w.OnChange(func(*Config) { announced.Do(func() { close(started) }); <-release })
	if err := w.Start(context.Background()); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { unblock.Do(func() { close(release) }); w.Stop() })
	if err := os.WriteFile(path, []byte("[server]\nport=1235\n"), 0600); err != nil {
		t.Fatal(err)
	}
	waitCleanup(t, started)
	stopped := make(chan struct{})
	go func() { w.Stop(); close(stopped) }()
	select {
	case <-stopped:
		t.Fatal("watcher stopped before its callback returned")
	case <-time.After(15 * time.Millisecond):
	}
	unblock.Do(func() { close(release) })
	waitCleanup(t, stopped)
	if err := w.Start(context.Background()); err == nil {
		t.Fatal("stopped watcher restarted")
	}
}
