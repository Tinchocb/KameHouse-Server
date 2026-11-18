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
		if strings.EqualFold(m.Type, "MOVIE") || strings.EqualFold(m.Format, "MOVIE") || strings.EqualFold(m.Format, "OVA") || strings.EqualFold(m.Format, "SPECIAL") {
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

// episodeStillURLs devuelve los stills de episodios de TMDB en w300, el tamaño con que la
// Cronología dibuja sus momentos (tmdbSize="w300" en EpisodeThumbnailImg). Sin esto, la
// primera visita a la Cronología pedía a TMDB, uno por uno, cientos de stills.
func episodeStillURLs(images []string) []string {
	out := make([]string, 0, len(images))
	seen := make(map[string]struct{}, len(images))
	for _, img := range images {
		if !strings.HasPrefix(img, "https://image.tmdb.org/") {
			continue
		}
		u := tmdbSized(img, "w300")
		if _, dup := seen[u]; dup {
			continue
		}
		seen[u] = struct{}{}
		out = append(out, u)
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
	h.App.StartBackground(func() {
		defer func() {
			if r := recover(); r != nil {
				h.App.Logger.Error().Interface("panic", r).Msg("images: panic prewarming shelf images")
			}
		}()
		ctx := h.App.ShutdownCtx()
		if !waitBackground(ctx, delay) {
			return
		}
		var media []models.LibraryMedia
		if err := h.App.Database.Gorm().WithContext(ctx).Select("type", "format", "poster_image", "banner_image").Find(&media).Error; err != nil {
			return
		}
		urls := shelfImageURLs(media)
		start := time.Now()
		n := ip.PrewarmContext(ctx, urls, 6)
		if n > 0 {
			h.App.Logger.Info().Int("fetched", n).Int("total", len(urls)).Dur("elapsed", time.Since(start)).Msg("images: Shelf images cached locally")
		}

		// Stills de episodios: después de la estantería y con menos concurrencia, para no
		// competir con lo que el usuario está mirando.
		var stills []string
		if ctx.Err() != nil {
			return
		}
		if err := h.App.Database.Gorm().WithContext(ctx).Model(&models.LibraryEpisode{}).Where("image LIKE ?", "https://image.tmdb.org/%").Distinct().Pluck("image", &stills).Error; err != nil {
			return
		}
		stillURLs := episodeStillURLs(stills)
		start = time.Now()
		n = ip.PrewarmContext(ctx, stillURLs, 2)
		if n > 0 {
			h.App.Logger.Info().Int("fetched", n).Int("total", len(stillURLs)).Dur("elapsed", time.Since(start)).Msg("images: Episode stills cached locally")
		}
	})
}
