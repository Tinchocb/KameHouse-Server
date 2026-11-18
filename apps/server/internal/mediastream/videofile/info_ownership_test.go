package videofile

import (
	"context"
	"os/exec"
	"path/filepath"
	"sync/atomic"
	"testing"
	"time"

	"github.com/rs/zerolog"
	"github.com/stretchr/testify/require"
	"kamehouse/internal/util/filecache"
)

func TestExtractorReturnsOwnedInfo(t *testing.T) {
	cacher, err := filecache.NewCacher(t.TempDir())
	require.NoError(t, err)
	defer cacher.Close()
	logger := zerolog.Nop()
	e := NewMediaInfoExtractor(cacher, &logger)
	defer e.Close()
	text := "original"
	source := &MediaInfo{MimeCodec: &text, Container: &text, Videos: []Video{{Codec: "hevc", MimeCodec: &text, Language: &text}}, Audios: []Audio{{Title: &text, Language: &text, MimeCodec: &text}}, Subtitles: []Subtitle{{Title: &text, Language: &text, Extension: &text, Link: &text}}, Fonts: []string{"original"}, Chapters: []Chapter{{Name: "original"}}}
	source.Video = &source.Videos[0]
	e.probe = func(context.Context, string, string, string) (*MediaInfo, error) { return source, nil }
	first, err := e.GetInfoContext(t.Context(), "unused", "http://fixture.invalid/ownership.mkv")
	require.NoError(t, err)
	*first.MimeCodec = "changed"
	first.Video.Codec = "changed"
	first.Audios[0].Codec = "changed"
	*first.Subtitles[0].Link = "changed"
	first.Fonts[0] = "changed"
	first.Chapters[0].Name = "changed"
	next, err := e.GetInfoContext(t.Context(), "unused", "http://fixture.invalid/ownership.mkv")
	require.NoError(t, err)
	require.Equal(t, "original", *next.MimeCodec)
	require.Equal(t, "hevc", next.Video.Codec)
	require.Empty(t, next.Audios[0].Codec)
	require.Equal(t, "original", *next.Subtitles[0].Link)
	require.Equal(t, "original", next.Fonts[0])
	require.Equal(t, "original", next.Chapters[0].Name)
	require.Same(t, &next.Videos[0], next.Video, "preserve the selected-video alias within the owned result")
}

func TestSharedProbeInfoIsOwnedAndRepairDoesNotMutateCache(t *testing.T) {
	cacher, err := filecache.NewCacher(t.TempDir())
	require.NoError(t, err)
	defer cacher.Close()
	logger := zerolog.Nop()
	e := NewMediaInfoExtractor(cacher, &logger)
	defer e.Close()
	old := "hvc1.1.4.L96.BO"
	title := "Original"
	source := &MediaInfo{Video: &Video{Codec: "hevc", PixFmt: "yuv420p10le", MimeCodec: &old}, Audios: []Audio{{Title: &title}}}
	release := make(chan struct{})
	var calls atomic.Int32
	e.probe = func(context.Context, string, string, string) (*MediaInfo, error) {
		calls.Add(1)
		<-release
		return source, nil
	}
	const count = 16
	contexts := make([]*extractorWaitingContext, count)
	results := make(chan *MediaInfo, count)
	for i := range contexts {
		contexts[i] = &extractorWaitingContext{Context: context.Background(), waiting: make(chan struct{})}
		go func(i int) {
			mi, err := e.GetInfoContext(contexts[i], "unused", "http://fixture.invalid/shared.mkv")
			if err != nil {
				t.Error(err)
			}
			results <- mi
		}(i)
	}
	for _, ctx := range contexts {
		<-ctx.waiting
	}
	close(release)
	var received []*MediaInfo
	for range count {
		received = append(received, <-results)
	}
	require.Equal(t, int32(1), calls.Load())
	for _, mi := range received {
		require.NotNil(t, mi)
		require.Equal(t, "hvc1.2.4.L150.B0", *mi.Video.MimeCodec)
	}
	*received[0].Audios[0].Title = "Changed"
	for _, mi := range received[1:] {
		require.Equal(t, "Original", *mi.Audios[0].Title)
	}
	require.Equal(t, "Original", *source.Audios[0].Title)
	require.Equal(t, "hvc1.1.4.L96.BO", *source.Video.MimeCodec)
}

var ownedInfoBenchmark *MediaInfo

