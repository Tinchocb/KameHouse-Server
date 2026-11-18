import * as React from "react"
import { AnimatePresence, m, type PanInfo } from "framer-motion"
import { IconNavigationLayers, IconUiInfo } from "@/components/ui/icons"
import { EraOpeningPlayer } from "@/components/shared/era-opening-player"
import { PrimaryPlayButton } from "@/components/media-detail/detail-actions"
import { Button } from "@/components/ui/button/button"
import type { SagaDefinition } from "@/lib/config/dragonball_sagas"
import type { ERAS, ERA_COLOR_MAP, EraId } from "@/lib/config/eras"
import { SERIES_HERO_ART, heroArtFromUrl } from "@/lib/config/hero-art"
import { HeroBackdrop, heroHighResSrc } from "@/components/ui/spotlight/hero-backdrop"
import { HERO_PARALLAX_OVERSCAN, HERO_STAGE_CLASS } from "@/lib/config/hero-stage"
import { shortSagaTitle } from "@/lib/helpers/series"
import { prewarmImages } from "@/lib/helpers/images"
import { cn } from "@/components/ui/core/styling"
import { useSound } from "@/hooks/use-sound"
import { useImagePalette } from "@/hooks/use-image-palette"
import {
    useMotionTier,
    heroContainerVariants,
    heroItemVariants,
    heroBackdropSlideVariants,
    heroBackdropSubtleVariants,
    useSpringPreset,
} from "@/components/ui/kinetics"
import { HeroContent } from "@/components/ui/spotlight/hero-content"
import { HeroCarouselDots } from "@/components/ui/spotlight/hero-carousel-dots"
import { useIsClassicMode, useIsMinimalistMode } from "@/lib/theme/use-classic-mode"

type EraConfig = typeof ERAS[number]

