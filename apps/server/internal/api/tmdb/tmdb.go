package tmdb

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	httputil "kamehouse/internal/util/http"
)

// Client handles TMDb API requests with caching using the new EdgeHTTPClient.
type Client struct {
	bearerToken string
	language    string
	cache       sync.Map // simple in-memory cache for search results
	rateLimiter chan struct{}
	httpClient  *http.Client
}

// language is a BCP 47 language tag (e.g. "es-MX", "en-US"). If empty, defaults to "es-MX".
func NewClient(bearerToken string, language ...string) *Client {
	lang := "es-MX"
	if len(language) > 0 && language[0] != "" {
		lang = language[0]
	}
	return &Client{
		bearerToken: bearerToken,
		language:    lang,
		rateLimiter: make(chan struct{}, 4), // max 4 concurrent requests
		httpClient:  httputil.NewFastClient(),
	}
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

		c.rateLimiter <- struct{}{}
		resp, err := client.Do(req)
		<-c.rateLimiter

		if err != nil {
			lastErr = err
			continue
		}

		if resp.StatusCode == http.StatusTooManyRequests {
			resp.Body.Close()

			var waitTime time.Duration
			if retryAfter, err := strconv.Atoi(resp.Header.Get("Retry-After")); err == nil {
				waitTime = time.Duration(retryAfter) * time.Second
			} else {
				waitTime = time.Duration(math.Pow(2, float64(attempt))) * time.Second
			}

			select {
			case <-time.After(waitTime):
			case <-ctx.Done():
				return nil, ctx.Err()
			}

			lastErr = fmt.Errorf("rate limited")
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
