// Package pretranscode converts library files to a static HLS ladder ahead of
// playback, so opening an episode that would otherwise need a live transcode
// starts instantly and costs no CPU/GPU at watch time.
//
// It complements the live transcoder (package cassette) rather than replacing
// it: the output lands in the same layout the "optimized" stream type already
// serves (<outputDir>/<hash>/master.m3u8), so a pre-transcoded file is picked up
// by the existing playback path with no extra plumbing.
package pretranscode

import (
	"bufio"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"

	"kamehouse/internal/mediastream/cassette"
	"kamehouse/internal/mediastream/videofile"
	"kamehouse/internal/util/resourcebudget"

	"github.com/rs/zerolog"
)

type JobStatus string

const (
	StatusQueued    JobStatus = "queued"
	StatusRunning   JobStatus = "running"
	StatusCompleted JobStatus = "completed"
	StatusFailed    JobStatus = "failed"
)

// segmentDuration is the target HLS segment length. 6s is the usual VOD
// tradeoff: long enough to keep the playlist small, short enough to seek well.
const segmentDuration = 6

// PreTranscodeJob is one file's pre-transcode, tracked from queue to completion.
type PreTranscodeJob struct {
	Hash     string     `json:"hash"`
	FilePath string     `json:"filePath"`
	Status   JobStatus  `json:"status"`
	Progress float64    `json:"progress"` // 0-100
	Error    string     `json:"error,omitempty"`
	QueuedAt time.Time  `json:"queuedAt"`
	EndedAt  *time.Time `json:"endedAt,omitempty"`

	cancel    context.CancelFunc
	done      chan struct{}
	cancelled bool
}

// Options configures a Manager. All fields are required except Concurrency.
type Options struct {
	Logger    *zerolog.Logger
	OutputDir string
	// FfmpegPath/FfprobePath come from the user's mediastream settings.
	FfmpegPath  string
	FfprobePath string
	// HwAccel mirrors Settings → Streaming so pre-transcodes use the same
	// encoder the live transcoder would.
	HwAccel cassette.HwAccelOptions
	// Concurrency caps simultaneous ffmpeg processes. <= 0 means 1: pre-transcode
	// is background work and must not starve a live playback transcode.
	Concurrency int
	// Extractor probes duration for progress reporting.
	Extractor *videofile.MediaInfoExtractor
}

// Manager owns the pre-transcode queue and its workers.
type Manager struct {
	opts   Options
	logger *zerolog.Logger

	mu   sync.RWMutex
	jobs map[string]*PreTranscodeJob // by hash

	queue chan *PreTranscodeJob

	deleteMu sync.Mutex
	deleting map[string]bool
	workers  sync.WaitGroup

	startOnce sync.Once
	stopCh    chan struct{}
}

func New(opts Options) *Manager {
	if opts.Concurrency <= 0 {
		opts.Concurrency = 1
	}
	return &Manager{
		opts:     opts,
		logger:   opts.Logger,
		jobs:     make(map[string]*PreTranscodeJob),
		queue:    make(chan *PreTranscodeJob, 256),
		deleting: make(map[string]bool),
		stopCh:   make(chan struct{}),
	}
}

// QueueLength returns the number of jobs currently in the queue.
func (m *Manager) QueueLength() int {
	return len(m.queue)
}

// Start launches the workers. Safe to call more than once.
func (m *Manager) Start() {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.stopped() {
		return
	}
	m.startOnce.Do(func() {
		for i := 0; i < m.opts.Concurrency; i++ {
			m.workers.Add(1)
			go func() { defer m.workers.Done(); m.worker() }()
		}
		m.logger.Info().Int("workers", m.opts.Concurrency).Str("outputDir", m.opts.OutputDir).Msg("pretranscode: Started")
	})
}

// Stop cancels jobs and waits for process/file cleanup before a replacement can start.
func (m *Manager) Stop() {
	m.mu.Lock()
	if !m.stopped() {
		close(m.stopCh)
	}
	var cancels []context.CancelFunc
	var done []chan struct{}
	for _, job := range m.jobs {
		if job.cancel != nil {
			cancels = append(cancels, job.cancel)
			done = append(done, job.done)
		}
		if job.Status == StatusQueued || job.Status == StatusRunning {
			job.cancelled = true
			job.Status, job.Error = StatusFailed, "cancelled"
		}
	}
	m.mu.Unlock()
	for _, cancel := range cancels {
		cancel()
	}
	for _, finished := range done {
		<-finished
	}
	m.workers.Wait()
}

