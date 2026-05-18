import { createFileRoute } from "@tanstack/react-router"
import { HydrationBoundary, dehydrate, useQueryClient } from "@tanstack/react-query"
import React, { useMemo, useState } from "react"
import { toast } from "sonner"
import { useAppStore } from "@/lib/store"
import { motion } from "framer-motion"

import { cn } from "@/components/ui/core/styling"
import { getHighResImage } from "@/lib/helpers/images"
import { fetchAnimeEntry, useGetAnimeEntry, useUpdateAnimeEntryProgress } from "@/api/hooks/anime_entries.hooks"
import { useGetContinuityWatchHistoryItem } from "@/api/hooks/continuity.hooks"
import { API_ENDPOINTS } from "@/api/generated/endpoints"
import { Anime_Episode, Anime_LocalFile, Mediastream_StreamType } from "@/api/generated/types"
import { EmptyState } from "@/components/shared/empty-state"
import { VideoPlayer } from "@/components/video/player"
import { RelationsTab, CharactersTab, TechnicalMetadataTab } from "./-series-bento-tabs"
import { resolveSeriesSagas } from "@/lib/config/dragonball.config"

// Modular Components
import { HeroSection } from "./-components/series-hero"
import { MovieHeroSection } from "./-components/movie-hero"
import { SagaEpisodesSection } from "./-components/saga-episodes"
import { LocalFilesSection } from "./-components/local-files-section"

