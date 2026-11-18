import * as React from "react"
import { IconStatusHeadphones, IconUiStar } from "@/components/ui/icons";
import { cn } from "@/components/ui/core/styling"
import { ElasticCounter } from "@/components/ui/kinetics"

interface MediaMetadataCapsuleProps {
    year?: number | string | null
    episodes?: number | string | null
    sagas?: number | string | null
    rating?: number | null
    quality?: string | null
    audio?: string | null
    children?: React.ReactNode
}

export const MediaMetadataCapsule = React.memo(function MediaMetadataCapsule({
    year,
    episodes,
    sagas,
    rating,
    quality,
    audio,
    children,
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

    const standardTagClass = "relative z-10 bg-black/60 text-white text-xs font-semibold tabular-nums px-2.5 py-1 rounded-md border border-white/15 border-t-white/25 shadow-glass-highlight-sm"

    return (
        <div className="inline-flex w-fit select-none">
        <div
            className={cn(
                "media-metadata-capsule",
                "inline-flex flex-wrap items-center gap-2",
                "[transform:translateZ(0)] [isolation:isolate]"
            )}
        >

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

            {/* Ki Score / Rating — Emerald Gem */}
            {formattedRating && (
                <span data-rating="" className="relative z-10 bg-status-success/20 text-status-success text-xs font-bold tabular-nums px-2.5 py-1 rounded-md border border-status-success/40 border-t-status-success/70 shadow-[shadow:var(--glow-chip-success)] flex items-center gap-1">
                    <IconUiStar size={11} fill="currentColor" className="text-status-success" />
                    <span>{formattedRating} Ki</span>
                </span>
            )}

            {/* Quality Badge (4K / 1080p) */}
            {quality && (
                <span data-status="complete" className="relative z-10 bg-status-warning/20 text-status-warning text-xs font-bold tabular-nums px-2.5 py-1 rounded-md border border-status-warning/40 border-t-status-warning/70 shadow-[shadow:var(--glow-chip-warning)]">
                    {quality}
                </span>
            )}

            {/* Audio Profile (Latino Dual, etc.) */}
            {audio && (
                <span className="relative z-10 bg-brand-accent/20 text-brand-accent-readable text-xs font-semibold px-2.5 py-1 rounded-md border border-brand-accent/40 border-t-brand-accent/70 shadow-[shadow:var(--glow-chip-accent)] flex items-center gap-1.5">
                    <IconStatusHeadphones size={11} className="text-brand-accent-readable" />
                    {audio}
                </span>
            )}

            {/* Additional Custom Badges / Chips */}
            {children}
        </div>
        </div>
    )
})
