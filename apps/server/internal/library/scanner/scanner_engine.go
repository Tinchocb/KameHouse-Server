package scanner

import (
	"context"
	"errors"
	"fmt"
	"kamehouse/internal/api/metadata_provider"
	"kamehouse/internal/api/tmdb"
	"kamehouse/internal/database/db"
	"kamehouse/internal/database/models"
	"kamehouse/internal/database/models/dto"
	"kamehouse/internal/events"
	"kamehouse/internal/library/anime"
	"kamehouse/internal/library/filesystem"
	librarymetadata "kamehouse/internal/library/metadata"
	"kamehouse/internal/library/summary"
	"kamehouse/internal/platforms/platform"
	"kamehouse/internal/util"
	"os"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/rs/zerolog"
	"github.com/samber/lo"
)

var ErrNoLocalFiles = errors.New("[matcher] no local files")

type Scanner struct {
	DirPath                    string
	OtherDirPaths              []string
	SeriesPaths                []string
	MoviePaths                 []string
	Enhanced                   bool
	EnhanceWithOfflineDatabase bool
	PlatformRef                *util.Ref[platform.Platform]
	Logger                     *zerolog.Logger
	WSEventManager             events.WSEventManagerInterface
	ExistingLocalFiles         []*dto.LocalFile
	SkipLockedFiles            bool
	SkipIgnoredFiles           bool
	ScanSummaryLogger          *summary.ScanSummaryLogger
	ScanLogger                 *ScanLogger
	Database                   *db.Database // Used to save LibraryMedia found via NFO
	MetadataProviderRef        *util.Ref[metadata_provider.Provider]
	MetadataProviders          []librarymetadata.Provider
	UseLegacyMatching          bool
	MatchingThreshold          float64 // only used by legacy

	MatchingAlgorithm string // only used by legacy
	StrictStructure   bool   // new matching mode

	// If true, locked files whose library path doesn't exist will be put aside
	WithShelving         bool
	ExistingShelvedFiles []*dto.LocalFile
	shelvedLocalFiles    []*dto.LocalFile
	Config               *Config
	ConfigAsString       string
	// Optional, used to add custom sources
	AnimeCollection *platform.UnifiedCollection
	// TMDB mode: use folder structure + TMDB instead of other metadata providers
	UseTMDB bool

	EventDispatcher events.Dispatcher
	TMDBClient      *tmdb.Client

	// Optional enrichers
	FanArtEnricher   *librarymetadata.FanArtEnricher
	OMDbEnricher     *librarymetadata.OMDbEnricher
	OpenSubsEnricher *librarymetadata.OpenSubtitlesEnricher
	ScanMode         string
	TargetPaths      []string
	FFprobePath      string
}

