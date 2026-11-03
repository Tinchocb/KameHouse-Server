package pretranscode

import (
	"kamehouse/internal/mediastream/cassette"
	"kamehouse/internal/util/resourcebudget"
	"strconv"
	"testing"
)

func TestBackgroundThreadLimitsCoverDecoderAndEncoder(t *testing.T) {
	args := buildFfmpegArgs(cassette.HwAccelProfile{EncodeFlags: []string{"-c:v", "libx264"}}, "input.mkv", t.TempDir(), 1)
	input := indexOf(args, "-i")
	before, after := false, false
	want := strconv.Itoa(resourcebudget.Current().BackgroundThreads)
	for i := 0; i+1 < len(args); i++ {
		if args[i] != "-threads" {
			continue
		}
		if args[i+1] != want {
			t.Fatalf("thread cap = %s, want %s", args[i+1], want)
		}
		if i < input {
			before = true
		} else {
			after = true
		}
	}
	if !before || !after {
		t.Fatal("must limit both decoder and encoder")
	}
}
