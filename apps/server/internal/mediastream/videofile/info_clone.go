package videofile

import "slices"

// Cached info is immutable. Every consumer owns its nested slices and pointers,
// including when several callers receive the same singleflight result.
func cloneMediaInfo(info *MediaInfo) *MediaInfo {
	if info == nil {
		return nil
	}
	copy := *info
	// Pack owned strings into one backing array instead of allocating each
	// optional field separately. Pointers remain independent within the copy.
	strings := mediaInfoStrings{capacity: 4 + 2*len(info.Videos) + 3*len(info.Audios) + 4*len(info.Subtitles)}
	copy.MimeCodec = strings.copy(info.MimeCodec)
	copy.Container = strings.copy(info.Container)
	copy.Videos = slices.Clone(info.Videos)
	for i := range copy.Videos {
		copy.Videos[i] = cloneVideoInfo(info.Videos[i], &strings)
	}
	if info.Video != nil {
		copy.Video = nil
		for i := range info.Videos {
			if info.Video == &info.Videos[i] {
				copy.Video = &copy.Videos[i]
				break
			}
		}
		if copy.Video == nil {
			video := cloneVideoInfo(*info.Video, &strings)
			copy.Video = &video
		}
	}
	copy.Audios = slices.Clone(info.Audios)
	for i := range copy.Audios {
		copy.Audios[i].Title = strings.copy(info.Audios[i].Title)
		copy.Audios[i].Language = strings.copy(info.Audios[i].Language)
		copy.Audios[i].MimeCodec = strings.copy(info.Audios[i].MimeCodec)
	}
	copy.Subtitles = slices.Clone(info.Subtitles)
	for i := range copy.Subtitles {
		copy.Subtitles[i].Title = strings.copy(info.Subtitles[i].Title)
		copy.Subtitles[i].Language = strings.copy(info.Subtitles[i].Language)
		copy.Subtitles[i].Extension = strings.copy(info.Subtitles[i].Extension)
		copy.Subtitles[i].Link = strings.copy(info.Subtitles[i].Link)
	}
	copy.Fonts = slices.Clone(info.Fonts)
	copy.Chapters = slices.Clone(info.Chapters)
	return &copy
}

func cloneVideoInfo(video Video, strings *mediaInfoStrings) Video {
	video.MimeCodec = strings.copy(video.MimeCodec)
	video.Language = strings.copy(video.Language)
	return video
}

type mediaInfoStrings struct {
	values         []string
	capacity, used int
}

func (s *mediaInfoStrings) copy(value *string) *string {
	if value == nil {
		return nil
	}
	if s.values == nil {
		s.values = make([]string, s.capacity)
	}
	i := s.used
	s.values[i] = *value
	s.used++
	return &s.values[i]
}
