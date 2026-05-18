import * as React from "react"
import { useRef, useState, useMemo } from "react"
import { useGSAP } from "@gsap/react"
import gsap from "gsap"
import { cn } from "@/components/ui/core/styling"
import { getHighResImage } from "@/lib/helpers/images"
import { Anime_Entry, Continuity_WatchHistoryItem } from "@/api/generated/types"
import { ClassicPosterCard } from "@/components/shared/classic-poster-card"
import { MediaActionButtons } from "../-series-interactivity-client"
import { sanitizeHtml } from "@/lib/helpers/sanitizer"

interface HeroSectionProps {
    seriesId: string
    directoryPath: string
    backdropUrl: string
    entry: Anime_Entry
    onPlay?: () => void
    continuityItem?: Continuity_WatchHistoryItem | null
    className?: string
}

export const HeroSection = React.memo(function HeroSection({
    seriesId,
    directoryPath,
    backdropUrl,
    entry,
    onPlay,
    continuityItem,
    className
}: HeroSectionProps) {
    const containerRef = useRef<HTMLElement>(null)
    const [synopsisExpanded, setSynopsisExpanded] = useState(false)
    const media = entry.media!

    useGSAP(() => {
        gsap.from(".hero-content > *", {
            y: 30,
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
                return JSON.parse(atob(g)) as string[]
            } catch {
                return []
            }
        }
        return []
    }
    const genres = parseGenres(media.genres)
    
    const episodesCount = media.totalEpisodes || entry.episodes?.length || 0
    const localEpisodesCount = entry.localFiles?.length ?? 0
    const totalEpisodesCount = media.totalEpisodes || entry.episodes?.length || 0
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
            className={cn("relative w-full min-h-[85vh] flex flex-col justify-end overflow-hidden", className)}
        >
            {/* Cinematic Grain Overlay */}
            <div className="absolute inset-0 opacity-[0.03] pointer-events-none mix-blend-overlay z-20"
                style={{ backgroundImage: `url("https://grainy-gradients.vercel.app/noise.svg")` }}
            />

            {/* Cinematic Ambient Halo / Gradient Fallback */}
            <div className="absolute inset-0 overflow-hidden bg-[#09090b]">
                {media.posterImage ? (
                    <div
                        className="absolute left-1/2 top-0 -translate-x-1/2 w-full h-full opacity-30"
                        style={{
                            backgroundImage: `url(${getHighResImage(media.posterImage)})`,
                            backgroundSize: "cover",
                            backgroundPosition: "center 20%",
                            filter: "blur(120px) saturate(150%) brightness(0.5)",
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
                <div className="absolute inset-0 bg-gradient-to-r from-[#09090b] via-[#09090b]/40 to-transparent opacity-90" />
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
                        className="w-full h-full object-cover object-center opacity-40 grayscale-[0.1] transition-all duration-1000 scale-[1.01] group-hover/hero:scale-105 group-hover/hero:opacity-60"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#09090b] via-[#09090b]/40 to-transparent transition-opacity group-hover/hero:opacity-60" />
                    <div className="absolute inset-0 bg-gradient-to-r from-[#09090b] via-transparent to-transparent transition-opacity group-hover/hero:opacity-60" />
                    

                </div>
            )}

            {/* Content */}
            <div className="hero-content relative z-10 flex flex-col lg:flex-row items-end gap-12 px-6 sm:px-12 pb-24 pt-40 max-w-[1800px] mx-auto w-full">
                {/* Cover Poster (Hero Version) */}
                <div className="hidden lg:block w-[340px] shrink-0 relative z-10">
                    <ClassicPosterCard 
                        entry={entry} 
                        className="w-full hover:scale-105 transition-transform duration-500" 
                        onClick={onPlay} 
                        posterUrlOverride={getHighResImage(media.posterImage)} 
                    />
                </div>

                {/* Meta Information */}
                <div className="flex-1 flex flex-col gap-10 min-w-0 pb-4">
                    {/* Tags & Score */}
                    <div className="flex flex-wrap items-center gap-4">
                        {score && (
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-brand-orange text-black rounded-md font-black text-[10px] tracking-widest">
                                <span className="text-sm">★</span>
                                {score}
                            </div>
                        )}
                        {media.startDate && (
                            <div className="px-3 py-1.5 bg-white/5 backdrop-blur-md text-white/90 border border-white/10 rounded-md font-black text-[10px] tracking-widest uppercase">
                                {new Date(media.startDate).getFullYear()}
                            </div>
                        )}
                        <div className="flex flex-wrap gap-2">
                            {genres.slice(0, 4).map((g: string) => (
                                <span
                                    key={g}
                                    className="px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.25em] bg-white/5 backdrop-blur-md text-white/70 border border-white/10 rounded-md"
                                >
                                    {g}
                                </span>
                            ))}
                        </div>
                    </div>

                    {/* Main Title */}
                    <div className="flex flex-col gap-2">
                        <h1 
                            className="text-[clamp(3rem,7vw,9rem)] font-bebas font-normal leading-[0.8] tracking-tighter text-white uppercase drop-shadow-[0_10px_30px_rgba(0,0,0,0.5)] cursor-pointer"
                            onClick={onPlay}
                        >
                            {title}
                        </h1>
                    </div>

                    {/* Metadata Strip */}
                    <div className="flex flex-wrap items-center gap-8 text-[10px] font-black uppercase tracking-[0.4em] text-zinc-500">
                        {year && <span className="text-white/80">{year}</span>}
                        {(totalEpisodesCount ?? 0) > 0 && localEpisodesCount !== undefined && localEpisodesCount > 0 ? (
                            <span className={cn(
                                "px-3 py-1 rounded-md border transition-colors",
                                localEpisodesCount >= (totalEpisodesCount ?? 0) 
                                    ? "text-green-500 border-green-500/30 bg-green-500/5" 
                                    : "text-brand-orange border-brand-orange/30 bg-brand-orange/5"
                            )}>
                                {media.format === "MOVIE" || media.format === "SPECIAL" || media.format === "OVA"
                                    ? "PELÍCULA"
                                    : `${localEpisodesCount}/${totalEpisodesCount} EPISODIOS`}
                            </span>
                        ) : episodesCount > 0 ? (
                            <span className="px-3 py-1 rounded-md border border-white/10 bg-white/5">
                                {media.format === "MOVIE" || media.format === "SPECIAL" || media.format === "OVA"
                                    ? "PELÍCULA"
                                    : `${episodesCount} EPISODIOS`}
                            </span>
                        ) : (
                            // Fallback para cuando no hay conteo de episodios locales pero es formato película
                            (media.format === "MOVIE" || media.format === "SPECIAL" || media.format === "OVA") && (
                                <span className="px-3 py-1 rounded-md border border-white/10 bg-white/5">
                                    PELÍCULA
                                </span>
                            )
                        )}
                        {/* Renderizar formato solo si no es película/especial/ova, para evitar redundancia con el badge de PELÍCULA */}
                        {media.format && media.format !== "MOVIE" && media.format !== "SPECIAL" && media.format !== "OVA" && (
                            <span className="px-3 py-1 rounded-md border border-white/10 bg-white/5">{media.format}</span>
                        )}
                        {media.status && <span className="text-zinc-600">{media.status}</span>}
                    </div>

                    {/* Cinematic Synopsis */}
                    <div className="max-w-3xl relative group/synopsis">
                        <div className="absolute -inset-4 bg-white/[0.02] border border-white/5 rounded-2xl opacity-0 group-hover/synopsis:opacity-100 transition-opacity duration-500 -z-10" />
                        <div 
                            className={cn(
                                "text-[18px] text-zinc-200 leading-[1.8] font-normal tracking-wide transition-all duration-500 antialiased",
                                synopsisExpanded ? "" : "line-clamp-4",
                            )}
                            dangerouslySetInnerHTML={{ __html: cleanSynopsis }}
                        />
                        {synopsis.length > 300 && (
                            <button
                                onClick={() => setSynopsisExpanded((v) => !v)}
                                className="mt-6 inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.4em] text-zinc-500 hover:text-white transition-colors"
                            >
                                <span className="w-8 h-[1px] bg-zinc-800 group-hover/synopsis:bg-brand-orange transition-colors" />
                                {synopsisExpanded ? "LEER MENOS" : "LEER COMPLETO"}
                            </button>
                        )}
                    </div>

                    {/* Actions */}
                    <div className="mt-4">
                        <MediaActionButtons seriesId={seriesId} directoryPath={directoryPath} onPlay={onPlay} continuityItem={continuityItem} />
                    </div>
                </div>
            </div>
        </section>
    )
})
HeroSection.displayName = "HeroSection"
