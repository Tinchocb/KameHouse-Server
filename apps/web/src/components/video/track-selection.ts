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
        preferred = tracks.find((t) => {
            const lang = (t.language || "").toLowerCase()
            const title = (t.title || "").toLowerCase()
            return (
                lang === "spa-lat" ||
                lang === "es-la" ||
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
            preferred = tracks.find((t) => {
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
        preferred = tracks.find((t) => {
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
            preferred = tracks.find((t) => {
                const lang = (t.language || "").toLowerCase()
                return lang.startsWith("es") || lang.startsWith("spa")
            })
        }
    } else if (preferredAudioProfile === "japanese") {
        preferred = tracks.find((t) => {
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
        preferred = tracks.find((t) => {
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
        preferred = tracks.find((t) => {
            const lang = t.language?.toLowerCase() || ""
            return lang === langLower || lang.startsWith(langLower)
        })
    }

    // 3. Persisted audio track index
    if (!preferred && preferredAudioTrackIndex >= 0) {
        preferred = tracks.find((t) => t.index === preferredAudioTrackIndex)
    }

    // 4. Default fallback heuristics (Latino first, then Spanish)
    if (!preferred) {
        preferred = tracks.find((t) => {
            const lang = t.language?.toLowerCase() || ""
            return lang === "spa-lat" || lang === "es-la"
        })
    }
    if (!preferred) {
        preferred = tracks.find((t) => {
            const title = t.title?.toLowerCase() || ""
            return title.includes("latino") || title.includes("latin")
        })
    }
    if (!preferred) {
        preferred = tracks.find((t) => {
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
