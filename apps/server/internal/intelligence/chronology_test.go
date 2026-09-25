package intelligence

import (
	"context"
	"reflect"
	"testing"

	"kamehouse/internal/database/db"
	"kamehouse/internal/database/models"
	"kamehouse/internal/util"
)

func TestBuildChronologyProgress(t *testing.T) {
	database, err := db.NewDatabase(context.Background(), t.TempDir(), "test-chronology-progress", util.NewLogger())
	if err != nil {
		t.Fatalf("NewDatabase: %v", err)
	}
	t.Cleanup(func() { _ = database.Close() })

	const account uint = 1
	z := &models.LibraryMedia{Type: "SHOW", TmdbID: 12971}
	gt := &models.LibraryMedia{Type: "SHOW", TmdbID: 12697}
	other := &models.LibraryMedia{Type: "SHOW", TmdbID: 1399}
	for _, lm := range []*models.LibraryMedia{z, gt, other} {
		if err := database.Gorm().Create(lm).Error; err != nil {
			t.Fatalf("create media: %v", err)
		}
	}
	if err := database.Gorm().Create(&models.MediaEntryListData{LibraryMediaID: z.ID, Status: "CURRENT", Progress: 3}).Error; err != nil {
		t.Fatal(err)
	}
	if err := database.Gorm().Create(&models.MediaEntryListData{LibraryMediaID: gt.ID, Status: "COMPLETED"}).Error; err != nil {
		t.Fatal(err)
	}
	history := []models.WatchHistory{
		{AccountID: account, MediaID: 12971, EpisodeNumber: 10, CurrentTime: 95, Duration: 100},     // TMDB id, visto
		{AccountID: account, MediaID: int(z.ID), EpisodeNumber: 11, CurrentTime: 90, Duration: 100}, // id de biblioteca, visto
		{AccountID: account, MediaID: 12971, EpisodeNumber: 12, CurrentTime: 50, Duration: 100},     // a medias
		{AccountID: 2, MediaID: 12971, EpisodeNumber: 20, CurrentTime: 100, Duration: 100},          // otra cuenta
		{AccountID: account, MediaID: 1399, EpisodeNumber: 1, CurrentTime: 100, Duration: 100},      // otra serie
	}
	if err := database.Gorm().Create(&history).Error; err != nil {
		t.Fatal(err)
	}
	yes, no := true, false
	if err := database.SetChronologySpanOverrides(account, map[string]*bool{"dbz-saiyajin-raditz": &yes, "db-pilaf": &no}); err != nil {
		t.Fatal(err)
	}

	resp, err := BuildChronologyProgress(database, account)
	if err != nil {
		t.Fatalf("BuildChronologyProgress: %v", err)
	}
	if len(resp.Series) != len(ChronologySeriesTmdbIDs) {
		t.Fatalf("expected %d series, got %d", len(ChronologySeriesTmdbIDs), len(resp.Series))
	}
	byTmdb := map[int]*ChronologySeriesProgress{}
	for _, s := range resp.Series {
		byTmdb[s.TmdbID] = s
	}
	if got := byTmdb[12971].WatchedEpisodes; !reflect.DeepEqual(got, []int{1, 2, 3, 10, 11}) {
		t.Errorf("Z watched episodes = %v", got)
	}
	if byTmdb[12971].Completed || !byTmdb[12697].Completed {
		t.Errorf("completed flags wrong: Z=%v GT=%v", byTmdb[12971].Completed, byTmdb[12697].Completed)
	}
	if !reflect.DeepEqual(resp.Overrides, map[string]bool{"dbz-saiyajin-raditz": true, "db-pilaf": false}) {
		t.Errorf("overrides = %v", resp.Overrides)
	}

	// null borra la marca
	if err := database.SetChronologySpanOverrides(account, map[string]*bool{"db-pilaf": nil}); err != nil {
		t.Fatal(err)
	}
	resp, _ = BuildChronologyProgress(database, account)
	if _, ok := resp.Overrides["db-pilaf"]; ok || len(resp.Overrides) != 1 {
		t.Errorf("expected db-pilaf override removed, got %v", resp.Overrides)
	}
}

func TestSearchSemanticEntities(t *testing.T) {
	tests := []struct {
		query       string
		minResults  int
		wantKeyword string
	}{
		{"ultra instinto", 1, "Ultra Instinto"},
		{"broly", 1, "Broly"},
		{"freezer", 1, "Saga de Freezer"},
		{"vegeta", 1, "Vegeta"},
		{"padre de goku", 1, "Bardock"},
	}

	for _, tt := range tests {
		results := SearchSemanticEntities(tt.query)
		if len(results) < tt.minResults {
			t.Errorf("query %q: got %d results, want >= %d", tt.query, len(results), tt.minResults)
		}
	}
}
