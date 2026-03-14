package fillermanager

import (
	"kamehouse/internal/hook_resolver"
	"kamehouse/internal/library/anime"
)

type HydrateFillerDataRequestedEvent struct {
	hook_resolver.Event
	Entry *anime.Entry `json:"entry"`
}

type HydrateOnlinestreamFillerDataRequestedEvent struct {
	hook_resolver.Event
	Episodes []interface{} `json:"episodes"`
}

type HydrateEpisodeFillerDataRequestedEvent struct {
	hook_resolver.Event
	Episodes []*anime.Episode `json:"episodes"`
}
