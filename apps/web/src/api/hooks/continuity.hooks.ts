import { useQueryClient } from "@tanstack/react-query"
import { useServerMutation, useServerQuery } from "@/api/client/requests"
import { UpdateContinuityWatchHistoryItem_Variables } from "@/api/generated/endpoint.types"
import { Continuity_WatchHistory, Continuity_WatchHistoryItemResponse } from "@/api/generated/types"
import { API_ENDPOINTS } from "@/api/generated/endpoints"

const continuityQueryKeys = {
    all: ["continuity"] as const,
    history: () => [API_ENDPOINTS.CONTINUITY.GetContinuityWatchHistory.key] as const,
    item: (id?: number | string | null) => [API_ENDPOINTS.CONTINUITY.GetContinuityWatchHistoryItem.key, Number(id)] as const,
}

export function useUpdateContinuityWatchHistoryItem() {
    const queryClient = useQueryClient()
    return useServerMutation<boolean, UpdateContinuityWatchHistoryItem_Variables>({
        endpoint: API_ENDPOINTS.CONTINUITY.UpdateContinuityWatchHistoryItem.endpoint,
        method: API_ENDPOINTS.CONTINUITY.UpdateContinuityWatchHistoryItem.methods[0],
        mutationKey: [API_ENDPOINTS.CONTINUITY.UpdateContinuityWatchHistoryItem.key],
        onSuccess: async (_data, variables) => {
            await queryClient.invalidateQueries({ queryKey: continuityQueryKeys.history() })
            if (variables?.options?.mediaId != null) {
                await queryClient.invalidateQueries({
                    queryKey: continuityQueryKeys.item(variables.options.mediaId)
                })
            }
        }
    })
}

export function useGetContinuityWatchHistoryItem(id: number | string) {
    const numericId = Number(id)
    return useServerQuery<Continuity_WatchHistoryItemResponse>({
        endpoint: API_ENDPOINTS.CONTINUITY.GetContinuityWatchHistoryItem.endpoint.replace("{id}", String(numericId)),
        method: API_ENDPOINTS.CONTINUITY.GetContinuityWatchHistoryItem.methods[0],
        queryKey: continuityQueryKeys.item(numericId),
        enabled: Number.isFinite(numericId) && numericId > 0,
        staleTime: 30_000, // 30s: reduce refetch storms, still fresh enough for watch history
    })
}

export function useGetContinuityWatchHistory() {
    return useServerQuery<Continuity_WatchHistory>({
        endpoint: API_ENDPOINTS.CONTINUITY.GetContinuityWatchHistory.endpoint,
        method: API_ENDPOINTS.CONTINUITY.GetContinuityWatchHistory.methods[0],
        queryKey: continuityQueryKeys.history(),
        enabled: true,
        staleTime: 30_000, // 30s: reduce refetch storms
    })
}

