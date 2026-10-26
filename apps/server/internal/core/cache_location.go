package core

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"

	"github.com/spf13/viper"
	"kamehouse/internal/constants"
)

var cacheLocationMu sync.Mutex

type CacheLocation struct {
	ActiveDirectory      string `json:"activeDirectory"`
	Directory            string `json:"directory"`
	RestartRequired      bool   `json:"restartRequired"`
	ManagedByEnvironment bool   `json:"managedByEnvironment"`
}

func (cfg *Config) cacheConfigPath() string {
	return filepath.Join(cfg.Data.AppDataDir, constants.ConfigFileName)
}

func cacheLocationFromFile(cfg *Config, v *viper.Viper) CacheLocation {
	dir := expandPath(v.GetString("cache.dir"))
	if dir == "" {
		dir = cfg.Cache.Dir
	}
	transcode := expandPath(v.GetString("cache.transcodeDir"))
	if transcode == "" {
		transcode = cfg.Cache.TranscodeDir
	}
	managed := os.Getenv("KAMEHOUSE_CACHE_DIR") != "" || os.Getenv("KAMEHOUSE_CACHE_TRANSCODEDIR") != ""
	if managed {
		dir = cfg.Cache.Dir
		transcode = cfg.Cache.TranscodeDir
	}
	return CacheLocation{
		ActiveDirectory: cfg.Cache.Dir, Directory: dir,
		RestartRequired:      !sameCachePath(dir, cfg.Cache.Dir) || !sameCachePath(transcode, cfg.Cache.TranscodeDir),
		ManagedByEnvironment: managed,
	}
}

func sameCachePath(a, b string) bool {
	return filepath.Clean(a) == filepath.Clean(b)
}

func (cfg *Config) CacheLocation() (CacheLocation, error) {
	cacheLocationMu.Lock()
	defer cacheLocationMu.Unlock()
	v := viper.New()
	v.SetConfigFile(cfg.cacheConfigPath())
	if err := v.ReadInConfig(); err != nil {
		return CacheLocation{}, err
	}
	return cacheLocationFromFile(cfg, v), nil
}

// SaveCacheLocation persists only file-backed settings. Runtime paths remain
// unchanged until restart so existing readers and maintenance use one location.
func (cfg *Config) SaveCacheLocation(directory string) (CacheLocation, error) {
	cacheLocationMu.Lock()
	defer cacheLocationMu.Unlock()
	if os.Getenv("KAMEHOUSE_CACHE_DIR") != "" || os.Getenv("KAMEHOUSE_CACHE_TRANSCODEDIR") != "" {
		return CacheLocation{}, fmt.Errorf("la ubicación está definida por variables de entorno")
	}
	directory = strings.TrimSpace(directory)
	if directory == "" || !filepath.IsAbs(directory) || strings.ContainsAny(directory, "\x00\r\n") {
		return CacheLocation{}, fmt.Errorf("elige una ruta absoluta para la caché")
	}
	directory = filepath.Clean(directory)
	if directory == filepath.Dir(directory) {
		return CacheLocation{}, fmt.Errorf("elige una carpeta para KameHouse dentro de la unidad")
	}
	// Never allow a cache root that contains application data (database/config).
	if rel, err := filepath.Rel(directory, cfg.Data.AppDataDir); err == nil && rel != ".." && !strings.HasPrefix(rel, ".."+string(filepath.Separator)) {
		return CacheLocation{}, fmt.Errorf("elige una carpeta separada de los datos de KameHouse")
	}
	v := viper.New()
	v.SetConfigFile(cfg.cacheConfigPath())
	if err := v.ReadInConfig(); err != nil {
		return CacheLocation{}, fmt.Errorf("no se pudo leer la configuración: %w", err)
	}
	if err := os.MkdirAll(directory, 0700); err != nil {
		return CacheLocation{}, fmt.Errorf("no se pudo crear la carpeta de caché: %w", err)
	}
	probe, err := os.CreateTemp(directory, ".kamehouse-write-test-*")
	if err != nil {
		return CacheLocation{}, fmt.Errorf("no se puede escribir en la carpeta elegida: %w", err)
	}
	closeErr := probe.Close()
	removeErr := os.Remove(probe.Name())
	if closeErr != nil || removeErr != nil {
		return CacheLocation{}, fmt.Errorf("no se pudo verificar la escritura en la carpeta elegida")
	}
	v.Set("cache.dir", directory)
	v.Set("cache.transcodeDir", filepath.Join(directory, "transcode"))
	tmp, err := os.CreateTemp(cfg.Data.AppDataDir, ".cache-location-*.toml")
	if err != nil {
		return CacheLocation{}, err
	}
	name := tmp.Name()
	defer os.Remove(name)
	if err := tmp.Close(); err != nil {
		return CacheLocation{}, err
	}
	if err := v.WriteConfigAs(name); err != nil {
		return CacheLocation{}, err
	}
	if err := os.Rename(name, cfg.cacheConfigPath()); err != nil {
		return CacheLocation{}, fmt.Errorf("no se pudo guardar la ubicación: %w", err)
	}
	return cacheLocationFromFile(cfg, v), nil
}
