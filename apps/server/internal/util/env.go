package util

import (
	"os"
	"path/filepath"

	"github.com/subosito/gotenv"
)

// LoadDotEnvFile searches for a .env file starting from the current working
// directory and the executable's directory, walking up to 6 parent directories
// from each. The first .env file found is loaded; subsequent ones are ignored.
//
// This lookup strategy is necessary because `go run` sets CWD to a temporary
// build directory that is unrelated to the project root.
func LoadDotEnvFile() {
	candidates := make([]string, 0, 12)

	if cwd, err := os.Getwd(); err == nil {
		dir := cwd
		for i := 0; i < 6; i++ {
			candidates = append(candidates, dir)
			parent := filepath.Dir(dir)
			if parent == dir {
				break
			}
			dir = parent
		}
	}

	if exe, err := os.Executable(); err == nil {
		dir := filepath.Dir(exe)
		for i := 0; i < 6; i++ {
			candidates = append(candidates, dir)
			parent := filepath.Dir(dir)
			if parent == dir {
				break
			}
			dir = parent
		}
	}

	for _, dir := range candidates {
		envPath := filepath.Join(dir, ".env")
		if _, err := os.Stat(envPath); err == nil {
			_ = gotenv.OverLoad(envPath)
			return
		}
	}
}
