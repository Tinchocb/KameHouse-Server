'use no memo'
import { useEffect, useMemo } from "react"
import { useShallow } from "zustand/react/shallow"
import { useAniSkipTimes } from "@/api/hooks/aniskip.hooks"
import { useSkipTimesStore } from "@/lib/store"
import { isValidOpeningWindow, resolveEdWindow, resolveOpWindow, resolveRecapWindow } from "./skip-windows"
import type { Chapter, SkipWindow } from "./skip-windows"
import { useDriveTitleCard } from "./useDriveTitleCard"

interface UsePlayerSkipWindowsProps {
    malId?: number | null
    mediaId?: number | null
    episodeNumber?: number
    duration: number
    chapters: Chapter[]
    /** Ruta gdrive:// del episodio: habilita buscar el resumen por la placa del título. */
    drivePath?: string
}

/**
 * Ventanas de intro y outro del episodio (AniSkip → capítulos del archivo →
 * caché de la serie) y aprendizaje: lo resuelto se guarda en la caché para que
 * los demás episodios de la serie lo usen aunque AniSkip no los conozca.
 *
 * El resumen sale de un capítulo, de AniSkip o, en archivos de Drive, de la placa del
 * título que marcan los subtítulos ASS (el tramo entre el fin del opening y la placa).
 */
export function usePlayerSkipWindows({ malId, mediaId, episodeNumber, duration, chapters, drivePath }: UsePlayerSkipWindowsProps) {
    const { seriesSkipTimes, saveSeriesSkipTimes } = useSkipTimesStore(
        useShallow(state => ({
            seriesSkipTimes: state.seriesSkipTimes,
            saveSeriesSkipTimes: state.saveSeriesSkipTimes,
        }))
    )

    const { data: skipTimes, isLoading: skipTimesLoading } = useAniSkipTimes({
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

    // Se espera a AniSkip para preguntar una sola vez, ya con el fin del opening: así el
    // servidor lee de Drive solo el tramo del resumen y no desde el comienzo.
    const titleCard = useDriveTitleCard({
        path: drivePath,
        from: skipTimesOp && isValidOpeningWindow(skipTimesOp) ? skipTimesOp.endTime : 0,
        enabled: !skipTimesLoading,
    })
    const skipTimesRecap = useMemo(
        () => resolveRecapWindow(skipTimes, chapters, titleCard, skipTimesOp),
        [skipTimes, chapters, titleCard, skipTimesOp],
    )
    return { skipTimesOp, skipTimesEd, skipTimesRecap }
}
