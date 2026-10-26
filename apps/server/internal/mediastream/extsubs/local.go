package extsubs

import (
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
)

// localSubDirs son las subcarpetas donde las releases suelen dejar los subtítulos.
var localSubDirs = []string{"Subs", "Sub", "Subtitles", "Subtitulos", "Subtítulos"}

// LocalSources busca junto a un video local los subtítulos externos que le
// corresponden: en su carpeta, en `Subs/` y en `Subs/<nombre del video>/`.
func LocalSources(videoPath string) []Source {
	videoDir := filepath.Dir(videoPath)
	videoName := filepath.Base(videoPath)
	base := strings.TrimSuffix(videoName, filepath.Ext(videoName))

	dirs := []string{videoDir}
	for _, sub := range localSubDirs {
		dirs = append(dirs, filepath.Join(videoDir, sub), filepath.Join(videoDir, sub, base))
	}

	var out []Source
	seen := map[string]bool{}
	for _, dir := range dirs {
		entries, err := os.ReadDir(dir)
		if err != nil {
			continue
		}
		var names []string
		for _, e := range entries {
			if !e.IsDir() {
				names = append(names, e.Name())
			}
		}
		for _, cand := range MatchVideo(videoName, names) {
			full := filepath.Join(dir, cand.Name)
			// En sistemas sin distinción de mayúsculas, "Subs" y "subs" son la misma carpeta.
			norm := strings.ToLower(full)
			if seen[norm] {
				continue
			}
			seen[norm] = true
			key := ""
			if info, err := os.Stat(full); err == nil {
				key = fmt.Sprintf("%d:%d", info.ModTime().UnixNano(), info.Size())
			}
			out = append(out, Source{
				Candidate: cand,
				Key:       key,
				Read:      func() ([]byte, error) { return readCapped(full) },
			})
		}
	}
	if len(out) > maxPerVideo {
		out = out[:maxPerVideo]
	}
	return out
}

func readCapped(path string) ([]byte, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer f.Close()
	return ReadCapped(f)
}

// ReadCapped lee hasta MaxFileSize+1 bytes: si el resultado supera MaxFileSize, el
// llamador lo descarta como demasiado grande.
func ReadCapped(r io.Reader) ([]byte, error) {
	return io.ReadAll(io.LimitReader(r, MaxFileSize+1))
}
