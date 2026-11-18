import type { Anime_LibraryCollectionEntry } from "@/api/generated/types"
import { getLowResImage, getMediumResImage, localImage } from "@/lib/helpers/images"
import { DAIMA_VERTICAL_POSTER, DRAGON_BALL_SERIES_INFO, getSeriesIdFromMedia } from "@/lib/helpers/series"

const isMovieMedia = (media: NonNullable<Anime_LibraryCollectionEntry["media"]>): boolean => {
    const fmt = media.format?.toUpperCase()
    const type = media.type?.toUpperCase()
    return fmt === "MOVIE" || fmt === "OVA" || fmt === "SPECIAL" || type === "MOVIE"
}

/**
 * URLs de las imágenes que dibuja la estantería de /series (póster y banner de
 * cada serie, en la resolución media y su versión borrosa), con las mismas
 * reglas que la estantería. Sirve para bajarlas antes de entrar: vienen de TMDB
 * por internet y, pedidas recién al montar, los lomos quedaban un rato en el
 * marcador borroso. Van por la caché local del servidor (/image-proxy, que el
 * servidor precalienta): mismas URLs que pide la estantería.
 */
export function shelfImageUrls(entries: (Anime_LibraryCollectionEntry | null | undefined)[]): string[] {
    const out = new Set<string>()
    for (const entry of entries) {
        const media = entry?.media
        if (!media || isMovieMedia(media)) continue
        const title = media.titleSpanish || media.titleEnglish || media.titleRomaji || media.titleOriginal || ""
        const seriesId = getSeriesIdFromMedia(media, title)
        const canonical = seriesId ? DRAGON_BALL_SERIES_INFO[seriesId] : undefined
        const poster = seriesId === "dragon_ball_daima"
            ? DAIMA_VERTICAL_POSTER
            : (media.posterImage || media.bannerImage || canonical?.poster || "")
        const banner = media.bannerImage || media.posterImage || canonical?.banner || ""
        for (const src of [poster, banner]) {
            if (!src) continue
            const medium = getMediumResImage(src)
            if (!medium) continue
            out.add(localImage(medium))
            const low = getLowResImage(medium)
            if (low) out.add(localImage(low))
        }
    }
    return [...out]
}

/**
 * Pósters de la grilla de /movies (misma URL que MovieCard, vía la caché
 * local del servidor), para bajarlos antes de entrar.
 */
export function moviePosterUrls(entries: (Anime_LibraryCollectionEntry | null | undefined)[]): string[] {
    const out = new Set<string>()
    for (const entry of entries) {
        const media = entry?.media
        if (!media || !isMovieMedia(media) || !media.posterImage) continue
        const url = getMediumResImage(media.posterImage)
        if (url) out.add(localImage(url))
    }
    return [...out]
}
