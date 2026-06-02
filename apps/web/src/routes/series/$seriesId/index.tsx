import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { HydrationBoundary, dehydrate, useQueryClient } from "@tanstack/react-query"
import React, { useMemo, useState, useCallback } from "react"
import { toast } from "sonner"
import { useAppStore } from "@/lib/store"
import { motion, AnimatePresence } from "framer-motion"
import { useSound } from "@/hooks/use-sound"

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
import { startViewTransition } from "@/lib/helpers/transitions"

// Modular Components
import { SeriesHero } from "./-components/series-hero"
import { SagaSelector } from "./-components/saga-selector"
import { CharacterCarousel } from "./-components/character-carousel"
import { PremiumEpisodeList } from "./-components/premium-episode-list"
import type { SagaDTO, CharacterDTO, PremiumEpisode } from "@/api/types/series.types"

export const Route = createFileRoute("/series/$seriesId/")({
    loader: ({ params: { seriesId }, context }) => {
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
    const { playSound } = useSound()
    const queryClient = useQueryClient()
    const navigate = useNavigate()
    const { data: entry, isLoading } = useGetAnimeEntry(seriesId)
    const { data: continuityData, refetch: refetchContinuity } = useGetContinuityWatchHistoryItem(Number(seriesId))

    const isMovie = React.useMemo(() => {
        if (!entry?.media) return false
        return entry.media.format === "MOVIE" || entry.media.format === "SPECIAL" || entry.media.format === "OVA"
    }, [entry])

    React.useEffect(() => {
        if (isMovie) {
            navigate({ to: "/movies/$movieId", params: { movieId: String(seriesId) }, replace: true })
        }
    }, [isMovie, seriesId, navigate])

    React.useEffect(() => {
        if (entry && !isMovie) {
            playSound("detail", 0.4)
        }
    }, [entry?.media?.id, isMovie, playSound])

    const [playTarget, setPlayTarget] = useState<{
        path: string
        streamType: Mediastream_StreamType
        episodeLabel: string
        episodeNumber: number
        malId?: number | null
    } | null>(null)

    const [activeTab, setActiveTab] = useState<"episodes" | "movie" | "relations" | "characters" | "technical">("episodes")
    const [prevEntryId, setPrevEntryId] = useState<number | null>(null)
    const [activeSagaId, setActiveSagaId] = useState<string>("")
    const [activeSubSagaId, setActiveSubSagaId] = useState<string>("")

    if (entry?.media && entry.media.id !== prevEntryId) {
        setPrevEntryId(entry.media.id)
        setActiveTab("episodes")
        setActiveSagaId("") // Reset saga on change
        setActiveSubSagaId("") // Reset subSaga on change
    }

    const baseSagas = useMemo(() => entry?.media ? resolveSeriesSagas(entry.media) : [], [entry])

    // Convert config sagas to DTO format
    const sagas: SagaDTO[] = useMemo(() => {
        const allChars = (entry?.media?.characters?.edges || [])
            .filter(edge => edge.node?.image?.large || edge.node?.image?.medium)
            .map(edge => ({
                name: edge.node?.name?.full || "Unknown",
                roleTag: (edge.role === "MAIN" ? "Protagonist" : "Supporting") as any,
                avatarUrl: edge.node?.image?.large || edge.node?.image?.medium || ""
            }));

        return baseSagas.map((s, idx) => ({
            id: s.id,
            name: s.title,
            episodeRange: `${s.startEp}-${s.endEp}`,
            description: s.description || "",
            isFiller: s.title.toLowerCase().includes("filler") || s.title.toLowerCase().includes("relleno"),
            keyCharacters: allChars.slice(0, 15), // Mapeo temporal general
            subSagas: s.subSagas?.map(ss => ({
                id: ss.id,
                name: ss.title,
                episodeRange: `${ss.startEp}-${ss.endEp}`,
                startEp: ss.startEp,
                endEp: ss.endEp
            })) || []
        }))
    }, [baseSagas, entry])

    const activeSubSaga = useMemo(() => {
        if (!activeSagaId || !activeSubSagaId) return null
        const currentSaga = sagas.find(s => s.id === activeSagaId)
        return currentSaga?.subSagas?.find(ss => ss.id === activeSubSagaId) || null
    }, [sagas, activeSagaId, activeSubSagaId])

    React.useEffect(() => {
        if (sagas.length > 0 && !activeSagaId) {
            setActiveSagaId(sagas[0].id)
        }
    }, [sagas, activeSagaId])
    const computedEpisodes = useMemo(() => {
        if (!entry) return []
        if (entry.episodes && entry.episodes.length > 0) {
            const eps = entry.episodes.filter(ep => ep && typeof ep.episodeNumber === 'number');
            eps.forEach(ep => {
                if (!ep.sagaId && sagas.length > 0) {
                    const epNum = ep.absoluteEpisodeNumber || ep.episodeNumber;
                    const matchingSaga = baseSagas.find(s => epNum >= s.startEp && epNum <= s.endEp);
                    if (matchingSaga) {
                        ep.sagaId = matchingSaga.id;
                    }
                }
            });
            return eps;
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
                        const matchingSaga = baseSagas.find(s => epNum >= s.startEp && epNum <= s.endEp);
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

    const handleUpdateProgress = useCallback((newProgress: number) => {
        if (!entry) return
        updateProgress({
            mediaId: Number(seriesId),
            progress: newProgress,
        }, {
            onSuccess: () => {
                refetchContinuity()
            }
        })
    }, [entry, seriesId, computedEpisodes.length, updateProgress, refetchContinuity])

    const handleToggleWatched = useCallback((episode: Anime_Episode) => {
        if (!entry) return
        const epNum = episode.absoluteEpisodeNumber || episode.episodeNumber
        const newProgress = episode.watched ? Math.max(0, epNum - 1) : epNum
        handleUpdateProgress(newProgress)
    }, [entry, handleUpdateProgress])

    const handlePlayEpisode = useCallback((localFile: Anime_LocalFile, episode: Anime_Episode) => {
        if (!localFile.path) {
            toast.error("Archivo local no disponible.")
            return
        }
        const isMp4 = localFile.path.toLowerCase().endsWith(".mp4")
        const targetType = isMp4 ? "direct" : "transcode"
        const epNum = episode.absoluteEpisodeNumber || episode.episodeNumber
        startViewTransition(() => {
            setPlayTarget({
                path: localFile.path,
                streamType: targetType as Mediastream_StreamType,
                episodeLabel: episode.episodeTitle || episode.displayTitle || `Episodio ${epNum}`,
                episodeNumber: epNum,
                malId: entry?.media?.idMal ?? null,
            })
        })
    }, [entry?.media?.idMal])

    const handlePlayLocalFile = useCallback((localFile: Anime_LocalFile) => {
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
        startViewTransition(() => {
            setPlayTarget({
                path: localFile.path,
                streamType: targetType as Mediastream_StreamType,
                episodeLabel: localFile.name,
                episodeNumber: resolvedEpNum,
                malId: entry?.media?.idMal ?? null,
            })
        })
    }, [computedEpisodes, entry?.media?.idMal])
    
    const handlePlayDefault = useCallback(() => {
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
    }, [entry, computedEpisodes, continuityData?.item, handlePlayLocalFile, handlePlayEpisode])

    const marathonModeStore = useAppStore(s => s.marathonMode)

    const handleNextEpisode = () => {
        if (!computedEpisodes || !playTarget) return
        const currentEpIdx = computedEpisodes.findIndex(ep => (ep.absoluteEpisodeNumber || ep.episodeNumber) === playTarget.episodeNumber)
        if (currentEpIdx === -1 || currentEpIdx >= computedEpisodes.length - 1) {
            toast.info("Has llegado al final de la lista de episodios.")
            startViewTransition(() => {
                setPlayTarget(null)
            })
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
            startViewTransition(() => {
                setPlayTarget(null)
            })
            return
        }
        handlePlayEpisode(lf, nextEp)
    }

    const heroBackdrop = useMemo(
        () => getHighResImage(entry?.media?.bannerImage || entry?.media?.posterImage || ""),
        [entry?.media?.bannerImage, entry?.media?.posterImage]
    )

    const hasNextEpisode = useMemo(() => {
        if (!computedEpisodes || !playTarget) return false
        const idx = computedEpisodes.findIndex(ep =>
            (ep?.absoluteEpisodeNumber || ep?.episodeNumber) === playTarget.episodeNumber
        )
        return idx >= 0 && idx < computedEpisodes.length - 1
    }, [computedEpisodes, playTarget])

    if ((isLoading && !entry) || (entry && isMovie)) {
        if (isMovie) {
            return (
                <div className="h-full w-full bg-[#09090b] text-white flex items-center justify-center">
                    <div className="flex flex-col items-center gap-5">
                        <div className="w-10 h-10 border-2 border-brand-orange border-t-transparent rounded-full animate-spin" />
                        <span className="text-[9px] font-black uppercase tracking-[0.5em] text-zinc-500 animate-pulse">
                            Redirigiendo a Película...
                        </span>
                    </div>
                </div>
            )
        }
        return (
            <div className="h-full w-full flex flex-col overflow-y-auto bg-[#09090b] text-white pb-16 animate-pulse">
                {/* Hero Skeleton */}
                <div className="relative w-full min-h-[85vh] md:min-h-[90vh] flex flex-col justify-end overflow-hidden bg-[#09090b] select-none">
                    {/* Ambient glow placeholder */}
                    <div className="absolute inset-0 bg-gradient-to-br from-zinc-900/60 via-transparent to-transparent" />
                    <div className="absolute inset-0 bg-zinc-900/40 animate-pulse" />
                    {/* Cinematic gradient masking */}
                    <div className="absolute inset-0 bg-gradient-to-t from-[#09090b] via-[#09090b]/60 to-transparent" />

                    {/* Text content skeleton */}
                    <div className="relative z-20 flex flex-col justify-end items-start px-6 sm:px-12 md:pl-[240px] md:pr-24 pb-20 pt-48 gap-5">
                        {/* Tags row */}
                        <div className="flex items-center gap-3">
                            <div className="h-6 w-16 bg-white/10 rounded-md" />
                            <div className="h-6 w-12 bg-white/10 rounded-md" />
                            <div className="h-6 w-20 bg-white/10 rounded-md" />
                            <div className="h-6 w-16 bg-white/10 rounded-md" />
                        </div>
                        {/* Title skeleton */}
                        <div className="flex flex-col gap-3 w-full">
                            <div className="h-16 md:h-24 w-3/4 bg-white/10 rounded-lg" />
                            <div className="h-12 w-1/2 bg-white/8 rounded-lg" />
                        </div>
                        {/* Metadata strip */}
                        <div className="flex items-center gap-6">
                            <div className="h-4 w-10 bg-white/10 rounded" />
                            <div className="h-6 w-28 bg-white/10 rounded-md" />
                            <div className="h-4 w-16 bg-white/10 rounded" />
                        </div>
                        {/* Synopsis skeleton */}
                        <div className="flex flex-col gap-2 max-w-3xl w-full">
                            <div className="h-4 w-full bg-white/8 rounded" />
                            <div className="h-4 w-full bg-white/8 rounded" />
                            <div className="h-4 w-2/3 bg-white/8 rounded" />
                        </div>
                        {/* Action button skeleton */}
                        <div className="flex gap-4 mt-2">
                            <div className="h-12 w-44 bg-brand-orange/20 rounded-xl border border-brand-orange/10" />
                        </div>
                    </div>
                </div>

                {/* Tabs + Episodes skeleton */}
                <div className="w-full max-w-[1800px] mx-auto px-6 sm:px-12 mt-12">
                    {/* Tabs navigation skeleton */}
                    <div className="flex border-b border-white/5 pb-2 mb-8 gap-8">
                        <div className="h-5 w-24 bg-white/15 rounded pb-3" />
                        <div className="h-5 w-24 bg-white/8 rounded pb-3" />
                        <div className="h-5 w-20 bg-white/8 rounded pb-3" />
                    </div>
                    {/* Episode cards grid skeleton */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
                        {Array.from({ length: 6 }).map((_, i) => (
                            <div key={i} className="flex flex-col rounded-xl border border-white/[0.03] bg-zinc-950/40 overflow-hidden">
                                {/* Thumbnail placeholder */}
                                <div className="aspect-video w-full bg-zinc-900/70" style={{ animationDelay: `${i * 80}ms` }} />
                                {/* Card info placeholder */}
                                <div className="p-4 flex flex-col gap-2">
                                    <div className="h-4 w-3/4 bg-white/10 rounded" />
                                    <div className="h-3 w-full bg-white/6 rounded" />
                                    <div className="h-3 w-2/3 bg-white/6 rounded" />
                                    <div className="mt-2 flex gap-2">
                                        <div className="h-3 w-10 bg-white/8 rounded" />
                                        <div className="h-3 w-12 bg-white/8 rounded" />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        )
    }


    if (!entry || !entry.media) {
        return (
            <div className="h-full w-full bg-[#09090b] text-white flex items-center justify-center px-6">
                <EmptyState
                    title="Contenido no encontrado"
                    message="No pudimos cargar este contenido. Vuelve al inicio o intenta con otro."
                />
            </div>
        )
    }

    const title = entry.media.titleSpanish || entry.media.titleRomaji || entry.media.titleEnglish || "Título Desconocido"

    const hasRelations = entry.media?.relations && entry.media.relations.length > 0
    const hasCharacters = entry.media?.characters?.edges && entry.media.characters.edges.length > 0
    const hasTechnical = entry.localFiles && entry.localFiles.length > 0

    return (
        <div className="h-full w-full flex flex-col overflow-y-auto bg-[#050506] text-white pb-16">
            <SeriesHero
                title={title}
                romajiTitle={entry.media.titleRomaji || ""}
                backdropUrl={heroBackdrop}
                rating={entry.media.score ? entry.media.score / 10 : undefined}
                year={entry.media.year}
                ageRating={entry.media.isNsfw ? "18+" : "PG-13"}
                sagaCount={sagas.length}
                synopsis={entry.media.description || ""}
            />
            <div className="w-full max-w-[1800px] mx-auto px-6 sm:px-12 mt-12">
                {/* Custom Glassmorphic Tabs Navigation for Series/Shows */}
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

                <div className="mt-8 min-h-[300px]">
                    <AnimatePresence mode="wait">
                        {activeTab === "episodes" && (
                            <motion.div
                                key="episodes"
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 10 }}
                                transition={{ duration: 0.2 }}
                                className="mt-8 flex flex-col lg:flex-row gap-8"
                            >
                                {/* Left Column: Saga Selector */}
                                <div className="lg:w-80 flex-shrink-0">
                                    <SagaSelector 
                                        sagas={sagas}
                                        activeSagaId={activeSagaId}
                                        onSelectSaga={(sagaId) => {
                                            setActiveSagaId(sagaId)
                                            setActiveSubSagaId("")
                                        }}
                                        activeSubSagaId={activeSubSagaId}
                                        onSelectSubSaga={setActiveSubSagaId}
                                    />
                                </div>

                                {/* Right Column: Characters & Episodes */}
                                <div className="flex-grow flex flex-col min-w-0">
                                    {/* Mapped Characters from active saga */}
                                    <CharacterCarousel 
                                        characters={sagas.find(s => s.id === activeSagaId)?.keyCharacters || []}
                                    />
                                    
                                    {/* Mapped Premium Episodes */}
                                    <PremiumEpisodeList 
                                        episodes={computedEpisodes
                                            .filter(ep => ep.sagaId === activeSagaId)
                                            .map(ep => {
                                                const lf = entry.localFiles?.find(f => {
                                                    const fEp = f.metadata?.episode || f.parsedInfo?.episode;
                                                    return Number(fEp) === ep.episodeNumber;
                                                });
                                                return {
                                                    id: ep.episodeNumber.toString(),
                                                    title: ep.displayTitle || ep.episodeTitle || `Episodio ${ep.episodeNumber}`,
                                                    number: ep.episodeNumber,
                                                    description: ep.episodeMetadata?.summary || ep.episodeMetadata?.overview || "",
                                                    thumbnailUrl: ep.episodeMetadata?.image || heroBackdrop,
                                                    episodeType: (lf?.metadata as any)?.episodeType || "Canon",
                                                    isWatched: ep.watched,
                                                    resolution: lf?.technicalInfo?.videoStream?.height ? `${lf.technicalInfo.videoStream.height}p` : "1080p",
                                                    videoCodec: lf?.technicalInfo?.videoStream?.codec || "H264",
                                                    audioCodec: lf?.technicalInfo?.audioStreams?.[0]?.codec || "AAC"
                                                }
                                            })}
                                        activeSubSagaStart={activeSubSaga?.startEp}
                                        activeSubSagaEnd={activeSubSaga?.endEp}
                                    />
                                </div>
                            </motion.div>
                        )}

                        {activeTab === "relations" && (
                            <motion.div
                                key="relations"
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 10 }}
                                transition={{ duration: 0.2 }}
                                className="py-4"
                            >
                                <RelationsTab media={entry.media} />
                            </motion.div>
                        )}

                        {activeTab === "characters" && (
                            <motion.div
                                key="characters"
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 10 }}
                                transition={{ duration: 0.2 }}
                                className="py-4"
                            >
                                <CharactersTab characters={entry.media?.characters?.edges || []} />
                            </motion.div>
                        )}

                        {activeTab === "technical" && (
                            <motion.div
                                key="technical"
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 10 }}
                                transition={{ duration: 0.2 }}
                                className="py-4"
                            >
                                <TechnicalMetadataTab localFiles={entry.localFiles || []} />
                            </motion.div>
                        )}
                    </AnimatePresence>
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
                    hasNextEpisode={hasNextEpisode}
                    onClose={() => {
                        startViewTransition(() => {
                            setPlayTarget(null)
                        })
                        refetchContinuity()
                        queryClient.invalidateQueries({ queryKey: [API_ENDPOINTS.ANIME_ENTRIES.GetAnimeEntry.key, String(seriesId)] })
                    }}
                />
            )}
        </div>
    )
}
