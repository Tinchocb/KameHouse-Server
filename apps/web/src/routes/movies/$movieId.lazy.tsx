import { createLazyFileRoute, useNavigate } from "@tanstack/react-router"
import { useQueryClient } from "@tanstack/react-query"
import React, { useState, useEffect, useRef } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { useQueueStore, useUIStore } from "@/lib/store"
import { getHighResImage, getMediumResImage } from "@/lib/helpers/images"
import { useGetAnimeEntry, useGetAnimeEntrySource, useUpdateAnimeEntryProgress } from "@/api/hooks/anime_entries.hooks"
import { useGetContinuityWatchHistoryItem } from "@/api/hooks/continuity.hooks"
import { usePreloadMediastreamMediaContainer } from "@/api/hooks/mediastream.hooks"
import { API_ENDPOINTS } from "@/api/generated/endpoints"
import { Anime_LocalFile, FileTechnicalInfo, Mediastream_StreamType } from "@/api/generated/types"
import { EmptyState } from "@/components/shared/empty-state"
import { LibraryErrorState } from "@/components/shared/library-error-state"
import { isNotFoundError } from "@/api/client/requests"
import { describeMissingSources } from "@/routes/series/$seriesId/-hooks/missing-sources"
import { PlayerFallback } from "@/components/video/player-fallback"
import { prewarmVideoPlayer } from "@/components/video/prewarm"
import { BentoDetailsSkeleton } from "@/components/ui/shimmer-skeleton"

const VideoPlayer = React.lazy(() => import("@/components/video/player").then(m => ({ default: m.VideoPlayer })))
import { startViewTransition } from "@/lib/helpers/transitions"
import { cn } from "@/components/ui/core/styling"
import { IconSwap, useTransientFlag } from "@/components/ui/kinetics"
import { useSound } from "@/hooks/use-sound"
import { IconUiListPlus, IconUiCheck, IconUiPlus, IconUiHeart } from "@/components/ui/icons"
import { DetailHero } from "@/components/media-detail/detail-hero"
import { PrimaryPlayButton, ResumeProgress, RoundAction } from "@/components/media-detail/detail-actions"
import { getEntryEraId, getEntryTitle, getMovieLore, getMovieSynopsis } from "./-components/movies-utils"
import { ERAS, ERA_COLOR_MAP } from "@/lib/config/eras"

import { getSeriesEraTheme } from "@/lib/config/dragonball.config"
import { useIntelligenceStore } from "@/hooks/use-home-intelligence"
import { asEraThemeId, useScreenEra } from "@/lib/theme/screen-era"
import { useIsClassicMode, useIsMinimalistMode } from "@/lib/theme/use-classic-mode"
import { getMovieHeroArt, heroArtFromUrl, DEFAULT_MOVIE_FOCAL } from "@/lib/config/hero-art"

export const Route = createLazyFileRoute("/movies/$movieId")({
    component: MovieDetailPage,
})

