package util

import (
	"testing"
)

// TestGetOnlineUserAgents verifies the online fetch works.
// NOTE: skipped by default to avoid network calls in CI.
func TestGetOnlineUserAgents(t *testing.T) {
	t.Skip("skipping network test; run manually when needed")
	userAgents, err := getOnlineUserAgents()
	if err != nil {
		t.Fatalf("Failed to get online user agents: %v", err)
	}
	t.Logf("Online user agents: %d entries", len(userAgents))
}

// TestUserAgentListNotEmpty verifies that the generated UserAgentList is non-empty.
// This is a lightweight, side-effect-free check that runs in go test -short.
func TestUserAgentListNotEmpty(t *testing.T) {
	if len(UserAgentList) == 0 {
		t.Fatal("UserAgentList is empty — run: go generate ./internal/util/...")
	}
	t.Logf("UserAgentList has %d entries", len(UserAgentList))
}
