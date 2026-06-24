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

type OpenAITranslator struct {
	Token  string
	client *http.Client
	logger *zerolog.Logger
}

type openAIRequest struct {
	Model       string    `json:"model"`
	Messages    []message `json:"messages"`
	Temperature float64   `json:"temperature"`
}

type message struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type openAIResponse struct {
	Choices []struct {
		Message struct {
			Content string `json:"content"`
		} `json:"message"`
	} `json:"choices"`
}

func (o *OpenAITranslator) TranslateBatch(ctx context.Context, texts []string, targetLang string) ([]string, error) {
	if len(texts) == 0 {
		return []string{}, nil
	}

	u := "https://api.openai.com/v1/chat/completions"

	systemPrompt := fmt.Sprintf("You are an anime subtitle translator. Translate the following JSON array of strings to %s. Return ONLY a JSON array of strings without explanations. Maintain the order exactly.", strings.ToUpper(targetLang))
	userContent, _ := json.Marshal(texts)

	payload := openAIRequest{
		Model: "gpt-4o-mini",
		Messages: []message{
			{Role: "system", Content: systemPrompt},
			{Role: "user", Content: string(userContent)},
		},
		Temperature: 0.3,
	}

	jsonData, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}

	if o.client == nil {
		o.client = httputil.NewClientWithTimeout(30 * time.Second)
	}
	client := o.client

	for i := 0; i < 3; i++ {
		req, err := http.NewRequestWithContext(ctx, "POST", u, bytes.NewBuffer(jsonData))
		if err != nil {
			return nil, err
		}
		req.Header.Add("Authorization", "Bearer "+o.Token)
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
			return nil, fmt.Errorf("openai API error: %d", resp.StatusCode)
		}

		var result openAIResponse
		if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
			resp.Body.Close()
			return nil, err
		}
		resp.Body.Close()

		if len(result.Choices) == 0 {
			return nil, fmt.Errorf("openai returned no choices")
		}

		var translatedTexts []string
		content := strings.TrimSpace(result.Choices[0].Message.Content)

		content = strings.TrimPrefix(content, "```json")
		content = strings.TrimPrefix(content, "```")
		content = strings.TrimSuffix(content, "```")

		if err := json.Unmarshal([]byte(content), &translatedTexts); err != nil {
			return nil, fmt.Errorf("failed to parse openai response: %w", err)
		}

		if len(translatedTexts) != len(texts) {
			return nil, fmt.Errorf("openai returned mismatching count: got %d, expected %d", len(translatedTexts), len(texts))
		}

		return translatedTexts, nil
	}

	return nil, fmt.Errorf("openai API rate limit exceeded")
}
