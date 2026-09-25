import * as React from "react"
import { AnimatePresence, m, type PanInfo } from "framer-motion"
import { IconNavigationLayers, IconMediaPlay, IconUiInfo } from "@/components/ui/icons"
import { EraOpeningPlayer } from "@/components/shared/era-opening-player"
import { MediaMetadataCapsule } from "@/components/ui/media-metadata-capsule"
import type { SwimlaneItem } from "@/components/ui/swimlane"
import type { SagaDefinition } from "@/lib/config/dragonball_sagas"
import type { ERAS, ERA_COLOR_MAP, EraId } from "@/lib/config/eras"
import { SERIES_HERO_ART, heroArtFromUrl } from "@/lib/config/hero-art"
import { HeroBackdrop, heroHighResSrc } from "@/components/ui/spotlight/hero-backdrop"
import { HERO_PARALLAX_OVERSCAN, HERO_STAGE_CLASS } from "@/lib/config/hero-stage"
import { cn } from "@/components/ui/core/styling"
import { useSound } from "@/hooks/use-sound"
import { useImagePalette } from "@/hooks/use-image-palette"
import {
    RippleFeedback,
    useMotionTier,
    heroContentContainerVariants,
    heroItemVariants,
    heroFadeOnlyVariants,
    heroBackdropSlideVariants,
    useSpringPreset,
} from "@/components/ui/kinetics"
import { HeroCarouselDots } from "@/components/ui/spotlight/hero-carousel-dots"

export type EraConfig = typeof ERAS[number]

// Lookup rápido de clasificación por era
const ERA_AGE_RATING: Partial<Record<EraId, string>> = {
    db: "TV-PG", dbgt: "TV-PG", dbdaima: "TV-PG",
    dbz: "TV-14", dbkai: "TV-14", dbs: "TV-14",
}

