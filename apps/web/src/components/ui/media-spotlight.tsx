"use client"

import * as React from "react"
import { m, useReducedMotion, type Variants } from "framer-motion"
import { useNavigate } from "@tanstack/react-router"
import { cn } from "@/components/ui/core/styling"
import { getLargeResImage, getMediumResImage, prewarmImages } from "@/lib/helpers/images"
import { useHeroBackdrop, useHeroParallax } from "@/hooks/use-hero"
import { HERO_PARALLAX_OVERSCAN } from "@/lib/config/hero-stage"
import { stripHtml } from "@/lib/helpers/sanitizer"
import { useSound } from "@/hooks/use-sound"
import { useThemeSettings } from "@/lib/theme/theme-hooks"
import { usePerformanceStore, selectIsHeavyEffectsAllowed } from "@/lib/hardware/performance-store"
import { heroItemVariants, useMotionTier } from "@/components/ui/kinetics"
import type { SwimlaneItem } from "./swimlane"

import { ERAS, ERA_COLOR_MAP, ERA_DEFAULTS, type EraId, getEraFromItem, isMovieItem } from "./media-spotlight-helpers"
import { DRAGON_BALL_SAGAS } from "@/lib/config/dragonball_sagas"
import { useGetAnimeEntry } from "@/api/hooks/anime_entries.hooks"
import { getServerBaseUrl } from "@/api/client/server-url"

import { SpotlightEraNav } from "./spotlight/spotlight-era-nav"
import { HERO_AURA_CLASS } from "@/lib/config/hero-stage"
import { SpotlightHero } from "./spotlight/spotlight-hero"
import { HERO_ROTATION_MS } from "./spotlight/hero-carousel-dots"
import { SpotlightLowerHub } from "./spotlight/spotlight-lower-hub"

interface MediaSpotlightProps {
    items: SwimlaneItem[]
    onNavigate: (item: SwimlaneItem) => void
    className?: string
}

/**
 * Entrada de página (solo tier full, solo al montar): nav de eras → hero → hub
 * suben en cascada de 60ms con el spring de entrada de heroItemVariants. El
 * contenedor no anima nada propio; solo orquesta.
 */
