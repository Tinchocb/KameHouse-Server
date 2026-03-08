import {
    AL_BaseAnime,
    AL_BaseManga,
    Models_LibraryMedia,
} from "@/api/generated/types"

/**
 * Checks if a given object is a valid AniList Media object (Anime or Manga).
 * This is useful when the backend returns a heterogeneous mix of `Models_LibraryMedia`
 * and AniList DTOs, preventing TypeScript compilation errors for missing fields like
 * `coverImage`, `title`, or `episodes`.
 */
export function isAniListMedia(media: any): media is AL_BaseAnime | AL_BaseManga {
    return (
        media &&
        typeof media === "object" &&
        ("title" in media || "coverImage" in media || "meanScore" in media)
    )
}

/**
 * Ensures a polymorphic media object is explicitly cast to `AL_BaseAnime`
 * when it resolves from the library collection endpoints.
 */
export function asBaseAnime(media: AL_BaseAnime | AL_BaseManga | Models_LibraryMedia | undefined | null): AL_BaseAnime | undefined {
    if (isAniListMedia(media)) {
        return media as AL_BaseAnime
    }
    return undefined // or map it if you want to create a synthetic object
}

/**
 * Ensures a polymorphic media object is explicitly cast to `AL_BaseManga`
 */
export function asBaseManga(media: AL_BaseAnime | AL_BaseManga | Models_LibraryMedia | undefined | null): AL_BaseManga | undefined {
    if (isAniListMedia(media)) {
        return media as AL_BaseManga
    }
    return undefined
}
