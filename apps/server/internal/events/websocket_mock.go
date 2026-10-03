package events

import (
	"github.com/rs/zerolog"
)

type (
	MockWSEventManager struct {
		Conn   interface{}
		Logger *zerolog.Logger
	}
)

func NewMockWSEventManager(logger *zerolog.Logger) *MockWSEventManager {
	return &MockWSEventManager{
		Logger: logger,
	}
}

// SendEvent sends a websocket event to the client.
func (m *MockWSEventManager) SendEvent(t string, payload interface{}) {
	m.Logger.Trace().Any("payload", payload).Str("type", t).Msg("ws: Sent message")
}

func (m *MockWSEventManager) SendEventTo(clientID string, t string, payload interface{}, noLog ...bool) {
	if len(noLog) == 0 || !noLog[0] {
		m.Logger.Trace().Any("payload", payload).Str("type", t).Str("clientID", clientID).Msg("ws: Sent message to client")
	}
}
