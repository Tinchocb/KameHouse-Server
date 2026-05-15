import { cn } from "@/components/ui/core/styling"
import { Skeleton } from "@/components/ui/skeleton"
import type { ContentTag } from "@/hooks/use-home-intelligence"
import { Flame, Info, Play, Sparkles, Star } from "lucide-react"
import * as React from "react"
import { motion } from "framer-motion"

// ─── Types ────────────────────────────────────────────────────────────────────

export interface HeroBannerItem {
    id: string
    title: string
    synopsis: string
    backdropUrl: string
    posterUrl?: string
    logoUrl?: string
    year?: string | number
    format?: string
    episodeCount?: number
    progress?: number
    /** Narrative arc name from IntelligenceService (e.g. "Saga de Cell") */
    arcName?: string
    /** Intelligence tag from backend */
    contentTag?: ContentTag
    /** 0–10 rating derived from LibraryMedia.Score */
    rating?: number
    /** Original numeric media ID — used for Quick Play resolution. */
    mediaId?: number
    /** Optional trailer URL for background video (MP4/H264) */
    trailerUrl?: string
    onPlay: () => void
    onMoreInfo: () => void
}

export interface HeroBannerProps {
    items: HeroBannerItem[]
    initialIndex?: number
    autoRotateMs?: number
    className?: string
}

// ─── Utility hook ─────────────────────────────────────────────────────────────

function usePrefersReducedMotion() {
    const [prefersReducedMotion, setPrefersReducedMotion] = React.useState(false)

    React.useEffect(() => {
        const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)")
        const update = () => setPrefersReducedMotion(mediaQuery.matches)
        update()
        mediaQuery.addEventListener("change", update)
        return () => mediaQuery.removeEventListener("change", update)
    }, [])

    return prefersReducedMotion
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function EpicChip({ tag }: { tag?: ContentTag }) {
    if (tag !== "EPIC" && tag !== "SPECIAL") return null
    return (
        <span
            className={cn(
                "inline-flex items-center gap-1 border rounded-md px-3 py-0.5",
                "text-[0.65rem] font-bold uppercase tracking-[0.22em]",
                "border-primary/30 bg-primary/10 text-primary",
            )}
        >
            {tag === "EPIC" ? <Flame className="h-2.5 w-2.5" /> : <Sparkles className="h-2.5 w-2.5" />}
            {tag === "EPIC" ? "Épico" : "Especial"}
        </span>
    )
}

function ArcChip({ arcName }: { arcName?: string }) {
    if (!arcName) return null
    return (
        <span className="inline-flex items-center border border-white/5 bg-white/5 rounded-md px-3 py-0.5 text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-zinc-300">
            {arcName}
        </span>
    )
}

function RatingRing({ rating }: { rating: number }) {
    if (rating < 7) return null
    return (
        <div className="flex items-center gap-1 text-[0.7rem] font-bold text-primary">
            <Star className="h-3 w-3 fill-current" />
            {rating.toFixed(1)}
        </div>
    )
}

// ─── Main component ────────────────────────────────────────────────────────────

