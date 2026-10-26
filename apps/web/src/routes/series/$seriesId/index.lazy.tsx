import { createLazyFileRoute, useNavigate } from "@tanstack/react-router"
import { HydrationBoundary } from "@tanstack/react-query"
import React, { useState, useCallback, useMemo, useRef, useEffect } from "react"
import { useSound } from "@/hooks/use-sound"

import { useGetAnimeEntry } from "@/api/hooks/anime_entries.hooks"
import { useGetContinuityWatchHistoryItem } from "@/api/hooks/continuity.hooks"
import { useServerQuery } from "@/api/client/requests"
import { API_ENDPOINTS } from "@/api/generated/endpoints"
import { EmptyState } from "@/components/shared/empty-state"
import { DeferredMount } from "@/components/shared/deferred-mount"
import { useUIStore } from "@/lib/store"

const VideoPlayer = React.lazy(() =>
    import("@/components/video/player").then(m => ({ default: m.VideoPlayer }))
)
import { isDragonBallTmdbId, getSeriesEraTheme, resolveSeriesSagas, DRAGON_BALL_SERIES, DRAGON_BALL_SAGAS, type SagaDefinition } from "@/lib/config/dragonball.config"
import { getSeriesIdFromMedia } from "@/lib/helpers/series"
import { useGetLibraryCollection } from "@/api/hooks/anime_collection.hooks"
import { getSafeCollectionEntries } from "@/lib/helpers/collection"
import { useThemeSettings } from "@/lib/theme/theme-hooks"

import { SeriesHero } from "./-components/series-hero"
import { SagaSelector } from "./-components/saga-selector"
import { SeriesEpisodesTab } from "./-components/series-episodes-tab"
import { SeriesAudioProfilePicker } from "./-components/series-audio-profile-picker"
import { BentoDetailsSkeleton } from "@/components/ui/shimmer-skeleton"
import type { SagaDTO, SagaDetailSearchParams } from "@/api/types/series.types"
import type { DragonBallLoreData } from "@/components/shared/character-detail-modal"
const CharacterDetailModal = React.lazy(() =>
    import("@/components/shared/character-detail-modal").then(m => ({ default: m.CharacterDetailModal }))
)
import { Vaul, VaulContent } from "@/components/vaul"
import { IconNavigationChevronLeft, IconNavigationLayers, IconUiClose } from "@/components/ui/icons"
import { PlayerFallback } from "@/components/video/player-fallback"
import { SeriesContinueWatching } from "./-components/series-continue-watching"

// ── Custom hooks ──────────────────────────────────────────────────────────────
import { useSeriesData } from "./-hooks/use-series-data"
import { useSeriesPlayback } from "./-hooks/use-series-playback"
import { resolveEpisodeTitle } from "./-hooks/series-playback.helpers"
import { queryKeys } from "@/lib/query-keys"
import { useFocusTrap } from "@/hooks/use-focus-trap"

