/**
 * AnimePosterCard — Flat, Seanime-inspired poster card.
 *
 * Design language: Large flat poster, no 3D effects. Subtle progress bar on
 * the bottom edge if a watch history item exists. Clean hover state with a
 * centered play button overlay and a faint title fade-in.
 */

import { memo } from "react"
import { Play } from "lucide-react"
import { cn } from "@/components/ui/core/styling"
import { DeferredImage } from "@/components/shared/deferred-image"
import type { Continuity_WatchHistoryItem } from "@/api/generated/types"

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AnimePosterCardProps {
    /** Unique media ID */
    mediaId: number
    title: string
    posterUrl: string
    /** Optional subtitle (genre, format, year…) */
    subtitle?: string
    /** Total episode count reported by the platform */
    totalEpisodes?: number
    /** Number of downloaded local episodes */
    localEpisodes?: number
    /** Optional watch history for progress bar */
    watchHistoryItem?: Continuity_WatchHistoryItem | null
    onClick?: () => void
    className?: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getProgressPercent(item: Continuity_WatchHistoryItem | null | undefined): number {
    if (!item || !item.duration || item.duration === 0) return 0
    return Math.min(100, (item.currentTime / item.duration) * 100)
}

// ─── Component ────────────────────────────────────────────────────────────────

export const AnimePosterCard = memo(function AnimePosterCard({
    title,
    posterUrl,
    subtitle,
    totalEpisodes,
    localEpisodes,
    watchHistoryItem,
    onClick,
    className,
}: AnimePosterCardProps) {
    const progressPercent = getProgressPercent(watchHistoryItem)
    const hasProgress = progressPercent > 0
    const episodeLabel =
        localEpisodes !== undefined && totalEpisodes !== undefined && totalEpisodes > 0
            ? `${localEpisodes}/${totalEpisodes}`
            : localEpisodes !== undefined
            ? String(localEpisodes)
            : undefined

    return (
        <div
            role="button"
            tabIndex={0}
            aria-label={`Ver ${title}`}
            onClick={onClick}
            onKeyDown={(e) => e.key === "Enter" && onClick?.()}
            className={cn(
                "group relative cursor-pointer select-none outline-none",
                "rounded-sm overflow-hidden",
                "transition-transform duration-200 ease-out",
                "hover:scale-[1.03] focus-visible:scale-[1.03]",
                "focus-visible:ring-2 focus-visible:ring-white/30",
                className,
            )}
        >
            {/* ── Poster Image ── */}
            <div className="aspect-[2/3] w-full relative overflow-hidden bg-zinc-900">
                <DeferredImage
                    src={posterUrl}
                    alt={title}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />

                {/* Dark vignette — always present for text legibility */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/10 pointer-events-none" />

                {/* ── Play Overlay (on hover) ── */}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
                    <div className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center shadow-xl">
                        <Play className="w-5 h-5 fill-white text-white translate-x-0.5" />
                    </div>
                </div>

                {/* ── Episode badge (top-right) ── */}
                {episodeLabel && (
                    <div className="absolute top-2 right-2 z-10 px-1.5 py-0.5 bg-black/60 backdrop-blur-sm rounded text-[9px] font-mono font-bold text-white/80 tracking-wider">
                        EP {episodeLabel}
                    </div>
                )}

                {/* ── Bottom title + subtitle ── */}
                <div className="absolute bottom-0 inset-x-0 p-2.5 z-10">
                    {subtitle && (
                        <p className="text-[9px] font-bold uppercase tracking-widest text-white/50 mb-0.5 truncate">
                            {subtitle}
                        </p>
                    )}
                    <h3 className="text-[11px] font-black text-white uppercase tracking-tight leading-snug line-clamp-2">
                        {title}
                    </h3>
                </div>

                {/* ── Continue Watching Progress Bar (bottom edge) ── */}
                {hasProgress && (
                    <div className="absolute bottom-0 inset-x-0 h-[3px] bg-white/10 z-20">
                        <div
                            className="h-full bg-brand-orange transition-none"
                            style={{ width: `${progressPercent}%` }}
                        />
                    </div>
                )}
            </div>
        </div>
    )
})
