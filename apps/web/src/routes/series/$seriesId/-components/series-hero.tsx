import * as React from "react"
import { useRef, useState, useMemo } from "react"
import { useGSAP } from "@gsap/react"
import gsap from "gsap"
import { cn } from "@/components/ui/core/styling"
import { getHighResImage } from "@/lib/helpers/images"
import { Anime_Entry, Continuity_WatchHistoryItem } from "@/api/generated/types"
import { MediaActionButtons } from "../-series-interactivity-client"
import { sanitizeHtml } from "@/lib/helpers/sanitizer"
import { useIntelligenceStore } from "@/hooks/use-home-intelligence"
import { DeferredImage } from "@/components/shared/deferred-image"

// Pure helpers — defined outside component to avoid recreation on every render
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

const stringToColor = (str: string) => {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash)
    }
    const h = Math.abs(hash % 360)
    return `hsl(${h}, 60%, 15%)`
}

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
    const setBackdropUrl = useIntelligenceStore(s => s.setBackdropUrl)

    // Sync current backdrop with global DynamicBackdrop blur background
    React.useEffect(() => {
        if (backdropUrl) {
            setBackdropUrl(backdropUrl)
        }
        return () => {
            setBackdropUrl(null)
        }
    }, [backdropUrl, setBackdropUrl])

    useGSAP(() => {
        gsap.from(".hero-text-content > *", {
            y: 40,
            opacity: 0,
            duration: 1.4,
            stagger: 0.12,
            ease: "power4.out",
            delay: 0.2
        })
    }, { scope: containerRef })

    const synopsis = media.description || "Sin descripción disponible."
    const cleanSynopsis = useMemo(() => sanitizeHtml(synopsis), [synopsis])
    
    const title = media.titleSpanish || media.titleEnglish || media.titleRomaji || "Título Desconocido"
    const year = media.year?.toString() || ""
    
    const genres = useMemo(() => parseGenres(media.genres), [media.genres])
    const accentColor = useMemo(() => stringToColor(title), [title])
    const episodesCount = media.totalEpisodes || entry.episodes?.length || 0
    const localEpisodesCount = entry.localFiles?.length ?? 0
    const totalEpisodesCount = media.totalEpisodes || entry.episodes?.length || 0
    const score = media.score ? (media.score / 10).toFixed(1) : null

    return (
        <section 
            ref={containerRef}
            className={cn("relative w-full min-h-[85vh] md:min-h-[90vh] flex flex-col justify-end overflow-hidden bg-[#09090b] select-none", className)}
        >
            {/* Cinematic Grain Overlay — inline SVG noise, no external request */}
            <div className="absolute inset-0 opacity-[0.03] pointer-events-none mix-blend-overlay z-20"
                style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='1'/%3E%3C/svg%3E")`, backgroundSize: '128px 128px' }}
            />

            {/* Cinematic Ambient Halo / Gradient Fallback */}
            <div className="absolute inset-0 overflow-hidden bg-[#09090b] z-0">
                {media.posterImage ? (
                    <div
                        className="absolute left-1/2 top-0 -translate-x-1/2 w-full h-full opacity-35"
                        style={{
                            backgroundImage: `url(${getHighResImage(media.posterImage)})`,
                            backgroundSize: "cover",
                            backgroundPosition: "center 20%",
                            filter: "blur(120px) saturate(150%) brightness(0.4)",
                            willChange: "transform",
                            transform: "translateZ(0)",
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
            </div>

            {/* Backdrop (Cinematic Full-Bleed Overlay) */}
            {backdropUrl && (
                <div 
                    className="absolute inset-0 overflow-hidden cursor-pointer z-0"
                    onClick={onPlay}
                >
                    <DeferredImage
                        src={backdropUrl}
                        alt={title}
                        priority={true}
                        className="w-full h-full object-cover object-center opacity-50 grayscale-[0.05] transition-all duration-1000 scale-[1.01] group-hover/hero:scale-105 group-hover/hero:opacity-65"
                    />
                </div>
            )}

            {/* Dynamic Cinematic Gradient Masking */}
            <div className="absolute inset-0 bg-gradient-to-t from-[#09090b] via-[#09090b]/60 to-transparent opacity-100 z-10 pointer-events-none" />
            <div className="absolute inset-0 bg-gradient-to-r from-[#09090b]/80 via-transparent to-transparent opacity-100 z-10 pointer-events-none" />
            <div className="absolute inset-0 bg-gradient-to-b from-[#09090b]/20 via-transparent to-transparent opacity-100 z-10 pointer-events-none" />

            {/* Cinematic Overlaid Content - Centered in tercio inferior izquierdo */}
            <div className="hero-text-content relative z-20 flex flex-col justify-end items-start px-6 sm:px-12 md:pl-[240px] md:pr-24 pb-20 pt-48 max-w-[1400px] w-full gap-6">
                {/* Meta Tags & Score */}
                <div className="flex flex-wrap items-center gap-3">
                    {score && (
                        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-brand-orange to-amber-500 text-black font-black text-[10px] tracking-widest rounded-md shadow-[0_2px_15px_rgba(255,110,58,0.35)]">
                            <span className="text-xs">★</span>
                            {score} Ki
                        </div>
                    )}
                    {media.startDate && (
                        <div className="px-3 py-1.5 bg-white/5 backdrop-blur-md text-white/90 border border-white/10 rounded-md font-black text-[10px] tracking-widest uppercase">
                            {new Date(media.startDate).getFullYear()}
                        </div>
                    )}
                    <span className="px-3 py-1.5 bg-white/5 backdrop-blur-md text-white/80 border border-white/10 rounded-md font-black text-[10px] tracking-widest uppercase">
                        {media.format || "ANIME"}
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

                {/* Main Title (Bespoke Cinema Typography) */}
                <div className="flex flex-col gap-2">
                    <h1 
                        className="text-[clamp(2.5rem,6.5vw,7.5rem)] font-bebas font-normal leading-[0.9] tracking-wider text-white uppercase drop-shadow-[0_4px_30px_rgba(0,0,0,0.8)] cursor-pointer hover:text-brand-orange transition-colors duration-300"
                        onClick={onPlay}
                    >
                        {title}
                    </h1>
                </div>

                {/* Metadata Strip */}
                <div className="flex flex-wrap items-center gap-6 text-[10px] font-black uppercase tracking-[0.4em] text-zinc-500">
                    {year && <span className="text-white/80">{year}</span>}
                    {(totalEpisodesCount ?? 0) > 0 && localEpisodesCount !== undefined && localEpisodesCount > 0 ? (
                        <span className={cn(
                            "px-3 py-1 rounded-md border transition-colors",
                            localEpisodesCount >= (totalEpisodesCount ?? 0) 
                                ? "text-green-500 border-green-500/30 bg-green-500/5" 
                                : "text-brand-orange border-brand-orange/30 bg-brand-orange/5"
                        )}>
                            {`${localEpisodesCount}/${totalEpisodesCount} EPISODIOS`}
                        </span>
                    ) : episodesCount > 0 && (
                        <span className="px-3 py-1 rounded-md border border-white/10 bg-white/5">
                            {`${episodesCount} EPISODIOS`}
                        </span>
                    )}
                    {media.status && <span className="text-zinc-600">{media.status}</span>}
                </div>

                {/* Cinematic Synopsis (Overlay Readability Enhanced) */}
                <div className="max-w-3xl relative group/synopsis">
                    <div className="absolute -inset-4 bg-white/[0.01] border border-white/5 rounded-2xl opacity-0 group-hover/synopsis:opacity-100 transition-opacity duration-500 -z-10" />
                    <div 
                        className={cn(
                            "text-[16px] text-zinc-300 leading-[1.8] font-normal tracking-wide transition-all duration-500 antialiased drop-shadow",
                            synopsisExpanded ? "" : "line-clamp-3",
                        )}
                        dangerouslySetInnerHTML={{ __html: cleanSynopsis }}
                    />
                    {synopsis.length > 250 && (
                        <button
                            onClick={() => setSynopsisExpanded((v) => !v)}
                            className="mt-4 inline-flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.4em] text-zinc-500 hover:text-white transition-colors"
                        >
                            <span className="w-8 h-[1px] bg-zinc-800 group-hover/synopsis:bg-brand-orange transition-colors" />
                            {synopsisExpanded ? "LEER MENOS" : "LEER COMPLETO"}
                        </button>
                    )}
                </div>

                {/* Actions */}
                <div className="mt-2">
                    <MediaActionButtons seriesId={seriesId} directoryPath={directoryPath} onPlay={onPlay} continuityItem={continuityItem} />
                </div>
            </div>
        </section>
    )
})
HeroSection.displayName = "HeroSection"
