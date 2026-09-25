import { useServerQuery } from "@/api/client/requests"
import { API_ENDPOINTS } from "@/api/generated/endpoints"

export interface TMDBEpisodeStillResponse {
    tvId: number
    season: number
    episode: number
    absoluteEpisode?: number
    name?: string
    overview?: string
    stillPath: string | null
    stillUrl: string | null
    airDate?: string
}

/**
 * Still real del episodio vía backend KameHouse (que mapea absoluto→season/episodio en TMDB).
 * Híbrido: solo se usa si no hay miniatura local curada.
 */
export function useGetTMDBEpisodeStill(
    tvId: number | undefined | null,
    absoluteEpisode: number | undefined | null,
    options: { enabled?: boolean } = {},
) {
    const valid = typeof tvId === "number" && tvId > 0 && typeof absoluteEpisode === "number" && absoluteEpisode > 0

    return useServerQuery<TMDBEpisodeStillResponse>({
        endpoint: API_ENDPOINTS.TMDB.TMDBEpisodeStill.endpoint
            .replace(":tvId", String(tvId))
            .replace(":absolute", String(absoluteEpisode)),
        method: API_ENDPOINTS.TMDB.TMDBEpisodeStill.methods[0],
        queryKey: [API_ENDPOINTS.TMDB.TMDBEpisodeStill.key, tvId, absoluteEpisode],
        enabled: Boolean(valid) && options.enabled !== false,
        staleTime: 24 * 60 * 60 * 1000, // 24h caché
        muteError: true,
    })
}

export function buildTmdbStillUrl(stillPath: string | null | undefined, size: "w185" | "w300" | "w780" | "original" = "w780"): string | undefined {
    if (!stillPath || stillPath.trim() === "") return undefined
    const clean = stillPath.startsWith("/") ? stillPath : `/${stillPath}`
    return `https://image.tmdb.org/t/p/${size}${clean}`
}
