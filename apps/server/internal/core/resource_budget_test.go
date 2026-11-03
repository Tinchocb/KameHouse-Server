package core

import (
	"github.com/rs/zerolog"
	"github.com/spf13/viper"
	"testing"
)

func TestThumbnailBudgetDefaultsToAutoAndPreservesOverride(t *testing.T) {
	v := viper.New()
	setDefaults(v)
	if got := v.GetInt64("cache.thumbnails.memoryMaxBytesMB"); got != 0 {
		t.Fatalf("auto default = %d", got)
	}
	v.Set("cache.thumbnails.memoryMaxBytesMB", 1)
	var cfg Config
	if err := v.Unmarshal(&cfg); err != nil {
		t.Fatal(err)
	}
	logger := zerolog.Nop()
	c := initThumbnailCache(&cfg, &logger)
	c.Set("too-big", make([]byte, 2<<20))
	if _, ok := c.Get("too-big"); ok {
		t.Fatal("manual 1 MB budget ignored")
	}
	c.Set("small", make([]byte, 1024))
	if _, ok := c.Get("small"); !ok {
		t.Fatal("small thumbnail rejected")
	}
}
