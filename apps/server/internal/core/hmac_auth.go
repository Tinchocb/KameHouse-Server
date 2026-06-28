package core

import (
	"kamehouse/internal/util"
	"time"
)

// GetServerPasswordHMACAuth returns an HMAC authenticator using a SHA-256 derived key from the hashed server password as the base secret.
// This prevents exposing or leaking the Argon2id hash itself.
func (a *App) GetServerPasswordHMACAuth() *util.HMACAuth {
	var secret string
	if a.Config != nil && a.Config.Server.Password != "" {
		// Use SHA-256 of the Argon2 hash to derive a safe, stable secret key
		secret = util.HashSHA256Hex(a.ServerPasswordHash)
	} else {
		secret = a.FallbackHMACSecret
	}

	return util.NewHMACAuth(secret, 24*time.Hour)
}
