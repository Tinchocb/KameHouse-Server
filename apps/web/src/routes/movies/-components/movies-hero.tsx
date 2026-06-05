import { useState, useEffect, useMemo, useRef } from "react"
import { motion, AnimatePresence, useScroll, useTransform } from "framer-motion"
import { Clock, Star } from "lucide-react"
import type { Anime_LibraryCollectionEntry } from "@/api/generated/types"
import { ERA_TABS, EraTab, cleanMovieTitle } from "../-MovieCard"
import { cn } from "@/components/ui/core/styling"
import { useIntelligenceStore } from "@/hooks/use-home-intelligence"

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
    const heroRef = useRef<HTMLDivElement>(null)
    const setBackdropUrl = useIntelligenceStore((s) => s.setBackdropUrl)

    const { scrollY } = useScroll()
    const heroOpacity = useTransform(scrollY, [0, 340], [1, 0])
    const heroScale = useTransform(scrollY, [0, 340], [1, 1.05])

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
    const backdropSrc = displayMedia?.bannerImage ?? null

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
        <div
            ref={heroRef}
            className="relative h-[40vh] md:h-[50vh] min-h-[300px] md:min-h-[380px] overflow-hidden border-b border-zinc-900"
            onMouseEnter={() => setIsHeroHovered(true)}
            onMouseLeave={() => setIsHeroHovered(false)}
        >
            {/* Desktop: Dynamic Ambient Cover Glow behind the card */}
            <div className="hidden md:block absolute right-14 top-[12.5%] h-[75%] md:aspect-[16/9] z-0 pointer-events-none select-none">
                <AnimatePresence mode="wait">
                    {backdropSrc && (
                        <motion.img
                            key={backdropSrc}
                            src={backdropSrc}
                            alt=""
                            initial={{ opacity: 0, scale: 1.1 }}
                            animate={{ opacity: 0.35, scale: 1.25 }}
                            exit={{ opacity: 0, scale: 1.1 }}
                            transition={{ duration: 0.8 }}
                            className="w-full h-full object-cover filter blur-[32px] md:blur-[40px] rounded-2xl"
                        />
                    )}
                </AnimatePresence>
            </div>

            {/* Backdrop Banner / Floating Poster */}
            <motion.div
                className="absolute inset-0 md:inset-auto md:right-14 md:top-[12.5%] md:h-[75%] md:aspect-[16/9] z-0 md:z-10 flex flex-col items-center justify-center pointer-events-none"
                style={{ scale: heroScale, opacity: heroOpacity }}
            >
                <div className="relative w-full h-full rounded-none md:rounded-2xl overflow-hidden md:border md:border-white/10 md:shadow-[0_25px_60px_rgba(0,0,0,0.85)] bg-[#0a0a0c]">
                    <AnimatePresence mode="wait">
                        {backdropSrc && (
                            <motion.img
                                key={backdropSrc}
                                src={backdropSrc}
                                alt={displayMedia?.titleSpanish || displayMedia?.titleEnglish || ""}
                                initial={{ opacity: 0, scale: 0.96 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.96 }}
                                transition={{ duration: 0.5 }}
                                className="w-full h-full object-cover opacity-30 md:opacity-100"
                            />
                        )}
                    </AnimatePresence>
                </div>

                {/* Desktop Slider Dots (Centered directly under the card) */}
                {topFeatured.length > 1 && (
                    <div className="hidden md:flex items-center gap-1.5 mt-4 pointer-events-auto">
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
            </motion.div>

            {/* Mobile: Bottom fade overlay for text readability over full background image */}
            <div
                className="block md:hidden absolute inset-0 z-10 pointer-events-none"
                style={{
                    background: "linear-gradient(to top, #07070a 0%, rgba(7,7,10,0.85) 50%, transparent 100%)",
                }}
            />
            <div
                className="absolute top-0 left-0 right-0 h-[1px] transition-colors duration-700 z-20"
                style={{ background: `linear-gradient(90deg, transparent, ${currentEraConfig.color}60, transparent)` }}
            />

            {/* Hero content */}
            <div className="relative h-full flex flex-col justify-center px-6 md:px-14 max-w-[1700px] mx-auto w-full z-20 pointer-events-none">
                <div className="max-w-xs md:max-w-xl h-[230px] md:h-[270px] flex flex-col justify-between items-start pointer-events-auto">
                    <div className="flex flex-col items-start w-full">
                        {/* Título Cinematográfico */}
                        <AnimatePresence mode="wait">
                            <motion.h1
                                key={displayMedia?.id ?? "default"}
                                initial={{ opacity: 0, y: 12 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -12 }}
                                transition={{ duration: 0.3 }}
                                className="font-bebas text-3xl md:text-5xl tracking-wider leading-tight text-white mb-2 uppercase drop-shadow-[0_4px_12px_rgba(0,0,0,0.9)]"
                            >
                                {displayMedia
                                    ? cleanMovieTitle(displayMedia.titleSpanish ?? displayMedia.titleEnglish ?? displayMedia.titleRomaji)
                                    : "Películas"}
                            </motion.h1>
                        </AnimatePresence>

                        {/* Metadatos de la Cinta seleccionada */}
                        {displayMedia && (
                            <AnimatePresence mode="wait">
                                <motion.div
                                    key={displayMedia.id}
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    transition={{ duration: 0.25 }}
                                    className="flex flex-wrap items-center gap-3 mb-3 text-[11px] font-mono"
                                >
                                    {displayMedia.year ? (
                                        displayMedia.year > 0 && (
                                            <span className="bg-white/5 border border-white/10 rounded px-2.5 py-0.5 text-white/95">
                                                {displayMedia.year}
                                            </span>
                                        )
                                    ) : null}
                                    {displayMedia.runtime ? (
                                        displayMedia.runtime > 0 && (
                                            <span className="flex items-center gap-1 text-white/50">
                                                <Clock className="w-3.5 h-3.5" />
                                                {displayMedia.runtime} MIN
                                            </span>
                                        )
                                    ) : null}
                                    {displayMedia.score ? (
                                        displayMedia.score > 0 && (
                                            <span className="flex items-center gap-1 text-amber-400">
                                                <Star className="w-3.5 h-3.5 fill-current" />
                                                {(displayMedia.score / 10).toFixed(1)} OUT OF 10
                                            </span>
                                        )
                                    ) : null}
                                </motion.div>
                            </AnimatePresence>
                        )}

                        {/* Sinopsis */}
                        {displayMedia?.description && (
                            <AnimatePresence mode="wait">
                                <motion.p
                                    key={displayMedia.id}
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    transition={{ duration: 0.25 }}
                                    className="text-xs md:text-sm leading-relaxed text-zinc-400 mb-4 line-clamp-2 max-w-xs md:max-w-lg font-sans text-justify"
                                    dangerouslySetInnerHTML={{ __html: displayMedia.description }}
                                />
                            </AnimatePresence>
                        )}
                    </div>

                    <div className="flex flex-col items-start w-full">
                        {/* Action Buttons (Netflix Style) */}
                        {currentMovie && (
                            <div className="flex items-center gap-3 mt-2">
                                <button
                                    onClick={() => handleMovieClick(currentMovie.mediaId!)}
                                    className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-orange-600 hover:bg-orange-500 text-white font-mono font-bold text-xs uppercase tracking-widest transition-all shadow-[0_4px_12px_rgba(234,88,12,0.3)] hover:scale-[1.02] active:scale-[0.98]"
                                >
                                    ▶ VER AHORA
                                </button>
                            </div>
                        )}

                        {/* Puntos de Navegación del Slider (Sólo Móvil) */}
                        {topFeatured.length > 1 && (
                            <div className="flex md:hidden items-center gap-1.5 mt-4">
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
        </div>
    )
}
