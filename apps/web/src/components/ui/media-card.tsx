import { cn } from "@/components/ui/core/styling"
import type { CardAspect } from "@/api/types/intelligence.types"
import { Play, Info, Sparkles, Plus, Check } from "lucide-react"
import * as React from "react"
import { motion, AnimatePresence } from "framer-motion"
import { getHighResImage } from "@/lib/helpers/images"
import { DeferredImage } from "@/components/shared/deferred-image"
import { GlowingEffect } from "@/components/shared/glowing-effect"

export interface MediaCardProps {
    artwork: string
    title: string
    subtitle?: string
    badge?: string
    availabilityType?: "FULL_LOCAL" | "HYBRID" | "ONLY_ONLINE"
    description?: string
    aspect?: CardAspect
    progress?: number
    year?: string | number
    rating?: number
    episodeNumber?: number
    onClick?: () => void
    className?: string
    layoutId?: string
}

export const MediaCard = React.memo(function MediaCard({
    artwork,
    title,
    subtitle,
    badge,
    description,
    aspect = "poster",
    progress,
    year,
    rating,
    episodeNumber,
    onClick,
    className,
    layoutId,
}: MediaCardProps) {
    const isPoster = aspect === "poster"
    const [isHovered, setIsHovered] = React.useState(false)
    const [showPopup, setShowPopup] = React.useState(false)
    const hoverTimeoutRef = React.useRef<NodeJS.Timeout | null>(null)

    const handleMouseEnter = React.useCallback(() => {
        setIsHovered(true)
        if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current)
        
        // Debounce hover activation by 350ms to verify "hover intent" (Netflix style)
        hoverTimeoutRef.current = setTimeout(() => {
            setShowPopup(true)
        }, 350)
    }, [])

    const handleMouseLeave = React.useCallback(() => {
        setIsHovered(false)
        if (hoverTimeoutRef.current) {
            clearTimeout(hoverTimeoutRef.current)
            hoverTimeoutRef.current = null
        }
        setShowPopup(false)
    }, [])

    React.useEffect(() => {
        return () => {
            if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current)
        }
    }, [])

    // Extract vibes/moods from subtitle if it exists (e.g. "2024 · TV · EPIC · CHILL")
    const vibes = React.useMemo(() => {
        if (!subtitle) return []
        return subtitle
            .split("·")
            .map((s) => s.trim())
            .filter((s) => ["EPIC", "CHILL", "EMOTIONAL", "HYPE", "INTENSE", "ÉPICO", "ESENCIAL", "LOCAL", "RELLENO", "ESPECIAL"].includes(s.toUpperCase()))
    }, [subtitle])

    return (
        <div
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            className="relative shrink-0 select-none"
        >
            {/* ─── Base Card ────────────────────────────────────────── */}
            <motion.div
                layoutId={layoutId}
                onClick={onClick}
                className={cn(
                    "group relative cursor-pointer overflow-hidden bg-zinc-900/40 border border-white/5",
                    "transition-all duration-500 [transition-timing-function:cubic-bezier(0.23,1,0.32,1)]",
                    isPoster
                        ? "aspect-[2/3] w-[160px] md:w-[200px] lg:w-[240px] rounded-xl"
                        : "aspect-[16/9] w-[280px] md:w-[380px] lg:w-[440px] rounded-2xl",
                    showPopup ? "opacity-0 scale-95 pointer-events-none" : "opacity-100 scale-100",
                    className
                )}
            >
                {/* Artwork */}
                <div className="absolute inset-0 z-0">
                    <DeferredImage
                        src={getHighResImage(artwork)}
                        alt={title}
                        className="h-full w-full object-cover transition-transform duration-1000 [transition-timing-function:cubic-bezier(0.23,1,0.32,1)] group-hover:scale-105"
                    />
                    {/* Shadow Gradient Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/35 to-transparent opacity-95" />
                </div>

                {/* Episode/Saga Badge */}
                {episodeNumber !== undefined && (
                    <div className="absolute top-0 left-0 z-20">
                        <div className="bg-white text-zinc-950 px-2.5 py-1 rounded-br-lg font-black text-[10px] tracking-wider uppercase">
                            EP {episodeNumber}
                        </div>
                    </div>
                )}

                {/* Static Text Content */}
                <div className="absolute inset-0 z-10 flex flex-col justify-end p-4 md:p-5">
                    <div className="space-y-1">
                        <h3 className="font-bebas text-lg md:text-xl leading-none tracking-wide text-white line-clamp-1">
                            {title}
                        </h3>
                        {subtitle && (
                            <p className="text-[9px] font-black uppercase tracking-[0.15em] text-white/35 line-clamp-1">
                                {subtitle}
                            </p>
                        )}
                    </div>
                </div>

                {/* Progress bar */}
                {progress !== undefined && (
                    <div className="absolute inset-x-0 bottom-0 z-20 h-1 bg-white/10">
                        <div
                            className="h-full bg-primary"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                )}
            </motion.div>

            {/* ─── Premium Netflix-Style Hover Popup ────────────────── */}
            <AnimatePresence>
                {showPopup && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 10 }}
                        animate={{ opacity: 1, scale: 1.06, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 10 }}
                        transition={{ type: "spring", damping: 25, stiffness: 220 }}
                        onClick={onClick}
                        className={cn(
                            "absolute z-[100] cursor-pointer overflow-hidden",
                            "bg-zinc-950/95 backdrop-blur-xl border border-white/10 rounded-2xl",
                            "shadow-[0_20px_50px_rgba(0,0,0,0.85)]",
                            isPoster
                                ? "-top-[12%] -left-[12.5%] w-[125%] aspect-[2/3.3] min-h-[300px]"
                                : "-top-[15%] -left-[10%] w-[120%] aspect-[16/11] min-h-[220px]"
                        )}
                    >
                        {/* Glowing effect inside card */}
                        <GlowingEffect glow={true} blur={8} spread={40} disabled={false} borderWidth={1.5} className="opacity-30" />

                        {/* Banner Image */}
                        <div className="relative w-full aspect-[16/9] overflow-hidden">
                            <DeferredImage
                                src={getHighResImage(artwork)}
                                alt={title}
                                className="h-full w-full object-cover"
                            />
                            {/* Backdrop shadow gradient */}
                            <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/20 to-transparent" />
                            
                            {/* Fast Play Action Indicator */}
                            <div className="absolute bottom-3 left-4 flex items-center gap-2">
                                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-black shadow-lg hover:scale-110 active:scale-95 transition-all">
                                    <Play size={16} fill="currentColor" className="ml-0.5" />
                                </div>
                                <div className="flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-black/45 backdrop-blur-md text-white hover:bg-black/60 transition-colors">
                                    <Plus size={16} />
                                </div>
                            </div>
                        </div>

                        {/* Extended Details Body */}
                        <div className="p-4 space-y-2 select-none">
                            <h3 className="font-bebas text-xl md:text-2xl leading-none text-white uppercase tracking-wide line-clamp-1">
                                {title}
                            </h3>

                            {/* Tags / Meta Information */}
                            <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                                {rating && (
                                    <span className="text-emerald-400 font-extrabold flex items-center gap-1">
                                        {(rating * 10).toFixed(0)}% COINCIDENCIA
                                    </span>
                                )}
                                {year && <span className="text-zinc-300 font-medium">{year}</span>}
                                {badge && (
                                    <span className="border border-white/10 bg-white/5 backdrop-blur-md px-1.5 py-0.5 rounded text-zinc-300 text-[8px]">
                                        {badge}
                                    </span>
                                )}
                            </div>

                            {/* Dynamic AI Vibes / Mood Badges */}
                            {vibes.length > 0 && (
                                <div className="flex flex-wrap gap-1.5 pt-0.5">
                                    {vibes.slice(0, 3).map((vibe, idx) => (
                                        <span
                                            key={idx}
                                            className="text-[8px] font-bold tracking-widest uppercase bg-primary/10 border border-primary/20 text-primary px-2 py-0.5 rounded-full flex items-center gap-1 shadow-sm"
                                        >
                                            <Sparkles size={8} className="animate-pulse" />
                                            {vibe}
                                        </span>
                                    ))}
                                </div>
                            )}

                            {/* Description/Synopsis */}
                            {description && (
                                <p className="line-clamp-3 text-[11px] leading-relaxed text-zinc-400 pt-1 font-medium select-none">
                                    {description.replace(/<[^>]*>/g, '')}
                                </p>
                            )}
                        </div>

                        {/* Progress Bar inside Popup */}
                        {progress !== undefined && (
                            <div className="absolute inset-x-0 bottom-0 h-1 bg-white/10 z-20">
                                <div
                                    className="h-full bg-primary"
                                    style={{ width: `${progress}%` }}
                                />
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
})
MediaCard.displayName = "MediaCard"
