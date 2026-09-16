"use client"

import * as React from "react"
import { motion, useReducedMotion } from "framer-motion"
import { useNavigate } from "@tanstack/react-router"
import { cn } from "@/components/ui/core/styling"
import { getLargeResImage, getMediumResImage, getLowResImage, prewarmImages } from "@/lib/helpers/images"
import { useHeroBackdrop, useHeroParallax } from "@/hooks/use-hero"
import { stripHtml } from "@/lib/helpers/sanitizer"
import { useSound } from "@/hooks/use-sound"
import { useThemeSettings } from "@/lib/theme/theme-hooks"
import { usePerformanceStore, selectIsHeavyEffectsAllowed } from "@/lib/hardware/performance-store"
import type { SwimlaneItem } from "./swimlane"

import { ERAS, ERA_COLOR_MAP, ERA_DEFAULTS, type EraId, getEraFromItem, isMovieItem } from "./media-spotlight-helpers"
import { DRAGON_BALL_SAGAS } from "@/lib/config/dragonball_sagas"
import { useGetAnimeEntry } from "@/api/hooks/anime_entries.hooks"
import { getServerBaseUrl } from "@/api/client/server-url"

import { SpotlightEraNav } from "./spotlight/spotlight-era-nav"
import { SpotlightHero } from "./spotlight/spotlight-hero"
import { SpotlightLowerHub } from "./spotlight/spotlight-lower-hub"

interface MediaSpotlightProps {
    items: SwimlaneItem[]
    onNavigate: (item: SwimlaneItem) => void
    className?: string
}

const ERA_SERIES_ID_MAP: Record<EraId, number> = {
    db: 12609,
    dbz: 12971,
    dbgt: 12697,
    dbkai: 61709,
    dbs: 62715,
    dbdaima: 236994,
}

