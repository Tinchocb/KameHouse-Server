package local

import (
	"testing"

	"kamehouse/internal/database/models/dto"
	"kamehouse/internal/platforms/platform"
)

func TestStringMap_RoundTrip(t *testing.T) {
	in := StringMap{"1": "ep1.jpg", "2": "ep2.jpg"}
	v, err := in.Value()
	if err != nil {
		t.Fatalf("Value: %v", err)
	}
	var out StringMap
	if err := out.Scan(v); err != nil {
		t.Fatalf("Scan: %v", err)
	}
	if len(out) != 2 || out["2"] != "ep2.jpg" {
		t.Fatalf("round trip lost data: %v", out)
	}
	if err := out.Scan("not bytes"); err == nil {
		t.Error("Scan must reject non-[]byte sources")
	}
}

func TestGetAnimeReferenceKey_OrderIndependentAndPerMedia(t *testing.T) {
	media := &platform.UnifiedMedia{ID: 7}
	a := []*dto.LocalFile{
		{MediaID: 7, Path: "/b.mkv"},
		{MediaID: 9, Path: "/other.mkv"},
		{MediaID: 7, Path: "/a.mkv"},
	}
	b := []*dto.LocalFile{a[2], a[1], a[0]}

	ka, kb := GetAnimeReferenceKey(media, a), GetAnimeReferenceKey(media, b)
	if ka != kb {
		t.Errorf("key must not depend on file order: %q vs %q", ka, kb)
	}
	if ka != "7-/a.mkv,/b.mkv" {
		t.Errorf("unexpected key %q (files of other media must be ignored)", ka)
	}
}
