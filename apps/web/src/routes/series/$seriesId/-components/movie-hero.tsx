import * as React from "react"
import { useRef, useMemo } from "react"
import { useGSAP } from "@gsap/react"
import gsap from "gsap"
import { cn } from "@/components/ui/core/styling"
import { getHighResImage } from "@/lib/helpers/images"
import { Anime_Entry, Continuity_WatchHistoryItem } from "@/api/generated/types"
import { ClassicPosterCard } from "@/components/shared/classic-poster-card"
import { MediaActionButtons } from "../-series-interactivity-client"
import { sanitizeHtml } from "@/lib/helpers/sanitizer"

interface MovieHeroSectionProps {
    seriesId: string
    directoryPath: string
    backdropUrl: string
    entry: Anime_Entry
    onPlay?: () => void
    continuityItem?: Continuity_WatchHistoryItem | null
    className?: string
}

export const MovieHeroSection = React.memo(function MovieHeroSection({
    seriesId,
    directoryPath,
    backdropUrl,
    entry,
    onPlay,
    continuityItem,
    className
}: MovieHeroSectionProps) {
    const containerRef = useRef<HTMLElement>(null)
    const media = entry.media!

    useGSAP(() => {
        gsap.from(".movie-hero-content > *", {
            y: 40,
            opacity: 0,
            duration: 1.4,
            stagger: 0.15,
            ease: "power4.out",
            delay: 0.2
        })
    }, { scope: containerRef })

    const synopsis = media.description || "Sin descripción disponible."
    const cleanSynopsis = useMemo(() => sanitizeHtml(synopsis), [synopsis])
    
    const title = media.titleSpanish || media.titleEnglish || media.titleRomaji || "Título Desconocido"
    const year = media.year?.toString() || ""
    
    const parseGenres = (g: string | string[] | undefined | null): string[] => {
        if (!g) return []
        if (Array.isArray(g)) return g as string[]
        if (typeof g === "string") {
            try {
                if (g.startsWith("[")) return JSON.parse(g) as string[]
                const decoded = atob(g)
                if (decoded.startsWith("[")) return JSON.parse(decoded) as string[]
            } catch {
                return []
            }
        }
        return []
    }
    const genres = parseGenres(media.genres)
    const score = media.score ? (media.score / 10).toFixed(1) : null

    // Dynamic gradient fallback if no backdrop
    const stringToColor = (str: string) => {
        let hash = 0
        for (let i = 0; i < str.length; i++) {
            hash = str.charCodeAt(i) + ((hash << 5) - hash)
        }
        const h = Math.abs(hash % 360)
        return `hsl(${h}, 60%, 15%)`
    }
    const accentColor = stringToColor(title)

    return (
        <section 
            ref={containerRef}
            className={cn("relative w-full min-h-[75vh] xl:min-h-[85vh] flex flex-col justify-end overflow-hidden", className)}
        >
            {/* Cinematic Grain Overlay */}
            <div className="absolute inset-0 opacity-[0.03] pointer-events-none mix-blend-overlay z-20"
                style={{ backgroundImage: `url("https://grainy-gradients.vercel.app/noise.svg")` }}
            />

            {/* Cinematic Ambient Halo / Gradient Fallback */}
            <div className="absolute inset-0 overflow-hidden bg-[#09090b]">
                {media.posterImage ? (
                    <div
                        className="absolute left-1/2 top-0 -translate-x-1/2 w-full h-full opacity-35"
                        style={{
                            backgroundImage: `url(${getHighResImage(media.posterImage)})`,
                            backgroundSize: "cover",
                            backgroundPosition: "center 20%",
                            filter: "blur(120px) saturate(150%) brightness(0.4)",
                        }}
                    />
                ) : (
                    <div 
                        className="absolute inset-0 opacity-40 blur-[150px]"
                        style={{ 
                            background: `radial-gradient(circle at 50% 30%, ${accentColor}, transparent 80%)` 
                        }}
                    />
                )}
                {/* Master Gradients for Depth */}
                <div className="absolute inset-0 bg-gradient-to-t from-[#09090b] via-[#09090b]/40 to-transparent opacity-100" />
                <div className="absolute inset-0 bg-gradient-to-r from-[#09090b] via-[#09090b]/40 to-transparent opacity-95" />
                <div className="absolute inset-0 bg-gradient-to-b from-[#09090b]/20 via-transparent to-transparent" />
            </div>

            {/* Backdrop (Cinematic Overlay) */}
            {backdropUrl && (
                <div 
                    className="absolute inset-0 overflow-hidden cursor-pointer"
                    onClick={onPlay}
                >
                    <img
                        src={backdropUrl}
                        alt={title}
                        fetchPriority="high"
                        className="w-full h-full object-cover object-center opacity-45 grayscale-[0.05] transition-all duration-1000 scale-[1.01] group-hover/hero:scale-105 group-hover/hero:opacity-65"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#09090b] via-[#09090b]/30 to-transparent transition-opacity group-hover/hero:opacity-60" />
                    <div className="absolute inset-0 bg-gradient-to-r from-[#09090b] via-transparent to-transparent transition-opacity group-hover/hero:opacity-60" />
                    

                </div>
            )}

            {/* Content */}
            <div className="movie-hero-content relative z-10 flex flex-col lg:flex-row items-end gap-12 px-6 sm:px-12 pb-20 pt-40 max-w-[1800px] mx-auto w-full">
                {/* Cover Poster (Hero Version) */}
                <div className="hidden lg:block w-[300px] shrink-0 relative z-10">
                    <ClassicPosterCard 
                        entry={entry} 
                        className="w-full hover:scale-105 transition-transform duration-500 border border-white/5 shadow-2xl rounded-2xl overflow-hidden" 
                        onClick={onPlay} 
                        posterUrlOverride={getHighResImage(media.posterImage)} 
                    />
                </div>

                {/* Meta Information */}
                <div className="flex-1 flex flex-col gap-8 min-w-0 pb-4">
                    {/* Tags & Score */}
                    <div className="flex flex-wrap items-center gap-4">
                        {score && (
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-brand-orange text-black rounded-md font-black text-[10px] tracking-widest">
                                <span className="text-sm">★</span>
                                {score}
                            </div>
                        )}
                        {year && (
                            <div className="px-3 py-1.5 bg-white/5 backdrop-blur-md text-white/90 border border-white/10 rounded-md font-black text-[10px] tracking-widest uppercase">
                                {year}
                            </div>
                        )}
                        <span className="px-3 py-1.5 bg-white/5 backdrop-blur-md text-white/80 border border-white/10 rounded-md font-black text-[10px] tracking-widest uppercase">
                            PELÍCULA
                        </span>
                        <div className="flex flex-wrap gap-2">
                            {genres.slice(0, 3).map((g: string) => (
                                <span
                                    key={g}
                                    className="px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.25em] bg-white/5 backdrop-blur-md text-white/60 border border-white/10 rounded-md"
                                >
                                    {g}
                                </span>
                            ))}
                        </div>
                    </div>

                    {/* Main Title */}
                    <div className="flex flex-col gap-2">
                        <h1 
                            className="text-[clamp(2.5rem,6vw,7.5rem)] font-bebas font-normal leading-[0.85] tracking-tighter text-white uppercase drop-shadow-[0_10px_30px_rgba(0,0,0,0.5)] cursor-pointer"
                            onClick={onPlay}
                        >
                            {title}
                        </h1>
                    </div>

                    {/* Actions */}
                    <div className="mt-2">
                        <MediaActionButtons seriesId={seriesId} directoryPath={directoryPath} onPlay={onPlay} continuityItem={continuityItem} />
                    </div>
                </div>
            </div>
        </section>
    )
})
MovieHeroSection.displayName = "MovieHeroSection"
