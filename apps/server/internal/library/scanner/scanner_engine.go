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
	PlatformRef                platform.Platform
	Logger                     *zerolog.Logger
	WSEventManager             events.WSEventManagerInterface
	ExistingLocalFiles         []*dto.LocalFile
	SkipLockedFiles            bool
	SkipIgnoredFiles           bool
	ScanSummaryLogger          *summary.ScanSummaryLogger
	ScanLogger                 *ScanLogger
	Database                   *db.Database // Used to save LibraryMedia found via NFO
	MetadataProviderRef        metadata_provider.Provider
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
	BackgroundQueue  *BackgroundQueue
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
	var sortedLibraryPaths []string

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
		paths, libraryPaths, sortedLibraryPaths = scn.discoverFilePaths(ctx, time.Time{})

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
			libraryPathExistsCache := make(map[string]bool)

			// Retrieve skipped files from existing local files
			for _, lf := range scn.ExistingLocalFiles {
				if lf == nil {
					continue
				}

				// Check if the file exists physically
				stat, err := os.Stat(lf.Path)
				exists := err == nil

				if !exists && scn.WithShelving {
					// The file does not exist. Check if the containing library path is offline!
					var matchedLibPath string
					for _, libPath := range sortedLibraryPaths {
						if strings.HasPrefix(lf.GetNormalizedPath(), util.NormalizePath(libPath)) {
							matchedLibPath = libPath
							break
						}
					}

					if matchedLibPath != "" {
						existsLib, checked := libraryPathExistsCache[matchedLibPath]
						if !checked {
							_, errLib := os.Stat(matchedLibPath)
							existsLib = errLib == nil || !os.IsNotExist(errLib)
							libraryPathExistsCache[matchedLibPath] = existsLib
							if !existsLib {
								scn.Logger.Warn().Str("libraryPath", matchedLibPath).Msg("scanner: containing library folder is offline/disconnected. Shelving files from deletion.")
							}
						}

						if !existsLib {
							// Library path is offline! We must SHELVE this file to protect it from deletion!
							scn.Logger.Debug().Str("path", lf.Path).Msg("scanner: shelving file because its library is offline")
							scn.shelvedLocalFiles = append(scn.shelvedLocalFiles, lf)
							// Also add to skippedLfs so we don't process it further in this scan
							skippedLfs[lf.GetNormalizedPath()] = lf
							continue
						}
					}
				}

				// 1. Explicit skip (locked/ignored)
				if (scn.SkipLockedFiles && lf.IsLocked()) || (scn.SkipIgnoredFiles && lf.IsIgnored()) {
					skippedLfs[lf.GetNormalizedPath()] = lf
					continue
				}

				// 2. File Map optimization (Fast Scan)
				if scn.ScanMode != "deep" {
					if exists {
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

		if scn.BackgroundQueue != nil {
			for _, lf := range localFiles {
				scn.BackgroundQueue.Enqueue(lf)
			}
		}

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
		scn.addRemainingShelvedFiles(skippedLfs, sortedLibraryPaths)

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

		// nfoFolderMap stores the LibraryMedia ID for each folder that has been
		// successfully processed. It is populated in the post-processing phase and
		// used in step 3 to propagate IDs to sibling files in the same folder.
		var nfoFolderMap sync.Map // folder path → LibraryMedia ID (uint)

		// nfoEntry holds all parsed data for one NFO match. Workers produce these;
		// the post-processing phase below is the sole consumer that writes to the DB.
		type nfoEntry struct {
			lf         *dto.LocalFile
			media      *models.LibraryMedia
			folderPath string
			isPerFile  bool
			tmdbID     int // 0 when the NFO contains no TMDB ID
		}

		// Bounded worker pool for NFO resolution
		maxWorkers := runtime.NumCPU()
		if maxWorkers < 4 {
			maxWorkers = 4
		}
		if maxWorkers > 16 {
			maxWorkers = 16
		}

		// nfoFolderClaimed prevents two workers from producing duplicate entries
		// for the same folder-level NFO. LoadOrStore acts as a non-blocking mutex.
		var nfoFolderClaimed sync.Map // folder path → true

		var nfoEntriesMu sync.Mutex
		var nfoEntries []*nfoEntry

		nfoJobs := make(chan *dto.LocalFile, len(localFiles))
		for _, lf := range localFiles {
			nfoJobs <- lf
		}
		close(nfoJobs)

		// ── Worker pool: pure CPU/IO — no DB calls ────────────────────────────
		var nfoWg sync.WaitGroup
		for i := 0; i < maxWorkers; i++ {
			nfoWg.Add(1)
			go func() {
				defer nfoWg.Done()
				for lf := range nfoJobs {
					// Stop immediately if the scan context was cancelled
					select {
					case <-ctx.Done():
						return
					default:
					}

					if lf == nil || lf.LibraryMediaId != 0 || lf.MediaID != 0 {
						continue
					}

					lfDir := filepath.Dir(lf.Path)

					// 2. Typical Kodi NFO paths
					nfoPaths := []string{
						util.ReplaceExtension(lf.Path, ".nfo"), // [filename].nfo (Per-file NFO takes priority)
						filepath.Join(lfDir, "tvshow.nfo"),
						filepath.Join(lfDir, "anime.nfo"),
						filepath.Join(lfDir, "movie.nfo"),
					}

					for _, nfoPath := range nfoPaths {
						if !filesystem.FileExists(nfoPath) {
							continue
						}
						nfo, err := ParseNfoFile(nfoPath)
						if err != nil || nfo == nil {
							continue
						}

						isPerFileNfo := strings.HasSuffix(strings.ToLower(nfoPath), ".nfo") &&
							!strings.HasSuffix(strings.ToLower(nfoPath), "tvshow.nfo") &&
							!strings.HasSuffix(strings.ToLower(nfoPath), "anime.nfo") &&
							!strings.HasSuffix(strings.ToLower(nfoPath), "movie.nfo")

						// For folder-level NFOs, use LoadOrStore to claim the folder atomically.
						// Only the worker that wins the race produces an entry; others skip.
						if !isPerFileNfo {
							if _, alreadyClaimed := nfoFolderClaimed.LoadOrStore(lfDir, true); alreadyClaimed {
								break // another worker already claimed this folder
							}
						}

						format := "TV"
						if nfo.XMLName.Local == "movie" {
							format = "MOVIE"
						}

						entry := &nfoEntry{
							lf: lf,
							media: &models.LibraryMedia{
								Type:          "ANIME",
								Format:        format,
								TitleOriginal: nfo.OriginalTitle,
								TitleRomaji:   nfo.Title,
								TitleEnglish:  nfo.Title,
								Description:   nfo.Plot,
								Rating:        nfo.Rating,
								Year:          nfo.Year,
							},
							folderPath: lfDir,
							isPerFile:  isPerFileNfo,
							tmdbID:     nfo.GetTmdbID(),
						}

						nfoEntriesMu.Lock()
						nfoEntries = append(nfoEntries, entry)
						nfoEntriesMu.Unlock()
						break
					}
				}
			}()
		}
		nfoWg.Wait()

		// ── Post-processing: single DB write phase ────────────────────────────
		// All workers have finished parsing. We now write to the DB in one shot:
		// records with a TMDB ID go through UpsertLibraryMediaBatch; local-only
		// records (tmdb_id = 0) are inserted individually to preserve uniqueness.
		if scn.Database != nil && len(nfoEntries) > 0 {
			withTmdb := make([]*nfoEntry, 0, len(nfoEntries))
			withoutTmdb := make([]*nfoEntry, 0, len(nfoEntries))
			for _, e := range nfoEntries {
				if e.tmdbID > 0 {
					e.media.TmdbID = e.tmdbID
					withTmdb = append(withTmdb, e)
				} else {
					withoutTmdb = append(withoutTmdb, e)
				}
			}

			// 1. Batch upsert for entries that have a TMDB ID.
			if len(withTmdb) > 0 {
				mediaBatch := make([]*models.LibraryMedia, len(withTmdb))
				for i, e := range withTmdb {
					mediaBatch[i] = e.media
				}
				if batchErr := db.UpsertLibraryMediaBatch(scn.Database, mediaBatch, 20); batchErr != nil {
					scn.Logger.Warn().Err(batchErr).Msg("scanner: NFO batch upsert failed, IDs may be missing")
				}

				// Query back the persisted records to retrieve their auto-generated IDs.
				var persisted []*models.LibraryMedia
				tmdbIDs := make([]int, len(withTmdb))
				for i, e := range withTmdb {
					tmdbIDs[i] = e.tmdbID
				}
				scn.Database.Gorm().Where("tmdb_id IN ? AND type = ?", tmdbIDs, "ANIME").Find(&persisted)

				type tmdbTypeKey struct {
					tmdbID    int
					mediaType string
				}
				idMap := make(map[tmdbTypeKey]uint, len(persisted))
				for _, m := range persisted {
					idMap[tmdbTypeKey{m.TmdbID, m.Type}] = m.ID
				}

				for _, e := range withTmdb {
					key := tmdbTypeKey{e.tmdbID, e.media.Type}
					if id, ok := idMap[key]; ok {
						e.lf.LibraryMediaId = id
						e.lf.MediaID = e.tmdbID
						if !e.isPerFile {
							nfoFolderMap.Store(e.folderPath, id)
						}
						scn.Logger.Info().
							Str("filename", e.lf.Name).
							Uint("libraryMediaId", id).
							Msg("scanner: Created LibraryMedia via local NFO (batch)")
					}
				}
			}

			// 2. Individual inserts for local-only NFO records (no TMDB ID).
			// These can't be safely batched since they share tmdb_id = 0.
			for _, e := range withoutTmdb {
				saved, err := db.InsertLibraryMedia(scn.Database, e.media)
				if err == nil && saved != nil {
					e.lf.LibraryMediaId = saved.ID
					if !e.isPerFile {
						nfoFolderMap.Store(e.folderPath, saved.ID)
					}
					scn.Logger.Info().
						Str("filename", e.lf.Name).
						Uint("libraryMediaId", saved.ID).
						Msg("scanner: Created LibraryMedia via local NFO (local-only)")
				}
			}

			// 3. Propagate folder-level IDs to all local files in the same folder.
			// Workers only tagged the "owning" file per folder; siblings need the same ID.
			for _, lf := range localFiles {
				if lf == nil || lf.LibraryMediaId != 0 {
					continue
				}
				lfDir := filepath.Dir(lf.Path)
				if id, exists := nfoFolderMap.Load(lfDir); exists {
					lf.LibraryMediaId = id.(uint)
				}
			}
		}
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
	if tmdbClient != nil && scn.MetadataProviderRef == nil {
		realProvider := metadata_provider.NewProvider(&metadata_provider.NewProviderImplOptions{
			Database:   scn.Database,
			Logger:     scn.Logger,
			TMDBClient: tmdbClient,
		})
		scn.MetadataProviderRef = realProvider
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
		"matched":    len(lo.Filter(localFiles, func(lf *dto.LocalFile, _ int) bool { return lf.MediaID != 0 })),
		"unmatched":  len(lo.Filter(localFiles, func(lf *dto.LocalFile, _ int) bool { return lf.MediaID == 0 })),
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

		// Group local files by MediaID to avoid redundant enrichment
		mediaGroups := make(map[int][]*dto.LocalFile)
		for _, lf := range localFiles {
			if lf.MediaID != 0 {
				mediaGroups[lf.MediaID] = append(mediaGroups[lf.MediaID], lf)
			}
		}

		// Parallel process enrichment per unique MediaID
		enrichWorkers := runtime.NumCPU()
		if enrichWorkers < 2 {
			enrichWorkers = 2
		}
		if enrichWorkers > 8 {
			enrichWorkers = 8
		}

		mIdChan := make(chan int, len(mediaGroups))
		for mID := range mediaGroups {
			mIdChan <- mID
		}
		close(mIdChan)

		// Define a global semaphore to limit concurrent OpenSubtitles API calls
		openSubsSem := make(chan struct{}, 2)

		var enrichWg sync.WaitGroup
		for i := 0; i < enrichWorkers; i++ {
			enrichWg.Add(1)
			go func() {
				defer enrichWg.Done()
				for mID := range mIdChan {
					matchedMedia, ok := normalizedMap[mID]
					if !ok {
						continue
					}

					// 1. FanArt.tv (Per MediaID)
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

					// 2. OMDb (Per MediaID)
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
						var fileWg sync.WaitGroup
						for _, lf := range mediaGroups[mID] {
							season, episode := 0, 0
							if lf.ParsedData != nil {
								if lf.ParsedData.Season != "" {
									season, _ = util.StringToInt(lf.ParsedData.Season)
								}
								if lf.ParsedData.Episode != "" {
									episode, _ = util.StringToInt(lf.ParsedData.Episode)
								}
							}
							fileWg.Add(1)
							go func(lf *dto.LocalFile, s, e int) {
								defer fileWg.Done()

								select {
								case openSubsSem <- struct{}{}:
									defer func() { <-openSubsSem }()
								case <-ctx.Done():
									return
								}

								_ = scn.OpenSubsEnricher.EnrichLocalFile(ctx, lf, matchedMedia, s, e)
							}(lf, season, episode)
						}
						fileWg.Wait()
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
	if len(mf.UnknownMediaIds) < 5 && scn.PlatformRef != nil {
		if scn.WSEventManager != nil {
			scn.WSEventManager.SendEvent(events.EventScanStatus, "Adding missing media to platform...")
		}

		if err = scn.PlatformRef.AddMediaToCollection(ctx, mf.UnknownMediaIds); err != nil {
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
			if lf.MediaID != 0 {
				allMatchedIds[lf.MediaID] = struct{}{}
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
			if lf.MediaID != 0 {
				if _, exists := fileTitleMap[lf.MediaID]; !exists {
					info := ParseFolderStructure(lf.Path, libraryPaths)
					if info.SeriesName != "" {
						fileTitleMap[lf.MediaID] = info.SeriesName
					}
					if info.IsMovie {
						movieIds[lf.MediaID] = true
					}
				}
				// IDs with offset >= 1,000,000 are always movies (DragonBallResolver convention)
				if lf.MediaID >= 1_000_000 {
					movieIds[lf.MediaID] = true
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
		if scn.PlatformRef != nil {
			allIds := make([]int, 0, len(allMatchedIds))
			for id := range allMatchedIds {
				allIds = append(allIds, id)
			}
			if len(allIds) > 0 {
				scn.Logger.Debug().Int("count", len(allIds)).Msg("scanner: Adding all matched media to platform collection")
				if err = scn.PlatformRef.AddMediaToCollection(ctx, allIds); err != nil {
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

			// Collect real movie IDs for concurrent lookup.
			realMovieIDs := make([]int, 0, len(movieIds))
			for normalizedID := range movieIds {
				if realMovieID := normalizedID - 1_000_000; realMovieID > 0 {
					realMovieIDs = append(realMovieIDs, realMovieID)
				}
			}

			// Fan-out: fetch all movie details concurrently (up to 5 workers).
			var collectionMu sync.Mutex
			collectionMembers := make(map[int][]int)

			movieIDCh := make(chan int, len(realMovieIDs))
			for _, id := range realMovieIDs {
				movieIDCh <- id
			}
			close(movieIDCh)

			collWorkers := 5
			if len(realMovieIDs) < collWorkers {
				collWorkers = len(realMovieIDs)
			}
			var collWg sync.WaitGroup
			for w := 0; w < collWorkers; w++ {
				collWg.Add(1)
				go func() {
					defer collWg.Done()
					for realMovieID := range movieIDCh {
						if ctx.Err() != nil {
							return
						}
						details, detailErr := scn.TMDBClient.GetMovieDetailsV2(ctx, realMovieID)
						if detailErr != nil {
							scn.Logger.Debug().Err(detailErr).Int("tmdbID", realMovieID).Msg("scanner: Could not get movie details for collection lookup")
							continue
						}
						if details.BelongsToCollection != nil && details.BelongsToCollection.ID > 0 {
							collID := details.BelongsToCollection.ID
							collectionMu.Lock()
							collectionMembers[collID] = append(collectionMembers[collID], realMovieID)
							collectionMu.Unlock()
						}
					}
				}()
			}
			collWg.Wait()

			// Upsert each discovered collection (small N, sequential is fine here).
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
	scn.addRemainingShelvedFiles(skippedLfs, sortedLibraryPaths)

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
