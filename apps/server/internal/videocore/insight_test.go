package videocore

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestGenerateVideoInsights(t *testing.T) {
	seed := "test-episode-123"
	duration := 24.0 * 60.0 // 24 minutes in seconds

	insights, err := GenerateVideoInsights(seed, duration)

	assert.NoError(t, err)
	assert.NotEmpty(t, insights)
	
	// Check if timestamps start at 0 and go up to duration
	assert.Equal(t, 0.0, insights[0].Timestamp)
	assert.GreaterOrEqual(t, insights[len(insights)-1].Timestamp, duration-5.0)

	// Check if intensities are within expected bounds
	for _, node := range insights {
		assert.GreaterOrEqual(t, node.Intensity, 0.0)
		assert.LessOrEqual(t, node.Intensity, 1.0)
	}

	// Test caching / deterministic behavior
	insights2, err2 := GenerateVideoInsights(seed, duration)
	assert.NoError(t, err2)
	assert.Equal(t, insights, insights2)
}
