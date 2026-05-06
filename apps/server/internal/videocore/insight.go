package videocore

import (
	"sync"

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

var insightsCache sync.Map

// GenerateVideoInsights generates a deterministic pseudo-random array of intensities based on a string seed (like filepath or episodeId).
func GenerateVideoInsights(seedString string, duration float64) ([]InsightNode, error) {
	if cached, ok := insightsCache.Load(seedString); ok {
		return cached.([]InsightNode), nil
	}

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

		// smooth transition
		currentVal = currentVal*0.7 + rnd*0.3

		// Map some peaks (spikes) randomly if random threshold is met
		if rnd > 0.9 {
			currentVal = 0.9 + (rnd * 0.1) // 0.9-1.0 spike!
		}

		intensity := currentVal
		if intensity > 1.0 {
			intensity = 1.0
		}

		insights = append(insights, InsightNode{
			Timestamp: t,
			Intensity: intensity,
		})
	}

	insightsCache.Store(seedString, insights)
	return insights, nil
}
