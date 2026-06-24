package videocore

import (
	"context"
	"fmt"
	"io"
	httputil "kamehouse/internal/util/http"
	"math/rand"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"

	"github.com/goccy/go-json"
	"github.com/rs/zerolog"
	"golang.org/x/time/rate"
)

type FreeGoogleTranslator struct {
	limiter *rate.Limiter
	client  *http.Client
	logger  *zerolog.Logger
}

func NewFreeGoogleTranslator(logger *zerolog.Logger) *FreeGoogleTranslator {
	return &FreeGoogleTranslator{
		limiter: rate.NewLimiter(rate.Every(500*time.Millisecond), 50),
		client:  httputil.NewFastClient(),
		logger:  logger,
	}
}

func (g *FreeGoogleTranslator) TranslateBatch(ctx context.Context, texts []string, targetLang string) ([]string, error) {
	if len(texts) == 0 {
		return []string{}, nil
	}

	results := make([]string, len(texts))
	var wg sync.WaitGroup
	var errMutex sync.Mutex
	var firstErr error

	g.logger.Debug().Msgf("videocore: (google) Translating %d lines", len(texts))

	for i, text := range texts {
		wg.Add(1)

		go func(idx int, txt string) {
			defer wg.Done()

			if err := g.limiter.Wait(ctx); err != nil {
				return
			}

			time.Sleep(time.Duration(rand.Intn(200)) * time.Millisecond)

			translated, err := g.translateSingle(ctx, txt, targetLang)
			if err != nil {
				errMutex.Lock()
				if firstErr == nil {
					firstErr = err
				}
				errMutex.Unlock()
				return
			}
			results[idx] = translated
		}(i, text)
	}

	wg.Wait()

	if firstErr != nil {
		return nil, firstErr
	}
	return results, nil
}

func (g *FreeGoogleTranslator) translateSingle(ctx context.Context, text, targetLang string) (string, error) {
	endpoint := "https://translate.googleapis.com/translate_a/single"

	params := url.Values{}
	params.Add("client", "gtx")
	params.Add("sl", "auto")
	params.Add("tl", strings.ToUpper(targetLang))
	params.Add("dt", "t")
	params.Add("q", text)

	req, err := http.NewRequestWithContext(ctx, "GET", endpoint+"?"+params.Encode(), nil)
	if err != nil {
		return "", err
	}

	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.45 Safari/537.36")

	if g.client == nil {
		g.client = httputil.NewFastClient()
	}

	resp, err := g.client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode == 429 {
		return "", fmt.Errorf("google rate limited")
	}
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("google api error: %d", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}

	var result []interface{}
	if err := json.Unmarshal(body, &result); err != nil {
		return "", err
	}

	if len(result) > 0 {
		if sentences, ok := result[0].([]interface{}); ok {
			var sb strings.Builder
			for _, s := range sentences {
				if parts, ok := s.([]interface{}); ok && len(parts) > 0 {
					if translatedPart, ok := parts[0].(string); ok {
						sb.WriteString(translatedPart)
					}
				}
			}
			return sb.String(), nil
		}
	}

	return "", fmt.Errorf("failed to parse google response")
}
