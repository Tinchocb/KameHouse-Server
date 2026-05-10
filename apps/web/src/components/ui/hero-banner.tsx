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
                "border-brand-orange/30 bg-brand-orange/15 text-brand-orange",
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
        <div className="flex items-center gap-1 text-[0.7rem] font-bold text-brand-orange">
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
    
    // Parallax state
    const [mousePos, setMousePos] = React.useState({ x: 0, y: 0 })
    const handleMouseMove = React.useCallback((e: React.MouseEvent) => {
        if (prefersReducedMotion) return
        const { clientX, clientY } = e
        const { innerWidth, innerHeight } = window
        const x = (clientX / innerWidth - 0.5) * 20 // Max 20px offset
        const y = (clientY / innerHeight - 0.5) * 20
        setMousePos({ x, y })
    }, [prefersReducedMotion])

    React.useEffect(() => {
        setActiveIndex(initialIndex)
    }, [initialIndex])

    React.useEffect(() => {
        if (prefersReducedMotion || items.length <= 1 || isPaused) return

        const intervalId = window.setInterval(() => {
            setActiveIndex((current) => (current + 1) % items.length)
        }, autoRotateMs)

        return () => window.clearInterval(intervalId)
    }, [autoRotateMs, items.length, prefersReducedMotion, isPaused])

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
                "relative flex min-h-[720px] w-full items-end overflow-hidden bg-background",
                "h-[100dvh] max-h-[1100px]",
                className,
            )}
        >
            {/* ── Backdrop images ────────────────────────────────────────── */}
            <div 
                className="absolute inset-x-[-20px] inset-y-[-20px]"
                style={{
                    transform: `translate3d(${mousePos.x}px, ${mousePos.y}px, 0)`,
                    transition: isPaused ? "none" : "transform 0.2s ease-out",
                }}
            >
                {items.map((item, index) => (
                    <div
                        key={item.id}
                        className={cn(
                            "absolute inset-0 transition-opacity duration-1000 ease-in-out",
                            index === activeIndex ? "opacity-100 z-10" : "opacity-0 z-0",
                        )}
                    >
                        <img
                            src={item.backdropUrl}
                            alt=""
                            aria-hidden="true"
                            className={cn(
                                "h-full w-full object-cover object-center brightness-[0.4] saturate-[0.85]",
                                index === activeIndex && "animate-ken-burns"
                            )}
                        />
                    </div>
                ))}
            </div>

            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.03),transparent_45%)]" />
            
            <div className="absolute inset-0 bg-gradient-to-r from-background via-background/40 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent opacity-90" />
            
            {/* The Perfect Fade to Black: seamless transition to the body bg */}
            <div className="absolute inset-x-0 bottom-0 h-[60%] bg-gradient-to-t from-background via-background/90 to-transparent" />

            {/* ── Content ───────────────────────────────────────────────── */}
            <div className="relative z-10 mx-auto flex w-full max-w-[1680px] flex-col justify-end gap-6 px-6 pb-16 pt-36 md:px-10 lg:px-14 lg:pb-20 xl:flex-row xl:items-end xl:justify-between">
                {/* Left: metadata + CTAs */}
                <div className="max-w-3xl">
                    {/* Intelligence chips + meta strip */}
                    <div className="mb-5 flex flex-wrap items-center gap-2">
                        <EpicChip tag={activeItem.contentTag} />
                        <ArcChip arcName={activeItem.arcName} />
                        {activeItem.rating !== undefined && <RatingRing rating={activeItem.rating} />}
                        {activeItem.format && (
                            <span className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-zinc-500">
                                {activeItem.format}
                            </span>
                        )}
                        {activeItem.year !== undefined && (
                            <span className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-zinc-500">
                                {activeItem.year}
                            </span>
                        )}
                        {activeItem.episodeCount !== undefined && (
                            <span className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-zinc-500">
                                {activeItem.episodeCount} ep.
                            </span>
                        )}
                    </div>

                    {/* Title or logo */}
                    {activeItem.logoUrl ? (
                        <img
                            src={activeItem.logoUrl}
                            alt={activeItem.title}
                            className="mb-6 max-h-28 max-w-[min(32rem,80vw)] object-contain object-left hover:scale-[1.02] transition-transform duration-300 cursor-pointer"
                        />
                    ) : (
                        <h1 className="mb-4 max-w-4xl font-bebas font-normal leading-[0.85] tracking-normal text-white text-[4.5rem] md:text-[6.5rem] xl:text-[8rem] uppercase">
                            {activeItem.title}
                        </h1>
                    )}

                    <p className="line-clamp-3 max-w-2xl text-base leading-7 text-zinc-300 md:text-lg">
                        {activeItem.synopsis || "Sinopsis no disponible."}
                    </p>

                    {/* CTAs */}
                    <div className="mt-8 flex flex-wrap items-center gap-4">
                        <motion.button
                            whileHover={{ 
                                scale: 1.05, 
                                backgroundColor: "var(--brand-orange-hover)",
                                boxShadow: "0 0 30px rgba(var(--primary-rgb), 0.4)"
                            }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => activeItem.onPlay()}
                            className="group/btn relative flex items-center justify-center gap-3 bg-brand-orange text-white h-12 md:h-14 px-8 rounded-2xl font-black text-sm uppercase tracking-[0.2em] transition-all shadow-xl shadow-primary/20 overflow-hidden border border-white/10"
                        >
                            <Play className="w-5 h-5 fill-current relative z-10 transition-transform group-hover/btn:scale-110" />
                            <span className="relative z-10">Ver ahora</span>
                            <div className="absolute inset-0 bg-gradient-to-tr from-white/20 to-transparent opacity-0 group-hover/btn:opacity-100 transition-opacity" />
                        </motion.button>

                        <motion.button
                            whileHover={{ 
                                scale: 1.05, 
                                backgroundColor: "rgba(255,255,255,0.08)",
                                borderColor: "rgba(255,255,255,0.3)",
                            }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => activeItem.onMoreInfo()}
                            className="flex items-center justify-center gap-3 bg-white/5 backdrop-blur-2xl text-white h-12 md:h-14 px-8 rounded-2xl font-black text-sm uppercase tracking-[0.2em] transition-all border border-white/10 hover:shadow-2xl"
                        >
                            <Info className="w-5 h-5" />
                            Detalles
                        </motion.button>
                    </div>
                </div>

                {/* Right: glass poster (xl only) */}
                <div className="hidden w-full max-w-sm xl:block">
                    <div className="border border-white/5 bg-[#0a0e1a]/40 p-4 rounded-2xl shadow-2xl backdrop-blur-md">
                        {activeItem.posterUrl ? (
                            <div className="relative">
                                <img
                                    src={activeItem.posterUrl}
                                    alt={activeItem.title}
                                    className="aspect-[2/3] w-full object-cover rounded-xl transition-all duration-500 hover:scale-[1.02]"
                                />
                            </div>
                        ) : (
                            <div className="aspect-[2/3] w-full bg-zinc-900 rounded-xl" />
                        )}

                        {activeItem.progress !== undefined && (
                            <div className="mt-4">
                                <div className="mb-2 flex items-center justify-between text-[0.7rem] uppercase tracking-[0.18em] text-zinc-400">
                                    <span>Continuar viendo</span>
                                    <span>{Math.round(activeItem.progress)}%</span>
                                </div>
                                <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-gradient-to-r from-brand-orange to-amber-500"
                                        style={{
                                            width: `${Math.min(100, Math.max(0, activeItem.progress))}%`,
                                        }}
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* ── Dot navigation ────────────────────────────────────────── */}
            {items.length > 1 && (
                <div className="absolute bottom-8 left-6 z-10 flex items-center gap-2 md:left-10 lg:left-14">
                    {items.map((item, index) => (
                        <button
                            key={item.id}
                            type="button"
                            aria-label={`Mostrar ${item.title}`}
                            aria-pressed={index === activeIndex}
                            onClick={() => setActiveIndex(index)}
                            className={cn(
                                "h-1.5 rounded-full bg-white/20 transition-all duration-300 motion-reduce:transition-none",
                                index === activeIndex ? "w-10 bg-brand-orange" : "w-4 hover:bg-white/50",
                            )}
                        />
                    ))}
                </div>
            )}
        </section>
    )
}

