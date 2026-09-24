import type { Models_LibraryMedia } from "@/api/generated/types"

/**
 * Los tipos generados declaran estos campos como `string` requeridos, pero
 * AniList/TMDb incompletos devuelven `null`/`undefined` en runtime.
 */
type MediaLike = Partial<Models_LibraryMedia> | null | undefined

/** Devuelve el string recortado, o `""` si no es un string con contenido. */
export function cleanString(value: unknown): string {
    return typeof value === "string" ? value.trim() : ""
}

/**
 * Returns the best title for a media object.
 */
export function getTitle(media: MediaLike): string {
    if (!media) return "Sin título"
    return cleanString(media.titleSpanish)
        || cleanString(media.titleEnglish)
        || cleanString(media.titleRomaji)
        || "Sin título"
}

/**
 * Returns the backdrop/banner URL for a media object, or `""` if there is none.
 */
export function getBackdrop(media: MediaLike): string {
    if (!media) return ""
    return cleanString(media.bannerImage) || cleanString(media.posterImage)
}
