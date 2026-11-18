package db

import (
	"github.com/rs/zerolog"
	"kamehouse/internal/database/models/dto"
	"testing"
)

func BenchmarkLocalFilesByMediaID(b *testing.B) {
	logger := zerolog.Nop()
	d := &Database{Logger: &logger}
	files := make([]*dto.LocalFile, 50000)
	for i := range files {
		files[i] = &dto.LocalFile{MediaID: i / 100, Name: "episode.mkv", Metadata: &dto.LocalFileMetadata{Episodes: []int{i%100 + 1}}}
	}
	d.localFilesGeneration().snapshot.Store(&files)
	b.Run("cold_index", func(b *testing.B) {
		b.ReportAllocs()
		for range b.N {
			InvalidateLocalFilesCache(d)
			d.localFilesGeneration().snapshot.Store(&files)
			if _, err := GetLocalFilesByMediaID(d, 250); err != nil {
				b.Fatal(err)
			}
		}
	})
	b.Run("legacy_scan", func(b *testing.B) {
		b.ReportAllocs()
		for range b.N {
			var matched []*dto.LocalFile
			for _, f := range files {
				if f != nil && f.MediaID == 250 {
					matched = append(matched, f.Clone())
				}
			}
			if len(matched) != 100 {
				b.Fatal(len(matched))
			}
		}
	})
	b.Run("indexed", func(b *testing.B) {
		if _, err := GetLocalFilesByMediaID(d, 250); err != nil {
			b.Fatal(err)
		}
		b.ReportAllocs()
		b.ResetTimer()
		for range b.N {
			got, err := GetLocalFilesByMediaID(d, 250)
			if err != nil || len(got) != 100 {
				b.Fatalf("get: %d %v", len(got), err)
			}
		}
	})
}
