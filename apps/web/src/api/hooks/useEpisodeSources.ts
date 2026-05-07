import { useServerQuery, buildSeaQuery } from "@/api/client/requests"
import { API_ENDPOINTS } from "@/api/generated/endpoints"
import type { EpisodeSourcesParams, EpisodeSourcesResponse, EpisodeSource, UnifiedResolutionResponse } from "@/api/types/unified.types"
import { useQueryClient } from "@tanstack/react-query"
import React from "react"

export function useEpisodeSources(params: EpisodeSourcesParams | null) {
    return useServerQuery<UnifiedResolutionResponse, any, EpisodeSourcesResponse>({
        endpoint: API_ENDPOINTS.RESOLVER.ResolveStreams.endpoint,
        method: "GET",
        queryKey: [API_ENDPOINTS.RESOLVER.ResolveStreams.key, params?.mediaId, params?.epNum],
        params: params ? { mediaId: params.mediaId, episode: params.epNum } : undefined,
        enabled: !!params?.mediaId && !!params?.epNum,
        select: (data: UnifiedResolutionResponse | undefined): EpisodeSourcesResponse => {
            const unified = data || { title: "", sources: [] }
            const sources: EpisodeSource[] = (unified.sources || []).map((s) => ({
                type: s.type.toLowerCase() as any, // "local"
                url: s.urlPath,
                path: s.urlPath,
                quality: s.quality,
                priority: s.rank ?? 1,
                title: `${s.provider} — ${s.quality}`,
            }))
            return {
                episodeNumber: params?.epNum ?? 1,
                title: unified.title,
                sources: sources,
                playSource: sources.length > 0 ? "local" : "",
            }
        }
    })
}

export function usePrefetchEpisodeSources() {
    const qc = useQueryClient()
    return React.useCallback((params: EpisodeSourcesParams) => {
        qc.prefetchQuery({
            queryKey: [API_ENDPOINTS.RESOLVER.ResolveStreams.key, params.mediaId, params.epNum],
            queryFn: () => buildSeaQuery<UnifiedResolutionResponse>({
                endpoint: API_ENDPOINTS.RESOLVER.ResolveStreams.endpoint,
                method: "GET",
                params: { mediaId: params.mediaId, episode: params.epNum } as any,
            })
        })
    }, [qc])
}