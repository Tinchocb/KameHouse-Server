/**
 * HeroSection — full-width cinematic hero for the Home page.
 *
 * ─── Design intent ────────────────────────────────────────────────────────────
 * • 75vh tall, blends seamlessly into zinc-950 via a multi-stop gradient.
 * • Two gradient layers:
 *     Vertical (bottom)  → from-zinc-950 via-zinc-950/70 to-transparent
 *     Horizontal (left)  → from-zinc-950 via-zinc-950/50 to-transparent
 *   This creates a cinematic "light source from the right" look while keeping
 *   the left-side text perfectly readable against the dark background.
 * • NO orange — all accents are white/zinc.
 * • Buttons: solid white "Play" + translucent white/10 "Add to List".
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React from "react"
import { FaPlay } from "react-icons/fa"
import { FiPlus, FiStar } from "react-icons/fi"
import { cn } from "@/components/ui/core/styling"

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface HeroSectionProps {
    /** Raw string or JSX (e.g. a styled <span>) for the title. */
    title: React.ReactNode
    /** Short synopsis, clamped to 3 lines on desktop. */
    synopsis: string
    /** Full-bleed background image URL (ideally ≥1920px wide). */
    backgroundUrl: string
    /**
     * Optional SVG/WebP logo image. When provided it replaces the text title.
     * Useful for series that ship a stylised logo asset.
     */
    logoUrl?: string
    /**
     * Structured metadata shown as a pill row below the title.
     * Example: { year: "2024", rating: "8.7", genres: ["Action", "Adventure"] }
     */
    meta?: {
        year?: string | number
        rating?: string | number
        genres?: string[]
        episodeCount?: number
    }
    /** Called when the primary "Reproducir" button is clicked. */
    onWatchClick?: () => void
    /** Called when the "Mi Lista" secondary button is clicked. */
    onAddToListClick?: () => void
    /** Extra classes for the outermost container (e.g. custom min-h). */
    className?: string
}

// ─────────────────────────────────────────────────────────────────────────────
// MetaPill — small label chip
// ─────────────────────────────────────────────────────────────────────────────

function MetaPill({ children }: { children: React.ReactNode }) {
    return (
        <span className="text-zinc-300 text-sm font-medium tabular-nums">
            {children}
        </span>
    )
}

function MetaSeparator() {
    return <span className="text-zinc-600 select-none">·</span>
}

// ─────────────────────────────────────────────────────────────────────────────
// HeroSection
// ─────────────────────────────────────────────────────────────────────────────

