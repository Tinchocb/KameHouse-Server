//go:build windows

package notifier

import (
	"kamehouse/internal/test_utils"
	"path/filepath"
	"testing"

	"github.com/go-toast/toast"
)

func TestGoToast(t *testing.T) {
	test_utils.SetTwoLevelDeep()
	test_utils.InitTestProvider(t)

	notification := toast.Notification{
		AppID:   "KameHouse",
		Title:   "KameHouse",
		Icon:    filepath.Join(test_utils.ConfigData.Path.DataDir, "logo.png"),
		Message: "Auto Downloader has downloaded 1 episode",
	}
	err := notification.Push()
	if err != nil {
		t.Fatal(err)
	}

}
