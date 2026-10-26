/**
 * track-types.ts
 *
 * Shared TypeScript types for audio/subtitle track metadata.
 *
 * ─── Backend contract ──────────────────────────────────────────────────────────
 *
 * The backend should expose a dedicated endpoint (or include this in the stream
 * start response) that returns the available tracks extracted from the MKV
 * container header via `ffprobe` or `mkvmerge -J`.
 *
 * Recommended endpoint:
 *
 *   GET /api/v1/mediastream/track-info?streamId=<id>
 *
 * Example JSON response:
 * ```json
 * {
 *   "audioTracks": [
 *     { "index": 0, "language": "jpn", "title": "Japanese",          "codec": "FLAC",     "channels": 2, "default": true  },
 *     { "index": 1, "language": "spa", "title": "Español Latino",    "codec": "AAC",      "channels": 2, "default": false }
 *   ],
 *   "subtitleTracks": [
 *     { "index": 0, "language": "spa", "title": "Español",           "codec": "ASS",      "forced": false, "default": true  },
 *     { "index": 1, "language": "eng", "title": "English (Honorifics)","codec": "ASS",    "forced": false, "default": false },
 *     { "index": 2, "language": "spa", "title": "Español (Forzado)", "codec": "ASS",      "forced": true,  "default": false }
 *   ]
 * }
 * ```
 *
 * For **HLS transcode** streams, the backend additionally embeds audio track IDs
 * into the HLS manifest as `#EXT-X-MEDIA` tags; HLS.js surfaces these via
 * `Hls.Events.AUDIO_TRACKS_UPDATED`.  Both paths converge to the same
 * `AudioTrack` shape below so the UI layer is agnostic.
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ── Audio ───────────────────────────────────────────────────────────────────────

/**
 * Represents a single audio track inside a media container.
 *
 * For HLS streams this struct is built by merging hls.js audioTracks with
 * backend metadata. For direct-play streams it is seeded from the backend
 * mediaInfo response.
 */
export interface AudioTrack {
    /**
     * Absolute container index (MKV track number / ffprobe stream index).
     * Used by the backend in audio URIs: `./audio/{index}/index.m3u8`.
     * For native HTML5 AudioTrackList, use this as the array index.
     */
    index: number
    /**
     * hls.js internal id (sequential position in the manifest: 0, 1, 2…).
     * Only populated for HLS streams. Use this for `hls.audioTrack = hlsId`.
     * Distinct from `index` because hls.js ids are always sequential while
     * container indexes can have gaps (e.g. container has streams 0, 2, 5).
     */
    hlsId?: number
    /** BCP-47 / ISO 639-2 language code, e.g. "jpn", "spa", "eng". */
    language: string
    /** Human-readable label as embedded in the MKV — fall back to `language` if absent. */
    title: string
    /** Codec string, e.g. "FLAC", "AAC", "AC3", "OPUS". */
    codec?: string
    /** Number of audio channels (2 = stereo, 6 = 5.1, 8 = 7.1). */
    channels?: number
    /** Whether this is the default track as embedded in the container. */
    default?: boolean
}

// ── Subtitles ──────────────────────────────────────────────────────────────────

/**
 * Codec-agnostic subtitle track descriptor.
 *
 * For `.ass` / `.ssa` tracks `jassub` is used; for `subrip` (SRT) or external
 * tracks the native `<track>` element / VTT approach is used instead.
 * The UI component checks `codec` to decide the rendering strategy.
 */
