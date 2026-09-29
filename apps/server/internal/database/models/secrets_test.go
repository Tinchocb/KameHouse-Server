package models

import "testing"

func TestMaskSecret(t *testing.T) {
	if got := MaskSecret(""); got != "" {
		t.Errorf("empty secret should stay empty, got %q", got)
	}
	if got := MaskSecret("short"); got != SecretMaskPrefix {
		t.Errorf("short secret should be fully masked, got %q", got)
	}
	got := MaskSecret("abcdef0123456789wxyz")
	if got != SecretMaskPrefix+"wxyz" {
		t.Errorf("expected mask + last 4, got %q", got)
	}
	if !IsMaskedSecret(got) {
		t.Error("masked value must be recognized as masked")
	}
	if IsMaskedSecret("abcdef0123456789wxyz") || IsMaskedSecret("") {
		t.Error("real or empty secret must not be recognized as masked")
	}
}

func TestSettingsRedactedDoesNotMutateOriginal(t *testing.T) {
	s := &Settings{}
	s.Library.TmdbApiKey = "tmdb-secret-key-1234"
	s.GoogleDrive.ClientID = "client-id"
	s.GoogleDrive.ClientSecret = "drive-secret-5678"
	s.GoogleDrive.RefreshToken = "refresh-token-9999"

	r := s.Redacted()
	if r.Library.TmdbApiKey != SecretMaskPrefix+"1234" ||
		r.GoogleDrive.ClientSecret != SecretMaskPrefix+"5678" ||
		r.GoogleDrive.RefreshToken != SecretMaskPrefix+"9999" {
		t.Errorf("secrets not masked: %+v %+v", r.Library.TmdbApiKey, r.GoogleDrive)
	}
	if r.GoogleDrive.ClientID != "client-id" {
		t.Errorf("non-secret fields must be kept, got %q", r.GoogleDrive.ClientID)
	}
	if s.Library.TmdbApiKey != "tmdb-secret-key-1234" || s.GoogleDrive.RefreshToken != "refresh-token-9999" {
		t.Error("Redacted must not modify the shared cached settings")
	}
	if (*Settings)(nil).Redacted() != nil {
		t.Error("nil settings should redact to nil")
	}
}