func (m *Manager) stopped() bool {
	select {
	case <-m.stopCh:
		return true
	default:
		return false
	}
}

// OutputDirFor returns the directory holding a file's pre-transcoded HLS.
func (m *Manager) OutputDirFor(hash string) string {
	return filepath.Join(m.opts.OutputDir, hash)
}

// IsAvailable reports whether a finished pre-transcode exists on disk for the
// given file. This is the check the playback path uses to prefer the optimized
// stream over a live transcode.
func (m *Manager) IsAvailable(hash string) bool {
	_, err := os.Stat(filepath.Join(m.OutputDirFor(hash), "master.m3u8"))
	return err == nil
}

// Ready reports whether the pre-transcode of hash can stand in for the live transcode
// of a file with audioTracks audio tracks. Output built before the audio renditions
// existed holds one track only, so it is not ready for a file with several.
func (m *Manager) Ready(hash string, audioTracks int) bool {
	if !m.IsAvailable(hash) {
		return false
	}
	if audioTracks <= 1 {
		return true
	}
	_, err := os.Stat(filepath.Join(m.OutputDirFor(hash), fmt.Sprintf("a%d", audioTracks-1), "index.m3u8"))
	return err == nil
}

// Enqueue schedules a file for pre-transcoding. It is idempotent: an already
// pre-transcoded file, or one already queued/running, returns its existing job
// without starting duplicate work.
func (m *Manager) Enqueue(filePath string) (*PreTranscodeJob, error) {
	if m.opts.FfmpegPath == "" {
		return nil, errors.New("ffmpeg path is not configured")
	}

	hash, err := videofile.GetHashFromPath(filePath)
	if err != nil {
		return nil, fmt.Errorf("could not hash %q: %w", filePath, err)
	}

	m.mu.Lock()
	defer m.mu.Unlock()
	if m.stopped() {
		return nil, errors.New("pre-transcode manager is stopped")
	}
	if m.deleting[hash] {
		return nil, errors.New("pre-transcode output is being deleted")
	}

	if existing, ok := m.jobs[hash]; ok {
		if existing.done != nil && existing.Status == StatusFailed {
			select {
			case <-existing.done:
			default:
				return nil, errors.New("previous pre-transcode is still stopping")
			}
		}
		switch existing.Status {
		case StatusQueued, StatusRunning, StatusCompleted:
			return jobSnapshot(existing), nil
		}
		// A failed job is retried below.
	}

	// Already on disk from a previous run: record it as done rather than redoing it.
	// Output from before the audio renditions is rebuilt for a file with several tracks.
	if m.IsAvailable(hash) {
		streams, probeErr := probeStreams(context.Background(), m.opts.FfprobePath, filePath)
		if probeErr != nil || m.Ready(hash, len(streams.Audio)) {
			job := &PreTranscodeJob{Hash: hash, FilePath: filePath, Status: StatusCompleted, Progress: 100, QueuedAt: time.Now()}
			m.jobs[hash] = job
			return jobSnapshot(job), nil
		}
		_ = os.RemoveAll(m.OutputDirFor(hash))
	}

	job := &PreTranscodeJob{Hash: hash, FilePath: filePath, Status: StatusQueued, QueuedAt: time.Now()}
	m.jobs[hash] = job

	select {
	case m.queue <- job:
	default:
		delete(m.jobs, hash)
		return nil, errors.New("pre-transcode queue is full")
	}

	m.logger.Debug().Str("filepath", filePath).Str("hash", hash).Msg("pretranscode: Job queued")
	return jobSnapshot(job), nil
}

// Cancel stops a queued or running job and discards its partial output.
func (m *Manager) Cancel(hash string) bool {
	m.mu.Lock()
	job := m.jobs[hash]
	if job == nil || (job.Status != StatusQueued && job.Status != StatusRunning) {
		m.mu.Unlock()
		return false
	}
	job.cancelled = true
	job.Status, job.Error = StatusFailed, "cancelled"
	cancel := job.cancel
	m.mu.Unlock()
	if cancel != nil {
		cancel()
	}
	return true
}

