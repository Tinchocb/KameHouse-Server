/**
 * useResolveStreams.ts
 *
 * TanStack Query hook that hits GET /api/v1/resolver/streams and returns
 * a prioritised list of ResolvedSource objects.
 *
 * - Local sources are first (available immediately from the DB cache).
 * - Torrentio sources follow, sorted by quality (best first).
 * - The query is kept disabled until both mediaId and episode are truthy
 *   so it never fires speculatively.
 */

import { useQuery } from "@tanstack/react-query"
import type { ResolveStreamsParams, UnifiedResolutionResponse } from "@/api/types/unified.types"
import { buildSeaQuery } from "@/api/client/requests"

const RESOLVER_STALE_TIME = 1000 * 60 * 5 // 5 minutes

/**
 * Resolves all available playback sources for a specific episode.
 *
 * @param params - mediaId + episode are required; mediaType is optional.
 * @param enabled - Set to false to keep the query dormant until the user presses Play.
 */
export function useResolveStreams(
    params: ResolveStreamsParams | null,
    { enabled = true }: { enabled?: boolean } = {},
) {
    return useQuery({
        queryKey: ["resolver/streams", params?.mediaId, params?.episode, params?.mediaType],
        queryFn: () => buildSeaQuery<UnifiedResolutionResponse>({
            endpoint: "/api/v1/resolver/streams",
            method: "GET",
            params: {
                mediaId: params!.mediaId,
                episode: params!.episode,
                ...(params!.mediaType ? { mediaType: params!.mediaType } : {}),
            } as any,
        }) as Promise<UnifiedResolutionResponse>,
        enabled: enabled && !!params?.mediaId && !!params?.episode,
        staleTime: RESOLVER_STALE_TIME,
        retry: 1,
    })
}
