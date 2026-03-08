package transcoder

import (
	"sync"
	"time"

	"github.com/rs/zerolog"
)

// JITBufferHorizon is the default look-ahead duration for JIT transcoding.
// Only segments within this window from the playback head will be transcoded.
const JITBufferHorizon = 5 * time.Minute

// IdleCPUThreshold is the CPU usage percentage below which idle pre-baking activates.
const IdleCPUThreshold = 20.0

// JITBufferManager controls just-in-time transcoding by only processing
// segments within a configurable horizon ahead of the current playback position.
// This prevents the transcoder from wasting CPU/GPU on segments the user
// may never watch (e.g., after seeking or abandoning playback).
type JITBufferManager struct {
	mu            sync.RWMutex
	horizon       time.Duration
	segmentDurSec float64
	playbackHeads map[string]int32 // client -> current segment index
	logger        *zerolog.Logger
}

// NewJITBufferManager creates a new JIT buffer controller.
// segmentDurSec: duration of each HLS segment in seconds (typically 4-6s).
func NewJITBufferManager(segmentDurSec float64, logger *zerolog.Logger) *JITBufferManager {
	if segmentDurSec <= 0 {
		segmentDurSec = 4.0
	}

	return &JITBufferManager{
		horizon:       JITBufferHorizon,
		segmentDurSec: segmentDurSec,
		playbackHeads: make(map[string]int32),
		logger:        logger,
	}
}

// UpdatePlaybackHead records the current playback position for a client.
func (jit *JITBufferManager) UpdatePlaybackHead(clientID string, segment int32) {
	jit.mu.Lock()
	defer jit.mu.Unlock()
	jit.playbackHeads[clientID] = segment
}

// ShouldTranscode checks if a given segment should be transcoded.
// Returns true if the segment is within the JIT buffer horizon from
// any active client's playback head.
func (jit *JITBufferManager) ShouldTranscode(segment int32) bool {
	jit.mu.RLock()
	defer jit.mu.RUnlock()

	horizonSegments := int32(jit.horizon.Seconds() / jit.segmentDurSec)

	for _, head := range jit.playbackHeads {
		// Allow transcoding from the current head up to head + horizon
		if segment >= head && segment <= head+horizonSegments {
			return true
		}
		// Also allow a small lookback buffer (2 segments) for seeking
		if segment >= head-2 && segment < head {
			return true
		}
	}

	return false
}

// GetHorizonRange returns the [start, end] segment range for a client.
func (jit *JITBufferManager) GetHorizonRange(clientID string) (start, end int32) {
	jit.mu.RLock()
	defer jit.mu.RUnlock()

	head, ok := jit.playbackHeads[clientID]
	if !ok {
		return 0, 0
	}

	horizonSegments := int32(jit.horizon.Seconds() / jit.segmentDurSec)
	return head, head + horizonSegments
}

// RemoveClient removes a client from the playback tracking.
func (jit *JITBufferManager) RemoveClient(clientID string) {
	jit.mu.Lock()
	defer jit.mu.Unlock()
	delete(jit.playbackHeads, clientID)

	jit.logger.Debug().Str("client", clientID).Msg("jit_buffer: Client removed")
}

// ActiveClients returns the number of currently tracked clients.
func (jit *JITBufferManager) ActiveClients() int {
	jit.mu.RLock()
	defer jit.mu.RUnlock()
	return len(jit.playbackHeads)
}

// SetHorizon changes the JIT buffer look-ahead duration.
func (jit *JITBufferManager) SetHorizon(d time.Duration) {
	jit.mu.Lock()
	defer jit.mu.Unlock()
	jit.horizon = d
	jit.logger.Info().Str("horizon", d.String()).Msg("jit_buffer: Horizon updated")
}
