import { errorText } from "@/api/client/error-messages"
import { useQueryClient } from "@tanstack/react-query"
import { useServerMutation } from "@/api/client/requests"
import { API_ENDPOINTS } from "@/api/generated/endpoints"
import type {
    ResolveUnlinkedFile_Variables,
    TMDBAssign_Variables,
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
    provider?: "tmdb" | "jikan"
}

function invalidateLibrary(queryClient: ReturnType<typeof useQueryClient>) {
    return Promise.all([
        queryClient.invalidateQueries({ queryKey: [API_ENDPOINTS.SCAN.GetUnlinkedFiles.key] }),
        queryClient.invalidateQueries({ queryKey: [API_ENDPOINTS.ANIME_COLLECTION.GetLibraryCollection.key] }),
        // La ficha abierta también cambia (título, arte, episodios del nuevo TMDB).
        queryClient.invalidateQueries({ queryKey: [API_ENDPOINTS.ANIME_ENTRIES.GetAnimeEntry.key] }),
    ])
}

export function useTMDBSearch() {
    return useServerMutation<TMDBSearchResult[], TMDBSearch_Variables>({
        endpoint: API_ENDPOINTS.TMDB.TMDBSearch.endpoint,
        method: API_ENDPOINTS.TMDB.TMDBSearch.methods[0],
        mutationKey: [API_ENDPOINTS.TMDB.TMDBSearch.key],
    })
}

export function useTMDBAssign() {
    const queryClient = useQueryClient()
    return useServerMutation<boolean, TMDBAssign_Variables & { provider: "tmdb" | "jikan"; externalId: number }>({
        endpoint: API_ENDPOINTS.TMDB.TMDBAssign.endpoint,
        method: API_ENDPOINTS.TMDB.TMDBAssign.methods[0],
        mutationKey: [API_ENDPOINTS.TMDB.TMDBAssign.key],
        onSuccess: async () => {
            await invalidateLibrary(queryClient)
            toast.success("TMDB asignado con éxito")
        },
        onError: (err) => {
            toast.error(errorText(err, "No se pudo asignar TMDB"))
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
            toast.error(errorText(err, "No se pudo guardar el vínculo"))
        },
    })
}