const spotlightEntranceVariants: Variants = {
    hidden: {},
    visible: { transition: { staggerChildren: 0.06 } },
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
    // Lazy init con la era correcta desde el primer paint: evita montar db.webp
    // para luego cambiar a la era real (doble descarga + flash de skeleton).
    const [activeEraId, setActiveEraId] = React.useState<EraId>(() => {
        const rawThemeEra = themeSettings.themeEra
        const mapped = rawThemeEra && ERAS.some(e => e.id === rawThemeEra.replace("era-", ""))
            ? (rawThemeEra.replace("era-", "") as EraId)
            : null
        if (mapped && items.some(item => getEraFromItem(item) === mapped)) return mapped
        for (const era of ERAS) {
            if (items.some(item => getEraFromItem(item) === era.id)) return era.id
        }
        return mapped ?? "db"
    })
    const [direction, setDirection] = React.useState(1)
    // El auto-rotate se pausa mientras el usuario interactúa (hover/focus):
    // rotar el hero completo bajo el cursor es la mayor fuente de jank
    // percibido y de clicks fallidos.
    const [isUserInteracting, setIsUserInteracting] = React.useState(false)
    const reduceMotion = useReducedMotion()
    const isHeavyAllowed = usePerformanceStore(selectIsHeavyEffectsAllowed)
    // Labels solo en full: en subtle/off el fundido de la ruta (home) basta.
    const isFullMotion = useMotionTier() === "full"
    const entranceBlock = isFullMotion ? heroItemVariants : undefined

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

    // Películas de la era activa (no dependen del 100% de la serie).
    const activeEraMovies = React.useMemo(() => {
        return categorizedData[activeEraId]?.movies ?? []
    }, [categorizedData, activeEraId])

    const serverBase = React.useMemo(() => getServerBaseUrl(), [])
    const targetSeriesMediaId = activeSeries?.mediaId || activeEraSeriesId
    const { data: activeAnimeEntry } = useGetAnimeEntry(
        isSeriesComplete ? targetSeriesMediaId : null
    )
    const initializedRef = React.useRef(false)
    const availableErasRef = React.useRef(availableEras)
    availableErasRef.current = availableEras
    const isUserInteractingRef = React.useRef(isUserInteracting)
    isUserInteractingRef.current = isUserInteracting

    // Update active items when switching eras (calcula dirección del slide)
    const handleEraSelect = React.useCallback((eraId: EraId) => {
        const order = ERAS.map(e => e.id)
        const delta = order.indexOf(eraId) - order.indexOf(activeEraId)
        if (eraId !== activeEraId) {
            setDirection(delta >= 0 ? 1 : -1)
        }
        setActiveEraId(eraId)
    }, [activeEraId])

    // Clic en la barra de eras: mismo sonido que dots y swipe del hero (que ya
    // lo reproducen ellos antes de llamar a handleEraSelect).
    const handleEraNavSelect = React.useCallback((eraId: EraId) => {
        if (eraId !== activeEraId) playSound("category", 0.05)
        handleEraSelect(eraId)
    }, [activeEraId, handleEraSelect, playSound])

    const advanceEra = React.useCallback(() => {
        setDirection(1)
        setActiveEraId(prevEraId => {
            const list = availableErasRef.current
            const currentIndex = list.findIndex(e => e.id === prevEraId)
            const nextIndex = (currentIndex + 1) % list.length
            return list[nextIndex].id
        })
    }, [])

    // Consolidated: Auto-rotate + Predictive prewarm + Init
    React.useEffect(() => {
        // 2. Predictive prewarm: siguiente era primero (rotación en 8s) + resto en el mismo idle
        if (availableEras.length > 1) {
            const curIdx = availableEras.findIndex(e => e.id === activeEraId)
            const ordered = availableEras.slice(curIdx + 1).concat(availableEras.slice(0, curIdx + 1))
            const urls: (string | null | undefined)[] = []
            for (const era of ordered) {
                const series = categorizedData[era.id]?.series
                urls.push(
                    getLargeResImage(series?.backdropUrl || ERA_DEFAULTS[era.id]?.backdropUrl),
                    getMediumResImage(series?.image || ERA_DEFAULTS[era.id]?.posterUrl),
                )
            }
            prewarmImages(urls)
        }

        // 3. Auto-rotate: con barra de progreso la dirige onCycleComplete de los
        //    dots; este intervalo solo cubre equipos sin heavy effects.
        let intervalId: ReturnType<typeof setInterval> | null = null
        if (availableEras.length > 1 && !reduceMotion && !isHeavyAllowed) {
            intervalId = setInterval(() => {
                if (document.visibilityState === "hidden") return
                if (isUserInteractingRef.current) return
                if (document.hasFocus && !document.hasFocus()) return
                advanceEra()
            }, HERO_ROTATION_MS)
        }

        // 4. Initialize era on first load
        if (!initializedRef.current && items.length > 0) {
            initializedRef.current = true
            setActiveEraId(initialEraId)
        }

        return () => {
            if (intervalId) clearInterval(intervalId)
        }
    }, [
        activeEraId,
        availableEras,
        availableEras.length,
        reduceMotion,
        isHeavyAllowed,
        advanceEra,
        categorizedData,
        items,
        initialEraId
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
    const heroBackdropRef = useHeroParallax(0.15, { disabled: !allowParallax, maxOffset: HERO_PARALLAX_OVERSCAN })

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
        <m.section
            aria-label="Contenido destacado"
            variants={isFullMotion ? spotlightEntranceVariants : undefined}
            initial={isFullMotion ? "hidden" : false}
            animate={isFullMotion ? "visible" : undefined}
            onMouseEnter={() => setIsUserInteracting(true)}
            onMouseLeave={() => setIsUserInteracting(false)}
            onFocus={() => setIsUserInteracting(true)}
            onBlur={() => setIsUserInteracting(false)}
            className={cn("relative pt-4 md:pt-20 pb-8 w-full max-w-content-desktop mx-auto select-none flex flex-col justify-start space-y-4 px-4 sm:px-6 md:px-8 lg:px-10", className)}
        >
            {/* Ambient Aura Background (mismo tamaño que Películas) */}
            <div className={HERO_AURA_CLASS}>
                {colors && (
                    <m.div
                        key={activeEraId + "_outer_aura"}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.5, ease: "easeOut" }}
                        className="absolute inset-0 pointer-events-none overflow-hidden transform-gpu will-change-[opacity]"
                        style={{
                            background: `radial-gradient(ellipse 80% 60% at 75% 30%, color-mix(in srgb, ${colors.accent} 18%, transparent) 0%, transparent 70%)`,
                        }}
                    />
                )}
                {/* Sin orbe que respira: el color de la era llega solo por el tinte de arriba. */}
            </div>

            {/* 1. Barra de Navegación Horizontal de Eras */}
            <m.div variants={entranceBlock} className="relative z-10 w-full">
                <SpotlightEraNav
                    activeEraId={activeEraId}
                    categorizedData={categorizedData}
                    onSelectEra={handleEraNavSelect}
                    onHoverSound={playHoverSound}
                />
            </m.div>

            {/* 2. Hero Cinematográfico (Serie Principal) */}
            <m.div variants={entranceBlock} className="relative z-10 w-full">
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
                    isPaused={isUserInteracting}
                    onCycleComplete={advanceEra}
                />
            </m.div>

            {/* 3. Lower Hub con switch Sagas / Películas (visible si hay contenido) */}
            {(activeEraSagas.length > 0 || activeEraMovies.length > 0) && (
            <m.div variants={entranceBlock} className="relative z-10 w-full pt-4 md:pt-6">
                <SpotlightLowerHub
                    activeEraId={activeEraId}
                    direction={direction}
                    colors={colors}
                    activeEraSagas={activeEraSagas}
                    activeEraMovies={activeEraMovies}
                    activeSeries={activeSeries}
                    activeEraSeriesId={activeEraSeriesId}
                    activeAnimeEntry={activeAnimeEntry}
                    serverBase={serverBase}
                    onNavigateSaga={handleSagaNavigate}
                    onNavigateMovie={onNavigate}
                    onHoverSound={playHoverSound}
                />
            </m.div>
            )}
        </m.section>
    )
})
