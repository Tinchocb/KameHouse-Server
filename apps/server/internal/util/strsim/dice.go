package strsim

import "strings"

// Dice compares rune bigrams, retaining the single-rune substring fallback.
func Dice(a, b string) float64 {
	if a == "" || b == "" {
		return 0
	}
	if a == b {
		return 1
	}
	ba := bigrams(a)
	bb := bigrams(b)
	if len(ba) == 0 || len(bb) == 0 {
		if strings.Contains(a, b) || strings.Contains(b, a) {
			return 0.85
		}
		return 0
	}
	used := make(map[int]bool, len(bb))
	intersection := 0
	for _, x := range ba {
		for i, y := range bb {
			if used[i] {
				continue
			}
			if x == y {
				intersection++
				used[i] = true
				break
			}
		}
	}
	return (2.0 * float64(intersection)) / float64(len(ba)+len(bb))
}

func bigrams(s string) []string {
	runes := []rune(s)
	if len(runes) < 2 {
		return nil
	}
	out := make([]string, 0, len(runes)-1)
	for i := 0; i < len(runes)-1; i++ {
		out = append(out, string(runes[i:i+2]))
	}
	return out
}
