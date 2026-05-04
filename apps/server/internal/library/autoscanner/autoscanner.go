package autoscanner

import (
	"context"
	"kamehouse/internal/api/metadata_provider"
	"kamehouse/internal/database/db"

	"kamehouse/internal/database/models"
	"kamehouse/internal/events"
	"kamehouse/internal/library/scanner"
	"kamehouse/internal/library/summary"

	"kamehouse/internal/platforms/platform"
	"kamehouse/internal/util"
	"sync"
	"sync/atomic"
	"time"

	"github.com/rs/zerolog"
)

type (
	AutoScanner struct {
		fileActionCh        chan struct{} // Used to notify the scanner that a file action has occurred.
		waiting             bool          // Used to prevent multiple scans from occurring at the same time.
		missedAction        bool          // Used to indicate that a file action was missed while scanning.
		mu                  sync.Mutex
		scannedCh           chan struct{}
		waitTime            time.Duration // Wait time to listen to additional changes before triggering a scan.
		enabled             bool
		settings            models.LibrarySettings
		platformRef         *util.Ref[platform.Platform]
		logger              *zerolog.Logger
		wsEventManager      events.WSEventManagerInterface
		db                  *db.Database                   // Database instance is required to update the local files.
		db                  *db.Database                   // Database instance is required to update the local files.
		metadataProviderRef *util.Ref[metadata_provider.Provider]
		logsDir             string
		scanning            atomic.Bool
		onRefreshCollection func()
		animeCollection     *platform.UnifiedCollection
		eventDispatcher     events.Dispatcher
	}
	NewAutoScannerOptions struct {
		Database            *db.Database
		PlatformRef         *util.Ref[platform.Platform]
		Logger              *zerolog.Logger
		WSEventManager      events.WSEventManagerInterface
		Enabled             bool
		Database            *db.Database
		PlatformRef         *util.Ref[platform.Platform]
		WaitTime            time.Duration
		MetadataProviderRef *util.Ref[metadata_provider.Provider]
		LogsDir             string
		OnRefreshCollection func()
		EventDispatcher     events.Dispatcher
	}
)

func New(opts *NewAutoScannerOptions) *AutoScanner {
	wt := time.Second * 15 // Default wait time is 15 seconds.
	if opts.WaitTime > 0 {
		wt = opts.WaitTime
	}

	return &AutoScanner{
		fileActionCh:        make(chan struct{}, 1),
		waiting:             false,
		missedAction:        false,
		mu:                  sync.Mutex{},
		scannedCh:           make(chan struct{}, 1),
		waitTime:            wt,
		enabled:             opts.Enabled,
		platformRef:         opts.PlatformRef,
		logger:              opts.Logger,
		wsEventManager:      opts.WSEventManager,
		db:                  opts.Database,
		wsEventManager:      opts.WSEventManager,
		db:                  opts.Database,
		metadataProviderRef: opts.MetadataProviderRef,
		logsDir:             opts.LogsDir,
		onRefreshCollection: opts.OnRefreshCollection,
		eventDispatcher:     opts.EventDispatcher,
	}
}

func (as *AutoScanner) SetAnimeCollection(ac *platform.UnifiedCollection) {
	as.animeCollection = ac
}

// Notify is used to notify the AutoScanner that a file action has occurred.
func (as *AutoScanner) Notify() {
	if as == nil {
		return
	}

	defer util.HandlePanicInModuleThen("scanner/autoscanner/Notify", func() {
		as.logger.Error().Msg("autoscanner: recovered from panic")
	})

	as.mu.Lock()
	defer as.mu.Unlock()

	// If we are already waiting for a scan, we don't need to do anything.
	if as.waiting {
		return
	}

	// If we are currently scanning, we need to indicate that a file action was missed.
	if as.scanning.Load() {
		as.missedAction = true
		return
	}

	as.waiting = true
	go func() {
		timer := time.NewTimer(as.waitTime)
		defer timer.Stop()

		for {
			select {
			case <-timer.C:
				as.mu.Lock()
				as.waiting = false
				as.mu.Unlock()
				as.TriggerScan()
				return
			case <-as.fileActionCh:
				if !timer.Stop() {
					<-timer.C
				}
				timer.Reset(as.waitTime)
			}
		}
	}()
}

func (as *AutoScanner) TriggerScan() {
	if as == nil || !as.enabled {
		return
	}

	if as.scanning.Load() {
		return
	}

	as.scanning.Store(true)
	defer as.scanning.Store(false)

	as.logger.Info().Msg("autoscanner: Triggering library scan")

	// Get latest library settings
	settings, err := as.db.GetSettings()
	if err != nil {
		as.logger.Error().Err(err).Msg("autoscanner: Failed to get library settings")
		return
	}
	as.settings = settings.Library

	libraryPaths := as.settings.GetAllPaths()
	var libraryPath string
	var additionalPaths []string
	if len(libraryPaths) > 0 {
		libraryPath = libraryPaths[0]
		if len(libraryPaths) > 1 {
			additionalPaths = libraryPaths[1:]
		}
	}

	// Scan the library
	scn := &scanner.Scanner{
		DirPath:               libraryPath,
		OtherDirPaths:         additionalPaths,
		SeriesPaths:           as.settings.SeriesPaths,
		MoviePaths:            as.settings.MoviePaths,
		Logger:                as.logger,
		PlatformRef:           as.platformRef,
		Database:              as.db,
		MetadataProviderRef:   as.metadataProviderRef,
		UseTMDB:               as.settings.ScannerProvider == "tmdb",
		EventDispatcher:       as.eventDispatcher,
		MatchingAlgorithm:     as.settings.ScannerMatchingAlgorithm,
		MatchingThreshold:     as.settings.ScannerMatchingThreshold,
		UseLegacyMatching:     as.settings.ScannerUseLegacyMatching,
		StrictStructure:       as.settings.ScannerStrictStructure,
		ConfigAsString:        as.settings.ScannerConfig,
		ScanSummaryLogger:     summary.NewScanSummaryLogger(),
		WithShelving:          true,
	}

	_, err = scn.Scan(context.Background())
	if err != nil {
		as.logger.Error().Err(err).Msg("autoscanner: Failed to scan library")
		return
	}

	as.logger.Info().Msg("autoscanner: Library scan completed")



	// Refresh the collection
	if as.onRefreshCollection != nil {
		as.onRefreshCollection()
	}



	as.mu.Lock()
	if as.missedAction {
		as.missedAction = false
		as.mu.Unlock()
		as.Notify()
	} else {
		as.mu.Unlock()
	}

	// Notify that the scan is completed
	select {
	case as.scannedCh <- struct{}{}:
	default:
	}
}

func (as *AutoScanner) SetEnabled(enabled bool) {
	as.enabled = enabled
}

func (as *AutoScanner) GetScannedCh() chan struct{} {
	return as.scannedCh
}
