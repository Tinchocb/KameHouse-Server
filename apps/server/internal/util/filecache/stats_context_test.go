package filecache

import (
	"context"
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/require"
)

type sizeWalkContext struct {
	context.Context
	cancel context.CancelFunc
	checks int
}

func (ctx *sizeWalkContext) Err() error {
	ctx.checks++
	if ctx.checks == 3 {
		ctx.cancel()
	}
	return ctx.Context.Err()
}

func TestSizeStatisticsCancelDuringDirectoryWalk(t *testing.T) {
	c, err := NewCacher(t.TempDir())
	require.NoError(t, err)
	dir := filepath.Join(c.dir, "videofiles", "fixture")
	require.NoError(t, os.MkdirAll(dir, 0700))
	require.NoError(t, os.WriteFile(filepath.Join(dir, "data"), []byte("fixture"), 0600))
	for name, stat := range map[string]func(context.Context) (int64, error){
		"all": c.GetTotalSizeContext, "videofiles": c.GetMediastreamVideoFilesTotalSizeContext,
	} {
		t.Run(name, func(t *testing.T) {
			base, cancel := context.WithCancel(t.Context())
			defer cancel()
			ctx := &sizeWalkContext{Context: base, cancel: cancel}
			_, err := stat(ctx)
			require.ErrorIs(t, err, context.Canceled)
			require.GreaterOrEqual(t, ctx.checks, 3)
		})
	}
}
