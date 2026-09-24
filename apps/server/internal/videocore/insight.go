package videocore

import (
	"sync"

	lru "github.com/hashicorp/golang-lru/v2"
	"github.com/rs/zerolog"
)

// InSight represents the video insight service (formerly character scanning, now simplified).
type InSight struct {
	logger *zerolog.Logger
	vc     *VideoCore
}

func NewInSight(logger *zerolog.Logger, vc *VideoCore) *InSight {
	return &InSight{
		logger: logger,
		vc:     vc,
	}
}

func (is *InSight) Start() {}
func (is *InSight) Clear() {}

// ---------------------------------------------------------------------------------------------------------------------
// X-Ray Timeline Heatmap (Cinematic Insights)
// ---------------------------------------------------------------------------------------------------------------------

type InsightNode struct {
	Timestamp float64 `json:"timestamp"`
	Intensity float64 `json:"intensity"`
}

var (
	insightsCacheMu sync.Mutex
	insightsCache, _ = lru.New[string, []InsightNode](500)
)

// GenerateVideoInsights generates a deterministic pseudo-random array of intensities based on a string seed (like filepath or episodeId).
func GenerateVideoInsights(seedString string, duration float64) ([]InsightNode, error) {
	insightsCacheMu.Lock()
	if insightsCache != nil {
		if cached, ok := insightsCache.Get(seedString); ok {
			insightsCacheMu.Unlock()
			return cached, nil
		}
	}
	insightsCacheMu.Unlock()

	insights := make([]InsightNode, 0)

	// Create a simple deterministic seed from the string
	var seed int64
	for _, char := range seedString {
		seed += int64(char)
	}

	// Simple PRNG multiplier and increment (LCG-style)
	// We want peaks and valleys, so we use Perlin-noise-like or just smoothed random.
	// We'll generate a point every 5 seconds.

	currentVal := float64(seed%100) / 100.0

	for t := 0.0; t <= duration; t += 5.0 {
		// randomize slightly
		seed = (seed*9301 + 49297) % 233280
		rnd := float64(seed) / 233280.0

		// smooth step towards random target
		delta := (rnd - currentVal) * 0.4
		currentVal += delta

		// ensure bounded
		intensity := currentVal
		if intensity < 0.0 {
			intensity = 0.0
		}
		if intensity > 1.0 {
			intensity = 1.0
		}

		insights = append(insights, InsightNode{
			Timestamp: t,
			Intensity: intensity,
		})
	}

	insightsCacheMu.Lock()
	if insightsCache == nil {
		insightsCache, _ = lru.New[string, []InsightNode](500)
	}
	insightsCache.Add(seedString, insights)
	insightsCacheMu.Unlock()

	return insights, nil
}
