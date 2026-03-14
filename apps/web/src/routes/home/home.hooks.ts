import * as React from "react"
import type { UnifiedResolutionResponse } from "@/api/types/unified.types"

/**
 * Hook for quick media playback resolution.
 */
export function useQuickPlay(onFallback: (mediaId: number) => void) {
    const [resolution, setResolution] = React.useState<UnifiedResolutionResponse | null>(null)
    const [isResolving, setIsResolving] = React.useState(false)

    const open = React.useCallback(
        async (mediaId: number) => {
            setIsResolving(true)
            try {
                const res = await fetch(`/api/v1/resolve/${mediaId}?episode=1`)
                if (!res.ok) throw new Error("No sources")
                const json = (await res.json()) as { data: UnifiedResolutionResponse }
                setResolution(json.data)
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
