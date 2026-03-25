package videofile

import (
	"crypto/sha1"
	"encoding/hex"
	"os"
	"strings"
)

func GetHashFromPath(path string) (string, error) {
	if strings.HasPrefix(path, "http://") || strings.HasPrefix(path, "https://") {
		h := sha1.New()
		h.Write([]byte(path))
		return hex.EncodeToString(h.Sum(nil)), nil
	}
	info, err := os.Stat(path)
	if err != nil {
		return "", err
	}
	h := sha1.New()
	h.Write([]byte(path))
	h.Write([]byte(info.ModTime().String()))
	sha := hex.EncodeToString(h.Sum(nil))
	return sha, nil
}
