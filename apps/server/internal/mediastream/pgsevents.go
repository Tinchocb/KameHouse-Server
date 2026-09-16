package mediastream

import (
	"bufio"
	"encoding/binary"
	"fmt"
	"image/png"
	"io"
	"os"

	"kamehouse/internal/pgs"
)

type PgsEvent struct {
	StartTime    float64 `json:"startTime"`
	Duration     float64 `json:"duration"`
	ImageData    string  `json:"imageData"`
	Width        int     `json:"width"`
	Height       int     `json:"height"`
	X            int     `json:"x"`
	Y            int     `json:"y"`
	CanvasWidth  int     `json:"canvasWidth"`
	CanvasHeight int     `json:"canvasHeight"`
	CropX        int     `json:"cropX,omitempty"`
	CropY        int     `json:"cropY,omitempty"`
	CropWidth    int     `json:"cropWidth,omitempty"`
	CropHeight   int     `json:"cropHeight,omitempty"`
}

func ParseSupFile(path string) ([]*PgsEvent, error) {
	file, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer file.Close()

	br := bufio.NewReaderSize(file, 128*1024)
	decoder := pgs.NewPgsDecoder()
	var events []*PgsEvent
	var lastEvent *PgsEvent

	// Header buffer: 2 bytes magic + 4 PTS + 4 DTS + 1 segType + 2 segSize = 13 bytes
	var header [13]byte

	for {
		if _, err := io.ReadFull(br, header[:]); err != nil {
			if err == io.EOF {
				break
			}
			return nil, err
		}

		if header[0] != 0x50 || header[1] != 0x47 { // 'P', 'G'
			return nil, fmt.Errorf("invalid sup magic: %x %x", header[0], header[1])
		}

		pts := binary.BigEndian.Uint32(header[2:6])
		segType := header[10]
		size := binary.BigEndian.Uint16(header[11:13])

		// Single packet buffer: segType(1) + segSize(2) + data(size)
		packet := make([]byte, 3+int(size))
		packet[0] = segType
		packet[1] = header[11]
		packet[2] = header[12]

		if _, err := io.ReadFull(br, packet[3:]); err != nil {
			return nil, err
		}

		startTime := float64(pts) / 90000.0

		img, err := decoder.DecodePacket(packet)
		if err != nil {
			continue // Skip errors
		}

		if decoder.IsClearCommand() {
			if lastEvent != nil {
				dur := startTime - lastEvent.StartTime
				if dur > 0 {
					lastEvent.Duration = dur
				}
				lastEvent = nil
			}
			continue
		}

		if img != nil {
			if lastEvent != nil {
				dur := startTime - lastEvent.StartTime
				if dur > 0 {
					lastEvent.Duration = dur
				}
			}

			encodedImage, err := pgs.EncodePgsImageToBase64PNG(img, png.BestSpeed)
			if err != nil {
				continue
			}

			event := &PgsEvent{
				StartTime: startTime,
				ImageData: encodedImage,
				Width:     img.Bounds().Dx(),
				Height:    img.Bounds().Dy(),
			}

			if comp := decoder.GetCurrentComposition(); comp != nil {
				event.CanvasWidth = int(comp.Width)
				event.CanvasHeight = int(comp.Height)
				if len(comp.Objects) > 0 {
					obj := comp.Objects[0]
					event.X = int(obj.X)
					event.Y = int(obj.Y)
					if obj.Cropped {
						event.CropX = int(obj.CropX)
						event.CropY = int(obj.CropY)
						event.CropWidth = int(obj.CropWidth)
						event.CropHeight = int(obj.CropHeight)
					}
				}
			}

			events = append(events, event)
			lastEvent = event
		}
	}

	return events, nil
}
