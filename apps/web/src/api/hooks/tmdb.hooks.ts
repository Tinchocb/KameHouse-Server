import { useServerQuery } from "@/api/client/requests"
import type { TMDBImagesResponse } from "@/lib/helpers/hero-image-resolver"

/**
 * Consulta la lista completa de imágenes (backdrops limpios, posters y logos)
 * de una película o serie desde TMDb a través del backend de KameHouse.
 */
export function useGetTMDBImages(mediaType: "tv" | "movie" | undefined, tmdbId: number | undefined | null) {
    const validId = typeof tmdbId === "number" && tmdbId > 0
    const validMediaType = mediaType === "tv" || mediaType === "movie"

    return useServerQuery<TMDBImagesResponse>({
        endpoint: `/api/v1/tmdb/images/${mediaType}/${tmdbId}`,
        method: "GET",
        queryKey: ["tmdb-images", mediaType, tmdbId],
        enabled: Boolean(validId && validMediaType),
        staleTime: 24 * 60 * 60 * 1000, // 24 horas de caché
        muteError: true,
    })
}