function mapSagaDefToDTO(sd: SagaDefinition): SagaDTO {
    return {
        id: sd.id,
        name: sd.title,
        episodeRange: `${sd.startEp}-${sd.endEp}`,
        startEp: sd.startEp,
        endEp: sd.endEp,
        description: sd.description,
        isFiller: sd.title.toLowerCase().includes("relleno"),
        canonStatus: sd.title.toLowerCase().includes("relleno") ? "Filler" : "Canon",
        antagonists: [],
        keyEvents: [],
        newCharacters: [],
        keyCharacters: [],
        subSagas: sd.subSagas?.map(ss => ({
            id: ss.id,
            name: ss.title,
            episodeRange: `${ss.startEp}-${ss.endEp}`,
            startEp: ss.startEp,
            endEp: ss.endEp,
            description: ss.description,
            image: ss.image,
        })),
    }
}

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
        t: initialTime,
        moment: momentKey,
        momentTitle,
        chrono: chronoReturnId,
    } = Route.useSearch()
    const { data: entry, isLoading } = useGetAnimeEntry(seriesId)
    const { data: libraryCollection } = useGetLibraryCollection()
    const { data: continuityData, refetch: refetchContinuity } =
        useGetContinuityWatchHistoryItem(Number(seriesId))
    const ts = useThemeSettings()

    const { data: lore } = useServerQuery<DragonBallLoreData>({
        endpoint: API_ENDPOINTS.LORE.GetDragonballLore.endpoint,
        method: API_ENDPOINTS.LORE.GetDragonballLore.methods[0],
        queryKey: [API_ENDPOINTS.LORE.GetDragonballLore.key],
        staleTime: 300000,
        enabled: isDragonBallTmdbId(entry?.media?.tmdbId),
        muteError: true,
    })

    const [selectedCharacterName, setSelectedCharacterName] = useState<string | null>(null)
    const [mobileSagasOpen, setMobileSagasOpen] = useState(false)
    // Hoja de sagas (móvil): el foco entra en ella al abrir, Tab cicla dentro y vuelve al disparador al cerrar.
    const sagasSheetRef = useRef<HTMLDivElement>(null)
    useFocusTrap(sagasSheetRef, mobileSagasOpen)

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
        // replace: para los ajustes automáticos de la URL (saga por defecto, limpiar
        // ?autoplay); con push, Atrás volvería a la misma ficha y rebotaría.
        (updates: Partial<SagaDetailSearchParams>, options?: { replace?: boolean }) => {
            navigate({
                replace: options?.replace,
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

    const { data: serverSagas } = useServerQuery<SagaDTO[]>({
        endpoint: API_ENDPOINTS.SERIES_DETAILS.GetSeriesSagas.endpoint.replace("{id}", seriesId),
        method: API_ENDPOINTS.SERIES_DETAILS.GetSeriesSagas.methods[0],
        queryKey: queryKeys.series.sagas(seriesId),
        staleTime: 600000,
    })

    const seriesTitle =
        entry?.media?.titleSpanish ||
        entry?.media?.titleRomaji ||
        entry?.media?.titleEnglish ||
        ""
    const detailSeriesId = getSeriesIdFromMedia(entry?.media, seriesTitle)
    const tmdbId = entry?.media?.tmdbId

    const isZSeries = useMemo(() => {
        return (
            tmdbId === 12971 ||
            tmdbId === 61709 ||
            tmdbId === 42705 ||
            detailSeriesId === "dragon_ball_z" ||
            detailSeriesId === "dragon_ball_kai"
        )
    }, [tmdbId, detailSeriesId])

    const isNativeKai = useMemo(() => {
        return tmdbId === 61709 || tmdbId === 42705 || detailSeriesId === "dragon_ball_kai"
    }, [tmdbId, detailSeriesId])

    const [zVariant, setZVariant] = useState<'z' | 'kai'>(() => {
        if (isNativeKai) return 'kai'
        try {
            const stored = localStorage.getItem('kamehouse:timeline:z-variant')
            if (stored === 'kai' || stored === 'z') return stored
        } catch {}
        return 'z'
    })

    const effectiveZVariant: 'z' | 'kai' = isNativeKai ? 'kai' : zVariant

    const localSagas = useMemo(() => {
        return entry?.media ? resolveSeriesSagas(entry.media) : []
    }, [entry])

    const effectiveLocalSagas = useMemo<SagaDefinition[]>(() => {
        if (!isZSeries) return localSagas
        return effectiveZVariant === 'kai'
            ? DRAGON_BALL_SAGAS[DRAGON_BALL_SERIES.KAI]
            : DRAGON_BALL_SAGAS[DRAGON_BALL_SERIES.Z]
    }, [isZSeries, effectiveZVariant, localSagas])

    const effectiveSagas = useMemo<SagaDTO[]>(() => {
        if (!isZSeries) return serverSagas || []
        if (!isNativeKai && effectiveZVariant === 'z' && serverSagas && serverSagas.length > 0) {
            return serverSagas
        }
        if (isNativeKai && effectiveZVariant === 'kai' && serverSagas && serverSagas.length > 0) {
            return serverSagas
        }
        return effectiveLocalSagas.map(mapSagaDefToDTO)
    }, [isZSeries, isNativeKai, effectiveZVariant, serverSagas, effectiveLocalSagas])

    useEffect(() => {
        if (effectiveSagas && effectiveSagas.length > 0) {
            const hasMatch = effectiveSagas.some(s => s.id === activeSagaId)
            if (!hasMatch) {
                setSearchParams({ saga: effectiveSagas[0].id, subSaga: "" }, { replace: true })
            }
        }
    }, [effectiveSagas, activeSagaId, setSearchParams])

    const handleZVariantChange = useCallback((variant: 'z' | 'kai') => {
        setZVariant(variant)
        try {
            localStorage.setItem('kamehouse:timeline:z-variant', variant)
        } catch {}

        const targetTmdbIds = variant === 'kai' ? [61709, 42705] : [12971]
        const entries = getSafeCollectionEntries(libraryCollection)
        const target = entries.find(e => e?.media?.tmdbId && targetTmdbIds.includes(e.media.tmdbId) && e.mediaId != null)

        if (target && target.mediaId && String(target.mediaId) !== seriesId) {
            navigate({
                to: "/series/$seriesId",
                params: { seriesId: String(target.mediaId) },
            })
            return
        }

        const nextSagas = variant === 'kai'
            ? DRAGON_BALL_SAGAS[DRAGON_BALL_SERIES.KAI]
            : DRAGON_BALL_SAGAS[DRAGON_BALL_SERIES.Z]
        if (nextSagas && nextSagas.length > 0) {
            setSearchParams({ saga: nextSagas[0].id, subSaga: "" }, { replace: true })
        }
    }, [libraryCollection, seriesId, navigate, setSearchParams])

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
        sagas: effectiveSagas,
        localSagas: effectiveLocalSagas,
        activeSagaId,
        activeSubSagaId,
        continuityData,
        libraryCollection,
    })

    const CHRONOLOGY_SERIES_MAP: Record<string, string> = {
        dragon_ball: "classic",
        dragon_ball_z: "z",
        dragon_ball_gt: "gt",
        dragon_ball_kai: "kai",
        dragon_ball_super: "super",
        dragon_ball_daima: "daima",
    }
    const chronologySeriesId = isZSeries
        ? (effectiveZVariant === "kai" ? "kai" : "z")
        : (CHRONOLOGY_SERIES_MAP[detailSeriesId] || detailSeriesId)

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
        initialTime,
        momentKey,
        momentTitle,
        setSearchParams,
    })

    const activeSaga = useMemo(() => {
        return effectiveSagas?.find(s => s.id === activeSagaId)
    }, [effectiveSagas, activeSagaId])

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

    // Llegando con ?autoplay (cronología o continuación entre series) no se muestra la ficha:
    // la pantalla de carga cubre todo hasta que el reproductor se monta. El parámetro se limpia
    // antes de que el reproductor aparezca (se abre dentro de una view transition), por eso el
    // estado vive aparte y no depende de la URL.
    const [launch, setLaunch] = useState<{ label: string; sublabel?: string } | null>(() =>
        autoplayEp ? { label: `Preparando Cap. ${autoplayEp}`, sublabel: momentTitle } : null
    )
    const playerShownRef = useRef(false)
    useEffect(() => {
        if (!launch) return
        if (playTarget) {
            playerShownRef.current = true
            return
        }
        // Se cerró el reproductor que abrió el autoplay: la ficha vuelve a verse.
        if (playerShownRef.current) {
            playerShownRef.current = false
            setLaunch(null)
            return
        }
        // El autoplay terminó sin abrir nada (episodio faltante): no dejar la pantalla colgada.
        if (!autoplayEp) {
            const timer = setTimeout(() => setLaunch(null), 1200)
            return () => clearTimeout(timer)
        }
    }, [launch, playTarget, autoplayEp])

    // Scroll inicial controlado al top del contenedor en lugar de salto brusco
    useEffect(() => {
        if (mainScrollRef.current) {
            mainScrollRef.current.scrollTop = 0
        }
    }, [seriesId])

    // ── Early returns ─────────────────────────────────────────────────────────
    if (isLoading && !entry) {
        if (launch) return <PlayerFallback label={launch.label} sublabel={launch.sublabel} />
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
                    message="No pudimos cargar este contenido. Vuelve a Series o intenta con otro."
                    action={
                        <button
                            type="button"
                            onClick={() => navigate({ to: "/series" })}
                            className="min-h-11 px-5 rounded-full bg-white/10 [@media(hover:hover)_and_(pointer:fine)]:hover:bg-white/15 border border-white/20 text-xs font-semibold text-white transition-[background-color,border-color,transform] duration-fast ease-smooth-out active:scale-95 cursor-pointer"
                        >
                            Volver a Series
                        </button>
                    }
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
            className="neutro-sentence flex flex-col h-full w-full pt-16 md:pt-0 text-on-surface-variant selection:bg-brand-accent/30 overflow-clip relative bg-transparent"
        >
            {/* Back en el hero (volver a Series) */}
            <button
                type="button"
                onClick={() => navigate({ to: "/series" })}
                aria-label="Volver a series"
                className="glass-frosted-pill absolute top-4 left-4 sm:left-6 md:left-8 lg:left-10 z-30 w-11 h-11 text-white/90 [@media(hover:hover)_and_(pointer:fine)]:hover:text-white flex items-center justify-center transition-[transform,color,background-color] duration-fast ease-out-strong [@media(hover:hover)_and_(pointer:fine)]:hover:scale-105 active:scale-95 cursor-pointer"
            >
                <IconNavigationChevronLeft className="w-4 h-4" />
            </button>

            {/* El scroll es del shell ([data-scroll-container], __root). Un scroller propio
                acá nunca queda acotado: crece con el contenido, el virtualizador renderiza
                todo y min-h-full sumaba el alto del hero como pantalla negra al final. */}
            <div
                ref={(node) => {
                    const scroller = node?.closest<HTMLElement>("[data-scroll-container]") ?? node
                    mainScrollRef.current = scroller
                    setScrollElement(scroller)
                }}
                className="flex-1 bg-transparent"
            >
                {/* Sin wrapper: la tarjeta sticky de SeriesHero tiene que quedar fija sobre todo el cuerpo. */}
                <SeriesHero
                    entry={entry}
                    backdropUrl={heroBackdrop || null}
                    backdropArt={heroArt}
                    scrollContainerRef={mainScrollRef}
                    sagaCount={effectiveSagas?.length ?? 0}
                    onPlay={handlePlayDefault}
                    onPlayHover={handlePlayHover}
                    footerText={sagaProgress.percent > 0 && sagaProgress.percent < 100 && activeSaga
                        ? `Vas en: ${activeSaga.name} · ${Math.round(sagaProgress.percent)}%`
                        : null}
                    hasProgress={!!continueWatching}
                    resumeEpisodeNumber={continueWatching?.episodeNumber}
                    resumeEpisodeTitle={continueWatching?.title}
                    resumePercent={continueWatching?.percent}
                    resumeTimeLeftLabel={continueWatching?.timeLeftLabel}
                    isZSeries={isZSeries}
                    zVariant={effectiveZVariant}
                    onZVariantChange={handleZVariantChange}
                />

                <div className="w-full page-container py-7 lg:py-6 pb-[calc(8rem+env(safe-area-inset-bottom,0px))] space-y-8 lg:space-y-7 bg-transparent relative z-10">
                    {/* Todo el cuerpo queda bajo el hero: se monta tras el primer pintado (DeferredMount). */}
                    <DeferredMount heightKey={`series-body-${seriesId}`} className="space-y-8 lg:space-y-7">
                    {/* Continuar viendo — integrado en el flujo de contenido sin superposición */}
                    {continueWatching && (
                        <SeriesContinueWatching
                            continueWatching={continueWatching}
                            onResume={() => handlePlayByNumber(continueWatching.episodeNumber)}
                            onGoToEpisode={handleGoToEpisode}
                        />
                    )}

                    <SeriesAudioProfilePicker mediaId={entry.mediaId ?? Number(seriesId)} />

                    <SeriesEpisodesTab
                        sagas={effectiveSagas}
                        localSagas={effectiveLocalSagas}
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
                    </DeferredMount>
                </div>
            </div>

            {/* Mobile Vaul Drawer for Sagas */}
            <Vaul open={mobileSagasOpen} onOpenChange={setMobileSagasOpen}>
                <VaulContent ref={sagasSheetRef} className="p-5 flex flex-col focus:outline-none max-h-[85vh]">
                    <div className="flex justify-between items-center mb-4 px-1">
                        <h3 className="font-display text-2xl tracking-display text-on-surface uppercase flex items-center gap-2">
                            <IconNavigationLayers className="w-5 h-5 text-brand-accent" />
                            <span>Sagas y Arcos</span>
                        </h3>
                        <button
                            onClick={() => setMobileSagasOpen(false)}
                            aria-label="Cerrar panel de sagas"
                            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full text-on-surface-variant [@media(hover:hover)_and_(pointer:fine)]:hover:text-on-surface transition-[color,transform] duration-fast ease-out-strong active:scale-95 cursor-pointer"
                        >
                            <IconUiClose className="w-5 h-5" />
                        </button>
                    </div>
                    <div className="overflow-y-auto flex-grow min-h-0 pb-4">
                        <SagaSelector
                            sagas={effectiveSagas || []}
                            localSagas={effectiveLocalSagas}
                            chronologySeriesId={chronologySeriesId}
                            sagasProgressMap={sagasProgressMap}
                            activeSagaId={activeSagaId}
                            onSelectSaga={sagaId => {
                                setSearchParams({
                                    tab: "episodes",
                                    saga: sagaId,
                                    subSaga: "",
                                })
                                const saga = effectiveSagas?.find(s => s.id === sagaId)
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
            </Vaul>

            {/* Debajo del reproductor: tapa la ficha mientras el reproductor todavía no se montó */}
            {launch && <PlayerFallback label={launch.label} sublabel={launch.sublabel || seriesTitle} />}

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
                            momentKey={playTarget.momentKey}
                            momentTitle={playTarget.momentTitle}
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
                            onClose={
                                chronoReturnId
                                    ? () => {
                                          // Vino desde la cronología: se vuelve al lapso de origen.
                                          handlePlayerClose()
                                          navigate({ to: "/chronology", search: { highlight: chronoReturnId } })
                                      }
                                    : handlePlayerClose
                            }
                        />
                    </React.Suspense>
                )
            })()}

            {/* Character Detail Modal */}
            {/* Siempre montado: su AnimatePresence interno necesita seguir vivo para correr la salida. */}
            <React.Suspense fallback={null}>
                <CharacterDetailModal
                    characterName={selectedCharacterName}
                    entry={entry}
                    loreData={lore}
                    onClose={() => setSelectedCharacterName(null)}
                />
            </React.Suspense>
        </div>
    )
}
