package troubleshooter

import (
	"kamehouse/internal/test_utils"
	"kamehouse/internal/util"
	"os"
	"path/filepath"
	"testing"
)

func TestAnalyze(t *testing.T) {
	test_utils.SetTwoLevelDeep()
	test_utils.InitTestProvider(t)

	logsDir := filepath.Join(test_utils.ConfigData.Path.DataDir, "logs")
	if err := os.MkdirAll(logsDir, 0755); err != nil {
		t.Fatalf("Failed to create logs directory: %v", err)
	}

	analyzer := NewAnalyzer(NewTroubleshooterOptions{
		LogsDir: logsDir,
	})

	res, err := analyzer.Analyze()
	if err != nil {
		t.Skipf("Skipping: logs directory has no log files: %v", err)
	}

	util.Spew(res)
}
