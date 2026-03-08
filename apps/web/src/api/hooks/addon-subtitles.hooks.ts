import { useServerQuery } from "@/api/client/requests"

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AddonSubtitleEntry {
    id: string
    lang: string
    url: string
}

// ─── Hook ────────────────────────────────────────────────────────────────────

/**
 * Fetches aggregated subtitles from all installed HTTP Addons for a given media.
 * @param mediaType - e.g. "series", "movie"
 * @param mediaId   - AniList or TMDB ID
 */
export function useGetAddonSubtitles(mediaType: string, mediaId: string | number | undefined) {
    return useServerQuery<AddonSubtitleEntry[]>({
        endpoint: `/api/v1/addons/subtitles/${mediaType}/${mediaId}`,
        method: "GET",
        queryKey: ["addons-subtitles", mediaType, String(mediaId)],
        enabled: !!mediaId,
    })
}