export interface SubtitleTrack {
    /** Zero-based index in the MKV container. */
    index: number
    /** BCP-47 / ISO 639-2 language code. */
    language: string
    /** Human-readable label from the container metadata. */
    title: string
    /**
     * Container codec: "ass" | "ssa" | "subrip" | "webvtt" | "hdmv_pgs_subtitle".
     * Los subtítulos externos (.srt/.ass junto al video) usan índices desde 1000.
     * The player uses this to choose the renderer (jassub vs. native <track>).
     */
    codec?: string
    /**
     * URL to a pre-extracted subtitle file served by the backend.
     *
     * For **jassub** this must point to the raw `.ass` file.
     * Endpoint example:
     *   GET /api/v1/mediastream/subtitles?path=<path>&trackIndex=<n>&clientId=<id>
     *
     * Image-based tracks (PGS/DVB) do NOT have a url — they require burn-in during transcode.
     */
    url?: string
    /** Whether this is a forced-subtitle-only track (signs/songs). */
    forced?: boolean
    /** Whether this is flagged as the default track in the container. */
    default?: boolean
    /**
     * True for bitmap subtitle codecs (PGS, DVB, XSUB) that cannot be
     * extracted as text. These require burn-in during transcode to be
     * rendered in a browser. When true, `url` is undefined and JASSUB
     * must NOT be used.
     */
    isImageBased?: boolean
    /**
     * Pista embebida en un archivo de Google Drive que todavía no se extrajo: ver la
     * pista en el menú es posible, pero no tiene `url` hasta que el usuario la extrae
     * (lee el archivo completo una vez).
     */
    needsExtraction?: boolean
    /**
     * Pista de texto de un archivo de Google Drive que el servidor lee por franjas de
     * tiempo, siguiendo la posición del reproductor (no hace falta bajar el archivo
     * entero). Tiene `url`, pero lo que devuelve crece mientras se reproduce: el
     * reproductor la recarga cuando hay subtítulos nuevos cerca de la posición.
     */
    progressive?: boolean
}

// ── UI Props ─────────────────────────────────────────────────────────────────────

/**
 * Props for the PlayerSettingsMenu component.
 * Centralizes all playback, audio, and subtitle settings.
 */
export interface PlayerSettingsMenuProps {
    /** Nodo donde se monta el panel de escritorio. Debe estar FUERA de cualquier
     * superficie con backdrop-filter: si no, el panel queda atrapado en su
     * stacking context (debajo de los overlays) y su blur no funciona. */
    panelContainer?: HTMLElement | null
    /** Qué agrupa el menú: "media" = audio y subtítulos en un solo panel; "more" =
     * velocidad, maratón, calidad e imagen; "all" (por defecto) = menú completo. */
    variant?: "all" | "media" | "more"
    /** Navegación por capítulos dentro de "Más" (solo si hay capítulos). */
    onPrevChapter?: () => void
    onNextChapter?: () => void
    audioTracks: AudioTrack[]
    activeAudioIndex: number
    onSelectAudio: (track: AudioTrack) => void
    
    subtitleTracks: SubtitleTrack[]
    activeSubtitleIndex: number | null
    onSelectSubtitle: (track: SubtitleTrack | null, opts?: { auto?: boolean }) => void
    isLoadingSubtitle?: boolean

    sources?: import("@/api/types/unified.types").EpisodeSource[]
    currentSourceUrl?: string
    currentSourceType?: string
    onSourceChange?: (source: import("@/api/types/unified.types").EpisodeSource) => void

    hlsLevels?: { index: number; label: string; height: number }[]
    activeHlsLevel?: number
    onHlsLevelChange?: (level: number) => void

    playbackRate?: number
    onPlaybackRateChange?: (rate: number) => void

    autoSkipIntro?: boolean
    onAutoSkipIntroChange?: (auto: boolean) => void

    autoSkipOutro?: boolean
    onAutoSkipOutroChange?: (auto: boolean) => void

    aspectRatio?: "contain" | "fill" | "cover" | "16/9" | "21/9"
    onAspectRatioChange?: (ratio: "contain" | "fill" | "cover" | "16/9" | "21/9") => void

    subtitleSize?: number
    onSubtitleSizeChange?: (size: number) => void

    loopEnabled?: boolean
    onLoopEnabledChange?: (enabled: boolean) => void

    autoDisableSubtitlesWhenDubbed?: boolean
    onAutoDisableSubtitlesWhenDubbedChange?: (auto: boolean) => void

    tvMode?: boolean
    onTvModeChange?: (enabled: boolean) => void

    marathonMode?: boolean
    onMarathonModeChange?: (enabled: boolean) => void

    open?: boolean
    onOpenChange?: (open: boolean) => void
    className?: string

    mediaFormat?: string | null
    videoRef?: React.RefObject<HTMLVideoElement | null>
    malId?: number | null
    duration?: number
    mediaId?: number
    episodeNumber?: number
}