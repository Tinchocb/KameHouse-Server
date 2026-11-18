import type { Anime_LibraryCollectionEntry } from "@/api/generated/types"

export type CardAspect = "poster" | "wide" | "square"

/**
 * An entry enriched with optional intelligence data.
 */
export interface IntelligentEntry extends Omit<Anime_LibraryCollectionEntry, "episode" | "dominantVibe" | "vibes" | "tags"> {
    /** Thematic vibes for filtering */
    vibes?: string[]
}
