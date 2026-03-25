/**
 * useEpisodeSources.ts
 *
 * TanStack Query hook that hits GET /api/v1/streaming/:mediaId/episode/:epNum/sources
 * and returns a typed EpisodeSourcesResponse.
 *
 * Design:
 * - Disabled until both mediaId and epNum are provided (no speculative firing).
 * - staleTime = 5 min — Torrentio results don't change frequently.
 * - Exposes `prefetchEpisodeSources(queryClient, params)` for onMouseEnter prefetching.
 */

import { useServerQuery } from "@/api/client/requests"
import type { EpisodeSourcesParams, EpisodeSourcesResponse } from "@/api/types/unified.types"

/** Stale window: 5 minutes — Torrentio index doesn't change more frequently. */
const EPISODE_SOURCES_STALE_MS = 1_000 * 60 * 5

/** Cache time: 15 minutes — keeps the result alive while the user browses the EP list. */
const EPISODE_SOURCES_GC_MS = 1_000 * 60 * 15

// ─────────────────────────────────────────────────────────────────────────────
// Query key factory
// ─────────────────────────────────────────────────────────────────────────────

export const episodeSourcesKey = (mediaId: number, epNum: number) =>
    ["streaming/episode-sources", mediaId, epNum] as const

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Resolves all available playback sources for a specific episode.
 */
export function useEpisodeSources(
    params: EpisodeSourcesParams | null,
    { enabled = true }: { enabled?: boolean } = {},
) {
    return useServerQuery<EpisodeSourcesResponse>({
        endpoint: `/api/v1/streaming/${params?.mediaId}/episode/${params?.epNum}/sources`,
        method: "GET",
        queryKey: params ? episodeSourcesKey(params.mediaId, params.epNum) : (["streaming/episode-sources", null] as const),
        enabled: enabled && !!params?.mediaId && !!params?.epNum,
        staleTime: EPISODE_SOURCES_STALE_MS,
        gcTime: EPISODE_SOURCES_GC_MS,
        retry: 1,
    })
}

import { buildSeaQuery } from "@/api/client/requests"
import { useQueryClient } from "@tanstack/react-query"

export function usePrefetchEpisodeSources() {
    const queryClient = useQueryClient()
    return (params: EpisodeSourcesParams) => {
        void queryClient.prefetchQuery({
            queryKey: episodeSourcesKey(params.mediaId, params.epNum),
            queryFn: () => buildSeaQuery<EpisodeSourcesResponse>({
                endpoint: `/api/v1/streaming/${params.mediaId}/episode/${params.epNum}/sources`,
                method: "GET",
            }),
            staleTime: EPISODE_SOURCES_STALE_MS,
        })
    }
}
