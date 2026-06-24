package videocore

import (
	"bytes"
	"context"
	"fmt"
	httputil "kamehouse/internal/util/http"
	"math"
	"net/http"
	"strings"
	"time"

	"github.com/goccy/go-json"
	"github.com/rs/zerolog"
)

type DeepLTranslator struct {
	Token  string
	client *http.Client
	logger *zerolog.Logger
}

type deepLRequest struct {
	Text       []string `json:"text"`
	TargetLang string   `json:"target_lang"`
}

type deepLResponse struct {
	Translations []struct {
		Text string `json:"text"`
	} `json:"translations"`
}

func (d *DeepLTranslator) TranslateBatch(ctx context.Context, texts []string, targetLang string) ([]string, error) {
	if len(texts) == 0 {
		return []string{}, nil
	}

	u := "https://api-free.deepl.com/v2/translate"
	if !strings.HasSuffix(d.Token, ":fx") {
		u = "https://api.deepl.com/v2/translate"
	}

	payload := deepLRequest{Text: texts, TargetLang: targetLang}
	jsonData, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}

	if d.client == nil {
		d.client = httputil.NewFastClient()
	}
	client := d.client

	for i := 0; i < 3; i++ {
		req, err := http.NewRequestWithContext(ctx, "POST", u, bytes.NewBuffer(jsonData))
		if err != nil {
			return nil, err
		}
		req.Header.Add("Authorization", "DeepL-Auth-Key "+d.Token)
		req.Header.Add("Content-Type", "application/json")

		resp, err := client.Do(req)
		if err != nil {
			return nil, err
		}

		if resp.StatusCode == 429 {
			resp.Body.Close()
			time.Sleep(time.Duration(math.Pow(2, float64(i))) * time.Second)
			continue
		}

		if resp.StatusCode != http.StatusOK {
			resp.Body.Close()
			return nil, fmt.Errorf("deepl API error: %d", resp.StatusCode)
		}

		var result deepLResponse
		if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
			resp.Body.Close()
			return nil, err
		}
		resp.Body.Close()

		output := make([]string, len(result.Translations))
		for j, t := range result.Translations {
			output[j] = t.Text
		}
		return output, nil
	}

	return nil, fmt.Errorf("deepl API rate limit exceeded")
}
