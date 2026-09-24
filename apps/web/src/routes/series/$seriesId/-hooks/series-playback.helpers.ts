import type { Anime_Entry, Anime_Episode, Anime_LocalFile } from "@/api/generated/types"
import { getDragonBallSpanishTitle } from "@/lib/config/dragonball.config"

// ─── Selectores puros de reproducción ─────────────────────────────────────────
// Fuente única para la regla de resume, el matching episodio↔archivo y la
// selección del target por defecto. use-series-playback y use-series-data los
// consumen para que el botón "Reproducir", el preload y la tarjeta "Continuar
// viendo" no puedan divergir.

/** Por debajo de este segundo el episodio arranca desde el principio. */
export const RESUME_MIN_SECONDS = 10
/** A partir de esta fracción el episodio se considera terminado. */
export const WATCHED_THRESHOLD = 0.95

/** Número canónico del episodio (absoluto si existe). */
export function episodeNumberOf(ep: Anime_Episode): number {
    return ep.absoluteEpisodeNumber || ep.episodeNumber
}

/** Número de episodio parseado del archivo, o undefined si no es numérico. */
export function fileEpisodeNumber(lf: Anime_LocalFile): number | undefined {
    const raw = lf.metadata?.episode || lf.parsedInfo?.episode
    if (raw == null) return undefined
    const n = Number(raw)
    return Number.isNaN(n) ? undefined : n
}

export function isResumable(currentTime: number | undefined, duration: number | undefined): boolean {
    if (!currentTime || !duration || currentTime <= RESUME_MIN_SECONDS) return false
    return currentTime / duration < WATCHED_THRESHOLD
}

export function isWatchedProgress(currentTime: number | undefined, duration: number | undefined): boolean {
    if (!currentTime || !duration) return false
    return currentTime / duration >= WATCHED_THRESHOLD
}

interface ContinuityLike {
    episodeNumber?: number
    currentTime?: number
    duration?: number
}

/** Segundo desde el que reanudar `episodeNumber`, o undefined si arranca de 0. */
export function getResumeTimeForEpisode(
    item: ContinuityLike | undefined | null,
    episodeNumber: number
): number | undefined {
    if (!item || item.episodeNumber !== episodeNumber) return undefined
    return isResumable(item.currentTime, item.duration) ? item.currentTime : undefined
}

export function resolveLocalFileForEpisode(
    episode: Anime_Episode,
    localFiles: Anime_LocalFile[] | undefined | null
): Anime_LocalFile | undefined {
    if (episode.localFile) return episode.localFile
    return (localFiles || []).find(f => {
        const fEp = fileEpisodeNumber(f)
        const fSeason = f.parsedInfo?.season
        if (fEp == null) return false
        if (fEp === episode.absoluteEpisodeNumber) return true
        if (typeof episode.seasonNumber === "number" && fSeason != null) {
            return fEp === episode.episodeNumber && Number(fSeason) === episode.seasonNumber
        }
        return fEp === episode.episodeNumber
    })
}

/** Inverso de resolveLocalFileForEpisode: el episodio al que pertenece un archivo. */
export function findEpisodeForLocalFile(
    episodes: Anime_Episode[],
    lf: Anime_LocalFile
): Anime_Episode | undefined {
    const fEp = fileEpisodeNumber(lf)
    if (fEp == null) return undefined
    const fSeason = lf.parsedInfo?.season
    return episodes.find(ep => {
        if (ep.absoluteEpisodeNumber === fEp) return true
        if (typeof ep.seasonNumber === "number" && fSeason != null) {
            return ep.episodeNumber === fEp && ep.seasonNumber === Number(fSeason)
        }
        return ep.episodeNumber === fEp
    })
}

export function findEpisodeByNumber(episodes: Anime_Episode[], n: number): Anime_Episode | undefined {
    return episodes.find(ep => episodeNumberOf(ep) === n)
}

export function findLocalFileByEpisodeNumber(
    localFiles: Anime_LocalFile[] | undefined | null,
    n: number
): Anime_LocalFile | undefined {
    return (localFiles || []).find(f => fileEpisodeNumber(f) === n)
}

