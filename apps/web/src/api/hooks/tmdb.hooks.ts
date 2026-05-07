import { useServerQuery } from "@/api/client/requests"
import { API_ENDPOINTS } from "@/api/generated/endpoints"

export interface TMDBResult {
    id: number
    title?: string
    name?: string
    release_date?: string
    first_air_date?: string
    poster_path?: string | null
    overview?: string
    media_type?: "movie" | "tv"
}

interface TMDBSearchVariables {
    query: string
    searchType?: "tv" | "movie" | "multi"
}

export function useTMDBSearch(query: string, searchType: "tv" | "movie" | "multi" = "multi") {
    return useServerQuery<TMDBResult[], TMDBSearchVariables, TMDBResult[]>({
        endpoint: API_ENDPOINTS.TMDB.TMDBSearch.endpoint,
        method: API_ENDPOINTS.TMDB.TMDBSearch.methods[0],
        params: {
            query,
            searchType,
        },
        queryKey: ["tmdb-search", query, searchType],
        enabled: query.trim().length >= 2,
        staleTime: 30_000,
    })
}