import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { HydrationBoundary, dehydrate, useQueryClient } from "@tanstack/react-query"
import React, { useMemo, useState, useEffect, useRef } from "react"
import { toast } from "sonner"
import { useAppStore } from "@/lib/store"
import { getHighResImage, getMediumResImage, getLowResImage } from "@/lib/helpers/images"
import { fetchAnimeEntry, useGetAnimeEntry, useUpdateAnimeEntryProgress } from "@/api/hooks/anime_entries.hooks"
import { useGetContinuityWatchHistoryItem } from "@/api/hooks/continuity.hooks"
import { API_ENDPOINTS } from "@/api/generated/endpoints"
import { Anime_LocalFile, Mediastream_StreamType } from "@/api/generated/types"
import { EmptyState } from "@/components/shared/empty-state"
import { VideoPlayer } from "@/components/video/player"
import { startViewTransition } from "@/lib/helpers/transitions"
import { FloatingMatchFlap } from "@/components/shared/floating-match-flap"
import { CollectionSwimlane } from "./-components/collection-swimlane"
import { useSound } from "@/hooks/use-sound"
import { cn } from "@/components/ui/core/styling"
import { Play, Check, Plus, Star, Users, Info, Calendar, Clock, Landmark, Tag, ListPlus, Skull, Trophy, Sparkles, Compass } from "lucide-react"
import { DeferredImage } from "@/components/shared/deferred-image"
import { ERA_TABS, cleanMovieTitle } from "./-MovieCard"
import { getEntryEra } from "./-components/movies-utils"
import { useGSAP } from "@gsap/react"
import gsap from "gsap"
import { useServerQuery } from "@/api/client/requests"
import { CharacterDetailModal } from "@/components/shared/character-detail-modal"
import { TMDB_TO_LORE_MOVIE_MAP, DRAGON_BALL_MOVIES_LORE } from "@/lib/config/dragonball.config"
import { ChronologyWidget } from "./-components/chronology-widget"

export const Route = createFileRoute("/movies/$movieId")({
    loader: ({ params: { movieId }, context }) => {
        const qc = context.queryClient
        qc.prefetchQuery({
            queryKey: [API_ENDPOINTS.ANIME_ENTRIES.GetAnimeEntry.key, movieId],
            queryFn: () => fetchAnimeEntry(movieId),
        })
        return { dehydrateState: dehydrate(qc) }
    },
    component: MovieDetailPage,
})

const formatFileSize = (bytes: number) => {
    if (!bytes) return "0 MB"
    const mb = bytes / (1024 * 1024)
    if (mb >= 1024) {
        return `${(mb / 1024).toFixed(2)} GB`
    }
    return `${mb.toFixed(0)} MB`
}

function MovieDetailPage() {
    const { movieId } = Route.useParams()
    const { dehydrateState } = Route.useLoaderData()

    return (
        <HydrationBoundary state={dehydrateState}>
            <MovieDetailClient key={movieId} movieId={movieId} />
        </HydrationBoundary>
    )
}

