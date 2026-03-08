package httpclient

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/rs/zerolog"
)

// EdgeHTTPClient is a unified, generic HTTP wrapper designed to eliminate
// redundant parser logic and external dependencies (like resty).
// It enforces strict timeouts, context propagation, and zero-cost abstraction payload decoding.
type EdgeHTTPClient[T any] struct {
	client  *http.Client
	baseURL string
	headers map[string]string
	logger  *zerolog.Logger
}

// NewEdgeClient instantiates a generic client locked to a specific response type T.
func NewEdgeClient[T any](baseURL string, timeout time.Duration, logger *zerolog.Logger) *EdgeHTTPClient[T] {
	return &EdgeHTTPClient[T]{
		client: &http.Client{
			Timeout: timeout,
		},
		baseURL: baseURL,
		headers: make(map[string]string),
		logger:  logger,
	}
}

// SetHeader allows injecting Bearer tokens or specific API keys required by adapters (e.g., TMDB, Debrid)
func (c *EdgeHTTPClient[T]) SetHeader(key, value string) {
	c.headers[key] = value
}

// Execute performs the HTTP request and decodes the JSON response natively into type T.
// This completely avoids runtime reflection (apart from standard json.Unmarshal)
func (c *EdgeHTTPClient[T]) Execute(ctx context.Context, method, endpoint string, body interface{}) (*T, error) {
	var bodyReader io.Reader

	if body != nil {
		// Native encoding
		encoded, err := json.Marshal(body)
		if err != nil {
			return nil, fmt.Errorf("edgeclient: failed to marshal payload: %w", err)
		}
		bodyReader = bytes.NewReader(encoded)
	}

	req, err := http.NewRequestWithContext(ctx, method, c.baseURL+endpoint, bodyReader)
	if err != nil {
		return nil, fmt.Errorf("edgeclient: failed to build request: %w", err)
	}

	for k, v := range c.headers {
		req.Header.Set(k, v)
	}

	if bodyReader != nil && req.Header.Get("Content-Type") == "" {
		req.Header.Set("Content-Type", "application/json")
	}

	start := time.Now()
	res, err := c.client.Do(req)
	elapsed := time.Since(start)

	if err != nil {
		c.logger.Error().Err(err).Str("endpoint", endpoint).Dur("ms", elapsed).Msg("edgeclient: HTTP execution failed")
		return nil, err
	}
	defer res.Body.Close()

	if res.StatusCode < 200 || res.StatusCode >= 300 {
		c.logger.Warn().Int("status", res.StatusCode).Str("endpoint", endpoint).Msg("edgeclient: Non-2xx response")
		return nil, fmt.Errorf("edgeclient: API returned status %d", res.StatusCode)
	}

	var parsedResponse T
	if err := json.NewDecoder(res.Body).Decode(&parsedResponse); err != nil {
		// Handle EOF (empty 204 response) gracefully if type T is forgiving, else error out
		if errors.Is(err, io.EOF) {
			return &parsedResponse, nil
		}
		c.logger.Error().Err(err).Msg("edgeclient: Failed to decode JSON payload natively")
		return nil, fmt.Errorf("edgeclient: parse error: %w", err)
	}

	c.logger.Trace().Str("endpoint", endpoint).Dur("ms", elapsed).Msg("edgeclient: HTTP execution successful")
	return &parsedResponse, nil
}
