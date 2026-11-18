package mediastream

import (
	"net/url"
	"strings"
)

// withPlaybackCredentials carries the same bounded read token through every
// relative URI in a static HLS tree. External URLs never receive credentials.
func withPlaybackCredentials(playlist, clientID, token string) string {
	playlist = withClientID(playlist, clientID)
	if token == "" {
		return playlist
	}
	sign := func(raw string) string {
		u, err := url.Parse(raw)
		if err != nil || raw == "" || u.IsAbs() || u.Host != "" {
			return raw
		}
		q := u.Query()
		q.Set("token", token)
		u.RawQuery = q.Encode()
		return u.String()
	}
	lines := strings.Split(playlist, "\n")
	for i, line := range lines {
		body := strings.TrimSuffix(line, "\r")
		if strings.HasPrefix(body, "#") {
			body = uriAttrRe.ReplaceAllStringFunc(body, func(attr string) string {
				return `URI="` + sign(attr[5:len(attr)-1]) + `"`
			})
		} else {
			body = sign(body)
		}
		if strings.HasSuffix(line, "\r") {
			body += "\r"
		}
		lines[i] = body
	}
	return strings.Join(lines, "\n")
}
