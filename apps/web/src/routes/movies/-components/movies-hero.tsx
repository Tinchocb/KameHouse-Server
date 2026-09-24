import * as React from "react"
import { getFormatLabel } from "@/lib/helpers/media"
import { useState, useCallback, useMemo } from "react"
import { m, AnimatePresence, useReducedMotion, type Variants } from "framer-motion"
import { IconUiCheck, IconMediaPlay, IconUiPlus, IconUiInfo } from "@/components/ui/icons";
import type { Continuity_WatchHistory } from "@/api/generated/types"
import { cleanMovieTitle } from "../-MovieCard"
import type { MovieEntry } from "../index"
import { ERAS, ERA_COLOR_MAP, type EraId } from "@/lib/config/eras"
import { SpotlightEraNav } from "@/components/ui/spotlight/spotlight-era-nav"
import type { SwimlaneItem } from "@/components/ui/swimlane"
import { useHeroBackdrop } from "@/hooks/use-hero"
import { stripHtml } from "@/lib/helpers/sanitizer"
import { getMediumResImage, getLowResImage } from "@/lib/helpers/images"
import { HeroBackdrop, heroLowResSrc } from "@/components/ui/spotlight/hero-backdrop"
import { useAppStore, useQueueStore } from "@/lib/store"
import { usePerformanceStore, selectIsHeavyEffectsAllowed } from "@/lib/hardware/performance-store"
import { fetchAnimeEntry } from "@/api/hooks/anime_entries.hooks"
import { toast } from "sonner"
import { EmptyState } from "@/components/shared/empty-state"
import { MediaMetadataCapsule } from "@/components/ui/media-metadata-capsule"
import { useHideAudienceScore } from "@/lib/theme/theme-hooks"
import { getMovieLore, getEntryTitle, getLoreDescription, createShuffledIndices } from "./movies-utils"
import { getMovieHeroArt, heroArtFromUrl, heroObjectPosition, DEFAULT_MOVIE_FOCAL, POSTER_FOCAL } from "@/lib/config/hero-art"
import { HERO_AURA_CLASS, HERO_STAGE_CLASS } from "@/lib/config/hero-stage"
import { HeroCarouselDots } from "@/components/ui/spotlight/hero-carousel-dots"

interface MoviesHeroProps {
    topFeatured: MovieEntry[]
    debouncedMovie: MovieEntry | null
    handleMovieClick: (mediaId: number) => void
    watchHistory?: Continuity_WatchHistory
    activeEraId: EraId | "all"
    categorizedData: Record<EraId, { series: SwimlaneItem | null; movies: SwimlaneItem[] }>
    onSelectEra: (eraId: EraId) => void
    onHoverSound: () => void
    isLoading?: boolean
}

// ─── Animation Variants ────────────────────────────────────────────────────────
const heroContentContainerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            staggerChildren: 0.05,
            delayChildren: 0.03,
        }
    },
    exit: {
        opacity: 0,
        y: -8,
        transition: { duration: 0.25, ease: "easeOut" }
    }
}

const heroItemVariants: Variants = {
    hidden: { opacity: 0, y: 12 },
    visible: {
        opacity: 1,
        y: 0,
        transition: { type: "spring", stiffness: 380, damping: 30, mass: 0.8 }
    }
}

const heroFadeOnlyVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: { duration: 0.25, ease: "easeOut" }
    }
}

