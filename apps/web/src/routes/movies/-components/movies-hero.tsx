import { useState, useEffect, useMemo, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Star, Play } from "lucide-react"
import type { Anime_LibraryCollectionEntry } from "@/api/generated/types"
import { ERA_TABS, EraTab, cleanMovieTitle } from "../-MovieCard"
import { cn } from "@/components/ui/core/styling"
import { useIntelligenceStore } from "@/hooks/use-home-intelligence"
import { getLowResImage, getHighResImage } from "@/lib/helpers/images"

interface MoviesHeroProps {
    topFeatured: (Anime_LibraryCollectionEntry & { era: EraTab; startedAtTimestamp: number })[]
    debouncedMovie: (Anime_LibraryCollectionEntry & { era: EraTab; startedAtTimestamp: number }) | null
    activeEraConfig: typeof ERA_TABS[0]
    handleMovieClick: (mediaId: number) => void
}

export function MoviesHero({
    topFeatured,
    debouncedMovie,
    activeEraConfig,
    handleMovieClick,
}: MoviesHeroProps) {
    const [featuredIndex, setFeaturedIndex] = useState(0)
    const [isHeroHovered, setIsHeroHovered] = useState(false)
    const heroRef = useRef<HTMLElement>(null)
    const backdropRef = useRef<HTMLDivElement>(null)
    const setBackdropUrl = useIntelligenceStore((s) => s.setBackdropUrl)

    // Parallax effect for the backdrop
    useEffect(() => {
        const handleScroll = (e: Event) => {
            if (!backdropRef.current) return
            const target = e.target
            if (target === document || target === window) {
                const scrolled = window.scrollY || document.documentElement.scrollTop
                backdropRef.current.style.transform = `translate3d(0, ${scrolled * 0.4}px, 0)`
            }
        }
        window.addEventListener("scroll", handleScroll, { capture: true, passive: true })
        return () => window.removeEventListener("scroll", handleScroll, { capture: true })
    }, [])

    // Auto-rotate active slide every 8s when not hovering the Hero
    useEffect(() => {
        if (isHeroHovered || topFeatured.length <= 1) return
        const id = setInterval(() => setFeaturedIndex((p) => (p + 1) % topFeatured.length), 8000)
        return () => clearInterval(id)
    }, [isHeroHovered, topFeatured])

    // Reset featured index when topFeatured changes significantly
    useEffect(() => {
        setFeaturedIndex(0)
    }, [topFeatured])

    const defaultFeatured = useMemo(() => topFeatured[featuredIndex] ?? topFeatured[0] ?? null, [topFeatured, featuredIndex])
    const currentMovie = debouncedMovie ?? defaultFeatured
    const displayMedia = currentMovie?.media
    const currentEraConfig = ERA_TABS.find((t) => t.value === currentMovie?.era) ?? activeEraConfig
    const backdropSrc = displayMedia?.bannerImage ?? displayMedia?.posterImage ?? null
    const posterSrc = displayMedia?.posterImage ?? null

    useEffect(() => {
        const bg = currentMovie?.media?.bannerImage || currentMovie?.media?.posterImage || null
        if (bg) {
            setBackdropUrl(bg)
        }
        return () => {
            setBackdropUrl(null)
        }
    }, [currentMovie, setBackdropUrl])

    return (
        <section
            ref={heroRef}
            className="relative w-full min-h-[45vh] md:min-h-[50vh] flex flex-col justify-center overflow-hidden bg-[#07070a] select-none"
            onMouseEnter={() => setIsHeroHovered(true)}
            onMouseLeave={() => setIsHeroHovered(false)}
        >
            {/* Cinematic Grain Overlay */}
            <div
                className="absolute inset-0 opacity-[0.025] pointer-events-none mix-blend-overlay z-20"
                style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }}
            />

            {/* Ambient Blur Background */}
            <div className="absolute inset-0 overflow-hidden bg-[#07070a] z-0">
                <AnimatePresence mode="wait">
                    {backdropSrc && (
                        <motion.div
                            key={backdropSrc + "_blur"}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 0.35 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.8 }}
                            className="absolute left-1/2 top-0 -translate-x-1/2 w-full h-full"
                            style={{
                                backgroundImage: `url(${getLowResImage(backdropSrc)})`,
                                backgroundSize: "cover",
                                backgroundPosition: "center 20%",
                                filter: "blur(130px) saturate(160%) brightness(0.2)",
                            }}
                        />
                    )}
                </AnimatePresence>
            </div>

            {/* High Res Crisp Parallax Backdrop with Ken Burns */}
            <div
                ref={backdropRef}
                className="absolute inset-y-0 right-0 w-full md:w-[85%] overflow-hidden z-0 will-change-transform group/backdrop"
                style={{
                    maskImage: "linear-gradient(to right, transparent 0%, black 35%, black 100%)",
                    WebkitMaskImage: "linear-gradient(to right, transparent 0%, black 35%, black 100%)"
                }}
            >
                <AnimatePresence mode="wait">
                    {backdropSrc && (
                        <motion.img
                            key={backdropSrc + "_main"}
                            src={getHighResImage(backdropSrc)}
                            alt={displayMedia?.titleSpanish || ""}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 0.8 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 1.5 }}
                            className="w-full h-full object-cover object-[center_15%] grayscale-[0.01] saturate-[115%] transition-all duration-700 ease-out group-hover/backdrop:opacity-90"
                        />
                    )}
                </AnimatePresence>
            </div>

            {/* Deep Cinematic Gradient Vignette Masking */}
            <div className="absolute inset-y-0 left-0 w-full md:w-1/2 bg-gradient-to-r from-[#07070a] via-[#07070a]/90 to-transparent opacity-100 z-10 pointer-events-none" />
            <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-[#07070a] via-[#07070a]/50 to-transparent opacity-100 z-10 pointer-events-none" />

            {/* Content Container */}
            <div className="relative z-20 w-full max-w-[1800px] mx-auto px-6 sm:px-12 flex flex-col pointer-events-none mt-8">
                <div className="max-w-3xl space-y-3 pointer-events-auto w-full">
                    
                    {/* Metadata Row */}
                    <div className="flex flex-wrap items-center text-zinc-300 text-[10px] font-semibold tracking-wide gap-y-1.5 min-h-[24px]">
                        <AnimatePresence mode="wait">
                            {displayMedia && (
                                <motion.div
                                    key={displayMedia.id + "_meta"}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -10 }}
                                    transition={{ duration: 0.3 }}
                                    className="flex items-center flex-wrap"
                                >
                                    {displayMedia.score ? (
                                        displayMedia.score > 0 && (
                                            <span className="flex items-center gap-1">
                                                <Star size={12} fill="currentColor" className="text-amber-500 stroke-none" />
                                                {(displayMedia.score / 10).toFixed(1)} Ki
                                            </span>
                                        )
                                    ) : null}
                                    {displayMedia.year ? (
                                        displayMedia.year > 0 && (
                                            <>
                                                {displayMedia.score && displayMedia.score > 0 && <span className="text-zinc-600 mx-2 select-none">|</span>}
                                                <span>{displayMedia.year}</span>
                                            </>
                                        )
                                    ) : null}
                                    {displayMedia.runtime ? (
                                        displayMedia.runtime > 0 && (
                                            <>
                                                {(displayMedia.score || displayMedia.year) && <span className="text-zinc-600 mx-2 select-none">|</span>}
                                                <span className="flex items-center gap-1">
                                                    {displayMedia.runtime} MIN
                                                </span>
                                            </>
                                        )
                                    ) : null}
                                    <span className="font-bold flex items-center gap-1.5" style={{ color: currentEraConfig.color, marginLeft: (displayMedia.score || displayMedia.year || displayMedia.runtime) ? '0.5rem' : '0' }}>
                                        {(displayMedia.score || displayMedia.year || displayMedia.runtime) && <span className="text-zinc-600 mr-2 select-none">|</span>}
                                        {currentEraConfig.label.toUpperCase()}
                                    </span>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* Titles */}
                    <div className="space-y-1 min-h-[40px]">
                        <AnimatePresence mode="wait">
                            <motion.h1
                                key={displayMedia?.id ?? "default"}
                                initial={{ opacity: 0, y: 15 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -15 }}
                                transition={{ duration: 0.4, ease: "easeOut" }}
                                className="text-[clamp(1.2rem,2.5vw,2rem)] font-sans font-extrabold leading-[1.05] tracking-tight text-white drop-shadow-[0_4px_25px_rgba(0,0,0,0.85)] cursor-pointer transition-colors duration-500 z-10 relative select-none uppercase"
                                style={{
                                    textShadow: `0 4px 25px ${currentEraConfig.color}40`
                                }}
                                onClick={() => currentMovie && handleMovieClick(currentMovie.mediaId!)}
                            >
                                {displayMedia
                                    ? cleanMovieTitle(displayMedia.titleSpanish ?? displayMedia.titleEnglish ?? displayMedia.titleRomaji)
                                    : "Películas"}
                            </motion.h1>
                        </AnimatePresence>
                    </div>

                    {/* Synopsis */}
                    <div className="min-h-[36px]">
                        <AnimatePresence mode="wait">
                            {displayMedia?.description && (
                                <motion.p
                                    key={displayMedia.id + "_desc"}
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    transition={{ duration: 0.4, delay: 0.1 }}
                                    className="text-zinc-300 text-[10px] md:text-xs leading-snug line-clamp-3 drop-shadow-md font-medium select-none max-w-xl border-l-[3px] pl-3 py-0.5 text-justify"
                                    style={{ borderColor: `${currentEraConfig.color}60` }}
                                    dangerouslySetInnerHTML={{ __html: displayMedia.description }}
                                />
                            )}
                        </AnimatePresence>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-col sm:flex-row sm:items-center gap-4 pt-1">
                        <AnimatePresence mode="wait">
                            {currentMovie && (
                                <motion.div
                                    key={currentMovie.mediaId + "_btn"}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -10 }}
                                    transition={{ duration: 0.4, delay: 0.2 }}
                                >
                                    <button
                                        onClick={() => handleMovieClick(currentMovie.mediaId!)}
                                        className="group/play relative flex items-center gap-2.5 px-4 py-2 text-white rounded-2xl overflow-hidden transition-all duration-500 hover:scale-105 active:scale-95 border border-white/10 w-fit"
                                        style={{
                                            background: `linear-gradient(to right, ${currentEraConfig.color}, ${currentEraConfig.color}dd)`,
                                            boxShadow: `0 12px 40px ${currentEraConfig.color}50`
                                        }}
                                    >
                                        {/* Glossy shine */}
                                        <div className="absolute inset-0 bg-gradient-to-tr from-white/20 via-transparent to-transparent opacity-0 group-hover/play:opacity-100 transition-opacity duration-500 z-0" />
                                        {/* Glow halo */}
                                        <div className="absolute -inset-10 blur-xl group-hover/play:opacity-100 opacity-0 transition-opacity duration-500 -z-10 animate-pulse" style={{ backgroundColor: currentEraConfig.color }} />

                                        <div className="p-2 bg-black/40 backdrop-blur-xl rounded-xl border border-white/10 text-white group-hover/play:bg-white group-hover/play:text-black transition-all duration-300 shadow-inner z-10 shrink-0">
                                            <Play className="w-3 h-3 fill-current" />
                                        </div>

                                        <div className="flex flex-col items-start z-10 select-none text-left">
                                            <span className="font-sans text-[10px] tracking-[0.15em] font-extrabold uppercase text-white transition-colors">
                                                Ver Ahora
                                            </span>
                                            <span className="text-[7px] font-black text-white/80 tracking-[0.1em] uppercase transition-colors mt-0.5">
                                                Película Completa
                                            </span>
                                        </div>
                                    </button>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Slider Navigation Dots */}
                        {topFeatured.length > 1 && (
                            <div className="flex items-center gap-2 mt-4 sm:mt-0">
                                {topFeatured.map((_, i) => (
                                    <button
                                        key={i}
                                        onClick={() => setFeaturedIndex(i)}
                                        className={cn(
                                            "h-1.5 rounded-full transition-all duration-300",
                                            i === featuredIndex ? "w-8" : "w-2 bg-white/20 hover:bg-white/40"
                                        )}
                                        style={i === featuredIndex ? { backgroundColor: currentEraConfig.color } : {}}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </section>
    )
}
