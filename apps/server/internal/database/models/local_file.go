package models

import (
	"encoding/json"
)

// LocalFile represents a single media file in the database.
// This model replaces the legacy LocalFiles (plural) blob approach.
type LocalFile struct {
	BaseModel
	Path           string `gorm:"column:path;uniqueIndex;collate:nocase" json:"path"`
	Name           string `gorm:"column:name" json:"name"`
	FileHash       string `gorm:"column:file_hash" json:"fileHash"`
	FileSize       int64  `gorm:"column:file_size" json:"fileSize"`
	FileModTime    int64  `gorm:"column:file_mod_time" json:"fileModTime"` // Stored as Unix timestamp for simplicity
	Locked         bool   `gorm:"column:locked" json:"locked"`
	Ignored        bool   `gorm:"column:ignored" json:"ignored"`
	LibraryMediaId uint   `gorm:"column:library_media_id;index" json:"libraryMediaId"`
	MediaId        int    `gorm:"column:media_id;index" json:"mediaId"`

	// Metadata and technical info stored as JSON blocks for flexibility
	ParsedData       json.RawMessage `gorm:"column:parsed_data;type:text" json:"parsedInfo"`
	ParsedFolderData json.RawMessage `gorm:"column:parsed_folder_data;type:text" json:"parsedFolderInfo"`
	EmbeddedMetadata json.RawMessage `gorm:"column:embedded_metadata;type:text" json:"embeddedMetadata"`
	Metadata         json.RawMessage `gorm:"column:metadata;type:text" json:"metadata"`
	TechnicalInfo    json.RawMessage `gorm:"column:technical_info;type:text" json:"technicalInfo"`
}

func (LocalFile) TableName() string {
	return "local_file"
}
