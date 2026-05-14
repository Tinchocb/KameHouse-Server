import { createFileRoute } from "@tanstack/react-router"
import { HydrationBoundary, dehydrate } from "@tanstack/react-query"
import React, { useMemo, useState } from "react"
import { FolderOpen, Play } from "lucide-react"
import { toast } from "sonner"
import { FaPlay } from "react-icons/fa"

import { cn } from "@/components/ui/core/styling"
import { getHighResImage } from "@/lib/helpers/images"
import { motion } from "framer-motion"
import { fetchAnimeEntry, useGetAnimeEntry } from "@/api/hooks/anime_entries.hooks"
import { API_ENDPOINTS } from "@/api/generated/endpoints"
import { Anime_Episode, Anime_LocalFile, Mediastream_StreamType, Anime_Entry } from "@/api/generated/types"
import { EmptyState } from "@/components/shared/empty-state"
import { DeferredImage } from "@/components/shared/deferred-image"
import { VideoPlayer } from "@/components/video/player"
import { MediaActionButtons, EpisodeCard } from "./-series-interactivity-client"
import { sanitizeHtml } from "@/lib/helpers/sanitizer"
import { resolveSeriesSagas, getDragonBallSpanishTitle, type SagaDefinition } from "@/lib/config/dragonball.config"
import { ClassicPosterCard } from "@/components/shared/classic-poster-card"

export const Route = createFileRoute("/series/$seriesId/")({
    loader: async ({ params: { seriesId }, context }) => {
        const qc = context.queryClient
        await qc.prefetchQuery({
            queryKey: [API_ENDPOINTS.ANIME_ENTRIES.GetAnimeEntry.key, seriesId],
            queryFn: () => fetchAnimeEntry(seriesId),
        })
        return { dehydrateState: dehydrate(qc) }
    },
    component: SeriesDetailPage,
})

function SeriesDetailPage() {
    const { seriesId } = Route.useParams()
    const { dehydrateState } = Route.useLoaderData()

    return (
        <HydrationBoundary state={dehydrateState}>
            <SeriesDetailClient seriesId={seriesId} />
        </HydrationBoundary>
    )
}

