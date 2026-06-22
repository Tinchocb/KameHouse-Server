import * as React from "react"
import { useRef, useMemo } from "react"
import { useGSAP } from "@gsap/react"
import gsap from "gsap"
import { cn } from "@/components/ui/core/styling"
import { getLowResImage } from "@/lib/helpers/images"
import { Anime_Entry, Continuity_WatchHistoryItem } from "@/api/generated/types"
import { useIntelligenceStore } from "@/hooks/use-home-intelligence"
import { Play, Check, Plus, Users } from "lucide-react"
import { useUpdateAnimeEntryProgress } from "@/api/hooks/anime_entries.hooks"
import { DeferredImage } from "@/components/shared/deferred-image"
import { toast } from "sonner"

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
    directoryPath: _directoryPath,
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
            const target = e.target
            if (!backdropRef.current || !containerRef.current) return

            if (target === document || target === window) {
                const scrolled = window.scrollY || document.documentElement.scrollTop
                backdropRef.current.style.transform = `translate3d(0, ${scrolled * 0.4}px, 0)`
            } else if (target instanceof HTMLElement && target.contains(containerRef.current)) {
                const scrolled = target.scrollTop
                backdropRef.current.style.transform = `translate3d(0, ${scrolled * 0.4}px, 0)`
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
    }, { scope: containerRef, dependencies: [] })
    
    const title = media.titleSpanish || media.titleEnglish || media.titleRomaji || "Título Desconocido"
    const year = media.year?.toString() || ""
    const hasBannerImage = !!media.bannerImage
    const backdropSrc = media.bannerImage ?? media.posterImage ?? null

    const genres = useMemo(() => {
        return (media?.genres as string[]) || []
    }, [media])

    const synopsis = useMemo(() => {
        const raw = media.description || ""
        return raw.replace(/<[^>]*>/g, "")
    }, [media.description])

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
    
    const is4K = useMemo(() => {
        if (!tech?.videoStream) return false
        const w = tech.videoStream.width
        if (w === undefined) return false
        return w >= 3840
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

    return (
        <section 
            ref={containerRef}
            className={cn("relative w-full h-[98vh] max-h-[550px] flex flex-col justify-center overflow-hidden bg-transparent select-none", className)}
        >
            {/* Ambient Blur Background */}
            <div className="absolute inset-0 overflow-hidden bg-transparent z-0">
                {backdropSrc && (
                    <div
                        className="absolute inset-0 opacity-100"
                        style={{
                            backgroundImage: `url(${getLowResImage(backdropSrc)})`,
                            backgroundSize: "cover",
                            backgroundPosition: "center 20%",
                            filter: "blur(70px) brightness(0.5) saturate(170%)",
                        }}
                    />
                )}
            </div>

            {/* High Res Crisp Backdrop with Ken Burns */}
            <div className="absolute inset-0 z-0">
                {backdropUrl && (
                    hasBannerImage ? (
                        <div 
                            ref={backdropRef}
                            className="absolute right-0 top-0 h-full w-full md:w-[80%] lg:w-[75%] overflow-hidden cursor-pointer z-0 will-change-transform group/backdrop"
                            onClick={onPlay}
                        >
                            <DeferredImage
                                src={backdropUrl}
                                alt={title}
                                priority={true}
                                className="w-full h-full object-cover object-[center_20%] opacity-90 transition-all [transition-duration:20s] ease-out group-hover/backdrop:scale-[1.03] animate-ken-burns"
                                style={{
                                    WebkitMaskImage: "linear-gradient(to right, transparent 0%, rgba(0,0,0,0.15) 12%, black 40%)",
                                    maskImage: "linear-gradient(to right, transparent 0%, rgba(0,0,0,0.15) 12%, black 40%)",
                                }}
                            />
                        </div>
                    ) : (
                        <div 
                            ref={backdropRef}
                            className="absolute right-0 top-0 h-full w-auto overflow-hidden cursor-pointer z-0 will-change-transform group/backdrop"
                            onClick={onPlay}
                        >
                            <DeferredImage
                                src={backdropUrl}
                                alt={title}
                                priority={true}
                                className="h-full w-auto object-contain object-right-top opacity-[0.75] transition-all [transition-duration:20s] ease-out group-hover/backdrop:scale-[1.03] animate-ken-burns"
                            />
                        </div>
                    )
                )}
            </div>

            {/* Gradient izquierdo */}
            <div
                className="absolute inset-0 z-10 pointer-events-none"
                style={{
                    background: hasBannerImage
                        ? "linear-gradient(to right, rgba(7,7,10,0.85) 0%, rgba(7,7,10,0.7) 25%, rgba(7,7,10,0.2) 60%, transparent 90%)"
                        : "linear-gradient(to right, rgba(7,7,10,0.85) 0%, rgba(7,7,10,0.7) 30%, rgba(7,7,10,0.15) 70%, transparent 95%)",
                }}
            />
            {/* Gradient inferior */}
            <div
                className="absolute inset-x-0 bottom-0 h-32 z-10 pointer-events-none"
                style={{ background: "linear-gradient(to top, transparent 0%, rgba(7,7,10,0.35) 50%, transparent 100%)" }}
            />
            {/* Vignette superior */}
            <div
                className="absolute inset-x-0 top-0 h-16 z-10 pointer-events-none"
                style={{ background: "linear-gradient(to bottom, rgba(7,7,10,0.4) 0%, transparent 100%)" }}
            />

            {/* Content Container */}
            <div className="relative z-20 w-full max-w-[1800px] mx-auto px-6 md:pl-[120px] md:pr-12 lg:pl-[120px] lg:pr-12 flex flex-col pointer-events-none">
                <div className="max-w-3xl space-y-5 pointer-events-auto w-full">
                    
                    {/* Main Cinematic Title */}
                    <div className="movie-hero-animate flex flex-col gap-2">
                        {/* Fake logo / Title text */}
                        <h1 
                            className="text-[clamp(2.5rem,5.5vw,4.5rem)] font-sans font-extrabold leading-[1.05] tracking-tight text-white drop-shadow-[0_4px_25px_rgba(0,0,0,0.85)] cursor-pointer hover:text-white/80 transition-colors duration-300"
                            onClick={onPlay}
                        >
                            {title}
                        </h1>
                    </div>

                    {/* IMAX / Enhanced row */}
                    <div className="movie-hero-animate space-y-1 mt-2">
                        <p className="text-[#E2B659] font-bold text-lg tracking-wide drop-shadow-md">
                            Now Streaming in KameHouse Enhanced
                        </p>
                        <p className="text-zinc-400 text-[10px] uppercase font-semibold tracking-wider">
                            {is4K ? "DISFRUTA DE LA VERSIÓN EN 4K ULTRA HD" : "DISFRUTA DE LA MEJOR CALIDAD DISPONIBLE"}
                        </p>
                    </div>

                    {/* Disney+ Style Meta details */}
                    <div className="movie-hero-animate flex flex-wrap items-center text-zinc-300/80 text-[11px] font-semibold tracking-wide gap-3">
                        {/* Rating Badge */}
                        <span className="flex items-center justify-center bg-zinc-800/80 border border-zinc-600/50 rounded-sm px-1.5 py-0.5 text-zinc-300 font-bold tracking-widest text-[9px]">
                            {media.isNsfw ? "18+" : "PG-13"}
                        </span>
                        
                        {/* IMAX Badge */}
                        {is4K && (
                            <span className="flex items-center gap-1 font-black text-white text-[11px] tracking-wide">
                                4K <span className="font-normal text-zinc-400">ENHANCED</span>
                            </span>
                        )}
                        
                        {/* Audio / Sub Badges */}
                        <span className="flex items-center justify-center bg-zinc-800/80 border border-zinc-600/50 rounded-sm px-1.5 py-0.5 text-zinc-300 font-bold text-[9px]">AD</span>
                        <span className="flex items-center justify-center bg-zinc-800/80 border border-zinc-600/50 rounded-sm px-1.5 py-0.5 text-zinc-300 font-bold text-[9px]">CC</span>
                        
                        <div className="flex items-center gap-1.5 text-zinc-300 text-[11px] tracking-wide ml-1">
                            {year && <span>{year}</span>}
                            {year && formattedDuration && <span className="text-zinc-600">•</span>}
                            {formattedDuration && <span>{formattedDuration}</span>}
                        </div>
                    </div>

                    {/* Genres */}
                    {genres.length > 0 && (
                        <div className="movie-hero-animate text-zinc-300/90 text-[12px] font-medium tracking-wide">
                            {genres.join(", ")}
                        </div>
                    )}

                    {/* Action Row */}
                    <div className="movie-hero-animate flex flex-wrap items-center gap-4 pt-4">
                        
                        {/* PLAY BUTTON (Disney+ style white) */}
                        <button
                            onClick={onPlay}
                            className="group/play flex items-center gap-3 px-8 py-3.5 bg-white text-black hover:bg-white/80 rounded transition-all duration-300 font-extrabold uppercase tracking-widest text-sm"
                        >
                            <Play className="w-5 h-5 fill-current" />
                            <span>
                                {continuityItem && continuityItem.currentTime ? "REANUDAR" : "PLAY"}
                            </span>
                        </button>

                        {/* TRAILER BUTTON (Transparent with border) */}
                        <button
                            onClick={() => {}}
                            className="group/trailer flex items-center gap-3 px-8 py-3.5 bg-transparent border border-white/50 text-white hover:bg-white/10 hover:border-white/80 rounded transition-all duration-300 font-extrabold uppercase tracking-widest text-sm"
                        >
                            <span>TRAILER</span>
                        </button>

                        {/* Circular Action Buttons */}
                        <div className="flex items-center gap-3">
                            <button
                                onClick={handleToggleWatched}
                                className={cn(
                                    "flex items-center justify-center w-12 h-12 rounded-full border transition-all duration-300",
                                    isWatched
                                        ? "bg-white text-black border-white"
                                        : "bg-black/40 border-white/50 text-white hover:bg-white/20 hover:border-white"
                                )}
                                title={isWatched ? "Marcar como no vista" : "Marcar como vista"}
                            >
                                {isWatched ? <Check className="w-6 h-6 stroke-[3px]" /> : <Plus className="w-6 h-6 stroke-[2px]" />}
                            </button>

                            <button
                                onClick={handleToggleFavorite}
                                className={cn(
                                    "flex items-center justify-center w-12 h-12 rounded-full border transition-all duration-300",
                                    isFavorite
                                        ? "bg-white text-black border-white"
                                        : "bg-black/40 border-white/50 text-white hover:bg-white/20 hover:border-white"
                                )}
                                title={isFavorite ? "Quitar de favoritos" : "Añadir a favoritos"}
                            >
                                <Users className="w-5 h-5" />
                            </button>
                        </div>
                    </div>

                    {/* Progress bar underneath if in progress */}
                    {continuityItem && continuityItem.currentTime && (
                        <div className="movie-hero-animate w-full max-w-sm mt-3 h-[4px] bg-white/20 rounded-full overflow-hidden relative z-10">
                            <div 
                                className="h-full bg-brand-orange"
                                style={{ width: `${progressPercent}%` }}
                            />
                        </div>
                    )}

                    {/* Synopsis */}
                    {synopsis && (
                        <p className="movie-hero-animate text-zinc-100 text-sm md:text-[15px] leading-relaxed font-medium select-none max-w-3xl pt-2">
                            {synopsis}
                        </p>
                    )}
                </div>
            </div>
        </section>
    )
})
MovieHeroSection.displayName = "MovieHeroSection"
