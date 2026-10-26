import * as React from "react"
import { m, type Variants } from "framer-motion"
import { IconStatusHeadphones, IconUiStar } from "@/components/ui/icons";
import { cn } from "@/components/ui/core/styling"
import { ElasticCounter } from "@/components/ui/kinetics"

interface MediaMetadataCapsuleProps {
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
    /** Cápsula opaca (`.surface-content`) para usarla dentro de tarjetas de contenido, sin vidrio. */
    flat?: boolean
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
    flat,
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
        return `${str} ${Number(str) === 1 ? "episodio" : "episodios"}`
    }, [episodes])

    const formattedSagas = React.useMemo(() => {
        if (!sagas) return null
        const num = Number(sagas)
        if (isNaN(num)) return String(sagas)
        return `${num} ${num === 1 ? "saga" : "sagas"}`
    }, [sagas])

    const Wrapper = variants ? m.div : "div"

    const standardTagClass = "relative z-10 bg-white/10 backdrop-blur-md text-white text-xs font-semibold tabular-nums px-2.5 py-1 rounded-md border border-white/15 border-t-white/25 shadow-glass-highlight-sm"

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
                flat ? "surface-content rounded-full p-1" : "",
                "inline-flex flex-wrap items-center gap-2",
                "[transform:translateZ(0)] [isolation:isolate]"
            )}
        >
            {/* Format Chip (Serie TV, Película, etc.) */}
            {format && (
                <span className="relative z-10 bg-white/20 backdrop-blur-md text-white text-xs font-bold px-2.5 py-1 rounded-md border border-white/30 border-t-white/50 shadow-glass-highlight-lg select-none">
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
                            <span>{episodes === 1 ? "episodio" : "episodios"}</span>
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
                            <span>{sagas === 1 ? "saga" : "sagas"}</span>
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
                <span className="relative z-10 bg-white/10 backdrop-blur-md text-white text-xs font-semibold px-2.5 py-1 rounded-md border border-white/15 border-t-white/25 shadow-glass-highlight-sm">
                    {ageRating}
                </span>
            )}

            {/* Ki Score / Rating — Frosted Emerald Gem */}
            {formattedRating && (
                <span className="relative z-10 bg-status-success/15 backdrop-blur-md text-status-success text-xs font-bold tabular-nums px-2.5 py-1 rounded-md border border-status-success/40 border-t-status-success/70 shadow-[shadow:var(--glow-chip-success)] flex items-center gap-1">
                    <IconUiStar size={11} fill="currentColor" className="text-status-success" />
                    <span>{formattedRating} Ki</span>
                </span>
            )}

            {/* Status / Series Complete Badge — Frosted Amber Luminous Pill */}
            {isComplete && (
                <span className="relative z-10 bg-status-warning/15 backdrop-blur-md text-status-warning text-xs font-bold tabular-nums px-2.5 py-1 rounded-md border border-status-warning/40 border-t-status-warning/70 shadow-[shadow:var(--glow-chip-warning)]">
                    Completa
                </span>
            )}

            {/* Quality Badge (4K / 1080p) */}
            {quality && (
                <span className="relative z-10 bg-status-warning/15 backdrop-blur-md text-status-warning text-xs font-bold tabular-nums px-2.5 py-1 rounded-md border border-status-warning/40 border-t-status-warning/70 shadow-[shadow:var(--glow-chip-warning)]">
                    {quality}
                </span>
            )}

            {/* Audio Profile (Latino Dual, etc.) */}
            {audio && (
                <span className="relative z-10 bg-brand-accent/15 backdrop-blur-md text-brand-accent-readable text-xs font-semibold px-2.5 py-1 rounded-md border border-brand-accent/40 border-t-brand-accent/70 shadow-[shadow:var(--glow-chip-accent)] flex items-center gap-1.5">
                    <IconStatusHeadphones size={11} className="text-brand-accent-readable" />
                    {audio}
                </span>
            )}

            {/* Additional Custom Badges / Chips */}
            {children}
        </div>
        </Wrapper>
    )
})