func jobSnapshot(job *PreTranscodeJob) *PreTranscodeJob {
	copy := *job
	copy.cancel, copy.done = nil, nil
	if job.EndedAt != nil {
		endedAt := *job.EndedAt
		copy.EndedAt = &endedAt
	}
	return &copy
}

// Jobs returns a snapshot of every tracked job.
func (m *Manager) Jobs() []*PreTranscodeJob {
	m.mu.RLock()
	defer m.mu.RUnlock()

	out := make([]*PreTranscodeJob, 0, len(m.jobs))
	for _, j := range m.jobs {
		out = append(out, jobSnapshot(j))
	}
	return out
}

// Delete removes a file's pre-transcoded output and forgets its job.
func (m *Manager) Delete(hash string) error {
	if !ValidHash(hash) {
		return errors.New("invalid pre-transcode hash")
	}
	m.deleteMu.Lock()
	defer m.deleteMu.Unlock()
	// Root confines recursive removal even if entries are replaced with symlinks.
	root, err := os.OpenRoot(m.opts.OutputDir)
	if err != nil && !os.IsNotExist(err) {
		return err
	}
	if root != nil {
		defer root.Close()
	}
	m.mu.Lock()
	m.deleting[hash] = true
	m.mu.Unlock()
	defer func() { m.mu.Lock(); delete(m.deleting, hash); m.mu.Unlock() }()
	m.Cancel(hash)
	m.mu.RLock()
	var done chan struct{}
	if job := m.jobs[hash]; job != nil {
		done = job.done
	}
	m.mu.RUnlock()
	if done != nil {
		<-done
	}

	m.mu.Lock()
	delete(m.jobs, hash)
	m.mu.Unlock()

	if root == nil {
		return nil
	}
	return root.RemoveAll(hash)
}

// ValidHash accepts only the SHA-1 identifiers produced by videofile.GetHashFromPath.
func ValidHash(hash string) bool {
	if len(hash) != 40 {
		return false
	}
	for _, ch := range hash {
		if !(ch >= '0' && ch <= '9' || ch >= 'a' && ch <= 'f' || ch >= 'A' && ch <= 'F') {
			return false
		}
	}
	return true
}

func (m *Manager) worker() {
	for {
		select {
		case <-m.stopCh:
			return
		case job := <-m.queue:
			// With stopCh closed and jobs queued, select picks either case at random.
			if m.stopped() {
				return
			}
			// Cancel() may have marked it failed while it sat in the queue.
			m.mu.RLock()
			skip := job.Status != StatusQueued
			m.mu.RUnlock()
			if skip {
				continue
			}
			m.run(job)
		}
	}
}

func (m *Manager) run(job *PreTranscodeJob) {
	m.runWith(job, m.transcode)
}

func (m *Manager) runWith(job *PreTranscodeJob, encode func(context.Context, *PreTranscodeJob) error) {
	// Claim the exact queued job and register cancellation in one transition.
	m.mu.Lock()
	if m.stopped() || m.deleting[job.Hash] || m.jobs[job.Hash] != job || job.Status != StatusQueued || job.done != nil {
		m.mu.Unlock()
		return
	}
	ctx, cancel := context.WithCancel(context.Background())
	job.cancel, job.done = cancel, make(chan struct{})
	m.mu.Unlock()

	defer func() {
		cancel()
		m.mu.Lock()
		job.cancel = nil
		close(job.done)
		m.mu.Unlock()
	}()

	var err error
	for {
		m.setStatus(job.Hash, StatusQueued, 0)
		workCtx, release, acquireErr := resourcebudget.Shared.Background(ctx)
		if acquireErr != nil {
			err = acquireErr
			break
		}
		m.setStatus(job.Hash, StatusRunning, 0)
		m.logger.Info().Str("filepath", job.FilePath).Msg("pretranscode: Started")
		err = encode(workCtx, job)
		interrupted := errors.Is(context.Cause(workCtx), resourcebudget.ErrPlaybackPriority)
		release() // transcode has waited for FFmpeg and removed its temporary files.
		if err != nil && interrupted && ctx.Err() == nil {
			m.logger.Info().Str("filepath", job.FilePath).Msg("pretranscode: Yielding to playback; will retry when idle")
			continue
		}
		break
	}

	if ctx.Err() != nil {
		err = ctx.Err()
	}
	now := time.Now()
	if err != nil {
		// A cancel is a user action, not a failure to report loudly.
		if ctx.Err() != nil {
			m.logger.Info().Str("filepath", job.FilePath).Msg("pretranscode: Cancelled")
			_ = os.RemoveAll(m.OutputDirFor(job.Hash))
			m.finish(job.Hash, StatusFailed, "cancelled", &now)
			return
		}
		m.logger.Error().Err(err).Str("filepath", job.FilePath).Msg("pretranscode: Failed")
		// Never leave a half-written playlist behind: the playback path treats the
		// presence of master.m3u8 as "ready" and would serve a truncated stream.
		_ = os.RemoveAll(m.OutputDirFor(job.Hash))
		m.finish(job.Hash, StatusFailed, err.Error(), &now)
		return
	}

	if m.finish(job.Hash, StatusCompleted, "", &now) {
		_ = os.RemoveAll(m.OutputDirFor(job.Hash))
		return
	}
	m.logger.Info().Str("filepath", job.FilePath).Msg("pretranscode: Completed")
}

