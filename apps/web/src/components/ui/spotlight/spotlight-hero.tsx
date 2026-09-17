import * as React from "react"
import { AnimatePresence, motion, useReducedMotion, type Variants } from "framer-motion"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { IconNavigationLayers, IconMediaPlay, IconUiInfo } from "@/components/ui/icons";
import { DeferredImage } from "@/components/shared/deferred-image"
import { MediaMetadataCapsule } from "@/components/ui/media-metadata-capsule"
import { EraOpeningPlayer } from "@/components/shared/era-opening-player"
import { getLargeResImage } from "@/lib/helpers/images"
import type { SwimlaneItem } from "@/components/ui/swimlane"
import type { SagaDefinition } from "@/lib/config/dragonball_sagas"
import type { ERAS, ERA_COLOR_MAP, EraId } from "@/lib/config/eras"
import { useSound } from "@/hooks/use-sound"
import { usePerformanceStore, selectIsHeavyEffectsAllowed } from "@/lib/hardware/performance-store"
import { RippleFeedback } from "@/components/ui/kinetics"

export type EraConfig = typeof ERAS[number]

const heroBackdropVariants: Variants = {
    initial: (direction: number = 1) => ({
        opacity: 0,
        x: direction >= 0 ? 24 : -24,
        scale: 1.02,
    }),
    animate: {
        opacity: 1,
        x: 0,
        scale: 1,
        transition: {
            duration: 0.45,
            ease: [0.22, 1, 0.36, 1]
        }
    },
    exit: (direction: number = 1) => ({
        opacity: 0,
        x: direction >= 0 ? -24 : 24,
        scale: 0.995,
        transition: {
            duration: 0.3,
            ease: [0.22, 1, 0.36, 1]
        }
    })
}

const heroContentContainerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            staggerChildren: 0.03,
            delayChildren: 0.02,
        }
    },
    exit: {
        opacity: 0,
        y: -6,
        transition: { duration: 0.18, ease: "easeOut" }
    }
}

const heroItemVariants: Variants = {
    hidden: { opacity: 0, y: 10 },
    visible: {
        opacity: 1,
        y: 0,
        transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] }
    }
}

const heroFadeOnlyVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: { duration: 0.25, ease: "easeOut" }
    }
}

export interface SpotlightHeroProps {
    activeEraId: EraId
    displayTitle: string
    displayDescription: string
    effectiveBackdropSrc: string
    colors?: typeof ERA_COLOR_MAP[EraId]
    currentEraConfig?: EraConfig
    activeSeries: SwimlaneItem | null
    isSeriesComplete: boolean
    activeEraSagas: SagaDefinition[]
    activeEraSeriesId: number
    backdropRef: React.RefObject<HTMLDivElement | null>
    onNavigateHero: () => void
    onNavigateSaga: (seriesId: number, sagaId: string) => void
    availableEras?: EraConfig[]
    onSelectEra?: (eraId: EraId) => void
    direction?: number
}

