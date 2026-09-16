import * as React from "react"
import { motion, type Variants } from "framer-motion"
import { IconMediaPlay } from "@/components/ui/icons";
import { cn } from "@/components/ui/core/styling"
import { getMediumResImage } from "@/lib/helpers/images"
import { DeferredImage } from "@/components/shared/deferred-image"
import type { SwimlaneItem } from "@/components/ui/swimlane"
import type { ERA_COLOR_MAP, EraId } from "@/lib/config/eras"

// Variantes con blur + spring suave: cada tarjeta recibe su indice via custom
// prop, lo que produce un stagger fluido (0.045 s x i) sin overhead de JS.
export const spotlightCardItemVariants: Variants = {
    hidden: { opacity: 0, y: 14, filter: "blur(8px)" },
    visible: (i: number = 0) => ({
        opacity: 1,
        y: 0,
        filter: "blur(0px)",
        transition: {
            type: "spring",
            stiffness: 280,
            damping: 28,
            delay: i * 0.045,
        },
    }),
    exit: {
        opacity: 0,
        y: -6,
        filter: "blur(4px)",
        transition: { duration: 0.15, ease: "easeIn" },
    },
}

export interface SpotlightMovieCardProps {
    movie: SwimlaneItem
    index?: number
    colors: typeof ERA_COLOR_MAP[EraId]
    onNavigate: (item: SwimlaneItem) => void
    onHover: () => void
}

export const SpotlightMovieCard = React.memo(function SpotlightMovieCard({
    movie,
    index,
    colors,
    onNavigate,
    onHover,
}: SpotlightMovieCardProps) {
    const posterSrc = movie.image
        ? (movie.image.startsWith("/") ? movie.image : getMediumResImage(movie.image))
        : (movie.backdropUrl || "")

    const isSpecial = movie.badge === "SPECIAL" || movie.badge === "OVA" || movie.title.toLowerCase().includes("especial") || movie.title.toLowerCase().includes("ova")
    const indexLabel = isSpecial ? "OVA" : (index !== undefined ? `#${String(index).padStart(2, '0')}` : undefined)

    return (
        <motion.div
            variants={spotlightCardItemVariants}
            custom={index ?? 0}
            onClick={() => onNavigate(movie)}
            onMouseEnter={onHover}
            className={cn(
                "group relative w-full aspect-[2/3] rounded-2xl overflow-hidden cursor-pointer border border-[var(--glass-border-side)] select-none shrink-0 bg-[var(--md-sys-color-surface-container)] transform-gpu",
                "transition-[transform,border-color,box-shadow] duration-200 hover:-translate-y-1 hover:scale-[1.02] active:scale-[0.97]",
                "hover:z-10 hover:shadow-[0_15px_35px_rgba(0,0,0,0.9)]"
            )}
            style={{
                borderColor: `color-mix(in srgb, ${colors.glowStrong} 20%, rgba(255,255,255,0.1))`,
                "--spotlight-title-hover": colors.ambientGlow1,
            } as React.CSSProperties}
        >
            <DeferredImage
                src={posterSrc}
                alt={movie.title}
                className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
            />

            {/* Top Badges */}
            <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between z-20 pointer-events-none">
                {indexLabel && (
                    <span className={cn(
                        "text-[9px] font-mono font-black tracking-wider px-2 py-0.5 rounded-md border shadow-elevation-1 uppercase",
                        isSpecial
                            ? "bg-[var(--glass-bg-strong)] text-[var(--brand-secondary-hex)] border-[var(--glass-border-top)]"
                            : "bg-[var(--glass-bg-strong)] text-on-surface border-[var(--glass-border-side)]"
                    )}>
                        {indexLabel}
                    </span>
                )}
                {movie.year && (
                    <span className="text-[9px] font-mono font-bold tracking-wider px-1.5 py-0.5 rounded-md bg-[var(--glass-bg-strong)] border border-[var(--glass-border-side)] text-on-surface-variant uppercase ml-auto">
                        {movie.year}
                    </span>
                )}
            </div>

            {/* Gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-transparent z-10" />

            {/* Play Button Overlay on Hover */}
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-20 pointer-events-none">
                <div
                    onClick={(e) => {
                        e.stopPropagation()
                        onNavigate(movie)
                    }}
                    className="w-12 h-12 rounded-full flex items-center justify-center text-on-primary bg-brand-accent shadow-xl shadow-brand-accent/50 pointer-events-auto cursor-pointer transition-transform duration-150 hover:scale-110 active:scale-90"
                >
                    <IconMediaPlay size={18} fill="currentColor" className="ml-0.5" />
                </div>
            </div>

            {/* Title at bottom */}
            <div className="absolute bottom-0 left-0 right-0 z-20 p-3 flex flex-col justify-end">
                <p className="text-white font-bold text-xs sm:text-sm uppercase tracking-wide leading-tight line-clamp-2 text-edge-glow group-hover:text-[var(--spotlight-title-hover)] transition-colors font-display">
                    {movie.title}
                </p>
            </div>
        </motion.div>
    )
})
