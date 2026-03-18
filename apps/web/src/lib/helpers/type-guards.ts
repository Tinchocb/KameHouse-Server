import {
    Platform_UnifiedMedia,
    Models_LibraryMedia,
} from "@/api/generated/types"

/**
 * Checks if a given object is a valid Platform Unified Media object.
 */
export function isPlatformMedia(media: any): media is Platform_UnifiedMedia {
    return (
        media &&
        typeof media === "object" &&
        ("title" in media || "coverImage" in media)
    )
}

/**
 * Ensures a polymorphic media object is explicitly cast to `Platform_UnifiedMedia`
 * when it resolves from various media endpoints.
 */
export function asUnifiedMedia(media: any): Platform_UnifiedMedia | undefined {
    if (isPlatformMedia(media)) {
        return media as Platform_UnifiedMedia
    }
    return undefined
}
