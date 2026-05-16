package models

import (
	"database/sql/driver"
	"errors"
	"strconv"
	"strings"
	"time"
)

type BaseModel struct {
	ID        uint      `gorm:"primarykey" json:"id"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

type Token struct {
	BaseModel
	Value string `json:"value"`
}

type Account struct {
	BaseModel
	Username string `gorm:"column:username" json:"username"`
	Token    string `gorm:"column:token" json:"token"`
	Viewer   []byte `gorm:"column:viewer" json:"viewer"`
}

type WatchHistory struct {
	BaseModel
	AccountID     uint    `gorm:"column:account_id;uniqueIndex:idx_media_episode" json:"accountId"`
	MediaID       int     `gorm:"column:media_id;uniqueIndex:idx_media_episode" json:"mediaId"`
	EpisodeNumber int     `gorm:"column:episode_number;uniqueIndex:idx_media_episode" json:"episodeNumber"`
	CurrentTime   float64 `gorm:"column:current_time" json:"currentTime"`
	Duration      float64 `gorm:"column:duration" json:"duration"`
}

type LocalFiles struct {
	BaseModel
	Value []byte `gorm:"column:value" json:"value"`
}

type ShelvedLocalFiles struct {
	BaseModel
	Value []byte `gorm:"column:value" json:"value"`
}

type Settings struct {
	BaseModel
	Library        LibrarySettings        `json:"library" gorm:"embedded;embeddedPrefix:library_"`
	MediaPlayer    MediaPlayerSettings    `json:"mediaPlayer" gorm:"embedded;embeddedPrefix:media_player_"`
	// Separate tables
	Mediastream   *MediastreamSettings   `json:"mediastream" gorm:"-"`
	Theme         *Theme                 `json:"theme" gorm:"-"`
	Updated       bool                    `gorm:"-" json:"updated"`
}

type UserAnime struct {
	ID      int
	MediaID int
	Status  string
}




type LibrarySettings struct {
	SeriesPaths                     LibraryPaths `gorm:"column:series_paths;type:text" json:"seriesPaths"`
	MoviePaths                      LibraryPaths `gorm:"column:movie_paths;type:text" json:"moviePaths"`
	AutoUpdateProgress              bool         `gorm:"column:auto_update_progress" json:"autoUpdateProgress"`
	DisableAnimeCardTrailers        bool         `gorm:"column:disable_anime_card_trailers" json:"disableAnimeCardTrailers"`
	DOHProvider                     string       `gorm:"column:doh_provider" json:"dohProvider"`
	OpenWebURLOnStart               bool         `gorm:"column:open_web_url_on_start" json:"openWebURLOnStart"`
	RefreshLibraryOnStart           bool         `gorm:"column:refresh_library_on_start" json:"refreshLibraryOnStart"`
	AutoPlayNextEpisode             bool         `gorm:"column:auto_play_next_episode" json:"autoPlayNextEpisode"`
	EnableWatchContinuity           bool         `gorm:"column:enable_watch_continuity" json:"enableWatchContinuity"`
	AutoSyncOfflineLocalData        bool         `gorm:"column:auto_sync_offline_local_data" json:"autoSyncOfflineLocalData"`
	ScannerMatchingThreshold        float64      `gorm:"column:scanner_matching_threshold" json:"scannerMatchingThreshold"`
	ScannerMatchingAlgorithm        string       `gorm:"column:scanner_matching_algorithm" json:"scannerMatchingAlgorithm"`
	AutoSyncToLocalAccount          bool         `gorm:"column:auto_sync_to_local_account" json:"autoSyncToLocalAccount"`
	AutoSaveCurrentMediaOffline     bool         `gorm:"column:auto_save_current_media_offline" json:"autoSaveCurrentMediaOffline"`
	UseFallbackMetadataProvider     bool         `gorm:"column:use_fallback_metadata_provider" json:"useFallbackMetadataProvider"`
	PrimaryMetadataProvider         string       `gorm:"column:primary_metadata_provider" json:"primaryMetadataProvider"`
	TmdbApiKey                      string       `gorm:"column:tmdb_api_key" json:"tmdbApiKey"`
	TmdbLanguage                    string       `gorm:"column:tmdb_language" json:"tmdbLanguage"`
	ScannerStrictStructure          bool         `gorm:"column:scanner_strict_structure" json:"scannerStrictStructure"`
	ScannerConfig                   string       `gorm:"column:scanner_config" json:"scannerConfig"`
	ScannerProvider                 string       `gorm:"column:scanner_provider" json:"scannerProvider"`
	DisableLocalScanning            bool         `gorm:"column:disable_local_scanning" json:"disableLocalScanning"`
	ScannerUseLegacyMatching        bool         `gorm:"column:scanner_use_legacy_matching" json:"scannerUseLegacyMatching"`
	FanartApiKey                    string       `gorm:"column:fanart_api_key" json:"fanartApiKey"`
	OmdbApiKey                      string       `gorm:"column:omdb_api_key" json:"omdbApiKey"`
	OpenSubsApiKey                  string       `gorm:"column:opensubs_api_key" json:"openSubsApiKey"`
	LastScanAt                      time.Time    `gorm:"column:last_scan_at" json:"lastScanAt"`
}

func (s *LibrarySettings) GetAllPaths() []string {
	var paths []string
	for _, p := range s.SeriesPaths {
		if p != "" {
			paths = append(paths, p)
		}
	}
	for _, p := range s.MoviePaths {
		if p != "" {
			paths = append(paths, p)
		}
	}
	return paths
}

type LibraryPaths []string

func (o *LibraryPaths) Scan(src interface{}) error {
	if src == nil {
		*o = []string{}
		return nil
	}
	
	str, ok := src.(string)
	if !ok {
		b, ok := src.([]byte)
		if !ok {
			return errors.New("src value cannot cast to string")
		}
		str = string(b)
	}
	
	if str == "" {
		*o = []string{}
		return nil
	}
	
	*o = strings.Split(str, ",")
	return nil
}

func (o LibraryPaths) Value() (driver.Value, error) {
	if len(o) == 0 {
		return nil, nil
	}
	return strings.Join(o, ","), nil
}

type StringSlice []string

func (o *StringSlice) Scan(src interface{}) error {
	if src == nil {
		*o = []string{}
		return nil
	}
	str, ok := src.(string)
	if !ok {
		b, ok := src.([]byte)
		if !ok {
			return errors.New("src value cannot cast to string")
		}
		str = string(b)
	}
	if str == "" {
		*o = []string{}
		return nil
	}
	*o = strings.Split(str, ",")
	return nil
}

func (o StringSlice) Value() (driver.Value, error) {
	if len(o) == 0 {
		return nil, nil
	}
	return strings.Join(o, ","), nil
}

type IntSlice []int


func (o *IntSlice) Scan(src interface{}) error {
	str, ok := src.(string)
	if !ok {
		return errors.New("src value cannot cast to string")
	}
	ids := strings.Split(str, ",")
	*o = make(IntSlice, len(ids))
	for i, id := range ids {
		(*o)[i], _ = strconv.Atoi(id)
	}
	return nil
}

func (o IntSlice) Value() (driver.Value, error) {
	if len(o) == 0 {
		return nil, nil
	}
	strs := make([]string, len(o))
	for i, id := range o {
		strs[i] = strconv.Itoa(id)
	}
	return strings.Join(strs, ","), nil
}



type MediaPlayerSettings struct {
	Default                       string `gorm:"column:default_player" json:"defaultPlayer"`
	Host                          string `gorm:"column:player_host" json:"host"`
	VlcUsername                   string `gorm:"column:vlc_username" json:"vlcUsername"`
	VlcPassword                   string `gorm:"column:vlc_password" json:"vlcPassword"`
	VlcPort                       int    `gorm:"column:vlc_port" json:"vlcPort"`
	VlcPath                       string `gorm:"column:vlc_path" json:"vlcPath"`
	MpcPort                       int    `gorm:"column:mpc_port" json:"mpcPort"`
	MpcPath                       string `gorm:"column:mpc_path" json:"mpcPath"`
	MpvSocket                     string `gorm:"column:mpv_socket" json:"mpvSocket"`
	MpvPath                     string `gorm:"column:mpv_path" json:"mpvPath"`
	MpvArgs                       string `gorm:"column:mpv_args" json:"mpvArgs"`
	IinaSocket                    string `gorm:"column:iina_socket" json:"iinaSocket"`
	IinaPath                      string `gorm:"column:iina_path" json:"iinaPath"`
	IinaArgs                      string `gorm:"column:iina_args" json:"iinaArgs"`
	VcTranslate                   bool `gorm:"column:vc_translate" json:"vcTranslate"`
	VcTranslateProvider           string `gorm:"column:vc_translate_provider" json:"vcTranslateProvider"`
	VcTranslateApiKey              string `gorm:"column:vc_translate_api_key" json:"vcTranslateApiKey"`
	VcTranslateTargetLanguage     string `gorm:"column:vc_translate_target_language" json:"vcTranslateTargetLanguage"`
}



type ListSyncSettings struct {
	Automatic bool   `gorm:"column:automatic_sync" json:"automatic"`
	Origin    string `gorm:"column:sync_origin" json:"origin"`
}


type NotificationSettings struct {
	DisableNotifications               bool `gorm:"column:disable_notifications" json:"disableNotifications"`
	DisableAutoScannerNotifications    bool `gorm:"column:disable_auto_scanner_notifications" json:"disableAutoScannerNotifications"`
}



type ScanSummary struct {
	BaseModel
	Value []byte `gorm:"column:value" json:"value"`
}



type Theme struct {
	BaseModel
	EnableColorSettings    bool   `gorm:"column:enable_color_settings" json:"enableColorSettings"`
	BackgroundColor        string `gorm:"column:background_color" json:"backgroundColor"`
	AccentColor            string `gorm:"column:accent_color" json:"accentColor"`
	SidebarBackgroundColor string `gorm:"column:sidebar_background_color" json:"sidebarBackgroundColor"`
	HomeItems              []byte `gorm:"column:home_items" json:"homeItems"`
}

type HomeItem struct {
	ID   string `json:"id"`
	Type string `json:"type"`
}

type MediastreamSettings struct {
	BaseModel
	TranscodeEnabled               bool   `gorm:"column:transcode_enabled" json:"transcodeEnabled"`
	FfmpegPath                      string `gorm:"column:ffmpeg_path" json:"ffmpegPath"`
	FfprobePath                     string `gorm:"column:ffprobe_path" json:"ffprobePath"`
	PreTranscodeLibraryDir         string `gorm:"column:pre_transcode_library_dir" json:"preTranscodeLibraryDir"`
	TranscodeHwAccel               string `gorm:"column:transcode_hw_accel" json:"transcodeHwAccel"`
	TranscodePreset                string `gorm:"column:transcode_preset" json:"transcodePreset"`
	TranscodeHwAccelCustomSettings string `gorm:"column:transcode_hw_accel_custom_settings" json:"transcodeHwAccelCustomSettings"`
	PreTranscodeEnabled            bool   `gorm:"column:pre_transcode_enabled" json:"preTranscodeEnabled"`
	TranscodeThreads               int    `gorm:"column:transcode_threads" json:"transcodeThreads"`
	DirectPlayOnly                 bool   `gorm:"column:direct_play_only" json:"directPlayOnly"`
}


type GhostAssociatedMedia struct {
	BaseModel
	Path            string  `json:"path"`
	TargetMediaId   int     `json:"targetMediaId"`
	GhostMatchCount int     `json:"ghostMatchCount"`
	AlgorithmScore  float64 `json:"algorithmScore"`
	UserResolved    bool    `json:"userResolved"`
	OriginalTitle   string  `json:"originalTitle"`
	Confidence      float64 `json:"confidence"`
}

type MediaMetadataParent struct {
	BaseModel
	MediaId       int `json:"mediaId"`
	ParentId      int `json:"parentId"`
	SpecialOffset int `json:"specialOffset"`
}

type OnlinestreamMapping struct {
	BaseModel
	MediaID  int    `json:"mediaId"`
	AnimeID  string `json:"animeId"`
	Provider string `json:"provider"`
}

type SilencedMediaEntry struct {
	BaseModel
}



type MediaFiller struct {
	BaseModel
	Data          []byte    `json:"data"`
	MediaID       int       `json:"mediaId"`
	Provider      string    `json:"provider"`
	Slug          string    `json:"slug"`
	LastFetchedAt time.Time `json:"lastFetchedAt"`
}





type UserMediaProgress struct {
	BaseModel
	AnonUserId string  `gorm:"column:anon_user_id;uniqueIndex:idx_anon_media" json:"anonUserId"`
	MediaId    int     `gorm:"column:media_id;uniqueIndex:idx_anon_media" json:"mediaId"`
	Status     string  `gorm:"column:status" json:"status"`
	Progress   int     `gorm:"column:progress" json:"progress"`
	Score      float64 `gorm:"column:score" json:"score"`
}



// MediaCollection groups movies or shows that belong to the same TMDB franchise/saga.
// It is populated automatically when a scanned movie has a non-nil BelongsToCollection
// field in its TMDB metadata.
type MediaCollection struct {
	BaseModel
	// TMDBCollectionID is the TMDB /collection/{id} identifier — the canonical key.
	TMDBCollectionID int    `gorm:"column:tmdb_collection_id;uniqueIndex" json:"tmdbCollectionId"`
	Name             string `gorm:"column:name" json:"name"`
	Overview         string `gorm:"column:overview" json:"overview"`
	PosterPath       string `gorm:"column:poster_path" json:"posterPath"`
	BackdropPath     string `gorm:"column:backdrop_path" json:"backdropPath"`
	// MemberIDs is a comma-separated list of TMDB media IDs belonging to this collection.
	// Stored as plain text for SQLite compatibility; use IntSlice scanner.
	MemberIDs IntSlice `gorm:"column:member_ids;type:text" json:"memberIds"`
}

// MetadataCache stores raw JSON responses from metadata providers (TMDB, AniList, etc.)
// to avoid redundant API calls across different scan sessions.
type MetadataCache struct {
	BaseModel
	Provider  string    `gorm:"column:provider;uniqueIndex:idx_provider_key" json:"provider"`
	Key       string    `gorm:"column:key;uniqueIndex:idx_provider_key" json:"key"`
	Value     []byte    `gorm:"column:value" json:"value"`
	ExpiresAt time.Time `gorm:"column:expires_at" json:"expiresAt"`
}

