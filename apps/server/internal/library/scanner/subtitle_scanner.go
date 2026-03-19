// Package scanner – subtitle_scanner.go
//
// Detects external subtitle and audio files alongside video files.
// Follows Jellyfin's naming convention:
//
//	{VideoName}.{language}.{flags}.{ext}
//
// Examples:
//
//	Movie.es.srt           → Spanish subtitle
//	Movie.en.forced.srt    → Forced English subtitle
//	Movie.ja.sdh.ass       → Japanese subtitle for Deaf/Hard-of-hearing
//	Movie.en.cc.vtt        → English Closed Captions
//
// Supported subtitle extensions: .srt .ass .ssa .vtt .sub .idx .sup .pgs
// Supported external audio extensions: .dts .ac3 .truehd .eac3 .thd
package scanner

import (
	"os"
	"path/filepath"
	"strings"

	"kamehouse/internal/database/models/dto"
)

// subtitleExtensions lists all recognized external subtitle file extensions.
var subtitleExtensions = map[string]struct{}{
	".srt": {}, ".ass": {}, ".ssa": {}, ".vtt": {},
	".sub": {}, ".idx": {}, ".sup": {}, ".pgs": {},
}

// externalAudioExtensions lists external audio file extensions (separate tracks).
var externalAudioExtensions = map[string]struct{}{
	".dts": {}, ".ac3": {}, ".truehd": {}, ".eac3": {}, ".thd": {},
}

// subtitleFlags are known suffix tokens that indicate special accessibility or
// playback properties. They are parsed case-insensitively.
var subtitleFlagTokens = map[string]struct{}{
	"forced":  {},
	"sdh":     {}, // Subtitles for the Deaf and Hard-of-Hearing
	"hi":      {}, // Hearing Impaired (alias for sdh)
	"cc":      {}, // Closed Captions
	"default": {},
}

// ScanExternalSubtitles discovers subtitle and external audio files in the same
// directory as a video file and returns them as structured DTOs.
//
// It mirrors Jellyfin's MediaEncoder/ExternalMediaInfoParser logic that finds
// sidecar files based on filename prefix matching.
//
// The video file's stem (name without extension) is used as the prefix to
// match companion files:
//
//	/library/Show S01E01.mkv
//	/library/Show S01E01.es.srt         ← matched
//	/library/Show S01E01.en.forced.ass  ← matched
//	/library/Other Show.en.srt          ← NOT matched (different stem)
func ScanExternalSubtitles(videoPath string) (subs []*dto.ExternalSubtitle, audios []*dto.ExternalAudioFile) {
	dir := filepath.Dir(videoPath)
	stem := strings.TrimSuffix(filepath.Base(videoPath), filepath.Ext(videoPath))

	entries, err := os.ReadDir(dir)
	if err != nil {
		return // graceful: unreadable dirs produce empty slices
	}

	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}

		name := entry.Name()
		ext := strings.ToLower(filepath.Ext(name))

		// Fast-path: skip non-subtitle, non-audio files
		_, isSub := subtitleExtensions[ext]
		_, isAudio := externalAudioExtensions[ext]
		if !isSub && !isAudio {
			continue
		}

		// Prefix match: companion file must start with the video stem
		// followed by a dot — e.g. "Movie.es.srt" starts with "Movie."
		prefix := stem + "."
		if !strings.HasPrefix(name, prefix) {
			continue
		}

		// Parse the suffix between the video stem and the extension
		// e.g. "Movie.es.forced.srt" → suffix = "es.forced"
		suffix := strings.TrimSuffix(name[len(prefix):], ext)
		tokens := splitSuffixTokens(suffix)

		fullPath := filepath.Join(dir, name)
		format := strings.TrimPrefix(ext, ".")

		if isSub {
			subs = append(subs, parseSubtitleTokens(fullPath, name, format, tokens))
		} else {
			audios = append(audios, parseAudioTokens(fullPath, name, format, tokens))
		}
	}

	return
}

// parseSubtitleTokens builds an ExternalSubtitle from the parsed suffix tokens.
// Tokens are examined: the first non-flag token is treated as the language code.
func parseSubtitleTokens(path, filename, format string, tokens []string) *dto.ExternalSubtitle {
	sub := &dto.ExternalSubtitle{
		Path:     path,
		Filename: filename,
		Format:   format,
	}

	for _, tok := range tokens {
		lower := strings.ToLower(tok)
		switch lower {
		case "forced":
			sub.IsForced = true
		case "sdh", "hi":
			sub.IsSDH = true
		case "cc":
			sub.IsCC = true
		default:
			// First unrecognized token is the language code
			if sub.Language == "" && isLikelyLanguageCode(tok) {
				sub.Language = lower
			}
		}
	}

	return sub
}

// parseAudioTokens builds an ExternalAudioFile from the parsed suffix tokens.
func parseAudioTokens(path, filename, format string, tokens []string) *dto.ExternalAudioFile {
	audio := &dto.ExternalAudioFile{
		Path:     path,
		Filename: filename,
		Format:   format,
	}

	for _, tok := range tokens {
		lower := strings.ToLower(tok)
		if _, isFlag := subtitleFlagTokens[lower]; !isFlag && isLikelyLanguageCode(tok) {
			if audio.Language == "" {
				audio.Language = lower
			}
		}
	}

	return audio
}

// splitSuffixTokens splits "es.forced.sdh" into ["es", "forced", "sdh"].
// Handles both dot and hyphen separators.
func splitSuffixTokens(suffix string) []string {
	if suffix == "" {
		return nil
	}
	// Treat hyphens as token separators (e.g. "en-US")
	suffix = strings.ReplaceAll(suffix, "-", ".")
	parts := strings.Split(suffix, ".")
	var tokens []string
	for _, p := range parts {
		if p = strings.TrimSpace(p); p != "" {
			tokens = append(tokens, p)
		}
	}
	return tokens
}

// isLikelyLanguageCode returns true if the token looks like an ISO 639-1 (2-char)
// or ISO 639-2 (3-char) language code, or a regional variant like "en-US".
// This filters out quality tokens like "1080p", "HEVC", etc.
func isLikelyLanguageCode(tok string) bool {
	l := len(tok)
	if l < 2 || l > 8 {
		return false
	}
	// Must be entirely alphabetic (after stripping any hyphen-region suffix)
	base := tok
	if idx := strings.Index(tok, "."); idx > 0 {
		base = tok[:idx]
	}
	for _, r := range base {
		if !((r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z')) {
			return false
		}
	}
	return true
}