/** Etiquetas posibles del botón principal: reservan el ancho de la más larga. */
const PRIMARY_PLAY_LABELS = ["Reproducir", "Ver de nuevo", "Continuar"] as const



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
    // Un id que no es un entero positivo (/movies/abc) no existe: no se consulta al servidor y se
    // muestra "Película no encontrada" en vez de un error de conexión.
    const idValid = /^[1-9]\d*$/.test(movieId)
    const { data: entry, isLoading, isError, error, refetch } = useGetAnimeEntry(idValid ? movieId : null)
    const { data: sourceInfo } = useGetAnimeEntrySource(idValid ? movieId : null)
    const numericMovieId = Number(movieId)
    const validNumericMovieId = idValid ? numericMovieId : null
    const { data: continuityData, refetch: refetchContinuity } = useGetContinuityWatchHistoryItem(validNumericMovieId ?? 0)
    // Confirmación en el mismo botón de cola con useTransientFlag canónico
    const [justQueued, triggerJustQueued] = useTransientFlag(1400)
    const addToQueue = useQueueStore(state => state.addToQueue)
    const isClassic = useIsClassicMode()
    const isMinimalist = useIsMinimalistMode()
    // Universo DB toma la saga de la película en toda la app (también el reproductor, en portal).
    useScreenEra(asEraThemeId(getSeriesEraTheme(entry?.media?.tmdbId)))

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

    const watchedPendingRef = useRef(false)
    const { mutate: updateProgress, isPending: isWatchedPending } = useUpdateAnimeEntryProgress(validNumericMovieId ?? 0, false)
    const { mutate: preloadStream } = usePreloadMediastreamMediaContainer()

    // Warm the media container ahead of the click (page load + hover intent).
    const defaultTargetPath = entry?.localFiles?.[0]?.path || null
    const preloadedPathsRef = useRef<Set<string>>(new Set())
    useEffect(() => {
        if (!defaultTargetPath) return
        prewarmVideoPlayer()
        if (preloadedPathsRef.current.has(defaultTargetPath)) return
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

    if (isError && !entry && !isNotFoundError(error)) {
        return (
            <LibraryErrorState
                title="No pudimos cargar esta película"
                error={error}
                onRetry={() => { void refetch() }}
            />
        )
    }

    if (!entry || !entry.media) {
        if (isLoading) {
            return <BentoDetailsSkeleton isMovie />
        }
        return (
            <div className="min-h-dvh text-on-surface flex items-center justify-center">
                <EmptyState
                    title="Película no encontrada"
                    message="No encontramos esta película. Vuelve a Películas o prueba con otra."
                    action={
                        <Button intent="secondary" onClick={() => navigate({ to: "/movies" })}>
                            Volver a Películas
                        </Button>
                    }
                />
            </div>
        )
    }

    const eraId = getEntryEraId(entry)
    const eraLabel = ERAS.find(e => e.id === eraId)?.title ?? "Dragon Ball"
    const currentEraColors = eraId ? ERA_COLOR_MAP[eraId] : undefined

    const media = entry.media
    const lore = getMovieLore(entry)
    // Misma regla que el hero y las tarjetas de Películas (getEntryTitle): así una
    // película no cambia de nombre al abrir su detalle.
    const title = getEntryTitle(entry)
        || media.titleEnglish
        || media.titleRomaji
        || "Título desconocido"
    const year = media.year?.toString() || ""
    const synopsis = getMovieSynopsis(media.description, lore) || "Sin descripción disponible."

    const eyebrowNode = (
        <div className="flex items-center gap-2">
            <span
                className="movies-hero-era-badge px-2.5 py-0.5 rounded-full text-2xs font-extrabold uppercase tracking-wider border"
                style={
                    isClassic
                        ? {
                            backgroundColor: "var(--neutral-elev-2)",
                            borderColor: "var(--neutral-separator)",
                            color: "var(--label-1)",
                        }
                        : currentEraColors
                        ? {
                            backgroundColor: `color-mix(in srgb, ${currentEraColors.accent} 22%, rgba(0,0,0,0.65))`,
                            borderColor: `color-mix(in srgb, ${currentEraColors.accent} 45%, transparent)`,
                            color: currentEraColors.accent,
                        }
                        : {
                            backgroundColor: "rgba(0,0,0,0.60)",
                            borderColor: "rgba(255,255,255,0.22)",
                            color: "var(--label-1)",
                        }
                }
            >
                {eraLabel}
            </span>
        </div>
    )
    const heroArt = getMovieHeroArt({
        mediaId: entry.mediaId,
        tmdbId: media.tmdbId,
        bannerImage: media.bannerImage,
        posterImage: media.posterImage,
    }) ?? (media.bannerImage ? heroArtFromUrl(media.bannerImage, { focal: DEFAULT_MOVIE_FOCAL }) : null)

    const durationMins = entry.episodes?.[0]?.episodeMetadata?.length || (continuityData?.item?.duration ? Math.round(continuityData.item.duration / 60) : null)
    const formattedDuration = durationMins ? (durationMins >= 60 ? `${Math.floor(durationMins / 60)}h ${durationMins % 60}m` : `${durationMins}m`) : null

    const techInfo = entry.localFiles?.[0]?.technicalInfo as FileTechnicalInfo | undefined
    const streamWidth = techInfo?.videoStream?.width ?? 0
    const colorTransfer = (techInfo?.videoStream?.colorTransfer || "").toLowerCase()
    // HDR solo por función de transferencia: PQ (HDR10) o HLG. La profundidad de
    // 10 bits no implica HDR: casi todo el anime moderno se codifica en 10 bits SDR.
    const hdrLabel = colorTransfer.includes("smpte2084") ? "HDR10" : colorTransfer.includes("arib-std-b67") ? "HLG" : null
    const technicalData = techInfo ? {
        // Sin ancho conocido no hay resolución que mostrar (antes decía "SD").
        resolutionTag: streamWidth >= 3840 ? "4K UHD" : streamWidth >= 1920 ? "1080P FHD" : streamWidth >= 1280 ? "720P HD" : streamWidth > 0 ? "SD" : undefined,
        hdrLabel,
    } : null

    const progressPercent = continuityData?.item?.duration ? (continuityData.item.currentTime / continuityData.item.duration) * 100 : 0
    // "Reanudar" arranca el reproductor en el punto guardado (misma regla que la
    // ficha de series: más de 10 s y menos del 95 %).
    const resumeSeconds = continuityData?.item?.currentTime && continuityData.item.currentTime > 10 && progressPercent < 95
        ? continuityData.item.currentTime
        : undefined

    const handleToggleWatched = () => {
        if (validNumericMovieId == null || watchedPendingRef.current || isWatchedPending) return
        const nextState = !isWatched
        const previousOverride = userWatchedOverride
        watchedPendingRef.current = true
        // El hook actualiza la caché de forma optimista; conservar el estado visible hasta confirmar.
        setUserWatchedOverride(isWatched)
        updateProgress({
            mediaId: validNumericMovieId,
            progress: nextState ? 1 : 0,
        }, {
            onSuccess: () => {
                setUserWatchedOverride(nextState)
                playSound(nextState ? "category" : "hover", 0.3)
                toast.success(nextState ? "Marcada como vista" : "Quitada de vistas")
            },
            onError: () => {
                setUserWatchedOverride(previousOverride)
                toast.error("No se pudo actualizar el estado de visto", { description: "Inténtalo de nuevo." })
            },
            onSettled: () => { watchedPendingRef.current = false },
        })
    }

    const handleToggleFavorite = () => {
        const next = !isFavorite
        setIsFavorite(next)
        if (next) playSound("category", 0.35)
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
        if (!localFile.path) return toast.error("Archivo no disponible.", { description: "Revisa la biblioteca en Ajustes." })
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
            const missing = describeMissingSources(sourceInfo, "esta película")
            toast.info(missing.title, {
                description: missing.message,
                action: { label: "Ajustes", onClick: () => navigate({ to: "/settings" }) },
            })
        }
    }

    const preloadTarget = () => {
        if (!defaultTargetPath || preloadedPathsRef.current.has(defaultTargetPath)) return
        preloadedPathsRef.current.add(defaultTargetPath)
        preloadStream({ path: defaultTargetPath, streamType: "direct", audioStreamIndex: 0, preferredAudioLang: "" })
    }

    const handleAddToQueue = () => {
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
            toast.success("Añadido a Mi Lista")
            triggerJustQueued()
            playSound("category", 0.3)
        } else {
            toast.error("No hay archivos para añadir a Mi Lista.", { description: "Revisa la biblioteca en Ajustes." })
        }
    }

    const remainingMinutes = resumeSeconds && continuityData?.item?.duration
        ? Math.max(1, Math.round((continuityData.item.duration - resumeSeconds) / 60))
        : null
    const remainingLabel = remainingMinutes ? `quedan ${remainingMinutes} min` : null
    const primaryLabel = resumeSeconds ? "Continuar" : isWatched ? "Ver de nuevo" : "Reproducir"
    const genres = Array.isArray(media.genres) ? media.genres.map(String) : media.genres ? Object.values(media.genres).map(String) : []
    return (
        <div className="w-full min-h-dvh flex flex-col relative text-on-surface">
            <DetailHero
                className="min-h-dvh flex-1"
                art={heroArt}
                posterUrl={null}
                posterShareKey={`movies:${movieId}`}
                title={title}
                logoUrl={media.logoImage || null}
                eyebrow={isMinimalist ? null : eyebrowNode}
                meta={
                    isMinimalist
                        ? (formattedDuration ? [formattedDuration] : [])
                        : [
                            year || null,
                            formattedDuration,
                            technicalData?.hdrLabel ?? technicalData?.resolutionTag ?? null,
                            media.score ? `★ ${(media.score / 10).toFixed(1)} TMDB` : null,
                            media.isNsfw ? "18+" : null,
                            genres.length > 0 ? genres.slice(0, 2).join(" · ") : null,
                        ]
                }
                synopsis={synopsis}
                onBack={() => navigate({ to: "/movies" })}
                backLabel="Volver a Películas"
                onArtClick={handlePlayDefault}
                actions={
                    <>
                        <PrimaryPlayButton
                            label={primaryLabel}
                            detail={remainingLabel}
                            reserveLabels={PRIMARY_PLAY_LABELS}
                            onClick={handlePlayDefault}
                            onHoverIntent={preloadTarget}
                        />
                        {entry.localFiles && entry.localFiles.length > 0 && (
                            <RoundAction
                                label={justQueued ? "Añadido a Mi Lista" : "Añadir a Mi Lista"}
                                onClick={handleAddToQueue}
                                icon={
                                    <IconSwap subtle swapKey={justQueued ? "queued" : "queue"}>
                                        {justQueued ? <IconUiCheck className="w-5 h-5" /> : <IconUiListPlus className="w-5 h-5" />}
                                    </IconSwap>
                                }
                            />
                        )}
                        <RoundAction
                            label={isWatched ? "Quitar de vistas" : "Marcar como vista"}
                            disabled={isWatchedPending}
                            aria-busy={isWatchedPending || undefined}
                            pressed={isWatched}
                            onClick={handleToggleWatched}
                            icon={
                                <IconSwap subtle swapKey={isWatched ? "watched" : "unwatched"}>
                                    {isWatched ? <IconUiCheck className="w-5 h-5" /> : <IconUiPlus className="w-5 h-5" />}
                                </IconSwap>
                            }
                        />
                        <RoundAction
                            label={isFavorite ? "Quitar de favoritos" : "Añadir a favoritos"}
                            pressed={isFavorite}
                            onClick={handleToggleFavorite}
                            icon={
                                <IconSwap subtle swapKey={isFavorite ? "fav" : "unfav"}>
                                    <IconUiHeart className={cn("w-5 h-5", isFavorite && "fill-current text-status-error [filter:var(--drop-shadow-favorite)]")} />
                                </IconSwap>
                            }
                        />
                    </>
                }
                footer={resumeSeconds && remainingLabel ? <ResumeProgress percent={progressPercent} label={remainingLabel} /> : null}
            />

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
