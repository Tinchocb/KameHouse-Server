package videofile

type Quality string

const (
	P240     Quality = "240p"
	P360     Quality = "360p"
	P480     Quality = "480p"
	P720     Quality = "720p"
	P1080    Quality = "1080p"
	P1440    Quality = "1440p"
	P4k      Quality = "4k"
	P8k      Quality = "8k"
	Original Quality = "original"
)

// Qualities Purposefully removing Original from this list (since it require special treatments anyway)
var Qualities = []Quality{P240, P360, P480, P720, P1080, P1440, P4k, P8k}

// Height returns the pixel height for the quality level.
// For Original quality, returns 0 — callers must handle Original separately.
func (v Quality) Height() uint32 {
	switch v {
	case P240:
		return 240
	case P360:
		return 360
	case P480:
		return 480
	case P720:
		return 720
	case P1080:
		return 1080
	case P1440:
		return 1440
	case P4k:
		return 2160
	case P8k:
		return 4320
	default:
		return 0
	}
}
