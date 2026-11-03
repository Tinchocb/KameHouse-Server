package dto

import (
	"reflect"
	"testing"
	"time"
)

func TestLocalFileCloneOwnsNestedMetadata(t *testing.T) {
	season, episode := 2, 3
	parsed := &LocalFileParsedData{SeasonRange: []string{"1"}, PartRange: []string{"2"}, EpisodeRange: []string{"3"}}
	original := &LocalFile{
		Path: "original.mkv", ParsedData: parsed,
		ParsedFolderData: []*LocalFileParsedData{parsed, nil},
		EmbeddedMetadata: &LocalFileEmbeddedMetadata{Season: &season, Episode: &episode},
		Metadata:         &LocalFileMetadata{Episodes: []int{3}},
		TechnicalInfo: &FileTechnicalInfo{
			Duration: 123456789 * time.Nanosecond, ProbeVerified: true,
			VideoStream:        &VideoStreamInfo{Codec: "hevc"},
			AudioStreams:       []*AudioStreamInfo{{Codec: "aac"}, nil},
			SubtitleStreams:    []*AudioStreamInfo{{Language: "es"}},
			ExternalSubtitles:  []*ExternalSubtitle{{Filename: "original.srt"}},
			ExternalAudioFiles: []*ExternalAudioFile{{Filename: "original.ac3"}},
		},
	}
	copy := original.Clone()
	if !reflect.DeepEqual(original, copy) {
		t.Fatal("clone changed metadata or duration precision")
	}
	copy.Path = "changed"
	copy.ParsedData.SeasonRange[0] = "changed"
	copy.ParsedData.PartRange[0] = "changed"
	copy.ParsedData.EpisodeRange[0] = "changed"
	copy.ParsedFolderData[0].SeasonRange[0] = "changed"
	copy.ParsedFolderData[0].PartRange[0] = "changed"
	copy.ParsedFolderData[0].EpisodeRange[0] = "changed"
	*copy.EmbeddedMetadata.Season = 99
	*copy.EmbeddedMetadata.Episode = 99
	copy.Metadata.Episodes[0] = 99
	copy.TechnicalInfo.Duration = 0
	copy.TechnicalInfo.ProbeVerified = false
	copy.TechnicalInfo.VideoStream.Codec = "changed"
	copy.TechnicalInfo.AudioStreams[0].Codec = "changed"
	copy.TechnicalInfo.SubtitleStreams[0].Language = "changed"
	copy.TechnicalInfo.ExternalSubtitles[0].Filename = "changed"
	copy.TechnicalInfo.ExternalAudioFiles[0].Filename = "changed"
	if original.Path != "original.mkv" || parsed.SeasonRange[0] != "1" || parsed.PartRange[0] != "2" || parsed.EpisodeRange[0] != "3" ||
		season != 2 || episode != 3 || original.Metadata.Episodes[0] != 3 ||
		original.TechnicalInfo.Duration != 123456789 || !original.TechnicalInfo.ProbeVerified ||
		original.TechnicalInfo.VideoStream.Codec != "hevc" || original.TechnicalInfo.AudioStreams[0].Codec != "aac" ||
		original.TechnicalInfo.SubtitleStreams[0].Language != "es" ||
		original.TechnicalInfo.ExternalSubtitles[0].Filename != "original.srt" || original.TechnicalInfo.ExternalAudioFiles[0].Filename != "original.ac3" {
		t.Fatal("mutating clone changed original metadata")
	}
}

func TestLocalFileClonePreservesNilAndEmpty(t *testing.T) {
	var file *LocalFile
	if file.Clone() != nil {
		t.Fatal("nil file must stay nil")
	}
	for _, original := range []*LocalFile{{}, {
		ParsedFolderData: []*LocalFileParsedData{},
		ParsedData:       &LocalFileParsedData{SeasonRange: []string{}},
		TechnicalInfo:    &FileTechnicalInfo{AudioStreams: []*AudioStreamInfo{}},
	}} {
		if !reflect.DeepEqual(original, original.Clone()) {
			t.Fatal("nil/empty metadata changed")
		}
	}
}
