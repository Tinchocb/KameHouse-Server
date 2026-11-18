package core

import (
	"kamehouse/internal/database/models"
	"testing"
)

func TestDriveEnvironmentCredentialsRequireCompletePair(t *testing.T) {
	for _, tc := range []struct {
		name, id, secret string
		provisioned      bool
	}{
		{"complete", " app-id ", " app-secret ", true},
		{"missing ID", "", "app-secret", false},
		{"missing secret", "app-id", "  ", false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			t.Setenv("KAMEHOUSE_GOOGLE_DRIVE_CLIENT_ID", tc.id)
			t.Setenv("KAMEHOUSE_GOOGLE_DRIVE_CLIENT_SECRET", tc.secret)
			s := &models.Settings{}
			s.GoogleDrive.ClientID, s.GoogleDrive.ClientSecret = "saved-id", "saved-secret"
			applyEnvSettingsOverrides(s)
			id, secret := "saved-id", "saved-secret"
			if tc.provisioned {
				id, secret = "app-id", "app-secret"
			}
			if s.GoogleDrive.ClientID != id || s.GoogleDrive.ClientSecret != secret {
				t.Fatal("OAuth credentials were mixed or not trimmed")
			}
		})
	}
}
