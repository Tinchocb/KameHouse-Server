package retry

import (
	"context"
	"time"
)

type Options struct {
	MaxAttempts int
	InitialWait time.Duration
	MaxWait     time.Duration
	Multiplier  float64
}

func DefaultOptions() *Options {
	return &Options{
		MaxAttempts: 3,
		InitialWait: 100 * time.Millisecond,
		MaxWait:     5 * time.Second,
		Multiplier:  2.0,
	}
}

func Do(ctx context.Context, opts *Options, fn func() error) error {
	if opts == nil {
		opts = DefaultOptions()
	}

	var lastErr error
	wait := opts.InitialWait

	for attempt := 1; attempt <= opts.MaxAttempts; attempt++ {
		err := fn()
		if err == nil {
			return nil
		}
		lastErr = err

		if attempt == opts.MaxAttempts {
			break
		}

		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(wait):
		}

		wait = time.Duration(float64(wait) * opts.Multiplier)
		if wait > opts.MaxWait {
			wait = opts.MaxWait
		}
	}

	return lastErr
}

func DoWithResult[T any](ctx context.Context, opts *Options, fn func() (T, error)) (T, error) {
	if opts == nil {
		opts = DefaultOptions()
	}

	var lastErr error
	var result T
	wait := opts.InitialWait

	for attempt := 1; attempt <= opts.MaxAttempts; attempt++ {
		res, err := fn()
		if err == nil {
			return res, nil
		}
		lastErr = err

		if attempt == opts.MaxAttempts {
			break
		}

		select {
		case <-ctx.Done():
			return result, ctx.Err()
		case <-time.After(wait):
		}

		wait = time.Duration(float64(wait) * opts.Multiplier)
		if wait > opts.MaxWait {
			wait = opts.MaxWait
		}
	}

	return result, lastErr
}
