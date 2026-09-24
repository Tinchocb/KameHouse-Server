import { useMemo } from "react"
import { getSafeCollectionEntries } from "@/lib/helpers/collection"
import { getHighResImage } from "@/lib/helpers/images"
import { getDragonBallSpanishTitle, resolveSeriesSagas } from "@/lib/config/dragonball.config"
import { getNextInTimeline } from "@/lib/config/franchise_timeline"
import { getSeriesHeroArt, heroArtFromUrl } from "@/lib/config/hero-art"
import { getServerBaseUrl } from "@/api/client/server-url"
import { useGetSettings } from "@/api/hooks/settings.hooks"
import type { Anime_Entry, Anime_Episode, Anime_LocalFile, Continuity_WatchHistoryItemResponse, Anime_LibraryCollection } from "@/api/generated/types"
import type { SagaDTO, PremiumEpisode } from "@/api/types/series.types"

export interface SeriesContinueWatchingData {
    episodeNumber: number
    title: string
    thumbnailUrl: string
    fallbackThumbnailUrl?: string
    sagaId?: string
    sagaName?: string
    currentTime: number
    duration: number
    percent: number
    timeLeftSeconds: number
    timeLeftLabel: string
}

export function cleanEpisodeTitle(title: string | undefined): string {
    if (!title) return ""
    return title
        .replace(/^[«"'\s]+|[»"'\s]+$/g, "")
        .replace(/^«\s*/, "")
        .replace(/\s*»$/, "")
        .trim()
}

// ─── Module-level helpers ─────────────────────────────────────────────────────
// Moved here from index.tsx — shared by use-series-data and use-series-playback
// without circular dependency issues.

/**
 * Fallback para episodios que NO tienen sagaId asignado en el escaneo del servidor.
 * El servidor asigna sagaId usando GetDragonBallSagas (sin sub-sagas) durante el escaneo.
 * Esta función usa las sagas de la UI (GetDragonBallSagaInfo, con sub-sagas) que pueden
 * tener rangos diferentes, por eso solo debe usarse como fallback para episodios huérfanos
 * (local files, specials mal numerados, rangos desactualizados).
 */
function resolveSagaId(epNum: number, sagas: SagaDTO[] | undefined): string | undefined {
    if (!sagas || !sagas.length) return undefined

    // Match exacto: el episodio cae dentro del rango declarado de una saga.
    const exactMatch = sagas.find(s => epNum >= s.startEp && epNum <= s.endEp)
    if (exactMatch) return exactMatch.id

    // Episodios especiales / OVAs / prólogos (ep 0 o negativos): van al primer saga.
    // No tiene sentido buscar "la saga más cercana" cuando el número está por debajo
    // del inicio de cualquier saga definida.
    if (epNum <= 0) return sagas[0].id

    // Episodios más allá del final de la última saga (rangos desactualizados,
    // episodios extra al cierre de la serie): van al último saga.
    const lastSaga = sagas[sagas.length - 1]
    if (epNum > lastSaga.endEp) return lastSaga.id

    // Episodios que caen en gaps intermedios entre sagas: adjuntar a la saga
    // anterior más cercana (la de mayor endEp que siga siendo <= epNum).
    let fallbackSaga: SagaDTO | undefined
    for (const saga of sagas) {
        if (saga.startEp <= epNum) {
            if (!fallbackSaga || saga.endEp > fallbackSaga.endEp) {
                fallbackSaga = saga
            }
        }
    }
    return (fallbackSaga ?? sagas[0]).id
}

export function resolveLocalFileForEpisode(
    episode: Anime_Episode,
    localFiles: Anime_LocalFile[] | undefined | null
): Anime_LocalFile | undefined {
    if (episode.localFile) return episode.localFile
    return (localFiles || []).find(f => {
        const fEp = f.metadata?.episode || f.parsedInfo?.episode
        const fSeason = f.parsedInfo?.season
        if (fEp == null) return false
        if (Number(fEp) === episode.absoluteEpisodeNumber) {
            return true
        }
        if (typeof episode.seasonNumber === "number" && fSeason != null) {
            return Number(fEp) === episode.episodeNumber && Number(fSeason) === episode.seasonNumber
        }
        return Number(fEp) === episode.episodeNumber
    })
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

interface UseSeriesDataInput {
    entry: Anime_Entry | undefined | null
    sagas: SagaDTO[] | undefined
    activeSagaId: string | undefined
    activeSubSagaId: string | undefined
    continuityData: Continuity_WatchHistoryItemResponse | undefined | null
    libraryCollection: Anime_LibraryCollection | undefined | null
}

export function useSeriesData({
    entry,
    sagas,
    activeSagaId,
    activeSubSagaId,
    continuityData,
    libraryCollection,
}: UseSeriesDataInput) {
    const { data: serverSettings } = useGetSettings()

    // ── Episodes derived from API or local files ──────────────────────────────
    // Solo se muestran episodios detectados localmente (con archivo). Los
    // episodios del provider sin archivo (mock/remotos) se ocultan para no
    // mostrar tarjetas vacías con sinopsis repetida.
    const computedEpisodes = useMemo<Anime_Episode[]>(() => {
        if (!entry) return []

        const hasLocalFile = (ep: Anime_Episode): boolean => {
            if (ep.isDownloaded || ep.localFile?.path) return true
            return !!resolveLocalFileForEpisode(ep, entry.localFiles)
        }

        if (entry.episodes && entry.episodes.length > 0) {
            const withSaga = entry.episodes
                .filter(ep => ep && typeof ep.episodeNumber === "number")
                .map(ep => {
                    const epNum = ep.absoluteEpisodeNumber || ep.episodeNumber
                    // Prefer scan-time sagaId from API (assigned by GetDragonBallSagas during library scan)
                    // Only fall back to UI-time resolution if episode has no sagaId
                    const sagaId = ep.sagaId ?? resolveSagaId(epNum, sagas)
                    return sagaId ? { ...ep, sagaId } : ep
                })

            const onlyFound = withSaga.filter(hasLocalFile)
            if (onlyFound.length > 0) {
                return onlyFound.sort(
                    (a, b) =>
                        (a.absoluteEpisodeNumber || a.episodeNumber) -
                        (b.absoluteEpisodeNumber || b.episodeNumber)
                )
            }
            // Si el provider trae todo no-descargado, caer a archivos reales.
            // Si tampoco hay match, retorna [] y la UI muestra aviso para agregar.
        }

        if (entry.localFiles && entry.localFiles.length > 0) {
            const epMap = new Map<number, Anime_Episode>()

            // Determine watched status from continuity data (last played episode with high progress)
            const continuityEpNum = continuityData?.item?.episodeNumber
            const continuityProgress = continuityData?.item?.duration
                ? continuityData.item.currentTime / continuityData.item.duration
                : 0
            const isContinuityWatched = continuityEpNum != null && continuityProgress > 0.9

            entry.localFiles.forEach(lf => {
                const parsedEp = lf.parsedInfo?.episode || lf.metadata?.episode
                const epNum = Number(parsedEp)
                if (!epNum || isNaN(epNum)) return

                if (!epMap.has(epNum)) {
                    const sagaId = resolveSagaId(epNum, sagas)
                    // Mark as watched if this is the continuity episode with >90% progress
                    const watched = isContinuityWatched && epNum === continuityEpNum
                    epMap.set(epNum, {
                        episodeNumber: epNum,
                        absoluteEpisodeNumber: epNum,
                        episodeTitle: lf.name,
                        displayTitle: lf.name,
                        watched,
                        sagaId,
                        type: "main",
                        progressNumber: epNum,
                        isDownloaded: true,
                        isInvalid: false,
                        episodeMetadata: {
                            episodeNumber: epNum,
                            image: entry.media?.posterImage || entry.media?.bannerImage || "",
                        },
                    } as unknown as Anime_Episode)
                }
            })

            return Array.from(epMap.values()).sort((a, b) => a.episodeNumber - b.episodeNumber)
        }

        return []
    }, [entry, sagas, continuityData])

    // ── Active sub-saga object ────────────────────────────────────────────────
    const activeSubSaga = useMemo(() => {
        if (!activeSagaId || !activeSubSagaId || !sagas) return null
        const currentSaga = sagas.find(s => s.id === activeSagaId)
        return currentSaga?.subSagas?.find(ss => ss.id === activeSubSagaId) || null
    }, [sagas, activeSagaId, activeSubSagaId])

    // ── Next series in franchise timeline ─────────────────────────────────────
    // Resolved against the user's library: only offers continuation when the
    // series actually exists (tmdbId → internal mediaId mapping).
    const nextSeriesTarget = useMemo(() => {
        const next = getNextInTimeline(entry?.media?.tmdbId)
        if (!next) return null
        const entries = getSafeCollectionEntries(libraryCollection)
        const match = entries.find(e => e?.media?.tmdbId === next.tmdbId && e?.mediaId)
        if (!match?.mediaId) return null
        return { seriesId: String(match.mediaId), label: next.label }
    }, [entry?.media?.tmdbId, libraryCollection])

    // ── Hero backdrop (strictly 16:9 widescreen, never vertical portada) ─────
    // Mismo arte curado que el Home (punto focal incluido); si la serie no está
    // curada, su banner con encuadre por defecto.
    const heroArt = useMemo(() => {
        const banner = entry?.media?.bannerImage
        return getSeriesHeroArt(entry?.media?.tmdbId || entry?.mediaId, banner, entry?.media?.posterImage)
            ?? (banner ? heroArtFromUrl(banner) : null)
    }, [entry?.media?.tmdbId, entry?.mediaId, entry?.media?.bannerImage, entry?.media?.posterImage])
    // URL mediana para miniaturas de saga y fallbacks (el hero usa heroArt a resolución completa).
    const heroBackdrop = heroArt ? getHighResImage(heroArt.src) : null

    // ── Saga-scoped episode lists ─────────────────────────────────────────────
    const sagaEpisodes = useMemo(() => {
        if (!computedEpisodes || !activeSagaId) return []
        return computedEpisodes.filter(ep => ep.sagaId === activeSagaId)
    }, [computedEpisodes, activeSagaId])

    const sagaProgress = useMemo(() => {
        if (sagaEpisodes.length === 0) return { watched: 0, total: 0, percent: 0 }
        const watched = sagaEpisodes.filter(ep => ep.watched).length
        const total = sagaEpisodes.length
        return { watched, total, percent: Math.round((watched / total) * 100) }
    }, [sagaEpisodes])

    const sagasProgressMap = useMemo(() => {
        if (!computedEpisodes || !sagas?.length) return {}
        const map: Record<string, { watched: number; total: number; percent: number }> = {}
        for (const saga of sagas) {
            const eps = computedEpisodes.filter(ep => ep.sagaId === saga.id)
            if (eps.length === 0) {
                map[saga.id] = { watched: 0, total: 0, percent: 0 }
            } else {
                const watched = eps.filter(ep => ep.watched).length
                const total = eps.length
                map[saga.id] = { watched, total, percent: Math.round((watched / total) * 100) }
            }
        }
        return map
    }, [computedEpisodes, sagas])

    const fillerStats = useMemo(() => {
        if (sagaEpisodes.length === 0) return { filler: 0, total: 0, percent: 0 }
        let fillerCount = 0
        sagaEpisodes.forEach(ep => {
            if (ep.episodeMetadata?.isFiller) fillerCount++
        })
        const total = sagaEpisodes.length
        return { filler: fillerCount, total, percent: Math.round((fillerCount / total) * 100) }
    }, [sagaEpisodes])

    // ── Memoized PremiumEpisode view-models ───────────────────────────────────
    // This is the core performance fix: the array was built inline in JSX as a
    // .filter().map() on every render. PremiumEpisodeList does a React Compiler
    // bail-out (incompatible-library: virtualizer), so it never auto-memoizes.
    // Moving the construction here means the list only re-renders when the
    // content actually changes — NOT on hover-preload, scroll, mobileSagasOpen,
    // playTarget changes, etc.
    const dbSagaDefs = useMemo(() => resolveSeriesSagas(entry?.media), [entry?.media])

    const lfMap = useMemo(() => {
        const map = new Map<number, Anime_LocalFile>()
        if (!entry?.localFiles) return map
        for (const f of entry.localFiles) {
            const fEp = f.metadata?.episode || f.parsedInfo?.episode
            if (fEp != null) {
                const epNum = Number(fEp)
                if (!isNaN(epNum) && !map.has(epNum)) {
                    map.set(epNum, f)
                }
            }
        }
        return map
    }, [entry])

    // ── Continue Watching & Resume Info ──────────────────────────────────────
    const continueWatching = useMemo<SeriesContinueWatchingData | null>(() => {
        const enableWatchContinuity = serverSettings?.library?.enableWatchContinuity ?? true
        if (!enableWatchContinuity) return null
        if (entry?.media?.format === "MOVIE") return null

        const item = continuityData?.item
        if (!item || !item.currentTime || !item.duration) return null

        // Paridad con player-core: solo reanudar con progreso significativo (> 10s)
        if (item.currentTime <= 10) return null

        const rawPercent = (item.currentTime / item.duration) * 100
        const percent = Math.min(100, Math.max(0, Math.round(rawPercent)))
        // Si superó el 95%, se considera terminado
        if (percent >= 95) return null

        const epNum = item.episodeNumber
        const resumeEp = computedEpisodes.find(
            ep => (ep.absoluteEpisodeNumber || ep.episodeNumber) === epNum
        )
        if (!resumeEp || resumeEp.watched) return null

        // Seguridad: si no tiene archivo local disponible, no mostrar
        const lf =
            resumeEp.localFile ||
            lfMap.get(resumeEp.absoluteEpisodeNumber || resumeEp.episodeNumber) ||
            lfMap.get(resumeEp.episodeNumber)
        if (!lf?.path && !resumeEp.localFile?.path && !resumeEp.isDownloaded) return null

        const number = resumeEp.absoluteEpisodeNumber || resumeEp.episodeNumber || epNum
        const localizedTitle = getDragonBallSpanishTitle(entry?.media?.tmdbId, number)
        const rawTitle =
            localizedTitle ||
            resumeEp.titleSpanish ||
            resumeEp.episodeMetadata?.title ||
            resumeEp.episodeTitle ||
            resumeEp.displayTitle ||
            `Episodio ${number}`
        const title = cleanEpisodeTitle(rawTitle) || `Episodio ${number}`

        // Fallbacks de arte sincronizados con episodeViewModels
        const currentSaga = sagas?.find(s => s.id === resumeEp.sagaId)
        const currentSubSaga = currentSaga?.subSagas?.find(ss => number >= ss.startEp && number <= ss.endEp)

        const defSaga = dbSagaDefs?.find(s => s.id === resumeEp.sagaId || (number >= s.startEp && number <= s.endEp))
        const defSubSaga = defSaga?.subSagas?.find(ss => number >= ss.startEp && number <= ss.endEp)

        const artworkFallback =
            defSubSaga?.image ||
            defSaga?.image ||
            currentSubSaga?.image ||
            (currentSaga as { image?: string } | undefined)?.image ||
            heroBackdrop ||
            entry?.media?.bannerImage ||
            entry?.media?.posterImage ||
            ""

        const serverBase = getServerBaseUrl()
        let resolvedThumbnail = resumeEp.episodeMetadata?.image || ""
        if (!resolvedThumbnail && lf?.path) {
            resolvedThumbnail = `${serverBase}/api/v1/video-thumbnail?path=${encodeURIComponent(lf.path)}`
        }
        if (!resolvedThumbnail) {
            resolvedThumbnail = artworkFallback
        }

        const timeLeftSeconds = Math.max(0, Math.round(item.duration - item.currentTime))
        let timeLeftLabel = ""
        if (timeLeftSeconds >= 3600) {
            const hours = Math.floor(timeLeftSeconds / 3600)
            const mins = Math.round((timeLeftSeconds % 3600) / 60)
            timeLeftLabel = mins > 0 ? `${hours}h ${mins}m restantes` : `${hours}h restantes`
        } else {
            const mins = Math.max(1, Math.round(timeLeftSeconds / 60))
            timeLeftLabel = `${mins} min restantes`
        }

        return {
            episodeNumber: number,
            title,
            thumbnailUrl: resolvedThumbnail,
            fallbackThumbnailUrl: resolvedThumbnail !== artworkFallback ? artworkFallback : undefined,
            sagaId: resumeEp.sagaId,
            sagaName: currentSaga?.name,
            currentTime: item.currentTime,
            duration: item.duration,
            percent,
            timeLeftSeconds,
            timeLeftLabel,
        }
    }, [
        serverSettings,
        entry?.media?.format,
        entry?.media?.tmdbId,
        entry?.media?.bannerImage,
        entry?.media?.posterImage,
        continuityData,
        computedEpisodes,
        lfMap,
        sagas,
        dbSagaDefs,
        heroBackdrop,
    ])

    const resumeInfo = useMemo(() => {
        if (!continueWatching) return null
        return {
            number: continueWatching.episodeNumber,
            title: continueWatching.title,
        }
    }, [continueWatching])

    const episodeViewModels = useMemo<PremiumEpisode[]>(() => {
        if (!computedEpisodes) return []

        const filtered = !sagas?.length
            ? computedEpisodes
            : computedEpisodes.filter(ep => ep.sagaId === activeSagaId)

        const tmdbId = entry?.media?.tmdbId
        const serverBase = getServerBaseUrl()

        return filtered.map(ep => {
            const epNum = ep.absoluteEpisodeNumber || ep.episodeNumber
            const lf = ep.localFile || lfMap.get(ep.absoluteEpisodeNumber || ep.episodeNumber) || lfMap.get(ep.episodeNumber)
            // Seguridad: si no hay archivo local, no es reproducible → ocultar.
            if (!lf?.path && !ep.localFile?.path && !ep.isDownloaded) return null

            const localizedTitle = getDragonBallSpanishTitle(tmdbId, epNum)
            const resolvedTitle =
                localizedTitle ||
                ep.titleSpanish ||
                ep.episodeMetadata?.title ||
                ep.episodeTitle ||
                ep.displayTitle ||
                `Episodio ${epNum}`

            const metaDuration = (ep.episodeMetadata as { duration?: number } | undefined)?.duration
            const durationSec =
                (lf?.technicalInfo?.videoStream as { duration?: number } | undefined)?.duration ||
                (lf?.technicalInfo as { container?: { duration?: number } } | undefined)?.container?.duration ||
                (metaDuration ? metaDuration * 60 : undefined)
            const durationMinutes = durationSec
                ? Math.max(1, Math.round(durationSec / 60))
                : (entry?.media?.runtime || 24)

            // Resolve thumbnail with layered fallback:
            // 1. Episode metadata image (TMDB / provider still)
            // 2. Video thumbnail generated from local file
            // 3. Sub-saga / saga curated artwork
            // 4. Series heroBackdrop / poster
            const currentSaga = sagas?.find(s => s.id === ep.sagaId)
            const currentSubSaga = currentSaga?.subSagas?.find(ss => epNum >= ss.startEp && epNum <= ss.endEp)

            const defSaga = dbSagaDefs?.find(s => s.id === ep.sagaId || (epNum >= s.startEp && epNum <= s.endEp))
            const defSubSaga = defSaga?.subSagas?.find(ss => epNum >= ss.startEp && epNum <= ss.endEp)

            const artworkFallback =
                defSubSaga?.image ||
                defSaga?.image ||
                currentSubSaga?.image ||
                (currentSaga as { image?: string } | undefined)?.image ||
                heroBackdrop ||
                entry?.media?.bannerImage ||
                entry?.media?.posterImage ||
                ""

            let resolvedThumbnail = ep.episodeMetadata?.image || ""
            if (!resolvedThumbnail && lf?.path) {
                resolvedThumbnail = `${serverBase}/api/v1/video-thumbnail?path=${encodeURIComponent(lf.path)}`
            }
            if (!resolvedThumbnail) {
                resolvedThumbnail = artworkFallback
            }

            return {
                id: epNum.toString(),
                title: resolvedTitle,
                number: epNum,
                description: ep.episodeMetadata?.summary || ep.episodeMetadata?.overview || "",
                thumbnailUrl: resolvedThumbnail,
                fallbackThumbnailUrl: resolvedThumbnail !== artworkFallback ? artworkFallback : undefined,
                episodeType: (ep.episodeMetadata?.isFiller ? "Filler" : (lf?.metadata?.episodeType || "Canon")) as PremiumEpisode["episodeType"],
                isWatched: ep.watched,
                duration: durationMinutes,
                resolution: lf?.technicalInfo?.videoStream?.height
                    ? `${lf.technicalInfo.videoStream.height}p`
                    : undefined,
                videoCodec: lf?.technicalInfo?.videoStream?.codec,
                audioCodec: lf?.technicalInfo?.audioStreams?.[0]?.codec,
                localFilePath: lf?.path,
                sagaId: ep.sagaId,
                sagaName: sagas?.find(s => s.id === ep.sagaId)?.name,
            } as PremiumEpisode
        }).filter((ep): ep is PremiumEpisode => ep !== null)
    }, [computedEpisodes, sagas, activeSagaId, entry?.media, heroBackdrop, dbSagaDefs, lfMap])

    return {
        computedEpisodes,
        activeSubSaga,
        nextSeriesTarget,
        heroArt,
        heroBackdrop,
        resumeInfo,
        continueWatching,
        sagaEpisodes,
        sagaProgress,
        sagasProgressMap,
        fillerStats,
        episodeViewModels,
    }
}
