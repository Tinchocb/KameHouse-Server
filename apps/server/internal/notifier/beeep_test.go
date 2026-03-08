package notifier

import (
	"kamehouse/internal/test_utils"
	"path/filepath"
	"testing"

	"github.com/gen2brain/beeep"
	"github.com/stretchr/testify/require"
)

func TestBeeep(t *testing.T) {
	test_utils.SetTwoLevelDeep()
	test_utils.InitTestProvider(t)

	err := beeep.Notify("KameHouse", "Downloaded 1 episode", filepath.Join(test_utils.ConfigData.Path.DataDir, "logo.png"))
	require.NoError(t, err)

}
