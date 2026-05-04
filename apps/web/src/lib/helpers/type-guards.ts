import {
    Platform_UnifiedMedia,
} from "@/api/generated/types"

/**
 * Checks if a given object is a valid Platform Unified Media object.
 */
export function isPlatformMedia(media: unknown): media is Platform_UnifiedMedia {
    return (
        media !== null &&
        typeof media === "object" &&
        ("title" in media || "coverImage" in media)
    )
}

/**
 * Ensures a polymorphic media object is explicitly cast to `Platform_UnifiedMedia`
 * when it resolves from various media endpoints.
 */
export function asUnifiedMedia(media: unknown): Platform_UnifiedMedia | undefined {
    if (isPlatformMedia(media)) {
        return media as Platform_UnifiedMedia
    }
    return undefined
}
