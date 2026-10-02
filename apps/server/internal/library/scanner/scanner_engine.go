package scanner

import (
	"context"
	"errors"
	"kamehouse/internal/api/metadata_provider"
	"kamehouse/internal/api/tmdb"
	"kamehouse/internal/database/db"
	"kamehouse/internal/database/models/dto"
	"kamehouse/internal/events"
	"kamehouse/internal/library/anime"
	librarymetadata "kamehouse/internal/library/metadata"
	"kamehouse/internal/library/summary"
	"kamehouse/internal/platforms/platform"
	"kamehouse/internal/util"
	"time"

	"github.com/rs/zerolog"
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

	ScanMode        string
	TargetPaths     []string
	FFprobePath     string
	BackgroundQueue *BackgroundQueue
	UnifiedScan     bool
}

// ScannerOptions mirrors all public fields of Scanner and is the canonical
// way to initialise a Scanner via NewScanner. Adding a new option here
// forces every call-site to be updated (no silent zero-value surprises).
type ScannerOptions struct {
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
	Database                   *db.Database
	MetadataProviderRef        metadata_provider.Provider
	MetadataProviders          []librarymetadata.Provider
	UseLegacyMatching          bool
	MatchingThreshold          float64
	MatchingAlgorithm          string
	StrictStructure            bool
	WithShelving               bool
	ExistingShelvedFiles       []*dto.LocalFile
	Config                     *Config
	ConfigAsString             string
	AnimeCollection            *platform.UnifiedCollection
	UseTMDB                    bool
	EventDispatcher            events.Dispatcher
	TMDBClient                 *tmdb.Client
	ScanMode                   string
	TargetPaths                []string
	FFprobePath                string
	BackgroundQueue            *BackgroundQueue
	UnifiedScan                bool
}

// NewScanner constructs a Scanner from the given options.
// Internal state fields (e.g. shelvedLocalFiles) are always zero-initialised.
func NewScanner(opts *ScannerOptions) *Scanner {
	return &Scanner{
		DirPath:                    opts.DirPath,
		OtherDirPaths:              opts.OtherDirPaths,
		SeriesPaths:                opts.SeriesPaths,
		MoviePaths:                 opts.MoviePaths,
		Enhanced:                   opts.Enhanced,
		EnhanceWithOfflineDatabase: opts.EnhanceWithOfflineDatabase,
		PlatformRef:                opts.PlatformRef,
		Logger:                     opts.Logger,
		WSEventManager:             opts.WSEventManager,
		ExistingLocalFiles:         opts.ExistingLocalFiles,
		SkipLockedFiles:            opts.SkipLockedFiles,
		SkipIgnoredFiles:           opts.SkipIgnoredFiles,
		ScanSummaryLogger:          opts.ScanSummaryLogger,
		ScanLogger:                 opts.ScanLogger,
		Database:                   opts.Database,
		MetadataProviderRef:        opts.MetadataProviderRef,
		MetadataProviders:          opts.MetadataProviders,
		UseLegacyMatching:          opts.UseLegacyMatching,
		MatchingThreshold:          opts.MatchingThreshold,
		MatchingAlgorithm:          opts.MatchingAlgorithm,
		StrictStructure:            opts.StrictStructure,
		WithShelving:               opts.WithShelving,
		ExistingShelvedFiles:       opts.ExistingShelvedFiles,
		Config:                     opts.Config,
		ConfigAsString:             opts.ConfigAsString,
		AnimeCollection:            opts.AnimeCollection,
		UseTMDB:                    opts.UseTMDB,
		EventDispatcher:            opts.EventDispatcher,
		TMDBClient:                 opts.TMDBClient,
		ScanMode:                   opts.ScanMode,
		TargetPaths:                opts.TargetPaths,
		FFprobePath:                opts.FFprobePath,
		BackgroundQueue:            opts.BackgroundQueue,
		UnifiedScan:                opts.UnifiedScan,
	}
}

// Scan will scan the directory and return a list of dto.LocalFile.
func (scn *Scanner) Scan(ctx context.Context) (lfs []*dto.LocalFile, err error) {
	defer util.HandlePanicWithError(&err)

	go func() {
		defer func() {
			if r := recover(); r != nil {
				scn.Logger.Error().Interface("panic", r).Msg("scanner: panic clearing episode collection cache")
			}
		}()
		anime.ClearEpisodeCollectionCache()
	}()

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

	scn.prepareScanConfig()

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
				if stored, err := scn.Database.GetStoredSettings(); err == nil && stored != nil {
					updated := *stored // copia: stored es el valor cacheado y compartido
					updated.Library.LastScanAt = startTime
					_, _ = scn.Database.UpsertSettings(&updated)
				}
			}
		}()
	}

	localFiles, skippedLfs, libraryPaths, sortedLibraryPaths := scn.gatherLocalFiles(ctx, telemetry)

	// DEVNOTE: Removed library path checking because it causes some issues with symlinks

	if len(localFiles) == 0 {
		return scn.finishEmptyScan(localFiles, skippedLfs, sortedLibraryPaths), nil
	}

	mf, mc, err := scn.fetchAndMatchMedia(ctx, localFiles, telemetry)
	if err != nil {
		return nil, err
	}

	localFiles, err = scn.hydrateAndPersist(ctx, localFiles, skippedLfs, libraryPaths, mf, mc, telemetry)
	if err != nil {
		return nil, err
	}

	localFiles = scn.scanFinalizePhase(localFiles, skippedLfs, sortedLibraryPaths, mc, mf)

	if scn.BackgroundQueue != nil {
		for _, lf := range localFiles {
			scn.BackgroundQueue.Enqueue(lf)
		}
	}

	return localFiles, nil
}