export function HeroBanner({
    items,
    initialIndex = 0,
    autoRotateMs = 8000,
    className,
}: HeroBannerProps) {
    const prefersReducedMotion = usePrefersReducedMotion()
    const [activeIndex, setActiveIndex] = React.useState(initialIndex)
    const [isPaused, setIsPaused] = React.useState(false)
    const [isAutoPlaying, setIsAutoPlaying] = React.useState(true)
    
    // Parallax state
    const [mousePos, setMousePos] = React.useState({ x: 0, y: 0 })
    const handleMouseMove = React.useCallback((e: React.MouseEvent) => {
        if (prefersReducedMotion) return
        const { clientX, clientY } = e
        const { innerWidth, innerHeight } = window
        const x = (clientX / innerWidth - 0.5) * 20
        const y = (clientY / innerHeight - 0.5) * 20
        setMousePos({ x, y })
    }, [prefersReducedMotion])

    React.useEffect(() => {
        setTimeout(() => setActiveIndex(initialIndex), 0)
    }, [initialIndex])

    React.useEffect(() => {
        if (prefersReducedMotion || items.length <= 1 || isPaused || !isAutoPlaying) return

        const intervalId = window.setInterval(() => {
            setActiveIndex((current) => (current + 1) % items.length)
        }, autoRotateMs)

        return () => window.clearInterval(intervalId)
    }, [autoRotateMs, items.length, prefersReducedMotion, isPaused, isAutoPlaying])

    if (items.length === 0) return null

    const activeItem = items[activeIndex] ?? items[0]

    return (
        <section
            aria-label="Contenido destacado"
            onMouseEnter={() => setIsPaused(true)}
            onMouseLeave={() => {
                setIsPaused(false)
                setMousePos({ x: 0, y: 0 })
            }}
            onMouseMove={handleMouseMove}
            className={cn(
                "relative flex min-h-[720px] w-full items-end overflow-hidden bg-zinc-950",
                "h-[100dvh] max-h-[1100px]",
                className,
            )}
        >
            {/* ── Backdrop images ────────────────────────────────────────── */}
            <div 
                className="absolute inset-0 cursor-pointer"
                onClick={() => activeItem.onPlay()}
            >
                {items.map((item, index) => (
                    <div
                        key={item.id}
                        className={cn(
                            "absolute inset-0 transition-all duration-1000 ease-[cubic-bezier(0.23,1,0.32,1)]",
                            index === activeIndex ? "opacity-100 z-10 scale-100" : "opacity-0 z-0 scale-110",
                        )}
                    >
                        {item.trailerUrl && index === activeIndex ? (
                            <video
                                src={item.trailerUrl}
                                autoPlay
                                muted
                                loop
                                playsInline
                                className="h-full w-full object-cover object-center brightness-[0.35] saturate-[1.2] scale-105"
                            />
                        ) : (
                            <img
                                src={item.backdropUrl}
                                alt=""
                                aria-hidden="true"
                                className={cn(
                                    "h-full w-full object-cover object-center brightness-[0.35] saturate-[0.85]",
                                    index === activeIndex && "animate-ken-burns"
                                )}
                            />
                        )}
                    </div>
                ))}
            </div>

            {/* Overlays */}
            <div className="absolute inset-0 bg-gradient-to-r from-zinc-950 via-zinc-950/40 to-transparent pointer-events-none z-20" />
            <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-zinc-950 via-zinc-950/80 to-transparent pointer-events-none z-20" />
            
            {/* ── Content ───────────────────────────────────────────────── */}
            <div className="relative z-30 mx-auto flex w-full max-w-[1920px] flex-col justify-end gap-12 px-6 pb-20 pt-36 md:px-12 lg:px-20 lg:pb-24 xl:flex-row xl:items-end xl:justify-between">
                
                {/* Left: Metadata + Title + CTAs */}
                <div className="flex-1 max-w-5xl">
                    <motion.div 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        key={`meta-${activeItem.id}`}
                        transition={{ duration: 0.8, ease: [0.23, 1, 0.32, 1] }}
                        className="mb-8 flex flex-wrap items-center gap-4"
                    >
                        <EpicChip tag={activeItem.contentTag} />
                        <ArcChip arcName={activeItem.arcName} />
                        
                        <div className="flex items-center gap-4 text-[0.65rem] font-medium tracking-[0.2em] text-zinc-500 uppercase">
                            {activeItem.rating !== undefined && <RatingRing rating={activeItem.rating} />}
                            {activeItem.rating !== undefined && <div className="h-1 w-1 rounded-full bg-white/20" />}
                            {activeItem.format && <span>{activeItem.format}</span>}
                            {activeItem.format && <div className="h-1 w-1 rounded-full bg-white/20" />}
                            {activeItem.year && <span>{activeItem.year}</span>}
                        </div>
                    </motion.div>

                    <motion.div 
                        key={`title-${activeItem.id}`}
                        initial={{ opacity: 0, x: -40 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 1, ease: [0.23, 1, 0.32, 1] }}
                        className="relative mb-10 group/title cursor-pointer"
                        onClick={() => activeItem.onPlay()}
                        style={{
                            transform: `translate3d(${mousePos.x * 0.5}px, ${mousePos.y * 0.5}px, 0)`,
                        }}
                    >
                        {activeItem.logoUrl ? (
                            <img
                                src={activeItem.logoUrl}
                                alt={activeItem.title}
                                className="max-h-32 md:max-h-48 max-w-full object-contain object-left group-hover/title:scale-[1.02] transition-transform duration-700"
                            />
                        ) : (
                            <h1 className="font-bebas text-[7rem] md:text-[10rem] lg:text-[14rem] leading-[0.75] tracking-tight text-white uppercase drop-shadow-2xl">
                                {activeItem.title}
                            </h1>
                        )}
                    </motion.div>

                    <motion.p 
                        key={`synopsis-${activeItem.id}`}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 0.8 }}
                        transition={{ delay: 0.3, duration: 1 }}
                        className="line-clamp-3 max-w-2xl text-lg md:text-xl leading-relaxed text-zinc-300 mb-12"
                    >
                        {activeItem.synopsis || "Sinopsis no disponible."}
                    </motion.p>

                    <div className="flex flex-wrap items-center gap-6">
                        <motion.button
                            whileHover={{ scale: 1.02, backgroundColor: "rgb(var(--primary-hover))" }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => activeItem.onPlay()}
                            className="group/btn relative flex items-center justify-center gap-4 bg-primary text-white h-16 md:h-18 px-12 rounded-2xl font-bebas text-2xl uppercase tracking-[0.1em] transition-all shadow-[0_20px_40px_-12px_rgba(var(--primary-rgb),0.4)]"
                        >
                            <Play className="w-5 h-5 fill-current" />
                            <span>REPRODUCIR</span>
                        </motion.button>

                        <motion.button
                            whileHover={{ scale: 1.02, backgroundColor: "rgba(255,255,255,0.05)" }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => activeItem.onMoreInfo()}
                            className="group/btn relative flex items-center justify-center gap-4 bg-transparent text-zinc-300 h-16 md:h-18 px-12 rounded-2xl font-bebas text-2xl uppercase tracking-[0.1em] transition-all border border-white/10"
                        >
                            <Info className="w-5 h-5" />
                            <span>DETALLES</span>
                        </motion.button>
                    </div>
                </div>

                {/* Right: Premium Glass Poster */}
                <div className="hidden xl:flex flex-col items-center gap-8 w-[400px]">
                    <motion.div
                        key={`poster-${activeItem.id}`}
                        initial={{ opacity: 0, scale: 0.9, rotateY: 20 }}
                        animate={{ opacity: 1, scale: 1, rotateY: 0 }}
                        transition={{ duration: 1.2, ease: [0.23, 1, 0.32, 1] }}
                        style={{
                            perspective: "1000px",
                            transform: `translate3d(${mousePos.x}px, ${mousePos.y}px, 0) rotateX(${-mousePos.y * 0.1}deg) rotateY(${mousePos.x * 0.1}deg)`,
                        }}
                        className="relative w-full group/poster cursor-pointer"
                        onClick={() => activeItem.onMoreInfo()}
                    >
                        <div className="relative aspect-[2/3] w-full overflow-hidden rounded-[32px] border border-white/10 bg-zinc-900/40 backdrop-blur-3xl shadow-[0_40px_80px_-20px_rgba(0,0,0,0.8)] transition-all duration-700 group-hover/poster:border-primary/50 group-hover/poster:shadow-primary/10">
                            {activeItem.posterUrl ? (
                                <img
                                    src={activeItem.posterUrl}
                                    alt={activeItem.title}
                                    className="h-full w-full object-cover transition-transform duration-700 group-hover/poster:scale-105"
                                />
                            ) : (
                                <div className="h-full w-full bg-zinc-900" />
                            )}
                            
                            {/* Inner Glass Glow */}
                            <div className="absolute inset-0 bg-gradient-to-tr from-zinc-950/40 via-transparent to-white/5 pointer-events-none" />
                        </div>

                        {/* Progress Bar (if available) */}
                        {activeItem.progress !== undefined && (
                            <div className="absolute -bottom-4 left-6 right-6 z-40 bg-zinc-900/80 backdrop-blur-xl border border-white/5 rounded-2xl p-4 shadow-2xl">
                                <div className="flex items-center justify-between text-[0.6rem] font-bold uppercase tracking-[0.2em] text-zinc-500 mb-2">
                                    <span>Continuar</span>
                                    <span className="text-primary">{Math.round(activeItem.progress)}%</span>
                                </div>
                                <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                                    <motion.div 
                                        initial={{ width: 0 }}
                                        animate={{ width: `${activeItem.progress}%` }}
                                        transition={{ duration: 1, ease: "circOut" }}
                                        className="h-full bg-primary"
                                    />
                                </div>
                            </div>
                        )}
                    </motion.div>
                </div>
            </div>

            {/* ── Progress Indicators (Navigation) ─────────────────────────── */}
            <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3">
                {items.map((item, idx) => (
                    <button
                        key={item.id}
                        onClick={() => {
                            setActiveIndex(idx)
                            setIsAutoPlaying(false)
                        }}
                        className="group relative py-4"
                    >
                        <div className={cn(
                            "h-[2px] rounded-full transition-all duration-700",
                            activeIndex === idx ? "w-16 bg-primary" : "w-8 bg-white/10 group-hover:bg-white/30"
                        )}>
                            {activeIndex === idx && isAutoPlaying && (
                                <motion.div 
                                    initial={{ width: 0 }}
                                    animate={{ width: "100%" }}
                                    transition={{ duration: autoRotateMs / 1000, ease: "linear" }}
                                    className="h-full bg-white/40"
                                />
                            )}
                        </div>
                    </button>
                ))}
            </div>
        </section>
    )
}

export function HeroBannerSkeleton({ className }: { className?: string }) {
    return (
        <section
            className={cn(
                "relative h-[100dvh] w-full overflow-hidden bg-zinc-950",
                className,
            )}
        >
            <div className="absolute inset-0 flex items-center px-12 md:px-20">
                <div className="z-10 w-full max-w-3xl">
                    <div className="flex gap-4">
                        <Skeleton className="h-6 w-24 bg-white/5" />
                        <Skeleton className="h-6 w-32 bg-white/5" />
                    </div>
                    <Skeleton className="mt-10 h-32 w-full bg-white/5" />
                    <div className="mt-12 space-y-3">
                        <Skeleton className="h-4 w-full bg-white/5" />
                        <Skeleton className="h-4 w-5/6 bg-white/5" />
                    </div>
                    <div className="mt-16 flex gap-6">
                        <Skeleton className="h-16 w-48 rounded-2xl bg-white/5" />
                        <Skeleton className="h-16 w-48 rounded-2xl bg-white/5" />
                    </div>
                </div>
            </div>
        </section>
    )
}

