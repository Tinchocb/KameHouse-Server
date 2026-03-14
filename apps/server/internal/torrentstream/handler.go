package torrentstream

import "net/http"

type handler struct {
	repository *Repository
}

func newHandler(r *Repository) *handler {
	return &handler{repository: r}
}

func (h *handler) ServeHTTP(w http.ResponseWriter, r *http.Request) {}
