package util

import (
	"bytes"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"sync"
	"time"

	"github.com/mattn/go-isatty"
	"github.com/rs/zerolog/log"

	"github.com/rs/zerolog"
)

const (
	colorBlack = iota + 30
	colorRed
	colorGreen
	colorYellow
	colorBlue
	colorMagenta
	colorCyan
	colorWhite

	colorBold     = 1
	colorDarkGray = 90
)

// logFileSink recibe una copia de cada línea en el archivo de registro de esta ejecución.
// Hasta que AttachLogFile lo conecta (al crear la carpeta de logs, después de leer la
// configuración) solo se escribe por consola.
type logFileSink struct {
	mu sync.RWMutex
	f  *os.File
}

func (s *logFileSink) Write(p []byte) (int, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	if s.f == nil {
		return len(p), nil
	}
	return s.f.Write(p)
}

var fileSink = &logFileSink{}

// minFileLogLevel: el archivo omite TRC (una línea por cada petición HTTP y por cada
// segmento de streaming) para que los registros sigan siendo legibles y pesen poco.
const minFileLogLevel = zerolog.DebugLevel

// ansiEscape cubre los colores (ESC[…m) que algunos mensajes traen dentro (p. ej. GORM).
// En el archivo se verían como caracteres sueltos en la pestaña Sistema de los ajustes.
var ansiEscape = regexp.MustCompile("\x1b\\[[0-9;]*[A-Za-z]")

type ansiStripWriter struct {
	w io.Writer
}

func (a ansiStripWriter) Write(p []byte) (int, error) {
	if _, err := a.w.Write(ansiEscape.ReplaceAll(p, nil)); err != nil {
		return 0, err
	}
	return len(p), nil
}

// levelFilterWriter descarta las entradas por debajo de min antes de escribirlas.
type levelFilterWriter struct {
	min zerolog.Level
	w   io.Writer
}

func (l levelFilterWriter) Write(p []byte) (int, error) {
	return l.w.Write(p)
}

func (l levelFilterWriter) WriteLevel(level zerolog.Level, p []byte) (int, error) {
	if level < l.min {
		return len(p), nil
	}
	return l.w.Write(p)
}

// AttachLogFile crea KameHouse-<fecha-hora>.log dentro de dir y escribe en él desde ahora.
// Los nombres "KameHouse-*.log" son los que listan, recortan (14 días) y muestran
// los ajustes de la app (ver handlers/status.go y core/logging.go).
func AttachLogFile(dir string) (string, error) {
	path := filepath.Join(dir, fmt.Sprintf("KameHouse-%s.log", time.Now().Format("2006-01-02_15-04-05")))
	f, err := os.OpenFile(path, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
	if err != nil {
		return "", err
	}
	fileSink.mu.Lock()
	fileSink.f = f
	fileSink.mu.Unlock()
	return path, nil
}

func NewLogger() *zerolog.Logger {

	timeFormat := time.DateTime
	fieldsOrder := []string{"method", "status", "error", "uri", "latency_human"}
	fieldsExclude := []string{"host", "latency", "referer", "remote_ip", "user_agent", "bytes_in", "bytes_out", "file"}

	// Detect TTY and NO_COLOR for portable ANSI handling
	noColor := os.Getenv("NO_COLOR") != "" || !isatty.IsTerminal(os.Stdout.Fd())

	consoleOutput := zerolog.ConsoleWriter{
		Out:           os.Stdout,
		TimeFormat:    timeFormat,
		FormatLevel:   ZerologFormatLevelPretty,
		FormatMessage: ZerologFormatMessagePretty,
		FieldsExclude: fieldsExclude,
		FieldsOrder:   fieldsOrder,
		NoColor:       noColor,
	}

	// Mismo formato que la consola, sin color, hacia el archivo de registro.
	fileOutput := levelFilterWriter{
		min: minFileLogLevel,
		w: zerolog.ConsoleWriter{
			Out:           ansiStripWriter{w: fileSink},
			TimeFormat:    timeFormat,
			FormatLevel:   ZerologFormatLevelSimple,
			FieldsExclude: fieldsExclude,
			FieldsOrder:   fieldsOrder,
			NoColor:       true,
		},
	}

	logger := zerolog.New(zerolog.MultiLevelWriter(consoleOutput, fileOutput)).With().Timestamp().Logger()
	log.Logger = logger
	return &logger
}

func ZerologFormatMessagePretty(i interface{}) string {
	if msg, ok := i.(string); ok {
		if bytes.ContainsRune([]byte(msg), ':') {
			parts := strings.SplitN(msg, ":", 2)
			if len(parts) > 1 {
				return colorizeb(parts[0], colorCyan) + colorizeb(" >", colorDarkGray) + parts[1]
			}
		}
		return msg
	}
	return ""
}

func ZerologFormatLevelPretty(i interface{}) string {
	if ll, ok := i.(string); ok {
		s := strings.ToLower(ll)
		switch s {
		case "debug":
			s = "DBG" + colorizeb(" -", colorDarkGray)
		case "info":
			s = fmt.Sprint(colorizeb("INF", colorBold)) + colorizeb(" -", colorDarkGray)
		case "warn":
			s = colorizeb("WRN", colorYellow) + colorizeb(" -", colorDarkGray)
		case "trace":
			s = colorizeb("TRC", colorDarkGray) + colorizeb(" -", colorDarkGray)
		case "error":
			s = colorizeb("ERR", colorRed) + colorizeb(" -", colorDarkGray)
		case "fatal":
			s = colorizeb("FTL", colorRed) + colorizeb(" -", colorDarkGray)
		case "panic":
			s = colorizeb("PNC", colorRed) + colorizeb(" -", colorDarkGray)
		}
		return fmt.Sprint(s)
	}
	return ""
}

func ZerologFormatLevelSimple(i interface{}) string {
	if ll, ok := i.(string); ok {
		s := strings.ToLower(ll)
		switch s {
		case "debug":
			s = "|DBG|"
		case "info":
			s = "|INF|"
		case "warn":
			s = "|WRN|"
		case "trace":
			s = "|TRC|"
		case "error":
			s = "|ERR|"
		case "fatal":
			s = "|FTL|"
		case "panic":
			s = "|PNC|"
		}
		return fmt.Sprint(s)
	}
	return ""
}

func colorizeb(s interface{}, c int) string {
	// Color output disabled when NO_COLOR or not a TTY
	if os.Getenv("NO_COLOR") != "" || !isatty.IsTerminal(os.Stdout.Fd()) {
		return fmt.Sprint(s)
	}
	return fmt.Sprintf("\x1b[%dm%v\x1b[0m", c, s)
}
