package handlers

import (
	"regexp"
	"strings"
	"time"

	"kamehouse/internal/database/models"
	util "kamehouse/internal/util/proxies"
)

// tmdbSizeRe replica la regla de apps/web/src/lib/helpers/images.ts
// (getMediumResImage / getLowResImage): la URL exacta es la clave de la caché
// del proxy, así que tiene que coincidir byte a byte con la que pide el front.
var tmdbSizeRe = regexp.MustCompile(`/t/p/(?:original|w\d+)`)

// daimaVerticalPoster es DAIMA_VERTICAL_POSTER del front (lib/helpers/series.ts):
// la estantería usa ese póster vertical para Daima en lugar del de la biblioteca.
const daimaVerticalPoster = "https://image.tmdb.org/t/p/w500/lMULbSFZNXUC87MqOZQ4SSV9DXI.jpg"

func tmdbSized(url, size string) string {
	if url == "" {
		return ""
	}
	if strings.Contains(url, "tmdb.org") || strings.Contains(url, "themoviedb.org") {
		return tmdbSizeRe.ReplaceAllString(url, "/t/p/"+size)
	}
	return url
}

// shelfImageURLs devuelve las imágenes que dibuja la estantería de /series para
// las series de la biblioteca: póster y banner en w342 (nítido) y w185 (fondo
// desenfocado), igual que shelfImageUrls en el front; y el póster w342 de las
// películas, igual que moviePosterUrls.
func shelfImageURLs(media []models.LibraryMedia) []string {
	out := make([]string, 0, len(media)*4+2)
	hasSeries := false
	for _, m := range media {
		if strings.EqualFold(m.Type, "MOVIE") || strings.EqualFold(m.Format, "MOVIE") {
			// Grilla de /movies y Home: solo el póster en w342 (moviePosterUrls).
			if strings.HasPrefix(m.PosterImage, "http") {
				out = append(out, tmdbSized(m.PosterImage, "w342"))
			}
			continue
		}
		hasSeries = true
		poster := m.PosterImage
		if poster == "" {
			poster = m.BannerImage
		}
		banner := m.BannerImage
		if banner == "" {
			banner = m.PosterImage
		}
		for _, src := range []string{poster, banner} {
			if !strings.HasPrefix(src, "http") {
				continue
			}
			medium := tmdbSized(src, "w342")
			out = append(out, medium, tmdbSized(medium, "w185"))
		}
	}
	if hasSeries {
		medium := tmdbSized(daimaVerticalPoster, "w342")
		out = append(out, medium, tmdbSized(medium, "w185"))
	}
	return out
}

// shelfImageProxy es el proxy de imágenes de las rutas (routes.go).
var shelfImageProxy *util.ImageProxy

// prewarmShelfImages baja al disco del proxy local las imágenes de la
// estantería. El front las pide a través de /image-proxy: así cargan en
// milisegundos desde la primera apertura y también sin conexión.
func (h *Handler) prewarmShelfImages(delay time.Duration) {
	ip := shelfImageProxy
	if ip == nil || h.App == nil || h.App.Database == nil {
		return
	}
	go func() {
		defer func() {
			if r := recover(); r != nil {
				h.App.Logger.Error().Interface("panic", r).Msg("images: panic prewarming shelf images")
			}
		}()
		if delay > 0 {
			time.Sleep(delay)
		}
		var media []models.LibraryMedia
		if err := h.App.Database.Gorm().Select("type", "format", "poster_image", "banner_image").Find(&media).Error; err != nil {
			return
		}
		urls := shelfImageURLs(media)
		start := time.Now()
		n := ip.Prewarm(urls, 3)
		if n > 0 {
			h.App.Logger.Info().Int("fetched", n).Int("total", len(urls)).Dur("elapsed", time.Since(start)).Msg("images: Shelf images cached locally")
		}
	}()
}
