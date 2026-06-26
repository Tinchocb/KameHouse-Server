package lore

import (
	_ "embed"
	"encoding/json"
	"sync"
)

//go:embed dragonball_saga_displays.json
var sagaDisplaysJSON []byte

type SubSagaDisplay struct {
	ID      string `json:"id"`
	Title   string `json:"title"`
	StartEp int    `json:"start_ep"`
	EndEp   int    `json:"end_ep"`
}

type SagaDisplay struct {
	Image    string            `json:"image,omitempty"`
	SubSagas []SubSagaDisplay  `json:"sub_sagas,omitempty"`
}

type SeriesSagaDisplays map[string]map[string]SagaDisplay

var (
	sagaDisplaysData SeriesSagaDisplays
	sagaDispOnce     sync.Once
)

func GetSagaDisplays() SeriesSagaDisplays {
	sagaDispOnce.Do(func() {
		var data SeriesSagaDisplays
		if err := json.Unmarshal(sagaDisplaysJSON, &data); err == nil {
			sagaDisplaysData = data
		}
	})
	return sagaDisplaysData
}

func GetSagaDisplay(seriesID, sagaID string) *SagaDisplay {
	displays := GetSagaDisplays()
	if displays == nil {
		return nil
	}
	series, ok := displays[seriesID]
	if !ok {
		return nil
	}
	saga, ok := series[sagaID]
	if !ok {
		return nil
	}
	return &saga
}
