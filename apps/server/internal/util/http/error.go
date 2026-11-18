package httputil

import (
	"errors"
	"net/url"
)

// RedactError keeps a transport failure usable with errors.Is/As without
// publishing URL credentials or query tokens in API responses and logs.
func RedactError(err error) error {
	var requestErr *url.Error
	if !errors.As(err, &requestErr) {
		return err
	}
	safe := *requestErr
	safe.URL = "<redacted URL>"
	if u, parseErr := url.Parse(requestErr.URL); parseErr == nil {
		u.User, u.RawQuery, u.Fragment, u.ForceQuery = nil, "", "", false
		safe.URL = u.String()
	}
	return &safe
}
