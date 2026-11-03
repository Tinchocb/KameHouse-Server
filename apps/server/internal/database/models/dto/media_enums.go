package dto

type MediaFormat string

const (
	MediaFormatTV      MediaFormat = "TV"
	MediaFormatMovie   MediaFormat = "MOVIE"
	MediaFormatSpecial MediaFormat = "SPECIAL"
	MediaFormatOVA     MediaFormat = "OVA"
	MediaFormatMusic   MediaFormat = "MUSIC"
)

type MediaStatus string

const (
	MediaStatusFinished       MediaStatus = "FINISHED"
	MediaStatusReleasing      MediaStatus = "RELEASING"
	MediaStatusNotYetReleased MediaStatus = "NOT_YET_RELEASED"
	MediaStatusCancelled      MediaStatus = "CANCELLED"
	MediaStatusHiatus         MediaStatus = "HIATUS"
)

type MediaSeason string
