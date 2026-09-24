package drive

import "time"

// DriveFile represents a media file or directory discovered in Google Drive.
type DriveFile struct {
	ID             string    `json:"id"`
	Name           string    `json:"name"`
	Size           int64     `json:"size"`
	MimeType       string    `json:"mimeType"`
	ModifiedTime   time.Time `json:"modifiedTime"`
	MD5Checksum    string    `json:"md5Checksum,omitempty"`
	RelativePath   string    `json:"relativePath"` // e.g. "S01/Dragon Ball Kai - 01.mkv" or "Dragon Ball Kai - 01.mkv"
	DurationMillis int64     `json:"durationMillis,omitempty"`
	Width          int       `json:"width,omitempty"`
	Height         int       `json:"height,omitempty"`
}

// IsVideo returns true if the drive file is a supported video format.
func (f *DriveFile) IsVideo() bool {
	switch f.MimeType {
	case "video/x-matroska", "video/mp4", "video/webm", "video/quicktime", "video/avi":
		return true
	}
	// Fallback based on extension
	ext := getFileExt(f.Name)
	return ext == ".mkv" || ext == ".mp4" || ext == ".m4v" || ext == ".webm" || ext == ".avi"
}

func getFileExt(name string) string {
	for i := len(name) - 1; i >= 0 && name[i] != '/'; i-- {
		if name[i] == '.' {
			return name[i:]
		}
	}
	return ""
}

// DriveStatus represents current connection and health status of Google Drive integration.
type DriveStatus struct {
	Connected       bool   `json:"connected"`
	UserEmail       string `json:"userEmail,omitempty"`
	DisplayName     string `json:"displayName,omitempty"`
	FolderID        string `json:"folderId,omitempty"`
	FolderName      string `json:"folderName,omitempty"`
	IndexedEpisodes int    `json:"indexedEpisodes"`
	IsScanning      bool   `json:"isScanning"`
	Error           string `json:"error,omitempty"`
	// Progress is the live (or last finished) scan snapshot; nil if no scan ran since startup.
	Progress *ScanProgress `json:"progress,omitempty"`
}

// ScanPhase identifies the current stage of a Drive scan.
type ScanPhase string

const (
	ScanPhaseListing  ScanPhase = "listing"  // walking the folder tree
	ScanPhaseIndexing ScanPhase = "indexing" // resolving series/episodes per file
	ScanPhaseSaving   ScanPhase = "saving"   // writing to the database
	ScanPhasePruning  ScanPhase = "pruning"  // removing files no longer in Drive
	ScanPhaseDone     ScanPhase = "done"
	ScanPhaseError    ScanPhase = "error"
)

// ScanItem is a single file detected by a scan, shown in the live list.
type ScanItem struct {
	Name    string `json:"name"`
	Folder  string `json:"folder"`
	Series  string `json:"series"`
	Episode int    `json:"episode,omitempty"`
	IsMovie bool   `json:"isMovie,omitempty"`
}

// ScanSeriesCount counts video files discovered per resolved series.
type ScanSeriesCount struct {
	Title string `json:"title"`
	Count int    `json:"count"`
}

// ScanProgress is the live state of a Drive scan, pushed over WS as "drive_scan_progress".
type ScanProgress struct {
	Phase          ScanPhase         `json:"phase"`
	StartedAt      time.Time         `json:"startedAt"`
	FinishedAt     *time.Time        `json:"finishedAt,omitempty"`
	CurrentFolder  string            `json:"currentFolder"`
	FoldersScanned int               `json:"foldersScanned"`
	FoldersPending int               `json:"foldersPending"`
	FilesFound     int               `json:"filesFound"`
	Indexed        int               `json:"indexed"`
	Total          int               `json:"total"`
	Pruned         int               `json:"pruned"`
	Series         []ScanSeriesCount `json:"series"`
	Items          []ScanItem        `json:"items"` // todo lo detectado, en orden de detección
	Error          string            `json:"error,omitempty"`
}

// Clone returns a deep copy safe to serialize outside the service lock.
func (p *ScanProgress) Clone() *ScanProgress {
	if p == nil {
		return nil
	}
	c := *p
	// make (no append sobre nil): un slice vacío debe serializar como [] y no null.
	c.Series = append(make([]ScanSeriesCount, 0, len(p.Series)), p.Series...)
	c.Items = append(make([]ScanItem, 0, len(p.Items)), p.Items...)
	if p.FinishedAt != nil {
		t := *p.FinishedAt
		c.FinishedAt = &t
	}
	return &c
}
