/**
 * MediaCard — Premium carousel poster/wide card.
 *
 * ─── Hover behaviour ──────────────────────────────────────────────────────────
 * • Scale up: scale-105 / translateY(-4px) on the card wrapper
 * • Image: scale-110 inside its container (parallax feel)
 * • Overlay: gradient slides up from bottom revealing title + year
 * • Play icon: fades in from center
 * ─── No orange ────────────────────────────────────────────────────────────────
 * Badge uses white/zinc, progress bar uses white, glow uses white/20.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import * as React from "react"
import { cn } from "@/components/ui/core/styling"
import { FaPlay } from "react-icons/fa"
import { type CardAspect } from "@/lib/home-catalog"

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface MediaCardProps {
    /** Poster / thumbnail URL. */
    artwork: string
    /** Primary title displayed in the hover overlay and the footer. */
    title: string
    /**
     * Short secondary label — typically the release year or episode count.
     * Shown in the hover overlay (small muted text) and below the card.
     */
    subtitle?: string
    /**
     * Small badge rendered top-left (e.g. "NUEVO", "HDR", "1080p").
     * Neutral white styling — no colour.
     */
    badge?: string
    /**
     * Optional description for wide cards (hidden in poster mode).
     * Revealed on hover with a max-h clip transition.
     */
    description?: string
    /** "poster" (2:3 ratio) or "wide" (16:9 ratio). Defaults to "poster". */
    aspect?: CardAspect
    /** Playback progress 0–100. Renders a progress bar at the bottom. */
    progress?: number
    /** Color scheme for the progress bar. Default: "white" */
    progressColor?: "white" | "orange"
    onClick?: () => void
    className?: string
}

// ─────────────────────────────────────────────────────────────────────────────
// MediaCard
// ─────────────────────────────────────────────────────────────────────────────

export function MediaCard({
    artwork,
    title,
    subtitle,
    badge,
    description,
    aspect = "poster",
    progress,
    progressColor = "white",
    onClick,
    className,
}: MediaCardProps) {
    const isPoster = aspect === "poster"

    return (
        <div
            role="button"
            tabIndex={0}
            aria-label={title}
            onClick={onClick}
            onKeyDown={(e) => e.key === "Enter" && onClick?.()}
            className={cn(
                // ── Layout ──
                "group relative flex flex-col shrink-0 cursor-pointer",
                "overflow-hidden rounded-xl",
                // ── Background (visible while image loads) ──
                "bg-zinc-800",
                // ── Width by aspect ──
                isPoster
                    ? "w-[150px] md:w-[190px] lg:w-[210px]"
                    : "w-[260px] md:w-[320px] lg:w-[360px]",
                // ── Hover: lift + scale + shadow ──
                "hover:-translate-y-1 hover:scale-[1.04]",
                "hover:shadow-2xl hover:shadow-black/60",
                // ── Transitions ──
                "transition-all duration-300 ease-out",
                // ── Focus ring ──
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60",
                className,
            )}
        >
            {/* ── Image wrapper ──────────────────────────────────── */}
            <div
                className={cn(
                    "relative w-full overflow-hidden",
                    isPoster ? "aspect-[2/3]" : "aspect-video",
                )}
            >
                {/* Poster / thumbnail */}
                <img
                    src={artwork}
                    alt={title}
                    loading="lazy"
                    draggable={false}
                    className={cn(
                        "w-full h-full object-cover select-none",
                        // Image zooms slightly more than the card for a parallax effect
                        "transition-transform duration-500 ease-out",
                        "group-hover:scale-110",
                    )}
                    onError={(e) => {
                        // Graceful fallback: replace broken image with a zinc placeholder
                        ; (e.target as HTMLImageElement).src =
                            "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='300'%3E%3Crect width='200' height='300' fill='%2327272a'/%3E%3C/svg%3E"
                    }}
                />

                {/*
                 * ── Bottom overlay ──────────────────────────────
                 * Two-phase: always faintly present (opacity-30) so the card
                 * has depth even at rest; fully reveals on hover (opacity-100).
                 */}
                <div
                    className={cn(
                        "absolute inset-x-0 bottom-0 z-10",
                        "flex flex-col justify-end gap-0.5 px-3 pb-3 pt-10",
                        "bg-gradient-to-t from-zinc-950 via-zinc-950/80 to-transparent",
                        "translate-y-2 opacity-0",
                        "group-hover:translate-y-0 group-hover:opacity-100",
                        "transition-all duration-300 ease-out",
                    )}
                >
                    <p className="text-white font-bold text-sm line-clamp-2 leading-snug drop-shadow-md">
                        {title}
                    </p>
                    {subtitle && (
                        <p className="text-zinc-400 text-xs font-medium">{subtitle}</p>
                    )}
                </div>

                {/* ── Play icon ──────────────────────────────────── */}
                <div
                    className={cn(
                        "absolute inset-0 z-20",
                        "flex items-center justify-center",
                        "opacity-0 group-hover:opacity-100",
                        "transition-opacity duration-200",
                    )}
                >
                    <div
                        className={cn(
                            "w-10 h-10 rounded-full",
                            "flex items-center justify-center",
                            // Glassmorphism play button — no orange
                            "bg-white/90 backdrop-blur-sm",
                            "shadow-xl shadow-black/60",
                            "scale-75 group-hover:scale-100",
                            "transition-transform duration-300 ease-out delay-75",
                        )}
                    >
                        <FaPlay className="w-3.5 h-3.5 text-zinc-950 ml-0.5" />
                    </div>
                </div>

                {/* ── Badge (top-left) ───────────────────────────── */}
                {badge && (
                    <span
                        className={cn(
                            "absolute top-2 left-2 z-30",
                            "px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-widest",
                            "bg-white/90 text-zinc-950",
                            "shadow-sm",
                        )}
                    >
                        {badge}
                    </span>
                )}

                {/* ── Progress bar ───────────────────────────────── */}
                {progress !== undefined && (
                    <div className="absolute bottom-0 left-0 right-0 z-30 h-[3px] bg-white/15">
                        <div
                            className={cn(
                                "h-full transition-all duration-300",
                                progressColor === "orange"
                                    ? "bg-orange-500 shadow-[0_0_10px_rgba(255,122,0,0.8)]"
                                    : "bg-white"
                            )}
                            style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
                        />
                    </div>
                )}
            </div>

            {/* ── Footer ─────────────────────────────────────────── */}
            <div className="py-2.5 px-2.5 flex flex-col gap-0.5">
                <h3
                    className={cn(
                        "font-semibold text-zinc-100 leading-snug line-clamp-1",
                        "transition-colors duration-200 group-hover:text-white",
                        isPoster ? "text-xs md:text-sm" : "text-sm",
                    )}
                >
                    {title}
                </h3>

                {subtitle && (
                    <p className="text-zinc-500 text-xs font-medium line-clamp-1">{subtitle}</p>
                )}

                {/* Wide-card description — only shown if aspect="wide" */}
                {!isPoster && description && (
                    <p
                        className={cn(
                            "text-zinc-400 text-xs leading-relaxed mt-1 line-clamp-2",
                            "overflow-hidden max-h-0 opacity-0",
                            "group-hover:max-h-20 group-hover:opacity-100",
                            "transition-all duration-300 ease-out",
                        )}
                    >
                        {description}
                    </p>
                )}
            </div>
        </div>
    )
}
