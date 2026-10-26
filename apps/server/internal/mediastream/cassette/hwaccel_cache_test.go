package cassette

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/rs/zerolog"
)

// El audio no codifica con el encoder de video: no debe heredar el perfil GPU, porque
// reservaría una sesión NVENC y, si su stderr coincidía con un patrón hw, apagaría la GPU.
func TestHeadProfileForAudioIgnoresGPU(t *testing.T) {
	gpu := nvidiaProfile("fast")

	if got := headProfileFor(AudioKind, gpu, "fast"); got.Name != "disabled" {
		t.Fatalf("audio head profile = %q, want disabled", got.Name)
	}
	if got := headProfileFor(VideoKind, gpu, "fast"); got.Name != gpu.Name {
		t.Fatalf("video head profile = %q, want %q", got.Name, gpu.Name)
	}
}

// La sonda se guarda por binario: repetirla no vuelve a lanzar la búsqueda de encoder.
func TestProbeHardwareEncoderCachesPerBinary(t *testing.T) {
	bin := filepath.Join(t.TempDir(), "ffmpeg-fake")
	if err := os.WriteFile(bin, []byte("not a binary"), 0o755); err != nil {
		t.Fatal(err)
	}
	logger := zerolog.Nop()

	probeMu.Lock()
	before := len(probeCache)
	probeMu.Unlock()

	first := probeHardwareEncoder(bin, &logger)
	second := probeHardwareEncoder(bin, &logger)
	if first != second {
		t.Fatalf("cached probe changed: %q then %q", first, second)
	}

	probeMu.Lock()
	added := len(probeCache) - before
	probeMu.Unlock()
	if added != 1 {
		t.Fatalf("probe cache entries added = %d, want 1 (second call must hit the cache)", added)
	}
}
