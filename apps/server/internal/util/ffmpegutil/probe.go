package ffmpegutil

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"kamehouse/internal/util"
	"sync/atomic"
	"time"

	"gopkg.in/vansante/go-ffprobe.v2"
)

var defaultProbePath atomic.Pointer[string]

// SetDefaultProbePath preserves the legacy default for callers without an
// explicit path. Explicitly configured probes never share mutable executable state.
func SetDefaultProbePath(path string) {
	if path != "" {
		defaultProbePath.Store(&path)
	}
}

// ProbeURL uses the SDK's data model without its process-global binary setting.
// It retains the same flags and legacy tags, and waits for the child on all exits.
func ProbeURL(ctx context.Context, binary, input string, extra ...string) (*ffprobe.ProbeData, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	if binary == "" {
		binary = "ffprobe"
		if path := defaultProbePath.Load(); path != nil {
			binary = *path
		}
	}
	args := append([]string{"-loglevel", "fatal", "-print_format", "json", "-show_format", "-show_streams", "-show_chapters"}, extra...)
	args = append(args, input)
	cmd := util.NewCmdCtx(ctx, resolveToolExecutable(binary), args...)
	cmd.WaitDelay = 2 * time.Second
	var output probeOutput
	cmd.Stdout, cmd.Stderr = &output, io.Discard
	if err := cmd.Run(); err != nil {
		if ctx.Err() != nil {
			return nil, fmt.Errorf("ffprobe canceled: %w", ctx.Err())
		}
		// stderr can contain authenticated media URLs; never include it here.
		return nil, fmt.Errorf("ffprobe execution failed: %w", err)
	}
	var data ffprobe.ProbeData
	if err := json.Unmarshal(output.Bytes(), &data); err != nil {
		return nil, fmt.Errorf("invalid ffprobe JSON: %w", err)
	}
	if data.Format == nil {
		return nil, fmt.Errorf("no format data found in ffprobe output")
	}
	if len(data.Format.TagList) > 0 {
		tags := data.Format.TagList
		data.Format.Tags = &ffprobe.FormatTags{}
		data.Format.Tags.MajorBrand, _ = tags.GetString("major_brand")
		data.Format.Tags.MinorVersion, _ = tags.GetString("minor_version")
		data.Format.Tags.CompatibleBrands, _ = tags.GetString("compatible_brands")
		data.Format.Tags.CreationTime, _ = tags.GetString("creation_time")
	}
	for _, stream := range data.Streams {
		if stream == nil {
			return nil, fmt.Errorf("null stream in ffprobe output")
		}
		tags := stream.TagList
		rotate, _ := tags.GetInt("rotate")
		stream.Tags.Rotate = int(rotate)
		stream.Tags.CreationTime, _ = tags.GetString("creation_time")
		stream.Tags.Language, _ = tags.GetString("language")
		stream.Tags.Title, _ = tags.GetString("title")
		stream.Tags.Encoder, _ = tags.GetString("encoder")
		stream.Tags.Location, _ = tags.GetString("location")
	}
	return &data, nil
}

// Metadata is bounded even for malformed files with enormous tag/stream tables.
type probeOutput struct{ buffer bytes.Buffer }

func (b *probeOutput) Bytes() []byte { return b.buffer.Bytes() }

func (b *probeOutput) Write(p []byte) (int, error) {
	const limit = 16 << 20
	if len(p) > limit-b.buffer.Len() {
		return 0, fmt.Errorf("ffprobe metadata exceeds 16 MiB")
	}
	return b.buffer.Write(p)
}
