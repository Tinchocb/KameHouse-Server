package anime

import (
	"cmp"
	"context"
	"encoding/json"
	"kamehouse/internal/api/metadata_provider"
	"kamehouse/internal/database/db"
	"kamehouse/internal/database/models"
	"kamehouse/internal/platforms/platform"
	"kamehouse/internal/util"
	"slices"
	"strings"

	"github.com/samber/lo"
)

type (
	// LibraryCollection holds the main data for the library collection.
	// It consists of:
	//  - ContinueWatchingList: a list of Episode for the "continue watching" feature.
	//  - Lists: a list of LibraryCollectionList (one for each status).
	//  - UnmatchedLocalFiles: a list of unmatched local files (Media id == 0). "Resolve unmatched" feature.
	//  - UnmatchedGroups: a list of UnmatchedGroup instances. Like UnmatchedLocalFiles, but grouped by directory. "Resolve unmatched" feature.
	//  - IgnoredLocalFiles: a list of ignored local files. (DEVNOTE: Unused for now)
	//  - UnknownGroups: a list of UnknownGroup instances. Group of files whose media is not in the user's platform collection. "Resolve unknown media" feature.
	LibraryCollection struct {
		ContinueWatchingList []*Episode               `json:"continueWatchingList"`
		Lists                []*LibraryCollectionList `json:"lists"`
		UnmatchedLocalFiles  []*LocalFile             `json:"unmatchedLocalFiles"`
		UnmatchedGroups      []*UnmatchedGroup        `json:"unmatchedGroups"`
		IgnoredLocalFiles    []*LocalFile             `json:"ignoredLocalFiles"`
		UnknownGroups        []*UnknownGroup          `json:"unknownGroups"`
		Stats                *LibraryCollectionStats  `json:"stats"`
		Stream               *StreamCollection        `json:"stream,omitempty"` // Hydrated by the route handler
	}

	StreamCollection struct {
		ContinueWatchingList []*Episode             `json:"continueWatchingList"`
		Anime                []*models.LibraryMedia `json:"anime"`
		ListData             map[int]*EntryListData `json:"listData"`
	}

	LibraryCollectionStats struct {
		TotalEntries  int    `json:"totalEntries"`
		TotalFiles    int    `json:"totalFiles"`
		TotalShows    int    `json:"totalShows"`
		TotalMovies   int    `json:"totalMovies"`
		TotalSpecials int    `json:"totalSpecials"`
		TotalSize     string `json:"totalSize"`
	}

	LibraryCollectionList struct {
		Type    string                    `json:"type"`
		Status  string                    `json:"status"`
		Entries []*LibraryCollectionEntry `json:"entries"`
	}

	// LibraryCollectionEntry holds the data for a single entry in a LibraryCollectionList.
	// It is a slimmed down version of Entry. It holds the media, media id, library data, and list data.
	LibraryCollectionEntry struct {
		Media            *models.LibraryMedia   `json:"media"`
		MediaID          int                    `json:"mediaId"`
		Episode          *models.LibraryEpisode `json:"episode,omitempty"` // For episode-specific swimlanes
		AvailabilityType string                 `json:"availabilityType"`  // FULL_LOCAL, HYBRID, ONLY_ONLINE
		EntryLibraryData *EntryLibraryData      `json:"libraryData"`       // Library data
		EntryListData    *EntryListData         `json:"listData"`          // Local list data
		Vibes            []string               `json:"vibes"`             // Emotional or thematic tags
		Tags             []string               `json:"tags"`              // AI-derived intelligence tags
		DominantVibe     string                 `json:"dominantVibe"`      // Primary AI-derived vibe
	}

	// UnmatchedGroup holds the data for a group of unmatched local files.
	UnmatchedGroup struct {
		Dir         string                 `json:"dir"`
		LocalFiles  []*LocalFile           `json:"localFiles"`
		Suggestions []*models.LibraryMedia `json:"suggestions"`
	}
	// UnknownGroup holds the data for a group of local files whose media is not in the user's platform collection.
	// The client will use this data to suggest media to the user, so they can add it to their platform collection.
	UnknownGroup struct {
		MediaID    int          `json:"mediaId"`
		LocalFiles []*LocalFile `json:"localFiles"`
	}
)

