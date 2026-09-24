package drive

import (
	"context"
	"fmt"

	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"
)

const (
	DriveReadOnlyScope = "https://www.googleapis.com/auth/drive.readonly"
)

// GetOAuthConfig builds an oauth2.Config for Google Drive.
func GetOAuthConfig(clientID, clientSecret, redirectURI string) *oauth2.Config {
	return &oauth2.Config{
		ClientID:     clientID,
		ClientSecret: clientSecret,
		RedirectURL:  redirectURI,
		Scopes: []string{
			DriveReadOnlyScope,
			"https://www.googleapis.com/auth/userinfo.email",
			"https://www.googleapis.com/auth/userinfo.profile",
		},
		Endpoint: google.Endpoint,
	}
}

// GetAuthURL generates the Google OAuth consent URL.
// Forces prompt=consent and access_type=offline to guarantee receiving a refresh_token.
func GetAuthURL(clientID, clientSecret, redirectURI, state string) string {
	config := GetOAuthConfig(clientID, clientSecret, redirectURI)
	return config.AuthCodeURL(
		state,
		oauth2.AccessTypeOffline,
		oauth2.ApprovalForce,
		oauth2.SetAuthURLParam("prompt", "consent"),
	)
}

// ExchangeCode exchanges the authorization code for an OAuth2 token (including refresh token).
func ExchangeCode(ctx context.Context, clientID, clientSecret, code, redirectURI string) (*oauth2.Token, error) {
	if clientID == "" || clientSecret == "" {
		return nil, fmt.Errorf("client_id and client_secret are required")
	}
	config := GetOAuthConfig(clientID, clientSecret, redirectURI)
	token, err := config.Exchange(ctx, code)
	if err != nil {
		return nil, fmt.Errorf("failed to exchange authorization code: %w", err)
	}
	return token, nil
}
