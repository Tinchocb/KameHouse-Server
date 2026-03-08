package dto

import (
	"time"
)

type (
	ScanSummaryLog struct {
		ID       string `json:"id"`
		FilePath string `json:"filePath"`
		Level    string `json:"level"`
		Message  string `json:"message"`
	}

	ScanSummary struct {
		ID             string              `json:"id"`
		Groups         []*ScanSummaryGroup `json:"groups"`
		UnmatchedFiles []*ScanSummaryFile  `json:"unmatchedFiles"`
	}

	ScanSummaryFile struct {
		ID        string            `json:"id"`
		LocalFile *LocalFile        `json:"localFile"`
		Logs      []*ScanSummaryLog `json:"logs"`
	}

	ScanSummaryGroup struct {
		ID                  string             `json:"id"`
		Files               []*ScanSummaryFile `json:"files"`
		MediaId             int                `json:"mediaId"`
		MediaTitle          string             `json:"mediaTitle"`
		MediaImage          string             `json:"mediaImage"`
		MediaIsInCollection bool               `json:"mediaIsInCollection"` // Whether the media is in the user's AniList collection
	}

	ScanSummaryItem struct { // Database item
		CreatedAt   time.Time    `json:"createdAt"`
		ScanSummary *ScanSummary `json:"scanSummary"`
	}
)