/** Base negra cinematográfica con tinte tenue de la imagen (nunca wash plano). */
function PaletteAmbient({
    imageSrc,
    colors,
}: {
    imageSrc: string
    colors: typeof ERA_COLOR_MAP[EraId] | undefined
}) {
    const palette = useImagePalette(imageSrc)
    return (
        <div
            className="absolute inset-0 w-full h-full pointer-events-none bg-black transition-[background,filter] duration-500 ease-smooth-out"
            style={{
                background: palette
                    ? `linear-gradient(to right, #000000 0%, color-mix(in srgb, ${palette.left} 18%, #000000) 34%, rgba(0,0,0,0) 58%), radial-gradient(ellipse 70% 60% at 78% 32%, color-mix(in srgb, ${palette.right} 26%, transparent) 0%, transparent 70%), #000000`
                    : colors
                      ? `radial-gradient(ellipse 85% 75% at 78% 30%, color-mix(in srgb, ${colors.accent} 22%, transparent) 0%, transparent 70%), #000000`
                      : "#000000",
                filter: "saturate(120%) brightness(0.55)",
            }}
        />
    )
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
    /** Congela la barra de progreso de los dots (y con ella la rotación). */
    isPaused?: boolean
    /** Llamado cuando la barra del dot activo se completa. */
    onCycleComplete?: () => void
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
    isPaused = false,
    onCycleComplete,
}: SpotlightHeroProps) {
    const { playSound } = useSound()
    const motionTier = useMotionTier()
    // Ken Burns y slides solo en equipos capaces y sin reduced-m / tvMode.
    const allowCinematicMotion = motionTier === "full"
    const canSlide = (availableEras?.length ?? 0) > 1
    const pressSpring = useSpringPreset("press")

    const goToOffset = React.useCallback((offset: number) => {
        if (!availableEras || availableEras.length <= 1 || !onSelectEra) return
        const currentIndex = availableEras.findIndex(e => e.id === activeEraId)
        if (currentIndex === -1) return
        const nextIndex = (currentIndex + offset + availableEras.length) % availableEras.length
        playSound("category", 0.05)
        onSelectEra(availableEras[nextIndex].id)
    }, [availableEras, activeEraId, onSelectEra, playSound])

    const handleDragEnd = (_event: unknown, info: PanInfo) => {
        if (!canSlide) return
        const SWIPE_THRESHOLD = 50
        if (info.offset.x > SWIPE_THRESHOLD) {
            goToOffset(-1)
        } else if (info.offset.x < -SWIPE_THRESHOLD) {
            goToOffset(1)
        }
    }

    // Arte curado de la era (punto focal + composición); si el backdrop vino
    // de otra fuente, encuadre por defecto.
    const heroArt = React.useMemo(() => {
        const curated = SERIES_HERO_ART[activeEraId]
        if (!effectiveBackdropSrc) return null
        return curated?.src === effectiveBackdropSrc ? curated : heroArtFromUrl(effectiveBackdropSrc)
    }, [activeEraId, effectiveBackdropSrc])

    return (
        <div className="relative w-full">
            {/* Card cinematográfico con proporción adaptativa (16:9 mobile / 2.1:1 tablet / 2.35:1 scope desktop) */}
            <m.div
                drag={canSlide ? "x" : false}
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.2}
                onDragEnd={handleDragEnd}
                // Al arrastrar el hero cede apenas: confirma que el gesto se tomó.
                whileDrag={allowCinematicMotion && canSlide ? { scale: 0.99 } : undefined}
                transition={pressSpring}
                className={cn(
                    "group w-full relative z-10 rounded-hero overflow-hidden flex flex-col justify-end border border-white/10 shadow-hero bg-black transition-colors duration-700",
                    HERO_STAGE_CLASS
                )}
                style={{
                    borderColor: colors ? `color-mix(in srgb, ${colors.accent} 25%, rgba(255,255,255,0.1))` : undefined
                }}
            >
                {/* Backdrop visual: sobresale HERO_PARALLAX_OVERSCAN por arriba para que
                    el parallax (topado en ese valor) nunca descubra una franja negra. */}
                <div
                    ref={backdropRef}
                    className="absolute inset-x-0 bottom-0 w-full pointer-events-none overflow-hidden z-hero-base transform-gpu"
                    style={{ top: -HERO_PARALLAX_OVERSCAN }}
                >
                    {/* sync: crossfade sin bloquear 250ms la entrada (las capas son absolute y se solapan) */}
                    <AnimatePresence mode="sync" custom={direction}>
                        <m.div
                            key={activeEraId + "_visual"}
                            custom={direction}
                            variants={heroBackdropSlideVariants}
                            initial="initial"
                            animate="animate"
                            exit="exit"
                            className="absolute inset-0 w-full h-full pointer-events-none overflow-hidden z-hero-base"
                        >
                            {heroArt && (
                                <>
                                     {/* 1. Fondo ambiental con la paleta extraída de la propia imagen
                                          (canvas 32×18: imposible que queden formas, solo color real
                                          de cada zona). Fallback a colores de la era mientras carga. */}
                                      <PaletteAmbient
                                          imageSrc={heroHighResSrc(heroArt)}
                                          colors={colors}
                                      />


                                     {/* 2. Capa nítida: encuadre por punto focal, máscara según composición */}
                                     <HeroBackdrop
                                         art={heroArt}
                                         alt={displayTitle}
                                         imgClassName="hero-image-filter"
                                     />
                                </>
                            )}

                            {/* Sombra inferior atada al contenido: ocupa solo la mitad baja,
                                nace transparente debajo del título y crece hacia la base.
                                Sin componente lateral, sin radiales, sin máscaras. */}
                            <div className="absolute inset-x-0 bottom-0 top-[52%] pointer-events-none scrim-hero-bottom-rise" />

                        </m.div>
                    </AnimatePresence>
                </div>

                {/* Columna de texto en Zona Segura (máximo 480px para no tapar los personajes a la derecha) */}
                <div className="relative z-hero-content flex flex-col justify-end p-5 sm:p-6 md:p-8 space-y-2.5 w-full pointer-events-none">
                    <AnimatePresence mode="wait" initial={false}>
                        <m.div
                            key={activeEraId}
                            variants={allowCinematicMotion ? heroContentContainerVariants : undefined}
                            initial={allowCinematicMotion ? "hidden" : { opacity: 0 }}
                            animate={allowCinematicMotion ? "visible" : { opacity: 1, transition: { duration: 0.25 } }}
                            exit={{ opacity: 0, transition: { duration: 0.15 } }}
                            className="flex flex-col space-y-2.5 transform-gpu will-change-transform text-left w-full pointer-events-auto max-w-sm sm:max-w-md lg:max-w-hero-content"
                            style={{
                                "--spotlight-title-hover": colors?.ambientGlow1 ?? "#FBBF24",
                            } as React.CSSProperties}
                        >
                            {/* Título (sin badge repetido encima en Home) */}
                            <m.h2
                                variants={heroItemVariants}
                                role="link"
                                tabIndex={0}
                                aria-label={`Ver ${displayTitle}`}
                                onClick={onNavigateHero}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    onNavigateHero();
                                  }
                                }}
                                className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight leading-[1.05] text-white uppercase select-none font-display cursor-pointer hover:text-[var(--spotlight-title-hover)] transition-colors text-edge-glow text-balance focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent rounded"
                            >
                                {displayTitle}
                            </m.h2>

                            {/* Cápsula de metadata glass */}
                            <MediaMetadataCapsule
                                format={currentEraConfig?.tag ?? "SERIE TV"}
                                year={activeSeries?.year || currentEraConfig?.year}
                                ageRating={ERA_AGE_RATING[activeEraId] ?? "TV-14"}
                                variants={heroFadeOnlyVariants}
                            >
                                {isSeriesComplete && (
                                    <span className="bg-amber-500/20 text-amber-300 text-3xs font-mono font-bold px-2.5 py-1 rounded-lg border border-amber-500/30 uppercase">
                                        Completa
                                    </span>
                                )}
                            </MediaMetadataCapsule>

                            {/* Sinopsis */}
                            {displayDescription && (
                                <m.p
                                    variants={heroItemVariants}
                                    className="text-on-surface text-xs sm:text-sm leading-relaxed font-normal select-none line-clamp-3 max-w-xl drop-shadow"
                                >
                                    {displayDescription}
                                </m.p>
                            )}

                            {/* Chips de sagas — máx 4, glass, 1 línea */}
                            {activeEraSagas.length > 0 && (
                                <m.div
                                    variants={heroItemVariants}
                                    className="flex items-center gap-1.5 pt-1 overflow-hidden"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <span className="text-3xs font-mono uppercase tracking-wider text-zinc-400 font-bold mr-1 flex items-center gap-1 shrink-0">
                                        <IconNavigationLayers size={11} className="text-[var(--spotlight-title-hover)]" /> Sagas:
                                    </span>
                                    {activeEraSagas.slice(0, 4).map((saga) => (
                                        <button
                                            key={saga.id}
                                            onClick={() => onNavigateSaga(activeEraSeriesId, saga.id)}
                                            className="px-2.5 py-1 rounded-full text-3xs sm:text-2xs font-semibold bg-zinc-950/45 hover:bg-zinc-900/60 border border-white/15 hover:border-white/30 text-zinc-300 hover:text-white transition-[color,background-color,border-color,transform] cursor-pointer select-none active:scale-95 backdrop-blur-sm truncate max-w-[120px]"
                                            title={`Ir a ${saga.title}`}
                                        >
                                            {saga.title.replace(/^Saga (de |del |de los )?/i, "").replace(/^Arco de /i, "")}
                                        </button>
                                    ))}
                                </m.div>
                            )}
                        </m.div>
                    </AnimatePresence>

                    {/* CTAs + Dots carrusel (idéntica posición y ritmo que Películas) */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-2 w-full pointer-events-auto">
                        <div className="flex items-center gap-3">
                            <RippleFeedback
                                onClick={(e) => {
                                    e.stopPropagation()
                                    onNavigateHero()
                                }}
                                rippleColor="rgba(0, 0, 0, 0.22)"
                                className="flex items-center justify-center bg-white hover:bg-zinc-100 text-zinc-950 font-black text-xs sm:text-sm uppercase tracking-wider py-2.5 px-6 sm:px-7 rounded-full font-display gap-2 cursor-pointer border border-white/40 border-t-white/80 border-b-white/20 shadow-hero-cta hover:shadow-hero-cta-hover transition-[transform,box-shadow,background-color] duration-base ease-smooth-out hover:scale-[1.03] active:scale-[0.97] active:duration-100 select-none"
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
                                className="flex items-center justify-center bg-surface-container-lowest/60 border border-white/20 border-t-white/40 border-b-white/10 backdrop-blur-overlay-xl text-white font-bold text-xs sm:text-sm uppercase tracking-wider font-display py-2.5 px-5 rounded-full gap-2 cursor-pointer shadow-glass-highlight-md transition-[transform,box-shadow,background-color] duration-base ease-smooth-out hover:scale-[1.03] active:scale-[0.97] active:duration-100 select-none"
                            >
                                <IconUiInfo size={15} />
                                <span>Más información</span>
                            </RippleFeedback>

                            {/* Opening Player pill (el div solo frena propagación al héroe) */}
                            {currentEraConfig?.defaultSaga && (
                                // eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events -- guard de propagación, no es control
                                <div onClick={(e) => e.stopPropagation()}>
                                    <EraOpeningPlayer
                                        sagaId={currentEraConfig.defaultSaga}
                                        className="text-xs sm:text-sm"
                                    />
                                </div>
                            )}
                        </div>

                        {/* Dots carrusel (compartidos con Películas) */}
                        {availableEras && availableEras.length > 1 && (
                            <HeroCarouselDots
                                count={availableEras.length}
                                activeIndex={Math.max(0, availableEras.findIndex(e => e.id === activeEraId))}
                                onSelect={(i) => {
                                    playSound("category", 0.05)
                                    onSelectEra?.(availableEras[i].id)
                                }}
                                getLabel={(i) => `Ir a era ${availableEras[i].title}`}
                                paused={isPaused}
                                showProgress={allowCinematicMotion}
                                onCycleComplete={onCycleComplete}
                            />
                        )}
                    </div>
                </div>
            </m.div>
        </div>
    )
})
