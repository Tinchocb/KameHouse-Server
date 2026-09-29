package videofile

import "testing"

func TestRepairLegacyHevcMime(t *testing.T) {
	old := "hvc1.1.4.L96.BO"
	top := `video/x-matroska; codecs="hvc1.1.4.L96.BO, fLaC"`
	mi := &MediaInfo{MimeCodec: &top, Video: &Video{Codec: "hevc", PixFmt: "yuv420p10le", MimeCodec: &old}}
	mi.Videos = []Video{*mi.Video}
	repairLegacyHevcMime(mi)
	if *mi.Video.MimeCodec != "hvc1.2.4.L150.B0" || *mi.Videos[0].MimeCodec != "hvc1.2.4.L150.B0" {
		t.Fatalf("got %s / %s", *mi.Video.MimeCodec, *mi.Videos[0].MimeCodec)
	}
	if *mi.MimeCodec != `video/x-matroska; codecs="hvc1.2.4.L150.B0, fLaC"` {
		t.Fatalf("top-level mime = %s", *mi.MimeCodec)
	}
	good := "hvc1.1.6.L120.B0"
	mi2 := &MediaInfo{Video: &Video{PixFmt: "yuv420p", MimeCodec: &good}}
	repairLegacyHevcMime(mi2)
	if *mi2.Video.MimeCodec != good {
		t.Fatalf("touched a valid mime: %s", *mi2.Video.MimeCodec)
	}
}