func (m *Manager) transcode(ctx context.Context, job *PreTranscodeJob) error {
	// Un Stop (cambio de ajustes) cancela el job: no arrancar probes ni ffmpeg ya cancelado.
	if err := ctx.Err(); err != nil {
		return err
	}
	outDir := m.OutputDirFor(job.Hash)

	// Build into a temp dir and rename on success, so IsAvailable never sees a
	// master.m3u8 whose segments aren't all written yet.
	tmpDir := outDir + ".tmp"
	if err := os.RemoveAll(tmpDir); err != nil {
		return fmt.Errorf("could not clear temp dir: %w", err)
	}
	if err := os.MkdirAll(tmpDir, 0755); err != nil {
		return fmt.Errorf("could not create temp dir: %w", err)
	}
	defer os.RemoveAll(tmpDir)

	totalDuration := m.probeDuration(ctx, job.FilePath)

	src, err := probeStreams(ctx, m.opts.FfprobePath, job.FilePath)
	if err != nil {
		return fmt.Errorf("could not probe streams: %w", err)
	}

	hw := cassette.BuildHwAccelProfile(cassette.HwAccelOptions{
		Kind:           m.opts.HwAccel.Kind,
		Preset:         m.opts.HwAccel.Preset,
		CustomSettings: m.opts.HwAccel.CustomSettings,
	}, m.opts.FfmpegPath, m.logger)

	args := buildFfmpegArgs(hw, job.FilePath, tmpDir, len(src.Audio))

	cmd := exec.CommandContext(ctx, m.opts.FfmpegPath, args...)
	cmd.WaitDelay = 2 * time.Second
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return fmt.Errorf("could not open ffmpeg stdout: %w", err)
	}
	// Only the tail matters (lastLine / DetectHwAccelFailure); a long encode
	// that keeps warning must not grow this without bound.
	stderr := cassette.NewLimitedBuffer(64 * 1024)
	cmd.Stderr = stderr

	if err := cmd.Start(); err != nil {
		return fmt.Errorf("could not start ffmpeg: %w", err)
	}

	// -progress pipe:1 emits key=value lines; out_time_ms against the probed
	// duration is the only reliable progress signal ffmpeg gives us.
	progressDone := make(chan struct{})
	go func() {
		defer close(progressDone)
		m.trackProgressContext(ctx, stdout, job.Hash, totalDuration)
	}()
	// cmd.Wait closes stdout, so all reads must finish first (os/exec docs).
	// trackProgress returns on EOF, i.e. once ffmpeg exits or is killed by ctx.
	<-progressDone

	if err := cmd.Wait(); err != nil {
		if ctx.Err() != nil {
			return ctx.Err()
		}
		msg := strings.TrimSpace(stderr.String())
		if cassette.DetectHwAccelFailure(msg) {
			return fmt.Errorf("hardware encoder rejected this file (check Settings → Streaming): %s: %w", lastLine(msg), err)
		}
		return fmt.Errorf("ffmpeg failed: %s: %w", lastLine(msg), err)
	}

	if err := writeMasterPlaylist(tmpDir, src); err != nil {
		return fmt.Errorf("could not write master playlist: %w", err)
	}

	if err := os.RemoveAll(outDir); err != nil {
		return fmt.Errorf("could not clear output dir: %w", err)
	}
	if err := os.Rename(tmpDir, outDir); err != nil {
		return fmt.Errorf("could not publish output dir: %w", err)
	}

	m.setStatus(job.Hash, StatusRunning, 100)
	return nil
}

