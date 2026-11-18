import { languageFamily } from "@/components/video/track-selection"

/**
 * Nombre con que el menú del reproductor muestra una pista de audio o de subtítulos.
 *
 * Los MKV de anime suelen traer pistas sin título y con idioma "und" (sin definir).
 * Mostrar ese código crudo junto al codec dejaba filas como "und" / "ASS" que no dicen
 * nada ni permiten distinguir una pista de otra.
 *
 * Orden: título real de la pista → idioma en texto → "Subtítulos N" / "Audio N", con N la
 * posición (desde 1) en la lista que ve el usuario.
 */

interface NamedTrack {
    title?: string | null
    language?: string | null
}

type GetFriendlyLanguage = (lang: string) => string

function trackName(track: NamedTrack, position: number, noun: string, getFriendlyLanguage: GetFriendlyLanguage): string {
    const title = (track.title ?? "").trim()
    const language = (track.language ?? "").trim()
    const lowerTitle = title.toLowerCase()
    // El título a veces es solo el código de idioma ("und", "jpn"): tampoco es un nombre.
    const titleIsRawCode = /^(und|unknown)(?:[-_][a-z0-9]+)*$/i.test(title) || lowerTitle === language.toLowerCase()
    if (title && !titleIsRawCode) return title
    if (languageFamily(language)) return getFriendlyLanguage(language)
    return `${noun} ${position + 1}`
}

/** `position` es el lugar (desde 0) de la pista en la lista de subtítulos. */
export function subtitleTrackName(track: NamedTrack, position: number, getFriendlyLanguage: GetFriendlyLanguage): string {
    return trackName(track, position, "Subtítulos", getFriendlyLanguage)
}

/** `position` es el lugar (desde 0) de la pista en la lista de audio. */
export function audioTrackName(track: NamedTrack, position: number, getFriendlyLanguage: GetFriendlyLanguage): string {
    return trackName(track, position, "Audio", getFriendlyLanguage)
}
