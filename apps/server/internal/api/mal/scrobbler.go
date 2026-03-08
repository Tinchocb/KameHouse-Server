package mal

import (
	"context"
	"math"
	"strconv"
	"sync"
	"time"

	"kamehouse/internal/database/db"
	"kamehouse/internal/util/httpclient"

	"github.com/rs/zerolog"
)

// ScrobbleTarget models the payload for updating MyAnimeList watch progress.
type ScrobbleTarget struct {
	MalMediaID    int
	EpisodeNumber int
	Status        string // Usually "watching" or "completed"
	RetryCount    int    // Number of attempts made on the DLQ
	AddedAt       time.Time
}

// MalScrobblerWorker is an asynchronous queue that gracefully handles fragile HTTP API calls to MyAnimeList.
// If MAL goes down (5xx) or rate limits us (429), the update is thrown into the Dead Letter Queue
// where it's retried recursively using exponential backoff (1m, 2m, 4m, 8m).
type MalScrobblerWorker struct {
	database *db.Database
	logger   *zerolog.Logger

	updateChan chan *ScrobbleTarget

	dlqMutex sync.Mutex
	dlqQueue []*ScrobbleTarget

	ctx    context.Context
	cancel context.CancelFunc
}

func NewMalScrobblerWorker(database *db.Database, logger *zerolog.Logger) *MalScrobblerWorker {
	ctx, cancel := context.WithCancel(context.Background())

	scrobbler := &MalScrobblerWorker{
		database:   database,
		logger:     logger,
		updateChan: make(chan *ScrobbleTarget, 100),
		dlqQueue:   make([]*ScrobbleTarget, 0),
		ctx:        ctx,
		cancel:     cancel,
	}

	go scrobbler.LaunchActorLoop()
	return scrobbler
}

// Dispatch queues a Scrobble event non-blockingly
func (s *MalScrobblerWorker) Dispatch(target *ScrobbleTarget) {
	if target.AddedAt.IsZero() {
		target.AddedAt = time.Now()
	}
	select {
	case s.updateChan <- target:
		s.logger.Trace().Int("MalID", target.MalMediaID).Msg("scrobbler: Queued async update")
	default:
		s.logger.Warn().Msg("scrobbler: Live queue full, directly injecting into DLQ as ultimate fallback")
		s.insertIntoDLQ(target)
	}
}

// LaunchActorLoop orchestrates live updates and the periodic Dead Letter Retry loop
func (s *MalScrobblerWorker) LaunchActorLoop() {
	// We run the DLQ retry engine every 15 seconds
	retryTicker := time.NewTicker(15 * time.Second)
	defer retryTicker.Stop()

	for {
		select {
		case <-s.ctx.Done():
			s.logger.Info().Msg("scrobbler: Halting MAL workers gracefully")
			return

		case target := <-s.updateChan:
			// Immediate Async Execution
			s.executeScrobble(target)

		case <-retryTicker.C:
			// Process Dead Letter Queue
			s.processDLQ()
		}
	}
}

func (s *MalScrobblerWorker) executeScrobble(target *ScrobbleTarget) {
	_malInfo, err := s.database.GetMalInfo()
	if err != nil || _malInfo == nil || _malInfo.AccessToken == "" {
		s.logger.Trace().Msg("scrobbler: User has no MAL token mapped. Skipping scrobble.")
		return
	}

	malInfo, err := VerifyMALAuth(_malInfo, s.database, s.logger)
	if err != nil {
		s.logger.Error().Err(err).Msg("scrobbler: Failed to verify MAL auth")
		return
	}

	// This method constructs the url-encoded parameters string for MAL's v2 API
	// e.g. "status=watching&num_watched_episodes=5"
	params := "num_watched_episodes=" + strconv.Itoa(target.EpisodeNumber)
	if target.Status != "" {
		params += "&status=" + target.Status
	}

	endpoint := ApiBaseURL + "/anime/" + strconv.Itoa(target.MalMediaID) + "/my_list_status"

	edge := httpclient.NewEdgeClient[any]("", 10*time.Second, s.logger)
	edge.SetHeader("Authorization", "Bearer "+malInfo.AccessToken)
	edge.SetHeader("Content-Type", "application/x-www-form-urlencoded")
	_, err = edge.Execute(context.Background(), "PUT", endpoint+"?"+params, nil)

	if err != nil {
		s.logger.Error().Err(err).Int("MalID", target.MalMediaID).Msg("scrobbler: MAL API execution failed")

		// 5xx / 429 Error -> Dead Letter Queue Rescue Operation
		target.RetryCount++
		if target.RetryCount > 15 {
			s.logger.Warn().Int("MalID", target.MalMediaID).Msg("scrobbler: Target surpassed 15 retries. Purging from DLQ eternally.")
			return
		}
		s.insertIntoDLQ(target)
	} else {
		s.logger.Info().Int("MalID", target.MalMediaID).Int("Ep", target.EpisodeNumber).Msg("scrobbler: Successfully synced watch progress with MyAnimeList")
	}
}

func (s *MalScrobblerWorker) insertIntoDLQ(target *ScrobbleTarget) {
	s.dlqMutex.Lock()
	s.dlqQueue = append(s.dlqQueue, target)
	s.dlqMutex.Unlock()
}

func (s *MalScrobblerWorker) processDLQ() {
	s.dlqMutex.Lock()

	if len(s.dlqQueue) == 0 {
		s.dlqMutex.Unlock()
		return
	}

	currentTime := time.Now()
	var pendingBackInDLQ []*ScrobbleTarget

	// Separate elements ripe for retrying vs ones still cooling down
	var ripeTargets []*ScrobbleTarget

	for _, target := range s.dlqQueue {
		// Calculate Exponential Backoff (10s, 20s, 40s, 80s...)
		// 10 * (2^RetryCount)
		backoffSeconds := 10 * math.Pow(2, float64(target.RetryCount))
		nextValidExecution := target.AddedAt.Add(time.Duration(backoffSeconds) * time.Second)

		if currentTime.After(nextValidExecution) {
			ripeTargets = append(ripeTargets, target)
		} else {
			// Keep in DLQ still cooling down
			pendingBackInDLQ = append(pendingBackInDLQ, target)
		}
	}

	s.dlqQueue = pendingBackInDLQ
	s.dlqMutex.Unlock()

	// Execute Ripe Targets (re-dispatch onto the main channel, prioritizing alive flows)
	for _, target := range ripeTargets {
		s.logger.Debug().Int("MalID", target.MalMediaID).Int("Attempts", target.RetryCount).Msg("scrobbler: Resurrecting dead event from DLQ")
		// Update Timestamp for next backoff calculation in case it fails again
		target.AddedAt = time.Now()
		s.Dispatch(target)
	}
}

func (s *MalScrobblerWorker) Stop() {
	s.cancel()
}