/** Base negra cinematográfica con tinte tenue de la imagen (nunca wash plano). */
function PaletteAmbient({
    imageSrc,
    colors,
    isClassic,
}: {
    imageSrc: string
    colors: typeof ERA_COLOR_MAP[EraId] | undefined
    isClassic?: boolean
}) {
    const palette = useImagePalette(imageSrc)
    if (isClassic) {
        return <div className="absolute inset-0 w-full h-full pointer-events-none bg-black" />
    }
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

interface SpotlightHeroProps {
    activeEraId: EraId
    displayTitle: string
    displayDescription: string
    effectiveBackdropSrc: string
    colors?: typeof ERA_COLOR_MAP[EraId]
    currentEraConfig?: EraConfig
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
    const isClassic = useIsClassicMode()
    const isMinimalist = useIsMinimalistMode()
    // Ken Burns y slides solo en equipos capaces y sin reduced-m.
    const allowCinematicMotion = motionTier === "full"
    const canSlide = (availableEras?.length ?? 0) > 1

    // Precarga en reposo de las portadas de todas las eras para transiciones sin latencia
    React.useEffect(() => {
        const urls = Object.values(SERIES_HERO_ART).map((art) => art.src)
        prewarmImages(urls)
    }, [])
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
                    "spotlight-hero-card group w-full relative z-10 rounded-hero overflow-hidden flex flex-col justify-end border border-white/10 shadow-hero transition-colors duration-700",
                    !isMinimalist && "bg-black",
                    HERO_STAGE_CLASS
                )}
                style={{
                    borderColor: isClassic ? "var(--neutral-separator)" : (!isMinimalist && colors ? `color-mix(in srgb, ${colors.accent} 25%, rgba(255,255,255,0.1))` : undefined)
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
                            variants={allowCinematicMotion ? heroBackdropSlideVariants : heroBackdropSubtleVariants}
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
                                      {!isMinimalist && (
                                          <PaletteAmbient
                                              imageSrc={heroHighResSrc(heroArt)}
                                              colors={colors}
                                              isClassic={isClassic}
                                          />
                                      )}


                                     {/* 2. Capa nítida de borde a borde: arte fotográfico completo sin desenfoque ni recorte artificial */}
                                     <HeroBackdrop
                                         art={heroArt}
                                         alt={displayTitle}
                                         wide="cover"
                                         scrims={!isMinimalist}
                                         imgClassName="hero-image-filter"
                                     />
                                </>
                            )}

                            {/* Sombra inferior atada al contenido: ocupa solo la mitad baja,
                                nace transparente debajo del título y crece hacia la base.
                                Sin componente lateral, sin radiales, sin máscaras. */}
                            {/* Degradado de contraste para legibilidad del texto (inferior y lateral izquierdo) */}
                            <div
                                className="absolute inset-0 pointer-events-none"
                                style={{
                                    background: isMinimalist
                                        ? "linear-gradient(to top, rgba(8, 8, 10, 0.96) 0%, rgba(8, 8, 10, 0.82) 28%, rgba(8, 8, 10, 0.42) 55%, transparent 78%), linear-gradient(to right, rgba(8, 8, 10, 0.85) 0%, rgba(8, 8, 10, 0.5) 35%, rgba(8, 8, 10, 0.15) 55%, transparent 75%)"
                                        : "linear-gradient(to top, rgba(8, 8, 10, 0.88) 0%, rgba(8, 8, 10, 0.45) 40%, transparent 100%)",
                                }}
                            />

                        </m.div>
                    </AnimatePresence>
                </div>

                {/* Columna de texto en Zona Segura (máximo 480px para no tapar los personajes a la derecha) */}
                <div className="relative z-hero-content flex flex-col justify-end p-5 sm:p-6 md:p-8 space-y-2.5 w-full pointer-events-none">
                    <div className="grid w-full max-w-sm sm:max-w-md lg:max-w-hero-content">
                        <AnimatePresence mode="sync" initial={false}>
                            <HeroContent
                                key={activeEraId}
                                variants={allowCinematicMotion ? heroContainerVariants : undefined}
                                initial={allowCinematicMotion ? "hidden" : { opacity: 0 }}
                                animate={allowCinematicMotion ? "visible" : { opacity: 1, transition: { duration: 0.35, ease: "easeInOut" } }}
                                exit={{ opacity: 0, transition: { duration: 0.25, ease: "easeInOut" } }}
                                className="flex flex-col space-y-2.5 text-left w-full pointer-events-auto"
                                style={{
                                    "--spotlight-title-hover": isClassic || isMinimalist ? "var(--label-1)" : (colors?.ambientGlow1 ?? "#FBBF24"),
                                } as React.CSSProperties}
                            >
                                {/* Título (sin badge repetido encima en Home) */}
                                <m.h1
                                    variants={heroItemVariants}
                                    className={cn(
                                        "text-hero-title font-extrabold tracking-tight leading-[1.05] text-white select-none text-balance [text-shadow:0_2px_16px_rgba(0,0,0,0.95),0_1px_4px_rgba(0,0,0,0.9)]",
                                        !isMinimalist && "uppercase font-display font-black text-edge-glow"
                                    )}
                                >
                                    {/* El enlace va en un hijo: role="link" sobre el h1 anularía el encabezado. */}
                                    <span
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
                                        className="cursor-pointer hover:text-[var(--spotlight-title-hover)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent rounded"
                                    >
                                        {displayTitle}
                                    </span>
                                </m.h1>

                                {/* Sinopsis */}
                                {displayDescription && (
                                    <m.p
                                        variants={heroItemVariants}
                                        className={cn(
                                            "hero-synopsis leading-relaxed select-none line-clamp-3",
                                            isMinimalist
                                                ? "text-white text-xs sm:text-[14.5px] max-w-[48ch] [text-shadow:0_1px_8px_rgba(0,0,0,0.9)]"
                                                : "text-on-surface text-xs sm:text-sm font-normal max-w-xl drop-shadow"
                                        )}
                                    >
                                        {displayDescription}
                                    </m.p>
                                )}

                                {/* Chips de sagas — máx 4, glass, 1 línea (ocultos en modo minimalista) */}
                                {!isMinimalist && activeEraSagas.length > 0 && (
                                    <m.div
                                        variants={heroItemVariants}
                                        className="flex items-center gap-1.5 pt-1 overflow-x-auto no-scrollbar [mask-image:linear-gradient(to_right,black_calc(100%-20px),transparent)] sm:[mask-image:none]"
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <span className="text-3xs font-mono uppercase tracking-wider text-on-surface-variant font-bold mr-1 flex items-center gap-1 shrink-0">
                                            <IconNavigationLayers size={11} className="text-[var(--spotlight-title-hover)]" /> Sagas:
                                        </span>
                                        {activeEraSagas.slice(0, 4).map((saga) => (
                                            <button
                                                key={saga.id}
                                                type="button"
                                                onClick={() => onNavigateSaga(activeEraSeriesId, saga.id)}
                                                className="spotlight-saga-chip inline-flex items-center px-3 py-1 min-h-[28px] [@media(pointer:coarse)]:min-h-[44px] rounded-full text-2xs font-semibold bg-black/60 border border-white/15 text-on-surface-variant [@media(hover:hover)_and_(pointer:fine)]:hover:bg-black/80 [@media(hover:hover)_and_(pointer:fine)]:hover:border-white/30 [@media(hover:hover)_and_(pointer:fine)]:hover:text-on-surface transition-[color,background-color,border-color,transform] duration-quick ease-out-strong cursor-pointer select-none motion-safe:active:scale-[0.97] truncate max-w-[168px] shrink-0"
                                                title={`Ir a ${saga.title}`}
                                            >
                                                {shortSagaTitle(saga.title)}
                                            </button>
                                        ))}
                                    </m.div>
                                )}
                            </HeroContent>
                        </AnimatePresence>
                    </div>

                    {/* CTAs + Dots carrusel (idéntica posición y ritmo que Películas) */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-2 w-full pointer-events-auto">
                        <div className="hero-actions flex flex-wrap items-center gap-3">
                            <PrimaryPlayButton
                                label="Reproducir"
                                onClick={onNavigateHero}
                                className="spotlight-play-cta"
                            />

                            <Button
                                intent="glass"
                                size="lg"
                                onClick={onNavigateHero}
                                leftIcon={<IconUiInfo className="h-5 w-5" aria-hidden="true" />}
                                className="font-bold"
                            >
                                Más información
                            </Button>

                            {/* Opening Player pill (el div solo frena propagación al héroe; oculto en modo minimalista) */}
                            {!isMinimalist && currentEraConfig?.defaultSaga && (
                                // eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events -- guard de propagación, no es control
                                <div onClick={(e) => e.stopPropagation()}>
                                    <EraOpeningPlayer
                                        sagaId={currentEraConfig.defaultSaga}
                                        className="text-xs sm:text-sm"
                                    />
                                </div>
                            )}
                        </div>

                        {/* Dots carrusel (ocultos en modo minimalista: la navegación de era va en barra horizontal) */}
                        {!isMinimalist && availableEras && availableEras.length > 1 && (
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
