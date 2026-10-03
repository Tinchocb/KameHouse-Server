package db

import (
	"context"
	"testing"

	"kamehouse/internal/util"
)

func TestMediaSourcePreferenceRoundTrip(t *testing.T) {
	database, err := NewDatabase(context.Background(), t.TempDir(), "test-source", util.NewLogger())
	if err != nil {
		t.Fatalf("NewDatabase: %v", err)
	}
	t.Cleanup(func() { _ = database.Close() }) // Windows no borra un .db abierto

	prefs, err := database.GetMediaSourcePreferences()
	if err != nil {
		t.Fatalf("GetMediaSourcePreferences: %v", err)
	}
	if len(prefs) != 0 {
		t.Fatalf("sin fila = %v, want empty map", prefs)
	}

	for _, step := range []struct{ set, want string }{
		{MediaSourceLocal, MediaSourceLocal},
		{MediaSourceCloud, MediaSourceCloud}, // upsert, no duplica
		{MediaSourceAuto, MediaSourceAuto},   // auto borra la fila
	} {
		if err := database.SetMediaSourcePreference(10, step.set); err != nil {
			t.Fatalf("Set(%q): %v", step.set, err)
		}
		p, err := database.GetMediaSourcePreferences()
		if err != nil {
			t.Fatalf("GetMediaSourcePreferences: %v", err)
		}
		if step.want == MediaSourceAuto {
			if _, ok := p[10]; ok {
				t.Errorf("después de Set(auto), preferencia aún existe: %v", p[10])
			}
		} else if p[10] != step.want {
			t.Errorf("después de Set(%q) = %q, want %q", step.set, p[10], step.want)
		}
	}

	_ = database.SetMediaSourcePreference(10, MediaSourceLocal)
	_ = database.SetMediaSourcePreference(20, MediaSourceCloud)
	prefs, err = database.GetMediaSourcePreferences()
	if err != nil {
		t.Fatal(err)
	}
	if len(prefs) != 2 || prefs[10] != MediaSourceLocal || prefs[20] != MediaSourceCloud {
		t.Errorf("prefs = %v", prefs)
	}
}

func TestIsValidMediaSource(t *testing.T) {
	for _, s := range []string{"auto", "local", "cloud"} {
		if !IsValidMediaSource(s) {
			t.Errorf("%q debería ser válido", s)
		}
	}
	for _, s := range []string{"", "drive", "LOCAL"} {
		if IsValidMediaSource(s) {
			t.Errorf("%q no debería ser válido", s)
		}
	}
}
