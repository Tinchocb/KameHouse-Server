import { useServerQuery } from "@/api/client/requests"
import type { SelectionResult } from "@/api/types/intelligence.types"

export interface UseBestSourceOptions {
    tmdbId: number
    episode: number
    preferredLangs?: string[]
    enabled?: boolean
}

export function useBestSource({ tmdbId, episode, preferredLangs, enabled = true }: UseBestSourceOptions) {
    const langParam = preferredLangs?.join(",") || "spa,eng"

    return useServerQuery<SelectionResult>({
        endpoint: `/api/v1/intelligence/best-source?tmdbId=${tmdbId}&episode=${episode}&preferredLangs=${langParam}`,
        method: "GET",
        queryKey: ["intelligence", "best-source", tmdbId, episode, langParam],
        enabled: enabled && tmdbId > 0 && episode > 0,
    })
}
