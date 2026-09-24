package tmdb

import (
	"os"
	"strings"
)

// IsPlaceholderToken reports whether a configured TMDB token is empty or an
// unreplaced example value (e.g. "your_tmdb_bearer_token_here").
//
// Such values must never be sent to the TMDB API: they always fail auth and
// produce confusing 401s. Callers should treat them as "not configured" and
// degrade to the default provider instead.
func IsPlaceholderToken(token string) bool {
	trimmed := strings.Trim(token, " \t\r\n\"'")
	if trimmed == "" {
		return true
	}
	lower := strings.ToLower(trimmed)
	switch lower {
	case "test", "xxx", "null", "none", "changeme":
		return true
	}
	// NOTE: markers are deliberately specific ("your_", "example", ...).
	// Short generic substrings like "here" are NOT used: they can legally
	// appear inside real base64url JWTs and would cause false positives.
	for _, marker := range []string{"your_", "your-", "changeme", "placeholder", "example", "sample", "replace", "insert", "missing", "todo"} {
		if strings.Contains(lower, marker) {
			return true
		}
	}
	return false
}

// SanitizeToken returns "" when the token is empty or a placeholder, so that
// HasApiKey() correctly reports "not configured" and no invalid auth header
// is ever emitted. Real tokens are returned trimmed of whitespace/quotes.
func SanitizeToken(token string) string {
	if IsPlaceholderToken(token) {
		return ""
	}
	return strings.Trim(token, " \t\r\n\"'")
}

// ResolveToken returns the first usable TMDB token from the given candidates
// (in priority order) after sanitizing placeholders.
//
// The reason is "" when a usable token was found, "placeholder" when at least
// one candidate was set but all were placeholders, and "missing" when every
// candidate was empty.
func ResolveToken(candidates ...string) (effective string, reason string) {
	sawPlaceholder := false
	for _, c := range candidates {
		if strings.Trim(c, " \t\r\n\"'") == "" {
			continue
		}
		if IsPlaceholderToken(c) {
			sawPlaceholder = true
			continue
		}
		return SanitizeToken(c), ""
	}
	if sawPlaceholder {
		return "", "placeholder"
	}
	return "", "missing"
}

// ResolveTokenFromEnv returns the effective TMDB token from the environment.
// KAMEHOUSE_TMDB_TOKEN takes precedence; KAMEHOUSE_TMDB_API_KEY is accepted
// as a fallback because .env documents both names.
func ResolveTokenFromEnv() (effective string, reason string) {
	return ResolveToken(os.Getenv("KAMEHOUSE_TMDB_TOKEN"), os.Getenv("KAMEHOUSE_TMDB_API_KEY"))
}

// DegradedState reports whether TMDB is unusable given the runtime settings
// token and the file-config token (env vars are considered automatically).
// It mirrors the resolution priority used at startup: settings (which already
// embed any env override), then KAMEHOUSE_TMDB_TOKEN, KAMEHOUSE_TMDB_API_KEY,
// then config. Reason is "" when healthy, otherwise "missing" or
// "placeholder".
func DegradedState(settingsToken, cfgToken string) (degraded bool, reason string) {
	if _, r := ResolveToken(settingsToken, os.Getenv("KAMEHOUSE_TMDB_TOKEN"), os.Getenv("KAMEHOUSE_TMDB_API_KEY"), cfgToken); r != "" {
		return true, r
	}
	return false, ""
}
