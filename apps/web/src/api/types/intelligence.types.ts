import type {
    Anime_Episode,
    Anime_LibraryCollectionEntry,
} from "@/api/generated/types"

export type CardAspect = "poster" | "wide" | "square"

/**
 * ContentTag mirrors the Go backend enum in internal/library/anime/intelligence.go
 */
export type ContentTag = "FILLER" | "EPIC" | "CANON" | "SPECIAL" | "HYPED" | "EMOTIONAL" | "INTENSE" | "CHILL"

/**
 * EpisodeIntelligence carries computed intelligence about a single episode or movie.
 * Mirrors the Go struct in internal/library/anime/intelligence.go
 */
export interface EpisodeIntelligence {
    /** 0–10 score derived from backend providers */
    rating: number
    /** Whether the episode is considered filler */
    isFiller: boolean
    /** Name of the narrative arc this episode belongs to */
    arcName: string
    /** Categorization tag (e.g. EPIC, FILLER) */
    tag: ContentTag
    /** Thematic or emotional vibes */
    vibes?: string[]
}

/**
 * An entry enriched with optional intelligence data.
 */
export interface IntelligentEntry extends Omit<Anime_LibraryCollectionEntry, "episode" | "dominantVibe" | "vibes" | "tags"> {
    /** Aggregated or specific intelligence for the item */
    intelligence?: EpisodeIntelligence
    /** AI-derived tags (Character, Technique, Lore) */
    tags?: string[]
    /** Primary vibe detected by the AI engine */
    dominantVibe?: string
    /** Thematic vibes for filtering */
    vibes?: string[]
    /** Local episode data if this entry is an episode swimlane */
    episode?: Anime_Episode
}
