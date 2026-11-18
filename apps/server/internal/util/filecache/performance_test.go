package filecache

import (
	"fmt"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/goccy/go-json"
)

type performanceValue struct {
	Name   string   `json:"name"`
	Size   int64    `json:"size"`
	Tracks []string `json:"tracks"`
}

func BenchmarkPersistentBucketLoad(b *testing.B) {
	dir := b.TempDir()
	data := make(map[string]*cacheItem, 2000)
	for i := range 2000 {
		data[fmt.Sprint(i)] = &cacheItem{Value: performanceValue{Name: "episode.mkv", Size: 123456789, Tracks: []string{"h264", "aac", "ass"}}}
	}
	encoded, err := json.Marshal(data)
	if err != nil {
		b.Fatal(err)
	}
	path := filepath.Join(dir, "media.cache")
	if err := os.WriteFile(path, encoded, 0600); err != nil {
		b.Fatal(err)
	}
	b.Run("legacy_eager", func(b *testing.B) {
		// Original on-disk representation, before cacheItem.UnmarshalJSON.
		type legacyItem struct {
			Value      interface{} `json:"value"`
			Expiration *time.Time  `json:"expiration,omitempty"`
			UpdatedAt  *time.Time  `json:"updated_at,omitempty"`
		}
		b.ReportAllocs()
		for range b.N {
			if _, err := NewCacher(dir); err != nil {
				b.Fatal(err)
			}
			file, err := os.Open(path)
			if err != nil {
				b.Fatal(err)
			}
			var entries map[string]*legacyItem
			err = json.NewDecoder(file).Decode(&entries)
			file.Close()
			if err != nil {
				b.Fatal(err)
			}
			raw, err := json.Marshal(entries["1000"].Value)
			if err != nil {
				b.Fatal(err)
			}
			var value performanceValue
			if err := json.Unmarshal(raw, &value); err != nil || value.Size != 123456789 {
				b.Fatalf("decode: %+v %v", value, err)
			}
		}
	})
	b.Run("lazy", func(b *testing.B) {
		b.ReportAllocs()
		for range b.N {
			c, err := NewCacher(dir)
			if err != nil {
				b.Fatal(err)
			}
			var value performanceValue
			if ok, err := c.Get(NewBucket("media", time.Hour), "1000", &value); err != nil || !ok || value.Size != 123456789 {
				b.Fatalf("get: %v %v", ok, err)
			}
		}
	})
}
