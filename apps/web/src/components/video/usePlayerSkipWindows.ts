'use no memo'
import { useEffect, useMemo } from "react"
import { useShallow } from "zustand/react/shallow"
import { useAniSkipTimes } from "@/api/hooks/aniskip.hooks"
import { useSkipTimesStore } from "@/lib/store"
import { resolveEdWindow, resolveOpWindow, resolveRecapWindow } from "./skip-windows"
import type { Chapter, SkipWindow } from "./skip-windows"

interface UsePlayerSkipWindowsProps {
    malId?: number | null
    mediaId?: number | null
    episodeNumber?: number
    duration: number
    chapters: Chapter[]
}

/**
 * Ventanas de intro y outro del episodio (AniSkip → capítulos del archivo →
 * caché de la serie) y aprendizaje: lo resuelto se guarda en la caché para que
 * los demás episodios de la serie lo usen aunque AniSkip no los conozca.
 */
export function usePlayerSkipWindows({ malId, mediaId, episodeNumber, duration, chapters }: UsePlayerSkipWindowsProps) {
    const { seriesSkipTimes, saveSeriesSkipTimes } = useSkipTimesStore(
        useShallow(state => ({
            seriesSkipTimes: state.seriesSkipTimes,
            saveSeriesSkipTimes: state.saveSeriesSkipTimes,
        }))
    )

    const { data: skipTimes } = useAniSkipTimes({
        malId: malId ?? null,
        episodeNumber: episodeNumber ?? null,
        episodeDuration: duration > 0 ? duration : undefined,
        enabled: !!((malId || mediaId) && episodeNumber),
        mediaId: mediaId ?? null,
    })

    const storeKey = malId || mediaId
    const skipTimesOp = useMemo<SkipWindow | undefined>(
        () => resolveOpWindow(skipTimes, chapters, storeKey ? seriesSkipTimes[String(storeKey)] : undefined),
        [skipTimes, chapters, storeKey, seriesSkipTimes],
    )
    const skipTimesEd = useMemo<SkipWindow | undefined>(
        () => resolveEdWindow(skipTimes, chapters, storeKey ? seriesSkipTimes[String(storeKey)] : undefined, duration),
        [skipTimes, chapters, storeKey, duration, seriesSkipTimes],
    )

    useEffect(() => {
        if (!storeKey || duration <= 0) return

        const cached = seriesSkipTimes[String(storeKey)]
        let opStart = cached?.opStart
        let opEnd = cached?.opEnd
        let edOffset = cached?.edOffset
        let edEnd = cached?.edEnd

        // Se usan las ventanas ya resueltas, no se vuelve a buscar por regex en los capítulos.
        if (skipTimesOp) {
            opStart = skipTimesOp.startTime
            opEnd = skipTimesOp.endTime
        }
        if (skipTimesEd) {
            edOffset = skipTimesEd.startTime
            edEnd = skipTimesEd.endTime
        }

        if (typeof opStart === "number" && typeof opEnd === "number" && typeof edOffset === "number") {
            if (cached?.opStart !== opStart || cached?.opEnd !== opEnd || cached?.edOffset !== edOffset || cached?.edEnd !== edEnd) {
                saveSeriesSkipTimes(storeKey, opStart, opEnd, edOffset, edEnd)
            }
        }
    }, [storeKey, duration, skipTimesOp, skipTimesEd, seriesSkipTimes, saveSeriesSkipTimes])

    const skipTimesRecap = useMemo(() => resolveRecapWindow(skipTimes, chapters), [skipTimes, chapters])
    return { skipTimesOp, skipTimesEd, skipTimesRecap }
}
