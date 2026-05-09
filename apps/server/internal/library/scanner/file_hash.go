package scanner

import (
	"context"
	"encoding/binary"
	"fmt"
	"io"
	"os"
	"runtime"
	"sync"

	"kamehouse/internal/database/models/dto"

	"github.com/rs/zerolog"
)

const openSubtitlesHashChunkSize int64 = 64 * 1024

// StartFileHashing calculates OpenSubtitles-compatible hashes in the background.
// It is intentionally I/O-light: each file reads only the first and last 64 KiB.
func StartFileHashing(ctx context.Context, files []*dto.LocalFile, logger *zerolog.Logger) <-chan struct{} {
	done := make(chan struct{})
	go func() {
		defer close(done)
		if len(files) == 0 {
			return
		}

		workers := runtime.NumCPU() / 2
		if workers < 1 {
			workers = 1
		}
		if workers > 4 {
			workers = 4
		}

		jobs := make(chan *dto.LocalFile)
		wg := sync.WaitGroup{}
		for i := 0; i < workers; i++ {
			wg.Add(1)
			go func() {
				defer wg.Done()
				for lf := range jobs {
					if lf == nil || lf.FileHash != "" {
						continue
					}
					select {
					case <-ctx.Done():
						return
					default:
					}

					hash, err := CalculateOpenSubtitlesHash(lf.Path)
					if err != nil {
						if logger != nil {
							logger.Debug().Err(err).Str("path", lf.Path).Msg("scanner: file hash unavailable")
						}
						continue
					}
					lf.FileHash = hash
				}
			}()
		}

		for _, lf := range files {
			select {
			case <-ctx.Done():
				close(jobs)
				wg.Wait()
				return
			case jobs <- lf:
			}
		}
		close(jobs)
		wg.Wait()
	}()
	return done
}

func CalculateOpenSubtitlesHash(path string) (string, error) {
	file, err := os.Open(path)
	if err != nil {
		return "", err
	}
	defer file.Close()

	info, err := file.Stat()
	if err != nil {
		return "", err
	}

	size := info.Size()
	hash := uint64(size)

	first, err := readHashChunk(file, 0)
	if err != nil {
		return "", err
	}
	hash += sumUint64LE(first)

	if size > openSubtitlesHashChunkSize {
		lastOffset := size - openSubtitlesHashChunkSize
		last, err := readHashChunk(file, lastOffset)
		if err != nil {
			return "", err
		}
		hash += sumUint64LE(last)
	}

	return fmt.Sprintf("%016x", hash), nil
}

func readHashChunk(file *os.File, offset int64) ([]byte, error) {
	if _, err := file.Seek(offset, io.SeekStart); err != nil {
		return nil, err
	}

	buf := make([]byte, openSubtitlesHashChunkSize)
	n, err := io.ReadFull(file, buf)
	if err != nil && err != io.EOF && err != io.ErrUnexpectedEOF {
		return nil, err
	}
	return buf[:n], nil
}

func sumUint64LE(buf []byte) uint64 {
	var sum uint64
	for len(buf) >= 8 {
		sum += binary.LittleEndian.Uint64(buf[:8])
		buf = buf[8:]
	}
	return sum
}
