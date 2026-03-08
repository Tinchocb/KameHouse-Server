package httputil

import (
	"net"
	"net/http"
	"sync"
	"time"
)

var (
	defaultClient     *http.Client
	defaultClientOnce sync.Once
)

type ClientOptions struct {
	MaxIdleConns        int
	MaxIdleConnsPerHost int
	IdleConnTimeout     time.Duration
	Timeout             time.Duration
	DisableKeepAlives   bool
}

func DefaultClientOptions() *ClientOptions {
	return &ClientOptions{
		MaxIdleConns:        100,
		MaxIdleConnsPerHost: 10,
		IdleConnTimeout:     90 * time.Second,
		Timeout:             30 * time.Second,
		DisableKeepAlives:   false,
	}
}

func NewClient(opts *ClientOptions) *http.Client {
	if opts == nil {
		opts = DefaultClientOptions()
	}

	transport := &http.Transport{
		Proxy: http.ProxyFromEnvironment,
		DialContext: (&net.Dialer{
			Timeout:   30 * time.Second,
			KeepAlive: 30 * time.Second,
		}).DialContext,
		MaxIdleConns:          opts.MaxIdleConns,
		MaxIdleConnsPerHost:   opts.MaxIdleConnsPerHost,
		IdleConnTimeout:       opts.IdleConnTimeout,
		TLSHandshakeTimeout:   10 * time.Second,
		ExpectContinueTimeout: 1 * time.Second,
		DisableKeepAlives:     opts.DisableKeepAlives,
		ForceAttemptHTTP2:     true,
	}

	return &http.Client{
		Transport: transport,
		Timeout:   opts.Timeout,
	}
}

func DefaultClient() *http.Client {
	defaultClientOnce.Do(func() {
		defaultClient = NewClient(DefaultClientOptions())
	})
	return defaultClient
}

func NewClientWithTimeout(timeout time.Duration) *http.Client {
	opts := DefaultClientOptions()
	opts.Timeout = timeout
	return NewClient(opts)
}

func NewStreamingClient() *http.Client {
	opts := DefaultClientOptions()
	opts.Timeout = 0
	opts.IdleConnTimeout = 120 * time.Second
	return NewClient(opts)
}

func NewFastClient() *http.Client {
	opts := DefaultClientOptions()
	opts.Timeout = 10 * time.Second
	opts.MaxIdleConns = 50
	opts.MaxIdleConnsPerHost = 5
	return NewClient(opts)
}
