package core

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/spf13/viper"
	"github.com/stretchr/testify/require"
)

func cacheLocationConfig(t *testing.T) *Config {
	t.Helper()
	t.Setenv("KAMEHOUSE_CACHE_DIR", "")
	t.Setenv("KAMEHOUSE_CACHE_TRANSCODEDIR", "")
	cfg := &Config{}
	cfg.Data.AppDataDir = t.TempDir()
	cfg.Cache.Dir = filepath.Join(cfg.Data.AppDataDir, "cache")
	cfg.Cache.TranscodeDir = filepath.Join(cfg.Cache.Dir, "transcode")
	require.NoError(t, os.MkdirAll(cfg.Cache.Dir, 0700))
	require.NoError(t, os.WriteFile(cfg.cacheConfigPath(), []byte("[server]\nport = 43211\npassword = 'keep-me'\n"), 0600))
	return cfg
}

func TestSaveCacheLocationPersistsWithoutChangingRuntimeOrOldFiles(t *testing.T) {
	cfg := cacheLocationConfig(t)
	oldDir := cfg.Cache.Dir
	oldFile := filepath.Join(oldDir, "keep.cache")
	require.NoError(t, os.WriteFile(oldFile, []byte("cached bytes"), 0600))
	newDir := filepath.Join(t.TempDir(), "new-cache")
	location, err := cfg.SaveCacheLocation(newDir)
	require.NoError(t, err)
	require.Equal(t, oldDir, location.ActiveDirectory)
	require.Equal(t, newDir, location.Directory)
	require.True(t, location.RestartRequired)
	require.Equal(t, oldDir, cfg.Cache.Dir)
	require.FileExists(t, oldFile)
	v := viper.New()
	v.SetConfigFile(cfg.cacheConfigPath())
	require.NoError(t, v.ReadInConfig())
	require.Equal(t, newDir, v.GetString("cache.dir"))
	require.Equal(t, filepath.Join(newDir, "transcode"), v.GetString("cache.transcodeDir"))
	require.Equal(t, 43211, v.GetInt("server.port"))
	require.Equal(t, "keep-me", v.GetString("server.password"))
	read, err := cfg.CacheLocation()
	require.NoError(t, err)
	require.Equal(t, location, read)
	// Simulate the next process reading its configured paths.
	cfg.Cache.Dir = newDir
	cfg.Cache.TranscodeDir = filepath.Join(newDir, "transcode")
	read, err = cfg.CacheLocation()
	require.NoError(t, err)
	require.False(t, read.RestartRequired)
}

func TestSaveCacheLocationRejectsInvalidPathsWithoutChangingConfig(t *testing.T) {
	cfg := cacheLocationConfig(t)
	file := filepath.Join(t.TempDir(), "a-file")
	require.NoError(t, os.WriteFile(file, []byte("keep"), 0600))
	before, err := os.ReadFile(cfg.cacheConfigPath())
	require.NoError(t, err)
	for _, path := range []string{"", "relative-cache", cfg.Data.AppDataDir, filepath.Dir(cfg.Data.AppDataDir), filepath.VolumeName(cfg.Cache.Dir) + string(filepath.Separator), file} {
		_, err := cfg.SaveCacheLocation(path)
		require.Error(t, err, "path %q should fail", path)
	}
	after, err := os.ReadFile(cfg.cacheConfigPath())
	require.NoError(t, err)
	require.Equal(t, before, after)
}

func TestCacheLocationHonorsEnvironmentOverride(t *testing.T) {
	cfg := cacheLocationConfig(t)
	t.Setenv("KAMEHOUSE_CACHE_DIR", cfg.Cache.Dir)
	location, err := cfg.CacheLocation()
	require.NoError(t, err)
	require.True(t, location.ManagedByEnvironment)
	_, err = cfg.SaveCacheLocation(filepath.Join(t.TempDir(), "new-cache"))
	require.Error(t, err)
}
