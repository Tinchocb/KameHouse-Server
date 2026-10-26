import * as React from "react"
import { IconMediaPlay } from "@/components/ui/icons";
import { getMediumResImage, localImage } from "@/lib/helpers/images"
import type { SwimlaneItem } from "@/components/ui/swimlane"
import type { ERA_COLOR_MAP, EraId } from "@/lib/config/eras"
import { MoviePosterCard, moviePosterCardItemVariants } from "@/components/ui/movie-poster-card"
import { Button } from "@/components/ui/button"

// Re-export para compatibilidad (la variante vive ahora en MoviePosterCard).
export const spotlightCardItemVariants = moviePosterCardItemVariants

interface SpotlightMovieCardProps {
    movie: SwimlaneItem
    index?: number
    colors: typeof ERA_COLOR_MAP[EraId]
    onNavigate: (item: SwimlaneItem) => void
    onHover: () => void
    className?: string
}

export const SpotlightMovieCard = React.memo(function SpotlightMovieCard({
    movie,
    index,
    colors,
    onNavigate,
    onHover,
    className,
}: SpotlightMovieCardProps) {
    const posterSrc = movie.image
        ? (movie.image.startsWith("/") ? movie.image : localImage(getMediumResImage(movie.image)))
        : (movie.backdropUrl || "")

    const isSpecial = movie.badge === "SPECIAL" || movie.badge === "OVA" || movie.title.toLowerCase().includes("especial") || movie.title.toLowerCase().includes("ova")
    const typeLabel = isSpecial ? (movie.badge === "OVA" ? "OVA" : "Especial") : "Película"
    const indexLabel = index !== undefined ? `#${String(index).padStart(2, "0")}` : undefined
    const scoreFormatted = movie.rating ? (movie.rating / 10).toFixed(1) : undefined

    return (
        <MoviePosterCard
            image={posterSrc}
            title={movie.title}
            index={index}
            sharedKey={movie.mediaId ? `movies:${movie.mediaId}` : undefined}
            borderColor={`color-mix(in srgb, ${colors.glowStrong} 25%, rgba(255,255,255,0.12))`}
            titleHoverColor={colors.ambientGlow1}
            eraColor={colors.accent}
            year={movie.year}
            score={scoreFormatted}
            typeLabel={typeLabel}
            isSpecial={isSpecial}
            indexLabel={indexLabel}
            synopsis={movie.description}
            onMouseEnter={onHover}
            onClick={() => onNavigate(movie)}
            className={className}
            actions={
                <Button
                    type="button"
                    intent="primary"
                    size="xs"
                    aria-label={`Reproducir ${movie.title}`}
                    onClick={(e) => {
                        e.stopPropagation()
                        onNavigate(movie)
                    }}
                    className="flex-1 gap-1.5 shadow-[shadow:var(--shadow-play-cta)]"
                >
                    <IconMediaPlay size={14} fill="currentColor" />
                    <span>Reproducir</span>
                </Button>
            }
        />
    )
})
