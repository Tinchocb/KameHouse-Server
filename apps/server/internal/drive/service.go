package drive

import (
	"context"
	"fmt"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/rs/zerolog"
)

// Service coordinates Google Drive configuration and streaming operations.
type Service struct {
	mu               sync.RWMutex
	client           *Client
	clientID         string
	clientSecret     string
	refreshToken     string
	folderID         string
	folderName       string
	enabled          bool
	isScanning       bool
	progress         *ScanProgress
	cachedEmail      string
	cachedName       string
	userInfoCachedAt time.Time
	logger           *zerolog.Logger
}

func NewService(logger *zerolog.Logger) *Service {
	return &Service{
		logger: logger,
	}
}

// CleanFolderID extracts the raw Google Drive folder ID if a full URL was provided.
func CleanFolderID(input string) string {
	input = strings.TrimSpace(input)
	if strings.Contains(input, "drive.google.com") || strings.Contains(input, "/folders/") {
		parts := strings.Split(input, "/folders/")
		if len(parts) > 1 {
			id := parts[1]
			if idx := strings.IndexAny(id, "?&#/"); idx != -1 {
				id = id[:idx]
			}
			return strings.TrimSpace(id)
		}
	}
	return input
}

// UpdateConfig updates the Google Drive service configuration and rebuilds the active client.
func (s *Service) UpdateConfig(enabled bool, clientID, clientSecret, refreshToken, folderID, folderName string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.client != nil {
		s.client.Close()
	}

	s.enabled = enabled
	s.clientID = strings.TrimSpace(clientID)
	s.clientSecret = strings.TrimSpace(clientSecret)
	s.refreshToken = strings.TrimSpace(refreshToken)
	s.folderID = CleanFolderID(folderID)
	s.folderName = strings.TrimSpace(folderName)
	s.cachedEmail = ""
	s.cachedName = ""
	s.userInfoCachedAt = time.Time{}

	if !enabled || s.clientID == "" || s.clientSecret == "" || s.refreshToken == "" {
		s.client = nil
		return nil
	}

	client, err := NewClient(s.clientID, s.clientSecret, s.refreshToken, s.logger)
	if err != nil {
		s.client = nil
		return fmt.Errorf("failed to initialize drive client: %w", err)
	}

	s.client = client
	s.logger.Info().Str("folderId", s.folderID).Msg("drive: Google Drive client initialized successfully")
	return nil
}

// GetClient returns the currently initialized client, or error if not configured.
func (s *Service) GetClient() (*Client, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	if !s.enabled || s.client == nil {
		return nil, fmt.Errorf("google drive integration is not enabled or credentials not configured")
	}
	return s.client, nil
}

// IsEnabled returns true if Google Drive integration is enabled.
func (s *Service) IsEnabled() bool {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.enabled && s.client != nil && s.folderID != ""
}

// GetFolderID returns the configured root folder ID.
func (s *Service) GetFolderID() string {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.folderID
}

// TryStartScan atomically marks a scan as running and resets the progress snapshot.
// It returns false if another scan is already in progress.
func (s *Service) TryStartScan() bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.isScanning {
		return false
	}
	s.isScanning = true
	s.progress = &ScanProgress{
		Phase:     ScanPhaseListing,
		StartedAt: time.Now(),
		Series:    []ScanSeriesCount{},
		Items:     []ScanItem{},
	}
	return true
}

// FinishScan clears the running flag, keeping the final progress snapshot for the UI.
func (s *Service) FinishScan() {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.isScanning = false
}

// updateProgress mutates the progress snapshot under the service lock.
func (s *Service) updateProgress(fn func(p *ScanProgress)) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.progress != nil {
		fn(s.progress)
	}
}

// GetProgress returns a copy of the current (or last) scan progress, or nil.
func (s *Service) GetProgress() *ScanProgress {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.progress.Clone()
}

// IsScanning returns true if a Drive scan is in progress.
func (s *Service) IsScanning() bool {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.isScanning
}

// GetStatus checks Google Drive connectivity and returns the current status.
func (s *Service) GetStatus(ctx context.Context, indexedEpisodes int) *DriveStatus {
	s.mu.RLock()
	client := s.client
	enabled := s.enabled
	folderID := s.folderID
	folderName := s.folderName
	isScanning := s.isScanning
	cachedEmail := s.cachedEmail
	cachedName := s.cachedName
	cacheValid := cachedEmail != "" && time.Since(s.userInfoCachedAt) < 10*time.Minute
	progress := s.progress.Clone()
	s.mu.RUnlock()

	status := &DriveStatus{
		Connected:       false,
		FolderID:        folderID,
		FolderName:      folderName,
		IndexedEpisodes: indexedEpisodes,
		IsScanning:      isScanning,
		Progress:        progress,
	}

	if !enabled || client == nil {
		return status
	}

	if cacheValid {
		status.Connected = true
		status.UserEmail = cachedEmail
		status.DisplayName = cachedName
		return status
	}

	email, name, err := client.GetUserInfo(ctx)
	if err != nil {
		s.mu.Lock()
		s.cachedEmail = ""
		s.cachedName = ""
		s.userInfoCachedAt = time.Time{}
		s.mu.Unlock()

		status.Error = err.Error()
		return status
	}

	s.mu.Lock()
	s.cachedEmail = email
	s.cachedName = name
	s.userInfoCachedAt = time.Now()
	s.mu.Unlock()

	status.Connected = true
	status.UserEmail = email
	status.DisplayName = name
	return status
}

// StreamMedia delegates media streaming to the active Drive client.
// The caller is responsible for closing the returned Response.Body.
func (s *Service) StreamMedia(ctx context.Context, fileID string, rangeHeader string) (*http.Response, error) {
	client, err := s.GetClient()
	if err != nil {
		return nil, err
	}

	return client.GetMediaStream(ctx, fileID, rangeHeader)
}

