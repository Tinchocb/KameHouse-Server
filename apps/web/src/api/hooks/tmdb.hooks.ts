import { useServerMutation } from "@/api/client/requests"
import { API_ENDPOINTS } from "@/api/generated/endpoints"
import { TMDBSearch_Variables, TMDBGetDetails_Variables } from "@/api/generated/endpoint.types"
import { SearchResult } from "@/api/generated/types"

/**
 * Hook to search TMDB for TV shows or movies.
 */
export function useTMDBSearch() {
    return useServerMutation<SearchResult[], TMDBSearch_Variables>({
        endpoint: API_ENDPOINTS.TMDB.TMDBSearch.endpoint,
        method: API_ENDPOINTS.TMDB.TMDBSearch.methods[0],
        mutationKey: [API_ENDPOINTS.TMDB.TMDBSearch.key],
    })
}

/**
 * Hook to get TMDB TV show details and alternative titles.
 */
export function useTMDBGetDetails() {
    return useServerMutation<{ tvId: number, alternativeTitles: any[] }, TMDBGetDetails_Variables>({
        endpoint: API_ENDPOINTS.TMDB.TMDBGetDetails.endpoint,
        method: API_ENDPOINTS.TMDB.TMDBGetDetails.methods[0],
        mutationKey: [API_ENDPOINTS.TMDB.TMDBGetDetails.key],
    })
}
