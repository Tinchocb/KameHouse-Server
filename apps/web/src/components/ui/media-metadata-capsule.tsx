import * as React from "react"
import { m, type Variants } from "framer-motion"
import { IconStatusHeadphones, IconUiStar } from "@/components/ui/icons";
import { cn } from "@/components/ui/core/styling"
import { ElasticCounter } from "@/components/ui/kinetics"

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
    isComplete?: boolean
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
    isComplete,
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

    const Wrapper = variants ? m.div : "div"

    const standardTagClass = "relative z-10 bg-white/[0.08] text-zinc-200 text-3xs font-mono font-semibold tracking-wider px-2.5 py-1 rounded-full border border-white/15 border-t-white/30 border-b-white/5 shadow-[inset_0_1px_0_rgba(255,255,255,0.15)] uppercase"

    return (
        <Wrapper
            variants={variants}
            className={cn(
                "inline-flex w-fit select-none",
                className
            )}
        >
        <div
            className={cn(
                "glass-frosted-pill inline-flex flex-wrap items-center gap-1.5 p-1",
                "[transform:translateZ(0)] [isolation:isolate]"
            )}
        >
            {/* Format Chip (Serie TV, Película, etc.) */}
            {format && (
                <span className="relative z-10 bg-white/20 text-white text-3xs font-black tracking-widest px-2.5 py-1 rounded-full border border-white/30 border-t-white/60 shadow-[inset_0_1px_1px_rgba(255,255,255,0.4)] uppercase select-none">
                    {format}
                </span>
            )}

            {/* Release Year */}
            {year && (
                <span className={standardTagClass}>
                    {typeof year === "number" ? <ElasticCounter value={year} /> : year}
                </span>
            )}

            {/* Episode Count */}
            {formattedEpisodes && (
                <span className={cn(standardTagClass, "inline-flex items-center gap-1")}>
                    {typeof episodes === "number" ? (
                        <>
                            <ElasticCounter value={episodes} />
                            <span>Episodios</span>
                        </>
                    ) : (
                        formattedEpisodes
                    )}
                </span>
            )}

            {/* Sagas Count */}
            {formattedSagas && (
                <span className={cn(standardTagClass, "inline-flex items-center gap-1")}>
                    {typeof sagas === "number" ? (
                        <>
                            <ElasticCounter value={sagas} />
                            <span>{sagas === 1 ? "Saga" : "Sagas"}</span>
                        </>
                    ) : (
                        formattedSagas
                    )}
                </span>
            )}

            {/* Runtime / Duration */}
            {duration && (
                <span className={standardTagClass}>
                    {duration}
                </span>
            )}

            {/* Age Rating (PG-13, 18+, etc.) */}
            {ageRating && (
                <span className="relative z-10 bg-white/[0.08] text-zinc-200 text-3xs font-bold tracking-wider px-2.5 py-1 rounded-full border border-white/15 border-t-white/30 border-b-white/5 shadow-[inset_0_1px_0_rgba(255,255,255,0.15)] uppercase">
                    {ageRating}
                </span>
            )}

            {/* Ki Score / Rating — Frosted Emerald Gem */}
            {formattedRating && (
                <span className="relative z-10 bg-emerald-950/70 text-emerald-300 text-3xs font-mono font-extrabold tracking-wider px-2.5 py-1 rounded-full border border-emerald-500/40 border-t-emerald-400/70 shadow-[inset_0_1px_1px_rgba(52,211,153,0.35),0_0_12px_rgba(16,185,129,0.2)] uppercase flex items-center gap-1">
                    <IconUiStar size={10} fill="currentColor" className="text-emerald-400" />
                    <span>{formattedRating} Ki</span>
                </span>
            )}

            {/* Status / Series Complete Badge — Frosted Amber Luminous Pill */}
            {isComplete && (
                <span className="relative z-10 bg-amber-950/70 text-amber-300 text-3xs font-mono font-extrabold tracking-wider px-2.5 py-1 rounded-full border border-amber-500/40 border-t-amber-400/70 shadow-[inset_0_1px_1px_rgba(251,191,36,0.35),0_0_12px_rgba(245,158,11,0.2)] uppercase">
                    Completa
                </span>
            )}

            {/* Quality Badge (4K / 1080p) */}
            {quality && (
                <span className="relative z-10 bg-amber-950/70 text-amber-300 text-3xs font-mono font-black tracking-widest px-2.5 py-1 rounded-full border border-amber-500/40 border-t-amber-400/70 shadow-[inset_0_1px_1px_rgba(251,191,36,0.35),0_0_12px_rgba(245,158,11,0.2)] uppercase">
                    {quality}
                </span>
            )}

            {/* Audio Profile (Latino Dual, etc.) */}
            {audio && (
                <span className="relative z-10 bg-sky-950/70 text-sky-300 text-3xs font-bold tracking-wider px-2.5 py-1 rounded-full border border-sky-500/40 border-t-sky-400/70 shadow-[inset_0_1px_1px_rgba(56,189,248,0.35),0_0_12px_rgba(14,165,233,0.2)] uppercase flex items-center gap-1">
                    <IconStatusHeadphones size={10} className="text-sky-400" />
                    {audio}
                </span>
            )}

            {/* Additional Custom Badges / Chips */}
            {children}
        </div>
        </Wrapper>
    )
})
