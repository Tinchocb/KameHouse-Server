package tmdb

import (
	"testing"
)

func TestIsPlaceholderToken(t *testing.T) {
	cases := []struct {
		in   string
		want bool
	}{
		{"", true},
		{"   ", true},
		{"your_tmdb_bearer_token_here", true},
		{"your_tmdb_api_key_here", true},
		{`"your_tmdb_bearer_token_here"`, true},
		{"YOUR_TMDB_TOKEN_HERE", true},
		{"changeme", true},
		{"placeholder", true},
		{"eyJhbGciOiJIUzI1NiJ9.realistic-jwt-payload.signature", false},
		{"abc123realkey", false},
	}
	for _, c := range cases {
		if got := IsPlaceholderToken(c.in); got != c.want {
			t.Errorf("IsPlaceholderToken(%q) = %v, want %v", c.in, got, c.want)
		}
	}
}

func TestSanitizeToken(t *testing.T) {
	if got := SanitizeToken("your_tmdb_bearer_token_here"); got != "" {
		t.Errorf("placeholder must sanitize to empty, got %q", got)
	}
	if got := SanitizeToken("  realkey  "); got != "realkey" {
		t.Errorf("real token must be trimmed, got %q", got)
	}
}

func TestResolveToken(t *testing.T) {
	if tok, reason := ResolveToken("", "your_tmdb_bearer_token_here", "realkey"); tok != "realkey" || reason != "" {
		t.Errorf("expected realkey/\"\", got %q/%q", tok, reason)
	}
	if tok, reason := ResolveToken("", "your_tmdb_api_key_here"); tok != "" || reason != "placeholder" {
		t.Errorf("expected \"\"/placeholder, got %q/%q", tok, reason)
	}
	if tok, reason := ResolveToken("", "  "); tok != "" || reason != "missing" {
		t.Errorf("expected \"\"/missing, got %q/%q", tok, reason)
	}
}

func TestNewClientSanitizesPlaceholder(t *testing.T) {
	c := NewClient("your_tmdb_bearer_token_here")
	if c.HasApiKey() {
		t.Error("client built with placeholder must report HasApiKey()==false")
	}
	c2 := NewClient("realkey", "en-US")
	if !c2.HasApiKey() {
		t.Error("client built with real key must report HasApiKey()==true")
	}
}

func TestDegradedState(t *testing.T) {
	t.Setenv("KAMEHOUSE_TMDB_TOKEN", "")
	t.Setenv("KAMEHOUSE_TMDB_API_KEY", "")
	if degraded, reason := DegradedState("realkey", ""); degraded || reason != "" {
		t.Errorf("settings key must be healthy, got %v/%q", degraded, reason)
	}
	if degraded, reason := DegradedState("", ""); !degraded || reason != "missing" {
		t.Errorf("all empty must be missing, got %v/%q", degraded, reason)
	}
	if degraded, reason := DegradedState("your_tmdb_api_key_here", ""); !degraded || reason != "placeholder" {
		t.Errorf("placeholder must be placeholder, got %v/%q", degraded, reason)
	}
	t.Setenv("KAMEHOUSE_TMDB_TOKEN", "envkey")
	if degraded, _ := DegradedState("", ""); degraded {
		t.Error("env token must count as healthy")
	}
}
