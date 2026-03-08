package streaming

import (
	"context"
	"errors"
	"sync"
	"time"
)

// ErrCircuitOpen is returned when the external addon circuit is open to prevent cascading failures.
var ErrCircuitOpen = errors.New("circuit breaker is open")

// CircuitState represents the current state of a circuit breaker.
type CircuitState int

const (
	CircuitClosed CircuitState = iota
	CircuitOpen
	CircuitHalfOpen
)

// CircuitBreakerConfig holds the thresholds for the Resilience4j-style circuit breaker.
type CircuitBreakerConfig struct {
	FailureThreshold uint32
	ResetTimeout     time.Duration
	HalfOpenMaxCalls uint32
}

// DefaultCircuitBreakerConfig provides sensible defaults for external Torrent/Debrid addons.
var DefaultCircuitBreakerConfig = CircuitBreakerConfig{
	FailureThreshold: 3,
	ResetTimeout:     30 * time.Second,
	HalfOpenMaxCalls: 2,
}

// CircuitBreaker implements the Circuit Breaker pattern for external remote resolvers.
type CircuitBreaker struct {
	mu sync.RWMutex

	state       CircuitState
	failures    uint32
	halfOpenOps uint32
	openedAt    time.Time

	config CircuitBreakerConfig
}

// NewCircuitBreaker creates a new circuit breaker with the given configuration.
func NewCircuitBreaker(config CircuitBreakerConfig) *CircuitBreaker {
	return &CircuitBreaker{
		state:  CircuitClosed,
		config: config,
	}
}

// Execute wraps an operation with the circuit breaker logic.
func (cb *CircuitBreaker) Execute(ctx context.Context, op func(ctx context.Context) ([]*StreamResult, error)) ([]*StreamResult, error) {
	if err := cb.acquire(); err != nil {
		return nil, err
	}

	res, err := op(ctx)
	if err != nil {
		// Only record failure if it's an actual external addon error,
		// not a standard context cancellation/timeout from the caller
		// or "media not found" (which is a valid business logic response).
		if !errors.Is(err, context.Canceled) && !errors.Is(err, context.DeadlineExceeded) && !errors.Is(err, ErrMediaNotFound) {
			cb.recordFailure()
		} else {
			cb.recordSuccess()
		}
		return nil, err
	}

	cb.recordSuccess()
	return res, nil
}

func (cb *CircuitBreaker) acquire() error {
	cb.mu.Lock()
	defer cb.mu.Unlock()

	switch cb.state {
	case CircuitClosed:
		return nil
	case CircuitOpen:
		if time.Since(cb.openedAt) >= cb.config.ResetTimeout {
			cb.state = CircuitHalfOpen
			cb.halfOpenOps = 1
			return nil
		}
		return ErrCircuitOpen
	case CircuitHalfOpen:
		if cb.halfOpenOps < cb.config.HalfOpenMaxCalls {
			cb.halfOpenOps++
			return nil
		}
		return ErrCircuitOpen
	}
	return nil
}

func (cb *CircuitBreaker) recordSuccess() {
	cb.mu.Lock()
	defer cb.mu.Unlock()

	cb.failures = 0
	cb.state = CircuitClosed
	cb.halfOpenOps = 0
}

func (cb *CircuitBreaker) recordFailure() {
	cb.mu.Lock()
	defer cb.mu.Unlock()

	switch cb.state {
	case CircuitClosed:
		cb.failures++
		if cb.failures >= cb.config.FailureThreshold {
			cb.transitionToOpen()
		}
	case CircuitHalfOpen:
		cb.transitionToOpen()
	}
}

func (cb *CircuitBreaker) transitionToOpen() {
	cb.state = CircuitOpen
	cb.openedAt = time.Now()
}
