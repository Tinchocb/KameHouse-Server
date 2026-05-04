import { useServerMutation, useServerQuery } from "@/api/client/requests"
import { API_ENDPOINTS } from "@/api/generated/endpoints"
import { Platform_UnifiedCollection, Platform_UnifiedMediaList } from "@/api/generated/types"
import { PlatformListAnime_Variables, PlatformListRecentAnime_Variables } from "@/api/generated/endpoint.types"
import { useQueryClient } from "@tanstack/react-query"

/**
 * Hook to refresh the collection.
 * This triggers a server-side refetch from the platform.
 */
export function useRefreshCollection() {
    const queryClient = useQueryClient()
    return useServerMutation<Platform_UnifiedCollection>({
        endpoint: API_ENDPOINTS.PLATFORM.GetCollection.endpoint,
        method: API_ENDPOINTS.PLATFORM.GetCollection.methods[1], // POST
        mutationKey: [API_ENDPOINTS.PLATFORM.GetCollection.key],
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: [API_ENDPOINTS.ANIME_COLLECTION.GetLibraryCollection.key] })
        }
    })
}

/**
 * Hook to search for media on the platform.
 */
export function usePlatformListAnime(variables: PlatformListAnime_Variables, enabled: boolean) {
    return useServerQuery<Platform_UnifiedMediaList, PlatformListAnime_Variables>({
        endpoint: API_ENDPOINTS.PLATFORM.ListAnime.endpoint,
        method: API_ENDPOINTS.PLATFORM.ListAnime.methods[0], // POST
        queryKey: [API_ENDPOINTS.PLATFORM.ListAnime.key, variables],
        data: variables,
        enabled: enabled,
    })
}

/**
 * Hook to list recent airing media from the platform.
 */
export function usePlatformListRecentAiringAnime(variables: PlatformListRecentAnime_Variables, enabled: boolean) {
    return useServerQuery<Platform_UnifiedMediaList, PlatformListRecentAnime_Variables>({
        endpoint: API_ENDPOINTS.PLATFORM.ListRecentAiringAnime.endpoint,
        method: API_ENDPOINTS.PLATFORM.ListRecentAiringAnime.methods[0], // POST
        queryKey: [API_ENDPOINTS.PLATFORM.ListRecentAiringAnime.key, variables],
        data: variables,
        enabled: enabled,
    })
}