export const SpotlightHero = React.memo(function SpotlightHero({
    activeEraId,
    displayTitle,
    displayDescription,
    effectiveBackdropSrc,
    colors,
    currentEraConfig,
    activeSeries,
    isSeriesComplete,
    activeEraSagas,
    activeEraSeriesId,
    backdropRef,
    onNavigateHero,
    onNavigateSaga,
    availableEras,
    onSelectEra,
    direction = 1,
}: SpotlightHeroProps) {
    const { playSound } = useSound()
    const reduceMotion = useReducedMotion()
    const isHeavyAllowed = usePerformanceStore(selectIsHeavyEffectsAllowed)
    // Ken Burns y slides solo en equipos capaces y sin reduced-motion.
    const allowCinematicMotion = isHeavyAllowed && !reduceMotion
    const canSlide = (availableEras?.length ?? 0) > 1

    const goToOffset = React.useCallback((offset: number) => {
        if (!availableEras || availableEras.length <= 1 || !onSelectEra) return
        const currentIndex = availableEras.findIndex(e => e.id === activeEraId)
        if (currentIndex === -1) return
        const nextIndex = (currentIndex + offset + availableEras.length) % availableEras.length
        playSound("category", 0.05)
        onSelectEra(availableEras[nextIndex].id)
    }, [availableEras, activeEraId, onSelectEra, playSound])

    const handleDragEnd = (_: any, info: { offset: { x: number } }) => {
        if (!canSlide) return
        const SWIPE_THRESHOLD = 50
        if (info.offset.x > SWIPE_THRESHOLD) {
            goToOffset(-1)
        } else if (info.offset.x < -SWIPE_THRESHOLD) {
            goToOffset(1)
        }
    }

    return (
        <div className="relative w-full">
            {/* Hero Card Stage */}
            <motion.div
                drag={canSlide ? "x" : false}
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.2}
                onDragEnd={handleDragEnd}
                className="group w-full relative z-10 rounded-3xl overflow-hidden min-h-[440px] sm:min-h-[500px] md:min-h-[540px] lg:min-h-[580px] flex flex-col justify-end border border-outline-variant shadow-[0_25px_60px_-15px_rgba(0,0,0,0.95)] bg-[var(--bg-primary)] transition-colors duration-700"
                style={{
                    borderColor: colors ? `color-mix(in srgb, ${colors.accent} 25%, rgba(255,255,255,0.12))` : undefined
                }}
            >
                {/* Full Stage Theatrical Visual with cinematic blend and parallax */}
                <div ref={backdropRef} className="absolute inset-0 w-full h-full pointer-events-none overflow-hidden z-0 will-change-transform">
                    <AnimatePresence mode="popLayout" custom={direction}>
                        <motion.div
                            key={activeEraId + "_visual"}
                            custom={direction}
                            variants={heroBackdropVariants}
                            initial="initial"
                            animate="animate"
                            exit="exit"
                            className="absolute inset-0 w-full h-full pointer-events-none overflow-hidden z-0"
                        >
                            {effectiveBackdropSrc && (
                                <DeferredImage
                                    src={effectiveBackdropSrc.startsWith("/") ? effectiveBackdropSrc : getLargeResImage(effectiveBackdropSrc)}
                                    alt={displayTitle}
                                    priority={true}
                                    loading="eager"
                                    decoding="async"
                                    className="w-full h-full block"
                                    imgClassName="!w-full !h-full !object-cover !object-center sm:!object-right filter saturate-[125%] contrast-[105%]"
                                />
                            )}

                            {/* Cinejoy Cinematic Dark Gradients (tokenizados - respetan tema amoled/era) */}
                            {/* Left-to-Right gradient: guarantees text legibility */}
                            <div className="absolute inset-0 scrim-hero-left pointer-events-none" />
                            {/* Bottom-to-Top gradient: seamless dissolve */}
                            <div className="absolute inset-0 scrim-hero-bottom pointer-events-none" />
                            {/* Top subtle vignette */}
                            <div className="absolute inset-0 scrim-hero-top pointer-events-none" />

                        </motion.div>
                    </AnimatePresence>
                </div>

                {/* Era Prev/Next Navigation Controls */}
                {canSlide && (
                    <>
                        <button
                            type="button"
                            aria-label="Era anterior"
                            onClick={(e) => { e.stopPropagation(); goToOffset(-1) }}
                            className="absolute left-3 top-1/2 -translate-y-1/2 z-30 w-9 h-9 rounded-full bg-[var(--glass-bg-strong)] border border-[var(--glass-border-side)] text-on-surface flex items-center justify-center opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity backdrop-blur-overlay-md hover:bg-[var(--glass-bg-hover)] cursor-pointer"
                        >
                            <ChevronLeft size={18} />
                        </button>
                        <button
                            type="button"
                            aria-label="Era siguiente"
                            onClick={(e) => { e.stopPropagation(); goToOffset(1) }}
                            className="absolute right-3 top-1/2 -translate-y-1/2 z-30 w-9 h-9 rounded-full bg-[var(--glass-bg-strong)] border border-[var(--glass-border-side)] text-on-surface flex items-center justify-center opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity backdrop-blur-overlay-md hover:bg-[var(--glass-bg-hover)] cursor-pointer"
                        >
                            <ChevronRight size={18} />
                        </button>
                    </>
                )}

                {/* Text, Badges, Sagas and Actions Overlay */}
                <div className="relative z-20 flex flex-col justify-end p-5 sm:p-6 md:p-7 space-y-2.5 w-full pointer-events-none">
                    <AnimatePresence mode="wait" initial={false}>
                        <motion.div
                            key={activeEraId}
                            variants={allowCinematicMotion ? heroContentContainerVariants : undefined}
                            initial={allowCinematicMotion ? "hidden" : { opacity: 0 }}
                            animate={allowCinematicMotion ? "visible" : { opacity: 1, transition: { duration: 0.25 } }}
                            exit={{ opacity: 0, transition: { duration: 0.15 } }}
                            className="flex flex-col space-y-2.5 transform-gpu text-left w-full pointer-events-auto"
                            style={{
                                "--spotlight-title-hover": colors?.ambientGlow1 ?? "#FBBF24",
                            } as React.CSSProperties}
                        >
                            {/* Information column constrained to max-w-2xl */}
                            <div className="flex flex-col space-y-2.5 max-w-2xl">
                                {/* Title with display font */}
                                <motion.h3
                                    variants={heroItemVariants}
                                    onClick={onNavigateHero}
                                    className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight leading-[1.05] text-white uppercase select-none font-display cursor-pointer hover:text-[var(--spotlight-title-hover)] transition-colors text-edge-glow text-balance"
                                >
                                    {displayTitle}
                                </motion.h3>

                                {/* Metadata Row with Unified Capsule (Fade-only to avoid Chromium backdrop-filter delay) */}
                                <MediaMetadataCapsule
                                    format="SERIE TV"
                                    year={activeSeries?.year}
                                    rating={activeSeries?.rating}
                                    variants={heroFadeOnlyVariants}
                                >
                                    {isSeriesComplete ? (
                                        <span className="bg-[var(--warning-bg)] text-[var(--status-warning)] text-[10px] font-mono font-black tracking-wider px-2.5 py-1 rounded-lg border border-[var(--warning-border)] uppercase shadow-elevation-1 flex items-center gap-1.5">
                                            <span className="w-1.5 h-1.5 rounded-full bg-[var(--status-warning)] animate-pulse" />
                                            100% Completa
                                        </span>
                                    ) : activeSeries && (activeSeries.localFilesCount ?? 0) > 0 ? (
                                        <span className="bg-[var(--md-sys-color-surface-container)] text-on-surface-variant text-[10px] font-mono font-bold tracking-wider px-2.5 py-1 rounded-lg border border-[var(--glass-border-side)] uppercase">
                                            {activeSeries.localFilesCount}/{activeSeries.totalEpisodesCount} Eps
                                        </span>
                                    ) : null}
                                </MediaMetadataCapsule>

                                {/* Synopsis */}
                                {displayDescription && (
                                    <motion.p variants={heroItemVariants} className="text-on-surface text-xs sm:text-sm leading-relaxed font-normal select-none line-clamp-3 max-w-xl drop-shadow">
                                        {displayDescription}
                                    </motion.p>
                                )}

                                {/* Quick Saga Chips */}
                                {activeEraSagas.length > 0 && (
                                    <motion.div variants={heroItemVariants} className="flex flex-wrap items-center gap-1.5 pt-0.5" onClick={(e) => e.stopPropagation()}>
                                        <span className="text-[10px] font-mono uppercase tracking-wider text-on-surface-variant font-bold mr-1 flex items-center gap-1">
                                            <IconNavigationLayers size={11} className="text-[var(--spotlight-title-hover)]" /> Sagas:
                                        </span>
                                        {activeEraSagas.slice(0, 5).map((saga) => (
                                            <button
                                                key={saga.id}
                                                onClick={() => onNavigateSaga(activeEraSeriesId, saga.id)}
                                                className="px-2.5 py-1 rounded-lg text-[10px] sm:text-[11px] font-bold bg-[var(--glass-bg)] hover:bg-[var(--glass-bg-hover)] border border-[var(--glass-border-side)] hover:border-[var(--glass-border-top)] text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer select-none shadow-elevation-1 hover:scale-105 active:scale-95"
                                                title={`Ir a ${saga.title}`}
                                            >
                                                {saga.title.replace(/^Saga (de |del |de los )?/i, "").replace(/^Arco de /i, "")}
                                            </button>
                                        ))}
                                    </motion.div>
                                )}
                            </div>

                            {/* Action Buttons & Carousel Progress Indicator */}
                            <motion.div variants={heroItemVariants} className="flex flex-wrap items-center justify-between gap-3 pt-2 w-full">
                                <div className="flex flex-wrap items-center gap-3">
                                    <RippleFeedback
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            onNavigateHero()
                                        }}
                                        rippleColor="rgba(0, 0, 0, 0.22)"
                                        className="flex items-center justify-center bg-white text-zinc-950 font-black text-xs sm:text-sm uppercase tracking-wider py-2.5 px-6 rounded-full font-display gap-2 cursor-pointer border border-white/40 border-t-white/80 border-b-white/20 shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.6),0_8px_24px_rgba(255,255,255,0.25)] hover:shadow-[0_12px_32px_rgba(255,255,255,0.35)] transition-all duration-200 hover:scale-[1.04] hover:-translate-y-px active:scale-95"
                                    >
                                        <IconMediaPlay size={15} fill="currentColor" />
                                        <span>Reproducir</span>
                                    </RippleFeedback>

                                    <RippleFeedback
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            onNavigateHero()
                                        }}
                                        rippleColor="rgba(255, 255, 255, 0.2)"
                                        className="flex items-center justify-center border border-white/20 border-t-white/40 border-b-white/10 bg-zinc-950/45 hover:bg-zinc-900/60 text-white font-bold text-xs sm:text-sm uppercase tracking-wider py-2.5 px-5 rounded-full font-display gap-1.5 cursor-pointer backdrop-blur-overlay-xl shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.2)] transition-all duration-200 hover:scale-[1.04] hover:-translate-y-px active:scale-95"
                                    >
                                        <IconUiInfo size={15} />
                                        <span>Detalles</span>
                                    </RippleFeedback>

                                    {/* Opening Player pill if available */}
                                    {currentEraConfig?.defaultSaga && (
                                        <div onClick={(e) => e.stopPropagation()}>
                                            <EraOpeningPlayer
                                                sagaId={currentEraConfig.defaultSaga}
                                                className="text-xs sm:text-sm"
                                            />
                                        </div>
                                    )}
                                </div>
                                {/* Floating Carousel Loading Indicator Capsule */}
                                {availableEras && availableEras.length > 1 && (
                                    <div
                                        onClick={(e) => e.stopPropagation()}
                                        className="flex items-center gap-2 bg-zinc-950/45 border border-white/20 border-t-white/40 border-b-white/10 backdrop-blur-overlay-2xl px-3.5 py-2 rounded-full shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.25),0_8px_24px_rgba(0,0,0,0.6)] ml-auto"
                                    >
                                        {availableEras.map((era) => {
                                            const isCurrent = era.id === activeEraId
                                            return (
                                                <button
                                                    key={era.id}
                                                    type="button"
                                                    onClick={() => {
                                                        playSound("category", 0.05)
                                                        onSelectEra?.(era.id)
                                                    }}
                                                    aria-label={`Ir a era ${era.title}`}
                                                    className="relative h-1.5 rounded-full overflow-hidden transition-[width] duration-300 cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white"
                                                    style={{
                                                        width: isCurrent ? "1.85rem" : "0.5rem",
                                                        backgroundColor: isCurrent ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.35)",
                                                    }}
                                                >
                                                    {isCurrent && allowCinematicMotion && (
                                                        <div
                                                            key={activeEraId}
                                                            className="h-full w-full rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.9)] animate-hero-progress"
                                                        />
                                                    )}
                                                    {isCurrent && !allowCinematicMotion && (
                                                        <div className="h-full w-full rounded-full bg-white/80" />
                                                    )}
                                                </button>
                                            )
                                        })}
                                    </div>
                                )}
                            </motion.div>
                        </motion.div>
                    </AnimatePresence>
                </div>
            </motion.div>
        </div>
    )
})