function SeriesDetailClient({ seriesId }: { seriesId: string }) {
    const { data: entry, isLoading } = useGetAnimeEntry(seriesId)

    const [playTarget, setPlayTarget] = useState<{
        path: string
        streamType: Mediastream_StreamType
        episodeLabel: string
        episodeNumber: number
        malId?: number | null
    } | null>(null)

    const sagas = useMemo(() => entry?.media ? resolveSeriesSagas(entry.media) : [], [entry])
    
    const computedEpisodes = useMemo(() => {
        if (!entry) return []
        if (entry.episodes && entry.episodes.length > 0) return entry.episodes;
        
        if (entry.localFiles && entry.localFiles.length > 0) {
            const epMap = new Map<number, Anime_Episode>();
            
            entry.localFiles.forEach(lf => {
                const parsedEp = lf.parsedInfo?.episode || lf.metadata?.episode;
                const epNum = Number(parsedEp);
                if (!epNum || isNaN(epNum)) return;
                
                if (!epMap.has(epNum)) {
                    let sagaId: string | undefined = undefined;
                    if (sagas) {
                        const matchingSaga = sagas.find(s => epNum >= s.startEp && epNum <= s.endEp);
                        if (matchingSaga) sagaId = matchingSaga.id;
                    }

                    epMap.set(epNum, {
                        episodeNumber: epNum,
                        absoluteEpisodeNumber: epNum,
                        episodeTitle: lf.name,
                        displayTitle: lf.name,
                        watched: false,
                        sagaId: sagaId,
                        type: "main",
                        progressNumber: epNum,
                        isDownloaded: true,
                        isInvalid: false,
                        episodeMetadata: {
                            episodeNumber: epNum,
                            image: entry.media?.posterImage || entry.media?.bannerImage || "",
                        }
                    } as unknown as Anime_Episode);
                }
            });
            
            return Array.from(epMap.values()).sort((a, b) => a.episodeNumber - b.episodeNumber);
        }
        return [];
    }, [entry, sagas]);

    const handlePlayEpisode = (localFile: Anime_LocalFile, episode: Anime_Episode) => {
        if (!localFile.path) {
            toast.error("Archivo local no disponible.")
            return
        }
        const isMp4 = localFile.path.toLowerCase().endsWith(".mp4")
        const targetType = isMp4 ? "direct" : "transcode"
        setPlayTarget({
            path: localFile.path,
            streamType: targetType as Mediastream_StreamType,
            episodeLabel: episode.episodeTitle || episode.displayTitle || `Episodio ${episode.episodeNumber}`,
            episodeNumber: episode.episodeNumber,
            malId: entry?.media?.idMal ?? null,
        })
    }

    const handlePlayLocalFile = (localFile: Anime_LocalFile) => {
        if (!localFile.path) {
            toast.error("Archivo no disponible.")
            return
        }
        const epNum = localFile.parsedInfo?.episode || localFile.metadata?.episode || 1
        const isMp4 = localFile.path.toLowerCase().endsWith(".mp4")
        const targetType = isMp4 ? "direct" : "transcode"
        setPlayTarget({
            path: localFile.path,
            streamType: targetType as Mediastream_StreamType,
            episodeLabel: localFile.name,
            episodeNumber: Number(epNum),
            malId: entry?.media?.tmdbId ?? null,
        })
    }
    
    const handlePlayDefault = () => {
        if (!computedEpisodes || computedEpisodes.length === 0) return
        
        // Find first unwatched episode or first episode
        const targetEp = computedEpisodes.find(ep => !ep.watched) || computedEpisodes[0]
        const lf = (entry?.localFiles || []).find(f => 
            Number(f.metadata?.episode) === targetEp.episodeNumber || 
            Number(f.parsedInfo?.episode) === targetEp.episodeNumber
        )
        
        if (lf) {
            handlePlayEpisode(lf, targetEp)
        } else if (entry?.localFiles && entry.localFiles.length > 0) {
            // If no metadata match, just play first available local file
            handlePlayLocalFile(entry.localFiles[0])
        } else {
            toast.info("No hay archivos locales disponibles para reproducir.")
        }
    }

    if (isLoading) {
        return (
            <div className="min-h-screen bg-background text-white flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-brand-orange border-t-transparent rounded-full animate-spin" />
                    <span className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-500">Cargando Serie...</span>
                </div>
            </div>
        )
    }

    if (!entry || !entry.media) {
        return (
            <div className="min-h-screen bg-background text-white flex items-center justify-center px-6">
                <EmptyState
                    title="Serie no encontrada"
                    message="No pudimos cargar esta serie. Vuelve al inicio o intenta con otra."
                />
            </div>
        )
    }

    const title = entry.media.titleSpanish || entry.media.titleRomaji || entry.media.titleEnglish || "Título Desconocido"
    const heroBackdrop = getHighResImage(entry.media.bannerImage || entry.media.posterImage || "")

    return (
        <div className="min-h-screen bg-[#09090b] text-white pb-16">
            <HeroSection
                seriesId={seriesId}
                directoryPath={entry.libraryData?.sharedPath || ""}
                backdropUrl={getHighResImage(entry.media.bannerImage || entry.media.posterImage)}
                entry={entry}
                onPlay={handlePlayDefault}
                className="cursor-pointer group/hero"
            />

            <div className="w-full max-w-[1800px] mx-auto px-6 sm:px-12 mt-12">
                <div className="mt-8">
                    {entry.media?.format === "MOVIE" ? (
                        <LocalFilesSection
                            localFiles={entry.localFiles || []}
                            title={title}
                            thumbnail={heroBackdrop}
                            onPlay={handlePlayLocalFile}
                            tmdbId={entry.media?.tmdbId}
                        />
                    ) : (
                        <SagaEpisodesSection 
                            seriesTitle={title} 
                            fallbackThumb={heroBackdrop} 
                            episodes={computedEpisodes}
                            localFiles={entry.localFiles || []}
                            sagas={sagas}
                            seriesTmdbId={entry.media?.tmdbId}
                            onPlay={handlePlayEpisode}
                            currentlyPlayingEpNumber={playTarget?.episodeNumber}
                        />
                    )}
                </div>
            </div>

            {playTarget && (
                <VideoPlayer
                    streamUrl={playTarget.path}
                    streamType={playTarget.streamType as "local" | "online" | "direct"}
                    episodeLabel={playTarget.episodeLabel}
                    episodeNumber={playTarget.episodeNumber}
                    mediaId={Number(seriesId)}
                    malId={playTarget.malId}
                    onClose={() => setPlayTarget(null)}
                />
            )}
        </div>
    )
}

