import { createFileRoute, useNavigate, Link } from "@tanstack/react-router"
import { HydrationBoundary, dehydrate } from "@tanstack/react-query"
import React, { useMemo, useState, useCallback } from "react"
import { FileVideo } from "lucide-react"
import { toast } from "sonner"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/components/ui/core/styling"
import { fetchAnimeEntry, useGetAnimeEntry } from "@/api/hooks/anime_entries.hooks"
import { API_ENDPOINTS } from "@/api/generated/endpoints"
import { Anime_Episode, Anime_LocalFile, Mediastream_StreamType } from "@/api/generated/types"
import { EmptyState } from "@/components/shared/empty-state"
import { VideoPlayer } from "@/components/video/player"
import { MediaActionButtons, EpisodeClientCard } from "./-series-interactivity-client"
import { sanitizeHtml } from "@/lib/helpers/sanitizer"
import { resolveSeriesSagas, type SagaDefinition } from "@/lib/config/dragonball.config"
import { VhsShelfAccordion, type VhsTapeItem } from "@/components/shared/vhs-shelf-accordion"

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
            malId: (entry?.media as any)?.idMal ?? null,
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
    const coverImage = entry.media.posterImage || ""
    const genres = entry.media.genres || ["Anime"]
    const title = entry.media.titleRomaji || entry.media.titleEnglish || "Título Desconocido"
    const year = entry.media.year?.toString() || ""
    const synopsis = entry.media.description || "Sin descripción disponible."
    const episodesCount = entry.media.totalEpisodes || entry.episodes?.length || 0

    const resolvedSagas = resolveSeriesSagas(entry.media)
    const hasSagas = resolvedSagas.length > 0
    const sagas = resolvedSagas
    const isMovie = entry.media?.format === "MOVIE" || entry.media?.format === "OVA" || entry.media?.format === "SPECIAL"
    const hasLocalFiles = (entry.localFiles || []).length > 0
    const hasNoEpisodes = !entry.episodes || entry.episodes.length === 0
    const localEpisodesCount = entry.localFiles?.length ?? 0
    const totalEpisodesCount = entry.media.totalEpisodes || entry.episodes?.length || 0

    return (
        <div className="min-h-screen bg-[#09090b] text-white pb-16">
            <HeroSection
                seriesId={seriesId}
                directoryPath={entry.libraryData?.sharedPath || ""}
                backdropUrl={heroBackdrop}
                coverUrl={coverImage}
                title={title}
                year={year}
                genres={genres}
                synopsis={synopsis}
                episodesCount={episodesCount}
                localEpisodesCount={localEpisodesCount}
                totalEpisodesCount={totalEpisodesCount}
            />

            <div className="w-full">
                {hasSagas ? (
                    <SagasSection seriesId={seriesId} sagas={sagas} />
                ) : hasNoEpisodes && hasLocalFiles ? (
                    <LocalFilesSection 
                        localFiles={entry.localFiles || []}
                        title={title}
                        onPlay={(lf) => handlePlayEpisode(lf, {} as Anime_Episode)}
                    />
                ) : (
                    <EpisodesSection 
                        seriesTitle={title} 
                        fallbackThumb={heroBackdrop} 
                        episodes={entry.episodes || []}
                        localFiles={entry.localFiles || []}
                        onPlay={handlePlayEpisode}
                    />
                )}
            </div>

            {playTarget && (
                <VideoPlayer
                    streamUrl={playTarget.path}
                    streamType={playTarget.streamType as any}
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
function SagasSection({ seriesId, sagas }: { seriesId: string, sagas: SagaDefinition[] }) {
    const navigate = useNavigate()

    const vhsTapeSagas = useMemo<VhsTapeItem[]>(() => {
        return sagas.map((s) => {
            return {
                id: s.id,
                title: s.title,
                subtitle: `EPS ${s.startEp} - ${s.endEp}`,
                description: s.description,
                posterUrl: s.image,
                bannerUrl: s.image,
                episodesCount: s.endEp - s.startEp + 1,
                tmdbId: Number(seriesId), // Inherit main series theme for color sync!
                format: "ARC",
            }
        })
    }, [sagas, seriesId])

    return (
        <section className="relative z-[1] px-6 sm:px-10 pb-20">
            <div className="flex flex-col gap-8">
                <div className="space-y-1 border-b border-white/10 pb-6">
                    <h2 className="text-4xl font-bebas font-normal text-white uppercase tracking-widest">
                        CRÓNICAS Y SAGAS
                    </h2>
                    <p className="text-sm font-bold uppercase tracking-widest text-zinc-500">
                        Selecciona un arco argumental para explorar sus episodios
                    </p>
                </div>

                <div className="pt-2">
                    <VhsShelfAccordion
                        items={vhsTapeSagas}
                        type="sagas"
                        onItemClick={(item) => navigate({ 
                            to: "/series/$seriesId/$sagaId", 
                            params: { seriesId, sagaId: item.id.toString() } 
                        })}
                    />
                </div>
            </div>
        </section>
    )
}

interface HeroSectionProps {
    seriesId: string
    directoryPath: string
    backdropUrl: string
    coverUrl: string
    title: string
    year: string
    genres: string[]
    synopsis: string
    episodesCount: number
    localEpisodesCount?: number
    totalEpisodesCount?: number
}

const HeroSection = React.memo(function HeroSection({
    seriesId,
    directoryPath,
    backdropUrl,
    coverUrl,
    title,
    year,
    genres,
    synopsis,
    episodesCount,
    localEpisodesCount,
    totalEpisodesCount,
}: HeroSectionProps) {
    const [synopsisExpanded, setSynopsisExpanded] = useState(false)
    const cleanSynopsis = useMemo(() => sanitizeHtml(synopsis), [synopsis])

    return (
        <section className="relative w-full min-h-[60vh] flex flex-col justify-end overflow-hidden">
            {/* Cinematic Ambient Halo - extracted from poster/cover colors */}
            {coverUrl && (
                <div className="absolute inset-0 overflow-hidden bg-zinc-950">
                    {/* Primary large ambient glow */}
                    <div
                        className="absolute left-1/2 top-[20%] -translate-x-1/2 w-[600px] h-[600px] rounded-full blur-[120px] opacity-40"
                        style={{
                            backgroundImage: `url(${coverUrl})`,
                            backgroundSize: "cover",
                            backgroundPosition: "center",
                            filter: "blur(120px) saturate(150%) brightness(0.8)",
                            transform: "translateX(-50%) scale(1.2)",
                        }}
                    />
                    {/* Secondary subtle edge glow */}
                    <div className="absolute inset-0 bg-gradient-radial-from-cover opacity-30" />
                </div>
            )}

            {/* Backdrop (Grayscale & Solid) */}
            {backdropUrl && (
                <div className="absolute inset-0 overflow-hidden bg-black">
                    <img
                        src={backdropUrl}
                        alt={title}
                        className="w-full h-full object-cover object-center opacity-30 grayscale"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent" />
                </div>
            )}

            {/* Content */}
            <div className="relative z-10 flex flex-col lg:flex-row items-end gap-12 px-6 sm:px-12 pb-20 pt-40 max-w-[1800px] mx-auto w-full">
                {/* Cover Poster (Flat Sharp) */}
                {coverUrl && (
                    <div className="hidden lg:block shrink-0 w-52 xl:w-60 bg-black border border-white/20 transition-all duration-300 hover:border-white">
                        <img src={coverUrl} alt={title} className="w-full aspect-[2/3] object-cover grayscale" />
                    </div>
                )}

                {/* Meta Information */}
                <div className="flex-1 flex flex-col gap-8 min-w-0">
                    {/* Tags */}
                    <div className="flex flex-wrap gap-3">
                        {genres.slice(0, 5).map((g) => (
                            <span
                                key={g}
                                className="px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] bg-white text-black border border-white"
                            >
                                {g}
                            </span>
                        ))}
                    </div>

                    {/* Main Title (Bebas Massive Solid) */}
                    <h1 className="text-6xl sm:text-7xl xl:text-[9rem] font-bebas font-normal leading-[0.85] tracking-tight text-white uppercase drop-shadow-none">
                        {title}
                    </h1>

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
                                "text-[15px] text-zinc-400 leading-relaxed font-bold uppercase tracking-wide transition-all duration-300",
                                synopsisExpanded ? "" : "line-clamp-3",
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

interface EpisodesSectionProps {
    seriesTitle: string
    fallbackThumb: string
    episodes: Anime_Episode[]
    localFiles: Anime_LocalFile[]
    onPlay?: (localFile: Anime_LocalFile, episode: Anime_Episode) => void
}

const EpisodesSection = React.memo(function EpisodesSection({
    seriesTitle,
    fallbackThumb,
    episodes,
    localFiles,
    onPlay,
}: EpisodesSectionProps) {
    const [activeTab, setActiveTab] = useState("all")

    const tabs = useMemo(() => {
        if (episodes.length <= 24) return null
        const groups: { label: string; range: [number, number] }[] = []
        for (let i = 0; i < episodes.length; i += 24) {
            const from = episodes[i].episodeNumber
            const to = episodes[Math.min(i + 23, episodes.length - 1)].episodeNumber
            groups.push({ label: `${from} - ${to}`, range: [i, i + 24] })
        }
        return groups
    }, [episodes])

    const visibleEpisodes = useMemo(() => {
        if (!tabs) return episodes
        const idx = tabs.findIndex((t) => t.label === activeTab)
        if (idx < 0) return episodes
        const [start, end] = tabs[idx].range
        return episodes.slice(start, end)
    }, [episodes, tabs, activeTab])

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

    const tabValue = tabs ? (activeTab === "all" ? tabs[0]?.label ?? "all" : activeTab) : "all"

    return (
        <section className="relative z-[1] px-6 sm:px-10 pb-20">
            <div className="flex flex-col gap-8">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-white/10 pb-6">
                    <h2 className="text-4xl font-bebas tracking-widest text-white uppercase">EPISODIOS</h2>
                    {episodes.length > 0 && (
                        <span className="text-[10px] font-black tracking-[0.3em] text-white/30 uppercase">{episodes.length} TOTAL</span>
                    )}
                </div>

                {/* Tab pagination for large series */}
                {tabs && (
                    <Tabs value={tabValue} onValueChange={setActiveTab}>
                        <ScrollArea>
                            <TabsList className="mb-6 bg-black border border-white/10 h-11 px-1 gap-1 inline-flex flex-nowrap rounded-none">
                                {tabs.map((t) => (
                                    <TabsTrigger
                                        key={t.label}
                                        value={t.label}
                                        className="text-[10px] font-black uppercase tracking-widest text-zinc-500 data-[state=active]:bg-white data-[state=active]:text-black px-4 transition-all rounded-none"
                                    >
                                        {t.label}
                                    </TabsTrigger>
                                ))}
                            </TabsList>
                        </ScrollArea>
                    </Tabs>
                )}

                {/* Episode grid */}
                {visibleEpisodes.length === 0 ? (
                    <div className="py-16 text-center text-white/30 text-sm">
                        No hay episodios disponibles en la biblioteca.
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {visibleEpisodes.map((ep) => (
                            <EpisodeClientCard
                                key={ep.episodeNumber}
                                episode={ep}
                                seriesTitle={seriesTitle}
                                fallbackThumb={fallbackThumb}
                                localFile={getLocalFile(ep.episodeNumber)}
                                onPlay={onPlay}
                            />
                        ))}
                    </div>
                )}
            </div>
        </section>
    )
})
EpisodesSection.displayName = "EpisodesSection"

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