export const MediaSpotlight = React.memo(function MediaSpotlight({ items, onNavigate, className }: MediaSpotlightProps) {
    const navigate = useNavigate()
    const { playSound } = useSound()
    const themeSettings = useThemeSettings()
    const [activeEraId, setActiveEraId] = React.useState<EraId>("db")
    const [direction, setDirection] = React.useState(1)
    // El auto-rotate se pausa mientras el usuario interactúa (hover/focus):
    // rotar el hero completo bajo el cursor es la mayor fuente de jank
    // percibido y de clicks fallidos.
    const [isUserInteracting, setIsUserInteracting] = React.useState(false)
    const reduceMotion = useReducedMotion()
    const isHeavyAllowed = usePerformanceStore(selectIsHeavyEffectsAllowed)

    const colors = ERA_COLOR_MAP[activeEraId]
    const currentEraConfig = React.useMemo(() => ERAS.find(e => e.id === activeEraId), [activeEraId])

    const playHoverSound = React.useCallback(() => {
        playSound("hover")
    }, [playSound])

    // Classify all library items into eras
    const categorizedData = React.useMemo(() => {
        const result: Record<EraId, { series: SwimlaneItem | null; movies: SwimlaneItem[] }> = {
            db: { series: null, movies: [] },
            dbz: { series: null, movies: [] },
            dbgt: { series: null, movies: [] },
            dbkai: { series: null, movies: [] },
            dbs: { series: null, movies: [] },
            dbdaima: { series: null, movies: [] },
        }

        items.forEach(item => {
            const era = getEraFromItem(item)
            if (era && result[era]) {
                const titleLower = item.title.toLowerCase().trim()
                const isMovie = isMovieItem(item)
                
                // Check if title exactly matches canonical era series title
                const isCanonicalMainSeries = !isMovie && (
                    (era === "db" && (titleLower === "dragon ball" || titleLower === "dragon ball (original)")) ||
                    (era === "dbz" && (titleLower === "dragon ball z" || titleLower === "dragon ball z (tv)")) ||
                    (era === "dbgt" && (titleLower === "dragon ball gt")) ||
                    (era === "dbkai" && (titleLower.includes("kai") && !titleLower.includes("pelicula") && !titleLower.includes("movie"))) ||
                    (era === "dbs" && (titleLower === "dragon ball super")) ||
                    (era === "dbdaima" && (titleLower === "dragon ball daima"))
                )

                if (isCanonicalMainSeries) {
                    result[era].series = item
                } else if (isMovie) {
                    result[era].movies.push(item)
                } else if (!result[era].series && (item.badge === "TV" || item.badge === "ONA" || item.badge === "TV_SHORT")) {
                    result[era].series = item
                } else {
                    result[era].movies.push(item)
                }
            }
        })

        // Sort movies by release year ascending
        ERAS.forEach(era => {
            const data = result[era.id]
            if (data) {
                data.movies.sort((a, b) => (Number(a.year) || 0) - (Number(b.year) || 0))
            }
        })

        return result
    }, [items])

    const availableEras = React.useMemo(() => {
        return ERAS.filter(era => {
            const data = categorizedData[era.id]
            return data && (data.series !== null || data.movies.length > 0)
        })
    }, [categorizedData])

    const preferredEraId = React.useMemo<EraId | null>(() => {
        if (themeSettings.themeEra) {
            const mapped = themeSettings.themeEra.replace("era-", "") as EraId
            if (ERAS.some(e => e.id === mapped)) return mapped
        }
        return null
    }, [themeSettings.themeEra])

    const initialEraId = React.useMemo<EraId>(() => {
        if (preferredEraId && (categorizedData[preferredEraId]?.series || categorizedData[preferredEraId]?.movies.length > 0)) {
            return preferredEraId
        }
        const firstWithContent = ERAS.find(era => categorizedData[era.id]?.series || categorizedData[era.id]?.movies.length > 0)
        if (firstWithContent) return firstWithContent.id
        return preferredEraId || "db"
    }, [categorizedData, preferredEraId])

    const activeSeries = React.useMemo(() => {
        return categorizedData[activeEraId]?.series
    }, [categorizedData, activeEraId])

    // Sagas for the active era
    const activeEraSeriesId = ERA_SERIES_ID_MAP[activeEraId] || 12609
    const rawEraSagas = React.useMemo(() => {
        return DRAGON_BALL_SAGAS[activeEraSeriesId] || []
    }, [activeEraSeriesId])

    // Condición general: las sagas solo se muestran cuando la serie esté al 100% en la biblioteca
    const isSeriesComplete = Boolean(activeSeries?.isSeriesComplete)
    const activeEraSagas = React.useMemo(() => {
        if (!isSeriesComplete) return []
        return rawEraSagas
    }, [isSeriesComplete, rawEraSagas])

    const serverBase = React.useMemo(() => getServerBaseUrl(), [])
    const targetSeriesMediaId = activeSeries?.mediaId || activeEraSeriesId
    const { data: activeAnimeEntry } = useGetAnimeEntry(
        isSeriesComplete ? targetSeriesMediaId : null
    )
    // isTransitioning: flag de 600 ms que se activa en cada cambio de era.
    // Pausa las animaciones secundarias (orbe pulsante) mientras coinciden el crossfade del
    // DynamicBackdrop (~1000ms), la transición del hero (450ms) y el stagger del contenido.
    const [isTransitioning, setIsTransitioning] = React.useState(false)
    const transitionTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
    const initializedRef = React.useRef(false)
    const availableErasRef = React.useRef(availableEras)
    availableErasRef.current = availableEras
    const isUserInteractingRef = React.useRef(isUserInteracting)
    isUserInteractingRef.current = isUserInteracting

    const triggerTransition = React.useCallback(() => {
        setIsTransitioning(true)
        if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current)
        transitionTimerRef.current = setTimeout(() => {
            setIsTransitioning(false)
            transitionTimerRef.current = null
        }, 600)
    }, [])

    // Update active items when switching eras (calcula dirección del slide)
    const handleEraSelect = React.useCallback((eraId: EraId) => {
        const order = ERAS.map(e => e.id)
        const delta = order.indexOf(eraId) - order.indexOf(activeEraId)
        if (eraId !== activeEraId) {
            setDirection(delta >= 0 ? 1 : -1)
            triggerTransition()
        }
        setActiveEraId(eraId)
    }, [activeEraId, triggerTransition])

    // Consolidated: Cleanup + Auto-rotate + Predictive prewarm + Init
    React.useEffect(() => {
        // 1. Cleanup timer on unmount
        if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current)

        const AUTOROTATE_MS = 8000

        // 2. Predictive prewarm for next era
        if (availableEras.length > 1) {
            const curIdx = availableEras.findIndex(e => e.id === activeEraId)
            const nextIdx = (curIdx + 1) % availableEras.length
            const nextEra = availableEras[nextIdx]
            if (nextEra) {
                const nextSeries = categorizedData[nextEra.id]?.series
                const nextBackdrop = nextSeries?.backdropUrl || ERA_DEFAULTS[nextEra.id]?.backdropUrl
                const nextPoster = nextSeries?.image || ERA_DEFAULTS[nextEra.id]?.posterUrl
                prewarmImages([getLargeResImage(nextBackdrop), getMediumResImage(nextPoster)])
            }
        }

        // 3. Auto-rotate interval
        let intervalId: ReturnType<typeof setInterval> | null = null
        if (availableEras.length > 1 && !reduceMotion) {
            intervalId = setInterval(() => {
                if (document.visibilityState === "hidden") return
                if (isUserInteractingRef.current) return
                if (document.hasFocus && !document.hasFocus()) return
                setDirection(1)
                triggerTransition()
                setActiveEraId(prevEraId => {
                    const list = availableErasRef.current
                    const currentIndex = list.findIndex(e => e.id === prevEraId)
                    const nextIndex = (currentIndex + 1) % list.length
                    return list[nextIndex].id
                })
            }, AUTOROTATE_MS)
        }

        // 4. Initialize era on first load
        if (!initializedRef.current && items.length > 0) {
            initializedRef.current = true
            setActiveEraId(initialEraId)
        }

        return () => {
            if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current)
            if (intervalId) clearInterval(intervalId)
        }
    }, [
        activeEraId,
        availableEras,
        availableEras.length,
        reduceMotion,
        triggerTransition,
        categorizedData,
        items,
        initialEraId,
        prewarmImages
    ])

    const cleanDescription = React.useMemo(() => {
        return stripHtml(activeSeries?.description)
    }, [activeSeries])

    const displayTitle = React.useMemo(() => {
        return ERA_DEFAULTS[activeEraId]?.title || activeSeries?.title || currentEraConfig?.title || "Dragon Ball"
    }, [activeEraId, activeSeries, currentEraConfig])

    const displayDescription = React.useMemo(() => {
        const curatedEs = ERA_DEFAULTS[activeEraId]?.description
        if (curatedEs) return curatedEs
        return cleanDescription || ""
    }, [cleanDescription, activeEraId])

    const effectiveBackdropSrc = React.useMemo(() => {
        return ERA_DEFAULTS[activeEraId]?.backdropUrl || activeSeries?.backdropUrl || ""
    }, [activeSeries, activeEraId])

    // Parallax desactivado en eco/reduced-motion: el listener de scroll con
    // capture:true + el Ken Burns competían por el mismo layer del hero.
    const allowParallax = isHeavyAllowed && !reduceMotion
    const heroBackdropRef = useHeroParallax(0.15, { disabled: !allowParallax })

    // Backdrop global en w1280 (no original): el DynamicBackdrop lo muestra
    // con blur 36px + scale, así que el original 4K (~10MB) es puro desperdicio
    // de memoria/ancho de banda duplicando la imagen del hero.
    useHeroBackdrop(effectiveBackdropSrc)

    const handleHeroNavigate = React.useCallback(() => {
        if (activeSeries) {
            onNavigate(activeSeries)
        } else {
            const eraDef = ERA_DEFAULTS[activeEraId]
            const fallbackId = activeEraSeriesId
            onNavigate({
                id: `media-${fallbackId}`,
                mediaId: fallbackId,
                title: eraDef?.title || "Dragon Ball",
                image: eraDef?.posterUrl || "",
                aspect: "poster",
                onClick: () => {}
            })
        }
    }, [activeSeries, onNavigate, activeEraId, activeEraSeriesId])

    const handleSagaNavigate = React.useCallback((seriesId: number, sagaId: string) => {
        navigate({
            to: "/series/$seriesId",
            params: { seriesId: String(seriesId) },
            search: { saga: sagaId, tab: "episodes", subSaga: "" }
        })
    }, [navigate])

    return (
        <section
            onMouseEnter={() => setIsUserInteracting(true)}
            onMouseLeave={() => setIsUserInteracting(false)}
            onFocus={() => setIsUserInteracting(true)}
            onBlur={() => setIsUserInteracting(false)}
            className={cn("relative pt-4 md:pt-20 pb-8 w-full select-none flex flex-col justify-start space-y-4 px-4 sm:px-6 md:px-8 lg:px-10 max-w-content mx-auto", className)}
        >
            {/* Ambient Aura Background (idéntico al de Películas / movies-hero.tsx) */}
            <div className="absolute top-0 inset-x-0 h-[500px] sm:h-[560px] md:h-[640px] lg:h-[680px] pointer-events-none overflow-hidden z-0 transform-gpu">
                {effectiveBackdropSrc && (
                    <motion.div
                        key={activeEraId + "_outer_aura"}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.5, ease: "easeOut" }}
                        className="absolute inset-0 pointer-events-none overflow-hidden transform-gpu will-change-opacity"
                        style={
                            isHeavyAllowed
                                ? {
                                    // Tier HIGH (GPU dedicada): blur optimizado para el aura cinematográfica
                                    backgroundImage: `url(${getLowResImage(effectiveBackdropSrc)})`,
                                    backgroundSize: "cover",
                                    backgroundPosition: "center 20%",
                                    filter: "blur(48px) saturate(130%)",
                                    opacity: 0.28,
                                    maskImage: "radial-gradient(ellipse 90% 80% at 70% 40%, black 0%, transparent 75%)",
                                    WebkitMaskImage: "radial-gradient(ellipse 90% 80% at 70% 40%, black 0%, transparent 75%)",
                                }
                                : {
                                    // Tier BALANCED/ECO: gradiente de color puro — sin filter, sin layout, sin paint extra.
                                    background: colors
                                        ? `radial-gradient(ellipse 90% 80% at 70% 40%, color-mix(in srgb, ${colors.accent} 35%, transparent) 0%, transparent 75%)`
                                        : "none",
                                    opacity: 0.35,
                                }
                        }
                    />
                )}

                {isHeavyAllowed && colors && (
                    <motion.div
                        animate={isTransitioning ? { opacity: 0 } : {
                            opacity: [0.25, 0.38, 0.25],
                        }}
                        transition={isTransitioning
                            ? { duration: 0.2, ease: "easeOut" }
                            : { duration: 8, repeat: Infinity, ease: "easeInOut" }
                        }
                        className="absolute -top-[10%] -left-[5%] w-[50%] h-[70%] rounded-full pointer-events-none transition-colors duration-700 transform-gpu will-change-opacity"
                        style={{
                            background: `radial-gradient(ellipse, color-mix(in srgb, ${colors.accent} 50%, transparent) 0%, transparent 70%)`
                        }}
                    />
                )}
            </div>

            {/* 1. Barra de Navegación Horizontal de Eras */}
            <div className="relative z-10 w-full">
                <SpotlightEraNav
                    activeEraId={activeEraId}
                    categorizedData={categorizedData}
                    onSelectEra={handleEraSelect}
                    onHoverSound={playHoverSound}
                />
            </div>

            {/* 2. Hero Cinematográfico (Serie Principal) */}
            <div className="relative z-10 w-full">
                <SpotlightHero
                    activeEraId={activeEraId}
                    direction={direction}
                    displayTitle={displayTitle}
                    displayDescription={displayDescription}
                    effectiveBackdropSrc={effectiveBackdropSrc}
                    colors={colors}
                    currentEraConfig={currentEraConfig}
                    activeSeries={activeSeries}
                    isSeriesComplete={isSeriesComplete}
                    activeEraSagas={activeEraSagas}
                    activeEraSeriesId={activeEraSeriesId}
                    backdropRef={heroBackdropRef}
                    onNavigateHero={handleHeroNavigate}
                    onNavigateSaga={handleSagaNavigate}
                    availableEras={availableEras}
                    onSelectEra={handleEraSelect}
                />
            </div>

            {/* 3. Lower Hub (solo Sagas; oculto si la serie está incompleta) */}
            {activeEraSagas.length > 0 && (
            <div className="relative z-10 w-full pt-4 md:pt-6">
                <SpotlightLowerHub
                    activeEraId={activeEraId}
                    colors={colors}
                    activeEraSagas={activeEraSagas}
                    activeSeries={activeSeries}
                    activeEraSeriesId={activeEraSeriesId}
                    activeAnimeEntry={activeAnimeEntry}
                    serverBase={serverBase}
                    onNavigateSaga={handleSagaNavigate}
                    onHoverSound={playHoverSound}
                />
            </div>
            )}
        </section>
    )
})
