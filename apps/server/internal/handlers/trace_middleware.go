package handlers

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/rs/zerolog"
)

// TraceIDKey is the context key for the request trace ID.
type traceIDKeyType struct{}

var TraceIDKey = traceIDKeyType{}

// TraceIDHeader is the HTTP header used to propagate trace IDs.
const TraceIDHeader = "X-Trace-ID"

// SlowRequestThreshold defines how long a request must take to be flagged as slow.
const SlowRequestThreshold = 500 * time.Millisecond

// TraceMiddleware injects a unique trace ID into every request context
// and logs slow requests (>500ms) with their trace ID for correlation.
func TraceMiddleware(logger *zerolog.Logger) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			start := time.Now()

			// Generate or propagate trace ID
			traceID := c.Request().Header.Get(TraceIDHeader)
			if traceID == "" {
				traceID = generateTraceID()
			}

			// Inject trace ID into context
			ctx := context.WithValue(c.Request().Context(), TraceIDKey, traceID)
			c.SetRequest(c.Request().WithContext(ctx))

			// Set trace ID in response header for client-side correlation
			c.Response().Header().Set(TraceIDHeader, traceID)

			// Execute the handler
			err := next(c)

			// Log slow requests
			elapsed := time.Since(start)
			if elapsed >= SlowRequestThreshold {
				logger.Warn().
					Str("trace_id", traceID).
					Str("method", c.Request().Method).
					Str("path", c.Path()).
					Str("duration", elapsed.String()).
					Int64("duration_ms", elapsed.Milliseconds()).
					Int("status", c.Response().Status).
					Msg("trace: Slow request detected")
			}

			return err
		}
	}
}

// GetTraceID extracts the trace ID from the context. Returns empty string if not set.
func GetTraceID(ctx context.Context) string {
	if id, ok := ctx.Value(TraceIDKey).(string); ok {
		return id
	}
	return ""
}

// generateTraceID creates a 16-character hex trace ID (8 random bytes).
func generateTraceID() string {
	b := make([]byte, 8)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}
