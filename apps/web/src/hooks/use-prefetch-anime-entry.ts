import { useCallback } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { API_ENDPOINTS } from "@/api/generated/endpoints"
import { fetchAnimeEntry } from "@/api/hooks/anime_entries.hooks"

/**
 * Prefetch de la ficha AnimeEntry al hover/focus de una tarjeta.
 * Extraído de SeriesCard/MovieCard, que duplicaban esta lógica.
 */
export function usePrefetchAnimeEntry(id: number | null | undefined) {
    const queryClient = useQueryClient()
    return useCallback(() => {
        if (id == null) return
        const strId = String(id)
        queryClient.prefetchQuery({
            queryKey: [API_ENDPOINTS.ANIME_ENTRIES.GetAnimeEntry.key, strId],
            queryFn: () => fetchAnimeEntry(strId),
            staleTime: 60000,
        })
    }, [queryClient, id])
}
