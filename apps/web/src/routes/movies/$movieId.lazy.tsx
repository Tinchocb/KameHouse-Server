import { createLazyFileRoute, useNavigate } from "@tanstack/react-router"
import { useQueryClient } from "@tanstack/react-query"
import React, { useState, useEffect, useRef } from "react"
import { m } from "framer-motion"
import { Compass } from "lucide-react"
import { toast } from "sonner"
import { useQueueStore, useUIStore } from "@/lib/store"
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
import { BentoDetailsSkeleton } from "@/components/ui/shimmer-skeleton"

const VideoPlayer = React.lazy(() => import("@/components/video/player").then(m => ({ default: m.VideoPlayer })))
import { startViewTransition } from "@/lib/helpers/transitions"
import { IconSwap, useTransientFlag } from "@/components/ui/kinetics"
import { MediaHero } from "@/components/ui/media-hero"
import { MediaMetadataCapsule } from "@/components/ui/media-metadata-capsule"
import { useSound } from "@/hooks/use-sound"
import { cn } from "@/components/ui/core/styling"
import { IconUiListPlus, IconUiCheck, IconUiPlus, IconUiHeart, IconStatusFileVideo } from "@/components/ui/icons"
import { SectionBar } from "@/components/ui/sectionbar/sectionbar"
import { cleanMovieTitle } from "./-MovieCard"
import { getEntryEraId, getEntryTitle, getMovieLore, getMovieSynopsis } from "./-components/movies-utils"
import { ERAS, ERA_COLOR_MAP } from "@/lib/config/eras"

import { getSeriesEraTheme } from "@/lib/config/dragonball.config"
import { useIntelligenceStore } from "@/hooks/use-home-intelligence"
import { useThemeSettings, useHideAudienceScore } from "@/lib/theme/theme-hooks"
import { getMovieHeroArt, heroArtFromUrl, DEFAULT_MOVIE_FOCAL } from "@/lib/config/hero-art"

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

const getFriendlyLanguage = (lang?: string | null) => {
    if (!lang) return "Desconocido"
    const lower = lang.trim().toLowerCase()
    if (lower === "und" || lower === "unknown") return "Desconocido"

    const codeMap: Record<string, string> = {
        spa: "es", jpn: "ja", eng: "en", fra: "fr", fre: "fr",
        ger: "de", deu: "de", ita: "it", por: "pt", rus: "ru",
        chi: "zh", zho: "zh", kor: "ko", cat: "ca", eus: "eu", glg: "gl",
    }
    const normalized = codeMap[lower] || lower

    try {
        if (typeof Intl !== "undefined" && Intl.DisplayNames) {
            const dn = new Intl.DisplayNames(["es"], { type: "language", fallback: "none" })
            const name = dn.of(normalized)
            if (name) {
                return name.charAt(0).toUpperCase() + name.slice(1)
            }
        }
    } catch {}

    return lang.toUpperCase()
}

function MovieDetailPage() {
    const { movieId } = Route.useParams()

    return (
        <MovieDetailClient key={movieId} movieId={movieId} />
    )
}

