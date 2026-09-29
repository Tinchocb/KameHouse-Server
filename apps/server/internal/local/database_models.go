package local

import (
	"database/sql/driver"
	"errors"
	"kamehouse/internal/api/metadata"
	"time"

	"github.com/goccy/go-json"
)

type BaseModel struct {
	ID        uint      `gorm:"primarykey" json:"id"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// +---------------------+
// |      Offline        |
// +---------------------+

// TrackedMedia tracks media that should be stored locally.
type TrackedMedia struct {
	BaseModel
	MediaID int    `gorm:"column:media_id" json:"mediaId"`
	Type    string `gorm:"column:type" json:"type"` // "anime"
}

type AnimeSnapshot struct {
	BaseModel
	MediaID int `gorm:"column:media_id" json:"mediaId"`
	//ListEntry         LocalAnimeListEntry `gorm:"column:list_entry" json:"listEntry"`
	AnimeMetadata     LocalAnimeMetadata `gorm:"column:anime_metadata" json:"animeMetadata"`
	BannerImagePath   string             `gorm:"column:banner_image_path" json:"bannerImagePath"`
	CoverImagePath    string             `gorm:"column:cover_image_path" json:"coverImagePath"`
	EpisodeImagePaths StringMap          `gorm:"column:episode_image_paths" json:"episodeImagePaths"`
	// ReferenceKey is used to compare the snapshot with the current data.
	ReferenceKey string `gorm:"column:reference_key" json:"referenceKey"`
}

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

type StringMap map[string]string

func (o *StringMap) Scan(src interface{}) error {
	bytes, ok := src.([]byte)
	if !ok {
		return errors.New("src value cannot cast to []byte")
	}
	var ret map[string]string
	err := json.Unmarshal(bytes, &ret)
	if err != nil {
		return err
	}
	*o = ret
	return nil
}

func (o StringMap) Value() (driver.Value, error) {
	return json.Marshal(o)
}

type LocalAnimeMetadata metadata.AnimeMetadata

//----------------------------------------------------------------------------------------------------------------------------------------------------

func (o *LocalAnimeMetadata) Scan(src interface{}) error {
	bytes, ok := src.([]byte)
	if !ok {
		return errors.New("src value cannot cast to []byte")
	}
	var ret metadata.AnimeMetadata
	err := json.Unmarshal(bytes, &ret)
	if err != nil {
		return err
	}
	*o = LocalAnimeMetadata(ret)
	return nil
}

func (o LocalAnimeMetadata) Value() (driver.Value, error) {
	return json.Marshal(o)
}

//----------------------------------------------------------------------------------------------------------------------------------------------------

//type LocalAnimeListEntry Platform.AnimeListEntry
//
//func (o *LocalAnimeListEntry) Scan(src interface{}) error {
//	bytes, ok := src.([]byte)
//	if !ok {
//		return errors.New("src value cannot cast to []byte")
//	}
//	var ret Platform.AnimeListEntry
//	err := json.Unmarshal(bytes, &ret)
//	if err != nil {
//		return err
//	}
//	*o = LocalAnimeListEntry(ret)
//	return nil
//}
//
//func (o LocalAnimeListEntry) Value() (driver.Value, error) {
//	if o.ID == 0 {
//		return nil, nil
//	}
//	return json.Marshal(o)
//}

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Local account
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
