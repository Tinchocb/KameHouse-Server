import { createLazyFileRoute, useNavigate } from "@tanstack/react-router"
import { HydrationBoundary } from "@tanstack/react-query"
import React, { useState, useCallback, useMemo, useRef, useEffect } from "react"
import { useSound } from "@/hooks/use-sound"

import { useGetAnimeEntry } from "@/api/hooks/anime_entries.hooks"
import { useGetContinuityWatchHistoryItem } from "@/api/hooks/continuity.hooks"
import { useServerQuery } from "@/api/client/requests"
import { EXTRA_ENDPOINTS } from "@/api/client/endpoints.extra"
import { EmptyState } from "@/components/shared/empty-state"
import { useUIStore } from "@/lib/store"

const VideoPlayer = React.lazy(() =>
    import("@/components/video/player").then(m => ({ default: m.VideoPlayer }))
)
import { isDragonBallTmdbId, getSeriesEraTheme, resolveSeriesSagas } from "@/lib/config/dragonball.config"
import { getSeriesIdFromMedia } from "@/lib/helpers/series"
import { useGetLibraryCollection } from "@/api/hooks/anime_collection.hooks"
import { useThemeSettings } from "@/lib/theme/theme-hooks"

import { SeriesHero } from "./-components/series-hero"
import { SagaSelector } from "./-components/saga-selector"
import { SeriesEpisodesTab } from "./-components/series-episodes-tab"
import type { SagaDTO, SagaDetailSearchParams } from "@/api/types/series.types"
import { BentoDetailsSkeleton } from "@/components/ui/shimmer-skeleton"
import { CharacterDetailModal, type DragonBallLoreData } from "@/components/shared/character-detail-modal"
import { Vaul, VaulContent } from "@/components/vaul"
import { IconNavigationChevronLeft, IconNavigationLayers, IconUiClose } from "@/components/ui/icons"
import { PlayerFallback } from "@/components/video/player-fallback"
import { SeriesContinueWatching } from "./-components/series-continue-watching"

// ── Custom hooks ──────────────────────────────────────────────────────────────
import { useSeriesData } from "./-hooks/use-series-data"
import { useSeriesPlayback } from "./-hooks/use-series-playback"
import { resolveEpisodeTitle } from "./-hooks/series-playback.helpers"
import { queryKeys } from "@/lib/query-keys"

export const Route = createLazyFileRoute("/series/$seriesId/")({
    component: SeriesDetailPage,
})

function SeriesDetailPage() {
    const { seriesId } = Route.useParams()
    const loaderData = Route.useLoaderData()
    const dehydrateState = loaderData?.dehydrateState

    return (
        <HydrationBoundary state={dehydrateState}>
            <SeriesDetailClient key={seriesId} seriesId={seriesId} />
        </HydrationBoundary>
    )
}

