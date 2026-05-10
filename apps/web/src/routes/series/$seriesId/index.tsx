import { createFileRoute } from "@tanstack/react-router"
import { HydrationBoundary, dehydrate } from "@tanstack/react-query"
import React, { useMemo, useState, useCallback, useEffect } from "react"
import { FileVideo } from "lucide-react"
import { toast } from "sonner"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"

import { cn } from "@/components/ui/core/styling"
import { fetchAnimeEntry, useGetAnimeEntry } from "@/api/hooks/anime_entries.hooks"
import { API_ENDPOINTS } from "@/api/generated/endpoints"
import { Anime_Episode, Anime_LocalFile, Mediastream_StreamType, Anime_Entry } from "@/api/generated/types"
import { EmptyState } from "@/components/shared/empty-state"
import { VideoPlayer } from "@/components/video/player"
import { MediaActionButtons, EpisodeListItem } from "./-series-interactivity-client"
import { sanitizeHtml } from "@/lib/helpers/sanitizer"
import { resolveSeriesSagas, type SagaDefinition } from "@/lib/config/dragonball.config"
import { CassetteCard } from "@/components/shared/cassette-card"
import { RelationsTab, CharactersTab, TechnicalMetadataTab } from "./-series-bento-tabs"

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
    const { data: entry } = useGetAnimeEntry(seriesId)

    const [playTarget, setPlayTarget] = useState<{
        path: string
        streamType: Mediastream_StreamType
        episodeLabel: string
        episodeNumber: number
        malId?: number | null
    } | null>(null)

    const handlePlayEpisode = useCallback((localFile: Anime_LocalFile, episode: Anime_Episode) => {
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
    }, [entry?.media])

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

    const heroBackdrop = entry.media.bannerImage || entry.media.posterImage || ""
    const title = entry.media.titleRomaji || entry.media.titleEnglish || "Título Desconocido"

    const resolvedSagas = resolveSeriesSagas(entry.media)
    const hasSagas = resolvedSagas.length > 0
    const sagas = resolvedSagas
    const hasLocalFiles = (entry.localFiles || []).length > 0
    const hasNoEpisodes = !entry.episodes || entry.episodes.length === 0

    return (
        <div className="min-h-screen bg-[#09090b] text-white pb-16">
            <HeroSection
                seriesId={seriesId}
                directoryPath={entry.libraryData?.sharedPath || ""}
                backdropUrl={heroBackdrop}
                entry={entry}
            />

            <div className="w-full max-w-[1800px] mx-auto px-6 sm:px-12 mt-8">
                <Tabs defaultValue="episodes" className="w-full">
                    <TabsList className="bg-transparent border-b border-white/10 w-full justify-start rounded-none p-0 h-auto gap-8">
                        <TabsTrigger 
                            value="episodes" 
                            className="bg-transparent p-0 pb-4 text-xs font-black tracking-[0.2em] uppercase data-[state=active]:bg-transparent data-[state=active]:text-white data-[state=active]:shadow-none data-[state=active]:border-b-2 border-white rounded-none opacity-50 data-[state=active]:opacity-100"
                        >
                            Episodios
                        </TabsTrigger>
                        {hasSagas && (
                            <TabsTrigger 
                                value="relations" 
                                className="bg-transparent p-0 pb-4 text-xs font-black tracking-[0.2em] uppercase data-[state=active]:bg-transparent data-[state=active]:text-white data-[state=active]:shadow-none data-[state=active]:border-b-2 border-white rounded-none opacity-50 data-[state=active]:opacity-100"
                            >
                                Sagas & Relaciones
                            </TabsTrigger>
                        )}
                        <TabsTrigger 
                            value="characters" 
                            className="bg-transparent p-0 pb-4 text-xs font-black tracking-[0.2em] uppercase data-[state=active]:bg-transparent data-[state=active]:text-white data-[state=active]:shadow-none data-[state=active]:border-b-2 border-white rounded-none opacity-50 data-[state=active]:opacity-100"
                        >
                            Personajes
                        </TabsTrigger>
                        <TabsTrigger 
                            value="technical" 
                            className="bg-transparent p-0 pb-4 text-xs font-black tracking-[0.2em] uppercase data-[state=active]:bg-transparent data-[state=active]:text-white data-[state=active]:shadow-none data-[state=active]:border-b-2 border-white rounded-none opacity-50 data-[state=active]:opacity-100"
                        >
                            Técnica
                        </TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="episodes" className="mt-8 outline-none">
                        {hasNoEpisodes && hasLocalFiles ? (
                            <LocalFilesSection 
                                localFiles={entry.localFiles || []}
                                title={title}
                                onPlay={(lf) => handlePlayEpisode(lf, {} as Anime_Episode)}
                            />
                        ) : (
                            <SagaEpisodesSection 
                                seriesTitle={title} 
                                fallbackThumb={heroBackdrop} 
                                episodes={entry.episodes || []}
                                localFiles={entry.localFiles || []}
                                sagas={sagas}
                                onPlay={handlePlayEpisode}
                                currentlyPlayingEpNumber={playTarget?.episodeNumber}
                            />
                        )}
                    </TabsContent>
                    
                    {hasSagas && (
                    <TabsContent value="relations" className="mt-8 outline-none min-h-[400px]">
                        <RelationsTab media={entry.media} />
                    </TabsContent>
                )}

                <TabsContent value="characters" className="mt-8 outline-none min-h-[400px]">
                    <CharactersTab characters={entry.media?.characters?.edges || []} />
                </TabsContent>

                <TabsContent value="technical" className="mt-8 outline-none min-h-[400px]">
                    <TechnicalMetadataTab localFiles={entry.localFiles || []} />
                </TabsContent>
                </Tabs>
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
}

