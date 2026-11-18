package httputil

import (
	"fmt"
	"io"
	"net/url"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestTransportErrorRedactionPreservesCauseWithoutCredentials(t *testing.T) {
	original := &url.Error{Op: "Get", URL: "https://user:password@example.com/configuration?api_key=private-key&token=private-token#secret", Err: io.ErrUnexpectedEOF}
	err := RedactError(fmt.Errorf("request failed: %w", original))
	require.ErrorIs(t, err, io.ErrUnexpectedEOF)
	require.Contains(t, err.Error(), "example.com/configuration")
	for _, secret := range []string{"user", "password", "private-key", "private-token", "secret"} {
		require.NotContains(t, err.Error(), secret)
	}
	require.Contains(t, original.URL, "private-key", "redaction must not mutate a shared error")
	require.Nil(t, RedactError(nil))
}
