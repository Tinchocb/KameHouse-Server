import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { HydrationBoundary, dehydrate, useQueryClient } from "@tanstack/react-query"
import React, { useMemo, useState } from "react"
import { toast } from "sonner"
import { useAppStore } from "@/lib/store"
import { getHighResImage } from "@/lib/helpers/images"
import { fetchAnimeEntry, useGetAnimeEntry } from "@/api/hooks/anime_entries.hooks"
import { useGetContinuityWatchHistoryItem } from "@/api/hooks/continuity.hooks"
import { API_ENDPOINTS } from "@/api/generated/endpoints"
import { Anime_LocalFile, Mediastream_StreamType } from "@/api/generated/types"
import { EmptyState } from "@/components/shared/empty-state"
import { VideoPlayer } from "@/components/video/player"
import { sanitizeHtml } from "@/lib/helpers/sanitizer"
import { startViewTransition } from "@/lib/helpers/transitions"
import { MovieHeroSection } from "../series/$seriesId/-components/movie-hero"
import { MovieBentoSpecs } from "./-components/movie-bento-specs"
import { ChronologyWidget } from "./-components/chronology-widget"
import { MovieAudioSubs } from "./-components/movie-audio-subs"
import { CollectionSwimlane } from "./-components/collection-swimlane"
import { useSound } from "@/hooks/use-sound"
import { cn } from "@/components/ui/core/styling"

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

function MovieDetailPage() {
    const { movieId } = Route.useParams()
    const { dehydrateState } = Route.useLoaderData()

    return (
        <HydrationBoundary state={dehydrateState}>
            <MovieDetailClient key={movieId} movieId={movieId} />
        </HydrationBoundary>
    )
}

const formatFileSize = (bytes: number) => {
    if (!bytes) return "0 MB"
    const mb = bytes / (1024 * 1024)
    if (mb >= 1024) {
        return `${(mb / 1024).toFixed(2)} GB`
    }
    return `${mb.toFixed(0)} MB`
}

const parseFrameRate = (fps: string | undefined | null): number => {
    if (!fps) return 24
    if (fps.includes("/")) {
        const [num, den] = fps.split("/").map(Number)
        if (num && den) return Math.round(num / den)
    }
    const val = Number(fps)
    return isNaN(val) ? 24 : Math.round(val)
}

type TabKey = "SUGGESTED" | "EXTRAS" | "VERSIONS" | "DETAILS"
const TABS: TabKey[] = ["SUGGESTED", "EXTRAS", "VERSIONS", "DETAILS"]

