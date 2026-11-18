package handlers

import "time"

// Credentials and redirect are bound to the initiating attempt, not supplied
// again by the public callback. Entries are consumed even when exchange fails.
type driveOAuthAttempt struct {
	expiresAt    time.Time
	redirectURI  string
	clientID     string
	clientSecret string
}
