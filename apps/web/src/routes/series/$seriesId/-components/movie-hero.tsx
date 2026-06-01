import * as React from "react"
import { useRef, useMemo } from "react"
import { useGSAP } from "@gsap/react"
import gsap from "gsap"
import { cn } from "@/components/ui/core/styling"
import { getHighResImage, getMediumResImage, getLowResImage } from "@/lib/helpers/images"
import { Anime_Entry, Continuity_WatchHistoryItem } from "@/api/generated/types"
import { useIntelligenceStore } from "@/hooks/use-home-intelligence"
import { Play, Sparkles, Star, Heart, Check, Film, ListPlus, Settings2, ExternalLink } from "lucide-react"
import { useUpdateAnimeEntryProgress } from "@/api/hooks/anime_entries.hooks"
import { DeferredImage } from "@/components/shared/deferred-image"
import { useAppStore } from "@/lib/store"
import { toast } from "sonner"
import { ManualMatchModal } from "@/components/shared/manual-match-modal"

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
    const backdropRef = useRef<HTMLDivElement>(null)
    const media = entry.media!
    const setBackdropUrl = useIntelligenceStore(s => s.setBackdropUrl)
    const [isMatchModalOpen, setIsMatchModalOpen] = React.useState(false)

    // Sync current backdrop with global DynamicBackdrop blur background
    React.useEffect(() => {
        if (backdropUrl) {
            setBackdropUrl(backdropUrl)
        }
        return () => {
            setBackdropUrl(null)
        }
    }, [backdropUrl, setBackdropUrl])

    // Smooth Parallax capture scroll listener (independent of window scroll)
    React.useEffect(() => {
        const handleScroll = (e: Event) => {
            const target = e.target as HTMLElement
            if (target && target.scrollHeight > target.clientHeight) {
                if (!backdropRef.current) return
                const scrolled = target.scrollTop
                backdropRef.current.style.transform = `translate3d(0, ${scrolled * 0.45}px, 0)`
            }
        }
        window.addEventListener("scroll", handleScroll, { capture: true, passive: true })
        return () => window.removeEventListener("scroll", handleScroll, { capture: true })
    }, [])

    useGSAP(() => {
        gsap.from(".movie-hero-animate", {
            y: 30,
            opacity: 0,
            duration: 1.2,
            stagger: 0.12,
            ease: "power4.out",
            delay: 0.1
        })
    }, { scope: containerRef })
    
    const title = media.titleSpanish || media.titleEnglish || media.titleRomaji || "Título Desconocido"
    const year = media.year?.toString() || ""
    const score = media.score ? (media.score / 10).toFixed(1) : null

    // 1. Duration Calculation & Formatting
    const durationMins = useMemo(() => {
        const epLength = entry.episodes?.[0]?.episodeMetadata?.length
        if (epLength) return epLength
        const historyDuration = continuityItem?.duration
        if (historyDuration) return Math.round(historyDuration / 60)
        return null
    }, [entry, continuityItem])

    const formattedDuration = useMemo(() => {
        if (!durationMins) return null
        const h = Math.floor(durationMins / 60)
        const m = durationMins % 60
        return h > 0 ? `${h}h ${m}m` : `${m}m`
    }, [durationMins])

    // 2. Technical details from files
    const tech = entry.localFiles?.[0]?.technicalInfo
    
    const qualityBadge = useMemo(() => {
        if (!tech?.videoStream) return null
        const w = tech.videoStream.width
        if (w === undefined) return null
        if (w >= 3840) return "4K ULTRA HD"
        if (w >= 1920) return "1080P FHD"
        if (w >= 1280) return "720P HD"
        return null
    }, [tech])

    const codecBadge = useMemo(() => {
        if (!tech?.videoStream?.codec) return null
        const c = tech.videoStream.codec.toLowerCase()
        if (c.includes("hevc") || c.includes("x265") || c.includes("h265")) return "HEVC"
        if (c.includes("avc") || c.includes("x264") || c.includes("h264")) return "AVC"
        return c.toUpperCase()
    }, [tech])

    const audioBadge = useMemo(() => {
        if (!tech?.audioStreams || tech.audioStreams.length === 0) return null
        const langs = tech.audioStreams.map(a => a.language?.toLowerCase() || "")
        const hasSpa = langs.some(l => l.includes("spa") || l.includes("esp") || l.includes("lat"))
        const hasJpn = langs.some(l => l.includes("jap") || l.includes("jpn"))
        const labels: string[] = []
        if (hasSpa) labels.push("ESPAÑOL")
        if (hasJpn) labels.push("JAPONÉS")
        return labels.length > 0 ? labels.join(" / ") : null
    }, [tech])

    // 3. User actions state & progress mutation
    const initialWatched = useMemo(() => {
        return entry.episodes?.[0]?.watched || false
    }, [entry])
    const [isWatched, setIsWatched] = React.useState(initialWatched)
    React.useEffect(() => {
        setIsWatched(initialWatched)
    }, [initialWatched])

    const [isFavorite, setIsFavorite] = React.useState(false)
    const { mutate: updateProgress } = useUpdateAnimeEntryProgress(Number(seriesId), 1, false)

    const addToQueue = useAppStore(state => state.addToQueue)

    const handleAddToQueue = (e: React.MouseEvent) => {
        e.stopPropagation()
        if (entry.localFiles && entry.localFiles.length > 0) {
            const localFile = entry.localFiles[0]
            const epNum = localFile.parsedInfo?.episode || localFile.metadata?.episode || 1
            
            addToQueue({
                id: entry.mediaId!,
                title: title,
                playableUrl: localFile.path || "",
                thumbnail: getMediumResImage(media.posterImage || ""),
                mediaId: entry.mediaId!,
                episodeNumber: Number(epNum),
                malId: media.idMal ?? null,
                mediaFormat: media.format ?? "MOVIE"
            })
            toast.success("Añadido a la cola de reproducción")
        } else {
            toast.error("No hay archivos locales disponibles para reproducir.")
        }
    }

    const handleToggleWatched = (e: React.MouseEvent) => {
        e.stopPropagation()
        const nextState = !isWatched
        setIsWatched(nextState)
        
        updateProgress({
            mediaId: Number(seriesId),
            progress: nextState ? 1 : 0,
        })
        
        toast.success(nextState ? "Marcada como vista" : "Quitada de vistas")
    }

    const handleToggleFavorite = (e: React.MouseEvent) => {
        e.stopPropagation()
        setIsFavorite(prev => !prev)
        toast.success(!isFavorite ? "Añadida a favoritos" : "Quitada de favoritos")
    }

    const progressPercent = useMemo(() => {
        if (!continuityItem || !continuityItem.duration) return 0
        return (continuityItem.currentTime / continuityItem.duration) * 100
    }, [continuityItem])

    // Dynamic gradient fallback if no backdrop
    const stringToColor = (str: string) => {
        let hash = 0
        for (let i = 0; i < str.length; i++) {
            hash = str.charCodeAt(i) + ((hash << 5) - hash)
        }
        const h = Math.abs(hash % 360)
        return `hsl(${h}, 60%, 12%)`
    }
    const accentColor = stringToColor(title)

    return (
        <section 
            ref={containerRef}
            className={cn("relative w-full min-h-[75vh] md:min-h-[85vh] flex flex-col justify-end overflow-hidden bg-[#09090b] select-none", className)}
        >
            {/* Cinematic Grain Overlay */}
            <div className="absolute inset-0 opacity-[0.03] pointer-events-none mix-blend-overlay z-20"
                style={{ backgroundImage: `url("https://grainy-gradients.vercel.app/noise.svg")` }}
            />

            {/* Ambient Blur Background */}
            <div className="absolute inset-0 overflow-hidden bg-[#09090b] z-0">
                {media.posterImage ? (
                    <div
                        className="absolute left-1/2 top-0 -translate-x-1/2 w-full h-full opacity-30"
                        style={{
                            backgroundImage: `url(${getLowResImage(media.posterImage)})`,
                            backgroundSize: "cover",
                            backgroundPosition: "center 20%",
                            filter: "blur(120px) saturate(150%) brightness(0.3)",
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

            {/* High Res Crisp Backdrop */}
            {backdropUrl && (
                <div 
                    ref={backdropRef}
                    className="absolute inset-0 overflow-hidden cursor-pointer z-0 will-change-transform"
                    onClick={onPlay}
                >
                    <DeferredImage
                        src={backdropUrl}
                        alt={title}
                        className="w-full h-full object-cover object-center opacity-45 grayscale-[0.05] transition-all duration-1000 scale-[1.01] group-hover/hero:scale-105 group-hover/hero:opacity-60"
                    />
                </div>
            )}

            {/* Cinematic Gradient Masking */}
            <div className="absolute inset-0 bg-gradient-to-t from-[#09090b] via-[#09090b]/50 to-transparent opacity-100 z-10 pointer-events-none" />
            <div className="absolute inset-0 bg-gradient-to-r from-[#09090b]/90 via-transparent to-transparent opacity-100 z-10 pointer-events-none" />
            <div className="absolute inset-0 bg-gradient-to-b from-[#09090b]/15 via-transparent to-transparent opacity-100 z-10 pointer-events-none" />

            {/* Content (Bottom Left) */}
            <div className="relative z-20 flex flex-col justify-end items-start px-6 sm:px-12 md:pl-[240px] md:pr-24 pb-16 pt-48 max-w-[1500px] w-full gap-5">
                
                {/* Meta details (above title) */}
                <div className="movie-hero-animate flex flex-wrap items-center gap-3">
                    {score && (
                        <div className="flex items-center gap-1 px-2.5 py-1 bg-gradient-to-r from-brand-orange to-amber-500 text-black font-black text-[10px] tracking-widest rounded shadow-md">
                            <Star size={10} fill="currentColor" className="stroke-none" />
                            {score} Ki
                        </div>
                    )}
                    {year && (
                        <div className="px-2.5 py-1 bg-white/5 backdrop-blur-md text-white/80 border border-white/10 rounded font-black text-[10px] tracking-widest uppercase">
                            {year}
                        </div>
                    )}
                    {formattedDuration && (
                        <div className="px-2.5 py-1 bg-white/5 backdrop-blur-md text-white/80 border border-white/10 rounded font-black text-[10px] tracking-widest uppercase">
                            {formattedDuration}
                        </div>
                    )}
                    <span className="px-2.5 py-1 bg-gradient-to-r from-brand-orange/20 to-orange-500/20 backdrop-blur-md text-brand-orange border border-brand-orange/30 rounded font-black text-[10px] tracking-widest uppercase flex items-center gap-1 shadow-sm">
                        <Film size={10} className="animate-pulse" />
                        PELÍCULA
                    </span>
                    
                    {/* Quality Badges */}
                    {qualityBadge && (
                        <span className="px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-emerald-400 bg-emerald-950/20 border border-emerald-500/30 rounded">
                            {qualityBadge}
                        </span>
                    )}
                    {codecBadge && (
                        <span className="px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-indigo-400 bg-indigo-950/20 border border-indigo-500/30 rounded">
                            {codecBadge}
                        </span>
                    )}
                    {audioBadge && (
                        <span className="px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-zinc-400 bg-white/5 border border-white/10 rounded">
                            {audioBadge}
                        </span>
                    )}
                </div>

                {/* Main Cinematic Title */}
                <div className="movie-hero-animate flex flex-col gap-1">
                    <h1 
                        className="text-[clamp(2.5rem,6vw,7rem)] font-bebas font-normal leading-[0.9] tracking-wider text-white uppercase drop-shadow-[0_4px_30px_rgba(0,0,0,0.85)] cursor-pointer hover:text-brand-orange transition-colors duration-300"
                        onClick={onPlay}
                    >
                        {title}
                    </h1>
                </div>

                {/* Action Row */}
                <div className="movie-hero-animate flex flex-wrap items-center gap-4 mt-3">
                    
                    {/* Main Play Button */}
                    <button
                        onClick={onPlay}
                        className="group/play relative flex items-center gap-4 px-8 py-4 bg-gradient-to-r from-brand-orange via-orange-500 to-amber-500 text-white rounded-2xl overflow-hidden shadow-[0_10px_35px_rgba(255,110,58,0.3)] hover:shadow-[0_15px_45px_rgba(255,110,58,0.5)] transition-all duration-500 hover:scale-105 active:scale-95 border border-white/10 hover:border-brand-orange/40"
                    >
                        {/* Glossy shine */}
                        <div className="absolute inset-0 bg-gradient-to-tr from-white/20 via-transparent to-transparent opacity-0 group-hover/play:opacity-100 transition-opacity duration-500 z-0" />
                        {/* Glow halo */}
                        <div className="absolute -inset-10 bg-brand-orange/30 blur-xl group-hover/play:opacity-100 opacity-0 transition-opacity duration-500 -z-10 animate-pulse" />

                        <div className="p-2.5 bg-black/40 backdrop-blur-xl rounded-xl border border-white/10 text-white group-hover/play:bg-white group-hover/play:text-black transition-all duration-300 shadow-inner z-10 shrink-0">
                            <Play className="w-4 h-4 fill-current" />
                        </div>
                        
                        <div className="flex flex-col items-start z-10 select-none text-left">
                            <span className="font-bebas text-[16px] tracking-[0.2em] font-black uppercase text-white transition-colors">
                                {continuityItem && continuityItem.currentTime ? "Reanudar Película" : "Reproducir Película"}
                            </span>
                            {continuityItem && continuityItem.currentTime ? (
                                <span className="text-[9px] font-black text-white/60 tracking-[0.1em] uppercase transition-colors mt-0.5">
                                    Minuto {Math.round(continuityItem.currentTime / 60)} ({Math.round(progressPercent)}%)
                                </span>
                            ) : (
                                <span className="text-[9px] font-black text-white/60 tracking-[0.1em] uppercase transition-colors mt-0.5">
                                    Comenzar desde el inicio
                                </span>
                            )}
                        </div>
                    </button>

                    {/* Secondary: Agregar a la cola */}
                    {entry.localFiles && entry.localFiles.length > 0 && (
                        <button
                            onClick={handleAddToQueue}
                            className="flex items-center justify-center p-4 rounded-2xl border bg-white/5 border-white/10 text-white/70 hover:text-white hover:bg-white/10 hover:border-white/20 transition-all duration-300 hover:scale-105 active:scale-95 animate-fade-in"
                            title="Agregar a la cola de reproducción"
                        >
                            <ListPlus className="w-5 h-5" />
                        </button>
                    )}

                    {/* Secondary: Agregar a Favoritos */}
                    <button
                        onClick={handleToggleFavorite}
                        className={cn(
                            "flex items-center justify-center p-4 rounded-2xl border transition-all duration-300 hover:scale-105 active:scale-95",
                            isFavorite
                                ? "bg-red-500/10 border-red-500/40 text-red-500 hover:bg-red-500/20"
                                : "bg-white/5 border-white/10 text-white/70 hover:text-white hover:bg-white/10 hover:border-white/20"
                        )}
                        title={isFavorite ? "Quitar de favoritos" : "Añadir a favoritos"}
                    >
                        <Heart className="w-5 h-5" fill={isFavorite ? "currentColor" : "none"} />
                    </button>

                    {/* Secondary: Marcar como vista */}
                    <button
                        onClick={handleToggleWatched}
                        className={cn(
                            "flex items-center justify-center p-4 rounded-2xl border transition-all duration-300 hover:scale-105 active:scale-95",
                            isWatched
                                ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/20"
                                : "bg-white/5 border-white/10 text-white/70 hover:text-white hover:bg-white/10 hover:border-white/20"
                        )}
                        title={isWatched ? "Marcar como no vista" : "Marcar como vista"}
                    >
                        <Check className={cn("w-5 h-5", isWatched && "stroke-[3px]")} />
                    </button>

                    {/* Secondary: MyAnimeList Link */}
                    {media.idMal && (
                        <a
                            href={`https://myanimelist.net/anime/${media.idMal}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-center gap-2 px-6 py-4 rounded-2xl border bg-[#2e51a2]/15 border-[#2e51a2]/30 text-blue-400 hover:text-white hover:bg-[#2e51a2]/25 hover:border-[#2e51a2]/55 transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer text-[11px] font-black uppercase tracking-[0.2em]"
                            title="Ver en MyAnimeList"
                        >
                            <span>MyAnimeList</span>
                            <ExternalLink size={14} />
                        </a>
                    )}

                    {/* Secondary: Corregir Vinculación (Fix Match) */}
                    {directoryPath && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation()
                                setIsMatchModalOpen(true)
                            }}
                            className="flex items-center justify-center p-4 rounded-2xl border bg-white/5 border-white/10 text-white/70 hover:text-white hover:bg-[#ff6b00]/10 hover:border-[#ff6b00]/30 hover:text-[#ff6b00] transition-all duration-300 hover:scale-105 active:scale-95"
                            title="Corregir Vinculación (Fix Match)"
                        >
                            <Settings2 className="w-5 h-5" />
                        </button>
                    )}
                </div>

                {/* Progress bar underneath if in progress */}
                {continuityItem && continuityItem.currentTime && (
                    <div className="movie-hero-animate w-full max-w-xs mt-1 h-[4px] bg-white/5 border border-white/10 rounded-full overflow-hidden shadow-inner relative z-10">
                        <div 
                            className="h-full bg-gradient-to-r from-brand-orange to-amber-500 shadow-[0_0_10px_rgba(255,110,58,0.8)] animate-pulse"
                            style={{ width: `${progressPercent}%` }}
                        />
                    </div>
                )}
            </div>

            <ManualMatchModal
                isOpen={isMatchModalOpen}
                onClose={() => setIsMatchModalOpen(false)}
                directoryPath={directoryPath}
                currentMediaId={entry.mediaId ?? Number(seriesId)}
            />
        </section>
    )
})
MovieHeroSection.displayName = "MovieHeroSection"
