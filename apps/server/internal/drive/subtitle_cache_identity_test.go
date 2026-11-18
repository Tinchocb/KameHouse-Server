package drive

import (
	"sync/atomic"
	"testing"

	"github.com/rs/zerolog"
	"github.com/stretchr/testify/require"
)

func TestSubtitleCacheDoesNotCrossClientsOrSurviveDisconnect(t *testing.T) {
	var firstCalls, secondCalls atomic.Int32
	firstServer := fakeSubtitleDrive(t, &firstCalls)
	secondServer := fakeSubtitleDrive(t, &secondCalls)
	logger := zerolog.Nop()
	first := &Service{logger: &logger, enabled: true, client: testClient(firstServer)}
	second := &Service{logger: &logger, enabled: true, client: testClient(secondServer)}
	files, err := first.SiblingSubtitleFiles(t.Context(), "vid1")
	require.NoError(t, err)
	files[0].Name = "caller-mutated"
	files, err = first.SiblingSubtitleFiles(t.Context(), "vid1")
	require.NoError(t, err)
	require.NotEqual(t, "caller-mutated", files[0].Name)
	_, err = second.SiblingSubtitleFiles(t.Context(), "vid1")
	require.NoError(t, err)
	require.Positive(t, secondCalls.Load(), "a different client must verify access and fetch its own data")
	require.NoError(t, first.UpdateConfig(false, "", "", "", "", ""))
	_, err = first.SiblingSubtitleFiles(t.Context(), "vid1")
	require.Error(t, err, "disconnected service must not return a previously authorized cached listing")
}