interface HeroSectionProps {
    seriesId: string
    directoryPath: string
    backdropUrl: string
    entry: Anime_Entry
    onPlay?: () => void
    className?: string
}

const HeroSection = React.memo(function HeroSection({
    seriesId,
    directoryPath,
    backdropUrl,
    entry,
    onPlay,
    className
}: HeroSectionProps) {
    const [synopsisExpanded, setSynopsisExpanded] = useState(false)
    const media = entry.media!
    const synopsis = media.description || "Sin descripción disponible."
    const cleanSynopsis = useMemo(() => sanitizeHtml(synopsis), [synopsis])
    
    const title = media.titleSpanish || media.titleEnglish || media.titleRomaji || "Título Desconocido"
    const year = media.year?.toString() || ""
    
    const parseGenres = (g: any): string[] => {
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
        <section className={cn("relative w-full min-h-[85vh] flex flex-col justify-end overflow-hidden", className)}>
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
                <div className="absolute inset-0 bg-gradient-to-t from-[#09090b] via-[#09090b]/80 to-transparent" />
                <div className="absolute inset-0 bg-gradient-to-b from-[#09090b]/60 via-transparent to-transparent" />
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
                        className="w-full h-full object-cover object-center opacity-40 grayscale-[0.1] transition-all duration-1000 scale-[1.01] group-hover/hero:scale-105 group-hover/hero:opacity-60"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#09090b] via-[#09090b]/40 to-transparent transition-opacity group-hover/hero:opacity-60" />
                    <div className="absolute inset-0 bg-gradient-to-r from-[#09090b] via-transparent to-transparent transition-opacity group-hover/hero:opacity-60" />
                    
                    {/* Play Indicator on Hover */}
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/hero:opacity-100 transition-opacity duration-500">
                        <div className="w-20 h-20 rounded-full bg-brand-orange/20 backdrop-blur-md border border-brand-orange/50 flex items-center justify-center scale-75 group-hover/hero:scale-100 transition-transform duration-500">
                            <Play className="w-10 h-10 text-white fill-current translate-x-1" />
                        </div>
                    </div>
                </div>
            )}

            {/* Content */}
            <div className="relative z-10 flex flex-col lg:flex-row items-end gap-12 px-6 sm:px-12 pb-24 pt-40 max-w-[1800px] mx-auto w-full">
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
                        {media.logoImage ? (
                            <div 
                                className="relative h-32 sm:h-40 xl:h-56 mb-4 cursor-pointer group/logo"
                                onClick={onPlay}
                            >
                                <img 
                                    src={media.logoImage} 
                                    alt={title} 
                                    className="h-full w-auto object-contain object-left drop-shadow-[0_20px_50px_rgba(0,0,0,0.9)] brightness-110 transition-transform duration-500 group-hover/logo:scale-105" 
                                />
                            </div>
                        ) : (
                            <h1 
                                className="text-[clamp(3rem,7vw,9rem)] font-bebas font-normal leading-[0.8] tracking-tighter text-white uppercase drop-shadow-[0_10px_30px_rgba(0,0,0,0.5)] cursor-pointer"
                                onClick={onPlay}
                            >
                                {title}
                            </h1>
                        )}
                        
                        {/* Subtitle / Romaji if Spanish is main */}
                        {media.titleSpanish && (media.titleRomaji || media.titleEnglish) && (
                            <span className="text-zinc-500 text-xs font-black uppercase tracking-[0.4em] opacity-60">
                                {media.titleRomaji || media.titleEnglish}
                            </span>
                        )}
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
                                {localEpisodesCount}/{totalEpisodesCount} EPISODIOS
                            </span>
                        ) : episodesCount > 0 ? (
                            <span className="px-3 py-1 rounded-md border border-white/10 bg-white/5">{episodesCount} EPISODIOS</span>
                        ) : null}
                        <span className="px-3 py-1 rounded-md border border-white/10 bg-white/5">{media.format || "TV"}</span>
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
                        <MediaActionButtons seriesId={seriesId} directoryPath={directoryPath} onPlay={onPlay} />
                    </div>
                </div>
            </div>
        </section>
    )
})
HeroSection.displayName = "HeroSection"

