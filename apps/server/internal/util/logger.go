package util

import (
	"bytes"
	"fmt"
	"os"
	"strings"
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

	logger := zerolog.New(consoleOutput).With().Timestamp().Logger()
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