export function HeroBannerSkeleton({ className }: { className?: string }) {
    return (
        <section
            className={cn(
                "relative h-[480px] w-full overflow-hidden bg-background md:h-[580px] lg:h-[680px]",
                className,
            )}
        >
            <div className="absolute inset-0 flex items-center px-6 md:px-10 lg:px-14">
                <div className="z-10 w-full max-w-2xl">
                    <div className="flex flex-wrap items-center gap-3">
                        <Skeleton className="h-6 w-24 rounded-md" />
                        <Skeleton className="h-6 w-32 rounded-md" />
                    </div>

                    <Skeleton className="mt-6 h-12 w-3/4 md:h-16 lg:h-20 rounded-xl" />

                    <div className="mt-4 flex flex-wrap items-center gap-4">
                        <Skeleton className="h-4 w-16 rounded-md" />
                        <Skeleton className="h-4 w-16 rounded-md" />
                        <Skeleton className="h-4 w-16 rounded-md" />
                    </div>

                    <div className="mt-6 space-y-2">
                        <Skeleton className="h-4 w-full rounded-md" />
                        <Skeleton className="h-4 w-5/6 rounded-md" />
                        <Skeleton className="h-4 w-4/6 rounded-md" />
                    </div>

                    <div className="mt-10 flex flex-wrap items-center gap-4">
                        <Skeleton className="h-12 w-40 rounded-xl" />
                        <Skeleton className="h-12 w-40 rounded-xl" />
                    </div>
                </div>
            </div>
        </section>
    )
}
