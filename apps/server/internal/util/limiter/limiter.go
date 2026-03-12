package limiter

import (
	"context"
	"time"

	"golang.org/x/time/rate"
)

// NewAnilistLimiter creates a rate limiter for AniList (e.g. 5 req per 10s)
func NewAnilistLimiter() *Limiter {
	return NewLimiter(10*time.Second, 5)
}

//----------------------------------------------------------------------------------------------------------------------

type Limiter struct {
	r *rate.Limiter
}

// NewLimiter establishes an OS-friendly rate limiter
// using generic golang token buckets instead of Mutex time.Sleep
func NewLimiter(tick time.Duration, burst uint) *Limiter {
	// Calculate the rate limit (events per second)
	limit := rate.Every(tick / time.Duration(burst))

	return &Limiter{
		r: rate.NewLimiter(limit, int(burst)),
	}
}

// Wait blocks until a token is available, respecting context cancellation.
func (l *Limiter) Wait(ctx context.Context) error {
	return l.r.Wait(ctx)
}
