import React, { useState, useCallback, useMemo } from "react"
import { toast } from "sonner"
import { useQueryClient } from "@tanstack/react-query"
import { usePreloadMediastreamMediaContainer } from "@/api/hooks/mediastream.hooks"
import type { Anime_Entry, Anime_Episode, Anime_LocalFile, Mediastream_StreamType, Continuity_WatchHistoryItemResponse } from "@/api/generated/types"
import { startViewTransition } from "@/lib/helpers/transitions"
import { queryKeys } from "@/lib/query-keys"
import { useGetSettings } from "@/api/hooks/settings.hooks"
import {
    type PlayCandidate,
    candidatePath,
    episodeNumberOf,
    fileEpisodeNumber,
    findEpisodeForLocalFile,
    findNextPlayableEpisode,
    getResumeTimeForEpisode,
    resolveEpisodeTitle,
    selectDefaultTarget,
    selectTargetByNumber,
} from "./series-playback.helpers"

// ─── Types ────────────────────────────────────────────────────────────────────

interface PlayTarget {
    path: string
    streamType: Mediastream_StreamType
    episodeLabel: string
    episodeNumber: number
    malId?: number | null
    isFiller?: boolean
    /** Segundo guardado en continuity o timestamp de momento: el reproductor arranca desde ahí. */
    startTime?: number
    momentKey?: string
    momentTitle?: string
}

/** Subconjunto de opciones de TanStack Router que usa este hook. */
interface SeriesNavigateOptions {
    to: string
    params?: Record<string, string>
    search?: Record<string, string | number | boolean>
    replace?: boolean
}
type NavigateFn = (opts: SeriesNavigateOptions) => void

interface UseSeriesPlaybackInput {
    entry: Anime_Entry | undefined | null
    computedEpisodes: Anime_Episode[]
    seriesId: string
    navigate: NavigateFn
    nextSeriesTarget: { seriesId: string; label: string } | null
    continuityData: Continuity_WatchHistoryItemResponse | undefined | null
    refetchContinuity: () => void
    autoplayEp: string | undefined
    initialTime?: string | number
    momentKey?: string
    momentTitle?: string
    setSearchParams: (updates: Partial<Record<string, string>>) => void
}

const NO_FILES_MESSAGE = "No hay archivos locales disponibles para reproducir."

// ─── Preload ──────────────────────────────────────────────────────────────────

/**
 * Calienta un path en el servidor una sola vez por serie (el preload es
 * idempotente, pero así no se dispara la mutación en cada hover/re-render).
 */