func BenchmarkOwnedMediaInfoCopy(b *testing.B) {
	text := "codec or language"
	source := &MediaInfo{Videos: []Video{{MimeCodec: &text, Language: &text}}, MimeCodec: &text, Container: &text, Audios: make([]Audio, 6), Subtitles: make([]Subtitle, 8), Fonts: []string{"font1", "font2"}, Chapters: make([]Chapter, 20)}
	source.Video = &source.Videos[0]
	for i := range source.Audios {
		source.Audios[i] = Audio{Title: &text, Language: &text, MimeCodec: &text}
	}
	for i := range source.Subtitles {
		source.Subtitles[i] = Subtitle{Title: &text, Language: &text, Extension: &text, Link: &text}
	}
	b.ReportAllocs()
	b.ResetTimer()
	for range b.N {
		ownedInfoBenchmark = cloneMediaInfo(source)
	}
}

func TestExtractorRealProbeCacheIsolation(t *testing.T) {
	ffmpeg, err := exec.LookPath("ffmpeg")
	if err != nil {
		t.Skip("ffmpeg unavailable")
	}
	ffprobe, err := exec.LookPath("ffprobe")
	if err != nil {
		t.Skip("ffprobe unavailable")
	}
	dir := t.TempDir()
	path := filepath.Join(dir, "source.mp4")
	ctx, cancel := context.WithTimeout(t.Context(), 15*time.Second)
	defer cancel()
	out, err := exec.CommandContext(ctx, ffmpeg, "-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i", "testsrc2=size=160x90:rate=24", "-t", "2", "-c:v", "libx264", "-preset", "ultrafast", path).CombinedOutput()
	require.NoError(t, err, string(out))
	cacher, err := filecache.NewCacher(filepath.Join(dir, "cache"))
	require.NoError(t, err)
	defer cacher.Close()
	logger := zerolog.Nop()
	e := NewMediaInfoExtractor(cacher, &logger)
	defer e.Close()
	var calls atomic.Int32
	e.probe = func(ctx context.Context, bin, path, hash string) (*MediaInfo, error) {
		calls.Add(1)
		return FfprobeGetInfoContext(ctx, bin, path, hash)
	}
	first, err := e.GetInfoContext(ctx, ffprobe, path)
	require.NoError(t, err)
	require.NotNil(t, first.Video)
	wantCodec := first.Video.Codec
	first.Video.Codec = "consumer modification"
	second, err := e.GetInfoContext(ctx, ffprobe, path)
	require.NoError(t, err)
	require.Equal(t, wantCodec, second.Video.Codec)
	require.Positive(t, second.Duration)
	require.Equal(t, int32(1), calls.Load(), "owned copies must not require another ffprobe")
}

func TestExtractorIgnoresNullCachedInfo(t *testing.T) {
	cacher, err := filecache.NewCacher(t.TempDir())
	require.NoError(t, err)
	defer cacher.Close()
	path := "http://fixture.invalid/null.mkv"
	hash, err := GetHashFromPath(path)
	require.NoError(t, err)
	require.NoError(t, cacher.Set(filecache.NewBucket(MediaInfoBucketName, time.Hour), hash, (*MediaInfo)(nil)))
	logger := zerolog.Nop()
	e := NewMediaInfoExtractor(cacher, &logger)
	defer e.Close()
	calls := 0
	e.probe = func(context.Context, string, string, string) (*MediaInfo, error) {
		calls++
		return &MediaInfo{Duration: 24}, nil
	}
	got, err := e.GetInfoContext(t.Context(), "unused", path)
	require.NoError(t, err)
	require.NotNil(t, got)
	require.Equal(t, float32(24), got.Duration)
	require.Equal(t, 1, calls)
}

func TestOwnedInfoPreservesEmptySlicesAndDetachedVideo(t *testing.T) {
	require.Nil(t, cloneMediaInfo(nil))
	codec := "avc1.fixture"
	source := &MediaInfo{Video: &Video{MimeCodec: &codec}, Audios: []Audio{}}
	copy := cloneMediaInfo(source)
	require.Nil(t, copy.Videos)
	require.Nil(t, copy.Subtitles)
	require.NotNil(t, copy.Audios)
	require.NotSame(t, source.Video, copy.Video)
	*copy.Video.MimeCodec = "changed"
	require.Equal(t, "avc1.fixture", *source.Video.MimeCodec)
}