export function MoviesHero({
    topFeatured,
    debouncedMovie,
    handleMovieClick,
    watchHistory,
    activeEraId,
    categorizedData,
    onSelectEra,
    onHoverSound,
    isLoading = false,
}: MoviesHeroProps) {
    const [featuredIndex, setFeaturedIndex] = useState(0)
    const [, setShuffleQueue] = useState<number[]>([])
    const [isHeroHovered, setIsHeroHovered] = useState(false)
    const isHeavyAllowed = usePerformanceStore(selectIsHeavyEffectsAllowed)
    const reduceMotion = useReducedMotion()
    const tvMode = useAppStore(s => s.tvMode)
    const hideAudienceScore = useHideAudienceScore()
    const allowCinematicMotion = !reduceMotion
    // Halo garantizado por color de era (como Inicio): la animación solo en
    // equipos capaces y sin reduced-motion/TV; en el resto se muestra un orbe
    // estático barato para que los backdrops oscuros no queden sin halo.
    const showAnimatedOrb = isHeavyAllowed && !reduceMotion && !tvMode

    // Identificador estable de la colección para detectar cambios reales de era o filtro
    const topFeaturedIds = useMemo(() => topFeatured.map((m, idx) => m.mediaId ?? idx).join(","), [topFeatured])

    // Entrada aleatoria y nueva cola shuffle al cambiar de era / colección de películas
    const [prevFeaturedIds, setPrevFeaturedIds] = useState(topFeaturedIds)
    if (topFeaturedIds !== prevFeaturedIds) {
        setPrevFeaturedIds(topFeaturedIds)
        const len = topFeatured.length
        if (len <= 1) {
            setFeaturedIndex(0)
            setShuffleQueue([])
        } else {
            const queue = createShuffledIndices(len)
            const initialIdx = queue.shift() ?? 0
            setShuffleQueue(queue)
            setFeaturedIndex(initialIdx)
        }
    }

    // Avance aleatorio sin repetición (cola shuffle). Lo dispara la barra de
    // progreso de los dots al llenarse; con reduced-motion no hay rotación.
    const advanceShuffle = useCallback(() => {
        setShuffleQueue((currentQueue) => {
            const len = topFeatured.length
            if (len <= 1) {
                setFeaturedIndex(0)
                return []
            }

            let queue = [...currentQueue]
            if (queue.length === 0) {
                queue = createShuffledIndices(len, featuredIndex)
            }

            let nextIdx = queue.shift() ?? 0
            if (nextIdx === featuredIndex && len > 1) {
                if (queue.length === 0) {
                    queue = createShuffledIndices(len, featuredIndex)
                }
                nextIdx = queue.shift() ?? 0
            }

            setFeaturedIndex(nextIdx)
            return queue
        })
    }, [topFeatured.length, featuredIndex])

    const handleSelectSlide = useCallback((index: number) => {
        setFeaturedIndex(index)
    }, [])

    const defaultFeatured = topFeatured[featuredIndex] ?? topFeatured[0] ?? null
    const currentMovie = debouncedMovie ?? defaultFeatured
    const displayMedia = currentMovie?.media
    // Color de era canónico (paridad Home): ERA_COLOR_MAP por EraId.
    // Si el filtro es "all", el halo sigue a la película visible.
    const currentEraId: EraId = currentMovie?.eraId ?? (activeEraId !== "all" ? activeEraId : "dbz")
    const currentColors = ERA_COLOR_MAP[currentEraId]
    const currentEraLabel = ERAS.find(e => e.id === currentEraId)?.title ?? "Dragon Ball"

    // Watch history for current movie
    const watchItem = currentMovie?.mediaId ? watchHistory?.[currentMovie.mediaId] : null
    const isCompleted = displayMedia?.watched || (currentMovie?.listData?.progress || 0) >= (displayMedia?.totalEpisodes || 1)
    const progressTime = watchItem?.currentTime || 0
    const totalDuration = watchItem?.duration || 0
    const hasProgress = !isCompleted && progressTime > 30 && totalDuration > 0 && progressTime < totalDuration
    const progressPercent = hasProgress ? Math.min(100, Math.round((progressTime / totalDuration) * 100)) : 0
 
    const heroArt = getMovieHeroArt({
        mediaId: currentMovie?.mediaId,
        tmdbId: displayMedia?.tmdbId,
        bannerImage: displayMedia?.bannerImage,
        posterImage: displayMedia?.posterImage,
    }) ?? (displayMedia?.bannerImage ? heroArtFromUrl(displayMedia.bannerImage, { focal: DEFAULT_MOVIE_FOCAL }) : null)
    const backdropSrc = heroArt?.src ?? null
    const posterSrc = displayMedia?.posterImage ?? null
    // Si no hay backdrop horizontal ni banner, usamos poster como fallback visual seguro
    const visualArt = heroArt ?? (posterSrc ? heroArtFromUrl(posterSrc, { focal: POSTER_FOCAL, subject: "center", aspect: 2 / 3, safeTop: 100 }) : null)
    // Global solo con banner 16:9 widescreen auténtico (nunca la portada vertical)
    const bannerSrc = backdropSrc

    useHeroBackdrop(bannerSrc)

    const lore = useMemo(() => getMovieLore(currentMovie), [currentMovie])

    const plainDescription = useMemo(() => {
        const loreSynopsis = getLoreDescription(lore)
        const rawDesc = displayMedia?.description
        const isDescriptionEnglish = rawDesc && /^(the|after|when|with|in\s+the|during|a\s+|goku\b)/i.test(rawDesc.trim())
        if (!rawDesc || isDescriptionEnglish) {
            return stripHtml(loreSynopsis || rawDesc || "") || null
        }
        return stripHtml(rawDesc) || stripHtml(loreSynopsis || "") || null
    }, [displayMedia?.description, lore])

    const movieTitle = useMemo(() => {
        if (!currentMovie) return ""
        const raw = getEntryTitle(currentMovie) || lore?.title || "Película"
        return cleanMovieTitle(raw)
    }, [currentMovie, lore])

    const handleAddToQueue = async (e: React.MouseEvent) => {
        e.stopPropagation()
        if (!currentMovie?.mediaId) return
        try {
            const fullEntry = await fetchAnimeEntry(String(currentMovie.mediaId))
            const localFile = fullEntry?.localFiles?.[0]
            if (localFile && localFile.path) {
                useQueueStore.getState().addToQueue({
                    id: currentMovie.mediaId,
                    title: movieTitle,
                    playableUrl: localFile.path,
                    thumbnail: getMediumResImage(displayMedia?.posterImage || ""),
                    mediaId: currentMovie.mediaId,
                    episodeNumber: 1,
                    malId: displayMedia?.idMal ?? null,
                    mediaFormat: displayMedia?.format ?? "MOVIE",
                })
                toast.success("Añadida a la cola de reproducción", {
                    description: movieTitle,
                })
            } else {
                toast.info("No hay archivos locales disponibles para reproducir.")
            }
        } catch (err) {
            console.error(err)
            toast.error("No se pudo añadir a la cola")
        }
    }

    return (
        <section
            onMouseEnter={() => setIsHeroHovered(true)}
            onMouseLeave={() => setIsHeroHovered(false)}
            aria-label="Película destacada"
            className="relative w-full max-w-content-desktop mx-auto px-4 sm:px-6 md:px-8 lg:px-10 pt-4 md:pt-20 pb-8 select-none flex flex-col justify-start space-y-4"
        >
            {/* Ambient Aura Background */}
            <div className={HERO_AURA_CLASS}>
                {backdropSrc && currentMovie && (
                    <m.div
                        key={currentMovie.mediaId + "_outer_aura"}
                        initial={{ opacity: 0, scale: 0.96 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 1, ease: "easeOut" }}
                        className="absolute inset-0 pointer-events-none overflow-hidden"
                        style={{
                            backgroundImage: `url(${getLowResImage(backdropSrc)})`,
                            backgroundSize: "cover",
                            backgroundPosition: "center 20%",
                            filter: "blur(48px) saturate(140%)",
                            opacity: 0.32,
                            maskImage: "radial-gradient(ellipse 90% 80% at 70% 40%, black 0%, transparent 75%)",
                            WebkitMaskImage: "radial-gradient(ellipse 90% 80% at 70% 40%, black 0%, transparent 75%)",
                        }}
                    />
                )}

                {showAnimatedOrb && (
                    <m.div
                        animate={{
                            scale: [1, 1.08, 1],
                            opacity: [0.25, 0.4, 0.25],
                        }}
                        transition={{
                            duration: 8,
                            repeat: Infinity,
                            ease: "easeInOut",
                        }}
                        className="absolute -top-[10%] -left-[5%] w-[50%] h-[70%] rounded-full pointer-events-none transition-colors duration-700 transform-gpu"
                        style={{
                            background: `radial-gradient(ellipse, color-mix(in srgb, ${currentColors.accent} 50%, transparent) 0%, transparent 70%)`
                        }}
                    />
                )}

                {!showAnimatedOrb && !tvMode && (
                    <div
                        className="absolute -top-[10%] -left-[5%] w-[50%] h-[70%] rounded-full pointer-events-none transform-gpu"
                        style={{
                            background: `radial-gradient(ellipse, color-mix(in srgb, ${currentColors.accent} 50%, transparent) 0%, transparent 70%)`,
                            opacity: 0.35,
                        }}
                    />
                )}
            </div>

            {/* 1. Barra de Navegación Horizontal de Eras (misma posición que Home) */}
            <div className="relative z-10 w-full">
                <SpotlightEraNav
                    activeEraId={activeEraId}
                    categorizedData={categorizedData}
                    onSelectEra={onSelectEra}
                    onHoverSound={onHoverSound}
                />
            </div>

            {/* 2. CINEJOY THEATRICAL HERO STAGE */}
            <div className="relative z-10 w-full">
                {isLoading && !currentMovie ? (
                    <div
                        className="w-full relative rounded-3xl overflow-hidden min-h-[320px] sm:min-h-[360px] md:min-h-[400px] border border-outline-variant bg-bg-primary animate-pulse"
                        aria-label="Cargando destacadas"
                    />
                ) : !currentMovie ? (
                    <div
                        className="w-full relative rounded-3xl overflow-hidden min-h-[320px] sm:min-h-[360px] md:min-h-[400px] flex items-center justify-center border border-outline-variant shadow-[0_25px_60px_-15px_rgba(0,0,0,0.95)] bg-bg-primary transition-colors duration-700 p-6"
                        style={{
                            borderColor: `color-mix(in srgb, ${currentColors.accent} 25%, rgba(255,255,255,0.12))`
                        }}
                    >
                        <EmptyState
                            title="Sin películas en esta era"
                            message={`La era ${currentEraLabel} no cuenta con películas o especiales cinematográficos en la biblioteca.`}
                        />
                    </div>
                ) : (
                    <div
                        className={`w-full relative rounded-3xl overflow-hidden ${HERO_STAGE_CLASS} flex flex-col justify-end border border-outline-variant shadow-[0_25px_60px_-15px_rgba(0,0,0,0.95)] bg-black transition-colors duration-700`}
                        style={{
                            borderColor: `color-mix(in srgb, ${currentColors.accent} 25%, rgba(255,255,255,0.12))`
                        }}
                    >
                    {/* Full Stage Theatrical Visual with cinematic blend */}
                    <AnimatePresence mode="popLayout">
                        <m.div
                            key={currentMovie.mediaId + "_visual"}
                            // Fundido "por encima" (igual que el hero de Inicio): la saliente
                            // queda opaca debajo hasta que la entrante terminó de aparecer; si no,
                            // entre 0.3s y 0.7s solo se ve el fondo negro.
                            initial={{ opacity: 0, scale: 1.01, zIndex: 1 }}
                            animate={{ opacity: 1, scale: 1, zIndex: 1, transition: { duration: 0.7, ease: "easeOut" } }}
                            exit={{ opacity: 0, zIndex: 0, transition: { opacity: { delay: 0.7, duration: 0.05 } } }}
                            className="absolute inset-0 w-full h-full pointer-events-none overflow-hidden z-0"
                        >
                            {visualArt && (
                                <>
                                    {/* 1. Base negra cinematográfica: evita wash plano si la imagen tarda/falla */}
                                     <div className="absolute inset-0 w-full h-full bg-black pointer-events-none" />
                                     <div
                                          className="absolute inset-0 w-full h-full pointer-events-none"
                                          style={{
                                              backgroundImage: `url(${heroLowResSrc(visualArt) ?? visualArt.src})`,
                                              backgroundSize: "cover",
                                              backgroundPosition: heroObjectPosition(visualArt),
                                              filter: "blur(10px) brightness(0.5) saturate(110%)",
                                          }}
                                      />

                                      {/* 2. Capa nítida: encuadre por punto focal, máscara según composición */}
                                      <HeroBackdrop
                                          art={visualArt}
                                          alt={movieTitle}
                                          imgClassName="filter saturate-[115%] contrast-[108%] brightness-[0.95]"
                                      />
                                </>
                            )}

                            {/* Cinejoy Cinematic Dark Gradients (tokenizados - respetan tema amoled/era) */}
                            {/* Left-to-Right gradient: guarantees text legibility */}
                            <div className="absolute inset-0 scrim-hero-left pointer-events-none" />
                            {/* Bottom-to-Top gradient: seamless dissolve */}
                            <div className="absolute inset-0 scrim-hero-bottom pointer-events-none" />
                            {/* Top subtle vignette */}
                            <div className="absolute inset-0 scrim-hero-top pointer-events-none" />
                        </m.div>
                    </AnimatePresence>

                    {/* Content Overlay (idéntico padding y ritmo que Home) */}
                    <div className="relative z-20 flex flex-col justify-end p-5 sm:p-6 md:p-7 space-y-2.5 w-full pointer-events-none">
                        <AnimatePresence mode="wait">
                            <m.div
                                key={currentMovie.mediaId + "_content"}
                                variants={heroContentContainerVariants}
                                initial="hidden"
                                animate="visible"
                                exit="exit"
                                className="flex flex-col space-y-2.5 transform-gpu will-change-transform text-left w-full pointer-events-auto max-w-2xl"
                            >
                                {/* Top Era Badge */}
                                {currentEraLabel && (
                                    <m.div variants={heroFadeOnlyVariants} className="flex items-center">
                                        <span
                                            className="inline-flex items-center gap-1.5 font-mono text-3xs sm:text-2xs font-bold tracking-widest uppercase px-3 py-1 rounded-full border backdrop-blur-md"
                                            style={{
                                                color: currentColors.accent,
                                                borderColor: `color-mix(in srgb, ${currentColors.accent} 35%, transparent)`,
                                                backgroundColor: `color-mix(in srgb, ${currentColors.accent} 12%, transparent)`,
                                                boxShadow: `0 0 15px color-mix(in srgb, ${currentColors.accent} 18%, transparent)`
                                            }}
                                        >
                                            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: currentColors.accent }} />
                                            {currentEraLabel}
                                        </span>
                                    </m.div>
                                )}

                                {/* Movie Title with display font (mismo tamaño y altura de línea que Home) */}
                                <m.h1
                                    variants={heroItemVariants}
                                    role="link"
                                    tabIndex={currentMovie.mediaId == null ? -1 : 0}
                                    aria-label={`Ver ${movieTitle}`}
                                    onClick={() => {
                                        if (currentMovie.mediaId == null) return
                                        handleMovieClick(currentMovie.mediaId)
                                    }}
                                    onKeyDown={(e) => {
                                        if ((e.key === 'Enter' || e.key === ' ') && currentMovie.mediaId != null) {
                                            e.preventDefault();
                                            handleMovieClick(currentMovie.mediaId)
                                        }
                                    }}
                                    className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight leading-[1.05] text-white uppercase select-none font-display cursor-pointer hover:text-brand-accent transition-colors text-edge-glow text-balance line-clamp-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent rounded"
                                >
                                    {movieTitle}
                                </m.h1>

                                {/* Unified Metadata Capsule (Fade-only to avoid Chromium backdrop-filter delay) */}
                                <MediaMetadataCapsule
                                    format={getFormatLabel(displayMedia?.format, "Película")}
                                    year={displayMedia?.year}
                                    duration={displayMedia?.runtime ? `${displayMedia.runtime} MIN` : null}
                                    rating={hideAudienceScore ? undefined : (displayMedia?.score ? (displayMedia.score / 10) : undefined)}
                                    variants={heroFadeOnlyVariants}
                                >
                                    {isCompleted && (
                                        <span className="bg-brand-success/20 text-brand-success text-3xs font-mono font-bold tracking-wider px-2 py-0.5 rounded border border-brand-success/30 uppercase flex items-center gap-1">
                                            <IconUiCheck className="w-3 h-3" /> Visto
                                        </span>
                                    )}
                                    {hasProgress && (
                                        <span className="bg-brand-secondary/25 text-brand-secondary text-3xs font-mono font-bold tracking-wider px-2 py-0.5 rounded border border-brand-secondary/35 uppercase">
                                            Reanudar ({progressPercent}%)
                                        </span>
                                    )}
                                </MediaMetadataCapsule>

                                {/* Synopsis */}
                                {plainDescription && (
                                    <m.p
                                        variants={heroItemVariants}
                                        className="text-on-surface text-xs sm:text-sm leading-relaxed font-normal select-none line-clamp-3 max-w-xl drop-shadow"
                                    >
                                        {plainDescription}
                                    </m.p>
                                )}
                            </m.div>
                        </AnimatePresence>

                        {/* ─── CINEJOY ACTION BUTTONS & CAROUSEL CONTROLS ──────── */}
                        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 w-full pointer-events-auto">
                            <div className="flex items-center gap-3">
                                {/* Primary Cinejoy Pill Button (Play / Reanudar) */}
                                <button
                                    onClick={() => {
                                        if (currentMovie.mediaId == null) return
                                        handleMovieClick(currentMovie.mediaId)
                                    }}
                                    className="flex items-center justify-center bg-white text-black font-black text-xs sm:text-sm uppercase tracking-wider py-2.5 px-6 sm:px-7 rounded-full font-display gap-2 cursor-pointer border border-white/40 border-t-white/80 border-b-white/20 shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.6),0_8px_24px_rgba(255,255,255,0.25)] hover:shadow-[0_12px_32px_rgba(255,255,255,0.35)] transition-all duration-200 hover:scale-[1.04] hover:-translate-y-px active:scale-95"
                                >
                                    <IconMediaPlay size={15} fill="currentColor" />
                                    <span>{hasProgress ? "Reanudar" : "Ver Película"}</span>
                                </button>

                                {/* Secondary Segmented Glass Capsule [ + Cola | ℹ Detalles ] */}
                                <div className="flex items-center rounded-full bg-surface-container-lowest/60 border border-white/20 border-t-white/40 border-b-white/10 backdrop-blur-overlay-xl text-white shadow-glass-highlight-md overflow-hidden">
                                    <button
                                        onClick={handleAddToQueue}
                                        title="Añadir a la cola de reproducción"
                                        aria-label="Añadir a la cola"
                                        className="py-2.5 pl-4 pr-3 hover:bg-white/[0.08] text-on-surface-variant hover:text-white cursor-pointer transition-colors flex items-center gap-1.5 text-xs sm:text-sm font-bold uppercase tracking-wider font-display rounded-l-full"
                                    >
                                        <IconUiPlus size={15} />
                                        <span className="hidden sm:inline">Cola</span>
                                    </button>

                                    <div className="w-[1px] h-4 bg-white/20" aria-hidden />

                                    <button
                                        onClick={() => {
                                            if (currentMovie.mediaId == null) return
                                            handleMovieClick(currentMovie.mediaId)
                                        }}
                                        title="Ver detalles de la película"
                                        aria-label="Ver detalles"
                                        className="py-2.5 pr-4 pl-3 hover:bg-white/[0.08] text-on-surface-variant hover:text-white cursor-pointer transition-colors flex items-center gap-1.5 text-xs sm:text-sm font-bold uppercase tracking-wider font-display rounded-r-full"
                                    >
                                        <IconUiInfo size={15} />
                                        <span>Detalles</span>
                                    </button>
                                </div>
                            </div>

                            {/* Cinejoy Carousel Dots (compartidos con Inicio) */}
                            <HeroCarouselDots
                                count={topFeatured.length}
                                activeIndex={featuredIndex}
                                onSelect={handleSelectSlide}
                                getLabel={(i) => `Ir a película ${i + 1} de ${topFeatured.length}`}
                                paused={isHeroHovered || !!debouncedMovie}
                                showProgress={allowCinematicMotion}
                                onCycleComplete={advanceShuffle}
                            />
                        </div>
                    </div>
                </div>
                )}
            </div>
        </section>
    )
}