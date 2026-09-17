import { createLazyFileRoute } from "@tanstack/react-router"
import { useQueryClient } from "@tanstack/react-query"
import React, { useState, useEffect, useRef } from "react"
import { toast } from "sonner"
import { useAppStore } from "@/lib/store"
import { getHighResImage, getMediumResImage } from "@/lib/helpers/images"
import { useGetAnimeEntry, useUpdateAnimeEntryProgress } from "@/api/hooks/anime_entries.hooks"
import { useGetContinuityWatchHistoryItem } from "@/api/hooks/continuity.hooks"
import { usePreloadMediastreamMediaContainer } from "@/api/hooks/mediastream.hooks"
import { API_ENDPOINTS } from "@/api/generated/endpoints"
import { Anime_LocalFile, FileTechnicalInfo, Mediastream_StreamType } from "@/api/generated/types"
import { EmptyState } from "@/components/shared/empty-state"
import { PlayCta } from "@/components/ui/play-cta"
import { GlassIconButton } from "@/components/ui/glass-icon-button"
import { PlayerFallback } from "@/components/video/player-fallback"
import { WatchProgressBar } from "@/components/ui/watch-progress-bar"
import { Skeleton } from "@/components/ui/skeleton/skeleton"

const VideoPlayer = React.lazy(() => import("@/components/video/player").then(m => ({ default: m.VideoPlayer })))
import { startViewTransition } from "@/lib/helpers/transitions"
import { stripHtml } from "@/lib/helpers/sanitizer"
import { MediaHero } from "@/components/ui/media-hero"
import { MediaMetadataCapsule } from "@/components/ui/media-metadata-capsule"
import { useSound } from "@/hooks/use-sound"
import { cn } from "@/components/ui/core/styling"
import { IconUiListPlus, IconUiCheck, IconUiPlus, IconUiHeart } from "@/components/ui/icons"
import { cleanMovieTitle } from "./-MovieCard"
import { getEntryEraId, getMovieLore } from "./-components/movies-utils"
import { ERAS, ERA_COLOR_MAP } from "@/lib/config/eras"

import { getSeriesEraTheme } from "@/lib/config/dragonball.config"
import { useIntelligenceStore } from "@/hooks/use-home-intelligence"
import { useThemeSettings } from "@/lib/theme/theme-hooks"

export const Route = createLazyFileRoute("/movies/$movieId")({
    component: MovieDetailPage,
})

const formatFileSize = (bytes: number) => {
    if (!bytes) return "0 MB"
    const mb = bytes / (1024 * 1024)
    if (mb >= 1024) {
        return `${(mb / 1024).toFixed(2)} GB`
    }
    return `${mb.toFixed(0)} MB`
}

function MovieDetailPage() {
    const { movieId } = Route.useParams()

    return (
        <MovieDetailClient key={movieId} movieId={movieId} />
    )
}

