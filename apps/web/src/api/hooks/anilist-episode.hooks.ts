import { useServerQuery } from "@/api/client/requests"
import { API_ENDPOINTS } from "@/api/generated/endpoints"

export interface AniListEpisodeThumbnailResponse {
    anilistId: number
    absoluteEpisode: number
    title?: string
    thumbnailUrl: string | null
    url?: string
    site?: string
}

/**
 * Thumbnail del episodio vía AniList streamingEpisodes (fallback 3).
 * Sin API key y con cobertura completa (ej. Z 291 eps), pero thumbs de
 * calidad Crunchyroll y posibles huecos en series viejas: solo se usa
 * si falla local + TMDB.
 */
export function useGetAniListEpisodeThumbnail(
    anilistId: number | undefined | null,
    absoluteEpisode: number | undefined | null,
) {
    const valid = typeof anilistId === "number" && anilistId > 0 && typeof absoluteEpisode === "number" && absoluteEpisode > 0

    return useServerQuery<AniListEpisodeThumbnailResponse>({
        endpoint: API_ENDPOINTS.ANILIST.AniListEpisodeThumbnail.endpoint
            .replace(":anilistId", String(anilistId))
            .replace(":absolute", String(absoluteEpisode)),
        method: API_ENDPOINTS.ANILIST.AniListEpisodeThumbnail.methods[0],
        queryKey: [API_ENDPOINTS.ANILIST.AniListEpisodeThumbnail.key, anilistId, absoluteEpisode],
        enabled: Boolean(valid),
        staleTime: 24 * 60 * 60 * 1000, // 24h caché
        muteError: true,
    })
}
