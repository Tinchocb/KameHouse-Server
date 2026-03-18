package metadata

import (
	"context"
	"errors"
	"strings"
	"time"

	"kamehouse/internal/database/models/dto"
)

// ErrNotFound is returned by providers when no matching results are found.
var ErrNotFound = errors.New("metadata: not found")

// ErrRateLimit is returned when an API explicitly throttles the request via 429.
// This signals the queue to pause and re-enqueue the block later.
var ErrRateLimit = errors.New("metadata: rate limit exceeded (HTTP 429)")

// Provider represents a generic source of media metadata (TMDb, TVDB, etc.)
type Provider interface {
	// GetProviderID returns the unique identifier for this provider (e.g., "mal", "tmdb")
	GetProviderID() string

	// GetName returns the human-readable name of the provider
	GetName() string

	// SearchMedia performs a search query and returns a list of normalized media results
	SearchMedia(ctx context.Context, query string) ([]*dto.NormalizedMedia, error)

	// GetMediaDetails fetches the full details for a specific media ID
	GetMediaDetails(ctx context.Context, id string) (*dto.NormalizedMedia, error)
}

// ResilientProvider wraps an existing provider with strict timeouts and error mapping.
type ResilientProvider struct {
	inner   Provider
	timeout time.Duration
}

// NewResilientProvider wraps a Provider to make it network-resilient.
func NewResilientProvider(inner Provider, timeout time.Duration) *ResilientProvider {
	return &ResilientProvider{
		inner:   inner,
		timeout: timeout,
	}
}

func (r *ResilientProvider) GetProviderID() string {
	return r.inner.GetProviderID()
}

func (r *ResilientProvider) GetName() string {
	return r.inner.GetName()
}

func (r *ResilientProvider) SearchMedia(ctx context.Context, query string) ([]*dto.NormalizedMedia, error) {
	ctx, cancel := context.WithTimeout(ctx, r.timeout)
	defer cancel()

	res, err := r.inner.SearchMedia(ctx, query)
	if err != nil {
		if errors.Is(err, context.DeadlineExceeded) || strings.Contains(strings.ToLower(err.Error()), "429") || strings.Contains(strings.ToLower(err.Error()), "rate limit") {
			return nil, ErrRateLimit
		}
		return nil, err
	}
	return res, nil
}

func (r *ResilientProvider) GetMediaDetails(ctx context.Context, id string) (*dto.NormalizedMedia, error) {
	ctx, cancel := context.WithTimeout(ctx, r.timeout)
	defer cancel()

	res, err := r.inner.GetMediaDetails(ctx, id)
	if err != nil {
		if errors.Is(err, context.DeadlineExceeded) || strings.Contains(strings.ToLower(err.Error()), "429") || strings.Contains(strings.ToLower(err.Error()), "rate limit") {
			return nil, ErrRateLimit
		}
		return nil, err
	}
	return res, nil
}
