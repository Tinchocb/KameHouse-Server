import * as React from "react"
import type { UnifiedResolutionResponse } from "@/api/types/unified.types"
import { buildSeaQuery } from "@/api/client/requests"

/**
 * Hook for quick media playback resolution.
 *
 * Uses the `/api/v1/resolver/streams` endpoint (same backend handler as
 * `useResolveStreams`) to resolve sources for the first episode.
 */
export function useQuickPlay(onFallback: (mediaId: number) => void) {
    const [resolution, setResolution] = React.useState<UnifiedResolutionResponse | null>(null)
    const [isResolving, setIsResolving] = React.useState(false)

    const open = React.useCallback(
        async (mediaId: number) => {
            setIsResolving(true)
            try {
                const data = await buildSeaQuery<UnifiedResolutionResponse>({
                    endpoint: `/api/v1/resolver/streams`,
                    method: "GET",
                    params: { mediaId, episode: 1 } as any,
                })
                if (data) {
                    setResolution(data)
                } else {
                    onFallback(mediaId)
                }
            } catch {
                onFallback(mediaId)
            } finally {
                setIsResolving(false)
            }
        },
        [onFallback],
    )

    const close = React.useCallback(() => setResolution(null), [])

    return { resolution, isResolving, open, close }
}
