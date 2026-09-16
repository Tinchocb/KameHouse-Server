import * as React from "react"
import { useState, useEffect, useCallback, useMemo } from "react"
import { motion, AnimatePresence, useReducedMotion, type Variants } from "framer-motion"
import { IconUiCheck, IconMediaPlay, IconUiPlus, IconUiInfo, IconNavigationChevronLeft, IconNavigationChevronRight } from "@/components/ui/icons";
import type { Continuity_WatchHistory } from "@/api/generated/types"
import { cleanMovieTitle } from "../-MovieCard"
import type { MovieEntry } from "../index"
import { ERAS, ERA_COLOR_MAP, type EraId } from "@/lib/config/eras"
import { SpotlightEraNav } from "@/components/ui/spotlight/spotlight-era-nav"
import type { SwimlaneItem } from "@/components/ui/swimlane"
import { useHeroBackdrop } from "@/hooks/use-hero"
import { stripHtml } from "@/lib/helpers/sanitizer"
import { getLargeResImage, getMediumResImage, getLowResImage } from "@/lib/helpers/images"
import { DeferredImage } from "@/components/shared/deferred-image"
import { useAppStore } from "@/lib/store"
import { usePerformanceStore, selectIsHeavyEffectsAllowed } from "@/lib/hardware/performance-store"
import { fetchAnimeEntry } from "@/api/hooks/anime_entries.hooks"
import { toast } from "sonner"
import { MediaMetadataCapsule } from "@/components/ui/media-metadata-capsule"
import { getMovieLore, getEntryTitle, getLoreDescription } from "./movies-utils"

interface MoviesHeroProps {
    topFeatured: MovieEntry[]
    debouncedMovie: MovieEntry | null
    handleMovieClick: (mediaId: number) => void
    watchHistory?: Continuity_WatchHistory
    activeEraId: EraId | "all"
    categorizedData: Record<EraId, { series: SwimlaneItem | null; movies: SwimlaneItem[] }>
    onSelectEra: (eraId: EraId) => void
    onHoverSound: () => void
}

