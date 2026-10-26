package drive

import (
	"context"
	"errors"
	"io"
	"net/http"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/rs/zerolog"
)

type reloadTransport func(*http.Request) (*http.Response, error)

func (f reloadTransport) RoundTrip(r *http.Request) (*http.Response, error) { return f(r) }
func reloadIdentity(email string) *http.Response {
	return &http.Response{StatusCode: 200, Header: make(http.Header), Body: io.NopCloser(strings.NewReader(`{"email":"` + email + `","name":"Test"}`))}
}

func reloadedDriveService(t *testing.T, oldErr error) (*Service, <-chan struct{}, func()) {
	t.Helper()
	l := zerolog.Nop()
	s := NewService(&l)
	started, release := make(chan struct{}), make(chan struct{})
	var once sync.Once
	resume := func() { once.Do(func() { close(release) }) }
	t.Cleanup(resume)
	s.enabled = true
	s.folderID = "root"
	s.client = &Client{logger: &l, httpClient: &http.Client{Transport: reloadTransport(func(*http.Request) (*http.Response, error) {
		close(started)
		<-release
		if oldErr != nil {
			return nil, oldErr
		}
		return reloadIdentity("old@example.test"), nil
	})}}
	return s, started, resume
}

func waitDriveReload(t *testing.T, done <-chan struct{}) {
	t.Helper()
	select {
	case <-done:
	case <-time.After(5 * time.Second):
		t.Fatal("Drive request did not finish")
	}
}

func switchDriveAccount(t *testing.T, s *Service) {
	t.Helper()
	if err := s.UpdateConfig(true, "new-client", "new-secret", "new-refresh", "new-folder", "New"); err != nil {
		t.Fatal(err)
	}
	s.mu.Lock()
	s.client.httpClient = &http.Client{Transport: reloadTransport(func(*http.Request) (*http.Response, error) { return reloadIdentity("new@example.test"), nil })}
	s.mu.Unlock()
}

func TestDriveReloadOldIdentityCannotPopulateNewAccountCache(t *testing.T) {
	s, started, resume := reloadedDriveService(t, nil)
	done := make(chan struct{})
	go func() { defer close(done); s.GetStatus(context.Background(), 0) }()
	waitDriveReload(t, started)
	switchDriveAccount(t, s)
	resume()
	waitDriveReload(t, done)
	status := s.GetStatus(context.Background(), 0)
	if status.UserEmail != "new@example.test" {
		t.Fatalf("new account received old identity: %q", status.UserEmail)
	}
}

func TestDriveReloadOldFailureCannotClearNewIdentityCache(t *testing.T) {
	s, started, resume := reloadedDriveService(t, errors.New("old network error"))
	done := make(chan struct{})
	go func() { defer close(done); s.GetStatus(context.Background(), 0) }()
	waitDriveReload(t, started)
	switchDriveAccount(t, s)
	if st := s.GetStatus(context.Background(), 0); st.UserEmail != "new@example.test" {
		t.Fatal("new identity not cached")
	}
	resume()
	waitDriveReload(t, done)
	s.mu.RLock()
	email := s.cachedEmail
	s.mu.RUnlock()
	if email != "new@example.test" {
		t.Fatal("old failure cleared current identity cache")
	}
}

func TestDriveReloadOldAuthErrorCannotExpireNewAccount(t *testing.T) {
	s, started, resume := reloadedDriveService(t, errors.New(`oauth2: "invalid_grant"`))
	done := make(chan struct{})
	var expired bool
	go func() { defer close(done); expired = s.AuthExpired(context.Background()) }()
	waitDriveReload(t, started)
	switchDriveAccount(t, s)
	resume()
	waitDriveReload(t, done)
	if expired || s.AuthExpired(context.Background()) {
		t.Fatal("old authorization error expired the new account")
	}
}
