import type { AudioTrack, SubtitleTrack } from "@/components/ui/track-types"

/**
 * Computes a stable content-based key for an array of audio tracks.
 * Used to avoid infinite selection loops when the array reference changes
 * but track contents remain identical.
 */
export function computeAudioTracksKey(audioTracks: AudioTrack[]): string {
    return audioTracks.map((t) => `${t.index}:${t.language ?? ""}`).join("|")
}

/**
 * Computes a stable content-based key for an array of subtitle tracks.
 */
export function computeSubtitleTracksKey(subtitleTracks: SubtitleTrack[]): string {
    return subtitleTracks.map((t) => `${t.index}:${t.language ?? ""}`).join("|")
}

/**
 * Matches a previously pending audio track selection across stream switches
 * (e.g. direct play to transcode or vice versa).
 *
 * Matching order:
 * 1. Absolute container / rendition `index` (most stable identifier).
 * 2. Track title (if present).
 * 3. Track language code.
 */
export function matchPendingAudioTrack(
    tracks: AudioTrack[],
    pending: { index: number; title?: string; language?: string } | null | undefined,
): AudioTrack | undefined {
    if (!pending) return undefined

    return (
        tracks.find((t) => t.index === pending.index) ??
        tracks.find((t) => Boolean(pending.title && t.title === pending.title)) ??
        tracks.find((t) => t.language === pending.language)
    )
}

/**
 * Puntaje de calidad de una pista de audio: primero el codec (sin pérdida >
 * surround con pérdida > estéreo comprimido), después la cantidad de canales.
 */
export function audioQualityScore(track: AudioTrack): number {
    const codec = (track.codec || "").toLowerCase()
    let codecScore = 1
    if (["flac", "truehd", "mlp", "alac"].includes(codec) || codec.startsWith("pcm") || codec.includes("dts-hd") || codec === "dtshd") {
        codecScore = 4
    } else if (["eac3", "ac3", "dts", "opus"].includes(codec)) {
        codecScore = 3
    } else if (["aac", "vorbis"].includes(codec)) {
        codecScore = 2
    }
    return codecScore * 100 + (track.channels ?? 2)
}

/**
 * Entre las pistas que cumplen `pred`, devuelve la de mejor calidad; si solo
 * hay versiones peores (ej. latino solo en AAC estéreo), se queda con esa.
 * Empate → la primera del contenedor, como antes.
 */
function pickBestAudio(tracks: AudioTrack[], pred: (t: AudioTrack) => boolean): AudioTrack | undefined {
    let best: AudioTrack | undefined
    for (const t of tracks) {
        if (!pred(t)) continue
        if (!best || audioQualityScore(t) > audioQualityScore(best)) best = t
    }
    return best
}

/**
 * Posición de `target` en `video.audioTracks` (direct play con pistas nativas).
 * Chromium solo expone las pistas que decodifica, en el orden del contenedor,
 * así que la posición es el orden entre las pistas decodificables. Si la
 * cantidad no coincide con la lista nativa el mapeo no es confiable → -1
 * (el llamador cae al transcode en vez de habilitar la pista equivocada).
 */
export function resolveNativeAudioTrackPosition(
    tracks: AudioTrack[],
    target: AudioTrack,
    nativeCount: number,
    isPlayable: (codec: string | undefined) => boolean,
): number {
    if (!isPlayable(target.codec)) return -1
    const playable = tracks.filter(t => isPlayable(t.codec))
    if (playable.length !== nativeCount) return -1
    return playable.findIndex(t => t.index === target.index)
}

export interface MatchAudioOptions {
    tracks: AudioTrack[]
    preferredAudioProfile?: string
    preferredAudioLang?: string
    preferredAudioTrackIndex?: number
}

/**
 * Pure heuristic audio track selection based on user audio profile,
 * preferred language, persisted index, or fallback heuristics.
 */
