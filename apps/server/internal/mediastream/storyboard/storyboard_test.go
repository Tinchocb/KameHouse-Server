package storyboard

import (
	"bytes"
	"context"
	"errors"
	"image"
	"image/jpeg"
	"kamehouse/internal/util"
	"kamehouse/internal/util/resourcebudget"
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestCacheAndIdentity(t *testing.T) {
	root := t.TempDir()
	key := Key("gdrive://file/episode.mkv", 100, 200)
	if key == Key("gdrive://file/episode.mkv", 101, 200) {
		t.Fatal("source version not included")
	}
	dir := filepath.Join(root, "storyboards")
	if err := os.MkdirAll(dir, 0755); err != nil {
		t.Fatal(err)
	}
	f, err := os.Create(filepath.Join(dir, key+"-0.jpg"))
	if err != nil {
		t.Fatal(err)
	}
	if err = jpeg.Encode(f, image.NewRGBA(image.Rect(0, 0, Width*Columns, Height*Rows)), nil); err != nil {
		t.Fatal(err)
	}
	f.Close()
	data, err := Ensure(context.Background(), root, key, "unreachable", "missing-ffmpeg", 0)
	if err != nil || len(data) == 0 {
		t.Fatalf("cache miss: %v", err)
	}
	if _, err = Ensure(context.Background(), root, "../../escape", "", "", 0); err == nil {
		t.Fatal("unsafe key accepted")
	}
	if _, err = Ensure(context.Background(), root, key, "", "", MaxSheet+1); err == nil {
		t.Fatal("unbounded sheet")
	}
}

func TestBusyAndCancellation(t *testing.T) {
	slot <- struct{}{}
	_, err := Ensure(context.Background(), t.TempDir(), Key("x", 0, 0), "", "", 0)
	<-slot
	if !errors.Is(err, ErrBusy) {
		t.Fatal(err)
	}
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	_, err = Ensure(ctx, t.TempDir(), Key("x", 0, 0), "", "", 0)
	if !errors.Is(err, ErrBusy) {
		t.Fatal(err)
	}
	if len(slot) != 0 {
		t.Fatal("slot leaked")
	}
}

// Opt-in: disposable synthetic media only, no user library or network.
func TestFFmpegFixture(t *testing.T) {
	binary := os.Getenv("STORYBOARD_TEST_FFMPEG")
	if binary == "" {
		t.Skip("set STORYBOARD_TEST_FFMPEG for synthetic integration")
	}
	previous := resourcebudget.Shared
	resourcebudget.Shared = resourcebudget.NewCoordinator(0, nil)
	defer func() { resourcebudget.Shared = previous }()
	for _, test := range []struct {
		name, duration string
		sheet, tiles   int
	}{
		{"short", "1", 0, 1}, {"partial", "25", 0, 3}, {"next-sheet", "125", 1, 1},
	} {
		t.Run(test.name, func(t *testing.T) {
			root := t.TempDir()
			input := filepath.Join(root, "fixture.mp4")
			ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
			defer cancel()
			cmd := util.NewCmdCtx(ctx, binary, "-v", "error", "-f", "lavfi", "-i", "testsrc2=size=320x240:rate=1", "-t", test.duration, "-c:v", "mpeg4", "-y", input)
			if out, err := cmd.CombinedOutput(); err != nil {
				t.Fatalf("fixture: %v %s", err, out)
			}
			key := Key(input, 1, 1)
			// Demand frames must work while playback holds the live lease, even
			// when no mosaic exists. This was the original preparing-forever case.
			live, liveErr := resourcebudget.Shared.Live(ctx)
			if liveErr != nil {
				t.Fatal(liveErr)
			}
			frameStart := time.Now()
			frame, frameErr := EnsureFrame(ctx, root, key, input, binary, test.sheet*Frames)
			live()
			if frameErr != nil {
				t.Fatal(frameErr)
			}
			cfg, frameErr := jpeg.DecodeConfig(bytes.NewReader(frame))
			if frameErr != nil || cfg.Width != Width || cfg.Height != Height {
				t.Fatalf("invalid demand frame: %v", frameErr)
			}
			t.Logf("cold single frame: %s", time.Since(frameStart))
			if _, frameErr = EnsureFrame(ctx, root, key, input, "missing", test.sheet*Frames); frameErr != nil {
				t.Fatalf("frame cache miss: %v", frameErr)
			}
			data, err := Ensure(ctx, root, key, input, binary, test.sheet)
			if err != nil || len(data) == 0 {
				t.Fatalf("generate: %v", err)
			}
			img, err := jpeg.Decode(bytes.NewReader(data))
			if err != nil {
				t.Fatal(err)
			}
			for tile := 0; tile < test.tiles; tile++ {
				lit := 0
				for y := 10; y < Height-10; y++ {
					for x := 10; x < Width-10; x++ {
						r, g, b, _ := img.At((tile%Columns)*Width+x, (tile/Columns)*Height+y).RGBA()
						if r+g+b > 20000 {
							lit++
						}
					}
				}
				if lit < 100 {
					t.Fatalf("tile %d is blank", tile)
				}
			}
			data, err = Ensure(ctx, root, key, input, "missing", test.sheet)
			if err != nil || len(data) == 0 {
				t.Fatalf("reuse: %v", err)
			}
		})
	}
}