const ROTATION_INTERVAL_MS = 8000

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
        transition: { type: "spring", stiffness: 420, damping: 28 }
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
}: MoviesHeroProps) {
    const [featuredIndex, setFeaturedIndex] = useState(0)
    const [isHeroHovered, setIsHeroHovered] = useState(false)
    const isHeavyAllowed = usePerformanceStore(selectIsHeavyEffectsAllowed)
    const reduceMotion = useReducedMotion()
    const tvMode = useAppStore(s => s.tvMode)
    // Halo garantizado por color de era (como Inicio): la animación solo en
    // equipos capaces y sin reduced-motion/TV; en el resto se muestra un orbe
    // estático barato para que los backdrops oscuros no queden sin halo.
    const showAnimatedOrb = isHeavyAllowed && !reduceMotion && !tvMode

    // Reset index on collection change
    useEffect(() => {
        setFeaturedIndex(0)
    }, [topFeatured])

    // Auto-slide rotation interval
    useEffect(() => {
        if (reduceMotion || isHeroHovered || debouncedMovie || topFeatured.length <= 1) return

        const interval = setInterval(() => {
            if (document.visibilityState === "hidden") return
            setFeaturedIndex((p) => (p + 1) % topFeatured.length)
        }, ROTATION_INTERVAL_MS)

        return () => clearInterval(interval)
    }, [reduceMotion, isHeroHovered, debouncedMovie, topFeatured.length])

    const handleSelectSlide = useCallback((index: number) => {
        setFeaturedIndex(index)
    }, [])

    const handlePrev = useCallback((e?: React.MouseEvent) => {
        e?.stopPropagation()
        setFeaturedIndex((p) => (p - 1 + topFeatured.length) % topFeatured.length)
    }, [topFeatured.length])

    const handleNext = useCallback((e?: React.MouseEvent) => {
        e?.stopPropagation()
        setFeaturedIndex((p) => (p + 1) % topFeatured.length)
    }, [topFeatured.length])

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

    const backdropSrc = displayMedia?.bannerImage ?? displayMedia?.posterImage ?? null
    const posterSrc = displayMedia?.posterImage ?? displayMedia?.bannerImage ?? null
    // Global solo con banner 16:9 (como Inicio con arte de era): el póster
    // vertical embarra el DynamicBackdrop y los backdrops oscuros lo dejan
    // negro sobre negro. Sin banner, el global cae a orbes de era.
    const bannerSrc = displayMedia?.bannerImage ?? null

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
                useAppStore.getState().addToQueue({
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

    if (!currentMovie) return null

    return (
        <section
            onMouseEnter={() => setIsHeroHovered(true)}
            onMouseLeave={() => setIsHeroHovered(false)}
            aria-label="Película destacada"
            className="relative w-full max-w-content mx-auto px-4 sm:px-6 md:px-8 lg:px-10 pt-4 md:pt-20 pb-8 select-none flex flex-col justify-start space-y-4"
        >
            {/* Ambient Aura Background */}
            <div className="absolute top-0 inset-x-0 h-[500px] sm:h-[560px] md:h-[640px] lg:h-[680px] pointer-events-none overflow-hidden z-0 transform-gpu">
                {backdropSrc && (
                    <motion.div
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
                            filter: "blur(72px) saturate(140%)",
                            opacity: 0.32,
                            maskImage: "radial-gradient(ellipse 90% 80% at 70% 40%, black 0%, transparent 75%)",
                            WebkitMaskImage: "radial-gradient(ellipse 90% 80% at 70% 40%, black 0%, transparent 75%)",
                        }}
                    />
                )}

                {showAnimatedOrb && (
                    <motion.div
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
                <div
                    className="w-full relative rounded-3xl overflow-hidden min-h-[440px] sm:min-h-[500px] md:min-h-[540px] lg:min-h-[580px] flex flex-col justify-end border border-outline-variant shadow-[0_25px_60px_-15px_rgba(0,0,0,0.95)] bg-[var(--bg-primary)] transition-colors duration-700"
                    style={{
                        borderColor: `color-mix(in srgb, ${currentColors.accent} 25%, rgba(255,255,255,0.12))`
                    }}
                >
                    {/* Full Stage Theatrical Visual with cinematic blend */}
                    <AnimatePresence mode="popLayout">
                        <motion.div
                            key={currentMovie.mediaId + "_visual"}
                            initial={{ opacity: 0, scale: 1.04 }}
                            animate={{ opacity: 1, scale: 1, transition: { duration: 0.7, ease: "easeOut" } }}
                            exit={{ opacity: 0, transition: { duration: 0.3 } }}
                            className="absolute inset-0 w-full h-full pointer-events-none overflow-hidden z-0"
                        >
                            {(backdropSrc || posterSrc) && (
                                <DeferredImage
                                    src={backdropSrc ? (backdropSrc.startsWith("/") ? backdropSrc : getLargeResImage(backdropSrc)) : (posterSrc!.startsWith("/") ? posterSrc! : getLargeResImage(posterSrc!))}
                                    alt={movieTitle}
                                    priority={true}
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

                    {/* Content Overlay (idéntico padding y ritmo que Home) */}
                    <div className="relative z-20 flex flex-col justify-end p-5 sm:p-6 md:p-7 space-y-2.5 w-full pointer-events-none">
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={currentMovie.mediaId + "_content"}
                                variants={heroContentContainerVariants}
                                initial="hidden"
                                animate="visible"
                                exit="exit"
                                className="flex flex-col space-y-2.5 transform-gpu will-change-transform text-left w-full pointer-events-auto max-w-2xl"
                            >
                                {/* Unified Metadata Capsule */}
                                <MediaMetadataCapsule
                                    format={displayMedia?.format || "PELÍCULA"}
                                    year={displayMedia?.year}
                                    duration={displayMedia?.runtime ? `${displayMedia.runtime} MIN` : null}
                                    rating={displayMedia?.score ? (displayMedia.score / 10) : undefined}
                                    variants={heroItemVariants}
                                >
                                    {/* Era Badge Thematic Context (Identidad cinematográfica de la Era) */}
                                    <span
                                        className="text-[10px] font-mono font-black tracking-wider px-2 py-0.5 rounded uppercase flex items-center border"
                                        style={{
                                            color: currentColors.accent,
                                            borderColor: `color-mix(in srgb, ${currentColors.accent} 45%, transparent)`,
                                            backgroundColor: `color-mix(in srgb, ${currentColors.accent} 16%, transparent)`,
                                        }}
                                    >
                                        {currentEraLabel}
                                    </span>
                                    {isCompleted && (
                                        <span className="bg-brand-success/20 text-brand-success text-[10px] font-mono font-bold tracking-wider px-2 py-0.5 rounded border border-brand-success/30 uppercase flex items-center gap-1">
                                            <IconUiCheck className="w-3 h-3" /> Visto
                                        </span>
                                    )}
                                    {hasProgress && (
                                        <span className="bg-brand-secondary/25 text-brand-secondary text-[10px] font-mono font-bold tracking-wider px-2 py-0.5 rounded border border-brand-secondary/35 uppercase">
                                            Reanudar ({progressPercent}%)
                                        </span>
                                    )}
                                </MediaMetadataCapsule>

                                {/* Movie Title with display font (mismo tamaño y altura de línea que Home) */}
                                <motion.h1
                                    variants={heroItemVariants}
                                    onClick={() => handleMovieClick(currentMovie.mediaId!)}
                                    className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight leading-[1.05] text-white uppercase select-none font-display cursor-pointer hover:text-brand-accent transition-colors text-edge-glow text-balance line-clamp-2"
                                >
                                    {movieTitle}
                                </motion.h1>

                                {/* Synopsis */}
                                {plainDescription && (
                                    <motion.p
                                        variants={heroItemVariants}
                                        className="text-on-surface text-xs sm:text-sm leading-relaxed font-normal select-none line-clamp-3 max-w-xl drop-shadow"
                                    >
                                        {plainDescription}
                                    </motion.p>
                                )}
                            </motion.div>
                        </AnimatePresence>

                        {/* ─── CINEJOY ACTION BUTTONS & CAROUSEL CONTROLS ──────── */}
                        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 w-full">
                            <div className="flex items-center gap-3">
                                {/* Primary Cinejoy Pill Button (Play / Reanudar) */}
                                <button
                                    onClick={() => handleMovieClick(currentMovie.mediaId!)}
                                    className="flex items-center justify-center bg-white text-zinc-950 font-black text-xs sm:text-sm uppercase tracking-wider py-2.5 px-6 sm:px-7 rounded-full font-display gap-2 cursor-pointer border border-white/40 border-t-white/80 border-b-white/20 shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.6),0_8px_24px_rgba(255,255,255,0.25)] hover:shadow-[0_12px_32px_rgba(255,255,255,0.35)] transition-all duration-200 hover:scale-[1.04] hover:-translate-y-px active:scale-95"
                                >
                                    <IconMediaPlay size={15} fill="currentColor" />
                                    <span>{hasProgress ? "Reanudar" : "Ver Película"}</span>
                                </button>

                                {/* Secondary Segmented Glass Capsule [ + Cola | ℹ Detalles ] */}
                                <div className="flex items-center rounded-full bg-zinc-950/45 border border-white/20 border-t-white/40 border-b-white/10 backdrop-blur-overlay-xl text-white shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.2)] overflow-hidden">
                                    <button
                                        onClick={handleAddToQueue}
                                        title="Añadir a la cola de reproducción"
                                        aria-label="Añadir a la cola"
                                        className="py-2.5 pl-4 pr-3 hover:bg-white/[0.08] text-zinc-300 hover:text-white cursor-pointer transition-colors flex items-center gap-1.5 text-xs sm:text-sm font-bold uppercase tracking-wider font-display rounded-l-full"
                                    >
                                        <IconUiPlus size={15} />
                                        <span className="hidden sm:inline">Cola</span>
                                    </button>

                                    <div className="w-[1px] h-4 bg-white/20" aria-hidden />

                                    <button
                                        onClick={() => handleMovieClick(currentMovie.mediaId!)}
                                        title="Ver detalles de la película"
                                        aria-label="Ver detalles"
                                        className="py-2.5 pr-4 pl-3 hover:bg-white/[0.08] text-zinc-300 hover:text-white cursor-pointer transition-colors flex items-center gap-1.5 text-xs sm:text-sm font-bold uppercase tracking-wider font-display rounded-r-full"
                                    >
                                        <IconUiInfo size={15} />
                                        <span>Detalles</span>
                                    </button>
                                </div>
                            </div>

                            {/* Cinejoy Carousel Indicators */}
                            {topFeatured.length > 1 && (
                                <div
                                    onClick={(e) => e.stopPropagation()}
                                    className="flex items-center gap-2 rounded-full bg-zinc-950/45 border border-white/20 border-t-white/40 border-b-white/10 backdrop-blur-overlay-2xl px-4 py-2 ml-auto shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.25),0_8px_20px_rgba(0,0,0,0.6)]"
                                >
                                    {topFeatured.length <= 10 ? (
                                        topFeatured.map((_, i) => {
                                            const isCurrent = i === featuredIndex
                                            return (
                                                <button
                                                    key={i}
                                                    onClick={() => handleSelectSlide(i)}
                                                    aria-label={`Ir a película ${i + 1}`}
                                                    className="relative h-1.5 rounded-full overflow-hidden transition-all duration-300 cursor-pointer"
                                                    style={{
                                                        width: isCurrent ? "1.85rem" : "0.5rem",
                                                        backgroundColor: "rgba(255,255,255,0.25)",
                                                    }}
                                                >
                                                    {isCurrent && (
                                                        <motion.div
                                                            key={featuredIndex}
                                                            className="h-full rounded-full bg-white"
                                                            initial={{ width: "0%" }}
                                                            animate={{ width: "100%" }}
                                                            transition={{ duration: ROTATION_INTERVAL_MS / 1000, ease: "linear" }}
                                                        />
                                                    )}
                                                </button>
                                            )
                                        })
                                    ) : (
                                        <div className="flex items-center gap-2 text-xs font-mono font-bold text-white">
                                            <button
                                                onClick={handlePrev}
                                                className="p-1 text-zinc-400 hover:text-white active:scale-90 transition-colors cursor-pointer"
                                                aria-label="Anterior"
                                            >
                                                <IconNavigationChevronLeft className="w-3.5 h-3.5" />
                                            </button>
                                            <span className="tracking-widest text-[11px]">
                                                <span className="text-on-surface font-black">
                                                    {String(featuredIndex + 1).padStart(2, "0")}
                                                </span>
                                                <span className="text-on-surface-variant/60 mx-1">/</span>
                                                <span>{String(topFeatured.length).padStart(2, "0")}</span>
                                            </span>
                                            <button
                                                onClick={handleNext}
                                                className="p-1 text-on-surface-variant hover:text-on-surface active:scale-90 transition-colors"
                                                aria-label="Siguiente"
                                            >
                                                <IconNavigationChevronRight className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </section>
    )
}