/** Título a mostrar: título curado DB > español > metadata > nombre del archivo. */
export function resolveEpisodeTitle(ep: Anime_Episode, tmdbId: number | undefined | null): string {
    const n = episodeNumberOf(ep)
    return (
        getDragonBallSpanishTitle(tmdbId, n) ||
        ep.titleSpanish ||
        ep.episodeMetadata?.title ||
        ep.episodeTitle ||
        ep.displayTitle ||
        `Episodio ${n}`
    )
}

// ─── Targets ──────────────────────────────────────────────────────────────────

export type PlayCandidate =
    | { kind: "episode"; ep: Anime_Episode; lf: Anime_LocalFile }
    | { kind: "file"; file: Anime_LocalFile }
    | { kind: "empty" }

export function candidatePath(c: PlayCandidate): string | null {
    if (c.kind === "episode") return c.lf.path || null
    if (c.kind === "file") return c.file.path || null
    return null
}

/**
 * Lo que abre el botón "Reproducir": el episodio de continuity si existe, si no
 * el primero sin ver. Películas / series sin metadatos caen a los archivos locales.
 */
export function selectDefaultTarget(
    entry: Pick<Anime_Entry, "media" | "localFiles"> | undefined | null,
    episodes: Anime_Episode[],
    continuityEpisode: number | undefined | null
): PlayCandidate {
    if (!entry) return { kind: "empty" }
    const files = entry.localFiles || []

    if (entry.media?.format === "MOVIE" || episodes.length === 0) {
        const file = (continuityEpisode ? findLocalFileByEpisodeNumber(files, continuityEpisode) : undefined) ?? files[0]
        return file ? { kind: "file", file } : { kind: "empty" }
    }

    const resumeEp = continuityEpisode ? findEpisodeByNumber(episodes, continuityEpisode) : undefined
    const ep = resumeEp ?? episodes.find(e => !e.watched) ?? episodes[0]
    const lf = resolveLocalFileForEpisode(ep, files)
    if (lf) return { kind: "episode", ep, lf }
    return files[0] ? { kind: "file", file: files[0] } : { kind: "empty" }
}

export type NumberedTarget =
    | { kind: "episode"; ep: Anime_Episode; lf: Anime_LocalFile; skippedFrom?: number }
    | { kind: "file"; file: Anime_LocalFile }
    | { kind: "missing-file" }
    | { kind: "not-found" }

/**
 * Resuelve `?autoplay=N` / "Reanudar" / selector del player. Si el episodio N no
 * es reproducible, salta al siguiente >= N que tenga archivo local.
 */
export function selectTargetByNumber(
    episodes: Anime_Episode[],
    localFiles: Anime_LocalFile[] | undefined | null,
    n: number
): NumberedTarget {
    if (!Number.isFinite(n)) return { kind: "not-found" }

    const exact = findEpisodeByNumber(episodes, n)
    const exactLf = exact ? resolveLocalFileForEpisode(exact, localFiles) : undefined
    if (exact && exactLf) return { kind: "episode", ep: exact, lf: exactLf }

    const later = episodes
        .filter(ep => episodeNumberOf(ep) > n)
        .sort((a, b) => episodeNumberOf(a) - episodeNumberOf(b))
    for (const ep of later) {
        const lf = resolveLocalFileForEpisode(ep, localFiles)
        if (lf) return { kind: "episode", ep, lf, skippedFrom: n }
    }

    if (exact) return { kind: "missing-file" }

    // Sin metadatos: buscar directamente en los archivos locales.
    let best: { file: Anime_LocalFile; num: number } | undefined
    for (const file of localFiles || []) {
        const num = fileEpisodeNumber(file)
        if (num != null && num >= n && (!best || num < best.num)) best = { file, num }
    }
    return best ? { kind: "file", file: best.file } : { kind: "not-found" }
}

/**
 * Siguiente episodio REALMENTE reproducible tras `currentNumber`: salta huecos
 * no descargados para que el modo maratón nunca avance a un episodio inexistente.
 */
export function findNextPlayableEpisode(
    episodes: Anime_Episode[],
    localFiles: Anime_LocalFile[] | undefined | null,
    currentNumber: number
): { ep: Anime_Episode; lf: Anime_LocalFile } | null {
    const idx = episodes.findIndex(ep => episodeNumberOf(ep) === currentNumber)
    if (idx === -1) return null
    for (let i = idx + 1; i < episodes.length; i++) {
        const lf = resolveLocalFileForEpisode(episodes[i], localFiles)
        if (lf) return { ep: episodes[i], lf }
    }
    return null
}