export function HeroSection({
    title,
    synopsis,
    backgroundUrl,
    logoUrl,
    meta,
    onWatchClick,
    onAddToListClick,
    className,
}: HeroSectionProps) {
    return (
        <section
            aria-label="Hero"
            className={cn(
                // Height: 75vh on desktop, clamped so it never goes below 520px or above 860px
                "relative w-full h-[75vh] min-h-[520px] max-h-[860px]",
                "flex items-end overflow-hidden",
                // The dark body colour — must match the page's root bg
                "bg-zinc-950",
                className,
            )}
        >
            {/* ── Background image ──────────────────────────────── */}
            <div className="absolute inset-0 z-0 overflow-hidden">
                <img
                    src={backgroundUrl}
                    alt=""
                    role="presentation"
                    loading="eager"
                    decoding="async"
                    className={cn(
                        "w-full h-full object-cover object-top select-none",
                        // Subtle ken-burns entrance that settles after 8s
                        "scale-[1.04] animate-[heroZoom_8s_ease-out_forwards]",
                    )}
                />
            </div>

            {/*
             * ── Gradient overlays ─────────────────────────────────
             *
             * Three layers stacked for the cinematic bleed effect:
             *
             *  1. Bottom vertical:  strong zinc-950 band → ensures flawless
             *     continuity with the carousel section below.
             *  2. Left horizontal:  text background so copy is readable.
             *  3. Top darkening: dim the very top-right sky area.
             */}

            {/* 1. Bottom vertical fade — the critical one */}
            <div
                aria-hidden
                className="absolute inset-0 z-[1] pointer-events-none"
                style={{
                    background:
                        "linear-gradient(to top, #09090b 0%, #09090b 8%, rgba(9,9,11,0.82) 30%, rgba(9,9,11,0.3) 60%, transparent 100%)",
                }}
            />

            {/* 2. Left horizontal fade */}
            <div
                aria-hidden
                className="absolute inset-0 z-[1] pointer-events-none"
                style={{
                    background:
                        "linear-gradient(to right, #09090b 0%, rgba(9,9,11,0.75) 30%, rgba(9,9,11,0.2) 60%, transparent 100%)",
                }}
            />

            {/* 3. Top darkening vignette */}
            <div
                aria-hidden
                className="absolute inset-0 z-[1] bg-gradient-to-b from-zinc-950/40 to-transparent pointer-events-none"
            />

            {/* ── Content ───────────────────────────────────────── */}
            <div
                className={cn(
                    "relative z-10 w-full pb-14 md:pb-20 lg:pb-24",
                    "px-6 md:px-12 lg:px-20",
                    "flex flex-col items-start gap-4 md:gap-5",
                    "max-w-4xl",
                )}
            >
                {/* Logo or text title */}
                {logoUrl ? (
                    <img
                        src={logoUrl}
                        alt={typeof title === "string" ? title : "Title"}
                        className="max-h-16 md:max-h-24 object-contain drop-shadow-2xl"
                    />
                ) : (
                    <h1 className="text-4xl md:text-5xl lg:text-6xl font-black text-white leading-[1.05] tracking-tight drop-shadow-2xl">
                        {title}
                    </h1>
                )}

                {/* Metadata row */}
                {meta && (
                    <div className="flex items-center flex-wrap gap-2 drop-shadow-md">
                        {meta.rating !== undefined && (
                            <>
                                <span className="flex items-center gap-1 text-sm font-semibold text-white">
                                    <FiStar className="w-3.5 h-3.5 fill-white" />
                                    {meta.rating}
                                </span>
                                <MetaSeparator />
                            </>
                        )}
                        {meta.year !== undefined && (
                            <>
                                <MetaPill>{meta.year}</MetaPill>
                                <MetaSeparator />
                            </>
                        )}
                        {meta.episodeCount !== undefined && (
                            <>
                                <MetaPill>{meta.episodeCount} eps</MetaPill>
                                <MetaSeparator />
                            </>
                        )}
                        {meta.genres?.map((g, i) => (
                            <React.Fragment key={g}>
                                <MetaPill>{g}</MetaPill>
                                {i < (meta.genres?.length ?? 0) - 1 && <MetaSeparator />}
                            </React.Fragment>
                        ))}
                    </div>
                )}

                {/* Synopsis */}
                <p className="text-zinc-300 text-sm md:text-base max-w-xl line-clamp-3 md:line-clamp-4 leading-relaxed drop-shadow-md">
                    {synopsis}
                </p>

                {/* Action buttons */}
                <div className="flex items-center gap-3 mt-1 flex-wrap">
                    {/* Primary: solid white */}
                    <button
                        type="button"
                        onClick={onWatchClick}
                        className={cn(
                            "flex items-center gap-2.5 px-7 py-3 rounded-xl",
                            "bg-white text-zinc-950 font-black text-sm tracking-wide",
                            "hover:bg-zinc-100 active:scale-95",
                            "transition-all duration-200 ease-out",
                            "shadow-xl shadow-black/40",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white",
                        )}
                    >
                        <FaPlay className="w-3.5 h-3.5 shrink-0" />
                        Reproducir
                    </button>

                    {/* Secondary: glassmorphism */}
                    <button
                        type="button"
                        onClick={onAddToListClick}
                        className={cn(
                            "flex items-center gap-2.5 px-7 py-3 rounded-xl",
                            "bg-white/10 hover:bg-white/20 backdrop-blur-sm",
                            "text-white font-bold text-sm tracking-wide",
                            "border border-white/10",
                            "active:scale-95 transition-all duration-200 ease-out",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40",
                        )}
                    >
                        <FiPlus className="w-4 h-4 shrink-0" />
                        Mi Lista
                    </button>
                </div>
            </div>

            {/*
             * Ken-burns keyframe — defined via inline <style> to avoid adding
             * a custom CSS file (Tailwind-only rule). The animation stops at
             * scale(1) so the image never looks distorted at rest.
             */}
            <style>{`
                @keyframes heroZoom {
                    from { transform: scale(1.04); }
                    to   { transform: scale(1);    }
                }
            `}</style>
        </section>
    )
}
