package models

func (s *Settings) GetLibrary() *LibrarySettings {
	if s == nil {
		return &LibrarySettings{}
	}
	return &s.Library
}