function MovieDetailClient({ movieId }: { movieId: string }) {
    const { playSound } = useSound()
    const queryClient = useQueryClient()
    const navigate = useNavigate()
    const { data: entry, isLoading } = useGetAnimeEntry(movieId)
    const { data: continuityData, refetch: refetchContinuity } = useGetContinuityWatchHistoryItem(Number(movieId))

    React.useEffect(() => {
        if (entry) playSound("detail", 0.4)
    }, [entry?.media?.id, playSound])

    const [playTarget, setPlayTarget] = useState<{
        path: string
        streamType: Mediastream_StreamType
        episodeLabel: string
        episodeNumber: number
        malId?: number | null
    } | null>(null)

    const [activeTab, setActiveTab] = useState<TabKey>("SUGGESTED")

    const title = entry?.media?.titleSpanish || entry?.media?.titleEnglish || entry?.media?.titleRomaji || "Título Desconocido"

    // Mock technical data based on local file for now
    const techInfo = entry?.localFiles?.[0]?.technicalInfo as any
    const technicalData = useMemo(() => {
        if (!techInfo) return null
        return {
            fileSize: formatFileSize(techInfo.size || 0),
            resolutionTag: techInfo.videoStream?.width >= 1920 ? "1080P FHD" : "720P HD",
            videoCodec: techInfo.videoStream?.codec || "H264",
            bitrate: techInfo.bitrate ? `${(techInfo.bitrate / 1000000).toFixed(1)} Mb/s` : "Unknown",
            audioTracks: techInfo.audioStreams?.map((a: any) => a.language?.toUpperCase() || "AUDIO").filter(Boolean) || ["ESPAÑOL LATINO", "JAPONÉS"],
            subtitles: techInfo.subtitleStreams?.map((s: any) => s.language?.toUpperCase() || "SUB").filter(Boolean) || ["ESPAÑOL"],
            collectionId: "dbz_movies"
        }
    }, [techInfo])

    const chronologyData = useMemo(() => {
        return {
            startEpisodeContext: 120,
            endEpisodeContext: 125,
            chronologyNotes: "Transcurre durante la época en que Goku entrenaba en la Tierra."
        }
    }, [])

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
                malId: entry?.media?.idMal ?? null,
            })
        })
    }

    const handlePlayDefault = () => {
        if (entry?.localFiles && entry.localFiles.length > 0) {
            handlePlayLocalFile(entry.localFiles[0])
        } else {
            toast.info("No hay archivos locales disponibles para reproducir.")
        }
    }

    if (isLoading && !entry) {
        return <div className="h-full w-full bg-[#050506] animate-pulse pb-16" />
    }

    if (!entry || !entry.media) {
        return (
            <div className="min-h-screen bg-[#050506] text-white flex items-center justify-center">
                <EmptyState title="Película no encontrada" message="No pudimos cargar este contenido." />
            </div>
        )
    }

    return (
        <div className="h-full w-full flex flex-col overflow-y-auto bg-[#07070a] text-white pb-24 relative">
            
            <MovieHeroSection 
                seriesId={movieId}
                directoryPath={entry.libraryData?.sharedPath || ""}
                backdropUrl={getHighResImage(entry.media.bannerImage || entry.media.posterImage)}
                entry={entry}
                onPlay={handlePlayDefault}
                continuityItem={continuityData?.item}
                className="mb-0"
            />

            {/* Navigation Tabs (Disney+ Style) */}
            <div className="w-full max-w-[1800px] mx-auto px-6 sm:px-12 -mt-4 relative z-20">
                <div className="flex items-center gap-8 border-b border-white/10 pb-4">
                    {TABS.map((tab) => (
                        <button
                            key={tab}
                            onClick={() => startViewTransition(() => setActiveTab(tab))}
                            className={cn(
                                "relative font-sans text-xs md:text-[14px] uppercase tracking-widest font-extrabold transition-colors duration-300",
                                activeTab === tab ? "text-white" : "text-zinc-500 hover:text-white"
                            )}
                        >
                            {tab}
                            {/* Active indicator line */}
                            {activeTab === tab && (
                                <div className="absolute -bottom-[17px] left-0 w-full h-[3px] bg-white rounded-t-full shadow-[0_0_10px_rgba(255,255,255,0.5)]" />
                            )}
                        </button>
                    ))}
                </div>
            </div>

            {/* Tab Content Area */}
            <div className="w-full max-w-[1800px] mx-auto px-6 sm:px-12 mt-8 animate-fade-in z-10 relative min-h-[40vh]">
                
                {/* SUGGESTED TAB */}
                {activeTab === "SUGGESTED" && (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                        {entry.media.relations && entry.media.relations.length > 0 ? (
                            <CollectionSwimlane 
                                collectionId="related"
                                collectionName=""
                                movies={entry.media.relations
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

                {/* DETAILS TAB */}
                {activeTab === "DETAILS" && (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 flex flex-col lg:flex-row gap-12 items-start mt-4">
                        {/* Left Column (Specs) */}
                        <div className="flex flex-col w-full lg:w-80 flex-shrink-0 gap-6">
                            <MovieBentoSpecs technical={technicalData} />
                        </div>

                        {/* Right Column (Chronology, Audio/Subs) */}
                        <div className="flex-grow flex flex-col min-w-0">
                            <ChronologyWidget chronology={chronologyData} />
                            {technicalData && (
                                <div className="mt-8">
                                    <MovieAudioSubs audioTracks={technicalData.audioTracks} subtitles={technicalData.subtitles} />
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* EXTRAS TAB */}
                {activeTab === "EXTRAS" && (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 flex items-center justify-center h-48 text-zinc-500 text-sm font-medium tracking-wide">
                        NO HAY EXTRAS DISPONIBLES
                    </div>
                )}

                {/* VERSIONS TAB */}
                {activeTab === "VERSIONS" && (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 flex items-center justify-center h-48 text-zinc-500 text-sm font-medium tracking-wide">
                        SÓLO UNA VERSIÓN DISPONIBLE
                    </div>
                )}

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
                    mediaFormat={entry.media?.format ?? "MOVIE"}
                    onNextEpisode={() => {}}
                    hasNextEpisode={false}
                    onClose={() => {
                        startViewTransition(() => setPlayTarget(null))
                        refetchContinuity()
                        queryClient.invalidateQueries({ queryKey: [API_ENDPOINTS.ANIME_ENTRIES.GetAnimeEntry.key, String(movieId)] })
                    }}
                />
            )}
        </div>
    )
}