export const Route = createFileRoute("/series/$seriesId/")({
    loader: async ({ params: { seriesId }, context }) => {
        const qc = context.queryClient
        qc.prefetchQuery({
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
            <SeriesDetailClient key={seriesId} seriesId={seriesId} />
        </HydrationBoundary>
    )
}

export function SeriesDetailClient({ seriesId }: { seriesId: string }) {
    const queryClient = useQueryClient()
    const { data: entry, isLoading } = useGetAnimeEntry(seriesId)
    const { data: continuityData, refetch: refetchContinuity } = useGetContinuityWatchHistoryItem(Number(seriesId))

    const [playTarget, setPlayTarget] = useState<{
        path: string
        streamType: Mediastream_StreamType
        episodeLabel: string
        episodeNumber: number
        malId?: number | null
    } | null>(null)

    const [activeTab, setActiveTab] = useState<"episodes" | "movie" | "relations" | "characters" | "technical">("episodes")
    const [prevEntryId, setPrevEntryId] = useState<number | null>(null)

    if (entry?.media && entry.media.id !== prevEntryId) {
        setPrevEntryId(entry.media.id)
        const isMovie = entry.media.format === "MOVIE" || entry.media.format === "SPECIAL" || entry.media.format === "OVA"
        setActiveTab(isMovie ? "movie" : "episodes")
    }

    const sagas = useMemo(() => entry?.media ? resolveSeriesSagas(entry.media) : [], [entry])
    
    const computedEpisodes = useMemo(() => {
        if (!entry) return []
        if (entry.episodes && entry.episodes.length > 0) {
            return entry.episodes.filter(ep => ep && typeof ep.episodeNumber === 'number');
        }
        
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

    const { mutate: updateProgress } = useUpdateAnimeEntryProgress(seriesId, 0, false)

    const handleUpdateProgress = (newProgress: number) => {
        if (!entry) return
        updateProgress({
            mediaId: Number(seriesId),
            episodeNumber: newProgress,
            totalEpisodes: entry.media?.totalEpisodes || computedEpisodes.length || 0,
            malId: entry.media?.idMal || undefined,
        }, {
            onSuccess: () => {
                refetchContinuity()
            }
        })
    }

    const handleToggleWatched = (episode: Anime_Episode) => {
        if (!entry) return
        const epNum = episode.absoluteEpisodeNumber || episode.episodeNumber
        const newProgress = episode.watched ? Math.max(0, epNum - 1) : epNum
        handleUpdateProgress(newProgress)
    }

    const handlePlayEpisode = (localFile: Anime_LocalFile, episode: Anime_Episode) => {
        if (!localFile.path) {
            toast.error("Archivo local no disponible.")
            return
        }
        const isMp4 = localFile.path.toLowerCase().endsWith(".mp4")
        const targetType = isMp4 ? "direct" : "transcode"
        const epNum = episode.absoluteEpisodeNumber || episode.episodeNumber
        setPlayTarget({
            path: localFile.path,
            streamType: targetType as Mediastream_StreamType,
            episodeLabel: episode.episodeTitle || episode.displayTitle || `Episodio ${epNum}`,
            episodeNumber: epNum,
            malId: entry?.media?.idMal ?? null,
        })
    }

    const handlePlayLocalFile = (localFile: Anime_LocalFile) => {
        if (!localFile.path) {
            toast.error("Archivo no disponible.")
            return
        }
        const epNum = localFile.parsedInfo?.episode || localFile.metadata?.episode || 1
        const seasonNum = localFile.parsedInfo?.season
        
        // Try to find the matching episode in computedEpisodes to resolve absoluteEpisodeNumber
        const matchedEp = computedEpisodes.find(ep => {
            if (typeof ep.seasonNumber === 'number' && seasonNum != null) {
                return ep.episodeNumber === Number(epNum) && ep.seasonNumber === Number(seasonNum)
            }
            return ep.episodeNumber === Number(epNum)
        })
        const resolvedEpNum = matchedEp ? (matchedEp.absoluteEpisodeNumber || matchedEp.episodeNumber) : Number(epNum)

        const isMp4 = localFile.path.toLowerCase().endsWith(".mp4")
        const targetType = isMp4 ? "direct" : "transcode"
        setPlayTarget({
            path: localFile.path,
            streamType: targetType as Mediastream_StreamType,
            episodeLabel: localFile.name,
            episodeNumber: resolvedEpNum,
            malId: entry?.media?.idMal ?? null,
        })
    }
    
    const handlePlayDefault = () => {
        if (entry?.media?.format === "MOVIE" || !computedEpisodes || computedEpisodes.length === 0) {
            if (entry?.localFiles && entry.localFiles.length > 0) {
                let targetFile = entry.localFiles[0]
                if (continuityData?.item?.episodeNumber) {
                    const matchedFile = entry.localFiles.find(f => {
                        const ep = f.metadata?.episode || f.parsedInfo?.episode
                        return ep != null && Number(ep) === continuityData.item?.episodeNumber
                    })
                    if (matchedFile) targetFile = matchedFile
                }
                handlePlayLocalFile(targetFile)
            } else {
                toast.info("No hay archivos locales disponibles para reproducir.")
            }
            return
        }
        
        // Find resume episode or first unwatched episode
        let targetEp = computedEpisodes.find(ep => !ep.watched) || computedEpisodes[0]
        if (continuityData?.item) {
            const resumeEp = computedEpisodes.find(ep => (ep.absoluteEpisodeNumber || ep.episodeNumber) === continuityData.item?.episodeNumber)
            if (resumeEp) {
                targetEp = resumeEp
            }
        }
        
        const lf = targetEp.localFile || (entry?.localFiles || []).find(f => {
            const fEp = f.metadata?.episode || f.parsedInfo?.episode
            const fSeason = f.parsedInfo?.season
            if (fEp == null) return false
            if (typeof targetEp.seasonNumber === 'number' && fSeason != null) {
                return Number(fEp) === targetEp.episodeNumber && Number(fSeason) === targetEp.seasonNumber
            }
            return Number(fEp) === targetEp.episodeNumber
        })
        
        if (lf) {
            handlePlayEpisode(lf, targetEp)
        } else if (entry?.localFiles && entry.localFiles.length > 0) {
            // If no metadata match, just play first available local file
            handlePlayLocalFile(entry.localFiles[0])
        } else {
            toast.info("No hay archivos locales disponibles para reproducir.")
        }
    }

    const marathonModeStore = useAppStore(s => s.marathonMode)

    const handleNextEpisode = () => {
        if (!computedEpisodes || !playTarget) return
        const currentEpIdx = computedEpisodes.findIndex(ep => (ep.absoluteEpisodeNumber || ep.episodeNumber) === playTarget.episodeNumber)
        if (currentEpIdx === -1 || currentEpIdx >= computedEpisodes.length - 1) {
            toast.info("Has llegado al final de la lista de episodios.")
            setPlayTarget(null)
            return
        }
        const nextEp = computedEpisodes[currentEpIdx + 1]
        const lf = nextEp.localFile || (entry?.localFiles || []).find(f => {
            const fEp = f.metadata?.episode || f.parsedInfo?.episode
            const fSeason = f.parsedInfo?.season
            if (fEp == null) return false
            if (typeof nextEp.seasonNumber === 'number' && fSeason != null) {
                return Number(fEp) === nextEp.episodeNumber && Number(fSeason) === nextEp.seasonNumber
            }
            return Number(fEp) === nextEp.episodeNumber
        })
        if (!lf) {
            toast.error("El siguiente episodio no está disponible localmente.")
            setPlayTarget(null)
            return
        }
        handlePlayEpisode(lf, nextEp)
    }

    if (isLoading) {
        return (
            <div className="min-h-screen bg-[#09090b] text-white flex items-center justify-center">
                <div className="flex flex-col items-center gap-5">
                    <div className="w-10 h-10 border-2 border-brand-orange border-t-transparent rounded-full animate-spin" />
                    <span className="text-[9px] font-black uppercase tracking-[0.5em] text-zinc-500 animate-pulse">Cargando...</span>
                </div>
            </div>
        )
    }

    if (!entry || !entry.media) {
        return (
            <div className="min-h-screen bg-[#09090b] text-white flex items-center justify-center px-6">
                <EmptyState
                    title="Contenido no encontrado"
                    message="No pudimos cargar este contenido. Vuelve al inicio o intenta con otro."
                />
            </div>
        )
    }

    const title = entry.media.titleSpanish || entry.media.titleRomaji || entry.media.titleEnglish || "Título Desconocido"
    const heroBackdrop = getHighResImage(entry.media.bannerImage || entry.media.posterImage || "")

    const hasRelations = entry.media?.relations && entry.media.relations.length > 0
    const hasCharacters = entry.media?.characters?.edges && entry.media.characters.edges.length > 0
    const hasTechnical = entry.localFiles && entry.localFiles.length > 0

    return (
        <div className="min-h-screen bg-[#09090b] text-white pb-16">
            {entry.media?.format === "MOVIE" || entry.media?.format === "SPECIAL" || entry.media?.format === "OVA" ? (
                <MovieHeroSection
                    seriesId={seriesId}
                    directoryPath={entry.libraryData?.sharedPath || ""}
                    backdropUrl={getHighResImage(entry.media.bannerImage || entry.media.posterImage)}
                    entry={entry}
                    onPlay={handlePlayDefault}
                    continuityItem={continuityData?.item}
                    className="cursor-pointer group/hero"
                />
            ) : (
                <HeroSection
                    seriesId={seriesId}
                    directoryPath={entry.libraryData?.sharedPath || ""}
                    backdropUrl={getHighResImage(entry.media.bannerImage || entry.media.posterImage)}
                    entry={entry}
                    onPlay={handlePlayDefault}
                    continuityItem={continuityData?.item}
                    className="cursor-pointer group/hero"
                />
            )}
            <div className="w-full max-w-[1800px] mx-auto px-6 sm:px-12 mt-12">
                {/* Custom Glassmorphic Tabs Navigation for Series/Shows */}
                {entry.media?.format !== "MOVIE" && (
                    <div className="flex border-b border-white/5 pb-2 mb-8 gap-8 overflow-x-auto no-scrollbar">
                        <button
                            onClick={() => setActiveTab("episodes")}
                            className={cn(
                                "text-sm uppercase tracking-[0.2em] font-black pb-3 transition-all relative shrink-0",
                                activeTab === "episodes" ? "text-brand-orange" : "text-zinc-500 hover:text-zinc-300"
                            )}
                        >
                            Episodios
                            {activeTab === "episodes" && (
                                <motion.div layoutId="detailActiveLine" className="absolute bottom-0 left-0 right-0 h-[2px] bg-brand-orange" />
                            )}
                        </button>

                        {hasRelations && (
                            <button
                                onClick={() => setActiveTab("relations")}
                                className={cn(
                                    "text-sm uppercase tracking-[0.2em] font-black pb-3 transition-all relative shrink-0",
                                    activeTab === "relations" ? "text-brand-orange" : "text-zinc-500 hover:text-zinc-300"
                                )}
                            >
                                Relacionados
                                {activeTab === "relations" && (
                                    <motion.div layoutId="detailActiveLine" className="absolute bottom-0 left-0 right-0 h-[2px] bg-brand-orange" />
                                )}
                            </button>
                        )}

                        {hasCharacters && (
                            <button
                                onClick={() => setActiveTab("characters")}
                                className={cn(
                                    "text-sm uppercase tracking-[0.2em] font-black pb-3 transition-all relative shrink-0",
                                    activeTab === "characters" ? "text-brand-orange" : "text-zinc-500 hover:text-zinc-300"
                                )}
                            >
                                Personajes
                                {activeTab === "characters" && (
                                    <motion.div layoutId="detailActiveLine" className="absolute bottom-0 left-0 right-0 h-[2px] bg-brand-orange" />
                                )}
                            </button>
                        )}

                        {hasTechnical && (
                            <button
                                onClick={() => setActiveTab("technical")}
                                className={cn(
                                    "text-sm uppercase tracking-[0.2em] font-black pb-3 transition-all relative shrink-0",
                                    activeTab === "technical" ? "text-brand-orange" : "text-zinc-500 hover:text-zinc-300"
                                )}
                            >
                                Datos Técnicos
                                {activeTab === "technical" && (
                                    <motion.div layoutId="detailActiveLine" className="absolute bottom-0 left-0 right-0 h-[2px] bg-brand-orange" />
                                )}
                            </button>
                        )}
                    </div>
                )}

                {/* Custom Glassmorphic Tabs Navigation for Movies */}
                {entry.media?.format === "MOVIE" && (
                    <div className="flex border-b border-white/5 pb-2 mb-8 gap-8 overflow-x-auto no-scrollbar">
                        <button
                            onClick={() => setActiveTab("movie")}
                            className={cn(
                                "text-sm uppercase tracking-[0.2em] font-black pb-3 transition-all relative shrink-0",
                                activeTab === "movie" ? "text-brand-orange" : "text-zinc-500 hover:text-zinc-300"
                            )}
                        >
                            Ver Película
                            {activeTab === "movie" && (
                                <motion.div layoutId="detailActiveLine" className="absolute bottom-0 left-0 right-0 h-[2px] bg-brand-orange" />
                            )}
                        </button>

                        {hasRelations && (
                            <button
                                onClick={() => setActiveTab("relations")}
                                className={cn(
                                    "text-sm uppercase tracking-[0.2em] font-black pb-3 transition-all relative shrink-0",
                                    activeTab === "relations" ? "text-brand-orange" : "text-zinc-500 hover:text-zinc-300"
                                )}
                            >
                                Relacionados
                                {activeTab === "relations" && (
                                    <motion.div layoutId="detailActiveLine" className="absolute bottom-0 left-0 right-0 h-[2px] bg-brand-orange" />
                                )}
                            </button>
                        )}

                        {hasCharacters && (
                            <button
                                onClick={() => setActiveTab("characters")}
                                className={cn(
                                    "text-sm uppercase tracking-[0.2em] font-black pb-3 transition-all relative shrink-0",
                                    activeTab === "characters" ? "text-brand-orange" : "text-zinc-500 hover:text-zinc-300"
                                )}
                            >
                                Personajes
                                {activeTab === "characters" && (
                                    <motion.div layoutId="detailActiveLine" className="absolute bottom-0 left-0 right-0 h-[2px] bg-brand-orange" />
                                )}
                            </button>
                        )}

                        {hasTechnical && (
                            <button
                                onClick={() => setActiveTab("technical")}
                                className={cn(
                                    "text-sm uppercase tracking-[0.2em] font-black pb-3 transition-all relative shrink-0",
                                    activeTab === "technical" ? "text-brand-orange" : "text-zinc-500 hover:text-zinc-300"
                                )}
                            >
                                Datos Técnicos
                                {activeTab === "technical" && (
                                    <motion.div layoutId="detailActiveLine" className="absolute bottom-0 left-0 right-0 h-[2px] bg-brand-orange" />
                                )}
                            </button>
                        )}
                    </div>
                )}

                <div className="mt-8 min-h-[300px]">
                    {entry.media?.format === "MOVIE" ? (
                        <div className="flex flex-col gap-12 animate-fade-in">
                            {/* Local Movie File Section */}
                            {activeTab === "movie" && (
                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 items-start">
                                    {/* Left Column: Synopsis, Alternative Versions & Premium Reparto (Cast) */}
                                    <div className="lg:col-span-2 flex flex-col gap-8">
                                        <div className="flex flex-col gap-4">
                                            <p className="text-[17px] text-zinc-300 leading-relaxed font-normal tracking-wide antialiased">
                                                {entry.media?.description ? entry.media.description.replace(/<[^>]*>/g, '') : "Sin descripción disponible."}
                                            </p>
                                        </div>

                                        {/* Premium Visual Reparto (Cast Grid) */}
                                        {entry.media?.characters?.edges && entry.media.characters.edges.length > 0 && (
                                            <div className="flex flex-col gap-5 pt-8 border-t border-white/5">
                                                <div className="flex items-center justify-between">
                                                    <h4 className="text-xs font-black uppercase tracking-[0.25em] text-zinc-400">Reparto Principal</h4>
                                                    {entry.media.characters.edges.length > 6 && (
                                                        <button 
                                                            onClick={() => setActiveTab("characters")}
                                                            className="text-[10px] font-black text-brand-orange hover:text-white uppercase tracking-[0.15em] transition-colors"
                                                        >
                                                            Ver Reparto Completo →
                                                        </button>
                                                    )}
                                                </div>
                                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                                                    {entry.media.characters.edges.slice(0, 6).map((edge, idx) => (
                                                        <div 
                                                            key={idx} 
                                                            className="flex items-center gap-3.5 p-3.5 bg-zinc-950/20 border border-white/5 rounded-2xl hover:border-brand-orange/20 transition-all duration-300 group cursor-pointer"
                                                            onClick={() => setActiveTab("characters")}
                                                        >
                                                            <div className="w-11 h-11 rounded-full overflow-hidden bg-zinc-900 border border-white/10 shrink-0 shadow-lg group-hover:border-brand-orange/50 transition-colors">
                                                                {edge.node?.image ? (
                                                                    <img src={edge.node.image} alt={edge.node.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                                                                ) : (
                                                                    <div className="w-full h-full bg-zinc-950 flex items-center justify-center text-[10px] text-zinc-600 font-bold uppercase">
                                                                        {edge.node?.name ? edge.node.name.slice(0, 2) : "C"}
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <div className="flex flex-col truncate">
                                                                <span className="text-[12px] font-bold text-white group-hover:text-brand-orange transition-colors truncate">{edge.node?.name}</span>
                                                                <span className="text-[9px] font-black text-zinc-500 tracking-wider uppercase truncate mt-0.5">{edge.role === "MAIN" ? "Principal" : "Secundario"}</span>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Alternate Versions & Local Files Switcher (Low Profile) */}
                                        {entry.localFiles && entry.localFiles.length > 1 && (
                                            <div className="flex flex-col gap-4 pt-8 border-t border-white/5">
                                                <span className="text-[10px] font-black text-zinc-500 tracking-[0.2em] uppercase">Versiones Alternativas Disponibles:</span>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                    {entry.localFiles.map((lf, idx) => (
                                                        <div 
                                                            key={idx} 
                                                            className="flex items-center justify-between p-4 bg-zinc-950/30 border border-white/5 rounded-2xl hover:border-brand-orange/30 hover:bg-zinc-900/10 transition-all duration-300 group"
                                                        >
                                                            <span className="text-xs text-zinc-400 font-bold truncate max-w-[70%] group-hover:text-white transition-colors">{lf.name}</span>
                                                            <button 
                                                                onClick={() => handlePlayLocalFile(lf)}
                                                                className="px-3.5 py-1.5 bg-white/5 border border-white/10 rounded-lg text-[9px] font-black text-brand-orange hover:bg-brand-orange hover:text-white hover:border-brand-orange uppercase tracking-wider transition-all duration-300"
                                                            >
                                                                REPRODUCIR
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Right Column: Premium Metadata & General Info Sidebar */}
                                    <div className="flex flex-col gap-6 bg-zinc-950/20 backdrop-blur-md border border-white/5 rounded-2xl p-8 hover:border-brand-orange/10 transition-all duration-500">
                                        {/* Géneros */}
                                        {entry.media?.genres && (
                                            <div className="flex flex-col gap-2">
                                                <span className="text-[10px] font-black text-zinc-500 tracking-[0.2em] uppercase">Géneros:</span>
                                                <div className="flex flex-wrap gap-2 mt-1">
                                                    {(() => {
                                                        const g = entry.media.genres as any;
                                                        if (!g) return null;
                                                        let genresArr: any[] = [];
                                                        if (Array.isArray(g)) genresArr = g;
                                                        else if (typeof g === "string") {
                                                            try {
                                                                if (g.startsWith("[")) {
                                                                    const parsed = JSON.parse(g);
                                                                    if (Array.isArray(parsed)) genresArr = parsed;
                                                                } else {
                                                                    const decoded = atob(g);
                                                                    if (decoded.startsWith("[")) {
                                                                        const parsed = JSON.parse(decoded);
                                                                        if (Array.isArray(parsed)) genresArr = parsed;
                                                                    }
                                                                }
                                                            } catch {
                                                                genresArr = [g];
                                                            }
                                                        }
                                                        return genresArr.map((gen: string) => (
                                                            <span key={gen} className="px-2.5 py-1 text-[9px] font-black uppercase tracking-wider bg-white/5 border border-white/10 text-white/70 rounded-md">
                                                                {gen}
                                                            </span>
                                                        ));
                                                    })()}
                                                </div>
                                            </div>
                                        )}

                                        {/* Especificaciones del Archivo */}
                                        {entry.localFiles && entry.localFiles.length > 0 && (
                                            <div className="flex flex-col gap-4 pt-4 border-t border-white/5">
                                                <span className="text-[10px] font-black text-zinc-500 tracking-[0.2em] uppercase">Especificaciones del Archivo:</span>
                                                {(() => {
                                                    const tech = entry.localFiles[0]?.technicalInfo;
                                                    const isMp4 = entry.localFiles[0]?.path?.toLowerCase().endsWith(".mp4");
                                                    return (
                                                        <div className="flex flex-col gap-3 font-mono text-[11px] text-zinc-400">
                                                            <div className="flex items-center justify-between py-1 border-b border-white/[0.02]">
                                                                <span className="font-sans font-black text-[9px] text-zinc-600 tracking-wider uppercase">Contenedor</span>
                                                                <span className="font-bold text-white uppercase tracking-widest">{isMp4 ? "MP4" : "MKV"}</span>
                                                            </div>
                                                            {tech?.videoStream && (
                                                                <>
                                                                    <div className="flex items-center justify-between py-1 border-b border-white/[0.02]">
                                                                        <span className="font-sans font-black text-[9px] text-zinc-600 tracking-wider uppercase">Resolución</span>
                                                                        <span className="font-bold text-white tracking-widest">{tech.videoStream.width}x{tech.videoStream.height}</span>
                                                                    </div>
                                                                    <div className="flex items-center justify-between py-1 border-b border-white/[0.02]">
                                                                        <span className="font-sans font-black text-[9px] text-zinc-600 tracking-wider uppercase">Video Códec</span>
                                                                        <span className="font-bold text-brand-orange tracking-widest uppercase">{tech.videoStream.codec || "AVC"}</span>
                                                                    </div>
                                                                </>
                                                            )}
                                                            <div className="flex items-center justify-between py-1">
                                                                <span className="font-sans font-black text-[9px] text-zinc-600 tracking-wider uppercase">Estado</span>
                                                                <span className="font-bold text-emerald-500 uppercase tracking-widest">Listo</span>
                                                            </div>
                                                        </div>
                                                    );
                                                })()}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Characters Section */}
                            {activeTab === "characters" && hasCharacters && (
                                <div className="bg-zinc-950/40 backdrop-blur-md border border-white/5 rounded-3xl p-8 hover:border-brand-orange/10 transition-all duration-500">
                                    <div className="flex items-center justify-between mb-8 border-b border-white/5 pb-4">
                                        <h3 className="text-xl font-bebas tracking-[0.2em] text-white uppercase">REPARTO Y PERSONAJES</h3>
                                        <span className="text-[9px] font-black tracking-widest text-zinc-500 uppercase">PERSONAJES PRINCIPALES</span>
                                    </div>
                                    <CharactersTab characters={entry.media?.characters?.edges || []} />
                                </div>
                            )}

                            {/* Technical Specs Panel */}
                            {activeTab === "technical" && hasTechnical && (
                                <div className="bg-zinc-950/40 backdrop-blur-md border border-white/5 rounded-3xl p-8 hover:border-brand-orange/10 transition-all duration-500">
                                    <div className="flex items-center justify-between mb-8 border-b border-white/5 pb-4">
                                        <h3 className="text-xl font-bebas tracking-[0.2em] text-white uppercase">INFORMACIÓN TÉCNICA</h3>
                                        <span className="text-[9px] font-black tracking-widest text-zinc-500 uppercase">DETALLES DEL ARCHIVO DE VIDEO</span>
                                    </div>
                                    <TechnicalMetadataTab localFiles={entry.localFiles || []} />
                                </div>
                            )}

                            {/* Relations / Sequel/Prequel Movies & Series */}
                            {activeTab === "relations" && hasRelations && (
                                <div className="bg-zinc-950/40 backdrop-blur-md border border-white/5 rounded-3xl p-8 hover:border-brand-orange/10 transition-all duration-500">
                                    <div className="flex items-center justify-between mb-8 border-b border-white/5 pb-4">
                                        <h3 className="text-xl font-bebas tracking-[0.2em] text-white uppercase">CONTENIDO RELACIONADO</h3>
                                        <span className="text-[9px] font-black tracking-widest text-zinc-500 uppercase">SAGA Y SECUELAS</span>
                                    </div>
                                    <RelationsTab media={entry.media} />
                                </div>
                            )}
                        </div>
                    ) : (
                        <>
                            {activeTab === "episodes" && (
                                <div className="mt-8 animate-fade-in">
                                    <SagaEpisodesSection 
                                        seriesTitle={title} 
                                        fallbackThumb={heroBackdrop} 
                                        episodes={computedEpisodes}
                                        localFiles={entry.localFiles || []}
                                        sagas={sagas}
                                        seriesTmdbId={entry.media?.tmdbId}
                                        onPlay={handlePlayEpisode}
                                        onToggleWatched={handleToggleWatched}
                                        onUpdateProgress={handleUpdateProgress}
                                        continuityItem={continuityData?.item}
                                        currentlyPlayingEpNumber={playTarget?.episodeNumber}
                                    />
                                </div>
                            )}

                            {activeTab === "relations" && (
                                <div className="py-4 animate-fade-in">
                                    <RelationsTab media={entry.media} />
                                </div>
                            )}

                            {activeTab === "characters" && (
                                <div className="py-4 animate-fade-in">
                                    <CharactersTab characters={entry.media?.characters?.edges || []} />
                                </div>
                            )}

                            {activeTab === "technical" && (
                                <div className="py-4 animate-fade-in">
                                    <TechnicalMetadataTab localFiles={entry.localFiles || []} />
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>

            {playTarget && (
                <VideoPlayer
                    streamUrl={playTarget.path}
                    streamType={playTarget.streamType as "local" | "online" | "direct"}
                    title={title}
                    episodeLabel={playTarget.episodeLabel}
                    episodeNumber={playTarget.episodeNumber}
                    mediaId={Number(seriesId)}
                    malId={playTarget.malId}
                    mediaFormat={entry.media?.format ?? null}
                    marathonMode={marathonModeStore}
                    onNextEpisode={handleNextEpisode}
                    hasNextEpisode={computedEpisodes && playTarget ? computedEpisodes.findIndex(ep => (ep?.absoluteEpisodeNumber || ep?.episodeNumber) === playTarget.episodeNumber) < computedEpisodes.length - 1 : false}
                    onClose={() => {
                        setPlayTarget(null)
                        refetchContinuity()
                        queryClient.invalidateQueries({ queryKey: [API_ENDPOINTS.ANIME_ENTRIES.GetAnimeEntry.key, String(seriesId)] })
                    }}
                />
            )}
        </div>
    )
}
