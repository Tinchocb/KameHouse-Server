import { useServerQuery } from "../client/requests"
import { API_ENDPOINTS } from "../generated/endpoints"
import type { ChronologyResponse } from "../generated/types"

/**
 * Hook to retrieve the official Dragon Ball canon timeline from the server,
 * including user watch progress and media hydration.
 */
export function useGetChronologyTimeline(options?: { enabled?: boolean }) {
    return useServerQuery<ChronologyResponse>({
        endpoint: API_ENDPOINTS.INTELLIGENCE.GetChronologyTimeline.endpoint,
        method: API_ENDPOINTS.INTELLIGENCE.GetChronologyTimeline.methods[0],
        queryKey: [API_ENDPOINTS.INTELLIGENCE.GetChronologyTimeline.key],
        enabled: options?.enabled ?? true,
        staleTime: 60 * 1000, // 1 minute cache
        refetchOnWindowFocus: false,
    })
}
