import { useQueryClient } from "@tanstack/react-query"
import { useServerMutation } from "@/api/client/requests"
import { API_ENDPOINTS } from "@/api/generated/endpoints"
import type {
    ResolveUnlinkedFile_Variables,
    TMDBAssign_Variables,
    TMDBGetDetails_Variables,
    TMDBSearch_Variables,
} from "@/api/generated/endpoint.types"
import { toast } from "sonner"

export interface TMDBSearchResult {
    id: number
    name?: string
    title?: string
    poster_path?: string
    overview?: string
    vote_average?: number
    media_type?: string
    is_jikan?: boolean
}

export interface TMDBDetailsResult {
    id: number
    alternativeTitles?: { title?: string; type?: string }[]
}

function invalidateLibrary(queryClient: ReturnType<typeof useQueryClient>) {
    return Promise.all([
        queryClient.invalidateQueries({ queryKey: [API_ENDPOINTS.SCAN.GetUnlinkedFiles.key] }),
        queryClient.invalidateQueries({ queryKey: [API_ENDPOINTS.ANIME_COLLECTION.GetLibraryCollection.key] }),
    ])
}

export function useTMDBSearch() {
    return useServerMutation<TMDBSearchResult[], TMDBSearch_Variables>({
        endpoint: API_ENDPOINTS.TMDB.TMDBSearch.endpoint,
        method: API_ENDPOINTS.TMDB.TMDBSearch.methods[0],
        mutationKey: [API_ENDPOINTS.TMDB.TMDBSearch.key],
    })
}

export function useTMDBGetDetails() {
    return useServerMutation<TMDBDetailsResult, TMDBGetDetails_Variables>({
        endpoint: API_ENDPOINTS.TMDB.TMDBGetDetails.endpoint,
        method: API_ENDPOINTS.TMDB.TMDBGetDetails.methods[0],
        mutationKey: [API_ENDPOINTS.TMDB.TMDBGetDetails.key],
    })
}

export function useTMDBAssign() {
    const queryClient = useQueryClient()
    return useServerMutation<boolean, TMDBAssign_Variables>({
        endpoint: API_ENDPOINTS.TMDB.TMDBAssign.endpoint,
        method: API_ENDPOINTS.TMDB.TMDBAssign.methods[0],
        mutationKey: [API_ENDPOINTS.TMDB.TMDBAssign.key],
        onSuccess: async () => {
            await invalidateLibrary(queryClient)
            toast.success("TMDB asignado con éxito")
        },
        onError: (err) => {
            toast.error(err instanceof Error ? err.message : "No se pudo asignar TMDB")
        },
    })
}

export function useResolveUnlinkedFile() {
    const queryClient = useQueryClient()
    return useServerMutation<unknown, ResolveUnlinkedFile_Variables>({
        endpoint: API_ENDPOINTS.SCAN.ResolveUnlinkedFile.endpoint,
        method: API_ENDPOINTS.SCAN.ResolveUnlinkedFile.methods[0],
        mutationKey: [API_ENDPOINTS.SCAN.ResolveUnlinkedFile.key],
        onSuccess: async () => {
            await invalidateLibrary(queryClient)
            toast.success("Vínculo guardado, se materializa en el próximo escaneo")
        },
        onError: (err) => {
            toast.error(err instanceof Error ? err.message : "No se pudo guardar el vínculo")
        },
    })
}