export function usePreloadPath(seriesId: string) {
    const { mutate: preloadStream } = usePreloadMediastreamMediaContainer()
    const preloadedPathsRef = React.useRef<Set<string>>(new Set())
    // Limpiar al cambiar de serie: evita falsos "ya precargado" y acumulación en memoria.
    React.useEffect(() => {
        preloadedPathsRef.current.clear()
    }, [seriesId])
    return useCallback(
        (path: string | undefined | null) => {
            if (!path || preloadedPathsRef.current.has(path)) return
            preloadedPathsRef.current.add(path)
            preloadStream({ path, streamType: "direct", audioStreamIndex: 0, preferredAudioLang: "" })
        },
        [preloadStream]
    )
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useSeriesPlayback({
    entry,
    computedEpisodes,
    seriesId,
    navigate,
    nextSeriesTarget,
    continuityData,
    refetchContinuity,
    autoplayEp,
    initialTime,
    momentKey,
    momentTitle,
    setSearchParams,
}: UseSeriesPlaybackInput) {
    const queryClient = useQueryClient()
    const [playTarget, setPlayTarget] = useState<PlayTarget | null>(null)

    // El toggle de Ajustes manda: con continuidad OFF no se resume nada.
    const { data: serverSettings } = useGetSettings()
    const continuityItem =
        (serverSettings?.library?.enableWatchContinuity ?? true)
            ? continuityData?.item
            : undefined

    const preloadPath = usePreloadPath(seriesId)
    const localFiles = entry?.localFiles
    const tmdbId = entry?.media?.tmdbId
    const malId = entry?.media?.idMal ?? null

    // ── Abrir el reproductor ──────────────────────────────────────────────────
    const openPlayer = useCallback(
        (
            path: string,
            episodeNumber: number,
            episodeLabel: string,
            isFiller: boolean,
            overrideStartTime?: number,
            momentMeta?: { momentKey?: string; momentTitle?: string }
        ) => {
            startViewTransition(() => {
                setPlayTarget({
                    path,
                    streamType: "direct" as Mediastream_StreamType,
                    episodeLabel,
                    episodeNumber,
                    malId,
                    isFiller,
                    startTime: overrideStartTime !== undefined
                        ? overrideStartTime
                        : getResumeTimeForEpisode(continuityItem, episodeNumber),
                    momentKey: momentMeta?.momentKey,
                    momentTitle: momentMeta?.momentTitle,
                })
            })
        },
        [malId, continuityItem]
    )

    const handlePlayEpisode = useCallback(
        (
            localFile: Anime_LocalFile,
            episode: Anime_Episode,
            overrideStartTime?: number,
            momentMeta?: { momentKey?: string; momentTitle?: string }
        ) => {
            if (!localFile.path) {
                toast.error("Archivo local no disponible.")
                return
            }
            openPlayer(
                localFile.path,
                episodeNumberOf(episode),
                resolveEpisodeTitle(episode, tmdbId),
                episode.episodeMetadata?.isFiller ?? false,
                overrideStartTime,
                momentMeta
            )
        },
        [openPlayer, tmdbId]
    )

    const handlePlayLocalFile = useCallback(
        (
            localFile: Anime_LocalFile,
            overrideStartTime?: number,
            momentMeta?: { momentKey?: string; momentTitle?: string }
        ) => {
            if (!localFile.path) {
                toast.error("Archivo no disponible.")
                return
            }
            const matchedEp = findEpisodeForLocalFile(computedEpisodes, localFile)
            const epNum = matchedEp ? episodeNumberOf(matchedEp) : (fileEpisodeNumber(localFile) || 1)
            openPlayer(
                localFile.path,
                epNum,
                localFile.name,
                matchedEp?.episodeMetadata?.isFiller ?? false,
                overrideStartTime,
                momentMeta
            )
        },
        [computedEpisodes, openPlayer]
    )

    const playCandidate = useCallback(
        (c: PlayCandidate) => {
            if (c.kind === "episode") handlePlayEpisode(c.lf, c.ep)
            else if (c.kind === "file") handlePlayLocalFile(c.file)
            else toast.info(NO_FILES_MESSAGE)
        },
        [handlePlayEpisode, handlePlayLocalFile]
    )

    // ── Target por defecto ("Reproducir") ─────────────────────────────────────
    // Un solo selector alimenta el click y el preload: imposible que calienten
    // archivos distintos.
    const defaultTarget = useMemo(
        () => selectDefaultTarget(entry, computedEpisodes, continuityItem?.episodeNumber),
        [entry, computedEpisodes, continuityItem?.episodeNumber]
    )
    const defaultTargetPath = candidatePath(defaultTarget)

    const handlePlayDefault = useCallback(() => playCandidate(defaultTarget), [playCandidate, defaultTarget])

    // Warm the default target on page load so the first play is instant.
    React.useEffect(() => {
        if (defaultTargetPath) preloadPath(defaultTargetPath)
    }, [defaultTargetPath, preloadPath])

    const handlePlayByNumber = useCallback(
        (
            episodeNumber: number,
            overrideStartTime?: number,
            momentMeta?: { momentKey?: string; momentTitle?: string }
        ) => {
            const target = selectTargetByNumber(computedEpisodes, localFiles, episodeNumber)
            switch (target.kind) {
                case "episode":
                    if (target.skippedFrom != null) {
                        toast.info(`Episodio ${target.skippedFrom} no disponible. Saltando al episodio ${episodeNumberOf(target.ep)}.`)
                    }
                    handlePlayEpisode(target.lf, target.ep, overrideStartTime, momentMeta)
                    return
                case "file":
                    handlePlayLocalFile(target.file, overrideStartTime, momentMeta)
                    return
                case "missing-file":
                    toast.error("Archivo local no disponible para este episodio.")
                    return
                case "not-found":
                    toast.error("Episodio no encontrado en la base de datos.")
            }
        },
        [computedEpisodes, localFiles, handlePlayEpisode, handlePlayLocalFile]
    )

    // ── Marathon / next-episode logic ─────────────────────────────────────────

    // Salta a la primera entrega disponible de la siguiente serie de la línea
    // temporal (p.ej. terminar Dragon Ball → arrancar Dragon Ball Z ep 1).
    const continueToNextSeries = useCallback(() => {
        if (!nextSeriesTarget) return false
        toast.success(`Continuando con ${nextSeriesTarget.label}`)
        startViewTransition(() => {
            setPlayTarget(null)
            navigate({
                to: "/series/$seriesId",
                params: { seriesId: nextSeriesTarget.seriesId },
                search: { tab: "episodes", saga: "", subSaga: "", autoplay: "1" },
            })
        })
        return true
    }, [nextSeriesTarget, navigate])

    // Única fuente de verdad para hasNextEpisode, el preload y el panel
    // "a continuación": solo avanza a episodios con archivo local.
    const nextAvailable = useMemo(
        () => (playTarget ? findNextPlayableEpisode(computedEpisodes, localFiles, playTarget.episodeNumber) : null),
        [computedEpisodes, localFiles, playTarget]
    )

    // Hay siguiente si queda un episodio local por delante o si el timeline
    // encadena con otra serie. El auto-skip de outro, el salto a 3s del final y
    // el panel "a continuación" están todos condicionados por esto.
    const hasNextEpisode = !!nextAvailable || !!nextSeriesTarget
    const nextEp = nextAvailable?.ep ?? null
    const nextLocalFile = nextAvailable?.lf ?? null

    const handleNextEpisode = useCallback(() => {
        if (nextAvailable) {
            handlePlayEpisode(nextAvailable.lf, nextAvailable.ep)
            return
        }
        if (continueToNextSeries()) return
        toast.info("Has llegado al final de la lista de episodios.")
        startViewTransition(() => {
            setPlayTarget(null)
        })
    }, [nextAvailable, handlePlayEpisode, continueToNextSeries])

    useSeriesAutoplay({
        seriesId,
        autoplayEp,
        initialTime,
        momentKey,
        momentTitle,
        computedEpisodes,
        handlePlayByNumber,
        setSearchParams,
    })

    // ── Player close callback ─────────────────────────────────────────────────
    const handlePlayerClose = useCallback(() => {
        startViewTransition(() => {
            setPlayTarget(null)
        })
        refetchContinuity()
        queryClient.invalidateQueries({
            queryKey: queryKeys.series.entry(seriesId),
        })
    }, [refetchContinuity, queryClient, seriesId])

    return {
        playTarget,
        setPlayTarget,
        preloadPath,
        defaultTargetPath,
        nextAvailable,
        nextEp,
        nextLocalFile,
        hasNextEpisode,
        handlePlayEpisode,
        handlePlayLocalFile,
        handlePlayDefault,
        handlePlayByNumber,
        continueToNextSeries,
        handleNextEpisode,
        handlePlayerClose,
    }
}

// ─── Autoplay between series ──────────────────────────────────────────────────
// Autoplay al llegar desde la continuación entre series o desde la cronología:
// reproduce el episodio indicado en la URL (?autoplay=N) una sola vez y limpia los flags.
function useSeriesAutoplay({
    seriesId,
    autoplayEp,
    initialTime,
    momentKey,
    momentTitle,
    computedEpisodes,
    handlePlayByNumber,
    setSearchParams,
}: {
    seriesId: string
    autoplayEp: string | undefined
    initialTime?: string | number
    momentKey?: string
    momentTitle?: string
    computedEpisodes: Anime_Episode[]
    handlePlayByNumber: (
        n: number,
        overrideStartTime?: number,
        momentMeta?: { momentKey?: string; momentTitle?: string }
    ) => void
    setSearchParams: (updates: Partial<Record<string, string>>) => void
}) {
    const firedRef = React.useRef(false)
    React.useEffect(() => {
        firedRef.current = false
    }, [seriesId])
    React.useEffect(() => {
        if (!autoplayEp || firedRef.current) return
        if (computedEpisodes.length === 0) return
        firedRef.current = true
        const n = Number(autoplayEp)
        const tSec = initialTime != null && initialTime !== "" ? Number(initialTime) : undefined
        const parsedTime = Number.isFinite(tSec) && tSec! >= 0 ? tSec : undefined
        const momentMeta = momentKey ? { momentKey, momentTitle } : undefined
        // ?autoplay=abc se descarta sin toast de error.
        if (Number.isFinite(n)) handlePlayByNumber(n, parsedTime, momentMeta)
        setSearchParams({ autoplay: "", t: "", moment: "", momentTitle: "" })
    }, [autoplayEp, initialTime, momentKey, momentTitle, computedEpisodes, handlePlayByNumber, setSearchParams])
}