// buildFfmpegArgs assembles a VOD HLS encode. Decode flags must precede -i and
// encode flags follow it — that ordering is what makes hwaccel actually engage.
// Every audio track becomes a rendition (see variantStreamMap), so the player can
// switch tracks on the pre-transcode too.
func buildFfmpegArgs(hw cassette.HwAccelProfile, inputPath string, outDir string, audioTracks int) []string {
	args := []string{"-y", "-hide_banner", "-loglevel", "error", "-progress", "pipe:1", "-nostats"}
	threads := strconv.Itoa(resourcebudget.Current().BackgroundThreads)
	args = append(args, "-threads", threads, "-filter_threads", threads)
	args = append(args, hw.DecodeFlags...)
	args = append(args, "-i", inputPath)

	// The audio encode is cheap next to the video: a few extra AAC tracks cost a
	// small fraction of the job, and the job is background work.
	args = append(args, "-map", "0:v:0", "-map", "0:a?")
	args = append(args, hw.EncodeFlags...)
	if hw.Name != "custom" {
		args = append(args, "-threads", threads)
	}

	if hw.ForcedIDR {
		// Segment boundaries must land on IDR frames or players stall at the cut.
		args = append(args, "-force_key_frames", fmt.Sprintf("expr:gte(t,n_forced*%d)", segmentDuration))
	}

	args = append(args,
		"-c:a", "aac",
		"-ac", "2",
		"-b:a", "192k",
		"-f", "hls",
		"-hls_time", strconv.Itoa(segmentDuration),
		"-hls_playlist_type", "vod",
		"-hls_flags", "independent_segments",
		// ffmpeg writes one playlist per variant (v/, a0/, ...); writeMasterPlaylist
		// writes the master. No -master_pl_name: ffmpeg's own master is wrong here.
		"-var_stream_map", variantStreamMap(audioTracks),
		"-hls_segment_filename", filepath.Join(outDir, "%v", "seg%05d.ts"),
		filepath.Join(outDir, "%v", "index.m3u8"),
	)

	return args
}

// variantStreamMap declares the HLS variants: the video, and one audio rendition per
// source track (a0, a1, ...) in the same group, so the master can reference them.
func variantStreamMap(audioTracks int) string {
	if audioTracks == 0 {
		return "v:0,name:v"
	}
	parts := []string{"v:0,agroup:aud,name:v"}
	for i := 0; i < audioTracks; i++ {
		parts = append(parts, fmt.Sprintf("a:%d,agroup:aud,name:a%d", i, i))
	}
	return strings.Join(parts, " ")
}

// sourceAudio is one audio track of the source file, in ffmpeg's 0:a:N order.
type sourceAudio struct {
	Title     string
	Language  string
	IsDefault bool
}

// sourceStreams is what the master playlist needs from the source file.
type sourceStreams struct {
	Width, Height int // first video stream (0:v:0)
	Audio         []sourceAudio
}

// probeStreams lists the video and audio streams of a file in one ffprobe run.
func probeStreams(ctx context.Context, ffprobePath, filePath string) (sourceStreams, error) {
	if ffprobePath == "" {
		ffprobePath = "ffprobe"
	}

	ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()

	cmd := exec.CommandContext(ctx, ffprobePath,
		"-v", "error",
		"-print_format", "json",
		"-show_streams",
		filePath,
	)
	cmd.WaitDelay = 2 * time.Second
	out, err := cmd.Output()
	if err != nil {
		return sourceStreams{}, err
	}

	var doc struct {
		Streams []struct {
			CodecType string `json:"codec_type"`
			Width     int    `json:"width"`
			Height    int    `json:"height"`
			Tags      struct {
				Language string `json:"language"`
				Title    string `json:"title"`
			} `json:"tags"`
			Disposition struct {
				Default int `json:"default"`
			} `json:"disposition"`
		} `json:"streams"`
	}
	if err := json.Unmarshal(out, &doc); err != nil {
		return sourceStreams{}, fmt.Errorf("unparseable ffprobe output: %w", err)
	}

	var src sourceStreams
	sawVideo := false
	for _, s := range doc.Streams {
		switch s.CodecType {
		case "video":
			if !sawVideo {
				src.Width, src.Height = s.Width, s.Height
				sawVideo = true
			}
		case "audio":
			src.Audio = append(src.Audio, sourceAudio{
				Title:     s.Tags.Title,
				Language:  s.Tags.Language,
				IsDefault: s.Disposition.Default == 1,
			})
		}
	}
	return src, nil
}

