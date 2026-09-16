/**
 * unified.types.ts
 *
 * Hand-written types mirroring the Go structs in core/resolver.go.
 * Do NOT merge into api/generated/types.ts — that file is auto-generated.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Episode Sources — mirrors Go dto.EpisodeSourcesResponse
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Mirrors `dto.SourceType` constants on the server.
 * - `"local"`     → file on disk, served via local HLS pipeline
 */
type EpisodeSourceType = "local" | "direct" | "transcode" | "optimized" | "online"

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