// Scan will scan the directory and return a list of dto.LocalFile.
func (scn *Scanner) Scan(ctx context.Context) (lfs []*dto.LocalFile, err error) {
	defer util.HandlePanicWithError(&err)

	go anime.EpisodeCollectionFromLocalFilesCache.Clear()

	// ── Non-blocking telemetry ────────────────────────────────────────────────
	// All WSEventManager calls are routed through a buffered channel so workers
	// never block waiting for a slow WebSocket client to drain.
	telemetry := newScanTelemetry(scn.WSEventManager, 256)
	telCtx, cancelTelemetry := context.WithCancel(ctx)
	go telemetry.Run(telCtx)
	defer func() {
		cancelTelemetry()
		telemetry.Close()
	}()

	if scn.EventDispatcher != nil {
		scn.EventDispatcher.Publish(events.Event{
			Topic: "library.scan",
			Payload: map[string]any{
				"status":    "START",
				"timestamp": time.Now(),
			},
		})
	}

	telemetry.Send(events.EventScanProgress, 0)
	telemetry.Send(events.EventScanStatus, "Retrieving local files...")

	if scn.ScanSummaryLogger == nil {
		scn.ScanSummaryLogger = summary.NewScanSummaryLogger()
	}

	if scn.ConfigAsString != "" && scn.Config == nil {
		scn.Config, _ = ToConfig(scn.ConfigAsString)
	}
	if scn.Config == nil {
		scn.Config = &Config{}
	}
	scn.Config.Matching.StrictStructure = scn.StrictStructure

	scn.Logger.Debug().Msg("scanner: Starting scan")
	telemetry.Send(events.EventScanProgress, 10)
	telemetry.Send(events.EventScanStatus, "Retrieving local files...")

	startTime := time.Now()

	if scn.ScanLogger != nil {
		scn.ScanLogger.logger.Info().
			Time("startTime", startTime).
			Str("scanMode", scn.ScanMode).
			Msg("Scanning started")

		defer func() {
			now := time.Now()
			scn.ScanLogger.logger.Info().
				Time("endTime", time.Now()).
				Str("duration", now.Sub(startTime).String()).
				Int("localFilesCount", len(lfs)).
				Msg("Ended")

			// Update last scan time
			if scn.Database != nil {
				if s, err := scn.Database.GetSettings(); err == nil && s != nil {
					s.Library.LastScanAt = startTime
					_, _ = scn.Database.UpsertSettings(s)
				}
			}
		}()
	}

	var localFiles []*dto.LocalFile
	skippedLfs := make(map[string]*dto.LocalFile)
	var libraryPaths []string

	if scn.ScanMode == "metadata" {
		scn.Logger.Info().Msg("scanner: Running in metadata improvement mode. Skipping file matching and probing.")
		telemetry.Send(events.EventScanStatus, "Loading existing library files...")
		localFiles = append([]*dto.LocalFile(nil), scn.ExistingLocalFiles...)
		libraryPaths = append([]string{scn.DirPath}, scn.OtherDirPaths...)
	} else {
		// +---------------------+
		// |     File paths      |
		// +---------------------+

		var paths []string
		paths, libraryPaths, _ = scn.discoverFilePaths(ctx, time.Time{})

		if scn.ScanLogger != nil {
			scn.ScanLogger.logger.Info().
				Any("count", len(paths)).
				Msg("Retrieved file paths from all directories")
		}

		// +---------------------+
		// |    Local files      |
		// +---------------------+

		// Get skipped files depending on options
		if scn.ExistingLocalFiles != nil {
			// Retrieve skipped files from existing local files
			for _, lf := range scn.ExistingLocalFiles {
				if lf == nil {
					continue
				}

				// 1. Explicit skip (locked/ignored)
				if (scn.SkipLockedFiles && lf.IsLocked()) || (scn.SkipIgnoredFiles && lf.IsIgnored()) {
					skippedLfs[lf.GetNormalizedPath()] = lf
					continue
				}

				// 2. File Map optimization (Fast Scan)
				if scn.ScanMode != "deep" {
					if stat, err := os.Stat(lf.Path); err == nil {
						if stat.Size() == lf.FileSize && stat.ModTime().Unix() == lf.FileModTime {
							skippedLfs[lf.GetNormalizedPath()] = lf
							continue
						}
					}
				}
			}
		}

		telemetry.Send(events.EventScanProgress, 20)
		telemetry.Send(events.EventScanStatus, "Verifying shelved files...")

		// +---------------------+
		// |    Shelved files    |
		// +---------------------+

		scn.Logger.Debug().Int("count", len(scn.ExistingShelvedFiles)).Msg("scanner: Verifying shelved files")

		// Unshelve shelved files \/
		// Check for shelved files that are now present
		// If a shelved file is found, it is added to the skipped files list (so it's not rescanned)
		for _, shelvedLf := range scn.ExistingShelvedFiles {
			if filesystem.FileExists(shelvedLf.Path) {
				skippedLfs[shelvedLf.GetNormalizedPath()] = shelvedLf
			}
		}

		telemetry.Send(events.EventScanProgress, 30)
		telemetry.Send(events.EventScanStatus, "Scanning local files...")
		telemetry.Send(events.EventScanProgressDetailed, map[string]interface{}{
			"stage":     "file-retrieval",
			"fileCount": len(paths),
			"skipped":   len(skippedLfs),
			"message":   fmt.Sprintf("Found %d files (%d skipped)", len(paths), len(skippedLfs)),
		})

		localFiles = scn.createLocalFiles(ctx, paths, libraryPaths, skippedLfs)

		if scn.ScanLogger != nil {
			scn.ScanLogger.logger.Debug().
				Any("count", len(localFiles)).
				Msg("Local files to be scanned")
			scn.ScanLogger.logger.Debug().
				Any("count", len(skippedLfs)).
				Msg("Skipped files")

			scn.ScanLogger.logger.Debug().
				Msg("===========================================================================================================")
		}

		for _, lf := range localFiles {
			if scn.ScanLogger != nil {
				scn.ScanLogger.logger.Trace().
					Str("path", lf.Path).
					Str("filename", lf.Name).
					Interface("parsedData", lf.ParsedData).
					Interface("parsedFolderData", lf.ParsedFolderData).
					Msg("Parsed local file")
			}
		}

		if scn.ScanLogger != nil {
			scn.ScanLogger.logger.Debug().
				Msg("===========================================================================================================")
		}

		// ── Probing Phase (Technical Info) ────────────────────────────────────────
		if len(localFiles) > 0 {
			telemetry.Send(events.EventScanStatus, "Extracting file information...")
			prober := NewFileProber(scn.FFprobePath, scn.Logger)
			prober.ProbeFiles(ctx, localFiles)
		}
	}

	// DEVNOTE: Removed library path checking because it causes some issues with symlinks

	// +---------------------+
	// |  No files to scan   |
	// +---------------------+

	// If there are no local files to scan (all files are skipped, or a file was deleted)
	if len(localFiles) == 0 {
		if scn.WSEventManager != nil {
			scn.WSEventManager.SendEvent(events.EventScanProgress, 90)
			scn.WSEventManager.SendEvent(events.EventScanStatus, "Verifying file integrity...")
		}

		scn.Logger.Debug().Int("skippedLfs", len(skippedLfs)).Msgf("scanner: Adding skipped local files")
		// Add skipped files
		if len(skippedLfs) > 0 {
			for _, sf := range skippedLfs {
				if filesystem.FileExists(sf.Path) { // Verify that the file still exists
					localFiles = append(localFiles, sf)
				} else if scn.WithShelving && sf.IsLocked() { // If the file is locked and shelving is enabled, shelve it
					scn.shelvedLocalFiles = append(scn.shelvedLocalFiles, sf)
				}
			}
		}

		// Add remaining shelved files
		scn.addRemainingShelvedFiles(skippedLfs)

		scn.Logger.Debug().Msg("scanner: Scan completed")
		if scn.WSEventManager != nil {
			scn.WSEventManager.SendEvent(events.EventScanProgress, 100)
			scn.WSEventManager.SendEvent(events.EventScanStatus, "Scan completed")
		}

		if scn.EventDispatcher != nil {
			scn.EventDispatcher.Publish(events.Event{
				Topic: "library.scan",
				Payload: map[string]any{
					"status":          "FINISH",
					"total_processed": len(localFiles),
				},
			})
		}

		return localFiles, nil
	}

	telemetry.Send(events.EventScanProgress, 40)
	if scn.Enhanced {
		telemetry.Send(events.EventScanStatus, "Fetching additional matching data...")
	} else {
		telemetry.Send(events.EventScanStatus, "Fetching media...")
	}

	// +---------------------+
	// |    NFO Support      |
	// +---------------------+

	if scn.ScanMode != "metadata" {
		scn.Logger.Debug().Msg("scanner: Looking for local NFO metadata files")
		// Track NFO folders already processed to avoid creating duplicate LibraryMedia
		var nfoFolderMap sync.Map // folder path -> LibraryMedia ID (uint)

		// Bounded worker pool for NFO resolution
		maxWorkers := runtime.NumCPU()
		if maxWorkers < 4 {
			maxWorkers = 4
		}
		if maxWorkers > 16 {
			maxWorkers = 16
		}

		var nfoDbMu sync.Mutex

		nfoJobs := make(chan *dto.LocalFile, len(localFiles))
		for _, lf := range localFiles {
			nfoJobs <- lf
		}
		close(nfoJobs)

		var nfoWg sync.WaitGroup
		for i := 0; i < maxWorkers; i++ {
			nfoWg.Add(1)
			go func() {
				defer nfoWg.Done()
				for lf := range nfoJobs {
					if lf == nil || lf.LibraryMediaId != 0 || lf.MediaId != 0 {
						continue
					}

					lfDir := filepath.Dir(lf.Path)

					// 1. Check folder-level cache
					if libMediaId, exists := nfoFolderMap.Load(lfDir); exists {
						lf.LibraryMediaId = libMediaId.(uint)
						continue
					}

					// 2. Typical Kodi NFO paths
					nfoPaths := []string{
						util.ReplaceExtension(lf.Path, ".nfo"), // [filename].nfo (Per-file NFO takes priority)
						filepath.Join(lfDir, "tvshow.nfo"),
						filepath.Join(lfDir, "anime.nfo"),
						filepath.Join(lfDir, "movie.nfo"),
					}

					for _, nfoPath := range nfoPaths {
						if filesystem.FileExists(nfoPath) {
							nfo, err := ParseNfoFile(nfoPath)
							if err == nil && nfo != nil {
								// For per-file NFO ([filename].nfo), we don't cache it for the folder
								isPerFileNfo := strings.HasSuffix(strings.ToLower(nfoPath), ".nfo") && !strings.HasSuffix(strings.ToLower(nfoPath), "tvshow.nfo") && !strings.HasSuffix(strings.ToLower(nfoPath), "anime.nfo") && !strings.HasSuffix(strings.ToLower(nfoPath), "movie.nfo")

								// If it's a folder-level NFO, check cache again (double-checked locking pattern)
								if !isPerFileNfo {
									if libMediaId, exists := nfoFolderMap.Load(lfDir); exists {
										lf.LibraryMediaId = libMediaId.(uint)
										break
									}
								}

								// Determine format
								format := "TV"
								if nfo.XMLName.Local == "movie" {
									format = "MOVIE"
								}

								newMedia := &models.LibraryMedia{
									Type:          "ANIME",
									Format:        format,
									TitleOriginal: nfo.OriginalTitle,
									TitleRomaji:   nfo.Title,
									TitleEnglish:  nfo.Title,
									Description:   nfo.Plot,
									Rating:        nfo.Rating,
									Year:          nfo.Year,
								}

								if scn.Database != nil {
									nfoDbMu.Lock()
									saved, err := db.InsertLibraryMedia(scn.Database, newMedia)
									nfoDbMu.Unlock()
									
									if err == nil && saved != nil {
										lf.LibraryMediaId = saved.ID
										if !isPerFileNfo {
											nfoFolderMap.Store(lfDir, saved.ID)
										}

										if tmdbID := nfo.GetTmdbID(); tmdbID > 0 {
											lf.MediaId = tmdbID
										}

										scn.Logger.Info().
											Str("filename", lf.Name).
											Uint("libraryMediaId", saved.ID).
											Msg("scanner: Created LibraryMedia via local NFO")
										break
									}
								}
							}
						}
					}
				}
			}()
		}
		nfoWg.Wait()
	}

	// +---------------------+
	// |    MediaFetcher     |
	// +---------------------+

	// Fetch media needed for matching
	// Build TMDB client and provider
	var tmdbClient *tmdb.Client
	var tmdbProvider *librarymetadata.TMDBProvider
	useTMDB := scn.UseTMDB

	if scn.TMDBClient != nil {
		tmdbClient = scn.TMDBClient
		tmdbProvider = librarymetadata.NewTMDBProviderWithClient(tmdbClient, scn.Database)
		scn.Logger.Debug().Msg("scanner: Using provided TMDb client")
	} else {
		// Fallback for cases where it's not provided (e.g. background runs)
		tmdbToken := ""
		tmdbLanguage := ""
		if scn.Database != nil {
			if settings, err := scn.Database.GetSettings(); err == nil && settings != nil {
				tmdbToken = settings.Library.TmdbApiKey
				tmdbLanguage = settings.Library.TmdbLanguage
			}
		}
		if tmdbToken == "" {
			tmdbToken = os.Getenv("KAMEHOUSE_TMDB_TOKEN")
		}

		if tmdbToken != "" {
			tmdbClient = tmdb.NewClient(tmdbToken, tmdbLanguage)
			tmdbProvider = librarymetadata.NewTMDBProviderWithClient(tmdbClient, scn.Database)
			scn.Logger.Debug().Msg("scanner: TMDb client initialized from settings/env")
		}
	}

	if useTMDB {
		if tmdbProvider != nil {
			scn.Logger.Info().Msg("scanner: TMDB mode enabled")
		} else {
			scn.Logger.Warn().Msg("scanner: TMDB mode requested but TMDB token not set, falling back to default provider")
			useTMDB = false
		}
	}

	providers := scn.MetadataProviders
	if len(providers) == 0 {
		if tmdbProvider != nil {
			providers = append(providers, tmdbProvider)
		}
		providers = append(providers, librarymetadata.NewAniDBProvider("", scn.Logger))
	}

	// +---------------------+
	// |  Episode Metadata   |
	// | Provider (TMDB)     |
	// +---------------------+
	// If MetadataProviderRef is unset (or uses the empty stub), replace it with the
	// TMDB-backed implementation so episodes get real titles/thumbnails/overviews.
	if tmdbClient != nil && (scn.MetadataProviderRef == nil || scn.MetadataProviderRef.IsAbsent()) {
		realProvider := metadata_provider.NewProvider(&metadata_provider.NewProviderImplOptions{
			Database:   scn.Database,
			Logger:     scn.Logger,
			TMDBClient: tmdbClient,
		})
		scn.MetadataProviderRef = util.NewRef(realProvider)
		scn.Logger.Info().Msg("scanner: TMDB episode metadata provider initialized")
	}

	mf, err := NewMediaFetcher(ctx, &MediaFetcherOptions{
		PlatformRef:             scn.PlatformRef,
		MetadataProviderRef:     scn.MetadataProviderRef,
		MetadataProviders:       providers,
		LocalFiles:              localFiles,
		Logger:                  scn.Logger,
		DisableAnimeCollection:  false,
		ScanLogger:              scn.ScanLogger,
		OptionalAnimeCollection: scn.AnimeCollection,
		TMDBProvider:            tmdbProvider,
		SeriesPaths:             scn.SeriesPaths,
		MoviePaths:              scn.MoviePaths,
		Database:                scn.Database,
	})
	if err != nil {
		return nil, err
	}

	telemetry.Send(events.EventScanProgress, 50)
	telemetry.Send(events.EventScanStatus, "Matching local files...")

	// +---------------------+
	// |   MediaContainer    |
	// +---------------------+

	// TMDb client has already been initialized above

	// Create a new container for media
	mc := NewMediaContainer(&MediaContainerOptions{
		AllMedia:   mf.AllMedia,
		ScanLogger: scn.ScanLogger,
		TmdbClient: tmdbClient,
	})

	scn.Logger.Debug().
		Any("count", len(mc.NormalizedMedia)).
		Msg("media container: Media container created")

	// +---------------------+
	// |      Matcher        |
	// +---------------------+

	if scn.ScanMode != "metadata" {
		// Create a new matcher
		matcher := &Matcher{
			LocalFiles:        localFiles,
			MediaContainer:    mc,
			Logger:            scn.Logger,
			Database:          scn.Database,
			Threshold:         scn.MatchingThreshold,
			MatchingAlgorithm: scn.MatchingAlgorithm,
			StrictStructure:   scn.StrictStructure,
		}

		telemetry.Send(events.EventScanProgress, 60)

		err = matcher.MatchLocalFilesWithMedia()
		if err != nil {
			if errors.Is(err, ErrNoLocalFiles) {
				scn.Logger.Debug().Msg("scanner: Scan completed")
				telemetry.Send(events.EventScanProgress, 100)
				telemetry.Send(events.EventScanStatus, "Scan completed")
			}
			return nil, err
		}
	}

	telemetry.Send(events.EventScanProgress, 70)
	telemetry.Send(events.EventScanStatus, "Hydrating metadata...")
	telemetry.Send(events.EventScanProgressDetailed, map[string]interface{}{
		"stage":      "matching-complete",
		"matched":    len(lo.Filter(localFiles, func(lf *dto.LocalFile, _ int) bool { return lf.MediaId != 0 })),
		"unmatched":  len(lo.Filter(localFiles, func(lf *dto.LocalFile, _ int) bool { return lf.MediaId == 0 })),
		"totalFiles": len(localFiles),
		"message":    "Matching complete, hydrating metadata...",
	})

	// +---------------------+
	// |    FileHydrator     |
	// +---------------------+

	// Create a new hydrator
	hydrator := &FileHydrator{
		AllMedia:            mc.NormalizedMedia,
		LocalFiles:          localFiles,
		MetadataProviderRef: scn.MetadataProviderRef,
		PlatformRef:         scn.PlatformRef,
		Logger:              scn.Logger,
		ScanLogger:          scn.ScanLogger,
		ScanSummaryLogger:   scn.ScanSummaryLogger,
		Config:              scn.Config,
	}
	hydrator.HydrateMetadata(ctx)

	// +---------------------+
	// |  Metadata Enrichers |
	// +---------------------+

	if scn.FanArtEnricher != nil || scn.OMDbEnricher != nil || scn.OpenSubsEnricher != nil {
		scn.Logger.Info().Msg("scanner: running optional metadata enrichers")
		normalizedMap := make(map[int]*dto.NormalizedMedia)
		for _, nm := range mc.NormalizedMedia {
			normalizedMap[nm.ID] = nm
		}

		// Group local files by MediaId to avoid redundant enrichment
		mediaGroups := make(map[int][]*dto.LocalFile)
		for _, lf := range localFiles {
			if lf.MediaId != 0 {
				mediaGroups[lf.MediaId] = append(mediaGroups[lf.MediaId], lf)
			}
		}

		// Parallel process enrichment per unique MediaId
		enrichWorkers := runtime.NumCPU()
		if enrichWorkers < 2 {
			enrichWorkers = 2
		}
		if enrichWorkers > 8 {
			enrichWorkers = 8
		}

		mIdChan := make(chan int, len(mediaGroups))
		for mId := range mediaGroups {
			mIdChan <- mId
		}
		close(mIdChan)

		var enrichWg sync.WaitGroup
		for i := 0; i < enrichWorkers; i++ {
			enrichWg.Add(1)
			go func() {
				defer enrichWg.Done()
				for mId := range mIdChan {
					matchedMedia, ok := normalizedMap[mId]
					if !ok {
						continue
					}

					// 1. FanArt.tv (Per MediaId)
					if scn.FanArtEnricher != nil {
						isMovie := matchedMedia.ID >= 1_000_000 || (matchedMedia.Format != nil && *matchedMedia.Format == dto.MediaFormatMovie)
						if isMovie {
							realTmdbId := matchedMedia.ID
							if realTmdbId >= 1_000_000 {
								realTmdbId -= 1_000_000
							}
							_ = scn.FanArtEnricher.EnrichMovie(ctx, matchedMedia, realTmdbId)
						} else {
							tvdbID := ""
							if matchedMedia.TvdbId != nil {
								tvdbID = strconv.Itoa(*matchedMedia.TvdbId)
							}
							if tvdbID == "" && tmdbProvider != nil {
								extIds, err := tmdbProvider.GetClient().GetTVExternalIDs(ctx, matchedMedia.ID)
								if err == nil && extIds.TvdbID != "" {
									tvdbID = extIds.TvdbID
								}
							}
							if tvdbID != "" {
								_ = scn.FanArtEnricher.EnrichTV(ctx, matchedMedia, tvdbID)
							}
						}
					}

					// 2. OMDb (Per MediaId)
					if scn.OMDbEnricher != nil {
						if matchedMedia.Title != nil && matchedMedia.Title.UserPreferred != nil {
							year := 0
							if matchedMedia.Year != nil {
								year = *matchedMedia.Year
							}
							_ = scn.OMDbEnricher.EnrichByTitle(ctx, matchedMedia, *matchedMedia.Title.UserPreferred, year)
						}
					}

					// 3. OpenSubtitles (Per LocalFile)
					if scn.OpenSubsEnricher != nil {
						for _, lf := range mediaGroups[mId] {
							season, episode := 0, 0
							if lf.ParsedData != nil {
								if lf.ParsedData.Season != "" {
									season, _ = util.StringToInt(lf.ParsedData.Season)
								}
								if lf.ParsedData.Episode != "" {
									episode, _ = util.StringToInt(lf.ParsedData.Episode)
								}
							}
							_ = scn.OpenSubsEnricher.EnrichLocalFile(ctx, lf, matchedMedia, season, episode)
						}
					}
				}
			}()
		}
		enrichWg.Wait()
	}

	telemetry.Send(events.EventScanProgress, 80)

	// +---------------------+
	// |  Add missing media  |
	// +---------------------+

	// Add non-added media entries to platform collection
	if len(mf.UnknownMediaIds) < 5 && scn.PlatformRef != nil && !scn.PlatformRef.IsAbsent() {
		if scn.WSEventManager != nil {
			scn.WSEventManager.SendEvent(events.EventScanStatus, "Adding missing media to platform...")
		}

		if err = scn.PlatformRef.Get().AddMediaToCollection(ctx, mf.UnknownMediaIds); err != nil {
			scn.Logger.Warn().Msg("scanner: An error occurred while adding media to collection: " + err.Error())
		}
	}

	// +---------------------+
	// |    Merge files      |
	// +---------------------+

	// Merge skipped files with scanned files before persistence so they are all accounted for
	// and their LibraryMediaId associations are verified/restored.
	if len(skippedLfs) > 0 {
		scn.Logger.Debug().Int("skippedLfs", len(skippedLfs)).Msg("scanner: Merging skipped local files before persistence")
		for _, sf := range skippedLfs {
			if filesystem.FileExists(sf.Path) {
				localFiles = append(localFiles, sf)
			} else if scn.WithShelving && sf.IsLocked() {
				scn.shelvedLocalFiles = append(scn.shelvedLocalFiles, sf)
			}
		}
	}

	// Always create LibraryMedia DB records and add media to collection.
	// LibraryMedia DB creation is separate from platform ref check since it only needs the DB.
	if true {
		// Collect all unique media IDs from matched local files
		allMatchedIds := make(map[int]struct{})
		for _, lf := range localFiles {
			if lf.MediaId != 0 {
				allMatchedIds[lf.MediaId] = struct{}{}
			}
		}
		// Also include CollectionMediaIds from the fetcher
		for _, id := range mf.CollectionMediaIds {
			allMatchedIds[id] = struct{}{}
		}

		// Build a map from media ID → file-derived title for fallback
		// and detect which media IDs are movies based on folder structure
		fileTitleMap := make(map[int]string)
		movieIds := make(map[int]bool)
		for _, lf := range localFiles {
			if lf.MediaId != 0 {
				if _, exists := fileTitleMap[lf.MediaId]; !exists {
					info := ParseFolderStructure(lf.Path, libraryPaths)
					if info.SeriesName != "" {
						fileTitleMap[lf.MediaId] = info.SeriesName
					}
					if info.IsMovie {
						movieIds[lf.MediaId] = true
					}
				}
				// IDs with offset >= 1,000,000 are always movies (DragonBallResolver convention)
				if lf.MediaId >= 1_000_000 {
					movieIds[lf.MediaId] = true
				}
			}
		}

		// Create LibraryMedia DB records for each unique matched media
		// This is necessary so the collection can look them up and show entries in the UI
		scn.Logger.Info().
			Int("allMatchedIds", len(allMatchedIds)).
			Bool("dbIsNil", scn.Database == nil).
			Msg("scanner: Starting TMDB LibraryMedia persistence")
		if scn.Database != nil {

			// Persist LibraryMedia records and map IDs back to local files
			libraryMediaIdMap := scn.persistMatchedMedia(allMatchedIds, movieIds, mc.NormalizedMedia, localFiles)

			scn.Logger.Info().
				Int("totalMatched", len(allMatchedIds)).
				Int("libraryMediaCreated", len(libraryMediaIdMap)).
				Msg("scanner: TMDB LibraryMedia persistence completed")

			// Fetch enriched metadata (seasons, episodes, etc.)
			err = scn.enrichMediaMetadata(ctx, libraryMediaIdMap, movieIds, localFiles)
			if err != nil {
				return nil, err
			}
		}

		// Add media to platform collection (requires platform ref)
		if scn.PlatformRef != nil && !scn.PlatformRef.IsAbsent() {
			allIds := make([]int, 0, len(allMatchedIds))
			for id := range allMatchedIds {
				allIds = append(allIds, id)
			}
			if len(allIds) > 0 {
				scn.Logger.Debug().Int("count", len(allIds)).Msg("scanner: Adding all matched media to platform collection")
				if err = scn.PlatformRef.Get().AddMediaToCollection(ctx, allIds); err != nil {
					scn.Logger.Warn().Msg("scanner: An error occurred while adding TMDB media to collection: " + err.Error())
				}
			}
		}

		// ── Persist franchise/saga collections ─────────────────────────────────
		// For every scanned movie, fetch its detailed metadata from TMDB to
		// discover BelongsToCollection. Then upsert each unique collection so
		// the /api/v1/collections/:id endpoint can serve cached poster/overview data.
		if scn.Database != nil && scn.TMDBClient != nil && len(movieIds) > 0 {
			scn.Logger.Info().Int("movieCount", len(movieIds)).Msg("scanner: Fetching BelongsToCollection for movies")

			// Map collectionID → list of real TMDB movie IDs
			collectionMembers := make(map[int][]int)

			for normalizedID := range movieIds {
				if ctx.Err() != nil {
					break
				}
				realMovieID := normalizedID - 1_000_000
				if realMovieID <= 0 {
					continue
				}

				details, detailErr := scn.TMDBClient.GetMovieDetailsV2(ctx, realMovieID)
				if detailErr != nil {
					scn.Logger.Debug().Err(detailErr).Int("tmdbId", realMovieID).Msg("scanner: Could not get movie details for collection lookup")
					continue
				}

				if details.BelongsToCollection != nil && details.BelongsToCollection.ID > 0 {
					collID := details.BelongsToCollection.ID
					collectionMembers[collID] = append(collectionMembers[collID], realMovieID)
				}
			}

			// Upsert each discovered collection
			for collID, memberIDs := range collectionMembers {
				if ctx.Err() != nil {
					break
				}
				collDetails, collErr := scn.TMDBClient.GetCollection(ctx, collID)
				if collErr != nil {
					scn.Logger.Warn().Err(collErr).Int("collectionId", collID).Msg("scanner: Could not fetch collection details")
					continue
				}

				posterPath := ""
				backdropPath := ""
				if collDetails.PosterPath != "" {
					posterPath = "https://image.tmdb.org/t/p/original" + collDetails.PosterPath
				}
				if collDetails.BackdropPath != "" {
					backdropPath = "https://image.tmdb.org/t/p/original" + collDetails.BackdropPath
				}

				memberSlice := make(models.IntSlice, len(memberIDs))
				copy(memberSlice, memberIDs)

				coll := &models.MediaCollection{
					TMDBCollectionID: collID,
					Name:             collDetails.Name,
					Overview:         collDetails.Overview,
					PosterPath:       posterPath,
					BackdropPath:     backdropPath,
					MemberIDs:        memberSlice,
				}

				if upsertErr := db.UpsertMediaCollection(scn.Database, coll); upsertErr != nil {
					scn.Logger.Warn().Err(upsertErr).Int("collectionId", collID).Msg("scanner: Failed to upsert MediaCollection")
				} else {
					scn.Logger.Info().
						Int("collectionId", collID).
						Str("name", collDetails.Name).
						Int("members", len(memberIDs)).
						Msg("scanner: Persisted saga collection")
				}
			}
		}
	}

	if scn.WSEventManager != nil {
		scn.WSEventManager.SendEvent(events.EventScanProgress, 90)
		scn.WSEventManager.SendEvent(events.EventScanStatus, "Verifying file integrity...")
		scn.WSEventManager.SendEvent(events.EventScanProgressDetailed, map[string]interface{}{
			"stage":   "integrity-check",
			"message": "Verifying file integrity and merging results...",
		})
	}

	// +---------------------+
	// |    Merge Files      |
	// +---------------------+

	// We must merge the skipped files (unchanged/locked/ignored) back into localFiles
	// before persisting and returning. Otherwise, the database sync will delete them.
	if len(skippedLfs) > 0 {
		for _, sf := range skippedLfs {
			if sf == nil {
				continue
			}
			// Only add if not already in localFiles (to avoid duplicates if something went wrong)
			// But since createLocalFiles excludes them, we can just append.
			localFiles = append(localFiles, sf)
		}
	}

	// Hydrate the summary logger before returning
	scn.ScanSummaryLogger.HydrateData(localFiles, mc.NormalizedMedia, nil)

	// +---------------------+
	// |    Finalize Scan    |
	// +---------------------+

	// Add remaining shelved files
	scn.addRemainingShelvedFiles(skippedLfs)

	scn.Logger.Info().Msg("scanner: Scan completed")
	if scn.WSEventManager != nil {
		scn.WSEventManager.SendEvent(events.EventScanProgress, 100)
		scn.WSEventManager.SendEvent(events.EventScanStatus, "Scan completed")
	}

	if scn.ScanLogger != nil {
		scn.ScanLogger.logger.Info().
			Int("count", len(localFiles)).
			Int("unknownMediaCount", len(mf.UnknownMediaIds)).
			Msg("Scan completed")
	}

	if scn.EventDispatcher != nil {
		scn.EventDispatcher.Publish(events.Event{
			Topic: "library.scan",
			Payload: map[string]any{
				"status":          "FINISH",
				"total_processed": len(localFiles),
			},
		})
	}

	return localFiles, nil
}