const HeroSection = React.memo(function HeroSection({
    seriesId,
    directoryPath,
    backdropUrl,
    entry,
}: HeroSectionProps) {
    const [synopsisExpanded, setSynopsisExpanded] = useState(false)
    const media = entry.media!
    const synopsis = media.description || "Sin descripción disponible."
    const cleanSynopsis = useMemo(() => sanitizeHtml(synopsis), [synopsis])
    
    const title = media.titleRomaji || media.titleEnglish || "Título Desconocido"
    const year = media.year?.toString() || ""
    const genres = media.genres || []
    
    const episodesCount = media.totalEpisodes || entry.episodes?.length || 0
    const localEpisodesCount = entry.localFiles?.length ?? 0
    const totalEpisodesCount = media.totalEpisodes || entry.episodes?.length || 0

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
        <section className="relative w-full min-h-[80vh] flex flex-col justify-end overflow-hidden">
            {/* Cinematic Ambient Halo / Gradient Fallback */}
            <div className="absolute inset-0 overflow-hidden bg-[#09090b]">
                {media.posterImage ? (
                    <div
                        className="absolute left-1/2 top-[20%] -translate-x-1/2 w-[1000px] h-[1000px] rounded-full blur-[180px] opacity-50"
                        style={{
                            backgroundImage: `url(${media.posterImage})`,
                            backgroundSize: "cover",
                            backgroundPosition: "center",
                            filter: "blur(180px) saturate(200%) brightness(0.7)",
                            transform: "translateX(-50%) scale(1.6)",
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
                <div className="absolute inset-0 bg-gradient-to-t from-[#09090b] via-[#09090b]/60 to-transparent" />
            </div>

            {/* Backdrop (Cinematic Overlay) */}
            {backdropUrl && (
                <div className="absolute inset-0 overflow-hidden">
                    <img
                        src={backdropUrl}
                        alt={title}
                        className="w-full h-full object-cover object-center opacity-30 grayscale mix-blend-screen"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#09090b] via-transparent to-transparent" />
                </div>
            )}

            {/* Content */}
            <div className="relative z-10 flex flex-col lg:flex-row items-end gap-12 px-6 sm:px-12 pb-20 pt-40 max-w-[1800px] mx-auto w-full">
                {/* Cover Poster (Super-Size Cassette) */}
                <div className="hidden lg:block shrink-0 w-[300px] transition-all duration-300">
                    <CassetteCard entry={entry} size="hero" />
                </div>

                {/* Meta Information */}
                <div className="flex-1 flex flex-col gap-8 min-w-0">
                    {/* Tags */}
                    <div className="flex flex-wrap gap-3">
                        {genres.slice(0, 5).map((g: string) => (
                            <span
                                key={g}
                                className="px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] bg-white text-black border border-white"
                            >
                                {g}
                            </span>
                        ))}
                    </div>

                    {/* Main Title (Logo or Bebas) */}
                    {media.logoImage ? (
                        <div className="relative h-32 sm:h-40 xl:h-64 mb-6 animate-in fade-in slide-in-from-left-8 duration-1000">
                            <img 
                                src={media.logoImage} 
                                alt={title} 
                                className="h-full w-auto object-contain object-left drop-shadow-[0_0_60px_rgba(0,0,0,0.9)] brightness-110" 
                            />
                        </div>
                    ) : (
                        <h1 className="text-[clamp(4rem,10vw,11rem)] font-bebas font-normal leading-[0.8] tracking-tighter text-white uppercase drop-shadow-[0_10px_30px_rgba(0,0,0,0.5)]">
                            {title}
                        </h1>
                    )}

                    {/* Metadata Strip */}
                    <div className="flex flex-wrap items-center gap-6 text-[10px] font-black uppercase tracking-[0.4em] text-white/50">
                        {year && <span>{year}</span>}
                        {(totalEpisodesCount ?? 0) > 0 && localEpisodesCount !== undefined && localEpisodesCount > 0 ? (
                            <span className={localEpisodesCount >= (totalEpisodesCount ?? 0) ? "text-green-500" : "text-brand-orange"}>
                                {localEpisodesCount}/{totalEpisodesCount} EPISODIOS
                            </span>
                        ) : episodesCount > 0 ? (
                            <span>{episodesCount} EPISODIOS</span>
                        ) : null}
                    </div>

                    {/* Minimal Synopsis */}
                    <div className="max-w-3xl relative">
                        <div 
                            className={cn(
                                "text-[16px] text-zinc-300 leading-relaxed font-medium uppercase tracking-widest transition-all duration-300 bg-white/[0.03] p-8 rounded-2xl border border-white/10 backdrop-blur-3xl shadow-inner",
                                synopsisExpanded ? "" : "line-clamp-4",
                            )}
                            dangerouslySetInnerHTML={{ __html: cleanSynopsis }}
                        />
                        {synopsis.length > 200 && (
                            <button
                                onClick={() => setSynopsisExpanded((v) => !v)}
                                className="mt-4 text-[10px] font-black uppercase tracking-[0.4em] text-white hover:underline underline-offset-8"
                            >
                                {synopsisExpanded ? "[ LEER MENOS ]" : "[ LEER MÁS ]"}
                            </button>
                        )}
                    </div>

                    {/* Actions */}
                    <div className="mt-6">
                        <MediaActionButtons seriesId={seriesId} directoryPath={directoryPath} />
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
    onPlay?: (localFile: Anime_LocalFile, episode: Anime_Episode) => void
    currentlyPlayingEpNumber?: number
}

const SagaEpisodesSection = React.memo(function SagaEpisodesSection({
    seriesTitle,
    fallbackThumb,
    episodes,
    localFiles,
    sagas,
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

    useEffect(() => {
        setActiveSubSagaId("all")
    }, [activeSagaId])

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
                return episodes.filter(ep => ep.episodeNumber >= subSaga.startEp && ep.episodeNumber <= subSaga.endEp)
            }
        }
        
        return episodes.filter(ep => ep.episodeNumber >= saga.startEp && ep.episodeNumber <= saga.endEp)
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
            <div className="flex flex-col gap-8">
                {/* Tabs Selector for Sagas */}
                {generatedSagas.length > 1 && (
                    <div className="sticky top-16 z-30 bg-[#09090b]/80 backdrop-blur-xl border-b border-white/5 divide-y divide-white/5">
                         <div className="flex flex-wrap gap-2 px-6 sm:px-12 py-6">
                            {generatedSagas.map(saga => {
                                const isActive = activeSagaId === saga.id.toString()
                                return (
                                    <button
                                        key={saga.id}
                                        onClick={() => setActiveSagaId(saga.id.toString())}
                                        className={cn(
                                            "px-6 py-2 text-[10px] font-black uppercase tracking-[0.2em] transition-all duration-300",
                                            isActive 
                                                ? "bg-white text-black shadow-[4px_4px_0px_0px_rgba(255,255,255,0.2)]" 
                                                : "bg-white/5 text-white/40 hover:text-white hover:bg-white/10"
                                        )}
                                    >
                                        {saga.title}
                                    </button>
                                )
                            })}
                        </div>

                        {/* SubSagas Secondary Pill Bar */}
                        {activeMainSaga?.subSagas && activeMainSaga.subSagas.length > 0 && (
                            <div className="flex flex-wrap gap-2 items-center px-6 sm:px-12 py-4 bg-white/[0.01]">
                                <span className="text-[9px] font-black tracking-[0.2em] uppercase text-zinc-500 mr-2">SUB-SAGAS:</span>
                                <button
                                    onClick={() => setActiveSubSagaId("all")}
                                    className={cn(
                                        "px-4 py-1.5 text-[9px] font-black uppercase tracking-[0.15em] border transition-all duration-300 rounded-none",
                                        activeSubSagaId === "all"
                                            ? "bg-white text-black border-white"
                                            : "bg-transparent text-zinc-400 border-white/10 hover:text-white hover:border-white/30"
                                    )}
                                >
                                    Ver Todo
                                </button>
                                {activeMainSaga.subSagas.map((sub) => {
                                    const isSubActive = activeSubSagaId === sub.id
                                    return (
                                        <button
                                            key={sub.id}
                                            onClick={() => setActiveSubSagaId(sub.id)}
                                            className={cn(
                                                "px-4 py-1.5 text-[9px] font-black uppercase tracking-[0.15em] border transition-all duration-300 rounded-none",
                                                isSubActive
                                                    ? "bg-white text-black border-white"
                                                    : "bg-transparent text-zinc-400 border-white/10 hover:text-white hover:border-white/30"
                                            )}
                                        >
                                            {sub.title}
                                        </button>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                )}

                {/* Episode List Header & Grid */}
                <div className="px-6 sm:px-12 flex flex-col gap-10">
                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-white/5 pb-8">
                        <div className="flex flex-col gap-2">
                            <h2 className="text-5xl font-bebas tracking-[0.2em] text-white uppercase leading-none">
                                EPISODIOS
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
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 xl:gap-8">
                            {visibleEpisodes.map((ep) => (
                                <EpisodeCard
                                    key={ep.episodeNumber}
                                    episode={ep}
                                    fallbackThumb={fallbackThumb}
                                    localFile={getLocalFile(ep.episodeNumber)}
                                    onPlay={onPlay}
                                    isCurrentlyPlaying={currentlyPlayingEpNumber === ep.episodeNumber}
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
    onPlay?: (localFile: Anime_LocalFile) => void
}

const LocalFilesSection = React.memo(function LocalFilesSection({
    localFiles,
    title,
    onPlay,
}: LocalFilesSectionProps) {
    const handleClick = (lf: Anime_LocalFile) => {
        if (onPlay) onPlay(lf)
    }

    return (
        <section className="relative z-[1] px-6 sm:px-10 pb-20">
            <div className="flex flex-col gap-8">
                <div className="flex items-center justify-between border-b border-white/10 pb-6">
                    <h2 className="text-4xl font-bebas tracking-widest text-white uppercase">ARCHIVOS LOCALES</h2>
                    <span className="text-[10px] font-black tracking-[0.3em] text-white/30 uppercase">
                        {localFiles.length} ARCHIVO{localFiles.length !== 1 ? "S" : ""}
                    </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {localFiles.map((lf, idx) => (
                        <div
                            key={lf.path || idx}
                            className="group relative flex flex-col rounded-none overflow-hidden bg-black border border-white/10 hover:border-green-500 transition-all duration-200 cursor-pointer"
                            onClick={() => handleClick(lf)}
                        >
                            <div className="relative w-full aspect-video overflow-hidden bg-zinc-900 border-b border-white/10">
                                <div className="absolute inset-0 flex items-center justify-center bg-zinc-900">
                                    <FileVideo className="w-12 h-12 text-zinc-600 group-hover:text-green-500 transition-colors" />
                                </div>
                                <div className="absolute top-0 left-0">
                                    <span className="px-3 py-1 bg-green-600 text-[10px] font-black text-white tracking-widest uppercase">
                                        LOCAL
                                    </span>
                                </div>
                            </div>
                            <div className="flex flex-col gap-2 p-5 flex-1 bg-black">
                                <h4 className="text-xs font-black leading-tight tracking-[0.2em] line-clamp-2 uppercase text-white">
                                    {title}
                                </h4>
                                <p className="text-[9px] font-bold text-green-500 tracking-wider truncate" title={lf.path}>
                                    📁 {lf.name}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    )
})
