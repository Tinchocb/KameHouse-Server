import * as React from "react"
import { motion, type Variants } from "framer-motion"
import { IconStatusHeadphones, IconUiStar } from "@/components/ui/icons";
import { cn } from "@/components/ui/core/styling"

export interface MediaMetadataCapsuleProps {
    format?: string | null
    year?: number | string | null
    episodes?: number | string | null
    duration?: string | null
    sagas?: number | string | null
    rating?: number | null
    quality?: string | null
    audio?: string | null
    ageRating?: string | null
    children?: React.ReactNode
    className?: string
    variants?: Variants
}

export const MediaMetadataCapsule = React.memo(function MediaMetadataCapsule({
    format,
    year,
    episodes,
    duration,
    sagas,
    rating,
    quality,
    audio,
    ageRating,
    children,
    className,
    variants,
}: MediaMetadataCapsuleProps) {
    const formattedRating = React.useMemo(() => {
        if (rating === undefined || rating === null || isNaN(rating) || rating <= 0) return null
        const normalized = rating > 10 ? rating / 10 : rating
        return normalized.toFixed(1)
    }, [rating])

    const formattedEpisodes = React.useMemo(() => {
        if (!episodes) return null
        const str = String(episodes)
        if (str.toLowerCase().includes("ep")) return str
        return `${str} Episodios`
    }, [episodes])

    const formattedSagas = React.useMemo(() => {
        if (!sagas) return null
        const num = Number(sagas)
        if (isNaN(num)) return String(sagas)
        return `${num} ${num === 1 ? "Saga" : "Sagas"}`
    }, [sagas])

    const Wrapper = variants ? motion.div : "div"

    return (
        <Wrapper
            variants={variants}
            className={cn(
                "inline-flex flex-wrap items-center gap-1.5 p-1 rounded-2xl",
                "bg-zinc-950/45 border border-white/20 border-t-white/40 border-b-white/10",
                "backdrop-blur-overlay-md backdrop-saturate-[150%]",
                "shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.3),0_12px_36px_-6px_rgba(0,0,0,0.85)]",
                "w-fit select-none [transform:translateZ(0)] [isolation:isolate]",
                className
            )}
        >
            {/* Format Chip (Serie TV, Película, etc.) */}
            {format && (
                <span className="bg-white/15 text-white text-[10px] font-bold tracking-widest px-2.5 py-1 rounded-lg border border-white/20 uppercase shadow-sm">
                    {format}
                </span>
            )}

            {/* Release Year */}
            {year && (
                <span className="bg-white/10 text-zinc-200 text-[10px] font-mono font-bold tracking-wider px-2.5 py-1 rounded-lg border border-white/10 uppercase">
                    {year}
                </span>
            )}

            {/* Episode Count */}
            {formattedEpisodes && (
                <span className="bg-white/10 text-zinc-200 text-[10px] font-mono font-bold tracking-wider px-2.5 py-1 rounded-lg border border-white/10 uppercase">
                    {formattedEpisodes}
                </span>
            )}

            {/* Sagas Count */}
            {formattedSagas && (
                <span className="bg-white/10 text-zinc-200 text-[10px] font-mono font-bold tracking-wider px-2.5 py-1 rounded-lg border border-white/10 uppercase">
                    {formattedSagas}
                </span>
            )}

            {/* Runtime / Duration */}
            {duration && (
                <span className="bg-white/10 text-zinc-200 text-[10px] font-mono font-bold tracking-wider px-2.5 py-1 rounded-lg border border-white/10 uppercase">
                    {duration}
                </span>
            )}

            {/* Age Rating (PG-13, 18+, etc.) */}
            {ageRating && (
                <span className="bg-white/10 text-zinc-200 text-[10px] font-bold tracking-wider px-2.5 py-1 rounded-lg border border-white/10 uppercase">
                    {ageRating}
                </span>
            )}

            {/* Quality Badge (4K / 1080p) */}
            {quality && (
                <span className="bg-amber-950/60 text-amber-300 text-[10px] font-mono font-black tracking-widest px-2.5 py-1 rounded-lg border border-amber-500/30 uppercase shadow-sm">
                    {quality}
                </span>
            )}

            {/* Audio Profile (Latino Dual, etc.) */}
            {audio && (
                <span className="bg-sky-950/60 text-sky-300 text-[10px] font-bold tracking-wider px-2.5 py-1 rounded-lg border border-sky-500/30 uppercase shadow-sm flex items-center gap-1">
                    <IconStatusHeadphones size={10} className="text-sky-400" />
                    {audio}
                </span>
            )}

            {/* Ki Score / Rating */}
            {formattedRating && (
                <span className="bg-emerald-950/80 text-emerald-300 text-[10px] font-mono font-extrabold tracking-wider px-2.5 py-1 rounded-lg border border-emerald-500/40 uppercase flex items-center gap-1 shadow-sm">
                    <IconUiStar size={10} fill="currentColor" className="text-emerald-400" />
                    <span>{formattedRating} Ki</span>
                </span>
            )}

            {/* Additional Custom Badges / Chips */}
            {children}
        </Wrapper>
    )
})
