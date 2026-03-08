package extension_repo

import (
	"fmt"
	"sync"
	"time"
)

// CircuitState represents the current state of a circuit breaker.
type CircuitState int

const (
	// CircuitClosed means the extension is healthy and calls pass through normally.
	CircuitClosed CircuitState = iota
	// CircuitOpen means the extension has failed too many times and calls are blocked.
	CircuitOpen
	// CircuitHalfOpen means the circuit is testing if the extension has recovered.
	CircuitHalfOpen
)

func (s CircuitState) String() string {
	switch s {
	case CircuitClosed:
		return "CLOSED"
	case CircuitOpen:
		return "OPEN"
	case CircuitHalfOpen:
		return "HALF_OPEN"
	default:
		return "UNKNOWN"
	}
}

// CircuitBreakerConfig holds the thresholds for the circuit breaker.
type CircuitBreakerConfig struct {
	// MaxFailures is the number of consecutive failures before the circuit opens.
	MaxFailures int
	// OpenDuration is how long the circuit stays open before transitioning to half-open.
	OpenDuration time.Duration
	// HalfOpenMaxAttempts is how many test calls are allowed in the half-open state.
	HalfOpenMaxAttempts int
}

// DefaultCircuitBreakerConfig provides sensible defaults for extension execution.
var DefaultCircuitBreakerConfig = CircuitBreakerConfig{
	MaxFailures:         3,
	OpenDuration:        30 * time.Second,
	HalfOpenMaxAttempts: 1,
}

// CircuitBreaker implements the Circuit Breaker pattern for JS extensions.
// It tracks consecutive failures per extension and temporarily disables
// extensions that are repeatedly crashing or timing out.
type CircuitBreaker struct {
	mu               sync.RWMutex
	state            CircuitState
	consecutiveFails int
	lastFailureTime  time.Time
	config           CircuitBreakerConfig
	extensionID      string
}

// NewCircuitBreaker creates a new circuit breaker for the given extension.
func NewCircuitBreaker(extensionID string, config CircuitBreakerConfig) *CircuitBreaker {
	return &CircuitBreaker{
		state:       CircuitClosed,
		config:      config,
		extensionID: extensionID,
	}
}

// Allow checks if a call is permitted through the circuit breaker.
// Returns an error if the circuit is open and the extension should not be called.
func (cb *CircuitBreaker) Allow() error {
	cb.mu.RLock()
	state := cb.state
	lastFail := cb.lastFailureTime
	cb.mu.RUnlock()

	switch state {
	case CircuitClosed:
		return nil

	case CircuitOpen:
		// Check if enough time has passed to transition to half-open
		if time.Since(lastFail) >= cb.config.OpenDuration {
			cb.mu.Lock()
			if cb.state == CircuitOpen {
				cb.state = CircuitHalfOpen
				cb.consecutiveFails = 0
			}
			cb.mu.Unlock()
			return nil
		}
		return fmt.Errorf("circuit breaker OPEN for extension %s: blocked after %d consecutive failures (retry in %v)",
			cb.extensionID, cb.config.MaxFailures, cb.config.OpenDuration-time.Since(lastFail))

	case CircuitHalfOpen:
		cb.mu.RLock()
		fails := cb.consecutiveFails
		cb.mu.RUnlock()
		if fails >= cb.config.HalfOpenMaxAttempts {
			return fmt.Errorf("circuit breaker HALF_OPEN for extension %s: max test attempts reached", cb.extensionID)
		}
		return nil
	}

	return nil
}

// RecordSuccess signals a successful extension call.
// In half-open state, this closes the circuit. In closed state, it resets the counter.
func (cb *CircuitBreaker) RecordSuccess() {
	cb.mu.Lock()
	defer cb.mu.Unlock()

	cb.consecutiveFails = 0
	if cb.state == CircuitHalfOpen {
		cb.state = CircuitClosed
	}
}

// RecordFailure signals a failed extension call.
// After MaxFailures consecutive failures, the circuit opens.
func (cb *CircuitBreaker) RecordFailure() {
	cb.mu.Lock()
	defer cb.mu.Unlock()

	cb.consecutiveFails++
	cb.lastFailureTime = time.Now()

	switch cb.state {
	case CircuitClosed:
		if cb.consecutiveFails >= cb.config.MaxFailures {
			cb.state = CircuitOpen
		}
	case CircuitHalfOpen:
		// Any failure in half-open immediately re-opens the circuit
		cb.state = CircuitOpen
		cb.consecutiveFails = cb.config.MaxFailures
	}
}

// State returns the current circuit state.
func (cb *CircuitBreaker) State() CircuitState {
	cb.mu.RLock()
	defer cb.mu.RUnlock()
	return cb.state
}

// Reset forcibly closes the circuit, clearing all failure counters.
func (cb *CircuitBreaker) Reset() {
	cb.mu.Lock()
	defer cb.mu.Unlock()
	cb.state = CircuitClosed
	cb.consecutiveFails = 0
}

// ──────────────────────────────────────────────────────────────────────
// Circuit Breaker Registry — manages per-extension circuit breakers
// ──────────────────────────────────────────────────────────────────────

// CircuitBreakerRegistry holds circuit breakers for all loaded extensions.
type CircuitBreakerRegistry struct {
	mu       sync.RWMutex
	breakers map[string]*CircuitBreaker
	config   CircuitBreakerConfig
}

// NewCircuitBreakerRegistry creates a new registry with the given config.
func NewCircuitBreakerRegistry(config CircuitBreakerConfig) *CircuitBreakerRegistry {
	return &CircuitBreakerRegistry{
		breakers: make(map[string]*CircuitBreaker),
		config:   config,
	}
}

// Get returns the circuit breaker for the given extension, creating one if needed.
func (r *CircuitBreakerRegistry) Get(extensionID string) *CircuitBreaker {
	r.mu.RLock()
	cb, ok := r.breakers[extensionID]
	r.mu.RUnlock()

	if ok {
		return cb
	}

	r.mu.Lock()
	defer r.mu.Unlock()

	// Double-check after acquiring write lock
	if cb, ok := r.breakers[extensionID]; ok {
		return cb
	}

	cb = NewCircuitBreaker(extensionID, r.config)
	r.breakers[extensionID] = cb
	return cb
}

// Remove deletes the circuit breaker for an unloaded extension.
func (r *CircuitBreakerRegistry) Remove(extensionID string) {
	r.mu.Lock()
	defer r.mu.Unlock()
	delete(r.breakers, extensionID)
}

// ResetAll closes all circuits, clearing failure state.
func (r *CircuitBreakerRegistry) ResetAll() {
	r.mu.Lock()
	defer r.mu.Unlock()
	for _, cb := range r.breakers {
		cb.Reset()
	}
}
