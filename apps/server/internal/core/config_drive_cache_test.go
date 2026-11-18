package core

import (
	"path/filepath"
	"strings"
	"testing"

	"github.com/spf13/viper"
)

// baseConfigForDriveCache devuelve una configuración que pasa todas las
// validaciones previas al bloque de cache.drive, para aislar sus casos.
func baseConfigForDriveCache(t *testing.T) *Config {
	t.Helper()
	root := t.TempDir()
	cfg := &Config{}
	cfg.Server.Host = "127.0.0.1"
	cfg.Server.Port = 43211
	cfg.Database.Name = "kamehouse"
	cfg.Web.AssetDir = filepath.Join(root, "assets")
	cfg.Cache.Dir = filepath.Join(root, "cache")
	cfg.Cache.TranscodeDir = filepath.Join(root, "cache", "transcode")
	cfg.Logs.Dir = filepath.Join(root, "logs")
	return cfg
}

func TestDriveBlockCacheDefaultLimit(t *testing.T) {
	v := viper.New()
	setDefaults(v)
	if got := v.GetInt64("cache.drive.diskMaxSizeMB"); got != 2048 {
		t.Fatalf("default cache.drive.diskMaxSizeMB = %d, want 2048", got)
	}
}

func TestDriveBlockCacheLimitValidation(t *testing.T) {
	cases := []struct {
		mb      int64
		wantErr bool
	}{
		{mb: 0, wantErr: false}, // 0: usa el valor por defecto del servidor
		{mb: 64, wantErr: false},
		{mb: 2048, wantErr: false},
		{mb: -1, wantErr: true},
		{mb: 1, wantErr: true},
		{mb: 63, wantErr: true},
	}
	for _, tc := range cases {
		cfg := baseConfigForDriveCache(t)
		cfg.Cache.Drive.DiskMaxSizeMB = tc.mb
		err := validateConfig(cfg)
		if tc.wantErr {
			if err == nil || !strings.Contains(err.Error(), "cache.drive.diskMaxSizeMB") {
				t.Fatalf("diskMaxSizeMB=%d: se esperaba error de validación de drive, got %v", tc.mb, err)
			}
			continue
		}
		if err != nil {
			t.Fatalf("diskMaxSizeMB=%d: error inesperado: %v", tc.mb, err)
		}
	}
}