function MovieDetailClient({ movieId }: { movieId: string }) {
    const { playSound } = useSound()
    const queryClient = useQueryClient()
    const navigate = useNavigate()
    const { data: entry, isLoading } = useGetAnimeEntry(movieId)
    const { data: continuityData, refetch: refetchContinuity } = useGetContinuityWatchHistoryItem(Number(movieId))
    const containerRef = useRef<HTMLDivElement>(null)
    const backdropRef = useRef<HTMLDivElement>(null)
    const addToQueue = useAppStore(state => state.addToQueue)

    // Load rich Dragon Ball lore database
    const { data: lore } = useServerQuery<any>({
        endpoint: "/api/v1/lore/dragonball",
        method: "GET",
        queryKey: ["dragonball-lore"],
        staleTime: 300000,
    })

    const [selectedCharacterName, setSelectedCharacterName] = useState<string | null>(null)
    const [activeTab, setActiveTab] = useState<"SUGGESTED" | "VERSIONS" | "DETAILS" | "LORE">("SUGGESTED")

    useEffect(() => {
        if (entry) playSound("detail", 0.4)
    }, [entry?.media?.id, playSound])

    // Smooth Parallax backdrop scroll listener
    useEffect(() => {
        const handleScroll = () => {
            if (!backdropRef.current) return
            const scrolled = window.scrollY || document.documentElement.scrollTop
            backdropRef.current.style.transform = `translate3d(0, ${scrolled * 0.35}px, 0)`
        }
        window.addEventListener("scroll", handleScroll, { passive: true })
        return () => window.removeEventListener("scroll", handleScroll)
    }, [])

    useGSAP(() => {
        gsap.from(".movie-animate", {
            y: 35,
            opacity: 0,
            duration: 1.2,
            stagger: 0.08,
            ease: "power4.out",
            delay: 0.15
        })
    }, { scope: containerRef, dependencies: [movieId] })

    const [playTarget, setPlayTarget] = useState<{
        path: string
        streamType: Mediastream_StreamType
        episodeLabel: string
        episodeNumber: number
        malId?: number | null
    } | null>(null)

    const [isFavorite, setIsFavorite] = useState(false)

    const media = entry?.media
    if (!entry || !media) {
        if (isLoading) {
            return <div className="h-full w-full bg-[#050506] animate-pulse pb-16" />
        }
        return (
            <div className="min-h-screen bg-[#050506] text-white flex items-center justify-center">
                <EmptyState title="Película no encontrada" message="No pudimos cargar este contenido." />
            </div>
        )
    }

    const title = media.titleSpanish || media.titleEnglish || media.titleRomaji || "Título Desconocido"
    const year = media.year?.toString() || ""
    const era = getEntryEra(entry as any)
    const eraConfig = ERA_TABS.find(t => t.value === era) || ERA_TABS[0]

    // Synopsis cleaned of HTML tags
    const synopsis = media.description ? media.description.replace(/<[^>]*>/g, "") : ""

    const tmdbId = media.tmdbId || 0
    const loreMovieKey = TMDB_TO_LORE_MOVIE_MAP[tmdbId]
    const customMovieLore = loreMovieKey ? DRAGON_BALL_MOVIES_LORE[loreMovieKey] : null

    const wikiMovie = useMemo(() => {
        if (!lore?.movies_and_specials || !loreMovieKey) return null
        return lore.movies_and_specials.find((m: any) => m.id === loreMovieKey)
    }, [lore, loreMovieKey])

    const movieChronology = useMemo(() => {
        if (!customMovieLore || !customMovieLore.startEpContext || !customMovieLore.endEpContext) return null
        return {
            startEpisodeContext: customMovieLore.startEpContext,
            endEpisodeContext: customMovieLore.endEpContext,
            chronologyNotes: customMovieLore.chronologyNotes || ""
        }
    }, [customMovieLore])

    const backdropSrc = media.bannerImage ?? media.posterImage ?? null
    const backdropUrl = getHighResImage(backdropSrc || "")
    const posterUrl = getHighResImage(media.posterImage || "")
    const hasBannerImage = !!media.bannerImage

    // Duration Calculation & Formatting
    const durationMins = entry.episodes?.[0]?.episodeMetadata?.length || (continuityData?.item?.duration ? Math.round(continuityData.item.duration / 60) : null)
    const formattedDuration = durationMins ? (durationMins >= 60 ? `${Math.floor(durationMins / 60)}h ${durationMins % 60}m` : `${durationMins}m`) : null

    // Technical data from local files
    const techInfo = entry.localFiles?.[0]?.technicalInfo as any
    const technicalData = techInfo ? {
        fileSize: formatFileSize(techInfo.size || 0),
        resolutionTag: techInfo.videoStream?.width >= 1920 ? "1080P FHD" : "720P HD",
        videoCodec: techInfo.videoStream?.codec || "H264",
        is4K: techInfo.videoStream?.width >= 3840,
        audioTracks: techInfo.audioStreams?.map((a: any) => a.language?.toUpperCase() || "AUDIO").filter(Boolean) || ["ESPAÑOL LATINO", "JAPONÉS"],
        subtitles: techInfo.subtitleStreams?.map((s: any) => s.language?.toUpperCase() || "SUB").filter(Boolean) || ["ESPAÑOL"]
    } : null

    // Watched progress mutation
    const initialWatched = entry.episodes?.[0]?.watched || false
    const [isWatched, setIsWatched] = useState(initialWatched)
    const { mutate: updateProgress } = useUpdateAnimeEntryProgress(Number(movieId), 1, false)

    const handleToggleWatched = (e: React.MouseEvent) => {
        e.stopPropagation()
        const nextState = !isWatched
        setIsWatched(nextState)
        updateProgress({
            mediaId: Number(movieId),
            progress: nextState ? 1 : 0,
        })
        toast.success(nextState ? "Marcada como vista" : "Quitada de vistas")
    }

    const handleToggleFavorite = (e: React.MouseEvent) => {
        e.stopPropagation()
        setIsFavorite(prev => !prev)
        toast.success(!isFavorite ? "Añadida a favoritos" : "Quitada de favoritos")
    }

    const progressPercent = continuityData?.item?.duration ? (continuityData.item.currentTime / continuityData.item.duration) * 100 : 0

    const handlePlayLocalFile = (localFile: Anime_LocalFile) => {
        if (!localFile.path) return toast.error("Archivo no disponible.")
        const epNum = localFile.parsedInfo?.episode || localFile.metadata?.episode || 1
        const isMp4 = localFile.path.toLowerCase().endsWith(".mp4")
        const targetType = isMp4 ? "direct" : "transcode"
        startViewTransition(() => {
            setPlayTarget({
                path: localFile.path,
                streamType: targetType as Mediastream_StreamType,
                episodeLabel: localFile.name,
                episodeNumber: Number(epNum),
                malId: media.idMal ?? null,
            })
        })
    }

    const handlePlayDefault = () => {
        if (entry.localFiles && entry.localFiles.length > 0) {
            handlePlayLocalFile(entry.localFiles[0])
        } else {
            toast.info("No hay archivos locales disponibles para reproducir.")
        }
    }

    const handleAddToQueue = (e: React.MouseEvent) => {
        e.stopPropagation()
        if (entry.localFiles && entry.localFiles.length > 0) {
            const localFile = entry.localFiles[0]
            addToQueue({
                id: Number(movieId),
                title: title,
                playableUrl: localFile.path || "",
                thumbnail: getMediumResImage(media.posterImage || ""),
                mediaId: Number(movieId),
                episodeNumber: 1,
                malId: media.idMal ?? null,
                mediaFormat: media.format ?? "MOVIE"
            })
            toast.success("Añadido a la cola de reproducción")
        } else {
            toast.error("No hay archivos locales disponibles.")
        }
    }

    const characters = media.characters?.edges || []

    return (
        <div ref={containerRef} className="h-full w-full flex flex-col overflow-y-auto no-scrollbar bg-[#07070a] text-white pb-24 relative select-none">
            <FloatingMatchFlap
                directoryPath={entry.libraryData?.sharedPath || ""}
                mediaId={entry.mediaId}
            />

            {/* FULLSCREEN HERO SECTION */}
            <section className="relative w-full min-h-screen flex flex-col justify-end overflow-hidden pb-16 pt-32">
                {/* Ambient Blur Background */}
                <div className="absolute inset-0 overflow-hidden bg-transparent z-0">
                    {backdropSrc && (
                        <div
                            className="absolute inset-0 opacity-100"
                            style={{
                                backgroundImage: `url(${getLowResImage(backdropSrc)})`,
                                backgroundSize: "cover",
                                backgroundPosition: "center 20%",
                                filter: "blur(80px) brightness(0.35) saturate(160%)",
                            }}
                        />
                    )}
                </div>

                {/* High Res Parallax Backdrop */}
                <div className="absolute inset-0 z-0">
                    {backdropUrl && (
                        hasBannerImage ? (
                            <div 
                                ref={backdropRef}
                                className="absolute right-0 top-0 h-full w-full md:w-[82%] lg:w-[78%] overflow-hidden z-0 will-change-transform"
                            >
                                <DeferredImage
                                    src={backdropUrl}
                                    alt={title}
                                    priority={true}
                                    className="w-full h-full object-cover object-[center_20%] opacity-85 transition-all duration-[20s] ease-out hover:scale-[1.02] animate-ken-burns"
                                    style={{
                                        WebkitMaskImage: "linear-gradient(to right, transparent 0%, rgba(0,0,0,0.15) 12%, black 40%)",
                                        maskImage: "linear-gradient(to right, transparent 0%, rgba(0,0,0,0.15) 12%, black 40%)",
                                    }}
                                />
                            </div>
                        ) : (
                            <div 
                                ref={backdropRef}
                                className="absolute right-0 top-0 h-full w-auto overflow-hidden z-0 will-change-transform"
                            >
                                <DeferredImage
                                    src={backdropUrl}
                                    alt={title}
                                    priority={true}
                                    className="h-full w-auto object-contain object-right-top opacity-[0.65] transition-all duration-[20s] ease-out hover:scale-[1.02] animate-ken-burns"
                                />
                            </div>
                        )
                    )}
                </div>

                {/* Cinematic Vignettes */}
                <div
                    className="absolute inset-0 z-10 pointer-events-none"
                    style={{
                        background: hasBannerImage
                            ? "linear-gradient(to right, rgba(7,7,10,0.95) 0%, rgba(7,7,10,0.8) 25%, rgba(7,7,10,0.2) 65%, transparent 95%)"
                            : "linear-gradient(to right, rgba(7,7,10,0.95) 0%, rgba(7,7,10,0.8) 30%, rgba(7,7,10,0.15) 75%, transparent 98%)",
                    }}
                />
                <div
                    className="absolute inset-x-0 bottom-0 h-64 z-10 pointer-events-none"
                    style={{ background: "linear-gradient(to top, #07070a 0%, rgba(7,7,10,0.8) 25%, rgba(7,7,10,0.4) 60%, transparent 100%)" }}
                />
                <div
                    className="absolute inset-x-0 top-0 h-32 z-10 pointer-events-none"
                    style={{ background: "linear-gradient(to bottom, rgba(7,7,10,0.6) 0%, transparent 100%)" }}
                />

                {/* Content Container (Split Grid) */}
                <div className="relative z-20 w-full max-w-[1800px] mx-auto px-6 md:pl-[128px] md:pr-12 flex flex-col lg:flex-row items-center lg:items-end gap-10">
                    
                    {/* Left Column: Portrait Poster Card */}
                    <div className="movie-animate w-56 md:w-68 shrink-0 aspect-[2/3] rounded-2xl overflow-hidden border bg-zinc-900 shadow-[0_25px_60px_rgba(0,0,0,0.85)] hover:shadow-[0_25px_60px_var(--era-glow)] transition-all duration-500 hover:scale-[1.04]"
                         style={{ 
                             borderColor: `${eraConfig.color}45`,
                             // @ts-ignore
                             "--era-glow": `${eraConfig.color}25`
                         }}>
                        <DeferredImage
                            src={posterUrl}
                            alt={title}
                            className="w-full h-full object-cover"
                        />
                    </div>

                    {/* Right Column: Meta & Description */}
                    <div className="flex-1 flex flex-col gap-6 text-left w-full">
                        {/* Era Badge */}
                        <div className="movie-animate">
                            <span 
                                className="inline-flex items-center text-[10px] font-black uppercase tracking-[0.25em] px-3.5 py-1.5 rounded-lg shadow-md border"
                                style={{
                                    color: eraConfig.color,
                                    borderColor: `${eraConfig.color}45`,
                                    backgroundColor: `${eraConfig.color}15`,
                                }}
                            >
                                {eraConfig.label}
                            </span>
                        </div>

                        {/* Title */}
                        <h1 className="movie-animate text-[clamp(2.2rem,5vw,4.2rem)] font-sans font-extrabold leading-[1.05] tracking-tight text-white drop-shadow-[0_4px_25px_rgba(0,0,0,0.85)] uppercase">
                            {cleanMovieTitle(title)}
                        </h1>

                        {/* Meta Info Row */}
                        <div className="movie-animate flex flex-wrap items-center text-zinc-300 text-xs font-semibold tracking-wide gap-3">
                            <span className="flex items-center justify-center bg-zinc-800/80 border border-zinc-600/50 rounded-md px-2 py-0.5 text-zinc-300 font-bold tracking-widest text-[9px]">
                                {media.isNsfw ? "18+" : "PG-13"}
                            </span>
                            
                            {technicalData?.is4K && (
                                <span className="flex items-center gap-1 font-black text-white text-[11px] tracking-wide bg-gradient-to-r from-amber-500 to-orange-500 px-2 py-0.5 rounded-md">
                                    4K ENHANCED
                                </span>
                            )}
                            
                            <span className="flex items-center justify-center bg-zinc-800/80 border border-zinc-600/50 rounded-md px-2 py-0.5 text-zinc-300 font-bold text-[9px]">CC</span>
                            
                            <div className="flex items-center gap-1.5 text-zinc-300 text-[11px] tracking-wide">
                                {year && <span>{year}</span>}
                                {year && formattedDuration && <span className="text-zinc-600">•</span>}
                                {formattedDuration && <span>{formattedDuration}</span>}
                                {media.score && (
                                    <>
                                        <span className="text-zinc-600">•</span>
                                        <span className="flex items-center gap-1 text-amber-400">
                                            <Star size={11} fill="currentColor" className="stroke-none" />
                                            {(media.score / 10).toFixed(1)} Ki
                                        </span>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Synopsis */}
                        {synopsis && (
                            <p className="movie-animate text-zinc-300 text-sm md:text-[15px] leading-relaxed max-w-3xl line-clamp-3 pl-4 border-l-2 border-brand-orange/30">
                                {synopsis}
                            </p>
                        )}

                        {/* Action Row */}
                        <div className="movie-animate flex flex-wrap items-center gap-4 pt-2">
                            {/* Premium Play Button */}
                            <button
                                onClick={handlePlayDefault}
                                className="group/play relative flex items-center gap-4 px-9 py-4 bg-gradient-to-r from-brand-orange via-orange-500 to-amber-500 text-white rounded-2xl overflow-hidden shadow-[0_12px_40px_rgba(255,110,58,0.35)] hover:shadow-[0_18px_50px_rgba(255,110,58,0.55)] transition-all duration-500 hover:scale-105 active:scale-95 border border-white/10 hover:border-brand-orange/40"
                            >
                                <div className="absolute inset-0 bg-gradient-to-tr from-white/20 via-transparent to-transparent opacity-0 group-hover/play:opacity-100 transition-opacity duration-500 z-0" />
                                <div className="absolute -inset-10 bg-brand-orange/30 blur-xl group-hover/play:opacity-100 opacity-0 transition-opacity duration-500 -z-10 animate-pulse" />

                                <div className="p-2.5 bg-black/40 backdrop-blur-xl rounded-xl border border-white/10 text-white group-hover/play:bg-white group-hover/play:text-black transition-all duration-300 shadow-inner z-10 shrink-0">
                                    <Play className="w-4 h-4 fill-current" />
                                </div>

                                <div className="flex flex-col items-start z-10 select-none text-left">
                                    <span className="font-sans text-[13px] tracking-[0.15em] font-extrabold uppercase text-white transition-colors">
                                        {continuityData?.item?.currentTime ? "REANUDAR" : "PLAY"}
                                    </span>
                                    <span className="text-[8px] font-black text-white/60 tracking-[0.1em] uppercase transition-colors mt-0.5">
                                        {continuityData?.item?.currentTime ? "Continuar viendo" : "Ver película"}
                                    </span>
                                </div>
                            </button>

                            {/* Queue Button */}
                            {entry.localFiles && entry.localFiles.length > 0 && (
                                <button
                                    onClick={handleAddToQueue}
                                    className="group/queue flex items-center justify-center w-14 h-14 rounded-2xl liquid-glass-frosted liquid-glass-frosted-interactive text-white hover:text-brand-orange transition-all duration-300 active:scale-95"
                                    title="Añadir a la cola"
                                >
                                    <ListPlus className="w-5 h-5 transition-transform group-hover/queue:-translate-y-0.5" />
                                </button>
                            )}

                            {/* Watch Status */}
                            <button
                                onClick={handleToggleWatched}
                                className={cn(
                                    "flex items-center justify-center w-14 h-14 rounded-2xl border transition-all duration-300 active:scale-95",
                                    isWatched
                                        ? "bg-white text-black border-white"
                                        : "bg-white/[0.05] border-white/10 text-white hover:bg-white/10 hover:border-white/20"
                                )}
                                title={isWatched ? "Marcar como no vista" : "Marcar como vista"}
                            >
                                {isWatched ? <Check className="w-5 h-5 stroke-[3px]" /> : <Plus className="w-5 h-5 stroke-[2.5px]" />}
                            </button>

                            {/* Favorite Button */}
                            <button
                                onClick={handleToggleFavorite}
                                className={cn(
                                    "flex items-center justify-center w-14 h-14 rounded-2xl border transition-all duration-300 active:scale-95",
                                    isFavorite
                                        ? "bg-white text-black border-white"
                                        : "bg-white/[0.05] border-white/10 text-white hover:bg-white/10 hover:border-white/20"
                                )}
                                title={isFavorite ? "Quitar de favoritos" : "Añadir a favoritos"}
                            >
                                <Users className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Progress bar */}
                        {continuityData?.item?.currentTime && continuityData.item.duration && (
                            <div className="movie-animate w-full max-w-sm mt-1 h-[5px] bg-white/20 rounded-full overflow-hidden relative z-10">
                                <div 
                                    className="h-full bg-brand-orange"
                                    style={{ width: `${progressPercent}%` }}
                                />
                            </div>
                        )}
                    </div>
                </div>
            </section>

            {/* TAB CONTAINER */}
            <div className="w-full max-w-[1800px] mx-auto px-6 md:pl-[128px] md:pr-12 mt-6 z-20 relative">
                {/* Custom Glass Tab Selector */}
                <div className="flex border-b border-white/10 mb-8 gap-8 overflow-x-auto no-scrollbar">
                    {(["SUGGESTED", "VERSIONS", "DETAILS", "LORE"] as const).map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={cn(
                                "pb-4 text-xs font-bold tracking-[0.2em] uppercase border-b-2 transition-all duration-300 relative",
                                activeTab === tab
                                    ? "text-white border-brand-orange"
                                    : "text-zinc-500 border-transparent hover:text-zinc-300"
                            )}
                        >
                            {tab === "SUGGESTED" && "Sugerido"}
                            {tab === "VERSIONS" && "Versiones"}
                            {tab === "DETAILS" && "Detalles"}
                            {tab === "LORE" && "Lore"}
                        </button>
                    ))}
                </div>

                {/* TAB CONTENT AREAS */}
                <div className="min-h-[250px]">
                    {activeTab === "SUGGESTED" && (
                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                            {media.relations && media.relations.length > 0 ? (
                                <CollectionSwimlane 
                                    collectionId="related"
                                    collectionName="Contenido Relacionado"
                                    movies={media.relations
                                        .filter(r => r.media && (r.media.format === "MOVIE" || r.media.format === "SPECIAL" || r.media.format === "OVA"))
                                        .map(r => ({
                                            id: String(r.media!.id),
                                            title: r.media!.title?.spanish || r.media!.title?.romaji || "Desconocida",
                                            posterUrl: r.media!.coverImage?.large || "",
                                            year: r.media!.startDate?.year
                                        }))
                                    }
                                    onMovieSelect={(id) => navigate({ to: "/movies/$movieId", params: { movieId: id } })}
                                />
                            ) : (
                                <div className="flex items-center justify-center h-48 text-zinc-500 text-sm font-medium tracking-wide">
                                    NO HAY CONTENIDO SUGERIDO DISPONIBLE
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === "VERSIONS" && (
                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-4">
                            {entry.localFiles && entry.localFiles.length > 0 ? (
                                <div className="grid gap-3 max-w-4xl">
                                    {entry.localFiles.map((file, idx) => {
                                        const fileTech = file.technicalInfo as any
                                        const sizeStr = fileTech?.size ? formatFileSize(fileTech.size) : "Tamaño Desconocido"
                                        const resStr = fileTech?.videoStream?.width ? (fileTech.videoStream.width >= 1920 ? "1080p FHD" : "720p HD") : ""
                                        return (
                                            <div 
                                                key={idx}
                                                className="p-4 rounded-2xl liquid-glass-frosted border border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-white/10 transition-all duration-300"
                                            >
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-bold text-white truncate" title={file.name}>
                                                        {file.name}
                                                    </p>
                                                    <p className="text-[10px] text-zinc-500 font-mono mt-1 truncate" title={file.path}>
                                                        {file.path}
                                                    </p>
                                                    <div className="flex gap-2 mt-2">
                                                        {resStr && (
                                                            <span className="text-[9px] font-black bg-white/5 px-2 py-0.5 rounded text-zinc-300 uppercase tracking-wider">
                                                                {resStr}
                                                            </span>
                                                        )}
                                                        <span className="text-[9px] font-black bg-white/5 px-2 py-0.5 rounded text-zinc-300 uppercase tracking-wider">
                                                            {sizeStr}
                                                        </span>
                                                        {fileTech?.videoStream?.codec && (
                                                            <span className="text-[9px] font-black bg-white/5 px-2 py-0.5 rounded text-zinc-300 uppercase tracking-wider">
                                                                {fileTech.videoStream.codec.toUpperCase()}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => handlePlayLocalFile(file)}
                                                    className="shrink-0 flex items-center justify-center gap-2 px-5 py-2.5 bg-white text-black hover:bg-zinc-200 rounded-xl font-bold text-xs uppercase tracking-wider transition-all duration-300"
                                                >
                                                    <Play className="w-3.5 h-3.5 fill-current" />
                                                    <span>Reproducir</span>
                                                </button>
                                            </div>
                                        )
                                    })}
                                </div>
                            ) : (
                                <div className="flex items-center justify-center h-48 text-zinc-500 text-sm font-medium tracking-wide">
                                    NO HAY ARCHIVOS LOCALES DISPONIBLES
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === "DETAILS" && (
                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 grid grid-cols-1 lg:grid-cols-3 gap-8">
                            {/* Left Meta Specs Bento Box */}
                            <div className="lg:col-span-2 space-y-6">
                                {/* Technical Grid */}
                                {technicalData && (
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                        <div className="p-4 bg-white/[0.02] border border-white/5 rounded-2xl flex flex-col gap-1 backdrop-blur-sm">
                                            <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Resolución</span>
                                            <span className="text-sm font-bold text-white">{technicalData.resolutionTag}</span>
                                        </div>
                                        <div className="p-4 bg-white/[0.02] border border-white/5 rounded-2xl flex flex-col gap-1 backdrop-blur-sm">
                                            <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Tamaño de Archivo</span>
                                            <span className="text-sm font-bold text-white">{technicalData.fileSize}</span>
                                        </div>
                                        <div className="p-4 bg-white/[0.02] border border-white/5 rounded-2xl flex flex-col gap-1 backdrop-blur-sm">
                                            <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Video Codec</span>
                                            <span className="text-sm font-bold text-white">{technicalData.videoCodec}</span>
                                        </div>
                                        <div className="p-4 bg-white/[0.02] border border-white/5 rounded-2xl flex flex-col gap-1 backdrop-blur-sm">
                                            <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Canales de Audio</span>
                                            <span className="text-sm font-bold text-white truncate" title={technicalData.audioTracks.join(", ")}>
                                                {technicalData.audioTracks.join(" / ")}
                                            </span>
                                        </div>
                                        <div className="p-4 bg-white/[0.02] border border-white/5 rounded-2xl flex flex-col gap-1 backdrop-blur-sm">
                                            <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Subtítulos</span>
                                            <span className="text-sm font-bold text-white truncate" title={technicalData.subtitles.join(", ")}>
                                                {technicalData.subtitles.join(" / ") || "Ninguno"}
                                            </span>
                                        </div>
                                        <div className="p-4 bg-white/[0.02] border border-white/5 rounded-2xl flex flex-col gap-1 backdrop-blur-sm">
                                            <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Ubicación</span>
                                            <span className="text-xs font-bold text-zinc-400 truncate" title={entry.libraryData?.sharedPath}>
                                                {entry.libraryData?.sharedPath || "Local"}
                                            </span>
                                        </div>
                                    </div>
                                )}

                                {/* Chronology Timeline Box */}
                                <div className="p-5 bg-brand-orange/[0.02] border border-brand-orange/20 rounded-2xl flex flex-col gap-1 backdrop-blur-sm">
                                    <div className="flex items-center gap-2">
                                        <Info className="w-4 h-4 text-brand-orange" />
                                        <span className="text-[10px] font-black text-brand-orange uppercase tracking-wider">Línea de Tiempo Cronológica</span>
                                    </div>
                                    <p className="text-xs text-zinc-300 leading-relaxed mt-2">
                                        Esta película transcurre cronológicamente alrededor de los eventos del universo de <strong className="text-white">{eraConfig.label}</strong>.
                                    </p>
                                </div>

                                {/* General Meta Detail Grid */}
                                <div className="p-5 bg-white/[0.01] border border-white/5 rounded-2xl grid grid-cols-2 gap-4">
                                    {media.startDate && (
                                        <div className="flex items-start gap-3">
                                            <Calendar className="w-4 h-4 text-zinc-500 mt-0.5 shrink-0" />
                                            <div>
                                                <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Fecha Estreno</p>
                                                <p className="text-xs font-bold text-zinc-300 mt-0.5">
                                                    {media.startDate}
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                    {media.genres && (
                                        <div className="col-span-2 flex items-start gap-3">
                                            <Tag className="w-4 h-4 text-zinc-500 mt-0.5 shrink-0" />
                                            <div>
                                                <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Géneros</p>
                                                <p className="text-xs font-bold text-zinc-300 mt-0.5">
                                                    {Array.isArray(media.genres) ? (media.genres as string[]).join(", ") : String(media.genres)}
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Right Cast / Characters Column */}
                            <div className="p-5 bg-white/[0.01] border border-white/5 rounded-2xl flex flex-col gap-4">
                                <h3 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest border-b border-white/10 pb-2">
                                    Personajes Principales
                                </h3>
                                {characters.length > 0 ? (
                                    <div className="grid gap-3 max-h-[380px] overflow-y-auto pr-1 no-scrollbar">
                                        {characters.slice(0, 8).map((char: any, i) => {
                                            const node = char.node
                                            return (
                                                <div 
                                                    key={i} 
                                                    className="flex items-center gap-3 hover:bg-white/5 p-1.5 rounded-xl cursor-pointer transition-all"
                                                    onClick={() => setSelectedCharacterName(node?.name?.full || null)}
                                                >
                                                    <div className="w-10 h-10 rounded-full overflow-hidden shrink-0 bg-zinc-800 border border-white/10">
                                                        <DeferredImage
                                                            src={node?.image?.large || ""}
                                                            alt={node?.name?.full}
                                                            className="w-full h-full object-cover"
                                                        />
                                                    </div>
                                                    <div>
                                                        <p className="text-xs font-bold text-zinc-200">{node?.name?.full}</p>
                                                        <p className="text-[9px] font-medium text-zinc-500 uppercase tracking-wider">{char.role === "MAIN" ? "Protagonista" : "Soporte"}</p>
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                ) : (
                                    <p className="text-xs text-zinc-500 italic">No hay información de personajes.</p>
                                )}
                            </div>
                        </div>
                    )}

                    {activeTab === "LORE" && (
                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 grid grid-cols-1 lg:grid-cols-3 gap-8">
                            {/* Left Column: Lore Stats */}
                            <div className="lg:col-span-2 space-y-6">
                                {/* Lore Header */}
                                <div className="p-6 bg-zinc-950/40 border border-white/5 rounded-2xl flex flex-col gap-4">
                                    <div className="flex items-center justify-between flex-wrap gap-4">
                                        <div className="space-y-1">
                                            <span className="text-[9px] font-black text-brand-orange uppercase tracking-[0.25em] bg-brand-orange/10 border border-brand-orange/20 px-2.5 py-0.5 rounded">
                                                Expediente de Combate
                                            </span>
                                            <h2 className="text-2xl font-black text-white tracking-wide uppercase mt-1">
                                                {customMovieLore?.title || title}
                                            </h2>
                                        </div>
                                        {customMovieLore?.canonStatus && (
                                            <span className={cn(
                                                "px-3.5 py-1 rounded-full text-[9px] font-black uppercase tracking-[0.15em] shadow-sm border",
                                                customMovieLore.canonStatus.toLowerCase().includes("totalmente canon") || customMovieLore.canonStatus.toLowerCase() === "canon"
                                                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                                    : customMovieLore.canonStatus.toLowerCase().includes("no canónico") || customMovieLore.canonStatus.toLowerCase().includes("no canon")
                                                    ? "bg-red-500/10 text-red-400 border-red-500/20"
                                                    : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                                            )}>
                                                {customMovieLore.canonStatus}
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-zinc-300 text-sm leading-relaxed border-l-2 border-brand-orange/30 pl-4 py-1">
                                        {wikiMovie?.description || synopsis}
                                    </p>
                                </div>

                                {/* Scouter Details Card */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {customMovieLore?.antagonists && customMovieLore.antagonists.length > 0 && (
                                        <div className="p-5 bg-red-950/5 border border-red-500/10 rounded-2xl">
                                            <span className="flex items-center gap-2 text-[9px] font-black text-red-400 uppercase tracking-[0.2em] mb-3 pb-2 border-b border-red-500/10">
                                                <Skull className="w-3.5 h-3.5 text-red-400" /> Amenazas detectadas
                                            </span>
                                            <div className="flex flex-wrap gap-2">
                                                {customMovieLore.antagonists.map((ant, idx) => (
                                                    <span key={idx} className="px-2.5 py-1 bg-red-950/20 text-red-300 border border-red-500/10 text-[10px] rounded-lg font-bold">
                                                        {ant}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {customMovieLore?.newCharacters && customMovieLore.newCharacters.length > 0 && (
                                        <div className="p-5 bg-amber-950/5 border border-amber-500/10 rounded-2xl">
                                            <span className="flex items-center gap-2 text-[9px] font-black text-amber-400 uppercase tracking-[0.2em] mb-3 pb-2 border-b border-amber-500/10">
                                                <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Aliados / Debuts
                                            </span>
                                            <div className="flex flex-wrap gap-2">
                                                {customMovieLore.newCharacters.map((char, idx) => (
                                                    <span key={idx} className="px-2.5 py-1 bg-amber-950/20 text-amber-300 border border-amber-500/10 text-[10px] rounded-lg font-bold">
                                                        {char}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {customMovieLore?.keyEvents && customMovieLore.keyEvents.length > 0 && (
                                        <div className="md:col-span-2 p-5 bg-white/[0.01] border border-white/5 rounded-2xl">
                                            <span className="flex items-center gap-2 text-[9px] font-black text-zinc-400 uppercase tracking-[0.2em] mb-3 pb-2 border-b border-white/5">
                                                <Trophy className="w-3.5 h-3.5 text-brand-orange" /> Hitos del Combate
                                            </span>
                                            <ul className="space-y-2 text-xs text-zinc-300">
                                                {customMovieLore.keyEvents.map((evt, idx) => (
                                                    <li key={idx} className="flex items-start gap-2.5">
                                                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-brand-orange mt-1.5 shrink-0" />
                                                        <span>{evt}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}

                                    {customMovieLore?.specialTrivia && (
                                        <div className="md:col-span-2 p-5 bg-brand-orange/[0.02] border border-brand-orange/20 rounded-2xl relative overflow-hidden">
                                            <div className="absolute top-0 right-0 w-24 h-24 bg-brand-orange/5 rounded-full blur-xl pointer-events-none" />
                                            <span className="flex items-center gap-2 text-[9px] font-black text-brand-orange uppercase tracking-[0.2em] mb-2">
                                                <Compass className="w-3.5 h-3.5" /> Curiosidades de la Producción
                                            </span>
                                            <p className="text-xs text-zinc-300 leading-relaxed font-sans">
                                                {customMovieLore.specialTrivia}
                                            </p>
                                        </div>
                                    )}
                                </div>

                                {/* Chronology location widget */}
                                {movieChronology && (
                                    <ChronologyWidget chronology={movieChronology} />
                                )}
                            </div>

                            {/* Right Column: Characters in this movie */}
                            <div className="p-5 bg-white/[0.01] border border-white/5 rounded-2xl flex flex-col gap-4 self-start">
                                <h3 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest border-b border-white/10 pb-2 flex items-center gap-2">
                                    Guerreros en Combate
                                </h3>
                                {characters.length > 0 ? (
                                    <div className="grid gap-3 max-h-[420px] overflow-y-auto pr-1 no-scrollbar">
                                        {characters.slice(0, 12).map((char: any, i) => {
                                            const node = char.node
                                            return (
                                                <div 
                                                    key={i} 
                                                    className="flex items-center gap-3 hover:bg-white/5 p-1.5 rounded-xl cursor-pointer transition-all"
                                                    onClick={() => setSelectedCharacterName(node?.name?.full || null)}
                                                >
                                                    <div className="w-10 h-10 rounded-full overflow-hidden shrink-0 bg-zinc-800 border border-white/10">
                                                        <DeferredImage
                                                            src={node?.image?.large || ""}
                                                            alt={node?.name?.full}
                                                            className="w-full h-full object-cover"
                                                        />
                                                    </div>
                                                    <div>
                                                        <p className="text-xs font-bold text-zinc-200">{node?.name?.full}</p>
                                                        <p className="text-[9px] font-medium text-zinc-500 uppercase tracking-wider">
                                                            {char.role === "MAIN" ? "Protagonista" : "Soporte"}
                                                        </p>
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                ) : (
                                    <p className="text-xs text-zinc-500 italic">No hay información de personajes.</p>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Video Player */}
            {playTarget && (
                <VideoPlayer
                    streamUrl={playTarget.path}
                    streamType={playTarget.streamType as "local" | "online" | "direct"}
                    title={title}
                    episodeLabel={playTarget.episodeLabel}
                    episodeNumber={playTarget.episodeNumber}
                    mediaId={Number(movieId)}
                    malId={playTarget.malId}
                    mediaFormat={media.format ?? "MOVIE"}
                    onNextEpisode={() => {}}
                    hasNextEpisode={false}
                    onClose={() => {
                        startViewTransition(() => setPlayTarget(null))
                        refetchContinuity()
                        queryClient.invalidateQueries({ queryKey: [API_ENDPOINTS.ANIME_ENTRIES.GetAnimeEntry.key, String(movieId)] })
                    }}
                />
            )}

            {/* Character Lore Detail Modal overlay */}
            {selectedCharacterName && (
                <CharacterDetailModal 
                    characterName={selectedCharacterName}
                    entry={entry}
                    loreData={lore}
                    onClose={() => setSelectedCharacterName(null)}
                />
            )}
        </div>
    )
}
