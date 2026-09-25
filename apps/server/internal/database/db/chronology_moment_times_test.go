package db

import (
	"context"
	"testing"

	"kamehouse/internal/util"
)

func TestChronologyMomentTimesRoundTrip(t *testing.T) {
	database, err := NewDatabase(context.Background(), t.TempDir(), "test-chronology-moments", util.NewLogger())
	if err != nil {
		t.Fatalf("NewDatabase: %v", err)
	}
	t.Cleanup(func() { _ = database.Close() })

	// Initial map should be empty
	initialTimes, err := database.GetChronologyMomentTimes()
	if err != nil {
		t.Fatalf("GetChronologyMomentTimes: %v", err)
	}
	if len(initialTimes) != 0 {
		t.Fatalf("expected empty map, got %v", initialTimes)
	}

	key1 := "db-pilaf:9:4"
	key2 := "dbz-cell-games:184:1"

	// 1. Insert key1
	if err := database.SetChronologyMomentTime(key1, 872); err != nil {
		t.Fatalf("SetChronologyMomentTime(%q, 872): %v", key1, err)
	}

	times, err := database.GetChronologyMomentTimes()
	if err != nil {
		t.Fatal(err)
	}
	if times[key1] != 872 {
		t.Fatalf("expected 872, got %d", times[key1])
	}

	// 2. Upsert key1 with new seconds (no duplicate, updates value)
	if err := database.SetChronologyMomentTime(key1, 880); err != nil {
		t.Fatalf("SetChronologyMomentTime(%q, 880): %v", key1, err)
	}
	// Insert key2
	if err := database.SetChronologyMomentTime(key2, 840); err != nil {
		t.Fatalf("SetChronologyMomentTime(%q, 840): %v", key2, err)
	}

	times, err = database.GetChronologyMomentTimes()
	if err != nil {
		t.Fatal(err)
	}
	if len(times) != 2 || times[key1] != 880 || times[key2] != 840 {
		t.Fatalf("expected 2 items with 880 and 840, got %v", times)
	}

	// 3. Delete key1 when seconds < 0
	if err := database.SetChronologyMomentTime(key1, -1); err != nil {
		t.Fatalf("SetChronologyMomentTime(%q, -1): %v", key1, err)
	}

	times, err = database.GetChronologyMomentTimes()
	if err != nil {
		t.Fatal(err)
	}
	if len(times) != 1 || times[key2] != 840 {
		t.Fatalf("expected only key2, got %v", times)
	}
}
