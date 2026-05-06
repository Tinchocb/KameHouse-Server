import { cn } from "@/components/ui/core/styling"
import type { CardAspect } from "@/api/types/intelligence.types"
import { Folder, Zap } from "lucide-react"
import * as React from "react"
import { DeferredImage } from "@/components/shared/deferred-image"
import { motion } from "framer-motion"

// ─── Intelligence tag colours ─────────────────────────────────────────────────

const TAG_STYLES: Record<string, string> = {
    EPIC:    "text-white",
    FILLER:  "text-zinc-500",
    SPECIAL: "text-zinc-300",
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MediaCardProps {
    artwork: string
    title: string
    subtitle?: string
    /** Top-left format badge (e.g. "TV", "MOVIE") */
    badge?: string
    availabilityType?: "FULL_LOCAL" | "HYBRID" | "ONLY_ONLINE"
    description?: string
    /** Enforce strict aspect ratio */
    aspect?: CardAspect
    progress?: number
    progressColor?: "white" | "zinc"
    /** Intelligence ContentTag — rendered as a tiny bottom label */
    intelligenceTag?: string
    /** Quick metadata for the hover ribbon */
    year?: string | number
    rating?: number
    onClick?: () => void
    className?: string
    /** Unique ID for shared element transitions */
    layoutId?: string
}

// ─── Component ────────────────────────────────────────────────────────────────

const MediaCardCompare = (
    prevProps: Readonly<MediaCardProps>,
    nextProps: Readonly<MediaCardProps>
): boolean => {
    return (
        prevProps.artwork === nextProps.artwork &&
        prevProps.title === nextProps.title &&
        prevProps.subtitle === nextProps.subtitle &&
        prevProps.progress === nextProps.progress &&
        prevProps.availabilityType === nextProps.availabilityType &&
        prevProps.badge === nextProps.badge &&
        prevProps.rating === nextProps.rating &&
        prevProps.year === nextProps.year &&
        prevProps.intelligenceTag === nextProps.intelligenceTag &&
        prevProps.className === nextProps.className
    )
}

export const MediaCard = React.memo(function MediaCard({
    artwork,
    title,
    subtitle,
    badge,
    availabilityType,
    aspect = "poster",
    progress,
    progressColor = "white",
    intelligenceTag,
    year,
    rating,
    onClick,
    className,
    layoutId,
}: MediaCardProps) {
    const isPoster = aspect === "poster"

    return (
        <motion.div
            role="button"
            tabIndex={0}
            aria-label={title}
            onClick={onClick}
            onKeyDown={(e) => e.key === "Enter" && onClick?.()}
            layoutId={layoutId}
            whileHover={{ 
                scale: 1.02,
                transition: { duration: 0.2, ease: "easeOut" }
            }}
            className={cn(
                // Base
                "group/card relative shrink-0 cursor-pointer overflow-hidden rounded-none border border-zinc-800 transition-all duration-200",
                "bg-black hover:border-zinc-500 hover:z-50",
                // Intrinsic sizing
                isPoster
                    ? "aspect-[2/3] w-[145px] md:w-[175px] lg:w-[210px]"
                    : "aspect-[16/9] w-[250px] md:w-[320px] lg:w-[360px]",
                className,
            )}
        >
            {/* ── Artwork (Deferred) ────────────────────── */}
            <DeferredImage
                src={artwork}
                alt={title}
                className="absolute inset-0 h-full w-full select-none object-cover grayscale transition-all duration-500 group-hover/card:grayscale-0 group-hover/card:scale-105"
            />

            {/* ── Top-right: Source Icon ─────────────────── */}
            {availabilityType && (
                <div className="absolute right-0 top-0 z-20">
                    <span className="flex h-8 w-8 items-center justify-center bg-black border-l border-b border-white/20">
                        {availabilityType === "ONLY_ONLINE" ? (
                            <Zap className="h-4 w-4 text-white" />
                        ) : (
                            <Folder className="h-4 w-4 text-white" />
                        )}
                    </span>
                </div>
            )}

            {/* ── Top-left: Format Badge ──────────────── */}
            {badge && (
                <div className="absolute left-0 top-0 z-20">
                    <span className="bg-white px-2 py-1 text-[9px] font-black uppercase tracking-[0.2em] text-black border-r border-b border-white/20">
                        {badge}
                    </span>
                </div>
            )}

            {/* ── Bottom Gradient ─────────────────────────────────── */}
            <div
                className={cn(
                    "absolute inset-x-0 bottom-0 z-10",
                    isPoster ? "h-[40%]" : "h-[50%]",
                    "bg-gradient-to-t from-black to-transparent opacity-80",
                )}
            />

            {/* ── Info Container ───────────────────────────────── */}
            <div className="absolute inset-x-0 bottom-0 z-20 p-3">
                <p className="line-clamp-1 text-[0.8rem] font-black leading-tight text-white uppercase tracking-wider">
                    {title}
                </p>

                <div className="mt-1 flex items-center justify-between gap-1">
                    {subtitle && (
                        <p className="truncate text-[0.65rem] font-bold text-white/50 uppercase tracking-widest">{subtitle}</p>
                    )}
                </div>
            </div>

            {/* ── Hover Overlay ────────────────── */}
            <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/60 opacity-0 transition-opacity duration-200 group-hover/card:opacity-100">
                {/* Play Icon */}
                <div className="flex h-12 w-12 items-center justify-center border-2 border-white text-white bg-black">
                    <svg viewBox="0 0 24 24" className="ml-1 h-6 w-6 fill-current" xmlns="http://www.w3.org/2000/svg">
                        <path d="M8 5v14l11-7z" />
                    </svg>
                </div>

                {/* Metadata Strip */}
                {(year || rating) && (
                    <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between gap-2">
                        {year && <span className="text-[9px] font-black text-white uppercase tracking-widest">{year}</span>}
                        {rating !== undefined && (
                            <span className="text-[9px] font-black text-white uppercase tracking-widest border border-white/40 px-2 py-0.5">
                                {rating.toFixed(1)} ★
                            </span>
                        )}
                    </div>
                )}
            </div>

            {/* ── Progress Bar ──────────────────────────────────────────── */}
            {progress !== undefined && (
                <div className="absolute inset-x-0 bottom-0 z-50 h-[2px] bg-white/10">
                    <div
                        className="h-full bg-white transition-all duration-500"
                        style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
                    />
                </div>
            )}
        </motion.div>
    )
}, MediaCardCompare)
MediaCard.displayName = "MediaCard"
