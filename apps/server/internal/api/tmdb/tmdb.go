package tmdb

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"net/http"
	"strconv"
	"strings"
	"time"

	"kamehouse/internal/util/cache"

	httputil "kamehouse/internal/util/http"

	"golang.org/x/time/rate"
)

// Cache defines the interface for persistent caching of TMDb API responses.
type Cache interface {
	Get(key string, out interface{}) (bool, error)
	Set(key string, value interface{}, ttl time.Duration) error
}

// Client handles TMDb API requests with caching using the new EdgeHTTPClient.
type Client struct {
	bearerToken     string
	language        string
	cache           *cache.Cache[any] // TTL in-memory cache for search results
	persistentCache Cache             // persistent SQL-backed cache
	limiter         *rate.Limiter
	httpClient      *http.Client
}

// language is a BCP 47 language tag (e.g. "es-MX", "en-US"). If empty, defaults to "es-MX".
// The bearer token is sanitized: empty and placeholder values (e.g.
// "your_tmdb_bearer_token_here") are stored as "" so HasApiKey() reports
// false and no invalid auth header is ever emitted.
func NewClient(bearerToken string, language ...string) *Client {
	lang := "es-MX"
	if len(language) > 0 && language[0] != "" {
		lang = language[0]
	}
	return &Client{
		bearerToken: SanitizeToken(bearerToken),
		language:    lang,
		cache:       cache.NewCache[any](time.Hour, 2000), // 1 hour TTL, capped at 2000 entries
		limiter:     rate.NewLimiter(rate.Limit(30), 10), // 30 req/sec, burst of 10
		httpClient:  httputil.NewFastClient(),
	}
}

// SetPersistentCache assigns a persistent cache backend to the client.
func (c *Client) SetPersistentCache(pc Cache) {
	c.persistentCache = pc
}

// ClearCache flushes the in-memory cache of TMDB API responses.
func (c *Client) ClearCache() {
	if c != nil && c.cache != nil {
		c.cache.Clear()
	}
}

// GetCached attempts to retrieve a value from the persistent cache first, falling back to the in-memory cache.
func GetCached[T any](c *Client, key string) (T, bool) {
	var zero T
	if c.persistentCache != nil {
		var val T
		if ok, err := c.persistentCache.Get(key, &val); ok && err == nil {
			return val, true
		}
	}
	if c.cache != nil {
		if val, ok := c.cache.Get(key); ok {
			if valTyped, ok := val.(T); ok {
				return valTyped, true
			}
		}
	}
	return zero, false
}

// SetCached stores a value in both the in-memory cache and the persistent cache (if available).
func SetCached[T any](c *Client, key string, value T, ttl time.Duration) {
	if c.persistentCache != nil {
		_ = c.persistentCache.Set(key, value, ttl)
	}
	if c.cache != nil {
		c.cache.Set(key, value)
	}
}

// HasApiKey returns true if a non-empty TMDB API key or bearer token is configured.
func (c *Client) HasApiKey() bool {
	return c != nil && strings.Trim(c.bearerToken, " \t\r\n\"'") != ""
}

// GetBearerToken returns the configured bearer token.
func (c *Client) GetBearerToken() string {
	if c == nil {
		return ""
	}
	return c.bearerToken
}

// GetClient returns the client instance itself (provided for compatibility/easier access)
func (c *Client) GetClient() *Client {
	return c
}

func executeWithRetry[T any](ctx context.Context, c *Client, endpoint string) (*T, error) {
	client := c.httpClient
	if client == nil {
		client = httputil.NewFastClient()
	}
	var lastErr error

	for attempt := 0; attempt < maxRetries; attempt++ {
		if err := ctx.Err(); err != nil {
			return nil, err
		}

		req, err := http.NewRequestWithContext(ctx, "GET", baseURL+endpoint, nil)
		if err != nil {
			return nil, err
		}

		req.Header.Set("Accept", "application/json")
		// Dynamically handle both v3 and v4 tokens
		token := strings.Trim(c.bearerToken, " \t\r\n\"'")
		if token != "" {
			if len(token) > 50 {
				// It's a v4 Read Access Token (JWT) -> use Bearer Auth
				req.Header.Set("Authorization", "Bearer "+token)
			} else {
				// It's a v3 API Key -> inject into query string
				q := req.URL.Query()
				q.Add("api_key", token)
				req.URL.RawQuery = q.Encode()
			}
		}

		if err := c.limiter.Wait(ctx); err != nil {
			return nil, err
		}
		resp, err := client.Do(req)

		if err != nil {
			lastErr = err
			waitTime := time.Duration(math.Pow(2, float64(attempt))) * time.Second
			if !sleepWithContext(ctx, waitTime) {
				return nil, ctx.Err()
			}
			continue
		}

		if resp.StatusCode == http.StatusTooManyRequests || resp.StatusCode >= 500 {
			resp.Body.Close()

			var waitTime time.Duration
			if retryAfter, err := strconv.Atoi(resp.Header.Get("Retry-After")); err == nil {
				waitTime = time.Duration(retryAfter) * time.Second
			} else {
				waitTime = time.Duration(math.Pow(2, float64(attempt))) * time.Second
			}

			if !sleepWithContext(ctx, waitTime) {
				return nil, ctx.Err()
			}

			lastErr = fmt.Errorf("retriable status code: %d", resp.StatusCode)
			continue
		}

		if resp.StatusCode < 200 || resp.StatusCode >= 300 {
			resp.Body.Close()
			return nil, fmt.Errorf("unexpected status code: %d", resp.StatusCode)
		}

		var result T
		err = json.NewDecoder(resp.Body).Decode(&result)
		resp.Body.Close()

		if err != nil {
			return nil, err
		}

		return &result, nil
	}

	return nil, lastErr
}

func sleepWithContext(ctx context.Context, d time.Duration) bool {
	if d <= 0 {
		return ctx.Err() == nil
	}
	timer := time.NewTimer(d)
	defer timer.Stop()
	select {
	case <-ctx.Done():
		return false
	case <-timer.C:
		return true
	}
}
