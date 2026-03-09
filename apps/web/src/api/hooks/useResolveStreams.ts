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

const RESOLVER_STALE_TIME = 1000 * 60 * 5 // 5 minutes

async function fetchResolvedStreams(params: ResolveStreamsParams): Promise<UnifiedResolutionResponse> {
    const url = new URL("/api/v1/resolver/streams", window.location.origin)
    url.searchParams.set("mediaId", String(params.mediaId))
    url.searchParams.set("episode", String(params.episode))
    if (params.mediaType) {
        url.searchParams.set("mediaType", String(params.mediaType))
    }

    const res = await fetch(url.toString())
    if (!res.ok) {
        throw new Error(`Resolver error: ${res.status} ${res.statusText}`)
    }
    const json = await res.json() as { data: UnifiedResolutionResponse }
    return json.data
}

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
        queryFn: () => fetchResolvedStreams(params!),
        enabled: enabled && !!params?.mediaId && !!params?.episode,
        staleTime: RESOLVER_STALE_TIME,
        retry: 1,
    })
}
