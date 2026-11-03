package skipdetect

import (
	"context"
	"errors"
	"kamehouse/internal/util/resourcebudget"
)

// All detectors and scan methods share the same cancellable background lease.
// Interrupted work is retried after playback/preview demand subsides, rather
// than becoming a negative detection or a partial cached fingerprint.
func runFingerprint(ctx context.Context, run func(context.Context) ([]int, float64, error)) ([]int, float64, error) {
	for {
		work, release, err := resourcebudget.Shared.Background(ctx)
		if err != nil {
			return nil, 0, err
		}
		fp, duration, err := run(work)
		cause := context.Cause(work)
		release()
		if ctx.Err() != nil {
			return nil, 0, ctx.Err()
		}
		if errors.Is(cause, resourcebudget.ErrPlaybackPriority) {
			continue
		}
		return fp, duration, err
	}
}