function SeriesDetailClient({ seriesId }: { seriesId: string }) {
    const { playSound } = useSound()
    const navigate = useNavigate()
    const {
        saga: activeSagaId,
        subSaga: activeSubSagaId,
        autoplay: autoplayEp,
    } = Route.useSearch()
    const { data: entry, isLoading } = useGetAnimeEntry(seriesId)
    const { data: libraryCollection } = useGetLibraryCollection()
    const { data: continuityData, refetch: refetchContinuity } =
        useGetContinuityWatchHistoryItem(Number(seriesId))
    const ts = useThemeSettings()

    const { data: lore } = useServerQuery<DragonBallLoreData>({
        endpoint: EXTRA_ENDPOINTS.DRAGONBALL.Lore.endpoint,
        method: "GET",
        queryKey: [EXTRA_ENDPOINTS.DRAGONBALL.Lore.key],
        staleTime: 300000,
        enabled: isDragonBallTmdbId(entry?.media?.tmdbId),
        muteError: true,
    })

    const [selectedCharacterName, setSelectedCharacterName] = useState<string | null>(null)
    const [mobileSagasOpen, setMobileSagasOpen] = useState(false)

    const setActiveSeriesContext = useUIStore(s => s.setActiveSeriesContext)
    // Owner-guard: guardamos el valor que este mount escribió para no limpiar
    // el contexto si la ruta siguiente ya lo sobreescribió (race en navegación rápida).
    const contextWrittenRef = useRef<string | null>(null)
    useEffect(() => {
        const key = String(entry?.media?.tmdbId || seriesId)
        contextWrittenRef.current = key
        setActiveSeriesContext(key)
        return () => {
            if (useUIStore.getState().activeSeriesContext === contextWrittenRef.current) {
                setActiveSeriesContext(null)
            }
        }
    }, [seriesId, entry?.media?.tmdbId, setActiveSeriesContext])

    const [isSagasSidebarCollapsed, setIsSagasSidebarCollapsed] = useState(false)

    const setSearchParams = useCallback(
        (updates: Partial<SagaDetailSearchParams>) => {
            navigate({
                to: "/series/$seriesId",
                params: { seriesId },
                search: (prev: Record<string, unknown>) => {
                    const next = { ...prev }
                    for (const [key, value] of Object.entries(updates)) {
                        if (key === "tab") continue
                        if (value) {
                            next[key] = value
                        } else {
                            delete next[key]
                        }
                    }
                    return next
                },
                resetScroll: false,
            })
        },
        [navigate, seriesId]
    )

    useEffect(() => {
        if (entry?.media?.id) {
            playSound("detail", 0.4)
        }
    }, [entry?.media?.id, playSound])

    const { data: sagas } = useServerQuery<SagaDTO[]>({
        endpoint: `/api/v1/library/anime-entry/${seriesId}/sagas`,
        method: "GET",
        queryKey: queryKeys.series.sagas(seriesId),
        staleTime: 600000,
    })

    useEffect(() => {
        if (sagas && sagas.length > 0 && !activeSagaId) {
            setSearchParams({ saga: sagas[0].id })
        }
    }, [sagas, activeSagaId, setSearchParams])

    const localSagas = useMemo(() => {
        return entry?.media ? resolveSeriesSagas(entry.media) : []
    }, [entry])

    // ── Data derivation ───────────────────────────────────────────────────────
    const {
        computedEpisodes,
        activeSubSaga,
        nextSeriesTarget,
        heroArt,
        heroBackdrop,
        continueWatching,
        sagaProgress,
        sagasProgressMap,
        fillerStats,
        episodeViewModels,
    } = useSeriesData({
        entry,
        sagas,
        activeSagaId,
        activeSubSagaId,
        continuityData,
        libraryCollection,
    })

    const seriesTitle =
        entry?.media?.titleSpanish ||
        entry?.media?.titleRomaji ||
        entry?.media?.titleEnglish ||
        ""
    const detailSeriesId = getSeriesIdFromMedia(entry?.media, seriesTitle)
    const CHRONOLOGY_SERIES_MAP: Record<string, string> = {
        dragon_ball: "classic",
        dragon_ball_z: "z",
        dragon_ball_gt: "gt",
        dragon_ball_kai: "kai",
        dragon_ball_super: "super",
        dragon_ball_daima: "daima",
    }
    const chronologySeriesId = CHRONOLOGY_SERIES_MAP[detailSeriesId] || detailSeriesId

    // ── Playback logic ────────────────────────────────────────────────────────
    const {
        playTarget,
        preloadPath,
        defaultTargetPath,
        nextEp,
        nextLocalFile,
        hasNextEpisode,
        handlePlayDefault,
        handlePlayByNumber,
        handleNextEpisode,
        handlePlayerClose,
    } = useSeriesPlayback({
        entry,
        computedEpisodes,
        seriesId,
        navigate,
        nextSeriesTarget,
        continuityData,
        refetchContinuity,
        autoplayEp,
        setSearchParams,
    })

    const activeSaga = useMemo(() => {
        return sagas?.find(s => s.id === activeSagaId)
    }, [sagas, activeSagaId])

    const handlePlayHover = useCallback(() => {
        preloadPath(defaultTargetPath)
    }, [preloadPath, defaultTargetPath])

    const playerEpisodes = useMemo(() => {
        return computedEpisodes.map(ep => ({
            title: resolveEpisodeTitle(ep, entry?.media?.tmdbId),
            episodeNumber: ep.episodeNumber,
            absoluteEpisodeNumber: ep.absoluteEpisodeNumber,
            thumbnail: ep.episodeMetadata?.image || entry?.media?.bannerImage || entry?.media?.posterImage,
            watched: ep.watched,
        }))
    }, [computedEpisodes, entry])

    // ── Backdrop sync deshabilitado en detalle de serie ───────────────────────
    // El fondo queda limpio (solo orbes/scrims del DynamicBackdrop global).
    // El sync vive en MediaHero con opt-out (syncBackdrop={false} en SeriesHero).

    // ── Ir al episodio desde "Continuar viendo" ──────────────────────────────
    const handleGoToEpisode = useCallback(() => {
        if (!continueWatching) return
        if (continueWatching.sagaId && continueWatching.sagaId !== activeSagaId) {
            setSearchParams({
                saga: continueWatching.sagaId,
                subSaga: "",
            })
        }
        setTimeout(() => {
            const el = document.getElementById(`episode-${continueWatching.episodeNumber}`)
            if (el) {
                el.scrollIntoView({ behavior: "smooth", block: "center" })
            }
        }, 120)
    }, [continueWatching, activeSagaId, setSearchParams])

    // ── DOM refs & scroll ─────────────────────────────────────────────────────
    const pageRef = useRef<HTMLDivElement>(null)
    const mainScrollRef = useRef<HTMLElement | null>(null)
    const [scrollElement, setScrollElement] = useState<HTMLElement | null>(null)

    // Scroll inicial controlado al top del contenedor en lugar de salto brusco
    useEffect(() => {
        if (mainScrollRef.current) {
            mainScrollRef.current.scrollTop = 0
        }
    }, [seriesId])

    // ── Early returns ─────────────────────────────────────────────────────────
    if (isLoading && !entry) {
        return (
            <div className="h-full w-full text-on-surface pb-16 overflow-y-auto">
                <BentoDetailsSkeleton />
            </div>
        )
    }

    if (!entry || !entry.media) {
        return (
            <div className="h-full w-full text-on-surface flex items-center justify-center px-6">
                <EmptyState
                    title="Contenido no encontrado"
                    message="No pudimos cargar este contenido. Vuelve al inicio o intenta con otro."
                />
            </div>
        )
    }

    const title = seriesTitle || "Título Desconocido"
    const eraTheme = getSeriesEraTheme(entry.media?.tmdbId)
    const isAdaptiveEra = ts.effectiveMode === "era" && (!ts.themeEra || ts.themeEra === "era-universe")
    const localTheme = isAdaptiveEra && eraTheme ? eraTheme : undefined

    return (
        <div
            ref={pageRef}
            data-theme={localTheme || undefined}
            className="flex flex-col h-full w-full pt-16 md:pt-0 text-on-surface-variant selection:bg-brand-accent/30 overflow-hidden relative bg-transparent"
        >
            {/* Back en el hero (volver a Series) */}
            <button
                type="button"
                onClick={() => navigate({ to: "/series" })}
                aria-label="Volver a series"
                className="absolute top-4 left-4 sm:left-6 md:left-8 lg:left-10 z-30 w-9 h-9 rounded-full bg-surface-container-lowest/60 border border-white/20 backdrop-blur-overlay-2xl text-white/90 hover:text-white flex items-center justify-center transition-all hover:scale-105 active:scale-95 cursor-pointer"
            >
                <IconNavigationChevronLeft className="w-4 h-4" />
            </button>

            {/* ── Main Scrollable Content Area ─────────────────────────────────── */}
            <main
                ref={(node) => {
                    mainScrollRef.current = node
                    setScrollElement(node)
                }}
                className="flex-1 overflow-y-auto no-scrollbar bg-transparent"
            >
                <div className="flex-shrink-0 relative">
                    <SeriesHero
                        entry={entry}
                        backdropUrl={heroBackdrop || null}
                        backdropArt={heroArt}
                        scrollContainerRef={mainScrollRef}
                        sagaCount={sagas?.length ?? 0}
                        onPlay={handlePlayDefault}
                        onPlayHover={handlePlayHover}
                        footerText={sagaProgress.percent > 0 && sagaProgress.percent < 100 && activeSaga
                            ? `Vas en: ${activeSaga.name} · ${Math.round(sagaProgress.percent)}%`
                            : null}
                        hasProgress={!!continueWatching}
                        resumeEpisodeNumber={continueWatching?.episodeNumber}
                        resumeEpisodeTitle={continueWatching?.title}
                    />
                </div>

                <div className="w-full page-container py-7 lg:py-6 pb-32 space-y-8 lg:space-y-7 min-h-full bg-transparent relative z-10">
                    {/* Continuar viendo — integrado en el flujo de contenido sin superposición */}
                    {continueWatching && (
                        <SeriesContinueWatching
                            continueWatching={continueWatching}
                            onResume={() => handlePlayByNumber(continueWatching.episodeNumber)}
                            onGoToEpisode={handleGoToEpisode}
                        />
                    )}

                    <SeriesEpisodesTab
                        sagas={sagas}
                        localSagas={localSagas}
                        chronologySeriesId={chronologySeriesId}
                        sagasProgressMap={sagasProgressMap}
                        activeSagaId={activeSagaId}
                        activeSubSagaId={activeSubSagaId}
                        activeSaga={activeSaga}
                        activeSubSaga={activeSubSaga}
                        episodeViewModels={episodeViewModels}
                        sagaProgress={sagaProgress}
                        fillerStats={fillerStats}
                        isSagasSidebarCollapsed={isSagasSidebarCollapsed}
                        scrollElement={scrollElement}
                        onSelectCharacter={setSelectedCharacterName}
                        onOpenMobileSagas={() => setMobileSagasOpen(true)}
                        onSelectSaga={(sagaId) => {
                            setSearchParams({
                                saga: sagaId,
                                subSaga: "",
                            })
                        }}
                        onSelectSubSaga={(subSagaId) => {
                            setSearchParams({
                                subSaga: subSagaId,
                            })
                        }}
                        onToggleCollapseSidebar={() => setIsSagasSidebarCollapsed(!isSagasSidebarCollapsed)}
                        onPlayByNumber={handlePlayByNumber}
                        onEpisodePreload={preloadPath}
                        computedEpisodes={computedEpisodes}
                        heroBackdrop={heroBackdrop}
                        seriesMediaId={entry.mediaId ?? Number(seriesId) ?? undefined}
                    />
                </div>
            </main>

            {/* Mobile Vaul Drawer for Sagas */}
            <Vaul open={mobileSagasOpen} onOpenChange={setMobileSagasOpen}>
                {mobileSagasOpen && (
                    <VaulContent className="bg-surface-container-high/95 backdrop-blur-overlay-xl border-t border-white/[0.1] p-5 pb-8 flex flex-col focus:outline-none max-h-[85vh]">
                        <div className="flex justify-between items-center mb-4 px-1">
                            <h3 className="font-display text-2xl tracking-display text-on-surface uppercase flex items-center gap-2">
                                <IconNavigationLayers className="w-5 h-5 text-brand-accent" />
                                <span>Sagas y Arcos</span>
                            </h3>
                            <button
                                onClick={() => setMobileSagasOpen(false)}
                                className="p-1.5 rounded-full text-on-surface-variant hover:text-on-surface active:scale-95 cursor-pointer"
                            >
                                <IconUiClose className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="overflow-y-auto flex-grow min-h-0 pb-4">
                            <SagaSelector
                                sagas={sagas || []}
                                localSagas={localSagas}
                                chronologySeriesId={chronologySeriesId}
                                sagasProgressMap={sagasProgressMap}
                                activeSagaId={activeSagaId}
                                onSelectSaga={sagaId => {
                                    setSearchParams({
                                        tab: "episodes",
                                        saga: sagaId,
                                        subSaga: "",
                                    })
                                    const saga = sagas?.find(s => s.id === sagaId)
                                    if (!saga?.subSagas?.length) {
                                        setMobileSagasOpen(false)
                                    }
                                }}
                                activeSubSagaId={activeSubSagaId}
                                onSelectSubSaga={subSagaId => {
                                    setSearchParams({
                                        tab: "episodes",
                                        subSaga: subSagaId,
                                    })
                                    setMobileSagasOpen(false)
                                }}
                                episodes={computedEpisodes}
                                heroBackdrop={heroBackdrop}
                            />
                        </div>
                    </VaulContent>
                )}
            </Vaul>

            {/* Video Player Modal */}
            {playTarget && (() => {
                const nextTitle = nextEp
                    ? resolveEpisodeTitle(nextEp, entry?.media?.tmdbId)
                    : nextSeriesTarget
                      ? `Continuar con ${nextSeriesTarget.label}`
                      : undefined
                return (
                    <React.Suspense fallback={<PlayerFallback />}>
                        <VideoPlayer
                            streamUrl={playTarget.path}
                            streamType={playTarget.streamType as "local" | "online" | "direct"}
                            title={title}
                            episodeLabel={playTarget.episodeLabel}
                            episodeNumber={playTarget.episodeNumber}
                            initialProgressSeconds={playTarget.startTime}
                            mediaId={Number(seriesId)}
                            malId={playTarget.malId}
                            isFillerEpisode={playTarget.isFiller ?? false}
                            mediaFormat={entry.media?.format ?? null}
                            nextStreamUrl={nextLocalFile?.path}
                            nextStreamType={playTarget.streamType}
                            nextEpisodeTitle={nextTitle}
                            nextEpisodeNumber={
                                nextEp
                                    ? nextEp.absoluteEpisodeNumber || nextEp.episodeNumber
                                    : undefined
                            }
                            nextEpisodeImage={
                                nextEp?.episodeMetadata?.image ||
                                entry.media?.bannerImage ||
                                entry.media?.posterImage
                            }
                            onNextEpisode={handleNextEpisode}
                            hasNextEpisode={hasNextEpisode}
                            episodes={playerEpisodes}
                            onSelectEpisode={handlePlayByNumber}
                            onClose={handlePlayerClose}
                        />
                    </React.Suspense>
                )
            })()}

            {/* Character Detail Modal */}
            {selectedCharacterName && (
                <CharacterDetailModal
                    characterName={selectedCharacterName}
                    entry={entry}
                    loreData={lore}
                    onClose={() => setSelectedCharacterName(null)}
                />
            )}
        </div>
    )
}
