package dto

import "slices"

// Clone returns an independent file, including all nested mutable metadata.
func (lf *LocalFile) Clone() *LocalFile {
	if lf == nil {
		return nil
	}
	copy := *lf
	copy.ParsedData = cloneParsedData(lf.ParsedData)
	if lf.ParsedFolderData != nil {
		copy.ParsedFolderData = make([]*LocalFileParsedData, len(lf.ParsedFolderData))
		for i, folder := range lf.ParsedFolderData {
			copy.ParsedFolderData[i] = cloneParsedData(folder)
		}
	}
	copy.EmbeddedMetadata = cloneValue(lf.EmbeddedMetadata)
	if copy.EmbeddedMetadata != nil {
		copy.EmbeddedMetadata.Season = cloneValue(lf.EmbeddedMetadata.Season)
		copy.EmbeddedMetadata.Episode = cloneValue(lf.EmbeddedMetadata.Episode)
	}
	copy.Metadata = cloneValue(lf.Metadata)
	if copy.Metadata != nil {
		copy.Metadata.Episodes = slices.Clone(lf.Metadata.Episodes)
	}
	copy.TechnicalInfo = cloneValue(lf.TechnicalInfo)
	if copy.TechnicalInfo != nil {
		copy.TechnicalInfo.VideoStream = cloneValue(lf.TechnicalInfo.VideoStream)
		copy.TechnicalInfo.AudioStreams = cloneValues(lf.TechnicalInfo.AudioStreams)
		copy.TechnicalInfo.SubtitleStreams = cloneValues(lf.TechnicalInfo.SubtitleStreams)
		copy.TechnicalInfo.ExternalSubtitles = cloneValues(lf.TechnicalInfo.ExternalSubtitles)
		copy.TechnicalInfo.ExternalAudioFiles = cloneValues(lf.TechnicalInfo.ExternalAudioFiles)
	}
	return &copy
}

func cloneParsedData(data *LocalFileParsedData) *LocalFileParsedData {
	copy := cloneValue(data)
	if copy != nil {
		copy.SeasonRange = slices.Clone(data.SeasonRange)
		copy.PartRange = slices.Clone(data.PartRange)
		copy.EpisodeRange = slices.Clone(data.EpisodeRange)
	}
	return copy
}

func cloneValue[T any](value *T) *T {
	if value == nil {
		return nil
	}
	copy := *value
	return &copy
}

// cloneValues is for records containing only value fields.
func cloneValues[T any](values []*T) []*T {
	if values == nil {
		return nil
	}
	copy := make([]*T, len(values))
	for i, value := range values {
		copy[i] = cloneValue(value)
	}
	return copy
}
