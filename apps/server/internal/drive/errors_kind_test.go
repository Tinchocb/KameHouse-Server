package drive

import (
	"context"
	"io"
	"net/http"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

// Drive contesta el límite de tasa con 403 + userRateLimitExceeded (no con 429): es un
// error pasajero que se reintenta, no una falla definitiva.
func TestStreamStatusErrorClassifiesRateLimit(t *testing.T) {
	rate := &StreamStatusError{Status: http.StatusForbidden, Body: `{"error":{"errors":[{"reason":"userRateLimitExceeded"}]}}`}
	require.True(t, rate.Transient(), "403 userRateLimitExceeded se reintenta")
	require.Equal(t, ErrKindRate, rate.DriveErrorKind())
	require.False(t, rate.Is(ErrDownloadQuotaExceeded))

	for _, reason := range []string{"rateLimitExceeded", "sharingRateLimitExceeded"} {
		e := &StreamStatusError{Status: http.StatusForbidden, Body: `{"reason":"` + reason + `"}`}
		require.True(t, e.Transient(), reason)
		require.Equal(t, ErrKindRate, e.DriveErrorKind(), reason)
	}

	quota := &StreamStatusError{Status: http.StatusForbidden, Body: `{"reason":"downloadQuotaExceeded"}`}
	require.True(t, quota.Transient())
	require.Equal(t, ErrKindQuota, quota.DriveErrorKind())

	denied := &StreamStatusError{Status: http.StatusForbidden, Body: `{"reason":"forbidden","message":"The user does not have sufficient permissions"}`}
	require.False(t, denied.Transient(), "un 403 de permisos no mejora reintentando")
	require.Equal(t, ErrKindAuth, denied.DriveErrorKind())

	require.Equal(t, ErrKindAuth, (&StreamStatusError{Status: http.StatusUnauthorized}).DriveErrorKind())
	require.Equal(t, ErrKindNotFound, (&StreamStatusError{Status: http.StatusNotFound}).DriveErrorKind())
	require.Equal(t, ErrKindServer, (&StreamStatusError{Status: http.StatusBadGateway}).DriveErrorKind())
	require.Equal(t, ErrKindRate, (&StreamStatusError{Status: http.StatusTooManyRequests}).DriveErrorKind())

	// El cache de bloques agota los reintentos y envuelve el error: sigue informando el motivo.
	var wrapped error = &exhaustedError{err: rate}
	type classified interface {
		DriveErrorKind() string
		DriveStatus() int
	}
	c, ok := wrapped.(classified)
	require.True(t, ok)
	require.Equal(t, ErrKindRate, c.DriveErrorKind())
	require.Equal(t, http.StatusForbidden, c.DriveStatus())
}

func TestRetryingFetchRetriesRateLimit(t *testing.T) {
	var calls int
	up := func(ctx context.Context, rh string) (*http.Response, error) {
		calls++
		if calls < 3 {
			return nil, &StreamStatusError{Status: http.StatusForbidden, Body: `userRateLimitExceeded`}
		}
		return &http.Response{StatusCode: http.StatusPartialContent, Header: http.Header{"Content-Range": []string{"bytes 0-3/10"}}, Body: io.NopCloser(strings.NewReader("abcd"))}, nil
	}
	resp, err := retryingFetch(up)(context.Background(), "bytes=0-3")
	require.NoError(t, err)
	_ = resp.Body.Close()
	require.Equal(t, 3, calls, "dos 403 de límite de tasa y el tercero pasa")
}
