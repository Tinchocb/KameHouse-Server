/**
 * unified.types.ts
 *
 * Hand-written types mirroring the Go structs in core/resolver.go.
 * Do NOT merge into api/generated/types.ts — that file is auto-generated.
 */

export type SourceType = "Local"

export interface SourceMetadata {
    bitrate?: number
}

export interface MediaSource {
    type: SourceType
    urlPath: string
    quality: string
    resolution: number
    provider: string
    size: number
    rank: number
}

export interface UnifiedResolutionResponse {
    title: string
    id: string
    availabilityType: "FULL_LOCAL"
    sources: MediaSource[]
}

export interface ResolveStreamsParams {
    mediaId: number
    episode: number
    mediaType?: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Episode Sources — mirrors Go dto.EpisodeSourcesResponse
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Mirrors `dto.SourceType` constants on the server.
 * - `"local"`     → file on disk, served via local HLS pipeline
 */
export type EpisodeSourceType = "local" | "direct" | "transcode" | "optimized" | "online"

export interface EpisodeSource {
    /** Discriminates between local and online sources. */
    type: EpisodeSourceType
    /** Path or ID used to request the stream from the mediastream repository. */
    url: string
    /** Physical filesystem path — only present for local sources. */
    path?: string
    /** Human-readable quality label, e.g. "1080p", "4K". */
    quality: string
    /** Lower number = higher priority. Local = 1. */
    priority: number
    /** Display title, e.g. "Local — Episode 5". */
    title: string
}

export interface EpisodeSourcesResponse {
    episodeNumber: number
    /** Optional episode title from metadata. */
    title?: string
    sources: EpisodeSource[]
    /**
     * The source type the player should auto-select.
     * Equals the `type` of the highest-priority source in `sources`.
     * Empty string when no sources were resolved.
     */
    playSource: EpisodeSourceType | ""
}

export interface EpisodeSourcesParams {
    mediaId: number
    epNum: number
}

// ─────────────────────────────────────────────────────────────────────────────
// Technical Information Aliases
// ─────────────────────────────────────────────────────────────────────────────

export type TechnicalInfo = NonNullable<import("@/api/generated/types").Anime_LocalFile["technicalInfo"]>
export type ExtendedLocalFile = import("@/api/generated/types").Anime_LocalFile
export type NormalizedMedia = import("@/api/generated/types").Models_LibraryMedia