function MovieDetailClient({ movieId }: { movieId: string }) {
    const navigate = useNavigate()
    const { playSound } = useSound()
    const queryClient = useQueryClient()
    const { data: entry, isLoading } = useGetAnimeEntry(movieId)
    const numericMovieId = Number(movieId)
    const validNumericMovieId = Number.isFinite(numericMovieId) ? numericMovieId : null
    const { data: continuityData, refetch: refetchContinuity } = useGetContinuityWatchHistoryItem(validNumericMovieId ?? 0)
    const containerRef = useRef<HTMLDivElement>(null)
    // Confirmación en el mismo botón de cola con useTransientFlag canónico
    const [justQueued, triggerJustQueued] = useTransientFlag(1400)
    // El latido del corazón solo cuando lo marcás, no al abrir una película que ya era favorita.
    const [favoriteBeat, setFavoriteBeat] = useState(false)
    const addToQueue = useQueueStore(state => state.addToQueue)
    const ts = useThemeSettings()
    const hideAudienceScore = useHideAudienceScore()

    const [isFavorite, setIsFavorite] = useState<boolean>(() => {
        // Sin endpoint de favoritos en el backend: persistencia local por
        // película para que no se pierda al navegar/recargar.
        try {
            return localStorage.getItem(`kamehouse-favorite-movie-${movieId}`) === "1"
        } catch {
            return false
        }
    })
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
    // El estado local (override, favorito) se reinicia solo al cambiar de
    // película: MovieDetailPage monta este componente con key={movieId}.
    const isWatched = userWatchedOverride ?? serverWatched

    const { mutate: updateProgress } = useUpdateAnimeEntryProgress(validNumericMovieId ?? 0, 1, false)
    const { mutate: preloadStream } = usePreloadMediastreamMediaContainer()

    // Warm the media container ahead of the click (page load + hover intent).
    const defaultTargetPath = entry?.localFiles?.[0]?.path || null
    const preloadedPathsRef = useRef<Set<string>>(new Set())
    useEffect(() => {
        if (!defaultTargetPath || preloadedPathsRef.current.has(defaultTargetPath)) return
        preloadedPathsRef.current.add(defaultTargetPath)
        preloadStream({ path: defaultTargetPath, streamType: "direct", audioStreamIndex: 0, preferredAudioLang: "" })
    }, [defaultTargetPath, preloadStream])

    const setActiveSeriesContext = useUIStore(s => s.setActiveSeriesContext)
    const movieContextWrittenRef = React.useRef<string | null>(null)
    useEffect(() => {
        const tmdbId = entry?.media?.tmdbId || validNumericMovieId
        if (tmdbId) {
            const key = String(tmdbId)
            movieContextWrittenRef.current = key
            setActiveSeriesContext(key)
        }
        return () => {
            if (useUIStore.getState().activeSeriesContext === movieContextWrittenRef.current) {
                setActiveSeriesContext(null)
            }
        }
    }, [entry?.media?.tmdbId, movieId, validNumericMovieId, setActiveSeriesContext])

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

    const eraId = entry?.media ? getEntryEraId(entry) : "dbz"
    const eraAccent = ERA_COLOR_MAP[eraId].accent
    const eraLabel = ERAS.find(e => e.id === eraId)?.title ?? "Dragon Ball"

    if (!entry || !entry.media) {
        if (isLoading) {
            return <BentoDetailsSkeleton isMovie />
        }
        return (
            <div className="min-h-screen text-on-surface flex items-center justify-center">
                <EmptyState
                    title="Película no encontrada"
                    message="No pudimos cargar este contenido."
                    action={
                        <button
                            type="button"
                            onClick={() => navigate({ to: "/movies" })}
                            className="min-h-11 px-5 rounded-full bg-white/10 [@media(hover:hover)_and_(pointer:fine)]:hover:bg-white/15 border border-white/20 text-xs font-semibold text-white transition-[background-color,border-color,transform] duration-fast ease-smooth-out active:scale-95 cursor-pointer"
                        >
                            Volver a Películas
                        </button>
                    }
                />
            </div>
        )
    }

    const media = entry.media
    const lore = getMovieLore(entry)
    // Misma regla que el hero y las tarjetas de Películas (getEntryTitle): así una
    // película no cambia de nombre al abrir su detalle.
    const title = getEntryTitle(entry)
        || media.titleEnglish
        || media.titleRomaji
        || "Título Desconocido"
    const year = media.year?.toString() || ""
    const eraTheme = getSeriesEraTheme(media.tmdbId)
    const isAdaptiveEra = ts.effectiveMode === "era" && (!ts.themeEra || ts.themeEra === "era-universe")
    const localTheme = isAdaptiveEra && eraTheme ? eraTheme : undefined
    const synopsis = getMovieSynopsis(media.description, lore) || "Sin descripción disponible."
    const heroArt = getMovieHeroArt({
        mediaId: entry.mediaId,
        tmdbId: media.tmdbId,
        bannerImage: media.bannerImage,
        posterImage: media.posterImage,
    }) ?? (media.bannerImage ? heroArtFromUrl(media.bannerImage, { focal: DEFAULT_MOVIE_FOCAL }) : null)
    const backdropSrc = heroArt?.src ?? null
    const backdropUrl = getHighResImage(backdropSrc || "")
    const posterUrl = getHighResImage(media.posterImage || "")
    const hasBannerImage = !!backdropSrc

    const durationMins = entry.episodes?.[0]?.episodeMetadata?.length || (continuityData?.item?.duration ? Math.round(continuityData.item.duration / 60) : null)
    const formattedDuration = durationMins ? (durationMins >= 60 ? `${Math.floor(durationMins / 60)}h ${durationMins % 60}m` : `${durationMins}m`) : null

    const techInfo = entry.localFiles?.[0]?.technicalInfo as FileTechnicalInfo | undefined
    const streamWidth = techInfo?.videoStream?.width ?? 0
    const colorTransfer = (techInfo?.videoStream?.colorTransfer || "").toLowerCase()
    // HDR solo por función de transferencia: PQ (HDR10) o HLG. La profundidad de
    // 10 bits no implica HDR: casi todo el anime moderno se codifica en 10 bits SDR.
    const hdrLabel = colorTransfer.includes("smpte2084") ? "HDR10" : colorTransfer.includes("arib-std-b67") ? "HLG" : null
    const technicalData = techInfo ? {
        fileSize: formatFileSize(techInfo.size || 0),
        // Sin ancho conocido no hay resolución que mostrar (antes decía "SD").
        resolutionTag: streamWidth >= 3840 ? "4K UHD" : streamWidth >= 1920 ? "1080P FHD" : streamWidth >= 1280 ? "720P HD" : streamWidth > 0 ? "SD" : undefined,
        is4K: streamWidth >= 3840,
        hdrLabel,
        hasSubtitles: (techInfo.subtitleStreams?.length ?? 0) + (techInfo.externalSubtitles?.length ?? 0) > 0,
        videoCodec: techInfo.videoStream?.codec?.toUpperCase(),
        audioCodec: techInfo.audioStreams?.[0]?.codec?.toUpperCase(),
    } : null

    const progressPercent = continuityData?.item?.duration ? (continuityData.item.currentTime / continuityData.item.duration) * 100 : 0
    // "Reanudar" arranca el reproductor en el punto guardado (misma regla que la
    // ficha de series: más de 10 s y menos del 95 %).
    const resumeSeconds = continuityData?.item?.currentTime && continuityData.item.currentTime > 10 && progressPercent < 95
        ? continuityData.item.currentTime
        : undefined

    const handleToggleWatched = (e: React.MouseEvent) => {
        e.stopPropagation()
        if (validNumericMovieId == null) return
        const nextState = !isWatched
        setUserWatchedOverride(nextState)
        updateProgress({
            mediaId: validNumericMovieId,
            progress: nextState ? 1 : 0,
        })
        playSound(nextState ? "category" : "hover", 0.3)
        toast.success(nextState ? "Marcada como vista" : "Quitada de vistas")
    }

    const handleToggleFavorite = (e: React.MouseEvent) => {
        e.stopPropagation()
        const next = !isFavorite
        setIsFavorite(next)
        if (next) {
            setFavoriteBeat(true)
            playSound("category", 0.35)
        }
        try {
            if (next) {
                localStorage.setItem(`kamehouse-favorite-movie-${movieId}`, "1")
            } else {
                localStorage.removeItem(`kamehouse-favorite-movie-${movieId}`)
            }
        } catch {}
        toast.success(next ? "Añadida a favoritos" : "Quitada de favoritos")
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
        if (validNumericMovieId == null) return
        if (entry.localFiles && entry.localFiles.length > 0) {
            const localFile = entry.localFiles[0]
            addToQueue({
                id: validNumericMovieId,
                title: title,
                playableUrl: localFile.path || "",
                thumbnail: getMediumResImage(media.posterImage || ""),
                mediaId: validNumericMovieId,
                episodeNumber: 1,
                malId: media.idMal ?? null,
                mediaFormat: media.format ?? "MOVIE"
            })
            toast.success("Añadido a la cola de reproducción")
            triggerJustQueued()
            playSound("category", 0.3)
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
            ageRating={media.isNsfw ? "18+" : undefined}
            quality={technicalData?.is4K ? "4K UHD" : technicalData?.resolutionTag || undefined}
            rating={hideAudienceScore ? undefined : (media.score ? media.score / 10 : undefined)}
        >
            {technicalData?.hdrLabel && (
                <span className="relative z-10 bg-amber-950/70 text-amber-300 text-3xs font-mono font-black tracking-widest px-2.5 py-1 rounded-full border border-amber-500/40 border-t-amber-400/70 shadow-[inset_0_1px_1px_rgba(251,191,36,0.35),0_0_12px_rgba(245,158,11,0.2)] uppercase">
                    {technicalData.hdrLabel}
                </span>
            )}
            {technicalData?.videoCodec && (
                <span className="relative z-10 bg-white/[0.08] text-white/90 text-3xs font-mono font-semibold tracking-wider px-2.5 py-1 rounded-full border border-white/15 border-t-white/30 border-b-white/5 shadow-[inset_0_1px_0_rgba(255,255,255,0.15)] uppercase">
                    {technicalData.videoCodec}
                </span>
            )}
            {technicalData?.hasSubtitles && (
                <span className="relative z-10 bg-white/[0.08] text-white/90 text-3xs font-mono font-semibold tracking-wider px-2.5 py-1 rounded-full border border-white/15 border-t-white/30 border-b-white/5 shadow-[inset_0_1px_0_rgba(255,255,255,0.15)] uppercase">
                    CC
                </span>
            )}
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
                        isActive={justQueued}
                        activeTone="success"
                        icon={
                            <IconSwap swapKey={justQueued ? "queued" : "queue"}>
                                {justQueued ? <IconUiCheck className="w-5 h-5 stroke-[3px]" /> : <IconUiListPlus className="w-5 h-5" />}
                            </IconSwap>
                        }
                        title={justQueued ? "Añadido a la cola" : "Añadir a la cola"}
                        className="flex-1 md:flex-initial"
                    />
                )}

                <GlassIconButton
                    onClick={handleToggleWatched}
                    isActive={isWatched}
                    activeTone="success"
                    icon={
                        <IconSwap swapKey={isWatched ? "watched" : "unwatched"}>
                            {isWatched ? <IconUiCheck className="w-5 h-5 stroke-[3px]" /> : <IconUiPlus className="w-5 h-5 stroke-[2.5px]" />}
                        </IconSwap>
                    }
                    title={isWatched ? "Marcar como no vista" : "Marcar como vista"}
                    className="flex-1 md:flex-initial"
                />

                <GlassIconButton
                    onClick={handleToggleFavorite}
                    isActive={isFavorite}
                    activeTone="destructive"
                    icon={
                        <m.span
                            key={isFavorite ? "fav" : "unfav"}
                            initial={{ scale: 0.7, opacity: 0 }}
                            // Al marcar favorito el corazón late con rebote elástico.
                            animate={isFavorite && favoriteBeat ? { scale: [0.7, 1.35, 0.95, 1], opacity: 1 } : { scale: 1, opacity: 1 }}
                            transition={isFavorite && favoriteBeat
                                ? { duration: 0.45, times: [0, 0.4, 0.75, 1], ease: [0.23, 1, 0.32, 1] }
                                : { type: "spring", stiffness: 480, damping: 28 }}
                            className="inline-flex"
                        >
                            <IconUiHeart className={cn("w-5 h-5", isFavorite && "fill-current text-rose-500 drop-shadow-[0_0_8px_rgba(244,63,94,0.5)]")} />
                        </m.span>
                    }
                    title={isFavorite ? "Quitar de favoritos" : "Añadir a favoritos"}
                    className="flex-1 md:flex-initial"
                />

                <GlassIconButton
                    onClick={() => navigate({ to: "/chronology", search: { era: eraId } })}
                    icon={<Compass className="w-5 h-5 text-brand-accent" />}
                    title="Ver en la Cronología"
                    className="flex-1 md:flex-initial"
                />
            </div>
        </div>
    )

    return (
        <div ref={containerRef} className="w-full min-h-screen flex flex-col relative text-on-surface select-none" data-theme={localTheme || undefined}>
            {/* Hero: pantalla completa (100dvh / min-h-screen) para experiencia cinematográfica inmersiva */}
            <div className="flex-1 flex flex-col w-full">
                <MediaHero
                    scrollContainerRef={containerRef}
                    backdropUrl={backdropUrl}
                    backdropArt={heroArt}
                    posterUrl={posterUrl}
                    hasBannerImage={hasBannerImage}
                    title={titleNode}
                    topBadge={topBadge}
                    metadataRow={metadataRow}
                    synopsis={synopsis}
                    actionButtons={actionButtons}
                    showPosterColumn={true}
                    fullHeight={true}
                    onBackdropClick={handlePlayDefault}
                />
            </div>

            {/* Progress bar (overlay al final del hero) */}
            {continuityData?.item?.currentTime && continuityData.item.duration && (
                <div className="w-full max-w-content-desktop mx-auto px-4 sm:px-6 md:px-8 lg:px-10 -mt-16 mb-6 relative z-20 pointer-events-none">
                    <WatchProgressBar percent={progressPercent} size="hero" animateOnMount />
                </div>
            )}

            {/* Secciones estructuradas inferiores con SectionBar */}
            {(techInfo || eraId) && (
                <div className="page-container py-8 pb-24 space-y-6 relative z-10">
                    {/* Ficha técnica y pistas de reproducción (solo con datos reales) */}
                    {techInfo && (
                        <SectionBar
                            label="Especificaciones del Archivo"
                            description="Detalles de video, pistas de audio y subtítulos del archivo local"
                            icon={IconStatusFileVideo}
                            variant="default"
                        >
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                                {/* Video */}
                                <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 space-y-2">
                                    <span className="text-3xs font-mono font-bold uppercase tracking-wider text-on-surface-variant/70">
                                        Video
                                    </span>
                                    <div className="text-xs font-bold text-on-surface font-mono">
                                        {streamWidth > 0 && techInfo.videoStream?.height
                                            ? `${streamWidth} × ${techInfo.videoStream.height}`
                                            : "Resolución desconocida"}
                                    </div>
                                    <div className="flex flex-wrap gap-1.5 pt-0.5">
                                        {technicalData?.videoCodec && (
                                            <span className="px-2 py-0.5 rounded-md text-3xs font-mono font-semibold bg-white/[0.06] text-on-surface-variant border border-white/10">
                                                {technicalData.videoCodec}
                                            </span>
                                        )}
                                        {technicalData?.hdrLabel ? (
                                            <span className="px-2 py-0.5 rounded-md text-3xs font-mono font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                                                {technicalData.hdrLabel}
                                            </span>
                                        ) : (
                                            <span className="px-2 py-0.5 rounded-md text-3xs font-mono font-semibold bg-white/[0.06] text-on-surface-variant border border-white/10">
                                                SDR
                                            </span>
                                        )}
                                        {techInfo.videoStream?.frameRate && (
                                            <span className="px-2 py-0.5 rounded-md text-3xs font-mono font-semibold bg-white/[0.06] text-on-surface-variant border border-white/10">
                                                {Number(techInfo.videoStream.frameRate).toFixed(2)} fps
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Archivo y Contenedor */}
                                <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 space-y-2">
                                    <span className="text-3xs font-mono font-bold uppercase tracking-wider text-on-surface-variant/70">
                                        Archivo & Tamaño
                                    </span>
                                    <div className="text-xs font-bold text-on-surface font-mono">
                                        {technicalData?.fileSize || formatFileSize(techInfo.size || 0)}
                                    </div>
                                    <div className="flex flex-wrap gap-1.5 pt-0.5">
                                        {techInfo.format && (
                                            <span className="px-2 py-0.5 rounded-md text-3xs font-mono font-semibold bg-white/[0.06] text-on-surface-variant border border-white/10 uppercase">
                                                {techInfo.format.split(",")[0]}
                                            </span>
                                        )}
                                        {techInfo.bitrate && techInfo.bitrate > 0 && (
                                            <span className="px-2 py-0.5 rounded-md text-3xs font-mono font-semibold bg-white/[0.06] text-on-surface-variant border border-white/10">
                                                {techInfo.bitrate >= 1_000_000
                                                    ? `${(techInfo.bitrate / 1_000_000).toFixed(1)} Mbps`
                                                    : `${Math.round(techInfo.bitrate / 1000)} kbps`}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Pistas de Audio */}
                                <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 space-y-2 sm:col-span-2 lg:col-span-1">
                                    <span className="text-3xs font-mono font-bold uppercase tracking-wider text-on-surface-variant/70">
                                        Pistas de Audio ({techInfo.audioStreams?.length ?? 0})
                                    </span>
                                    {techInfo.audioStreams && techInfo.audioStreams.length > 0 ? (
                                        <div className="space-y-1.5 max-h-28 overflow-y-auto no-scrollbar">
                                            {techInfo.audioStreams.map((audio, i) => (
                                                <div key={i} className="flex items-center justify-between text-2xs font-mono">
                                                    <span className="font-semibold text-on-surface truncate">
                                                        {audio.title || getFriendlyLanguage(audio.language)}
                                                    </span>
                                                    <span className="text-on-surface-variant/70 text-3xs ml-2 shrink-0">
                                                        {[audio.codec?.toUpperCase(), audio.language?.toUpperCase()].filter(Boolean).join(" · ")}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-2xs text-on-surface-variant/50">Sin pistas de audio detectadas</p>
                                    )}
                                </div>

                                {/* Subtítulos */}
                                <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 space-y-2 sm:col-span-2 lg:col-span-1">
                                    <span className="text-3xs font-mono font-bold uppercase tracking-wider text-on-surface-variant/70">
                                        Subtítulos ({(techInfo.subtitleStreams?.length ?? 0) + (techInfo.externalSubtitles?.length ?? 0)})
                                    </span>
                                    {((techInfo.subtitleStreams?.length ?? 0) + (techInfo.externalSubtitles?.length ?? 0)) > 0 ? (
                                        <div className="space-y-1.5 max-h-28 overflow-y-auto no-scrollbar">
                                            {techInfo.subtitleStreams?.map((sub, i) => (
                                                <div key={`sub-${i}`} className="flex items-center justify-between text-2xs font-mono">
                                                    <span className="font-semibold text-on-surface truncate">
                                                        {sub.title || getFriendlyLanguage(sub.language)}
                                                    </span>
                                                    <span className="text-on-surface-variant/70 text-3xs ml-2 shrink-0">
                                                        {sub.codec?.toUpperCase() || "SUB"}
                                                    </span>
                                                </div>
                                            ))}
                                            {techInfo.externalSubtitles?.map((ext, i) => (
                                                <div key={`ext-${i}`} className="flex items-center justify-between text-2xs font-mono">
                                                    <span className="font-semibold text-on-surface truncate">
                                                        {getFriendlyLanguage(ext.language)} (Ext)
                                                    </span>
                                                    <span className="text-on-surface-variant/70 text-3xs ml-2 shrink-0 uppercase">
                                                        {ext.format}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-2xs text-on-surface-variant/50">Sin subtítulos detectados</p>
                                    )}
                                </div>
                            </div>
                        </SectionBar>
                    )}

                    {/* Ubicación en la Cronología de Dragon Ball */}
                    {eraId && (
                        <SectionBar
                            label="Ubicación en la Cronología"
                            description={`Lapso histórico correspondiente a ${eraLabel}`}
                            icon={Compass}
                            variant="default"
                            badge={
                                <span
                                    className="px-2.5 py-0.5 rounded-full text-3xs font-mono font-bold uppercase border"
                                    style={{
                                        color: eraAccent,
                                        borderColor: `color-mix(in srgb, ${eraAccent} 35%, transparent)`,
                                        backgroundColor: `color-mix(in srgb, ${eraAccent} 10%, transparent)`,
                                    }}
                                >
                                    {eraLabel}
                                </span>
                            }
                        >
                            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4.5 rounded-xl bg-white/[0.03] border border-white/10 [@media(hover:hover)_and_(pointer:fine)]:hover:border-white/20 transition-colors duration-fast ease-smooth-out">
                                <div className="space-y-1">
                                    <h4 className="text-xs font-bold text-on-surface font-mono uppercase tracking-wider">
                                        Línea Temporal Universal
                                    </h4>
                                    <p className="text-2xs text-on-surface-variant/75 max-w-xl font-medium leading-relaxed">
                                        Ubicá este filme dentro de los arcos, períodos y eventos de la Cronología oficial de Dragon Ball.
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => navigate({ to: "/chronology", search: { era: eraId } })}
                                    className="inline-flex items-center gap-2 px-5 py-2 rounded-full font-display font-bold text-xs uppercase tracking-wider bg-brand-accent text-on-primary [@media(hover:hover)_and_(pointer:fine)]:hover:brightness-110 active:scale-95 transition-[transform,filter] duration-fast ease-out-strong cursor-pointer shrink-0 shadow-elevation-1"
                                >
                                    <Compass className="w-4 h-4" />
                                    Ver en Cronología
                                </button>
                            </div>
                        </SectionBar>
                    )}
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
                        initialProgressSeconds={resumeSeconds}
                        mediaId={validNumericMovieId ?? 0}
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
