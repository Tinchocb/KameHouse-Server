//go:build !windows

package ffmpegutil

func resolveToolExecutable(path string) string { return path }
