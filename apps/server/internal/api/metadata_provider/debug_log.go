package metadata_provider

import (
	"encoding/json"
	"os"
	"time"
)

func debugLogJikan(location, message string, data map[string]any) {
	payload := map[string]any{
		"sessionId": "549c87", "location": location, "message": message,
		"data": data, "timestamp": time.Now().UnixMilli(), "runId": "perf-opt",
	}
	if hypothesisId, ok := data["hypothesisId"]; ok {
		payload["hypothesisId"] = hypothesisId
	}
	line, err := json.Marshal(payload)
	if err != nil {
		return
	}
	f, err := os.OpenFile("debug-549c87.log", os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
	if err != nil {
		return
	}
	defer f.Close()
	_, _ = f.Write(append(line, '\n'))
}