// writeMasterPlaylist writes master.m3u8 into dir, next to the variant directories
// ffmpeg produced. The bandwidth is measured from the segments on disk.
func writeMasterPlaylist(dir string, src sourceStreams) error {
	duration, err := playlistDuration(filepath.Join(dir, "v", "index.m3u8"))
	if err != nil {
		return err
	}

	segments, err := filepath.Glob(filepath.Join(dir, "*", "seg*.ts"))
	if err != nil {
		return err
	}
	var total int64
	for _, seg := range segments {
		fi, err := os.Stat(seg)
		if err != nil {
			return err
		}
		total += fi.Size()
	}
	bandwidth := int64(float64(total) * 8 / duration)

	return os.WriteFile(filepath.Join(dir, "master.m3u8"), []byte(masterPlaylist(src, bandwidth)), 0644)
}

// masterPlaylist builds a pre-transcode master: one video variant and an EXT-X-MEDIA
// rendition per audio track (a<N>/index.m3u8). It is the shape the live transcode
// serves, so the player switches audio the same way for both. ffmpeg can't write
// this: its master adds audio-only entries as if they were video qualities.
func masterPlaylist(src sourceStreams, bandwidth int64) string {
	var b strings.Builder
	b.WriteString("#EXTM3U\n#EXT-X-VERSION:6\n#EXT-X-INDEPENDENT-SEGMENTS\n")

	defaultAudio := 0
	for i, a := range src.Audio {
		if a.IsDefault {
			defaultAudio = i
			break
		}
	}
	for i, a := range src.Audio {
		fmt.Fprintf(&b, `#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="aud",NAME="%s",`, audioRenditionName(a, i))
		if a.Language != "" && a.Language != "und" {
			fmt.Fprintf(&b, `LANGUAGE="%s",`, a.Language)
		}
		def := "NO"
		if i == defaultAudio {
			def = "YES"
		}
		fmt.Fprintf(&b, `DEFAULT=%s,AUTOSELECT=YES,CHANNELS="2",URI="a%d/index.m3u8"`+"\n", def, i)
	}

	codecs := "avc1.640028"
	audioAttr := ""
	if len(src.Audio) > 0 {
		codecs += ",mp4a.40.2"
		audioAttr = `,AUDIO="aud"`
	}
	fmt.Fprintf(&b, "#EXT-X-STREAM-INF:BANDWIDTH=%d,AVERAGE-BANDWIDTH=%d", bandwidth, bandwidth)
	if src.Width > 0 && src.Height > 0 {
		fmt.Fprintf(&b, ",RESOLUTION=%dx%d", src.Width, src.Height)
	}
	fmt.Fprintf(&b, `,CODECS="%s"%s`+"\nv/index.m3u8\n", codecs, audioAttr)
	return b.String()
}

// audioRenditionName is the label the player shows: the track's own title, or "Audio N".
func audioRenditionName(a sourceAudio, i int) string {
	name := strings.TrimSpace(a.Title)
	if name == "" {
		name = fmt.Sprintf("Audio %d", i+1)
	}
	return strings.ReplaceAll(name, `"`, "'")
}

// playlistDuration sums the EXTINF durations of a media playlist.
func playlistDuration(path string) (float64, error) {
	f, err := os.Open(path)
	if err != nil {
		return 0, err
	}
	defer f.Close()

	var total float64
	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		value, ok := strings.CutPrefix(scanner.Text(), "#EXTINF:")
		if !ok {
			continue
		}
		if i := strings.IndexByte(value, ','); i >= 0 {
			value = value[:i]
		}
		d, err := strconv.ParseFloat(strings.TrimSpace(value), 64)
		if err != nil {
			return 0, fmt.Errorf("unparseable EXTINF %q: %w", value, err)
		}
		total += d
	}
	if err := scanner.Err(); err != nil {
		return 0, err
	}
	if total <= 0 {
		return 0, errors.New("empty video playlist")
	}
	return total, nil
}