function MovieDetailClient({ movieId }: { movieId: string }) {
    const { playSound } = useSound()
    const queryClient = useQueryClient()
    const { data: entry, isLoading } = useGetAnimeEntry(movieId)
    const { data: continuityData, refetch: refetchContinuity } = useGetContinuityWatchHistoryItem(Number(movieId))
    const containerRef = useRef<HTMLDivElement>(null)
    const addToQueue = useAppStore(state => state.addToQueue)
    const ts = useThemeSettings()

    const [isFavorite, setIsFavorite] = useState(false)
    const [playTarget, setPlayTarget] = useState<{
        path: string
        streamType: Mediastream_StreamType
        episodeLabel: string
        episodeNumber: number
        malId?: number | null
    } | null>(null)

    // Watch status derivado con soporte para override optimista del usuario (sin doble render)
    const [userWatchedOverride, setUserWatchedOverride] = useState<boolean | null>(null)
    const serverWatched = entry?.episodes?.[0]?.watched
        || (entry?.listData?.progress ?? 0) >= (entry?.media?.totalEpisodes ?? 1)
        || false
    const isWatched = userWatchedOverride ?? serverWatched

    // Resetear override de usuario al cambiar de película
    useEffect(() => {
        setUserWatchedOverride(null)
    }, [movieId])

    const { mutate: updateProgress } = useUpdateAnimeEntryProgress(Number(movieId), 1, false)
    const { mutate: preloadStream } = usePreloadMediastreamMediaContainer()

    // Warm the media container ahead of the click (page load + hover intent).
    const defaultTargetPath = entry?.localFiles?.[0]?.path || null
    const preloadedPathsRef = useRef<Set<string>>(new Set())
    useEffect(() => {
        if (!defaultTargetPath || preloadedPathsRef.current.has(defaultTargetPath)) return
        preloadedPathsRef.current.add(defaultTargetPath)
        preloadStream({ path: defaultTargetPath, streamType: "direct", audioStreamIndex: 0, preferredAudioLang: "" })
    }, [defaultTargetPath, preloadStream])

    const setActiveSeriesContext = useAppStore(s => s.setActiveSeriesContext)
    const movieContextWrittenRef = React.useRef<string | null>(null)
    useEffect(() => {
        const tmdbId = entry?.media?.tmdbId || Number(movieId)
        if (tmdbId) {
            const key = String(tmdbId)
            movieContextWrittenRef.current = key
            setActiveSeriesContext(key)
        }
        return () => {
            if (useAppStore.getState().activeSeriesContext === movieContextWrittenRef.current) {
                setActiveSeriesContext(null)
            }
        }
    }, [entry?.media?.tmdbId, movieId, setActiveSeriesContext])

    useEffect(() => {
        if (entry?.media?.id) playSound("detail", 0.4)
    }, [entry?.media?.id, playSound])

    // Sincroniza el backdrop con el DynamicBackdrop global (glass real detrás del contenido)
    const setBackdropUrl = useIntelligenceStore(s => s.setBackdropUrl)
    const backdropForStore = getHighResImage(entry?.media?.bannerImage || entry?.media?.posterImage || "")
    useEffect(() => {
        if (backdropForStore) setBackdropUrl(backdropForStore)
        return () => setBackdropUrl(null)
    }, [backdropForStore, setBackdropUrl])

    const eraId = entry ? getEntryEraId(entry) : "dbz"
    const eraAccent = ERA_COLOR_MAP[eraId].accent
    const eraLabel = ERAS.find(e => e.id === eraId)?.title ?? "Dragon Ball"

    if (!entry || !entry.media) {
        if (isLoading) {
            return (
                <div className="h-full w-full pb-16 p-6 md:p-12 flex flex-col justify-end min-h-screen gap-6">
                    <div className="flex flex-col lg:flex-row items-center lg:items-end gap-10 max-w-content w-full mx-auto">
                        <Skeleton className="w-56 md:w-64 shrink-0 aspect-[2/3] h-auto rounded-container" />
                        <div className="flex-1 w-full flex flex-col gap-4">
                            <Skeleton className="h-6 w-32 rounded-lg" />
                            <Skeleton className="h-14 w-2/3 rounded-lg" />
                            <Skeleton className="h-4 w-full rounded-lg" />
                            <Skeleton className="h-4 w-3/4 rounded-lg" />
                            <Skeleton className="h-14 w-48 rounded-full mt-2" />
                        </div>
                    </div>
                </div>
            )
        }
        return (
            <div className="min-h-screen text-on-surface flex items-center justify-center">
                <EmptyState title="Película no encontrada" message="No pudimos cargar este contenido." />
            </div>
        )
    }

    const media = entry.media
    const lore = getMovieLore(entry)
    const isGenericOrEmptySpanish = !media.titleSpanish ||
        media.titleSpanish.trim().toLowerCase() === "dragon ball serie" ||
        media.titleSpanish.trim().toLowerCase() === "dragon ball series"
    const title = (!isGenericOrEmptySpanish ? media.titleSpanish : null)
        || lore?.title
        || media.titleEnglish
        || media.titleRomaji
        || "Título Desconocido"
    const year = media.year?.toString() || ""
    const eraTheme = getSeriesEraTheme(media.tmdbId)
    const isAdaptiveEra = ts.effectiveMode === "era" && (!ts.themeEra || ts.themeEra === "era-universe")
    const localTheme = isAdaptiveEra && eraTheme ? eraTheme : undefined
    const loreSynopsis = lore?.specialTrivia || lore?.chronologyNotes || lore?.keyEvents?.join(" ")
    const isDescriptionEnglish = media.description && /^(the|after|when|with|in\s+the|during|a\s+|goku\b)/i.test(media.description.trim())
    const synopsis = stripHtml(
        (!media.description || isDescriptionEnglish ? (loreSynopsis || media.description) : media.description)
        || loreSynopsis
        || "Sin descripción disponible."
    )
    const backdropSrc = media.bannerImage ?? media.posterImage ?? null
    const backdropUrl = getHighResImage(backdropSrc || "")
    const posterUrl = getHighResImage(media.posterImage || "")
    const hasBannerImage = !!media.bannerImage

    const durationMins = entry.episodes?.[0]?.episodeMetadata?.length || (continuityData?.item?.duration ? Math.round(continuityData.item.duration / 60) : null)
    const formattedDuration = durationMins ? (durationMins >= 60 ? `${Math.floor(durationMins / 60)}h ${durationMins % 60}m` : `${durationMins}m`) : null

    const techInfo = entry.localFiles?.[0]?.technicalInfo as FileTechnicalInfo | undefined
    const streamWidth = techInfo?.videoStream?.width ?? 0
    const colorTransfer = (techInfo?.videoStream?.colorTransfer || "").toLowerCase()
    const isHDR = colorTransfer.includes("smpte2084") || colorTransfer.includes("arib-std-b67") || (((techInfo?.videoStream as unknown as { bitsPerRawSample?: number })?.bitsPerRawSample ?? 0) > 8)
    const technicalData = techInfo ? {
        fileSize: formatFileSize(techInfo.size || 0),
        resolutionTag: streamWidth >= 3840 ? "4K UHD" : streamWidth >= 1920 ? "1080P FHD" : streamWidth >= 1280 ? "720P HD" : "SD",
        is4K: streamWidth >= 3840,
        isHDR,
        videoCodec: techInfo.videoStream?.codec?.toUpperCase(),
        audioCodec: techInfo.audioStreams?.[0]?.codec?.toUpperCase(),
    } : null

    const progressPercent = continuityData?.item?.duration ? (continuityData.item.currentTime / continuityData.item.duration) * 100 : 0

    const handleToggleWatched = (e: React.MouseEvent) => {
        e.stopPropagation()
        const nextState = !isWatched
        setUserWatchedOverride(nextState)
        updateProgress({
            mediaId: Number(movieId),
            progress: nextState ? 1 : 0,
        })
        toast.success(nextState ? "Marcada como vista" : "Quitada de vistas")
    }

    const handleToggleFavorite = (e: React.MouseEvent) => {
        e.stopPropagation()
        setIsFavorite(prev => !prev)
        toast.success(!isFavorite ? "Añadida a favoritos" : "Quitada de favoritos")
    }

    const handlePlayLocalFile = (localFile: Anime_LocalFile) => {
        if (!localFile.path) return toast.error("Archivo no disponible.")
        const epNum = localFile.parsedInfo?.episode || localFile.metadata?.episode || 1
        const targetType = "direct"
        startViewTransition(() => {
            setPlayTarget({
                path: localFile.path,
                streamType: targetType as Mediastream_StreamType,
                episodeLabel: localFile.name,
                episodeNumber: Number(epNum),
                malId: media.idMal ?? null,
            })
        })
    }

    const handlePlayDefault = () => {
        if (entry.localFiles && entry.localFiles.length > 0) {
            handlePlayLocalFile(entry.localFiles[0])
        } else {
            toast.info("No hay archivos locales disponibles para reproducir.")
        }
    }

    const preloadTarget = () => {
        if (!defaultTargetPath || preloadedPathsRef.current.has(defaultTargetPath)) return
        preloadedPathsRef.current.add(defaultTargetPath)
        preloadStream({ path: defaultTargetPath, streamType: "direct", audioStreamIndex: 0, preferredAudioLang: "" })
    }

    const handleAddToQueue = (e: React.MouseEvent) => {
        e.stopPropagation()
        if (entry.localFiles && entry.localFiles.length > 0) {
            const localFile = entry.localFiles[0]
            addToQueue({
                id: Number(movieId),
                title: title,
                playableUrl: localFile.path || "",
                thumbnail: getMediumResImage(media.posterImage || ""),
                mediaId: Number(movieId),
                episodeNumber: 1,
                malId: media.idMal ?? null,
                mediaFormat: media.format ?? "MOVIE"
            })
            toast.success("Añadido a la cola de reproducción")
        } else {
            toast.error("No hay archivos locales disponibles.")
        }
    }

    const titleNode = cleanMovieTitle(title)

    const topBadge = (
        <span
            className="inline-flex items-center font-mono text-label-sm tracking-display font-bold uppercase px-3 py-1 rounded-full border backdrop-blur-overlay-sm"
            style={{
                color: eraAccent,
                borderColor: `color-mix(in srgb, ${eraAccent} 27%, transparent)`,
                backgroundColor: `color-mix(in srgb, ${eraAccent} 8%, transparent)`,
                boxShadow: `0 0 15px color-mix(in srgb, ${eraAccent} 15%, transparent)`
            }}
        >
            {eraLabel}
        </span>
    )

    const metadataRow = (
        <MediaMetadataCapsule
            format="PELÍCULA"
            year={year}
            duration={formattedDuration}
            ageRating={media.isNsfw ? "18+" : "PG-13"}
            quality={technicalData?.is4K ? "4K UHD" : technicalData?.resolutionTag || undefined}
            rating={media.score ? media.score / 10 : undefined}
        >
            {technicalData?.isHDR && (
                <span className="bg-amber-950/60 text-amber-300 text-[10px] font-mono font-black tracking-widest px-2.5 py-1 rounded-lg border border-amber-500/30 uppercase shadow-sm">
                    HDR10
                </span>
            )}
            {technicalData?.videoCodec && (
                <span className="bg-white/10 text-zinc-200 text-[10px] font-mono font-bold tracking-wider px-2.5 py-1 rounded-lg border border-white/10 uppercase">
                    {technicalData.videoCodec}
                </span>
            )}
            <span className="bg-white/10 text-zinc-200 text-[10px] font-mono font-bold tracking-wider px-2.5 py-1 rounded-lg border border-white/10 uppercase">
                CC
            </span>
        </MediaMetadataCapsule>
    )

    const actionButtons = (
        <div className="w-full flex flex-col gap-3 md:flex-row md:items-center md:gap-4 pointer-events-auto">
            {/* Play Button - Full width on mobile, auto on desktop */}
            <PlayCta
                onClick={handlePlayDefault}
                onHoverIntent={preloadTarget}
                label={continuityData?.item?.currentTime ? "Reanudar" : "Reproducir"}
                sublabel={continuityData?.item?.currentTime ? "Continuar viendo" : "Ver película"}
                className="w-full md:w-auto"
            />

            {/* Row of secondary actions - full width and distributed on mobile */}
            <div className="flex items-center gap-3 w-full md:w-auto">
                {entry.localFiles && entry.localFiles.length > 0 && (
                    <GlassIconButton
                        onClick={handleAddToQueue}
                        icon={<IconUiListPlus className="w-5 h-5" />}
                        title="Añadir a la cola"
                        className="flex-1 md:flex-initial"
                    />
                )}

                <GlassIconButton
                    onClick={handleToggleWatched}
                    isActive={isWatched}
                    activeTone="success"
                    icon={isWatched ? <IconUiCheck className="w-5 h-5 stroke-[3px]" /> : <IconUiPlus className="w-5 h-5 stroke-[2.5px]" />}
                    title={isWatched ? "Marcar como no vista" : "Marcar como vista"}
                    className="flex-1 md:flex-initial"
                />

                <GlassIconButton
                    onClick={handleToggleFavorite}
                    isActive={isFavorite}
                    activeTone="destructive"
                    icon={<IconUiHeart className={cn("w-5 h-5", isFavorite && "fill-current")} />}
                    title={isFavorite ? "Quitar de favoritos" : "Añadir a favoritos"}
                    className="flex-1 md:flex-initial"
                />
            </div>
        </div>
    )

    return (
        <div ref={containerRef} className="w-full flex flex-col relative text-on-surface select-none" data-theme={localTheme || undefined}>
            {/* Hero: 100svh (o 62svh en banner pequeño) – altura completa del viewport */}
            <div className="flex-shrink-0">
                <MediaHero
                    scrollContainerRef={containerRef}
                    backdropUrl={backdropUrl}
                    posterUrl={posterUrl}
                    hasBannerImage={hasBannerImage}
                    title={titleNode}
                    topBadge={topBadge}
                    metadataRow={metadataRow}
                    synopsis={synopsis}
                    actionButtons={actionButtons}
                    showPosterColumn={true}
                    onBackdropClick={handlePlayDefault}
                />
            </div>

            {/* Progress bar (overlay al final del hero) */}
            {continuityData?.item?.currentTime && continuityData.item.duration && (
                <div className="w-full max-w-content mx-auto px-4 sm:px-6 md:px-8 lg:px-10 -mt-16 mb-6 relative z-20">
                    <WatchProgressBar percent={progressPercent} size="hero" animateOnMount />
                </div>
            )}

            {/* Video Player (modal overlay fixed) */}
            {playTarget && (
                <React.Suspense fallback={<PlayerFallback />}>
                    <VideoPlayer
                        streamUrl={playTarget.path}
                        streamType={playTarget.streamType as "local" | "online" | "direct"}
                        title={title}
                        episodeLabel={playTarget.episodeLabel}
                        episodeNumber={playTarget.episodeNumber}
                        mediaId={Number(movieId)}
                        malId={playTarget.malId}
                        mediaFormat={media.format ?? "MOVIE"}
                        onNextEpisode={() => {}}
                        hasNextEpisode={false}
                        onClose={() => {
                            startViewTransition(() => setPlayTarget(null))
                            refetchContinuity()
                            queryClient.invalidateQueries({ queryKey: [API_ENDPOINTS.ANIME_ENTRIES.GetAnimeEntry.key, String(movieId)] })
                        }}
                    />
                </React.Suspense>
            )}
        </div>
    )
}