type (
	// NewLibraryCollectionOptions is a struct that holds the data needed for creating a new LibraryCollection.
	NewLibraryCollectionOptions struct {
		Database            *db.Database
		LocalFiles          []*LocalFile
		PlatformRef         platform.Platform
		MetadataProviderRef metadata_provider.Provider
	}
)

// NewLibraryCollection creates a new LibraryCollection.
func NewLibraryCollection(ctx context.Context, opts *NewLibraryCollectionOptions) (lc *LibraryCollection, err error) {
	defer util.HandlePanicInModuleWithError("library/anime/NewLibraryCollection", &err)
	lc = new(LibraryCollection)

	// Create lists using local SQLite DB
	lc.hydrateCollectionLists(opts)

	lc.hydrateStats(opts.LocalFiles)

	// Add Continue Watching list
	lc.hydrateContinueWatchingList(
		ctx,
		opts.LocalFiles,
		opts.Database,
		opts.PlatformRef,
		opts.MetadataProviderRef,
	)

	lc.UnmatchedLocalFiles = lo.Filter(opts.LocalFiles, func(lf *LocalFile, index int) bool {
		return lf.MediaID == 0 && !lf.Ignored
	})

	lc.IgnoredLocalFiles = lo.Filter(opts.LocalFiles, func(lf *LocalFile, index int) bool {
		return lf.Ignored
	})

	slices.SortStableFunc(lc.IgnoredLocalFiles, func(i, j *LocalFile) int {
		return cmp.Compare(i.GetPath(), j.GetPath())
	})

	lc.hydrateUnmatchedGroups()

	return
}

func (e *LibraryCollectionEntry) DeriveVibes() {
	vibes := make([]string, 0)
	if e.Media == nil {
		return
	}

	// 1. AI-derived dominant vibe (highest priority)
	if e.Media.DominantVibe != "" {
		vibes = append(vibes, strings.ToUpper(e.Media.DominantVibe))
	}

	// 2. Epic vibe based on score
	if e.Media.Score >= 8.5 || e.Media.Score >= 85 {
		if !slices.Contains(vibes, "EPIC") {
			vibes = append(vibes, "EPIC")
		}
	}

	var genres []string
	_ = json.Unmarshal(e.Media.Genres, &genres)

	// 3. Chill vibe
	isChill := false
	for _, g := range genres {
		gl := strings.ToLower(g)
		if gl == "slice of life" || gl == "music" || gl == "healing" || gl == "comedy" {
			isChill = true
			break
		}
	}
	if isChill {
		if !slices.Contains(vibes, "CHILL") {
			vibes = append(vibes, "CHILL")
		}
	}

	// 4. Emotional vibe
	isEmotional := false
	for _, g := range genres {
		gl := strings.ToLower(g)
		if gl == "drama" || gl == "romance" || gl == "tearjerker" {
			isEmotional = true
			break
		}
	}
	if isEmotional {
		if !slices.Contains(vibes, "EMOTIONAL") {
			vibes = append(vibes, "EMOTIONAL")
		}
	}

	// 5. Hyped vibe
	isHyped := false
	for _, g := range genres {
		gl := strings.ToLower(g)
		if gl == "action" || gl == "sports" || gl == "shounen" || gl == "adventure" {
			isHyped = true
			break
		}
	}
	if isHyped {
		if !slices.Contains(vibes, "HYPED") {
			vibes = append(vibes, "HYPED")
		}
	}

	// 6. Intense vibe
	isIntense := false
	for _, g := range genres {
		gl := strings.ToLower(g)
		if gl == "horror" || gl == "psychological" || gl == "thriller" || gl == "dark fantasy" {
			isIntense = true
			break
		}
	}
	if isIntense {
		if !slices.Contains(vibes, "INTENSE") {
			vibes = append(vibes, "INTENSE")
		}
	}

	// 7. Map custom AI vibes to standard ones if needed
	// Example: "TensiÃ³n Absoluta" -> "INTENSE"
	for i, v := range vibes {
		switch v {
		case "TENSIÃ“N ABSOLUTA":
			vibes[i] = "INTENSE"
		case "EMOCIÃ“N PURA":
			vibes[i] = "EMOTIONAL"
		case "RELAJADO":
			vibes[i] = "CHILL"
		case "AVENTURA":
			vibes[i] = "HYPED"
		}
	}

	// Remove duplicates and empty strings
	vibes = lo.Uniq(vibes)
	vibes = lo.Filter(vibes, func(v string, _ int) bool { return v != "" })

	e.Vibes = vibes
}
