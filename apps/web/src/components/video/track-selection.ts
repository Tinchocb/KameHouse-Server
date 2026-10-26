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
    // Una pista pendiente de extracción cambia de clave al quedar lista, así la
    // auto-selección vuelve a correr cuando las pistas de Drive pasan a estar disponibles.
    return subtitleTracks.map((t) => `${t.index}:${t.language ?? ""}${t.needsExtraction ? ":pending" : ""}`).join("|")
}

// ── Idiomas ────────────────────────────────────────────────────────────────────

// Códigos ISO 639-1/2 (y alias frecuentes en nombres de archivo y pistas) → ISO 639-2.
const LANGUAGE_FAMILIES: Record<string, string> = {
    es: "spa", spa: "spa", esp: "spa", lat: "spa", latino: "spa", spanish: "spa", castellano: "spa", espanol: "spa", "español": "spa",
    en: "eng", eng: "eng", english: "eng",
    ja: "jpn", jpn: "jpn", jap: "jpn", japanese: "jpn",
    pt: "por", por: "por", ptbr: "por", portuguese: "por",
    fr: "fra", fra: "fra", fre: "fra", french: "fra",
    de: "deu", deu: "deu", ger: "deu", german: "deu",
    it: "ita", ita: "ita", italian: "ita",
    ru: "rus", rus: "rus", russian: "rus",
    zh: "zho", zho: "zho", chi: "zho", chinese: "zho",
    ko: "kor", kor: "kor", korean: "kor",
    ar: "ara", ara: "ara", arabic: "ara",
    ca: "cat", cat: "cat",
}

/**
 * Familia de idioma en ISO 639-2 de un código: "es", "spa", "es-MX", "spa-lat" y
 * "es_419" son todos "spa". Devuelve "" para vacío o "und" (sin idioma).
 */
export function languageFamily(code: string | null | undefined): string {
    const base = (code ?? "").trim().toLowerCase().split(/[-_]/)[0]
    if (!base || base === "und" || base === "unknown") return ""
    return LANGUAGE_FAMILIES[base] ?? base
}

const TITLE_LANGUAGE_HINTS: Array<[RegExp, string]> = [
    [/espa[nñ]ol|spanish|latino|castellano|latam/i, "spa"],
    [/english|ingl[eé]s/i, "eng"],
    [/japon|japanese/i, "jpn"],
    [/portugu/i, "por"],
    [/franc|french/i, "fra"],
]

/** Familia de idioma de una pista; si no trae código ("und"/vacío), se infiere del título. */
function trackLanguageFamily(track: { language?: string | null; title?: string | null }): string {
    const fam = languageFamily(track.language)
    if (fam) return fam
    const title = track.title ?? ""
    return TITLE_LANGUAGE_HINTS.find(([re]) => re.test(title))?.[1] ?? ""
}

const LATAM_REGIONS = new Set(["la", "lat", "419", "mx", "ar", "co", "cl", "pe", "ve", "uy"])

/** Variante regional del español de un código o título: "latam", "iberian" o "". */
function spanishVariant(track: { language?: string | null; title?: string | null }): "latam" | "iberian" | "" {
    const parts = (track.language ?? "").toLowerCase().split(/[-_]/)
    const region = parts[1] ?? ""
    const title = (track.title ?? "").toLowerCase()
    if (parts[0] === "lat" || LATAM_REGIONS.has(region) || /latino|latam|mexic/.test(title)) return "latam"
    if (region === "es" || /castellano|espa[nñ]a|spain|iberi/.test(title)) return "iberian"
    return ""
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
function audioQualityScore(track: AudioTrack): number {
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

interface MatchAudioOptions {
    tracks: AudioTrack[]
    preferredAudioProfile?: string
    preferredAudioLang?: string
    preferredAudioTrackIndex?: number
}

/**
 * Perfil de audio que aplica a una serie. El perfil propio de la serie (p. ej. Daima:
 * japonés) pisa al global, salvo que el usuario ya haya elegido una pista en esa serie:
 * entonces manda su elección, resuelta por idioma e índice ("auto").
 */
export function effectiveAudioProfile({
    globalProfile,
    seriesProfile,
    rememberedTrackIndex,
}: {
    globalProfile: string
    seriesProfile?: string
    rememberedTrackIndex: number
}): string {
    if (!seriesProfile) return globalProfile
    return rememberedTrackIndex >= 0 ? "auto" : seriesProfile
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
 * Checks whether an audio track is considered dubbed into the viewer's language
 * (so the subtitles are redundant). `viewerLangs` son familias ISO 639-2; sin ellas
 * se asume español o inglés.
 */
export function isAudioTrackDubbed(track: AudioTrack | null | undefined, viewerLangs: string[] = ["spa", "eng"]): boolean {
    if (!track) return false
    const family = trackLanguageFamily(track)
    return family !== "" && viewerLangs.includes(family)
}

/**
 * Matches a preferred subtitle track tolerantly: cualquier código ISO 639-1/2 o
 * variante regional del mismo idioma ("es", "spa", "es-MX", "spa-lat"), con título
 * como respaldo cuando la pista no trae idioma. Entre varias del mismo idioma gana la
 * variante pedida y, después, la que no es forzada (carteles/canciones). Si ninguna
 * coincide, cae a la pista por defecto o a la forzada. Las pistas pendientes de
 * extracción (Drive) nunca se eligen.
 */
export function matchPreferredSubtitleTrack(
    tracks: SubtitleTrack[],
    preferredSubtitleLang: string,
): SubtitleTrack | undefined {
    const usable = tracks.filter((t) => !t.needsExtraction)
    if (usable.length === 0) return undefined

    const pref = (preferredSubtitleLang || "").trim().toLowerCase()
    const prefFamily = languageFamily(pref)

    if (prefFamily) {
        const prefVariant = prefFamily === "spa" ? spanishVariant({ language: pref }) : ""
        const candidates = usable
            .map((track, order) => ({ track, order }))
            .filter(({ track }) => trackLanguageFamily(track) === prefFamily)
        if (candidates.length > 0) {
            const score = (t: SubtitleTrack) => {
                let s = 0
                if ((t.language ?? "").toLowerCase() === pref) s += 4
                if (prefVariant && spanishVariant(t) === prefVariant) s += 2
                if (!t.forced) s += 1
                return s
            }
            candidates.sort((a, b) => score(b.track) - score(a.track) || a.order - b.order)
            return candidates[0].track
        }
    }

    return usable.find((t) => t.default) ?? usable.find((t) => t.forced)
}

interface ResolveAutoSubtitleOptions {
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

    // "Doblado" = el audio está en un idioma que el espectador no necesita leer: español
    // o el idioma de subtítulos que prefiere. Con subtítulos en español, un audio en
    // inglés NO cuenta como doblado (antes apagaba los subtítulos por error).
    const prefFamily = languageFamily(preferredSubtitleLang)
    const viewerLangs = prefFamily ? Array.from(new Set(["spa", prefFamily])) : undefined
    const isDubbed = isAudioTrackDubbed(currentAudio, viewerLangs)
    if (autoDisableSubtitlesWhenDubbed && isDubbed) {
        return null
    }

    return matchPreferredSubtitleTrack(subtitleTracks, preferredSubtitleLang) ?? null
}
