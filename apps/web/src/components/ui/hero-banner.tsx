import { cn } from "@/components/ui/core/styling"
import { Skeleton } from "@/components/ui/skeleton"
import { Info, Play } from "lucide-react"
import * as React from "react"
import { motion, AnimatePresence } from "framer-motion"

export interface HeroBannerItem {
    id: string
    title: string
    synopsis: string
    backdropUrl: string
    posterUrl?: string
    year?: string | number
    format?: string
    rating?: number
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

export function HeroBanner({
    items,
    initialIndex = 0,
    autoRotateMs = 8000,
    className,
}: HeroBannerProps) {
    const [activeIndex, setActiveIndex] = React.useState(initialIndex)
    const [isPaused, setIsPaused] = React.useState(false)

    React.useEffect(() => {
        if (items.length <= 1 || isPaused) return
        const interval = setInterval(() => {
            setActiveIndex((current) => (current + 1) % items.length)
        }, autoRotateMs)
        return () => clearInterval(interval)
    }, [autoRotateMs, items.length, isPaused])

    const activeItem = items[activeIndex]
    if (!activeItem) return null

    return (
        <section
            onMouseEnter={() => setIsPaused(true)}
            onMouseLeave={() => setIsPaused(false)}
            className={cn(
                "relative min-h-[700px] w-full items-end overflow-hidden bg-zinc-950",
                "h-[85dvh] max-h-[1000px]",
                className
            )}
        >
            {/* ── Background Layer ────────────────────────── */}
            <AnimatePresence mode="wait">
                <motion.div
                    key={activeItem.id}
                    initial={{ opacity: 0, scale: 1.1 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 1.5, ease: [0.23, 1, 0.32, 1] }}
                    className="absolute inset-0 z-0"
                >
                    <img
                        src={activeItem.backdropUrl}
                        alt=""
                        className="h-full w-full object-cover object-center brightness-[0.4] saturate-[0.8]"
                    />
                </motion.div>
            </AnimatePresence>

            {/* ── Gradients ───────────────────────────────── */}
            <div className="absolute inset-0 z-10 bg-gradient-to-t from-zinc-950 via-transparent to-transparent" />
            <div className="absolute inset-0 z-10 bg-gradient-to-t from-zinc-950/80 via-transparent to-transparent opacity-60" />
            <div className="absolute inset-0 z-10 bg-gradient-to-r from-zinc-950 via-zinc-950/20 to-transparent" />

            {/* ── Content ─────────────────────────────────── */}
            <div className="relative z-20 mx-auto h-full w-full max-w-[1800px] px-8 pb-48 md:px-16 flex flex-col justify-end">
                <div className="max-w-4xl space-y-8">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={activeItem.id}
                            initial={{ opacity: 0, y: 30 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            transition={{ duration: 0.8, ease: [0.23, 1, 0.32, 1] }}
                            className="space-y-6"
                        >
                            {/* Metadata */}
                            <div className="flex items-center gap-4 text-[10px] font-black uppercase tracking-[0.3em] text-white/50">
                                {activeItem.year && <span>{activeItem.year}</span>}
                                {activeItem.format && (
                                    <>
                                        <div className="h-1 w-1 rounded-full bg-white/20" />
                                        <span>{activeItem.format}</span>
                                    </>
                                )}
                                {activeItem.rating && (
                                    <>
                                        <div className="h-1 w-1 rounded-full bg-white/20" />
                                        <span className="text-emerald-400">{(activeItem.rating * 10).toFixed(0)}% Match</span>
                                    </>
                                )}
                            </div>

                            {/* Title */}
                            <h1 className="font-bebas text-[6rem] md:text-[9rem] lg:text-[12rem] leading-[0.8] tracking-tighter text-white uppercase drop-shadow-2xl">
                                {activeItem.title}
                            </h1>

                            {/* Synopsis */}
                            <p className="line-clamp-2 max-w-2xl text-lg leading-relaxed text-zinc-300 font-medium">
                                {activeItem.synopsis}
                            </p>

                            {/* Actions */}
                            <div className="flex items-center gap-6 pt-4">
                                <motion.button
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    onClick={activeItem.onPlay}
                                    className="flex items-center gap-4 bg-white text-black px-10 py-4 rounded-xl font-bebas text-xl uppercase tracking-wider shadow-[0_20px_40px_-10px_rgba(255,255,255,0.2)]"
                                >
                                    <Play size={20} fill="currentColor" />
                                    <span>Reproducir</span>
                                </motion.button>

                                <motion.button
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    onClick={activeItem.onMoreInfo}
                                    className="flex items-center gap-4 bg-white/10 backdrop-blur-md text-white px-10 py-4 rounded-xl border border-white/10 font-bebas text-xl uppercase tracking-wider hover:bg-white/20 transition-all"
                                >
                                    <Info size={20} />
                                    <span>Detalles</span>
                                </motion.button>
                            </div>
                        </motion.div>
                    </AnimatePresence>
                </div>
            </div>

            {/* ── Indicators ──────────────────────────────── */}
            {items.length > 1 && (
                <div className="absolute bottom-10 right-16 z-30 flex items-center gap-4">
                    {items.map((_, idx) => (
                        <button
                            key={idx}
                            onClick={() => setActiveIndex(idx)}
                            className={cn(
                                "h-1 rounded-full transition-all duration-700",
                                activeIndex === idx ? "w-12 bg-white" : "w-4 bg-white/20"
                            )}
                        />
                    ))}
                </div>
            )}
        </section>
    )
}

export function HeroBannerSkeleton() {
    return (
        <div className="h-[85dvh] w-full bg-zinc-950 animate-pulse">
            <div className="mx-auto h-full w-full max-w-[1800px] px-8 pb-20 md:px-16 flex flex-col justify-end gap-6">
                <Skeleton className="h-6 w-32 bg-white/5" />
                <Skeleton className="h-32 w-3/4 bg-white/5" />
                <Skeleton className="h-20 w-1/2 bg-white/5" />
            </div>
        </div>
    )
}