interface SagaEpisodesSectionProps {
    seriesTitle: string
    fallbackThumb: string
    episodes: Anime_Episode[]
    localFiles: Anime_LocalFile[]
    sagas: SagaDefinition[]
    seriesTmdbId?: number | null
    onPlay?: (localFile: Anime_LocalFile, episode: Anime_Episode) => void
    currentlyPlayingEpNumber?: number
}

const SagaEpisodesSection = React.memo(function SagaEpisodesSection({
    seriesTitle,
    fallbackThumb,
    episodes,
    localFiles,
    sagas,
    seriesTmdbId,
    onPlay,
    currentlyPlayingEpNumber
}: SagaEpisodesSectionProps) {
    // Generate sagas or chunks of 20
    const generatedSagas = useMemo(() => {
        if (sagas && sagas.length > 0) return sagas.map(s => ({ ...s, isGenerated: false }))
        
        if (episodes.length === 0) return []
        
        const chunks = []
        for (let i = 0; i < episodes.length; i += 20) {
            const startEp = episodes[i].episodeNumber
            const endEp = episodes[Math.min(i + 19, episodes.length - 1)].episodeNumber
            chunks.push({
                id: `chunk-${i}`,
                title: `Episodios ${startEp} - ${endEp}`,
                startEp,
                endEp,
                description: "",
                image: fallbackThumb,
                isGenerated: true
            })
        }
        return chunks
    }, [sagas, episodes, fallbackThumb])

    const [activeSagaId, setActiveSagaId] = useState<string>(generatedSagas[0]?.id?.toString() || "")
    const [activeSubSagaId, setActiveSubSagaId] = useState<string>("all")

    const activeMainSaga = useMemo(() => {
        return generatedSagas.find(s => s.id.toString() === activeSagaId)
    }, [generatedSagas, activeSagaId])

    const visibleEpisodes = useMemo(() => {
        if (generatedSagas.length === 0) return episodes
        const saga = generatedSagas.find(s => s.id.toString() === activeSagaId)
        if (!saga) return episodes
        
        if (activeSubSagaId !== "all" && saga.subSagas) {
            const subSaga = saga.subSagas.find((ss: any) => ss.id === activeSubSagaId)
            if (subSaga) {
                return episodes.filter(ep => {
                    const epNum = ep.absoluteEpisodeNumber || ep.episodeNumber
                    return (ep as any).sagaId === subSaga.id || (epNum >= subSaga.startEp && epNum <= subSaga.endEp)
                })
            }
        }
        
        return episodes.filter(ep => {
            const epNum = ep.absoluteEpisodeNumber || ep.episodeNumber
            return (ep as any).sagaId === saga.id || (epNum >= saga.startEp && epNum <= saga.endEp)
        })
    }, [episodes, generatedSagas, activeSagaId, activeSubSagaId])

    const localFilesByEpisode = useMemo(() => {
        const map: Record<number, Anime_LocalFile> = {}
        localFiles.forEach((lf) => {
            if (lf.metadata?.episode) {
                map[lf.metadata.episode] = lf
            }
        })
        return map
    }, [localFiles])

    const getLocalFile = (epNum: number) => localFilesByEpisode[epNum]

    return (
        <section className="relative z-[1] pb-20 max-w-[1800px] mx-auto">
            <div className="flex flex-col lg:flex-row gap-12">
                {/* Sagas Sidebar (Left) */}
                {generatedSagas.length > 0 && (
                    <aside className="w-full lg:w-[400px] shrink-0">
                        <div className="sticky top-24 flex flex-col gap-6">
                            <h3 className="text-[11px] font-black tracking-[0.5em] text-zinc-700 uppercase px-2 mb-2 flex items-center gap-4">
                                <span className="w-8 h-[1px] bg-zinc-800" />
                                Seleccionar Saga
                            </h3>
                            <div className="flex flex-col border border-white/5 bg-zinc-950/20 backdrop-blur-md overflow-hidden">
                                {generatedSagas.map((saga, idx) => {
                                    const isLast = idx === generatedSagas.length - 1
                                    const isActive = activeSagaId === saga.id.toString()
                                    const hasSubSagas = saga.subSagas && saga.subSagas.length > 0

                                    return (
                                        <div key={saga.id} className="relative">
                                            <button
                                                onClick={() => {
                                                    setActiveSagaId(saga.id.toString())
                                                    setActiveSubSagaId("all")
                                                }}
                                                className={cn(
                                                    "group w-full flex items-center justify-between px-6 py-4 transition-all duration-300 relative",
                                                    isActive ? "bg-white/[0.03]" : "hover:bg-white/[0.01]"
                                                )}
                                            >
                                                <div className="flex items-center gap-4 relative z-10">
                                                    <div className="flex flex-col items-center">
                                                        <div className={cn(
                                                            "w-1.5 h-1.5 rounded-full transition-all duration-500",
                                                            isActive ? "bg-brand-orange scale-125 shadow-[0_0_10px_rgba(255,110,58,0.8)]" : "bg-zinc-800 group-hover:bg-zinc-600"
                                                        )} />
                                                        {!isLast && (
                                                            <div className="w-[1px] h-10 bg-zinc-900 mt-2" />
                                                        )}
                                                    </div>
                                                    <div className="flex flex-col items-start text-left">
                                                        <span className={cn(
                                                            "text-[8px] font-black tracking-[0.3em] mb-0.5 transition-colors uppercase",
                                                            isActive ? "text-brand-orange" : "text-zinc-600 group-hover:text-zinc-500"
                                                        )}>
                                                            Saga {idx + 1}
                                                        </span>
                                                        <span className={cn(
                                                            "text-[12px] font-bold uppercase tracking-[0.1em] transition-all duration-300",
                                                            isActive ? "text-white" : "text-zinc-500 group-hover:text-zinc-300"
                                                        )}>
                                                            {saga.title}
                                                        </span>
                                                    </div>
                                                </div>

                                                <div className={cn(
                                                    "text-[9px] font-mono transition-opacity",
                                                    isActive ? "text-brand-orange" : "text-zinc-700 opacity-0 group-hover:opacity-100"
                                                )}>
                                                    {saga.startEp}-{saga.endEp}
                                                </div>
                                            </button>

                                            {/* Sub-Sagas Accordion */}
                                            {isActive && hasSubSagas && (
                                                <motion.div 
                                                    initial={{ height: 0, opacity: 0 }}
                                                    animate={{ height: "auto", opacity: 1 }}
                                                    className="overflow-hidden ml-[31px] border-l border-white/5"
                                                >
                                                    <div className="flex flex-col py-2 gap-1">
                                                        <button
                                                            onClick={() => setActiveSubSagaId("all")}
                                                            className={cn(
                                                                "px-6 py-2 text-[10px] font-bold uppercase tracking-[0.15em] text-left transition-all",
                                                                activeSubSagaId === "all" ? "text-brand-orange" : "text-zinc-600 hover:text-zinc-400"
                                                            )}
                                                        >
                                                            Ver Todo
                                                        </button>
                                                        {saga.subSagas?.map((sub) => (
                                                            <button
                                                                key={sub.id}
                                                                onClick={() => setActiveSubSagaId(sub.id)}
                                                                className={cn(
                                                                    "px-6 py-2 text-[10px] font-bold uppercase tracking-[0.15em] text-left transition-all relative group/sub",
                                                                    activeSubSagaId === sub.id ? "text-white" : "text-zinc-700 hover:text-zinc-400"
                                                                )}
                                                            >
                                                                {activeSubSagaId === sub.id && (
                                                                    <motion.div 
                                                                        layoutId="activeSubDot"
                                                                        className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-4 bg-brand-orange" 
                                                                    />
                                                                )}
                                                                {sub.title}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </motion.div>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    </aside>
                )}

                {/* Episode List (Right) */}
                <div className="flex-1 flex flex-col gap-10">
                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-white/5 pb-8">
                        <div className="flex flex-col gap-2">
                            <h2 className="text-5xl font-bebas tracking-[0.2em] text-white uppercase leading-none">
                                {activeMainSaga?.title || "EPISODIOS"}
                            </h2>
                            <div className="flex items-center gap-4 text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500">
                                <span>{visibleEpisodes.length} TOTAL</span>
                                <span className="w-1 h-1 rounded-full bg-zinc-800" />
                                <span className="text-brand-orange">{visibleEpisodes.filter(e => e.watched).length} VISTOS</span>
                            </div>
                        </div>
                    </div>

                    {visibleEpisodes.length === 0 ? (
                        <div className="py-24 text-center">
                            <p className="text-zinc-600 font-bebas text-4xl tracking-widest">SIN EPISODIOS DISPONIBLES</p>
                            <p className="text-zinc-700 text-xs font-black uppercase tracking-[0.3em] mt-2">INTENTA ACTUALIZAR LA BIBLIOTECA</p>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-4">
                            {visibleEpisodes.map((ep) => (
                                <EpisodeCard
                                    key={ep.episodeNumber}
                                    episode={ep}
                                    variant="horizontal"
                                    fallbackThumb={fallbackThumb}
                                    localFile={getLocalFile(ep.episodeNumber)}
                                    onPlay={onPlay}
                                    isCurrentlyPlaying={currentlyPlayingEpNumber === ep.episodeNumber}
                                    seriesTmdbId={seriesTmdbId}
                                    seriesTitle={seriesTitle}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </section>
    )
})
SagaEpisodesSection.displayName = "SagaEpisodesSection"

// ─── Local Files Section (for Movies) ───────────────────────────────────────

interface LocalFilesSectionProps {
    localFiles: Anime_LocalFile[]
    title: string
    thumbnail?: string
    onPlay?: (localFile: Anime_LocalFile) => void
    tmdbId?: number | null
}

const LocalFilesSection = React.memo(function LocalFilesSection({
    localFiles,
    title,
    thumbnail,
    onPlay,
    tmdbId,
}: LocalFilesSectionProps) {
    const handleClick = (lf: Anime_LocalFile) => {
        if (onPlay) onPlay(lf)
    }

    return (
        <section className="relative z-[1] px-6 sm:px-12 pb-20 max-w-[1800px] mx-auto">
            <div className="flex flex-col gap-10">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-white/5 pb-8">
                    <div className="flex flex-col gap-2">
                        <h2 className="text-5xl font-bebas tracking-[0.2em] text-white uppercase leading-none">
                            ARCHIVOS LOCALES
                        </h2>
                        <div className="flex items-center gap-4 text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500">
                            <span>{localFiles.length} TOTAL</span>
                            <span className="w-1 h-1 rounded-full bg-zinc-800" />
                            <span className="text-brand-orange">SIN VINCULAR</span>
                        </div>
                    </div>
                </div>

                <div className="flex flex-col gap-4">
                    {localFiles.map((lf, idx) => {
                        const epNum = lf.parsedInfo?.episode || lf.metadata?.episode
                        const technical = lf.technicalInfo
                        const resolution = technical?.videoStream ? `${technical.videoStream.width}x${technical.videoStream.height}` : null
                        const fileSize = technical?.size ? `${(technical.size / (1024 * 1024 * 1024)).toFixed(2)} GB` : null
                        const localizedTitle = (epNum != null && tmdbId != null) ? getDragonBallSpanishTitle(Number(tmdbId), Number(epNum)) : null
                        const epTitle = localizedTitle ? `E${epNum} - ${localizedTitle}` : (epNum ? `Episodio ${epNum}` : lf.name)

                        return (
                            <div
                                key={lf.path || idx}
                                className="group relative flex flex-row gap-6 bg-zinc-950/80 transition-all duration-300 overflow-hidden p-4 rounded-md hover:bg-zinc-900/60"
                            >
                                {/* Thumbnail Area (Left) */}
                                <div 
                                    onClick={() => handleClick(lf)}
                                    className="relative aspect-video w-72 shrink-0 overflow-hidden rounded bg-zinc-950 cursor-pointer"
                                >
                                    {thumbnail ? (
                                        <DeferredImage
                                            src={thumbnail}
                                            alt={title}
                                            className="w-full h-full object-cover transition-all duration-500 opacity-70 group-hover:opacity-100"
                                            showSkeleton={false}
                                        />
                                    ) : (
                                        <div className="absolute inset-0 flex items-center justify-center bg-zinc-900">
                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-10 h-10 text-zinc-800 group-hover:text-brand-orange transition-colors" strokeWidth="1.5">
                                                <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"></rect>
                                                <line x1="7" y1="2" x2="7" y2="22"></line>
                                                <line x1="17" y1="2" x2="17" y2="22"></line>
                                                <line x1="2" y1="12" x2="22" y2="12"></line>
                                                <line x1="2" y1="7" x2="7" y2="7"></line>
                                                <line x1="2" y1="17" x2="7" y2="17"></line>
                                                <line x1="17" y1="17" x2="22" y2="17"></line>
                                                <line x1="17" y1="7" x2="22" y2="7"></line>
                                            </svg>
                                        </div>
                                    )}
                                    
                                    {/* Hover Play Button Overlay */}
                                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 bg-black/40">
                                        <div className="w-12 h-12 rounded-full border-2 border-white flex items-center justify-center bg-black/40 backdrop-blur-sm scale-90 group-hover:scale-100 transition-all duration-300 hover:border-brand-orange hover:bg-brand-orange/20 hover:text-brand-orange">
                                            <FaPlay className="w-4 h-4 ml-1" />
                                        </div>
                                    </div>

                                    {epNum && (
                                        <div className="absolute top-2 right-2 z-20">
                                            <span className="px-1.5 py-0.5 bg-black/80 text-[11px] font-medium text-white rounded">
                                                E{epNum}
                                            </span>
                                        </div>
                                    )}
                                </div>

                                {/* Info Area (Right) */}
                                <div className="flex flex-col justify-center flex-1 min-w-0">
                                    <div className="flex items-center gap-3 mb-2">
                                        <h3 className="text-lg font-bold text-white truncate group-hover:text-brand-orange transition-colors">
                                            {epTitle}
                                        </h3>
                                    </div>

                                    <div className="flex items-center gap-6 text-[10px] font-black tracking-widest uppercase text-zinc-500">
                                        {resolution && (
                                            <div className="flex items-center gap-2">
                                                <span className="w-1 h-1 rounded-full bg-zinc-800" />
                                                {resolution}
                                            </div>
                                        )}
                                        {fileSize && (
                                            <div className="flex items-center gap-2">
                                                <span className="w-1 h-1 rounded-full bg-zinc-800" />
                                                {fileSize}
                                            </div>
                                        )}
                                        <div className="flex items-center gap-2">
                                            <span className="w-1 h-1 rounded-full bg-zinc-800" />
                                            MKV
                                        </div>
                                    </div>
                                    
                                    <div className="mt-4 flex items-center gap-4 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0">
                                        <button 
                                            onClick={() => handleClick(lf)}
                                            className="px-4 py-2 bg-white text-black text-[10px] font-black uppercase tracking-widest rounded hover:bg-brand-orange hover:text-white transition-all"
                                        >
                                            Reproducir
                                        </button>
                                        <button className="p-2 text-zinc-500 hover:text-white transition-colors">
                                            <FolderOpen className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>
        </section>
    )
})
LocalFilesSection.displayName = "LocalFilesSection"