export function matchPreferredAudioTrack({
    tracks,
    preferredAudioProfile,
    preferredAudioLang,
    preferredAudioTrackIndex = -1,
}: MatchAudioOptions): AudioTrack | undefined {
    if (tracks.length === 0) return undefined

    let preferred: AudioTrack | undefined

    // 1. Match by intelligent dubbing profile
    if (preferredAudioProfile === "latino") {
        // Highest priority: Explicit latino code or title
        preferred = pickBestAudio(tracks, (t) => {
            const lang = (t.language || "").toLowerCase()
            const title = (t.title || "").toLowerCase()
            return (
                lang === "spa-lat" ||
                lang === "es-la" ||
                lang === "es-419" ||
                lang === "es-mx" ||
                lang === "lat" ||
                title.includes("latino") ||
                title.includes("latin") ||
                title.includes("mexico") ||
                title.includes("hispano")
            )
        })
        // Fallback: General Spanish that is not explicitly Castellano/Spain
        if (!preferred) {
            preferred = pickBestAudio(tracks, (t) => {
                const lang = (t.language || "").toLowerCase()
                const title = (t.title || "").toLowerCase()
                return (
                    (lang.startsWith("es") || lang.startsWith("spa")) &&
                    !title.includes("castellano") &&
                    !title.includes("spain")
                )
            })
        }
    } else if (preferredAudioProfile === "castellano") {
        preferred = pickBestAudio(tracks, (t) => {
            const lang = (t.language || "").toLowerCase()
            const title = (t.title || "").toLowerCase()
            return (
                lang === "spa-es" ||
                lang === "es-es" ||
                title.includes("castellano") ||
                title.includes("españa") ||
                title.includes("spain")
            )
        })
        if (!preferred) {
            preferred = pickBestAudio(tracks, (t) => {
                const lang = (t.language || "").toLowerCase()
                return lang.startsWith("es") || lang.startsWith("spa")
            })
        }
    } else if (preferredAudioProfile === "japanese") {
        preferred = pickBestAudio(tracks, (t) => {
            const lang = (t.language || "").toLowerCase()
            const title = (t.title || "").toLowerCase()
            return (
                lang === "jpn" ||
                lang === "ja" ||
                title.includes("japon") ||
                title.includes("japan") ||
                title.includes("raw") ||
                title.includes("orig")
            )
        })
    } else if (preferredAudioProfile === "english") {
        preferred = pickBestAudio(tracks, (t) => {
            const lang = (t.language || "").toLowerCase()
            const title = (t.title || "").toLowerCase()
            return (
                lang === "eng" ||
                lang === "en" ||
                title.includes("english") ||
                title.includes("ingl")
            )
        })
    }

    // 2. Explicit preferredAudioLang if profile did not match
    if (!preferred && preferredAudioLang && preferredAudioLang.toLowerCase() !== "und") {
        const langLower = preferredAudioLang.toLowerCase()
        preferred = pickBestAudio(tracks, (t) => {
            const lang = t.language?.toLowerCase() || ""
            return lang === langLower || lang.startsWith(langLower)
        })
    }

    // 3. Persisted audio track index
    if (!preferred && preferredAudioTrackIndex >= 0) {
        preferred = pickBestAudio(tracks, (t) => t.index === preferredAudioTrackIndex)
    }

    // 4. Default fallback heuristics (Latino first, then Spanish)
    if (!preferred) {
        preferred = pickBestAudio(tracks, (t) => {
            const lang = t.language?.toLowerCase() || ""
            return lang === "spa-lat" || lang === "es-la" || lang === "es-419"
        })
    }
    if (!preferred) {
        preferred = pickBestAudio(tracks, (t) => {
            const title = t.title?.toLowerCase() || ""
            return title.includes("latino") || title.includes("latin")
        })
    }
    if (!preferred) {
        preferred = pickBestAudio(tracks, (t) => {
            const lang = t.language?.toLowerCase() || ""
            return lang === "spa" || lang === "es" || lang.startsWith("es-") || lang.startsWith("spa-")
        })
    }

    return preferred
}

/**
 * Checks whether an audio track is considered dubbed into the viewer's native/dub languages
 * (e.g. Spanish or English) for automatic subtitle disabling.
 */
export function isAudioTrackDubbed(track: AudioTrack | null | undefined): boolean {
    if (!track) return false
    const currentLang = track.language?.toLowerCase() || ""
    return (
        ["spa", "es", "eng"].includes(currentLang) ||
        currentLang.startsWith("spa-") ||
        currentLang.startsWith("es-")
    )
}

/**
 * Matches a preferred subtitle track tolerantly (exact match, prefix match,
 * or Spanish variants like "spa", "es", "es-la"), falling back to default or forced tracks.
 */
export function matchPreferredSubtitleTrack(
    tracks: SubtitleTrack[],
    preferredSubtitleLang: string,
): SubtitleTrack | undefined {
    if (tracks.length === 0) return undefined

    const pref = (preferredSubtitleLang || "").toLowerCase()
    const isSpanish = (l: string) =>
        l === "spa" || l === "es" || l.startsWith("spa-") || l.startsWith("es-")

    const matchesPref = (t: SubtitleTrack) => {
        const lang = t.language?.toLowerCase() || ""
        if (pref && (lang === pref || lang.startsWith(pref + "-") || pref.startsWith(lang + "-"))) {
            return true
        }
        if ((pref === "spa" || pref === "es") && isSpanish(lang)) {
            return true
        }
        return false
    }

    return (
        tracks.find(matchesPref) ??
        tracks.find((t) => t.default) ??
        tracks.find((t) => t.forced)
    )
}

export interface ResolveAutoSubtitleOptions {
    subtitleTracks: SubtitleTrack[]
    currentAudio?: AudioTrack
    subtitlesEnabled: boolean
    autoDisableSubtitlesWhenDubbed: boolean
    preferredSubtitleLang: string
}

/**
 * Resolves the target subtitle track for automatic configuration:
 * returns null if subtitles should be turned off (disabled or dubbed audio with auto-disable),
 * or returns the matched preferred SubtitleTrack.
 */
export function resolveAutoSubtitleTarget({
    subtitleTracks,
    currentAudio,
    subtitlesEnabled,
    autoDisableSubtitlesWhenDubbed,
    preferredSubtitleLang,
}: ResolveAutoSubtitleOptions): SubtitleTrack | null {
    if (!subtitlesEnabled) return null

    const isDubbed = isAudioTrackDubbed(currentAudio)
    if (autoDisableSubtitlesWhenDubbed && isDubbed) {
        return null
    }

    return matchPreferredSubtitleTrack(subtitleTracks, preferredSubtitleLang) ?? null
}
