/**
 * unified.types.ts
 *
 * Hand-written types mirroring the Go structs in core/resolver.go.
 * Do NOT merge into api/generated/types.ts — that file is auto-generated.
 */

export type SourceType = "Local" | "Torrent" | "Debrid"

export interface SourceMetadata {
    bitrate?: number
    seeders?: number
}

export interface MediaSource {
    type: SourceType
    urlPath: string
    quality: string
    resolution: number
    provider: string
    size: number
    seeders: number
    rank: number
}

export interface UnifiedResolutionResponse {
    title: string
    id: string
    availabilityType: "FULL_LOCAL" | "HYBRID" | "ONLY_ONLINE"
    sources: MediaSource[]
}

export interface ResolveStreamsParams {
    mediaId: number
    episode: number
    mediaType?: string
}
