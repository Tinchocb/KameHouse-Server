import { useEffect, useRef, useCallback } from "react"
import { useUpdateContinuityWatchHistoryItem } from "@/api/hooks/continuity.hooks"

interface UsePlayerProgressSyncOptions {
    mediaId?: number
    episodeNumber?: number
    filepath?: string
    intervalMs?: number
    enabled?: boolean
}

export function usePlayerProgressSync({
    mediaId,
    episodeNumber,
    filepath,
    intervalMs = 15000,
    enabled = true,
}: UsePlayerProgressSyncOptions) {
    const { mutate: saveProgress } = useUpdateContinuityWatchHistoryItem()
    const lastSavedTimeRef = useRef(0)
    const currentTimeRef = useRef(0)
    const durationRef = useRef(0)

    const onProgress = useCallback((currentTime: number, duration: number) => {
        currentTimeRef.current = currentTime
        durationRef.current = duration
    }, [])

    useEffect(() => {
        if (!enabled || !mediaId || !episodeNumber) return

        const sync = () => {
            const currentTime = currentTimeRef.current
            const duration = durationRef.current

            // Don't save if we haven't moved much (e.g. less than 2 seconds since last save)
            if (Math.abs(currentTime - lastSavedTimeRef.current) < 2) return

            saveProgress({
                options: {
                    mediaId,
                    episodeNumber,
                    currentTime,
                    duration,
                    filepath,
                    kind: "mediastream",
                },
            })
            lastSavedTimeRef.current = currentTime
        }

        const interval = setInterval(sync, intervalMs)

        return () => {
            clearInterval(interval)
            // Final sync on unmount if we have progress
            if (currentTimeRef.current > 0) {
                sync()
            }
        }
    }, [enabled, mediaId, episodeNumber, filepath, intervalMs, saveProgress])

    return { onProgress }
}