// probeDuration returns the file's duration in seconds, or 0 when unknown —
// progress then stays at 0 until completion rather than reporting nonsense.
//
// The shared extractor is tried first because playback has usually probed the
// file already and its result is cached, but it is not required: falling back to
// a direct ffprobe keeps the progress bar working instead of silently pinning it
// at 0%.
func (m *Manager) probeDuration(ctx context.Context, filePath string) float64 {
	if m.opts.Extractor != nil && m.opts.FfprobePath != "" {
		if info, err := m.opts.Extractor.GetInfoContext(ctx, m.opts.FfprobePath, filePath); err == nil && info != nil && info.Duration > 0 {
			return float64(info.Duration)
		}
	}

	d, err := probeDurationWithFfprobe(ctx, m.opts.FfprobePath, filePath)
	if err != nil {
		m.logger.Debug().Err(err).Str("filepath", filePath).Msg("pretranscode: Could not probe duration, progress will stay at 0 until the job finishes")
		return 0
	}
	return d
}

// probeDurationWithFfprobe asks ffprobe for the container duration directly.
func probeDurationWithFfprobe(ctx context.Context, ffprobePath string, filePath string) (float64, error) {
	if ffprobePath == "" {
		ffprobePath = "ffprobe"
	}

	ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()

	cmd := exec.CommandContext(ctx, ffprobePath,
		"-v", "error",
		"-show_entries", "format=duration",
		"-of", "default=noprint_wrappers=1:nokey=1",
		filePath,
	)
	cmd.WaitDelay = 2 * time.Second
	out, err := cmd.Output()
	if err != nil {
		return 0, err
	}

	d, err := strconv.ParseFloat(strings.TrimSpace(string(out)), 64)
	if err != nil {
		return 0, fmt.Errorf("unparseable duration %q: %w", strings.TrimSpace(string(out)), err)
	}
	return d, nil
}

func (m *Manager) trackProgressContext(ctx context.Context, stdout io.ReadCloser, hash string, totalDuration float64) {
	// A child inheriting stdout must not keep cancellation waiting for EOF forever.
	stop := context.AfterFunc(ctx, func() { _ = stdout.Close() })
	defer stop()
	m.trackProgress(stdout, hash, totalDuration)
}

func (m *Manager) trackProgress(stdout io.Reader, hash string, totalDuration float64) {
	scanner := bufio.NewScanner(stdout)
	for scanner.Scan() {
		key, value, found := strings.Cut(strings.TrimSpace(scanner.Text()), "=")
		if !found || key != "out_time_ms" || totalDuration <= 0 {
			continue
		}
		us, err := strconv.ParseFloat(value, 64)
		if err != nil {
			continue
		}
		// out_time_ms is microseconds despite the name.
		pct := (us / 1_000_000) / totalDuration * 100
		if pct < 0 {
			pct = 0
		}
		if pct > 100 {
			pct = 100
		}
		m.setStatus(hash, StatusRunning, pct)
	}
	// If the scanner stopped early (e.g. an over-long line) keep draining so
	// ffmpeg never blocks writing to a full pipe; returns at EOF.
	_, _ = io.Copy(io.Discard, stdout)
}

func (m *Manager) setStatus(hash string, status JobStatus, progress float64) {
	m.mu.Lock()
	defer m.mu.Unlock()

	job, ok := m.jobs[hash]
	if !ok || job.cancelled {
		return
	}
	job.Status = status
	job.Progress = progress
	job.Error = ""
}

func (m *Manager) finish(hash string, status JobStatus, errMsg string, endedAt *time.Time) bool {
	m.mu.Lock()
	defer m.mu.Unlock()

	job, ok := m.jobs[hash]
	if !ok {
		return false
	}
	if job.cancelled {
		status, errMsg = StatusFailed, "cancelled"
	}
	job.Status = status
	job.Error = errMsg
	job.EndedAt = endedAt
	if status == StatusCompleted {
		job.Progress = 100
	}
	return job.cancelled
}

// lastLine trims ffmpeg's stderr to its final line — the one that names the
// actual error — so it fits in a job's Error field and a toast.
func lastLine(s string) string {
	s = strings.TrimSpace(s)
	if s == "" {
		return "unknown error"
	}
	if idx := strings.LastIndex(s, "\n"); idx != -1 {
		return strings.TrimSpace(s[idx+1:])
	}
	return s
}
