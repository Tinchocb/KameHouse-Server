import * as React from "react"
import { IconMediaPlay } from "@/components/ui/icons";
import { getMediumResImage } from "@/lib/helpers/images"
import type { SwimlaneItem } from "@/components/ui/swimlane"
import type { ERA_COLOR_MAP, EraId } from "@/lib/config/eras"
import { MoviePosterCard, moviePosterCardItemVariants } from "@/components/ui/movie-poster-card"

// Re-export para compatibilidad (la variante vive ahora en MoviePosterCard).
export const spotlightCardItemVariants = moviePosterCardItemVariants

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
        <MoviePosterCard
            image={posterSrc}
            title={movie.title}
            index={index}
            borderColor={`color-mix(in srgb, ${colors.glowStrong} 20%, rgba(255,255,255,0.1))`}
            titleHoverColor={colors.ambientGlow1}
            onMouseEnter={onHover}
            onClick={() => onNavigate(movie)}
            topLeft={indexLabel ? (
                <span className="text-2xs font-mono font-extrabold tracking-wider px-2 py-0.5 rounded-md bg-black/65 border border-white/20 text-white uppercase shadow-elevation-1 [text-shadow:0_1px_2px_rgba(0,0,0,0.9)]">
                    {indexLabel}
                </span>
            ) : null}
            topRight={isSpecial ? (
                <span className="text-2xs font-mono font-extrabold tracking-wider px-2 py-0.5 rounded-md bg-black/65 border border-white/20 text-white uppercase shadow-elevation-1 [text-shadow:0_1px_2px_rgba(0,0,0,0.9)]">
                    OVA
                </span>
            ) : null}
            bottomMeta={movie.year ? (
                <span className="font-mono text-2xs font-semibold uppercase tracking-wider">
                    AÑO {movie.year}
                </span>
            ) : null}
            centerOverlay={
                <button
                    type="button"
                    aria-label={`Reproducir ${movie.title}`}
                    onClick={(e) => {
                        e.stopPropagation()
                        onNavigate(movie)
                    }}
                    className="w-11 h-11 rounded-full flex items-center justify-center bg-white text-black ring-1 ring-white/40 shadow-[0_2px_12px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,1)] pointer-events-auto cursor-pointer transition-transform duration-150 hover:scale-110 active:scale-90 p-0 border-0"
                >
                    <IconMediaPlay size={18} fill="currentColor" className="ml-0.5" />
                </button>
            }
        />
    )
})
